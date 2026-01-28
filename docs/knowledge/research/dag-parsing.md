# DAG Parsing Research

> **Task**: S-002-R - Research DAG parsing approaches
> **Status**: Complete
> **Date**: 2026-01-27

This document captures research findings for implementing the DAG parsing and prompt generation system described in S-002.

---

## Executive Summary

**Recommendations:**

| Question | Recommendation | Rationale |
|----------|---------------|-----------|
| YAML Parsing | Node.js with `js-yaml` | Aligns with SvelteKit stack, zero installation burden |
| Frontmatter | Regex extraction + `js-yaml` | Simple, reliable, no dependencies |
| Task Selection | Priority-first, then FIFO | Predictable, debuggable |
| Prompt Generation | Template with minimal context | Stay under token limits, let Claude read files |
| Atomic Updates | File locking with `proper-lockfile` | Prevents race conditions between agents |

---

## Q1: YAML Parsing

### Options Evaluated

| Tool | Pros | Cons |
|------|------|------|
| **yq** | Shell-native, fast | Not installed by default, multiple incompatible versions exist |
| **Python + PyYAML** | Widely available | PyYAML not in stdlib, requires pip install |
| **Node.js + js-yaml** | Aligns with SvelteKit | Requires package.json (we'll have one anyway) |
| **Deno** | No install needed for scripts | Not commonly installed, adds runtime dependency |
| **Pure shell** | Zero dependencies | Extremely fragile, can't handle complex YAML |

### Environment Check

Current system state:
- `yq`: Not installed
- Python 3.9.6: Available, but PyYAML not installed
- Node.js v25.3.0: Available with npm 11.7.0
- Deno: Not installed

### Recommendation: Node.js with js-yaml

**Rationale:**

1. **Stack alignment**: We're building a SvelteKit app with Node.js. Using the same runtime for tooling means one fewer thing to install and maintain.

2. **Zero installation burden**: Once we have `package.json` (which S-004 will create), we just add `js-yaml` as a dev dependency. No system-level package managers needed.

3. **Reliable parsing**: `js-yaml` is the de facto standard for YAML in Node. It handles edge cases well and has excellent error messages.

4. **Programmatic power**: Unlike shell scripts piping through `yq`, we can write proper logic for DAG traversal, cycle detection, and status computation.

5. **Type safety**: With TypeScript, we can define interfaces for our task graph structure and get compile-time checking.

**Implementation approach:**

```typescript
// tools/dag-parser.ts
import { load } from 'js-yaml';
import { readFileSync } from 'fs';

interface TaskGraph {
  nodes: Task[];
  edges: Edge[];
  // ...
}

const graph: TaskGraph = load(readFileSync('task-graph.yaml', 'utf8'));
```

**Justfile integration:**

```just
prompt:
    node tools/dag-parser.js prompt

dag-status:
    node tools/dag-parser.js status
```

### Alternative: Standalone Node script

If we want the tools to work before SvelteKit is initialized (before S-004), we can:

1. Create a minimal `tools/package.json` with just `js-yaml`
2. Run `npm install` in `tools/` directory
3. Use `node --experimental-strip-types tools/dag-parser.ts` for TypeScript (Node 22+)

Given we have Node v25.3.0, this is viable.

---

## Q2: Frontmatter Extraction

### Problem

Extract YAML frontmatter from markdown files like:

```markdown
---
id: S-001
title: Ralph Loop Integration
status: research
priority: 1
depends_on: []
---

# The rest of the markdown content...
```

### Options Evaluated

| Approach | Pros | Cons |
|----------|------|------|
| **gray-matter (npm)** | Battle-tested, handles edge cases | Another dependency |
| **Regex extraction** | Zero dependencies | Must handle edge cases |
| **Line-by-line parsing** | Clear logic | Verbose |

### Recommendation: Regex extraction + js-yaml

Since we already have `js-yaml` for task-graph parsing, use a simple regex to extract the frontmatter block, then parse it:

```typescript
function extractFrontmatter(content: string): Record<string, unknown> | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  return load(match[1]) as Record<string, unknown>;
}
```

**Why not gray-matter?**

- It's a good library, but we're optimizing for minimal dependencies
- Our frontmatter is simple and predictable (we control the format)
- The regex approach is ~5 lines and covers our needs

**Required frontmatter fields:**

```yaml
id: string        # Required - unique task/story identifier
title: string     # Required - human-readable title
status: string    # Required - pending|ready|in-progress|complete|blocked
priority: number  # Optional - 1 (highest) to 5 (lowest), default 3
depends_on: []    # Optional - list of task IDs this depends on
```

**Validation:**

```typescript
interface Frontmatter {
  id: string;
  title: string;
  status: 'pending' | 'ready' | 'in-progress' | 'complete' | 'blocked';
  priority?: number;
  depends_on?: string[];
}

function validateFrontmatter(data: unknown): data is Frontmatter {
  // Type guard implementation
}
```

---

## Q3: Task Selection Strategy

### Problem

When multiple tasks have `status: ready`, which one should `just prompt` select?

### Strategies Evaluated

| Strategy | Pros | Cons |
|----------|------|------|
| **Priority-first** | Respects explicit prioritization | All P1 tasks get claimed before P2 |
| **Random** | Load balancing | Unpredictable, hard to debug |
| **Agent affinity** | Specialization | Complex to implement, may cause starvation |
| **FIFO (first added)** | Fairness | Ignores priority |
| **Shortest job first** | Optimizes throughput | Starves large tasks |

### Recommendation: Priority-first, then FIFO

```
Sort ready tasks by:
1. Priority (ascending, 1 is highest)
2. Position in nodes array (first defined = first selected)
```

**Rationale:**

1. **Predictable**: Given the same state, the same task is always selected. This makes debugging easy.

2. **Respects intent**: If we mark something P1, we want it done before P2 tasks.

3. **Simple to implement**: Just a sort and take the first element.

4. **FIFO as tiebreaker**: When priorities are equal, the task defined earlier in task-graph.yaml wins. This gives us implicit ordering control.

**Implementation:**

```typescript
function selectNextTask(graph: TaskGraph): Task | null {
  const ready = graph.nodes.filter(t => t.status === 'ready');
  if (ready.length === 0) return null;

  ready.sort((a, b) => {
    // Priority first (lower = higher priority)
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    // Then by definition order (index in nodes array)
    return graph.nodes.indexOf(a) - graph.nodes.indexOf(b);
  });

  return ready[0];
}
```

### Task Claiming

When a task is selected, we must atomically:

1. Mark it `in-progress`
2. Record `claimed_at` timestamp
3. Optionally record `claimed_by` (worktree name or agent ID)

This prevents two agents from claiming the same task. See Q5 for atomic update mechanism.

---

## Q4: Prompt Generation

### Problem

What makes an effective prompt for Claude? How much context should we include?

### Principles

1. **Reference, don't inline**: Instead of pasting entire documents into the prompt, tell Claude which files to read. Claude can read files directly.

2. **Clear task scope**: Be explicit about what deliverable is expected and where it should be written.

3. **Include acceptance criteria**: Pull from the story/ticket so Claude knows when the task is complete.

4. **Minimal but sufficient**: Every token in the prompt competes for Claude's attention. Keep it focused.

### Recommended Prompt Template

```markdown
# Task: {task.title}

## Context

You are working on Solar-Sim, a webapp for calculating sun hours.

Read these files first:
- CLAUDE.md (project conventions)
- {story.path} (your assignment)
{#if research_refs}
- {research.path} (related research)
{/if}

## Your Assignment

{task.description}

## Deliverable

{task.output || "Update relevant files as described above."}

## Acceptance Criteria

{task.acceptance_criteria || story.acceptance_criteria}

## When Complete

1. Create/update the deliverable files
2. Update task-graph.yaml: set {task.id} status to `complete`
3. Commit your changes with message: `{type}({scope}): {description}`
```

### Context Window Considerations

Claude has a large context window, but:

1. **Prompt should be short**: Let Claude read files itself rather than pasting content
2. **File references work**: Claude can read any file path we give it
3. **CLAUDE.md is essential**: Always reference it for project conventions
4. **Story is essential**: Contains the full context and acceptance criteria

### What NOT to include

- Full file contents (Claude can read them)
- Unrelated stories or tickets
- Historical context that doesn't affect implementation
- Verbose explanations (Claude understands terse instructions)

---

## Q5: Atomic Updates

### Problem

Multiple agents might run `just prompt` simultaneously. If two agents read task-graph.yaml at the same time, both might select the same "ready" task.

### Race Condition Scenario

```
Agent A: Read task-graph.yaml (sees S-001-R as ready)
Agent B: Read task-graph.yaml (sees S-001-R as ready)
Agent A: Write task-graph.yaml (marks S-001-R as in-progress)
Agent B: Write task-graph.yaml (marks S-001-R as in-progress, overwrites A's changes)
Result: Both agents think they have the task, duplicate work ensues
```

### Solutions Evaluated

| Approach | Pros | Cons |
|----------|------|------|
| **File locking** | Prevents concurrent access | Requires lock management |
| **Atomic rename** | OS guarantees atomicity | Doesn't prevent read-modify-write races |
| **Git as coordination** | Works across machines | Complex, slow |
| **External service** | Robust | Over-engineered for local development |
| **Optimistic locking** | Simple | Requires retry logic |

### Recommendation: File locking with `proper-lockfile`

Use the `proper-lockfile` npm package to acquire an exclusive lock before reading/modifying task-graph.yaml.

```typescript
import lockfile from 'proper-lockfile';

async function claimTask(): Promise<Task | null> {
  const release = await lockfile.lock('task-graph.yaml', {
    retries: {
      retries: 5,
      minTimeout: 100,
      maxTimeout: 1000,
    },
  });

  try {
    const graph = loadTaskGraph();
    const task = selectNextTask(graph);

    if (task) {
      task.status = 'in-progress';
      task.claimed_at = new Date().toISOString();
      saveTaskGraph(graph);
    }

    return task;
  } finally {
    await release();
  }
}
```

**Why `proper-lockfile`?**

1. **Cross-platform**: Works on macOS, Linux, Windows
2. **Handles stale locks**: Automatically cleans up locks from crashed processes
3. **Retry logic built-in**: Handles contention gracefully
4. **Well-maintained**: Popular, battle-tested package

**Alternative: Optimistic locking**

If we want to avoid the dependency, we could use optimistic locking with a version field:

```yaml
version: "1.0"
graph_version: 42  # Increment on every write
```

When writing, check if `graph_version` matches what we read. If not, re-read and retry. This is simpler but requires custom retry logic.

### Stale Lock Detection

For agents that crash mid-task, track `claimed_at` timestamp:

```yaml
- id: S-001-R
  status: in-progress
  claimed_at: 2026-01-27T10:30:00Z
```

`just dag-status` can warn about tasks that have been in-progress for too long (e.g., > 2 hours):

```
⚠ S-001-R has been in-progress for 3 hours (may be stale)
  Run `just task-reset S-001-R` to make it available again
```

---

## Implementation Roadmap

Based on this research, here's the recommended implementation order:

### Phase 1: Basic Infrastructure (M1)

1. Create `tools/package.json` with `js-yaml` and `proper-lockfile`
2. Create `tools/dag-parser.ts` with:
   - YAML loading
   - Status computation (which tasks are ready)
   - `just dag-status` implementation
3. Update justfile to call the Node script

### Phase 2: Frontmatter Scanning (M2)

1. Add frontmatter extraction to dag-parser
2. Implement `just dag-refresh`:
   - Scan `docs/active/stories/*.md`
   - Scan `docs/active/tickets/*.md`
   - Validate all docs have DAG entries
   - Validate all DAG entries have docs
   - Check for cycles

### Phase 3: Prompt Generation (M3)

1. Implement task selection (priority-first, FIFO tiebreaker)
2. Create prompt template
3. Implement `just prompt`:
   - Select next task
   - Gather context
   - Output formatted prompt

### Phase 4: Task Lifecycle (M4)

1. Add file locking for atomic updates
2. Implement task claiming (in `just prompt`)
3. Implement `just task-complete`
4. Implement `just task-reset`
5. Add stale task detection to `just dag-status`

---

## Open Questions

### Q: Should tools be TypeScript or JavaScript?

**Recommendation**: TypeScript with `--experimental-strip-types` (Node 22+).

We have Node v25.3.0, so this works without a build step. We get type safety with minimal overhead.

### Q: Where should tool source files live?

**Recommendation**: `tools/` directory at project root.

```
solar-sim/
├── tools/
│   ├── package.json      # Tool dependencies (js-yaml, proper-lockfile)
│   ├── dag-parser.ts     # Main DAG operations
│   ├── prompt-gen.ts     # Prompt generation
│   └── types.ts          # Shared TypeScript interfaces
├── task-graph.yaml
├── justfile
└── ...
```

### Q: How to handle the chicken-and-egg with package.json?

Before S-004 creates the main SvelteKit package.json:

1. Create `tools/package.json` as a separate package
2. Add `(cd tools && npm install)` to first-time setup
3. Justfile recipes use `node tools/dag-parser.ts`

After S-004:
- Option A: Keep tools/ as a separate package (simpler)
- Option B: Move tool dependencies to root package.json (cleaner long-term)

**Recommendation**: Start with separate tools/package.json. Merge later if desired.

---

## References

- [js-yaml documentation](https://github.com/nodeca/js-yaml)
- [proper-lockfile documentation](https://github.com/moxystudio/node-proper-lockfile)
- [Node.js --experimental-strip-types](https://nodejs.org/api/typescript.html)
- S-002 story: `docs/active/stories/S-002-dag-parsing.md`
- Milestones: `docs/active/MILESTONES.md`
