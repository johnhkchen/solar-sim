---
id: T-007-01
title: Diagnose phantom task claiming
story: S-007
status: ready
priority: 0
complexity: M
depends_on: []
output: docs/knowledge/research/phantom-claiming.md
---

# T-007-01: Diagnose Phantom Task Claiming

## Objective

Identify what is triggering automatic `just prompt` calls that claim tasks without any agent working on them.

## Background

During S-005 and S-006 development, tasks repeatedly transitioned to in-progress status without corresponding work being done. The task-graph.yaml showed `claimed_at` timestamps just seconds apart, suggesting something was invoking `just prompt` rapidly.

## Investigation Steps

1. Check for Claude Code hooks or integrations that might run commands on file changes
2. Examine `.claude/` directory for any configuration that triggers commands
3. Look for shell aliases or functions that might intercept or auto-run commands
4. Check editor configurations for command hooks on save
5. Review the ralph.sh script for any unintended recursive behavior
6. Examine terminal multiplexer configs if using tmux/screen

## Expected Deliverable

A research document at `docs/knowledge/research/phantom-claiming.md` that:
- Identifies the specific trigger mechanism
- Explains how and why it invokes `just prompt`
- Proposes prevention strategies
- Recommends changes to make `just prompt` resilient to accidental invocation

## Acceptance Criteria

- Root cause is identified with evidence
- Prevention strategy is documented
- Research document exists at the output path
