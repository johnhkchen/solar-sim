# Ralph Loop Research

> **Task**: S-001-R - Research Ralph Loop integration
> **Status**: Complete
> **Date**: 2026-01-27

This document captures research findings for integrating Ralph with our `just prompt` system, answering the questions posed in the S-001 story.

---

## How Ralph Works

Ralph is an autonomous loop runner that repeatedly invokes AI coding tools until all tasks are complete. The system was designed with a key architectural insight: each iteration spawns a completely fresh AI instance with no memory of previous runs, so continuity must come from persistent external state. This state lives in three places: git history preserves completed code changes, a `progress.txt` file accumulates learnings across iterations, and a `prd.json` file tracks which tasks have passed.

The core execution loop is straightforward. Ralph reads a prompt template, pipes it into Claude Code with the `--dangerously-skip-permissions` flag, waits for the execution to complete, then repeats. Between iterations it introduces a brief two-second delay to allow for asynchronous file system operations to settle. The loop continues either until a completion signal appears in the output or until a maximum iteration count is reached.

Completion detection works through a special marker. When the AI determines that all tasks are finished, it outputs `<promise>COMPLETE</promise>` to signal termination. Ralph watches for this string in the output and exits successfully when it appears. If the maximum iteration count is reached without seeing this signal, Ralph exits with status code 1 to indicate incomplete work.

The prompt source is a static file: either `prompt.md` for Amp or `CLAUDE.md` for Claude Code. Ralph reads this file and pipes its contents directly into the AI tool via stdin. The tool selection happens through a `--tool amp` or `--tool claude` command-line flag, with Amp being the default for historical reasons.

---

## Integration with just prompt

Our integration design faces a fundamental architectural mismatch. Ralph expects to read prompts from a static file, but we want to generate prompts dynamically based on the current DAG state. This means we cannot use Ralph out of the box; we need to either modify Ralph or build our own loop runner that calls `just prompt`.

The simplest approach is to build our own loop rather than modifying Ralph. Our `just ralph` command would implement a loop that calls `just prompt` to get the next task, pipes the output to Claude Code, waits for completion, and repeats. This gives us full control over the integration without depending on an upstream project.

If we wanted to use Ralph directly, we would need to add a pre-execution hook that regenerates the prompt file from `just prompt` before each iteration. Ralph doesn't currently support this, so we would need to either fork and modify it or wrap it in another script. Neither option is simpler than building our own loop.

The prompt format itself is not constrained by Ralph. Since Claude Code reads the prompt from stdin and interprets it as natural language instructions, our prompt template can use whatever structure works best. The key requirement is that the prompt must tell Claude everything it needs to know to complete one task and update the task graph, because each iteration starts fresh with no context from previous runs.

---

## Handling the No Work Available Case

When `just prompt` returns exit code 1, it means no tasks are ready. This can happen for two reasons: all tasks are complete, or all remaining tasks are blocked or already in progress. Our loop runner needs to distinguish between these cases.

The cleanest approach is to make `just prompt` communicate the reason alongside the exit code. If the exit code is 1 and stderr says "all tasks complete," the loop should exit successfully because work is done. If the exit code is 1 and stderr says "all tasks blocked or in progress," the loop should either wait and retry or exit with an advisory message.

For the initial implementation, I recommend exiting the loop when no tasks are available regardless of the reason. The operator can check `just dag-status` to understand why. Adding retry logic for the "waiting on blocked tasks" case adds complexity that may not be needed until we have multiple parallel agents where one agent might be waiting for another to finish a dependency.

If we do add retry logic later, the loop should implement exponential backoff to avoid spinning. Start with a 30-second wait, double it on each retry up to a maximum of 5 minutes, and reset the backoff after successfully processing a task. This prevents the loop from hammering the file system while still being reasonably responsive when work becomes available.

---

## Error Handling and Recovery

Ralph handles errors in the simplest way possible: it suppresses them. Each Claude invocation is wrapped in `|| true`, so a non-zero exit code from Claude does not crash the loop. The loop simply moves on to the next iteration, where the fresh AI instance will re-read the state and potentially retry the failed work.

This approach works because state is external. If Claude fails mid-task before committing any changes, the next iteration sees the same starting state and can try again. If Claude partially completes work but crashes before marking the task done, the next iteration picks up where things left off because the git history preserves completed changes.

