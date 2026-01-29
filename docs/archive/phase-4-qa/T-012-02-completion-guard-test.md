---
id: T-012-02
title: Test completion guards
story: S-012
status: complete
priority: 1
complexity: S
depends_on:
  - T-012-01
output: src/lib/qa/guard-test.ts
---

# T-012-02: Test Completion Guards

This ticket tests that completion guards correctly require output files to exist.

## Task

Create the file `src/lib/qa/guard-test.ts` with a simple exported constant. The completion guard should block if this file is missing and allow completion once it exists.

## Research

The completion guards in dag.ts check that the `output` path exists before allowing `just task-complete` to succeed.

## Plan

Create src/lib/qa directory if needed, then create guard-test.ts with minimal content.

## Implementation

Create the output file with:

```typescript
export const GUARD_TEST_PASSED = true;
```
