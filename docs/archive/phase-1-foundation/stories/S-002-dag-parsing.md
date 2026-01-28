---
id: S-002
title: DAG Parsing and Prompt Generation
status: planning
priority: 1
complexity: L
depends_on: [S-001]
blocks: []
milestones: [M1, M2, M3, M4]
assignee: null
created: 2026-01-27
updated: 2026-01-27
---

# S-002: DAG Parsing and Prompt Generation

## Overview

Implement the `just prompt` command that parses `task-graph.yaml` and document frontmatter to generate well-formed prompts for Claude. This is the "brain" that directs what work agents do.

## Background

### The DAG Model

Our task graph is a Directed Acyclic Graph where:
- **Nodes** = Tasks (stories, tickets, research items)
- **Edges** = Dependencies (task A must complete before task B)

A task is "ready" when:
1. All its dependencies are `complete`
2. Its own status is `pending` or `ready`
3. It's not currently claimed by another agent

### Two Sources of Truth

We maintain task information in two places:

1. **`task-graph.yaml`**: Machine-readable DAG with task IDs, statuses, dependencies
2. **Document frontmatter**: Human-readable context in story/ticket markdown files

The `just dag-refresh` command should reconcile these, using frontmatter as the source of truth for task definitions and `task-graph.yaml` for runtime status.

## Research Questions

### R1: YAML Parsing

- [ ] What's the best way to parse YAML in a shell script / justfile?
- [ ] Should we use `yq`, Python, Node.js, or a custom tool?
- [ ] How do we handle YAML parsing errors gracefully?

### R2: Frontmatter Extraction

- [ ] Standard format for document frontmatter (already using `---` delimiters)
- [ ] How to extract frontmatter from multiple files efficiently?
- [ ] What fields are required vs optional?

### R3: Task Selection Strategy

- [ ] How to select among multiple ready tasks?
  - Highest priority first?
  - Random selection for load balancing?
  - Agent affinity (certain agents prefer certain task types)?
- [ ] How to implement task "claiming" to prevent duplicates?

### R4: Prompt Generation

- [ ] What makes an effective prompt for Claude?
- [ ] How much context should we include?
  - Full story content?
  - Related research docs?
  - Relevant code snippets?
- [ ] Should prompts be templated or dynamic?

### R5: Status Updates

- [ ] How should `just prompt` update task status when claiming?
- [ ] How do we handle the transition: ready → in-progress → complete?
- [ ] What if Claude fails mid-task? How to reset status?

### R6: DAG Integrity

