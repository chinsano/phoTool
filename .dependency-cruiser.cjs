// Dependency Cruiser configuration for phoTool (v17)
// Enforces boundaries and uses TypeScript path mapping via root tsconfig.json
/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-circular',
      severity: 'warn',
      from: {},
      to: { circular: true }
    },
    {
      name: 'no-server-in-web',
      comment: 'web must not import server',
      severity: 'error',
      from: { path: '^web/' },
      to: { path: '^server/' }
    },
    {
      name: 'no-web-in-server',
      comment: 'server must not import web',
      severity: 'error',
      from: { path: '^server/' },
      to: { path: '^web/' }
    },
    {
      name: 'only-shared-cross-boundary',
      comment: 'app code may only cross to other local packages via packages/shared; tests and config are allowed to use node_modules and built-ins',
      severity: 'warn',
      from: { path: '^(server/src|web/src)/' },
      to: { path: '^packages/(?!shared/)', dependencyTypes: ['local'] }
    }
  ],
  options: {
    tsConfig: { fileName: './tsconfig.json' },
    doNotFollow: { path: 'node_modules' },
    exclude: { path: ['(^|/)dist/', '(^|/)\\.storybook/', '(^|/)\\.git/'] }
  }
};


