---
id: S-004
title: SvelteKit Project Scaffolding
status: pending
priority: 2
complexity: S
depends_on: [S-001, S-002, S-003]
blocks: []
milestone: null
assignee: null
created: 2026-01-27
updated: 2026-01-27
---

# S-004: SvelteKit Project Scaffolding

## Overview

Initialize the SvelteKit project with Cloudflare Workers adapter, TypeScript, and project structure matching the specification. This is the foundation for the actual application.

## Background

### Why Wait?

This story depends on S-001, S-002, and S-003 because:
- We want the multi-agent tooling in place first
- SvelteKit scaffolding will be one of the first tasks executed by Ralph
- It's a clean, well-defined task—ideal for testing the workflow

### Technology Choices

Per specification:
- **SvelteKit**: Modern, fast, good DX
- **Cloudflare Workers**: Edge deployment, global low latency
- **TypeScript**: Type safety, better tooling
- **Adapter**: `@sveltejs/adapter-cloudflare-workers`

## Requirements

### Project Structure

After scaffolding, `src/` should contain:

```
src/
├── routes/
│   ├── +page.svelte           # Home page (location input)
│   ├── +layout.svelte         # Root layout
│   └── calculate/
│       └── +page.svelte       # Results page
├── lib/
│   ├── solar/                 # Sun calculation modules
│   ├── geo/                   # Coordinate/timezone handling
│   ├── categories/            # Light category classification
│   └── components/            # Reusable UI components
├── app.html                   # HTML template
└── app.d.ts                   # TypeScript declarations
```

### Configuration Files

- `svelte.config.js` - SvelteKit config with Workers adapter
- `tsconfig.json` - TypeScript strict mode
- `vite.config.ts` - Vite configuration
- `wrangler.toml` - Cloudflare Workers configuration (if needed)

### Package Dependencies

Core:
- `svelte`
- `@sveltejs/kit`
- `@sveltejs/adapter-cloudflare-workers`

Dev:
- `typescript`
- `vite`
- `@sveltejs/vite-plugin-svelte`

Testing (optional in scaffold):
- `vitest`
- `@testing-library/svelte`

## Acceptance Criteria

- [ ] `npm install` succeeds
- [ ] `npm run dev` starts development server
- [ ] `npm run build` produces Cloudflare Workers-compatible output
- [ ] TypeScript strict mode enabled
- [ ] Directory structure matches specification
- [ ] Basic smoke test passes (page loads)

## Implementation Steps

### 1. Initialize SvelteKit

```bash
npm create svelte@latest .
# Select: Skeleton project
# Select: TypeScript
# Select: ESLint, Prettier
```

### 2. Install Cloudflare Adapter

```bash
npm install -D @sveltejs/adapter-cloudflare-workers
```

### 3. Configure Adapter

`svelte.config.js`:
```javascript
import adapter from '@sveltejs/adapter-cloudflare-workers';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

export default {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter()
  }
};
```

### 4. Create Directory Structure

```bash
mkdir -p src/lib/solar src/lib/geo src/lib/categories src/lib/components
mkdir -p src/routes/calculate
```

### 5. Add Placeholder Files

Create minimal placeholder files so the structure exists:
- `src/lib/solar/index.ts` - Export placeholder
- `src/lib/geo/index.ts` - Export placeholder
- etc.

### 6. Update Justfile

Ensure development commands work:
```bash
just install  # → npm install
just dev      # → npm run dev
just build    # → npm run build
just test     # → npm run test
```

### 7. Verify Build

```bash
npm run build
# Should produce .svelte-kit/cloudflare/ output
```

## Non-Goals (for this story)

- Actual solar calculation implementation
- UI design or styling
- API routes
- Testing framework setup (can be separate ticket)

This story is purely about getting the project structure in place so subsequent work has a foundation.

## Dependencies

- **Depends on**: S-001, S-002, S-003 (workflow tooling first)
- **Blocks**: All application feature stories

## Milestone

This story is **not part of the foundation milestones** (M1-M6). It's the bridge to application development.

It's blocked until workflow tooling is planned (S-001-P, S-002-P, S-003-P complete) so we know how to structure the project for multi-agent work.

Once M1-M4 are complete, this becomes a good test case for `just prompt` - it's a well-defined, self-contained task.

## Notes

This is intentionally simple. The goal is a working SvelteKit project that:
1. Builds successfully
2. Deploys to Cloudflare Workers
3. Has the directory structure ready for feature work

Complexity comes later. Keep this story minimal.

## Related

- `docs/active/MILESTONES.md` - Milestone definitions

## Changelog

| Date | Change |
|------|--------|
| 2026-01-27 | Story created |
