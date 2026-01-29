---
id: S-012
title: Ralph Loop QA
status: pending
priority: 1
---

# S-012: Ralph Loop QA

This story verifies that the single-agent serial execution model works correctly. Before building new features, we need confidence that the claim-execute-complete cycle functions as designed.

## Context

The workflow tooling was built in phases 1-3 but never tested end-to-end. We have guards, logging, and DAG management, but we haven't verified the full loop works. This story creates minimal test tickets to exercise the system.

## Acceptance Criteria

The `just prompt` command correctly shows available tasks. The `just prompt --accept` command claims a task and generates a prompt. The `just task-complete` command marks tasks done and updates the DAG. The `just ralph` command can process multiple tickets sequentially until none remain.

## Tickets

T-012-01 tests the manual claim-complete cycle with a trivial task.
T-012-02 tests completion guards by requiring specific output.
T-012-03 tests the automated ralph loop with a simple implementation task.
