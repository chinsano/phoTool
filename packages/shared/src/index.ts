export type Brand<K, T> = K & { __brand: T };

export type UIElementId = string & Brand<string, 'UIElementId'>;

export interface SampleType {
  id: string;
  createdAt: string;
}


