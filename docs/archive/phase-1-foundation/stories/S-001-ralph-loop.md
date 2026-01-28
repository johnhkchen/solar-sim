---
id: S-001
title: Ralph Loop Integration
status: planned
priority: 1
complexity: M
depends_on: []
blocks: [S-002]
milestone: M6
assignee: null
created: 2026-01-27
updated: 2026-01-27
---

# S-001: Ralph Loop Integration

## Overview

Implement integration with [Ralph](https://github.com/snarktank/ralph), an autonomous loop runner that enables continuous, unattended execution of Claude Code tasks. This is the core worker unit for our multi-agent workflow.

## Background

### What is Ralph?

Ralph is a tool that creates an autonomous execution loop:

1. Pulls a prompt from a configured source
2. Pipes the prompt into `claude --dangerously-skip-permissions`
3. Waits for completion
4. Repeats

This enables "set it and forget it" coding agents that work through a task queue without human intervention.

### Why We Need This

- **Autonomous operation**: Developers can spin up agents and let them work
- **Parallel execution**: Multiple Ralph loops in separate worktrees = concurrent development
- **Task-driven**: Combined with `just prompt`, agents pull work from the DAG automatically

## Research Questions

Before implementation, we need to answer:

### R1: Ralph Architecture

- [ ] How does Ralph determine when a Claude execution is "complete"?
- [ ] What exit codes/signals does it handle?
- [ ] How does it handle Claude errors or failures?
- [ ] Is there built-in retry logic?

### R2: Prompt Source Integration

- [ ] How does Ralph expect to receive prompts?
- [ ] Can it call a shell command (`just prompt`) as its prompt source?
- [ ] What format should prompts be in?
- [ ] How does it handle empty prompts (no work available)?

### R3: State Management

- [ ] How do we prevent two Ralph loops from picking up the same task?
- [ ] Should `just prompt` implement locking/claiming?
- [ ] How do we track which agent is working on what?

### R4: Failure Modes

- [ ] What happens if Claude makes an error mid-task?
- [ ] How do we handle partial completions?
- [ ] Should we implement checkpointing?

### R5: Monitoring

- [ ] How do developers observe Ralph's progress?
- [ ] Should we log to a file? Stream somewhere?
- [ ] How do we detect a "stuck" loop?

## Acceptance Criteria

- [ ] `just ralph` starts a Ralph loop that pulls from `just prompt`
- [ ] Loop continues until no tasks remain (or explicitly stopped)
- [ ] Task claiming prevents duplicate work across agents
- [ ] Failures are logged and don't crash the loop
- [ ] Documentation explains how to run and monitor Ralph loops

## Implementation Plan

Based on the research findings in `docs/knowledge/research/ralph-loop.md`, we will build our own loop runner rather than integrating with Ralph directly. The fundamental architectural mismatch is that Ralph expects static prompt files while we need dynamic prompt generation from the DAG, so wrapping Ralph would be more complex than building a simple loop ourselves.

### The just ralph Command

The `just ralph` command runs a shell script that loops until all work is complete. Each iteration follows a straightforward sequence: first write a heartbeat timestamp to `logs/ralph.heartbeat`, then call `just prompt` to get the next task. If `just prompt` succeeds with exit code 0, pipe the generated prompt to `claude --dangerously-skip-permissions` and log the outcome regardless of whether Claude succeeds or fails. If `just prompt` returns exit code 1, check the reason and either exit successfully when all tasks are complete or exit with an advisory message when tasks are blocked.

The loop introduces a two-second delay between iterations to allow filesystem operations to settle, following Ralph's pattern. This prevents race conditions when the DAG file is being written and also provides a natural throttle on API calls.

### Exit Conditions

The loop terminates cleanly in three scenarios. When `just prompt` returns exit code 1 with an "all complete" message, the loop exits with code 0 after printing a success summary. When `just prompt` returns exit code 1 with an "all blocked" message, the loop exits with code 0 but prints an advisory that remaining tasks are waiting on dependencies or manual intervention. When the user sends SIGINT or SIGTERM, the loop catches the signal, logs the interruption, and exits cleanly.

The loop never terminates on Claude failures. Instead it logs the failure, leaves the task in-progress for manual review, and continues to the next available task. This permissive approach follows Ralph's pattern where the external state in git history and task-graph.yaml provides enough information for recovery.

### Error Handling

When Claude exits with a non-zero code, the loop logs a structured entry showing the task ID, exit code, duration, and a failure indicator. The task remains in "in-progress" status because we cannot know whether Claude made partial progress that was committed. Human operators or recovery agents can then inspect the state using `just dag-status`, review any partial work in the codebase, and either reset the task with `just task-reset` or mark it complete if the work was actually finished.

The loop itself should be resilient to transient errors. If `just prompt` fails unexpectedly, such as when the DAG file is temporarily malformed during an edit, the loop logs the error and continues to the next iteration rather than crashing. This gives self-healing behavior since the DAG is likely to be valid on the next attempt.

Rate limiting from the Claude API requires special handling. When Claude's stderr contains rate limit indicators, the loop should log a warning and wait for an extended period before the next iteration. Starting with a 60-second wait and doubling on consecutive rate limits up to 10 minutes provides reasonable backoff without abandoning work entirely.

### Logging

All logs go to `logs/ralph.jsonl` in newline-delimited JSON format. Each entry contains a timestamp, the iteration number, the task ID if one was selected, the action taken like "started", "completed", or "failed", the duration in seconds, the exit code from Claude, and an outcome field with a human-readable summary. This format supports both human review via `cat logs/ralph.jsonl | jq` and programmatic analysis.

The heartbeat mechanism writes an ISO 8601 timestamp to `logs/ralph.heartbeat` at the start of each iteration. External monitoring can alert if this file hasn't been updated within a configurable threshold, indicating the loop has hung or crashed. A one-hour threshold is reasonable for most tasks.

Console output provides real-time feedback for developers watching the terminal. Each iteration prints a status line showing the iteration number, task ID, and outcome. Errors print in a distinct format so they stand out visually. The loop prints a summary on exit showing total iterations, tasks completed, tasks failed, and total runtime.

### Integration with Existing Tools

The loop depends on `just prompt` which is already implemented as part of M3. It calls `just prompt` with no arguments and captures both stdout containing the prompt text and stderr containing status messages. The exit code and stderr content together determine the loop's behavior for that iteration.

The loop does not call `just task-complete` directly because that responsibility belongs to Claude. The prompt template instructs Claude to run `just task-complete <task-id>` upon successful completion, and since Claude operates in `--dangerously-skip-permissions` mode it can execute this command. This keeps the completion logic in one place and avoids the loop needing to parse Claude's output to determine success.

For the same reason, the loop does not call `just task-reset` on failures. Failed tasks remain in-progress until a human or recovery agent explicitly resets them. This conservative approach prevents the loop from masking persistent failures by endlessly retrying.

### Implementation Tickets

The implementation breaks down into three tickets. The first ticket T-001-01 implements the core loop script in `tools/ralph.sh` with the main iteration logic, signal handling, and console output. The second ticket T-001-02 implements the logging infrastructure including the JSON log writer and heartbeat mechanism. The third ticket T-001-03 adds the justfile command and documentation. These tickets can be worked sequentially since each builds on the previous.

## Dependencies

- **Depends on**: Nothing (can research independently)
- **Blocks**: S-002 (DAG parsing needs to understand Ralph's prompt requirements)

## Research Output

Findings should be documented in:
`docs/knowledge/research/ralph-loop.md`

## Milestone

This story contributes to **M6: Ralph Loop** (stretch goal).

See `docs/active/MILESTONES.md` for details.

Note: M6 is a stretch goal. The core workflow (`just prompt`) can function without Ralph by having humans or scripts invoke Claude directly.

## Related

- [Ralph GitHub](https://github.com/snarktank/ralph)
- S-002: DAG Parsing (provides prompts to Ralph)
- S-003: Git Worktrees (enables parallel Ralph loops)
- `docs/active/MILESTONES.md` - Milestone definitions

## Changelog

| Date | Change |
|------|--------|
| 2026-01-27 | Story created |
