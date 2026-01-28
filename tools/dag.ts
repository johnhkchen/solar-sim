#!/usr/bin/env node
/**
 * DAG operations for Solar-Sim task management.
 *
 * Subcommands:
 *   status  - Display current task graph status
 *   refresh - Validate DAG against document frontmatter
 *   task-complete <id> - Mark a task as complete
 *   task-reset <id> - Reset a task to ready status
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { writeFileSync } from 'fs';
import { join, basename } from 'path';
import { load, dump } from 'js-yaml';
import type { TaskGraph, Task, Frontmatter, Edge } from './types.ts';

const TASK_GRAPH_PATH = join(process.cwd(), 'task-graph.yaml');
const STORIES_DIR = join(process.cwd(), 'docs', 'active', 'stories');
const TICKETS_DIR = join(process.cwd(), 'docs', 'active', 'tickets');
const STALE_THRESHOLD_HOURS = 2;

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

function getDependents(graph: TaskGraph, taskId: string): string[] {
  return graph.edges
    .filter((e) => e.from === taskId)
    .map((e) => e.to);
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

function getTasksNewlyReady(graph: TaskGraph, completedTaskId: string): Task[] {
  const dependents = getDependents(graph, completedTaskId);
  return graph.nodes.filter((task) => {
    if (!dependents.includes(task.id)) return false;
    if (task.status !== 'pending') return false;
    return areDependenciesSatisfied(graph, task);
  });
}

// =============================================================================
// Frontmatter Extraction
// =============================================================================

function extractFrontmatter(content: string): Frontmatter | null {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  try {
    return load(match[1]) as Frontmatter;
  } catch {
    return null;
  }
}

function scanDocuments(dir: string): Map<string, Frontmatter> {
  const results = new Map<string, Frontmatter>();
  if (!existsSync(dir)) return results;

  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const path = join(dir, file);
    const content = readFileSync(path, 'utf8');
    const fm = extractFrontmatter(content);
    if (fm && fm.id) {
      results.set(fm.id, fm);
    }
  }
  return results;
}

// =============================================================================
// Cycle Detection
// =============================================================================

function detectCycles(graph: TaskGraph): string[] | null {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const path: string[] = [];

  function hasCycle(nodeId: string): boolean {
    visited.add(nodeId);
    recursionStack.add(nodeId);
    path.push(nodeId);

    const neighbors = graph.edges
      .filter((e) => e.from === nodeId)
      .map((e) => e.to);

    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        if (hasCycle(neighbor)) return true;
      } else if (recursionStack.has(neighbor)) {
        path.push(neighbor);
        return true;
      }
    }

    path.pop();
    recursionStack.delete(nodeId);
    return false;
  }

  const allNodes = new Set(graph.nodes.map((n) => n.id));
  for (const nodeId of allNodes) {
    if (!visited.has(nodeId)) {
      if (hasCycle(nodeId)) {
        const cycleStart = path[path.length - 1];
        const cycleStartIdx = path.indexOf(cycleStart);
        return path.slice(cycleStartIdx);
      }
    }
  }
  return null;
}

// =============================================================================
// Stale Task Detection
// =============================================================================

function getStaleTasks(graph: TaskGraph): Task[] {
  const now = Date.now();
  const thresholdMs = STALE_THRESHOLD_HOURS * 60 * 60 * 1000;

  return graph.nodes.filter((task) => {
    if (task.status !== 'in-progress') return false;
    if (!task.claimed_at) return false;
    const claimedAt = new Date(task.claimed_at).getTime();
    return now - claimedAt > thresholdMs;
  });
}

function formatDuration(ms: number): string {
  const hours = Math.floor(ms / (1000 * 60 * 60));
  const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

// =============================================================================
// Subcommands
// =============================================================================

function cmdStatus(): void {
  const graph = loadTaskGraph();
  const readyTasks = computeReadyTasks(graph);
  const staleTasks = getStaleTasks(graph);

  const statusCounts: Record<string, number> = {};
  for (const task of graph.nodes) {
    statusCounts[task.status] = (statusCounts[task.status] || 0) + 1;
  }

  const storyStatusCounts: Record<string, number> = {};
  for (const story of graph.stories) {
    storyStatusCounts[story.status] = (storyStatusCounts[story.status] || 0) + 1;
  }

  console.log('');
  console.log('📊 Task Graph Status');
  console.log('====================');
  console.log(`Stories: ${graph.stories.length} total`);
  for (const [status, count] of Object.entries(storyStatusCounts).sort()) {
    console.log(`  - ${status}: ${count}`);
  }
  console.log('');
  console.log(`Tasks: ${graph.nodes.length} total`);
  const statusOrder = ['ready', 'pending', 'in-progress', 'complete', 'blocked'];
  for (const status of statusOrder) {
    if (statusCounts[status]) {
      console.log(`  - ${status}: ${statusCounts[status]}`);
    }
  }
  console.log('');

  if (staleTasks.length > 0) {
    console.log('⚠️  Stale tasks (in-progress > 2 hours):');
    for (const task of staleTasks) {
      const elapsed = Date.now() - new Date(task.claimed_at!).getTime();
      console.log(`  ${task.id}: ${task.title} (${formatDuration(elapsed)})`);
      console.log(`    Run \`just task-reset ${task.id}\` to make it available again`);
    }
    console.log('');
  }

  if (readyTasks.length > 0) {
    readyTasks.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority;
      return graph.nodes.indexOf(a) - graph.nodes.indexOf(b);
    });

    console.log('Ready for work (highest priority first):');
    for (const task of readyTasks) {
      console.log(`  [P${task.priority}] ${task.id}  ${task.title}`);
    }
    console.log('');
    console.log('Run `just prompt` to get the next task.');
  } else {
    console.log('No tasks ready. All tasks are complete, in-progress, or blocked.');
  }
  console.log('');
}

function cmdRefresh(): void {
  const graph = loadTaskGraph();
  const errors: string[] = [];
  const warnings: string[] = [];

  console.log('');
  console.log('📄 Scanning documents...');
  console.log('');

  const storyDocs = scanDocuments(STORIES_DIR);
  const ticketDocs = scanDocuments(TICKETS_DIR);

  console.log(`Stories (${STORIES_DIR.replace(process.cwd(), '.')}/):`);
  if (storyDocs.size === 0) {
    console.log('  (none found)');
  } else {
    const files = readdirSync(STORIES_DIR).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      console.log(`  ✓ ${file}`);
    }
  }
  console.log('');

  console.log(`Tickets (${TICKETS_DIR.replace(process.cwd(), '.')}/):`);
  if (!existsSync(TICKETS_DIR) || ticketDocs.size === 0) {
    console.log('  (none)');
  } else {
    const files = readdirSync(TICKETS_DIR).filter((f) => f.endsWith('.md'));
    for (const file of files) {
      console.log(`  ✓ ${file}`);
    }
  }
  console.log('');

  console.log(`Summary: ${storyDocs.size} stories, ${ticketDocs.size} tickets scanned`);
  console.log('');

  // Check for DAG tasks without documents (stories only, tasks reference stories)
  const storyIds = new Set(storyDocs.keys());
  for (const story of graph.stories) {
    if (!storyIds.has(story.id)) {
      const expectedPath = story.path || `docs/active/stories/${story.id}.md`;
      if (!existsSync(join(process.cwd(), expectedPath))) {
        warnings.push(`Task ${story.id} in DAG has no corresponding document at ${expectedPath}`);
      }
    }
  }

  // Check for documents not in DAG
  const dagStoryIds = new Set(graph.stories.map((s) => s.id));
  for (const [id, fm] of storyDocs) {
    if (!dagStoryIds.has(id)) {
      warnings.push(`Document with id ${id} not referenced in DAG stories`);
    }
  }

  // Check for cycles
  const cycle = detectCycles(graph);
  if (cycle) {
    errors.push(`Dependency cycle detected: ${cycle.join(' → ')}`);
  }

  // Check for orphaned edge references
  const nodeIds = new Set(graph.nodes.map((n) => n.id));
  for (const edge of graph.edges) {
    if (!nodeIds.has(edge.from)) {
      errors.push(`Edge references non-existent task: ${edge.from}`);
    }
    if (!nodeIds.has(edge.to)) {
      errors.push(`Edge references non-existent task: ${edge.to}`);
    }
  }

  console.log('Validation:');
  if (errors.length === 0 && warnings.length === 0) {
    console.log('  ✓ All DAG tasks have corresponding documents');
    console.log('  ✓ All documents have DAG entries');
    console.log('  ✓ No dependency cycles detected');
    console.log('  ✓ No orphaned references');
    console.log('');
    console.log('DAG integrity: OK');
  } else {
    for (const warning of warnings) {
      console.log(`  ⚠️  Warning: ${warning}`);
    }
    for (const error of errors) {
      console.log(`  ✗ Error: ${error}`);
    }
    console.log('');
    if (errors.length > 0) {
      console.log(`DAG integrity: FAILED (${errors.length} errors, ${warnings.length} warnings)`);
      process.exit(1);
    } else {
      console.log(`DAG integrity: OK with ${warnings.length} warnings`);
    }
  }
  console.log('');
}

function cmdTaskComplete(taskId: string): void {
  const graph = loadTaskGraph();
  const task = graph.nodes.find((t) => t.id === taskId);

  if (!task) {
    console.error(`Error: Task ${taskId} not found`);
    process.exit(1);
  }

  if (task.status === 'complete') {
    console.log(`Task ${taskId} is already complete`);
    return;
  }

  task.status = 'complete';
  task.completed_at = new Date().toISOString();
  delete task.claimed_at;
  delete task.claimed_by;

  // Update meta counts
  updateMetaCounts(graph);

  saveTaskGraph(graph);

  console.log(`✓ ${taskId} marked complete`);

  // Check for newly ready tasks
  const newlyReady = getTasksNewlyReady(graph, taskId);
  for (const ready of newlyReady) {
    ready.status = 'ready';
    console.log(`  → ${ready.id} is now ready`);
  }

  if (newlyReady.length > 0) {
    updateMetaCounts(graph);
    saveTaskGraph(graph);
  }
}

function cmdTaskReset(taskId: string): void {
  const graph = loadTaskGraph();
  const task = graph.nodes.find((t) => t.id === taskId);

  if (!task) {
    console.error(`Error: Task ${taskId} not found`);
    process.exit(1);
  }

  const previousStatus = task.status;
  task.status = 'ready';
  delete task.claimed_at;
  delete task.claimed_by;

  updateMetaCounts(graph);
  saveTaskGraph(graph);

  console.log(`✓ ${taskId} reset to ready (was: ${previousStatus})`);
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

const args = process.argv.slice(2);
const command = args[0];

switch (command) {
  case 'status':
    cmdStatus();
    break;
  case 'refresh':
    cmdRefresh();
    break;
  case 'task-complete':
    if (!args[1]) {
      console.error('Usage: dag.ts task-complete <task-id>');
      process.exit(1);
    }
    cmdTaskComplete(args[1]);
    break;
  case 'task-reset':
    if (!args[1]) {
      console.error('Usage: dag.ts task-reset <task-id>');
      process.exit(1);
    }
    cmdTaskReset(args[1]);
    break;
  default:
    console.log('Usage: dag.ts <command>');
    console.log('');
    console.log('Commands:');
    console.log('  status         Show task graph status');
    console.log('  refresh        Validate DAG against documents');
    console.log('  task-complete  Mark a task as complete');
    console.log('  task-reset     Reset a task to ready');
    process.exit(1);
}
