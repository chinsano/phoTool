# phoTool Web Workspace

This is the web application workspace for phoTool. Currently in scaffolding phase.

## Status

**Phase 6A (Current)**: Workspace scaffolding - dependencies and Vite setup will be added in Phase 6B.

## Planned Features

- React + Vite + TypeScript setup
- TanStack Router configuration  
- Zustand store wired to shared state schemas
- Tailwind CSS configuration
- API client implementation using shared types
- Component library integration

## Development

Dependencies and build tools will be configured in Phase 6B. For now, this workspace serves as a placeholder for the web application structure.

## Workspace Configuration

- **TypeScript**: Extends `tsconfig.base.json` with path aliases for `@shared/*`
- **Package Manager**: Uses pnpm workspaces
- **Path Aliases**: 
  - `@shared/*` → `../packages/shared/src/*`
  - `@shared` → `../packages/shared/src/index.ts`
