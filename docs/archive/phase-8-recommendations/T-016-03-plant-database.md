---
id: T-016-03
title: Create plant database
story: S-016
status: pending
priority: 1
complexity: M
depends_on:
  - T-016-02
output: src/lib/plants/database.ts
---

# T-016-03: Create Plant Database

Build a curated list of common garden plants with their requirements.

## Task

Create `src/lib/plants/database.ts` containing a hardcoded array of 20-30 common vegetables, herbs, and flowers with their light requirements, days to maturity, and temperature tolerance.

## Plant Categories

The database should include common vegetables like tomatoes, peppers, lettuce, beans, squash, and cucumbers. Also include popular herbs like basil, parsley, cilantro, and mint. Add a few common flowers for variety.

Each plant entry needs light category requirements, days to maturity range, and optionally cool-season vs warm-season classification.

## Acceptance Criteria

Database exports a `PLANTS` array with at least 20 entries. Each plant has complete requirement data. Plants span full-sun through part-shade categories. Database includes both warm-season and cool-season options.
