#!/usr/bin/env node
/**
 * Prompt generation for Solar-Sim task management.
 *
 * Selects the highest-priority ready task and generates a well-formed prompt
 * for Claude to execute.
 *
 * Usage:
 *   node --experimental-strip-types tools/prompt.ts
 *
 * Exit codes:
 *   0 - Prompt generated successfully
 *   1 - No tasks available
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { load, dump } from 'js-yaml';
import lockfile from 'proper-lockfile';
import type { TaskGraph, Task } from './types.ts';

const TASK_GRAPH_PATH = join(process.cwd(), 'task-graph.yaml');

// =============================================================================
// Worktree Detection
// =============================================================================

function isLinkedWorktree(): boolean {
  const gitPath = join(process.cwd(), '.git');
  try {
    return statSync(gitPath).isFile();
  } catch {
    return false;
  }
}

function printWorktreeWarning(): void {
  console.error('Warning: Running from linked worktree. task-graph.yaml may be stale.');
  console.error('Check task availability with: git show main:task-graph.yaml');
  console.error('');
}

// =============================================================================
// YAML Loading and Saving
// =============================================================================

function loadTaskGraph(): TaskGraph {
  const content = readFileSync(TASK_GRAPH_PATH, 'utf8');
  return load(content) as TaskGraph;
}

function saveTaskGraph(graph: TaskGraph): void {
  graph.last_updated = new Date().toISOString().split('T')[0];
  const content = dump(graph, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
  writeFileSync(TASK_GRAPH_PATH, content, 'utf8');
}

// =============================================================================
// DAG Analysis
// =============================================================================

function getCompletedTaskIds(graph: TaskGraph): Set<string> {
  return new Set(
    graph.nodes
      .filter((t) => t.status === 'complete')
      .map((t) => t.id)
  );
}

function getDependencies(graph: TaskGraph, taskId: string): string[] {
  return graph.edges
    .filter((e) => e.to === taskId)
    .map((e) => e.from);
}

function areDependenciesSatisfied(graph: TaskGraph, task: Task): boolean {
  const completed = getCompletedTaskIds(graph);
  const deps = getDependencies(graph, task.id);
  return deps.every((depId) => completed.has(depId));
}

function computeReadyTasks(graph: TaskGraph): Task[] {
  return graph.nodes.filter((task) => {
    if (task.status !== 'pending' && task.status !== 'ready') {
      return false;
    }
    return areDependenciesSatisfied(graph, task);
  });
}

function selectNextTask(graph: TaskGraph): Task | null {
  const ready = computeReadyTasks(graph);
  if (ready.length === 0) return null;

  ready.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return graph.nodes.indexOf(a) - graph.nodes.indexOf(b);
  });

  return ready[0];
}

// =============================================================================
// Context Gathering
// =============================================================================

function getStoryPath(graph: TaskGraph, task: Task): string | null {
  if (!task.story) return null;
  const story = graph.stories.find((s) => s.id === task.story);
  return story?.path || null;
}

function getMilestoneIds(task: Task): string[] {
  if (task.milestones) return task.milestones;
  if (task.milestone) return [task.milestone];
  return [];
}

function getContextFiles(graph: TaskGraph, task: Task): Array<{ path: string; description: string }> {
  const files: Array<{ path: string; description: string }> = [];

  const storyPath = getStoryPath(graph, task);
  if (storyPath) {
    files.push({ path: storyPath, description: 'your assignment with detailed implementation plan' });
  }

  const milestoneIds = getMilestoneIds(task);
  if (milestoneIds.length > 0) {
    files.push({
      path: 'docs/active/MILESTONES.md',
      description: `${milestoneIds.join(', ')} acceptance criteria`,
    });
  }

  if (task.output) {
    const outputDir = task.output.includes('/') ? task.output.split('/').slice(0, -1).join('/') : null;
    if (outputDir && outputDir.startsWith('docs/knowledge/research')) {
      const researchPath = `${outputDir.replace('/research', '/research')}`;
      if (existsSync(join(process.cwd(), researchPath))) {
        files.push({ path: researchPath, description: 'related research' });
      }
    }
  }

  return files;
}

function getAcceptanceCriteria(task: Task): string | null {
  const milestones = getMilestoneIds(task);
  if (milestones.length === 0) return null;
  return `See the acceptance criteria for ${milestones.join(', ')} in docs/active/MILESTONES.md`;
}

function getNextTasks(graph: TaskGraph, task: Task): string[] {
  return graph.edges
    .filter((e) => e.from === task.id)
    .map((e) => e.to);
}

// =============================================================================
// Prompt Generation
// =============================================================================

function generatePrompt(graph: TaskGraph, task: Task): string {
  const contextFiles = getContextFiles(graph, task);
  const acceptanceCriteria = getAcceptanceCriteria(task);
  const nextTasks = getNextTasks(graph, task);

  let prompt = `You are implementing the ${task.title} for Solar-Sim.

Read these files first:

- CLAUDE.md (project conventions, especially the Writing Style section)
`;

  for (const file of contextFiles) {
    prompt += `\n- ${file.path} (${file.description})`;
  }

  prompt += `

- task-graph.yaml (the structure you're parsing)

Your task: ${task.id} - ${task.title}

${task.description.trim()}
`;

  if (acceptanceCriteria) {
    prompt += `
${acceptanceCriteria}
`;
  }

  prompt += `
When complete:

1. Update task-graph.yaml to mark ${task.id} as complete
`;

  if (nextTasks.length > 0) {
    prompt += `2. Mark ${nextTasks.join(', ')} as ready (they depend only on this task)
`;
  }

  prompt += `3. Update the meta section with new status counts
4. Verify \`just dag-status\` shows accurate data including the newly completed task
`;

  return prompt;
}

// =============================================================================
// Task Claiming with File Locking
// =============================================================================

async function claimAndGeneratePrompt(): Promise<void> {
  if (isLinkedWorktree()) {
    printWorktreeWarning();
  }

  let release: (() => Promise<void>) | null = null;

  try {
    release = await lockfile.lock(TASK_GRAPH_PATH, {
      retries: {
        retries: 5,
        minTimeout: 100,
        maxTimeout: 1000,
      },
    });

    const graph = loadTaskGraph();
    const task = selectNextTask(graph);

    if (!task) {
      console.log('No tasks available. All tasks are either complete, in-progress, or blocked.');
      process.exit(1);
    }

    task.status = 'in-progress';
    task.claimed_at = new Date().toISOString();
    if (process.env.WORKTREE) {
      task.claimed_by = process.env.WORKTREE;
    }

    updateMetaCounts(graph);
    saveTaskGraph(graph);

    const prompt = generatePrompt(graph, task);
    console.log(prompt);
  } finally {
    if (release) {
      await release();
    }
  }
}

function updateMetaCounts(graph: TaskGraph): void {
  const statusCounts: Record<string, number> = {
    ready: 0,
    pending: 0,
    in_progress: 0,
    complete: 0,
    blocked: 0,
  };

  for (const task of graph.nodes) {
    const key = task.status.replace('-', '_');
    statusCounts[key] = (statusCounts[key] || 0) + 1;
  }

  graph.meta.by_status = statusCounts;
  graph.meta.total_tasks = graph.nodes.length;
  graph.meta.total_stories = graph.stories.length;
  graph.meta.total_milestones = graph.milestones.length;
}

// =============================================================================
// Main
// =============================================================================

claimAndGeneratePrompt().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
