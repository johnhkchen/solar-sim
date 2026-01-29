# Agent Workflows

This document describes common workflows for agents working on Solar-Sim.

## Starting a Work Session

Every session begins the same way. First read CLAUDE.md to understand project conventions, paying special attention to the writing style requirements since all documentation must follow the speed-reading format. Then run `just dag-status` to see the current state of work, which shows completed tasks, ready tasks, and blocked tasks along with their priorities.

When you're ready to take on work, run `just prompt` to get your assignment. This command does three things: it selects the highest-priority ready task, marks that task as in-progress in task-graph.yaml to prevent other agents from claiming it, and outputs a detailed prompt describing what you need to do. The prompt includes file references for context and clear acceptance criteria.

## Completing a Task

After finishing your work, follow the completion instructions in the prompt you received. Typically this means running `just task-complete <task-id>` which updates the task status to complete, records a completion timestamp, and checks whether any dependent tasks are now unblocked. The command also updates the metadata counts in task-graph.yaml.

Verify your changes by running `just dag-status` again. You should see your task listed as complete and any tasks that depended on it should now appear as ready.

Commit your work using conventional commit format. The type indicates what kind of change you made, the scope indicates which part of the project is affected, and the description summarizes what you did. For example, `feat(tools): implement ralph loop script` or `docs(research): document git worktree findings`.

## Recovering from Problems

If you encounter an error that prevents you from completing a task, or if you need to stop working mid-task for any reason, run `just task-reset <task-id>` to return the task to ready status. This clears the in-progress marker and allows another agent to pick up the work.

When you reset a task, any partial work you created remains in the repository. The next agent to claim the task will see your commits and can decide whether to continue from where you left off or start fresh. Document what you accomplished and what blocked you in a commit message so the next agent has context.

If you notice a task has been in-progress for a long time without completion, `just dag-status` will warn about potentially stale tasks. This usually means a previous agent crashed or abandoned the work without resetting. You can reset such tasks to make them available again.

## Understanding the Task Graph

The task graph in task-graph.yaml defines what work exists and how it relates. Stories are high-level features that get broken into tickets which are atomic implementable units. Each task has a status, priority, and list of dependencies.

A task becomes ready when all its dependencies are complete. The `just prompt` command only considers ready tasks when selecting work. Priority determines which ready task gets selected first, with P1 being highest priority.

The edges section defines dependency relationships. An edge from A to B means A must complete before B becomes ready. The tools compute readiness automatically by traversing these edges.

When you complete a task that other tasks depend on, those dependent tasks may transition from pending to ready. The `just task-complete` command handles this automatically.

## Working with Research and Planning

The project follows a research-plan-implement pattern for non-trivial work. Research tasks produce documents in `docs/knowledge/research/` that capture findings and recommendations. Planning tasks update story documents with implementation plans and create tickets for the actual work. Implementation tasks then follow the plan to produce code or documentation.

When working on a research task, your job is to investigate options, evaluate tradeoffs, and document recommendations. Write in flowing prose explaining your reasoning as if talking a colleague through what you learned. Answer the specific research questions posed in the task description.

When working on a planning task, your job is to translate research findings into a concrete implementation plan. Verify your understanding by citing specific findings from the research, then describe the implementation approach, create tickets for the work, and update the task graph with the new tickets and their dependencies.

## Creating New Tickets

If your planning work requires creating new tickets, put them in `docs/active/tickets/` with YAML frontmatter that matches the DAG schema. Each ticket needs an id, title, story reference, status, priority, complexity, and dependencies list.

After creating ticket files, add corresponding entries to the nodes section of task-graph.yaml and add edges for any dependencies. Run `just dag-refresh` to validate that your changes maintain DAG integrity. The refresh command checks for orphaned references, missing documents, and dependency cycles.

## Automated Execution with Ralph Loop

For batch processing multiple tickets, use the ralph loop instead of manual claim-complete cycles. The loop automates claiming tasks, executing them via Claude Code, and continuing until all tasks for a story are complete.

Run `RALPH_ALLOW_MAIN=1 WORKTREE_STORY=S-XXX just ralph` from the main repo for single-agent serial execution. The loop handles task claiming, prompt generation, Claude invocation, and iteration automatically. See `docs/knowledge/playbook/ralph-loop.md` for detailed instructions.

## Parallel Development with Worktrees

When multiple agents need to work simultaneously, they use git worktrees to avoid conflicts. Each agent operates in a separate worktree with its own branch, commits independently, and merges back to main via pull request.

The main worktree owns the authoritative task-graph.yaml. Agents in linked worktrees should check task availability by looking at main rather than their local copy, do their implementation work, and submit a PR that includes the task status update. The PR merge serves as the coordination point that prevents conflicts.

Note: Multi-agent parallel execution is not yet verified. Use single-agent serial execution until concurrent operation is tested.
