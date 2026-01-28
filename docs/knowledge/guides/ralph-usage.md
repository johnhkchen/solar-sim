# Running and Monitoring Ralph Loops

Ralph is the autonomous execution loop that processes tasks from the DAG without human intervention. It continuously pulls the next available task using `just prompt`, pipes that prompt to Claude Code for execution, and repeats until all work is complete or blocked. This guide explains how to start, monitor, and recover from issues with Ralph loops.

## Starting the Loop

Run `just ralph` from the project root to start the autonomous loop. The script prints a header showing where logs will be written, then begins processing tasks. Each iteration displays the task ID, execution status, and outcome so you can watch progress in real time. The loop runs until one of three conditions is met: all tasks complete successfully, all remaining tasks are blocked waiting on dependencies, or you interrupt it with Ctrl-C.

Before starting a Ralph loop, run `just dag-status` to see what work is available. If no tasks show as "ready" status, the loop will exit immediately with a message explaining why. You should also verify that Claude Code is properly authenticated since the loop runs Claude in non-interactive mode with `--dangerously-skip-permissions`.

## Monitoring Progress

While a Ralph loop runs, you have several options for monitoring its progress. The simplest approach is to watch the terminal output, which shows each task as it executes. For background or remote loops, the heartbeat and log files provide visibility into loop state.

Run `just ralph-status` to see a quick summary including the last heartbeat timestamp, how recently the heartbeat was updated, and the most recent log entries. The heartbeat file at `logs/ralph.heartbeat` is updated at the start of each iteration, so a stale heartbeat indicates the loop has stopped or is stuck on a long-running task. A heartbeat more than an hour old typically warrants investigation.

For real-time log monitoring, run `just ralph-logs` which tails the JSON log with formatted output showing timestamps, iteration numbers, actions, and outcomes. This is useful when watching a loop run in the background or troubleshooting issues as they happen.

The structured logs at `logs/ralph.jsonl` contain complete records of every loop action in newline-delimited JSON format. Each entry includes a timestamp, the iteration number, the task ID when applicable, the action taken such as "started" or "completed" or "failed", the duration in seconds, the exit code from Claude, and a human-readable outcome message. You can analyze these logs programmatically or review them manually with `cat logs/ralph.jsonl | jq .` for formatted output.

## Handling Failures

When Claude exits with a non-zero code during task execution, the loop logs the failure but continues to the next available task rather than crashing. The failed task remains in "in-progress" status because the loop cannot determine whether Claude made partial progress that was committed. This conservative approach preserves any work that might have been done.

After a task failure, check the task graph with `just dag-status` to see which tasks are stuck in progress. Review the codebase to see if Claude made partial changes that might be valuable. If the work is incomplete and you want to retry, run `just task-reset <task-id>` to return the task to "ready" status so it becomes available for the next prompt. If the work is actually complete despite the error code, run `just task-complete <task-id>` to mark it done.

Rate limiting from the Claude API receives special handling. When the loop detects rate limit indicators in Claude's error output, it waits before retrying rather than counting the attempt as a failure. The wait time starts at 60 seconds and doubles with each consecutive rate limit, up to a maximum of 10 minutes. This backoff continues automatically until the rate limit clears.

## Recovering from Stuck Tasks

A task can become stuck if Claude crashes mid-execution, if the loop process is killed, or if network issues interrupt communication. Stuck tasks remain in "in-progress" status indefinitely because no one marked them complete or reset them.

To identify stuck tasks, run `just dag-status` and look for tasks that have been in progress for an unusually long time. The status output includes timestamps showing when tasks were claimed. Cross-reference with `just ralph-status` to see if the loop is still running. If the loop stopped but tasks remain in progress, those tasks need manual attention.

For each stuck task, examine any partial output in the codebase and decide whether to complete or reset the task. Use `just task-reset <task-id>` to make a task available for retry, or `just task-complete <task-id>` if the work was actually finished. After resetting stuck tasks, you can start a new Ralph loop to continue processing.

## Running Parallel Loops

Multiple Ralph loops can run simultaneously in separate Git worktrees, enabling parallel development. Create a new worktree with `just worktree-new <name>` which sets up an independent working directory on its own feature branch. Each worktree has its own copy of the codebase but shares Git history with the main repository.

The task claiming mechanism in `just prompt` prevents multiple loops from picking up the same task. When a loop claims a task, it marks the task as in-progress in task-graph.yaml before outputting the prompt. Since each worktree has its own copy of the file, worktrees must coordinate through regular pulls and pushes to see each other's claimed tasks.

For effective parallel operation, run `git pull` in each worktree before starting a loop to ensure it sees the latest task graph state. Each loop will then claim different available tasks. As loops complete work and push changes, other worktrees will see those completions after their next pull.

## Exit Conditions

The Ralph loop terminates cleanly in three scenarios. When `just prompt` returns exit code 1 with a message indicating all tasks are complete, the loop prints a success summary showing total iterations, completed tasks, failed tasks, and runtime, then exits with code 0. When all remaining tasks are blocked waiting on dependencies or stuck in progress, the loop prints an advisory message and exits with code 0. When you interrupt with Ctrl-C (SIGINT) or send SIGTERM, the loop catches the signal, logs the interruption, prints the summary, and exits with the appropriate signal code (130 for SIGINT, 143 for SIGTERM).

The loop never exits on individual task failures. Failed tasks are logged and left for manual review, but processing continues with the next available task. This permissive approach maximizes throughput while preserving failure information for later analysis.
