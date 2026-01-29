#!/usr/bin/env node
/**
 * DAG operations for Solar-Sim task management.
 *
 * Subcommands:
 *   status  - Display current task graph status
 *   refresh - Validate DAG against document frontmatter
 *   task-complete <id> [--force] - Mark a task as complete
 *   task-reset <id> - Reset a task to ready status
 */

import { readFileSync, readdirSync, existsSync, statSync, unlinkSync } from 'fs';
import { writeFileSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { load, dump } from 'js-yaml';
import type { TaskGraph, Task, Frontmatter, Edge, TicketFrontmatter, TaskStatus, Complexity } from './types.ts';
import { logCompleted, logReset, logCompleteBlocked } from './audit.ts';

const TASK_GRAPH_PATH = join(process.cwd(), 'task-graph.yaml');
const STORIES_DIR = join(process.cwd(), 'docs', 'active', 'stories');
const TICKETS_DIR = join(process.cwd(), 'docs', 'active', 'tickets');
const RALPH_DIR = join(process.cwd(), '.ralph');
const CURRENT_TASK_PATH = join(RALPH_DIR, 'current-task');
const STALE_THRESHOLD_HOURS = 2;

// Regex to match and replace YAML frontmatter
const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---/;

// Minimum file size thresholds for completion guards
const MIN_FILE_SIZE_BYTES = 100;
const MIN_MARKDOWN_SIZE_BYTES = 500;

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
// Current Task Tracking
// =============================================================================

function clearCurrentTaskIfMatches(taskId: string): void {
  if (!existsSync(CURRENT_TASK_PATH)) return;
  try {
    const content = readFileSync(CURRENT_TASK_PATH, 'utf8');
    const info = JSON.parse(content);
    if (info.task_id === taskId) {
      unlinkSync(CURRENT_TASK_PATH);
    }
  } catch {
    // Ignore errors reading/parsing current task
  }
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
// Ticket Parsing and Validation
// =============================================================================

interface TicketParseResult {
  frontmatter: TicketFrontmatter;
  description: string;
  filePath: string;
  fileName: string;
}

interface TicketValidationError {
  file: string;
  field: string;
  message: string;
}

const VALID_STATUSES: TaskStatus[] = ['pending', 'ready', 'in-progress', 'complete', 'blocked'];
const VALID_COMPLEXITIES: Complexity[] = ['S', 'M', 'L', 'XL'];

function extractDescription(content: string): string {
  // Remove frontmatter
  const withoutFrontmatter = content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');

  // Find the first ## section (typically "## Objective")
  const sectionMatch = withoutFrontmatter.match(/##\s+\w+[\s\S]*?(?=\n##|\n*$)/);
  if (sectionMatch) {
    // Extract just the content after the header, trimmed
    const section = sectionMatch[0];
    const lines = section.split('\n').slice(1); // Skip the header line
    return lines.join('\n').trim();
  }

  // Fallback: use first paragraph
  const paragraphs = withoutFrontmatter.trim().split(/\n\n+/);
  return paragraphs[0]?.trim() || '';
}

function validateTicketFrontmatter(fm: any, fileName: string): TicketValidationError[] {
  const errors: TicketValidationError[] = [];

  // Required fields
  if (!fm.id) {
    errors.push({ file: fileName, field: 'id', message: 'Missing required field: id' });
  } else if (typeof fm.id !== 'string') {
    errors.push({ file: fileName, field: 'id', message: 'id must be a string' });
  }

  if (!fm.title) {
    errors.push({ file: fileName, field: 'title', message: 'Missing required field: title' });
  }

  if (!fm.story) {
    errors.push({ file: fileName, field: 'story', message: 'Missing required field: story' });
  }

  if (!fm.status) {
    errors.push({ file: fileName, field: 'status', message: 'Missing required field: status' });
  } else if (!VALID_STATUSES.includes(fm.status)) {
    errors.push({ file: fileName, field: 'status', message: `Invalid status '${fm.status}'. Must be one of: ${VALID_STATUSES.join(', ')}` });
  }

  if (fm.priority === undefined || fm.priority === null) {
    errors.push({ file: fileName, field: 'priority', message: 'Missing required field: priority' });
  } else if (typeof fm.priority !== 'number' || fm.priority < 0 || fm.priority > 5) {
    errors.push({ file: fileName, field: 'priority', message: 'priority must be a number between 0 and 5' });
  }

  if (!fm.complexity) {
    errors.push({ file: fileName, field: 'complexity', message: 'Missing required field: complexity' });
  } else if (!VALID_COMPLEXITIES.includes(fm.complexity)) {
    errors.push({ file: fileName, field: 'complexity', message: `Invalid complexity '${fm.complexity}'. Must be one of: ${VALID_COMPLEXITIES.join(', ')}` });
  }

  // Optional field validation
  if (fm.depends_on && !Array.isArray(fm.depends_on)) {
    errors.push({ file: fileName, field: 'depends_on', message: 'depends_on must be an array' });
  }

  return errors;
}

function scanTickets(dir: string): { tickets: TicketParseResult[]; errors: TicketValidationError[] } {
  const tickets: TicketParseResult[] = [];
  const errors: TicketValidationError[] = [];

  if (!existsSync(dir)) {
    return { tickets, errors };
  }

  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));

  for (const fileName of files) {
    const filePath = join(dir, fileName);
    const content = readFileSync(filePath, 'utf8');
    const fm = extractFrontmatter(content);

    if (!fm) {
      errors.push({ file: fileName, field: 'frontmatter', message: 'Could not parse frontmatter' });
      continue;
    }

    const validationErrors = validateTicketFrontmatter(fm, fileName);
    if (validationErrors.length > 0) {
      errors.push(...validationErrors);
      continue;
    }

    const description = extractDescription(content);

    tickets.push({
      frontmatter: fm as TicketFrontmatter,
      description,
      filePath: `docs/active/tickets/${fileName}`,
      fileName,
    });
  }

  return { tickets, errors };
}

function checkDependencyReferences(
  tickets: TicketParseResult[]
): TicketValidationError[] {
  const errors: TicketValidationError[] = [];
  const ticketIds = new Set(tickets.map(t => t.frontmatter.id));

  for (const ticket of tickets) {
    const deps = ticket.frontmatter.depends_on || [];
    for (const depId of deps) {
      if (!ticketIds.has(depId)) {
        errors.push({
          file: ticket.fileName,
          field: 'depends_on',
          message: `References non-existent dependency: ${depId}`,
        });
      }
    }
  }

  // Check for duplicate IDs
  const seenIds = new Set<string>();
  for (const ticket of tickets) {
    if (seenIds.has(ticket.frontmatter.id)) {
      errors.push({
        file: ticket.fileName,
        field: 'id',
        message: `Duplicate ticket ID: ${ticket.frontmatter.id}`,
      });
    }
    seenIds.add(ticket.frontmatter.id);
  }

  return errors;
}

function computeEffectiveStatus(
  ticket: TicketParseResult,
  completedIds: Set<string>
): TaskStatus {
  const fm = ticket.frontmatter;

  // Terminal states are preserved
  if (fm.status === 'complete' || fm.status === 'in-progress' || fm.status === 'blocked') {
    return fm.status;
  }

  // For ready/pending, check dependencies
  const deps = fm.depends_on || [];
  const allDepsSatisfied = deps.every(depId => completedIds.has(depId));

  return allDepsSatisfied ? 'ready' : 'pending';
}

function generateNodesFromTickets(
  tickets: TicketParseResult[],
  completedIds: Set<string>
): Task[] {
  return tickets.map(ticket => {
    const fm = ticket.frontmatter;
    const effectiveStatus = computeEffectiveStatus(ticket, completedIds);

    const node: Task = {
      id: fm.id,
      title: fm.title,
      story: fm.story,
      description: ticket.description || `See ${ticket.filePath} for details.`,
      priority: fm.priority,
      complexity: fm.complexity,
      status: effectiveStatus,
      assignee: null,
    };

    // Optional fields
    if (fm.output) {
      node.output = fm.output;
    }
    if (fm.milestone) {
      node.milestone = fm.milestone;
    }
    if (fm.claimed_at) {
      node.claimed_at = fm.claimed_at;
    }
    if (fm.claimed_by) {
      node.claimed_by = fm.claimed_by;
    }
    if (fm.completed_at) {
      node.completed_at = fm.completed_at;
    }

    // Add path to ticket file
    (node as any).path = ticket.filePath;

    return node;
  });
}

function generateEdgesFromTickets(tickets: TicketParseResult[]): Edge[] {
  const edges: Edge[] = [];

  for (const ticket of tickets) {
    const deps = ticket.frontmatter.depends_on || [];
    for (const depId of deps) {
      edges.push({
        from: depId,
        to: ticket.frontmatter.id,
      });
    }
  }

  return edges;
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
// Ticket File Operations
// =============================================================================

function findTicketFile(taskId: string): string | null {
  if (!existsSync(TICKETS_DIR)) return null;

  const files = readdirSync(TICKETS_DIR).filter((f) => f.endsWith('.md'));
  for (const file of files) {
    const filePath = join(TICKETS_DIR, file);
    const content = readFileSync(filePath, 'utf8');
    const fm = extractFrontmatter(content);
    if (fm && fm.id === taskId) {
      return filePath;
    }
  }
  return null;
}

function updateTicketFrontmatter(
  ticketPath: string,
  updates: Record<string, any>
): void {
  const content = readFileSync(ticketPath, 'utf8');
  const match = content.match(FRONTMATTER_REGEX);

  if (!match) {
    throw new Error(`Could not parse frontmatter in ${ticketPath}`);
  }

  const existingFm = load(match[1]) as Record<string, any>;
  const updatedFm = { ...existingFm };

  // Apply updates, removing keys set to undefined
  for (const [key, value] of Object.entries(updates)) {
    if (value === undefined) {
      delete updatedFm[key];
    } else {
      updatedFm[key] = value;
    }
  }

  // Build new frontmatter YAML, preserving key order where possible
  const newFmYaml = dump(updatedFm, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  }).trim();

  const newContent = content.replace(
    FRONTMATTER_REGEX,
    `---\n${newFmYaml}\n---`
  );

  writeFileSync(ticketPath, newContent, 'utf8');
}

function runDagRefresh(): void {
  try {
    execSync('node --experimental-strip-types tools/dag.ts refresh', {
      cwd: process.cwd(),
      stdio: 'inherit',
    });
  } catch (error) {
    console.error('Warning: dag-refresh failed');
  }
}

// =============================================================================
// Completion Guards
// =============================================================================

interface CompletionGuardResult {
  canComplete: boolean;
  errors: string[];
  warnings: string[];
}

function checkOutputExists(outputPath: string): { exists: boolean; isDir: boolean; size: number } {
  const fullPath = join(process.cwd(), outputPath);

  if (!existsSync(fullPath)) {
    return { exists: false, isDir: false, size: 0 };
  }

  const stats = statSync(fullPath);
  if (stats.isDirectory()) {
    // Check if directory has at least one non-hidden file
    const files = readdirSync(fullPath).filter(f => !f.startsWith('.'));
    return { exists: files.length > 0, isDir: true, size: files.length };
  }

  return { exists: true, isDir: false, size: stats.size };
}

function checkUncommittedChanges(outputPath: string): boolean {
  try {
    const result = execSync(`git status --porcelain "${outputPath}"`, {
      encoding: 'utf8',
      cwd: process.cwd(),
    }).trim();
    return result.length > 0;
  } catch {
    return false;
  }
}

function runCompletionGuards(task: Task): CompletionGuardResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check output file/directory if specified
  if (task.output) {
    // Handle comma-separated outputs
    const outputs = task.output.split(',').map(o => o.trim());

    for (const outputPath of outputs) {
      const { exists, isDir, size } = checkOutputExists(outputPath);

      if (!exists) {
        if (isDir) {
          errors.push(`Output directory is empty: ${outputPath}`);
        } else {
          errors.push(`Output file missing: ${outputPath}`);
        }
        continue;
      }

      // Check file size for placeholder detection
      if (!isDir) {
        const isMarkdown = outputPath.endsWith('.md');
        const minSize = isMarkdown ? MIN_MARKDOWN_SIZE_BYTES : MIN_FILE_SIZE_BYTES;

        if (size < minSize) {
          warnings.push(`Output file appears incomplete (only ${size} bytes): ${outputPath}`);
        }
      }

      // Check for uncommitted changes
      if (checkUncommittedChanges(outputPath)) {
        warnings.push(`Output has uncommitted changes: ${outputPath}`);
      }
    }
  }

  return {
    canComplete: errors.length === 0,
    errors,
    warnings,
  };
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

// Derive story status from ticket statuses
function deriveStoryStatus(
  storyId: string,
  tickets: TicketParseResult[]
): TaskStatus {
  const storyTickets = tickets.filter(t => t.frontmatter.story === storyId);

  if (storyTickets.length === 0) {
    return 'pending';
  }

  const statuses = storyTickets.map(t => t.frontmatter.status);

  // If all tickets are complete, story is complete
  if (statuses.every(s => s === 'complete')) {
    return 'complete';
  }

  // If any ticket is in-progress, story is in-progress
  if (statuses.some(s => s === 'in-progress')) {
    return 'in-progress';
  }

  // If any ticket is blocked, story is blocked
  if (statuses.some(s => s === 'blocked')) {
    return 'blocked';
  }

  // Otherwise pending
  return 'pending';
}

function cmdRefresh(): void {
  const graph = loadTaskGraph();
  const errors: string[] = [];

  console.log('');
  console.log('📄 Scanning documents...');
  console.log('');

  // Scan stories (for metadata only - status is derived from tickets)
  const storyDocs = scanDocuments(STORIES_DIR);
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

  // Scan tickets (the ONLY source of truth for nodes)
  const { tickets, errors: ticketErrors } = scanTickets(TICKETS_DIR);
  console.log(`Tickets (${TICKETS_DIR.replace(process.cwd(), '.')}/):`);
  if (tickets.length === 0 && ticketErrors.length === 0) {
    console.log('  (none)');
  } else {
    for (const ticket of tickets) {
      console.log(`  ✓ ${ticket.fileName}`);
    }
    for (const err of ticketErrors) {
      console.log(`  ✗ ${err.file}: ${err.message}`);
      errors.push(`${err.file}: ${err.message}`);
    }
  }
  console.log('');

  // Check dependency references (tickets only - no preserved nodes)
  const depErrors = checkDependencyReferences(tickets);
  for (const err of depErrors) {
    errors.push(`${err.file}: ${err.message}`);
  }

  // If there are errors, report and exit
  if (errors.length > 0) {
    console.log('Validation errors:');
    for (const error of errors) {
      console.log(`  ✗ ${error}`);
    }
    console.log('');
    console.log(`DAG refresh: FAILED (${errors.length} errors)`);
    console.log('Fix the errors above and run again.');
    process.exit(1);
  }

  // Compute which tasks are complete (from tickets only)
  const completedIds = new Set<string>();
  for (const ticket of tickets) {
    if (ticket.frontmatter.status === 'complete') {
      completedIds.add(ticket.frontmatter.id);
    }
  }

  // Generate nodes from tickets (the ONLY source of nodes)
  const allNodes = generateNodesFromTickets(tickets, completedIds);

  // Generate edges from tickets (the ONLY source of edges)
  const allEdges = generateEdgesFromTickets(tickets);

  // Update the graph
  graph.nodes = allNodes;
  graph.edges = allEdges;

  // Update story statuses based on their tickets
  for (const story of graph.stories) {
    story.status = deriveStoryStatus(story.id, tickets);
  }

  // Check for cycles in the new graph
  const cycle = detectCycles(graph);
  if (cycle) {
    console.log(`  ✗ Dependency cycle detected: ${cycle.join(' → ')}`);
    console.log('');
    console.log('DAG refresh: FAILED (cycle detected)');
    process.exit(1);
  }

  // Update meta counts
  updateMetaCounts(graph);

  // Save the updated graph
  saveTaskGraph(graph);

  // Report summary
  console.log(`Summary: ${storyDocs.size} stories, ${tickets.length} tickets processed`);
  console.log('');
  console.log('Generated:');
  console.log(`  ${allNodes.length} nodes from tickets`);
  console.log(`  ${allEdges.length} edges from ticket dependencies`);
  console.log('');

  // Show status summary
  const statusCounts: Record<string, number> = {};
  for (const node of allNodes) {
    statusCounts[node.status] = (statusCounts[node.status] || 0) + 1;
  }
  console.log('Status summary:');
  for (const status of ['ready', 'pending', 'in-progress', 'complete', 'blocked']) {
    if (statusCounts[status]) {
      console.log(`  ${status}: ${statusCounts[status]}`);
    }
  }
  console.log('');
  console.log('✓ DAG refreshed successfully');
  console.log('');
}

function cmdTaskComplete(taskId: string, force: boolean = false): void {
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

  // Run completion guards
  const guardResult = runCompletionGuards(task);

  // Print warnings regardless of force flag
  for (const warning of guardResult.warnings) {
    console.log(`Warning: ${warning}`);
  }

  // Check for errors
  if (!guardResult.canComplete && !force) {
    for (const error of guardResult.errors) {
      console.error(`Error: ${error}`);
    }
    console.error('');
    console.error('Run with --force to complete anyway.');
    logCompleteBlocked(taskId, 'just task-complete', guardResult.errors.join('; '));
    process.exit(1);
  }

  // Log force override if applicable
  if (!guardResult.canComplete && force) {
    for (const error of guardResult.errors) {
      console.log(`Overriding: ${error}`);
    }
  }

  const previousStatus = task.status;
  const completedAt = new Date().toISOString();

  // Find and update the ticket file if it exists (ticket-first approach)
  const ticketPath = findTicketFile(taskId);
  if (ticketPath) {
    console.log(`Updating ticket: ${ticketPath.replace(process.cwd() + '/', '')}`);
    updateTicketFrontmatter(ticketPath, {
      status: 'complete',
      completed_at: completedAt,
    });

    // Clear current task tracking if it matches
    clearCurrentTaskIfMatches(taskId);

    // Log the completion
    logCompleted(taskId, 'just task-complete', force, force ? 'Forced completion' : undefined);

    console.log(`✓ ${taskId} marked complete`);

    // Run dag-refresh to sync task-graph.yaml from ticket frontmatter
    console.log('');
    console.log('Syncing task-graph.yaml...');
    runDagRefresh();
  } else {
    // Fallback: update task-graph.yaml directly for non-ticket tasks (S-* pattern)
    task.status = 'complete';
    task.completed_at = completedAt;
    delete task.claimed_at;
    delete task.claimed_by;

    // Update meta counts
    updateMetaCounts(graph);

    saveTaskGraph(graph);

    // Clear current task tracking if it matches
    clearCurrentTaskIfMatches(taskId);

    // Log the completion
    logCompleted(taskId, 'just task-complete', force, force ? 'Forced completion' : undefined);

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
}

function cmdTaskReset(taskId: string): void {
  const graph = loadTaskGraph();
  const task = graph.nodes.find((t) => t.id === taskId);

  if (!task) {
    console.error(`Error: Task ${taskId} not found`);
    process.exit(1);
  }

  const previousStatus = task.status;

  // Find and update the ticket file if it exists (ticket-first approach)
  const ticketPath = findTicketFile(taskId);
  if (ticketPath) {
    console.log(`Updating ticket: ${ticketPath.replace(process.cwd() + '/', '')}`);

    // Reset to ready status and remove claim metadata
    const updates: Record<string, any> = {
      status: 'ready',
    };

    // Read current frontmatter to check what needs to be removed
    const content = readFileSync(ticketPath, 'utf8');
    const fm = extractFrontmatter(content) as Record<string, any>;

    // Remove claim and completion metadata by setting to undefined
    // (these will be removed from the YAML output)
    if (fm.claimed_at) updates.claimed_at = undefined;
    if (fm.claimed_by) updates.claimed_by = undefined;
    if (fm.completed_at) updates.completed_at = undefined;

    updateTicketFrontmatter(ticketPath, updates);

    // Clear current task tracking if it matches
    clearCurrentTaskIfMatches(taskId);

    // Log the reset
    logReset(taskId, previousStatus, 'just task-reset');

    console.log(`✓ ${taskId} reset to ready (was: ${previousStatus})`);

    // Run dag-refresh to sync task-graph.yaml from ticket frontmatter
    console.log('');
    console.log('Syncing task-graph.yaml...');
    runDagRefresh();
  } else {
    // Fallback: update task-graph.yaml directly for non-ticket tasks (S-* pattern)
    task.status = 'ready';
    delete task.claimed_at;
    delete task.claimed_by;

    updateMetaCounts(graph);
    saveTaskGraph(graph);

    // Clear current task tracking if it matches
    clearCurrentTaskIfMatches(taskId);

    // Log the reset
    logReset(taskId, previousStatus, 'just task-reset');

    console.log(`✓ ${taskId} reset to ready (was: ${previousStatus})`);
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

  // Build by_milestone from actual node data
  const byMilestone: Record<string, string[]> = {};

  for (const task of graph.nodes) {
    const key = task.status.replace('-', '_');
    statusCounts[key] = (statusCounts[key] || 0) + 1;

    // Track milestone assignments
    if (task.milestone) {
      if (!byMilestone[task.milestone]) {
        byMilestone[task.milestone] = [];
      }
      byMilestone[task.milestone].push(task.id);
    }
  }

  graph.meta.by_status = statusCounts;
  graph.meta.by_milestone = byMilestone;
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
      console.error('Usage: dag.ts task-complete <task-id> [--force]');
      process.exit(1);
    }
    const forceFlag = args.includes('--force');
    cmdTaskComplete(args[1], forceFlag);
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
    console.log('  status                    Show task graph status');
    console.log('  refresh                   Validate DAG against documents');
    console.log('  task-complete <id>        Mark a task as complete');
    console.log('  task-complete <id> --force  Mark complete, skip guards');
    console.log('  task-reset <id>           Reset a task to ready');
    process.exit(1);
}