- [ ] How to detect cycles (which would make it not a DAG)?
- [ ] How to handle orphaned tasks (dependencies that don't exist)?
- [ ] Validation of task-graph.yaml structure

## Acceptance Criteria

- [ ] `just prompt` outputs a well-formed prompt for the next available task
- [ ] `just prompt` returns empty/signal when no tasks are ready
- [ ] `just dag-status` displays current state of all tasks
- [ ] `just dag-refresh` regenerates DAG from document frontmatter
- [ ] Task claiming prevents duplicate work
- [ ] Invalid DAG states are detected and reported

## Implementation Plan

The research phase determined that we should use Node.js with js-yaml for YAML parsing, proper-lockfile for atomic updates, priority-first task selection, and minimal prompt templates that tell Claude which files to read rather than inlining content. This plan translates those decisions into concrete implementation steps.

### Tool Architecture

All DAG tooling lives in a `tools/` directory at the project root, with its own package.json to avoid chicken-and-egg problems with SvelteKit initialization. The directory contains three TypeScript files that work together: `dag.ts` handles all DAG operations including parsing, status computation, and graph validation; `prompt.ts` generates prompts by selecting tasks and gathering context; and `types.ts` defines the shared interfaces for task graphs, tasks, and frontmatter.

The justfile serves as the user-facing entry point, with recipes that invoke the Node.js tools. Since we have Node v25.3.0, we can use the `--experimental-strip-types` flag to run TypeScript directly without a build step, which keeps the tooling simple and fast. Each justfile recipe maps to a subcommand: `just dag-status` calls `node --experimental-strip-types tools/dag.ts status`, `just dag-refresh` calls `node --experimental-strip-types tools/dag.ts refresh`, and `just prompt` calls `node --experimental-strip-types tools/prompt.ts`.

The tools use js-yaml to parse both task-graph.yaml and document frontmatter. For frontmatter extraction, a simple regex identifies the YAML block between `---` delimiters, and js-yaml parses the extracted content. The proper-lockfile package handles atomic updates to task-graph.yaml, which prevents race conditions when multiple agents try to claim tasks simultaneously.

### Implementation Order

The implementation follows the milestone sequence M1 through M4, with each milestone building on the previous one and delivering independently useful functionality.

**M1: DAG Introspection** comes first because everything else depends on being able to parse and query task-graph.yaml. The implementation starts by creating `tools/package.json` with js-yaml and proper-lockfile as dependencies, then `tools/types.ts` with interfaces for TaskGraph, Task, and Milestone. The main `tools/dag.ts` file implements YAML loading, status computation that identifies which tasks have all dependencies satisfied, and a status subcommand that outputs a human-readable summary. The justfile gets a `dag-status` recipe that invokes the tool, and an `install-tools` recipe that runs npm install in the tools directory.

**M2: Frontmatter Scanning** adds document validation capabilities. The `tools/dag.ts` file gains frontmatter extraction using regex plus js-yaml, directory scanning for stories and tickets, and validation logic that detects orphaned tasks in the DAG that lack documents, orphaned documents that aren't in the DAG, and dependency cycles. The refresh subcommand walks `docs/active/stories/` and `docs/active/tickets/`, extracts frontmatter from each markdown file, and reports any inconsistencies. The justfile gets a `dag-refresh` recipe.

**M3: Basic Prompt Generation** introduces the core prompt functionality. The `tools/prompt.ts` file implements priority-first task selection with FIFO as a tiebreaker, context gathering that reads the task's associated story document, and prompt formatting using the template described below. The tool outputs the formatted prompt to stdout, making it easy to pipe to claude or redirect to a file. The justfile gets a `prompt` recipe that returns exit code 1 when no tasks are available.

**M4: Task Lifecycle** adds claiming, completion, and recovery. The prompt subcommand now acquires a file lock before reading task-graph.yaml, marks the selected task as in-progress with a claimed_at timestamp, and writes the updated graph before releasing the lock. New subcommands `task-complete` and `task-reset` allow marking tasks as complete or returning them to ready status. The status subcommand gains stale task detection that warns when tasks have been in-progress for more than two hours. The justfile gets `task-complete` and `task-reset` recipes.

### Prompt Template

The prompt template follows the research recommendation of minimal context with file references. Claude can read files directly, so the prompt tells it which files to read rather than pasting their contents.

```markdown
You are planning the {task.title} for Solar-Sim.

Read these files first:

- CLAUDE.md (project conventions, especially the Writing Style section)
{#each context_files as file}
- {file.path} ({file.description})
{/each}

Your task: {task.id} - {task.title}

{task.description}

{#if task.acceptance_criteria}
Your deliverable should satisfy these criteria: {task.acceptance_criteria}
{/if}

When complete:

1. Update task-graph.yaml to mark {task.id} as complete
{#if task.next_tasks}
2. Mark {task.next_tasks} as ready (they depend only on this task)
{/if}
```

The template uses mustache-style placeholders for illustration, but the actual implementation uses string interpolation in TypeScript. The context_files array is built dynamically by looking at the task's story reference, any research documents mentioned in the story, and the MILESTONES.md file when the task contributes to a milestone. The prompt stays short because Claude's attention is finite, and longer prompts dilute the important instructions.

### Task Claiming Mechanism

File locking ensures that only one agent can claim a task at a time. When `just prompt` runs, it acquires an exclusive lock on task-graph.yaml using proper-lockfile with retry configuration that waits up to five seconds for the lock to become available. While holding the lock, the tool reads the graph, selects the highest-priority ready task, updates that task's status to in-progress, records the current timestamp in claimed_at, optionally records the worktree name in claimed_by if the WORKTREE environment variable is set, and writes the updated graph back to disk. Only then does it release the lock and output the prompt.

The claimed_at timestamp enables stale task detection. When `just dag-status` runs, it checks each in-progress task and calculates how long ago it was claimed. Tasks that have been in-progress for more than two hours get flagged with a warning suggesting the user run `just task-reset` to make them available again. This handles the common case where an agent crashes or a human walks away mid-task.

The claimed_by field is optional but useful for debugging in multi-agent scenarios. When agents run in separate worktrees, each worktree sets a WORKTREE environment variable with its name, and the claiming code records this. The status output can then show which worktree is working on which task, making it easier to understand the overall system state.

### Error Handling and Recovery

Errors fall into three categories: tool errors, validation errors, and runtime failures.

Tool errors occur when the tools themselves fail to run, like missing dependencies or invalid YAML syntax. The tools should fail fast with clear error messages. If js-yaml can't parse task-graph.yaml, the error message should include the line number and nature of the syntax error. If the tools directory lacks node_modules, the error should tell the user to run `just install-tools`. These errors block all operations until fixed.

Validation errors occur when the DAG is internally inconsistent. The refresh subcommand checks for cycles by attempting a topological sort and reporting the cycle path if one exists. It checks for orphaned references in both directions. It validates that required frontmatter fields are present. When validation fails, the tool reports all errors it found rather than stopping at the first one, so the user can fix everything in one pass.

Runtime failures occur when agents crash or produce incomplete work. The recovery model is simple: any agent should be able to understand and fix the current state by reading the documents. Task status lives in task-graph.yaml, which is the single source of truth. Work products like research documents are human-readable files that persist across agent sessions. Git preserves history so we can always see what was attempted. The `just task-reset` command returns a task to ready status, discarding the claimed_at and claimed_by metadata but leaving any partial work products in place. A new agent picking up the task will see whatever files the previous agent created and can decide whether to continue from there or start over.

Lock cleanup also requires attention. The proper-lockfile package handles stale locks from crashed processes automatically by using a combination of lock files and staleness detection. If an agent crashes while holding the lock, the next agent's lock acquisition will detect that the lock holder is no longer running and clean up the stale lock. The retry configuration gives legitimate contention a chance to resolve while ensuring crashed locks don't block indefinitely.

## Dependencies

- **Depends on**: S-001 (need to understand Ralph's prompt requirements)
- **Blocks**: Nothing directly, but is critical path for `just ralph`

## Research Output

Findings should be documented in:
`docs/knowledge/research/dag-parsing.md`

## Milestones

This story is the **critical path** for the foundation phase. It delivers:

| Milestone | Deliverable | Commands |
|-----------|-------------|----------|
| **M1** | DAG Introspection | `just dag-status` |
| **M2** | Frontmatter Scanning | `just dag-refresh` |
| **M3** | Basic Prompt Generation | `just prompt` |
| **M4** | Task Lifecycle | `just task-complete`, `just task-reset` |

See `docs/active/MILESTONES.md` for full details.

### Suggested Implementation Order

1. **M1 first**: Get `just dag-status` working with real YAML parsing
2. **M2 second**: Add frontmatter scanning and validation
3. **M3 third**: Generate actual prompts from task data
4. **M4 fourth**: Add claiming, completion, and recovery

Each milestone is independently demonstrable and useful.

## Related

- S-001: Ralph Loop (consumes prompts from this system)
- S-003: Git Worktrees (parallel agents need coordination)
- `task-graph.yaml` - The DAG we're parsing
- `docs/active/MILESTONES.md` - Milestone definitions

## Resolved Design Questions

The research phase answered the open design questions. For language choice, we use TypeScript with Node.js because it aligns with the SvelteKit stack we're building toward, js-yaml is the de facto standard for YAML parsing in Node, and we can run TypeScript directly using Node 25's experimental strip-types flag. For atomic updates, we use proper-lockfile to acquire exclusive locks before modifying task-graph.yaml, with built-in retry logic and stale lock detection. For context window management, we keep prompts minimal by telling Claude which files to read rather than inlining their contents, since Claude can read files directly and this approach respects its attention limits.

## Changelog

The story was created on 2026-01-27 with initial research questions. Research completed the same day with recommendations documented in docs/knowledge/research/dag-parsing.md. Implementation plan added on 2026-01-27 covering tool architecture, milestone-based implementation order, prompt template design, task claiming mechanism, and error handling strategy.
