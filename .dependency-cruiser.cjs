/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-web-to-server',
      comment: 'web must not import server code',
      severity: 'error',
      from: { path: '^web/src' },
      to: { path: '^server/src' }
    },
    {
      name: 'no-server-to-web',
      comment: 'server must not import web code',
      severity: 'error',
      from: { path: '^server/src' },
      to: { path: '^web/src' }
    },
    {
      name: 'only-shared-cross-boundary',
      comment: 'cross-boundary imports go through packages/shared',
      severity: 'warn',
      from: { path: '^(web|server)/src' },
      to: { pathNot: '^(packages/shared|web/src|server/src)' }
    }
  ],
  options: {
    doNotFollow: { path: 'node_modules' },
    tsConfig: { fileName: 'tsconfig.json' },
    skipKnownFalsePositives: true
  }
};


