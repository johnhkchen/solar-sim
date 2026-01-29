# Running the Ralph Loop

This playbook describes how to run the automated ralph loop for processing batches of tickets sequentially.

## Overview

The ralph loop automates the claim-execute-complete cycle. It claims the next available task, pipes the prompt to Claude Code, waits for completion, then repeats until no tasks remain. This enables batch processing of tickets without manual intervention.

## Prerequisites

Before running the loop, verify the system is ready. Run `just dag-status` to confirm tasks exist and at least one is ready. Check that no stale `.ralph/current-task` file exists from a previous interrupted run by running `ls .ralph/` and removing current-task if present.

## Running from Main (Single Agent)

For single-agent serial execution from the main repo, use:

```bash
RALPH_ALLOW_MAIN=1 WORKTREE_STORY=S-XXX just ralph
```

The RALPH_ALLOW_MAIN flag overrides the default worktree requirement. The WORKTREE_STORY filter scopes execution to a single story's tickets, preventing cross-story pollution.

## What the Loop Does

Each iteration follows this sequence. First, the loop runs `just prompt --accept` to claim the highest-priority ready task for the specified story. If a task is available, the loop pipes the generated prompt to Claude Code via stdin. Claude executes the work, which typically involves reading the ticket, implementing the required changes, and updating task-graph.yaml to mark the task complete.

After Claude exits successfully, the loop clears the `.ralph/current-task` tracking file so the next iteration can claim a new task. The loop then sleeps briefly and continues to the next iteration.

When no tasks remain for the story, the loop prints a summary and exits cleanly.

## Monitoring

The loop writes a heartbeat timestamp to `logs/ralph.heartbeat` at the start of each iteration. Check this file to verify the loop is still running. Detailed logs go to `logs/ralph.jsonl` in newline-delimited JSON format, recording each task's start time, duration, exit code, and outcome.

To watch the loop in real-time, run `tail -f logs/ralph.jsonl | jq` in a separate terminal.

## Handling Failures

If Claude exits with a non-zero code, the loop logs the failure and continues to the next iteration. The failed task remains in-progress in task-graph.yaml for manual review. Check the logs to understand what went wrong, fix the issue manually, then either complete the task with `just task-complete` or reset it with `just task-reset`.

Rate limiting is handled automatically with exponential backoff. If Claude returns a 429 error, the loop waits and retries.

## Interrupting the Loop

Press Ctrl-C to stop the loop gracefully. It will print a summary showing how many tasks were completed, failed, and the total runtime. The current task (if any) will be left in-progress for manual completion or reset.

## Troubleshooting

If the loop exits immediately claiming "all tasks complete" but tasks remain, check for a stale `.ralph/current-task` file. The prompt command blocks when this file exists, and the error message triggers the completion detection. Remove the file and retry.

If the loop can't claim tasks, verify the story filter matches actual tickets. Run `just dag-status` to see which stories have ready tasks.

If Claude repeatedly fails on the same task, the task may have unclear requirements or depend on missing context. Review the ticket and update it with clearer instructions before retrying.

## Example Session

A typical session looks like this:

```
$ just dag-status
Tasks: 3 total
  - ready: 1
  - pending: 2
Ready for work:
  [P1] T-012-01  Test manual claim-complete cycle

$ RALPH_ALLOW_MAIN=1 WORKTREE_STORY=S-012 just ralph
🔄 Starting Ralph Loop...
   Story filter: S-012

[1] 📋 Task: T-012-01
    → Executing via Claude...
    ✓ Claude finished (56s)

[2] 📋 Task: T-012-02
    → Executing via Claude...
    ✓ Claude finished (42s)

[3] 📋 Task: T-012-03
    → Executing via Claude...
    ✓ Claude finished (38s)

✓ All tasks complete for story S-012!

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📊 Ralph Loop Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
   Story:      S-012
   Iterations: 3
   Completed:  3
   Failed:     0
   Runtime:    2m 16s
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

## Creating Work for the Loop

Tickets must exist in `docs/active/tickets/` with proper frontmatter before the loop can process them. Run `just dag-refresh` after creating tickets to update task-graph.yaml. Each ticket needs an id, title, story, status, priority, complexity, depends_on list, and output path.

The output path is important because completion guards verify it exists before allowing task completion. If a task's output is missing, the agent should create it as part of the work.