Our integration should follow the same pattern but with better visibility. When Claude exits non-zero, we should log the failure and the exit code, leave the task in "in-progress" status so a human can investigate, and continue to the next task rather than crashing the loop. The task will appear as stale in `just dag-status` after a configurable timeout, prompting human intervention.

For partial completions, we should trust that the next iteration can handle recovery. If a task is left in-progress and a human runs `just task-reset` on it, the next agent will see the partial work that was committed and can either continue from there or start fresh as appropriate. The key is that our task-graph.yaml and git history together provide enough state for recovery.

We should surface failures prominently in our logging. Each iteration should produce a clear log entry showing the task ID, start time, end time, exit code, and a summary of what happened. This log should be easily viewable with `tail -f` so developers can monitor progress.

---

## Monitoring and Observability

Ralph's monitoring story is minimal. Developers observe progress by watching the terminal where Ralph is running, checking `prd.json` to see which stories have passed, reading `progress.txt` for accumulated learnings, and reviewing git log for committed changes. There is no dashboard, no structured logging, and no alerting.

For our integration, we should provide better observability without over-engineering. The primary interface should be `just dag-status`, which already shows task states and can warn about stale in-progress tasks. Running `just dag-status` in one terminal while `just ralph` runs in another gives a live view of progress.

We should also write a structured log file. Each loop iteration should append a JSON line to `logs/ralph.jsonl` with fields for timestamp, task ID, action, duration, exit code, and outcome. This enables both human review via `cat logs/ralph.jsonl | jq` and future tooling like dashboards or alerts.

For detecting stuck loops, we can add a heartbeat mechanism. The loop writes a timestamp to `logs/ralph.heartbeat` at the start of each iteration. A simple cron job or monitoring script can alert if this file hasn't been updated in an hour, indicating the loop has hung or crashed.

The `progress.txt` pattern from Ralph is worth adopting. Having each task append its learnings to a shared file creates institutional knowledge that accumulates over time. When one agent discovers a gotcha, future agents benefit immediately. We should have our prompt template instruct Claude to append findings to a `docs/knowledge/learnings.md` file.

---

## Implementation Recommendations

Based on this research, here are the key decisions for our implementation.

We should build our own loop runner rather than integrating with Ralph directly. The value Ralph provides is the idea of a persistent loop with external state, not the implementation itself. Our requirements around dynamic prompt generation and DAG-based task selection are different enough that wrapping Ralph would be more complex than building a simple loop.

The `just ralph` command should be a shell script that loops until `just prompt` returns exit code 1 with an "all complete" message. Each iteration runs `just prompt > /tmp/task.md`, invokes `claude --dangerously-skip-permissions < /tmp/task.md`, logs the outcome, and introduces a brief delay before the next iteration.

Error handling should be permissive. A failed Claude invocation should log the failure and continue rather than crashing the loop. Tasks that fail are left in-progress for manual review and recovery.

Monitoring should use `just dag-status` as the primary interface, supplemented by a JSON log file for detailed history and a heartbeat file for stuck-loop detection.

The prompt template should instruct Claude to update task-graph.yaml upon completion, commit its changes, and append learnings to the shared knowledge file. This ensures state persists correctly between iterations.

---

## Open Questions for Planning

Several questions remain for the planning phase to address.

Should `just ralph` run in a git worktree or the main working directory? Running in a worktree provides isolation but adds complexity around merging completed work back to main. Running in main is simpler but means human developers cannot work there while Ralph is running.

How long should a task be in-progress before `just dag-status` warns about staleness? A one-hour threshold seems reasonable for research tasks but too short for complex implementation tasks. We might need per-task timeouts or a simple global default that errs on the side of patience.

Should we implement automatic retries for failed tasks, or always require human intervention? Starting with manual recovery is safer and simpler. We can add automatic retry logic later if we find that most failures are transient.

How should the loop handle rate limiting from the Claude API? We need to detect rate-limit errors specifically and implement appropriate backoff. This might require parsing Claude's stderr output to identify the specific error condition.

---

## References

The Ralph project lives at https://github.com/snarktank/ralph. The key files to review are `ralph.sh` for the core loop implementation, `CLAUDE.md` for the prompt template format, and `README.md` for the overall architecture.

Our related documents include S-001 for the story context, MILESTONES.md for the M6 milestone definition, and the dag-parsing research for details on how `just prompt` will work.
