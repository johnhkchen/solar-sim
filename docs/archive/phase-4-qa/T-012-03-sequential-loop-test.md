---
id: T-012-03
title: Test sequential ralph loop
story: S-012
status: complete
priority: 1
complexity: S
depends_on:
  - T-012-02
output: src/lib/qa/loop-test.ts
---

# T-012-03: Test Sequential Ralph Loop

This ticket is the final task in the S-012 sequence. When this completes, the ralph loop should detect no remaining tasks and exit cleanly.

## Task

Create the file `src/lib/qa/loop-test.ts` that imports from guard-test.ts and re-exports with an additional constant.

## Research

The ralph loop should process T-012-01, then T-012-02, then this ticket in sequence based on the depends_on chain.

## Plan

Create loop-test.ts that imports GUARD_TEST_PASSED and adds LOOP_TEST_PASSED.

## Implementation

Create the output file with:

```typescript
export { GUARD_TEST_PASSED } from './guard-test.js';
export const LOOP_TEST_PASSED = true;
```
