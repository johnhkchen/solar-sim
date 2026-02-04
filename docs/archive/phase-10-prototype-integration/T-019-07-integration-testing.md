---
id: T-019-07
title: Add integration tests for full flow
story: S-019
status: pending
priority: 1
complexity: M
depends_on:
  - T-019-03
  - T-019-04
  - T-019-05
output: src/lib/integration/results-integration.test.ts
---

# T-019-07: Add Integration Tests for Full Flow

Add tests verifying the complete flow from obstacle placement through shade calculation to recommendation updates.

## Context

Research at `docs/knowledge/research/app-integration.md` section R6 identified gaps in test coverage. Existing tests cover shade calculations and recommendations separately but not the integrated flow.

## Task

Create integration tests that verify the reactive chain works correctly.

## Test Cases

### Data Flow Tests

```typescript
describe('Results page integration', () => {
  it('updates effective hours when obstacles are added', () => {
    // Given a location with theoretical 10 sun hours
    // When an obstacle is added that blocks 30%
    // Then effective hours should be ~7
  });

  it('updates recommendations when effective hours change', () => {
    // Given full-sun recommendations with no obstacles
    // When obstacles reduce light to part-sun levels
    // Then recommendations should change to part-sun plants
  });

  it('shows both theoretical and effective in seasonal chart', () => {
    // Given obstacles exist
    // Then monthly data should have different theoretical vs effective values
  });
});
```

### Persistence Tests

```typescript
describe('Plot data persistence', () => {
  it('saves obstacles to localStorage on change', () => {
    // Given an obstacle is added
    // Then localStorage should contain the obstacle data
  });

  it('loads obstacles from localStorage on page load', () => {
    // Given localStorage contains saved obstacles
    // When results page loads
    // Then obstacles should appear in PlotViewer
  });

  it('uses separate storage for different locations', () => {
    // Given obstacles saved for location A
    // When user views location B
    // Then obstacles should not appear
  });
});
```

### Edge Cases

```typescript
describe('Edge cases', () => {
  it('handles empty obstacles array correctly', () => {
    // Effective hours should equal theoretical
  });

  it('handles invalid localStorage data gracefully', () => {
    // Should not crash, should use empty defaults
  });

  it('debounces rapid obstacle changes', () => {
    // Multiple rapid changes should not cause multiple calculations
  });
});
```

## Test Infrastructure

Use Vitest for unit/integration tests. Mock localStorage for persistence tests. May need component testing setup for PlotViewer interaction tests.

## Greppable References

- `happy-path.test.ts` - Existing integration test pattern at `src/lib/integration/`
- `sun-hours-shade.test.ts` - Shade calculation tests
- `recommendations.test.ts` - Recommendation tests

## Acceptance Criteria

All test cases pass. Tests cover the reactive data flow. Tests verify persistence behavior. Tests don't break existing test suite. Test coverage for new integration code is adequate.
