import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { beforeAll, afterEach, afterAll, describe, it, expect, vi } from 'vitest';

import { reverseGeocodeBigDataCloud } from '../src/services/placeholders/bigdatacloudGeocoder.js';

// Mock the config to use a test endpoint
vi.mock('../src/config.js', () => ({
  loadConfig: () => ({
    geocoder: {
      enabled: true,
      precision: 3,
      bigdatacloud: {
        baseUrl: 'https://test-api.bigdatacloud.net/data/reverse-geocode-client',
        timeoutMs: 1000,
        retries: 2,
      },
    },
  }),
}));

// Mock the DB client to avoid actual DB writes in this test
vi.mock('../src/db/client.js', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          get: () => undefined, // Always cache miss
        }),
      }),
    }),
    insert: () => ({
      values: () => ({
        run: () => undefined,
      }),
    }),
  },
}));

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('BigDataCloud integration', () => {
  it('returns location data on successful response', async () => {
    server.use(
      http.get('https://test-api.bigdatacloud.net/data/reverse-geocode-client', () => {
        return HttpResponse.json({
          locality: 'Westminster',
          city: 'London',
          principalSubdivision: 'England',
          countryName: 'United Kingdom',
        });
      })
    );

    const result = await reverseGeocodeBigDataCloud(51.5, -0.12);
    expect(result).toEqual({
      country: 'United Kingdom',
      state: 'England',
      city: 'London',
      source: 'bigdatacloud',
    });
  });

  it('uses locality when city is missing', async () => {
    server.use(
      http.get('https://test-api.bigdatacloud.net/data/reverse-geocode-client', () => {
        return HttpResponse.json({
          locality: 'Small Town',
          principalSubdivision: 'State',
          countryName: 'Country',
        });
      })
    );

    const result = await reverseGeocodeBigDataCloud(40.0, -70.0);
    expect(result?.city).toBe('Small Town');
  });

  it('handles missing fields gracefully', async () => {
    server.use(
      http.get('https://test-api.bigdatacloud.net/data/reverse-geocode-client', () => {
        return HttpResponse.json({
          countryName: 'SomeCountry',
        });
      })
    );

    const result = await reverseGeocodeBigDataCloud(0, 0);
    expect(result).toEqual({
      country: 'SomeCountry',
      state: undefined,
      city: undefined,
      source: 'bigdatacloud',
    });
  });

  it('retries on network error and eventually fails', async () => {
    let attempts = 0;
    server.use(
      http.get('https://test-api.bigdatacloud.net/data/reverse-geocode-client', () => {
        attempts++;
        return HttpResponse.error();
      })
    );

    const result = await reverseGeocodeBigDataCloud(10, 20);
    expect(result).toBeUndefined();
    expect(attempts).toBe(3); // initial + 2 retries
  });

  it('retries on HTTP error status', async () => {
    let attempts = 0;
    server.use(
      http.get('https://test-api.bigdatacloud.net/data/reverse-geocode-client', () => {
        attempts++;
        return new HttpResponse(null, { status: 500 });
      })
    );

    const result = await reverseGeocodeBigDataCloud(10, 20);
    expect(result).toBeUndefined();
    expect(attempts).toBe(3); // initial + 2 retries
  });

  it('succeeds on second retry', async () => {
    let attempts = 0;
    server.use(
      http.get('https://test-api.bigdatacloud.net/data/reverse-geocode-client', () => {
        attempts++;
        if (attempts < 2) {
          return HttpResponse.error();
        }
        return HttpResponse.json({
          countryName: 'RetrySuccess',
        });
      })
    );

    const result = await reverseGeocodeBigDataCloud(10, 20);
    expect(result?.country).toBe('RetrySuccess');
    expect(attempts).toBe(2);
  });

  it('handles timeout (simulated by slow response)', async () => {
    server.use(
      http.get('https://test-api.bigdatacloud.net/data/reverse-geocode-client', async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // Longer than 1000ms timeout
        return HttpResponse.json({ countryName: 'TooSlow' });
      })
    );

    const result = await reverseGeocodeBigDataCloud(10, 20);
    expect(result).toBeUndefined(); // Should timeout before response
  });
});

