#!/usr/bin/env node
/**
 * Prompt generation for Solar-Sim task management.
 *
 * Selects the highest-priority ready task and generates a well-formed prompt
 * for Claude to execute.
 *
 * Usage:
 *   node --experimental-strip-types tools/prompt.ts           # Preview only (read-only)
 *   node --experimental-strip-types tools/prompt.ts --accept  # Claim and generate prompt
 *   node --experimental-strip-types tools/prompt.ts --current # Show current task
 *   node --experimental-strip-types tools/prompt.ts <task-id> # Claim specific task
 *
 * Exit codes:
 *   0 - Success
 *   1 - No tasks available
 *   2 - Task already claimed (double-claim attempt) or guard failure
 */

import { readFileSync, writeFileSync, existsSync, statSync, mkdirSync, unlinkSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { load, dump } from 'js-yaml';
import lockfile from 'proper-lockfile';
import type { TaskGraph, Task } from './types.ts';
import { logClaimed, logClaimBlocked, logPreview } from './audit.ts';

const TASK_GRAPH_PATH = join(process.cwd(), 'task-graph.yaml');
const RALPH_DIR = join(process.cwd(), '.ralph');
const CURRENT_TASK_PATH = join(RALPH_DIR, 'current-task');

// Parse command line arguments
const args = process.argv.slice(2);
const acceptFlag = args.includes('--accept');
const currentFlag = args.includes('--current');
const skipRemoteCheck = args.includes('--skip-remote-check');
const taskIdArg = args.find(arg => !arg.startsWith('--'));

// =============================================================================
// Worktree Detection and Validation
// =============================================================================

function isLinkedWorktree(): boolean {
  const gitPath = join(process.cwd(), '.git');
  try {
    return statSync(gitPath).isFile();
  } catch {
    return false;
  }
}

function isMainWorktree(): boolean {
  const gitPath = join(process.cwd(), '.git');
  try {
    return statSync(gitPath).isDirectory();
  } catch {
    return false;
  }
}

function getWorktreeName(): string | null {
  if (process.env.WORKTREE) return process.env.WORKTREE;

  const cwd = process.cwd();
  const match = cwd.match(/solar-sim-([^/]+)$/);
  return match ? match[1] : null;
}

function getGitBranch(): string | null {
  try {
    const branch = execSync('git branch --show-current', { encoding: 'utf8' }).trim();
    return branch || null;
  } catch {
    return null;
  }
}

function extractStoryFromWorktreeName(worktreeName: string): string | null {
  // Match patterns like "s005", "S-005", "s-005", "story-005"
  const match = worktreeName.match(/(?:s|story)-?(\d{3})/i);
  if (match) {
    return `S-${match[1]}`;
  }
  return null;
}

function extractStoryFromBranch(branchName: string): string | null {
  // Match patterns like "feature/s-005-...", "feature/S005-...", "s-005/..."
  const match = branchName.match(/(?:^|\/|-)s-?(\d{3})(?:[-\/]|$)/i);
  if (match) {
    return `S-${match[1]}`;
  }
  return null;
}

interface AlignmentCheck {
  worktreeName: string | null;
  branchName: string | null;
  storyFilter: string | null;
  worktreeStory: string | null;
  branchStory: string | null;
  warnings: string[];
}

function validateWorktreeAlignment(): AlignmentCheck {
  const worktreeName = getWorktreeName();
  const branchName = getGitBranch();
  const storyFilter = process.env.WORKTREE_STORY || null;

  const worktreeStory = worktreeName ? extractStoryFromWorktreeName(worktreeName) : null;
  const branchStory = branchName ? extractStoryFromBranch(branchName) : null;

  const warnings: string[] = [];

  // Only run alignment checks if WORKTREE_STORY is set (indicates intentional story binding)
  if (storyFilter) {
    // Check if worktree name implies a different story
    if (worktreeStory && worktreeStory !== storyFilter) {
      warnings.push(
        `Worktree name '${worktreeName}' suggests ${worktreeStory} but WORKTREE_STORY=${storyFilter}`
      );
    }

    // Check if branch name implies a different story
    if (branchStory && branchStory !== storyFilter) {
      warnings.push(
        `Branch '${branchName}' suggests ${branchStory} but WORKTREE_STORY=${storyFilter}`
      );
    }

    // Check if worktree and branch disagree (when both have story info)
    if (worktreeStory && branchStory && worktreeStory !== branchStory) {
      warnings.push(
        `Worktree '${worktreeName}' (${worktreeStory}) and branch '${branchName}' (${branchStory}) suggest different stories`
      );
    }
  }

  return {
    worktreeName,
    branchName,
    storyFilter,
    worktreeStory,
    branchStory,
    warnings,
  };
}

function printAlignmentWarnings(alignment: AlignmentCheck): void {
  if (alignment.warnings.length === 0) return;

  console.error('');
  console.error('⚠️  Worktree Alignment Warnings:');
  for (const warning of alignment.warnings) {
    console.error(`   - ${warning}`);
  }
  console.error('');
  console.error('   This may indicate accidental cross-story work.');
  console.error('   To silence, ensure worktree name and branch match WORKTREE_STORY.');
  console.error('');
}

function printWorktreeWarning(): void {
  console.error('Warning: Running from linked worktree. task-graph.yaml may be stale.');
  console.error('Check task availability with: git show main:task-graph.yaml');
  console.error('');
}

// =============================================================================
// Current Task Tracking
// =============================================================================

interface CurrentTaskInfo {
  task_id: string;
  claimed_at: string;
  worktree: string | null;
  ticket_path: string | null;
}

function ensureRalphDir(): void {
  if (!existsSync(RALPH_DIR)) {
    mkdirSync(RALPH_DIR, { recursive: true });
  }
}

function getCurrentTask(): CurrentTaskInfo | null {
  if (!existsSync(CURRENT_TASK_PATH)) return null;
  try {
    const content = readFileSync(CURRENT_TASK_PATH, 'utf8');
    return JSON.parse(content) as CurrentTaskInfo;
  } catch {
    return null;
  }
}

function setCurrentTask(task: Task, ticketPath: string | null): void {
  ensureRalphDir();
  const info: CurrentTaskInfo = {
    task_id: task.id,
    claimed_at: new Date().toISOString(),
    worktree: getWorktreeName(),
    ticket_path: ticketPath,
  };
  writeFileSync(CURRENT_TASK_PATH, JSON.stringify(info, null, 2), 'utf8');
}

export function clearCurrentTask(): void {
  if (existsSync(CURRENT_TASK_PATH)) {
    unlinkSync(CURRENT_TASK_PATH);
  }
}

export function getCurrentTaskPath(): string {
  return CURRENT_TASK_PATH;
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
  let ready = computeReadyTasks(graph);
  if (ready.length === 0) return null;

  // Filter by story if WORKTREE_STORY is set (for concurrent loops)
  const storyFilter = process.env.WORKTREE_STORY;
  if (storyFilter) {
    ready = ready.filter((task) => task.story === storyFilter);
    if (ready.length === 0) {
      return null;
    }
  }

  ready.sort((a, b) => {
    if (a.priority !== b.priority) {
      return a.priority - b.priority;
    }
    return graph.nodes.indexOf(a) - graph.nodes.indexOf(b);
  });

  return ready[0];
}

function findTaskById(graph: TaskGraph, taskId: string): Task | null {
  return graph.nodes.find((t) => t.id === taskId) || null;
}

function isTaskClaimable(task: Task): { claimable: boolean; reason?: string } {
  if (task.status === 'complete') {
    return { claimable: false, reason: 'Task is already complete' };
  }
  if (task.status === 'in-progress') {
    const claimedBy = task.claimed_by ? ` by ${task.claimed_by}` : '';
    const claimedAt = task.claimed_at ? ` at ${task.claimed_at}` : '';
    return {
      claimable: false,
      reason: `Task is already claimed${claimedBy}${claimedAt}`,
    };
  }
  if (task.status === 'blocked') {
    return { claimable: false, reason: 'Task is blocked' };
  }
  return { claimable: true };
}

// =============================================================================
// Guards
// =============================================================================

function checkMainRepoGuard(): boolean {
  if (isMainWorktree()) {
    // Allow single-agent serial execution from main, but block if a task is already in-progress
    const currentTask = getCurrentTask();
    if (currentTask) {
      console.error('Error: Cannot claim tasks from main repo while another task is in-progress.');
      console.error(`Current task: ${currentTask.task_id}`);
      console.error('Complete it or run `just task-reset` first.');
      console.error('');
      console.error('For parallel development, use worktrees: `just worktree-new <name>`');
      logClaimBlocked(null, 'just prompt --accept', 'Attempted claim from main repo with task in-progress');
      return false;
    }
    // No task in-progress, allow claiming from main for single-agent serial execution
  }
  return true;
}

function checkSingleTaskGuard(): { ok: boolean; currentTask: CurrentTaskInfo | null } {
  const currentTask = getCurrentTask();
  if (currentTask) {
    console.error(`Error: Already working on ${currentTask.task_id}.`);
    console.error(`Complete it or run \`just task-reset ${currentTask.task_id}\` first.`);
    logClaimBlocked(currentTask.task_id, 'just prompt --accept', 'Already has claimed task');
    return { ok: false, currentTask };
  }
  return { ok: true, currentTask: null };
}

function checkStoryFilterGuard(graph: TaskGraph): boolean {
  const storyFilter = process.env.WORKTREE_STORY;
  if (storyFilter) {
    const ready = computeReadyTasks(graph);
    const storyTasks = ready.filter((t) => t.story === storyFilter);
    if (storyTasks.length === 0) {
      console.error(`No ready tasks for story ${storyFilter}.`);
      console.error('All tasks for this story may be complete or blocked.');
      logClaimBlocked(null, 'just prompt --accept', `No tasks available for story ${storyFilter}`);
      return false;
    }
  }
  return true;
}

// =============================================================================
// Pre-Claim Remote Verification
// =============================================================================

interface RemoteVerificationResult {
  ok: boolean;
  reason?: string;
  warning?: string;
}

function verifyTaskAvailableOnRemote(taskId: string): RemoteVerificationResult {
  if (skipRemoteCheck) {
    return { ok: true, warning: 'Remote check skipped (--skip-remote-check)' };
  }

  // Try to fetch the latest from origin/main
  try {
    execSync('git fetch origin main --quiet', { encoding: 'utf8', stdio: 'pipe' });
  } catch (err: any) {
    // Network failure or no remote - warn but allow claim
    const message = err.message || 'Unknown error';
    if (message.includes('Could not resolve host') || message.includes('Network is unreachable')) {
      return { ok: true, warning: 'Could not reach remote (offline mode). Proceeding with claim.' };
    }
    if (message.includes("'origin'") || message.includes('does not appear to be a git repository')) {
      return { ok: true, warning: 'No remote "origin" configured. Proceeding with claim.' };
    }
    // Other fetch errors - warn but proceed
    return { ok: true, warning: `Failed to fetch remote: ${message}. Proceeding with claim.` };
  }

  // Try to read task-graph.yaml from origin/main
  let remoteYaml: string;
  try {
    remoteYaml = execSync('git show origin/main:task-graph.yaml', { encoding: 'utf8', stdio: 'pipe' });
  } catch (err: any) {
    // File doesn't exist on main - warn but allow
    return { ok: true, warning: 'task-graph.yaml not found on origin/main. Proceeding with claim.' };
  }

  // Parse the remote YAML
  let remoteGraph: TaskGraph;
  try {
    remoteGraph = load(remoteYaml) as TaskGraph;
  } catch {
    return { ok: true, warning: 'Failed to parse remote task-graph.yaml. Proceeding with claim.' };
  }

  // Find the task on remote
  const remoteTask = remoteGraph.nodes.find((t) => t.id === taskId);
  if (!remoteTask) {
    // Task doesn't exist on main - likely a new task added locally, allow claim
    return { ok: true };
  }

  // Check if task is already claimed or complete on remote
  if (remoteTask.status === 'in-progress') {
    const claimedBy = remoteTask.claimed_by ? ` by ${remoteTask.claimed_by}` : '';
    return {
      ok: false,
      reason: `Task ${taskId} is already in-progress on origin/main${claimedBy}. Run \`git pull origin main\` to sync.`,
    };
  }
  if (remoteTask.status === 'complete') {
    return {
      ok: false,
      reason: `Task ${taskId} is already complete on origin/main. Run \`git pull origin main\` to sync.`,
    };
  }

  // Task is available
  return { ok: true };
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

${task.description?.trim() || ''}
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
// Task Preview (Read-Only)
// =============================================================================

function previewNextTask(): void {
  if (isLinkedWorktree()) {
    printWorktreeWarning();
  }

  const graph = loadTaskGraph();
  const task = selectNextTask(graph);

  if (!task) {
    const storyFilter = process.env.WORKTREE_STORY;
    if (storyFilter) {
      console.log(`No tasks available for story ${storyFilter}.`);
    } else {
      console.log('No tasks available. All tasks are either complete, in-progress, or blocked.');
    }
    process.exit(1);
  }

  const storyFilter = process.env.WORKTREE_STORY;

  // Log the preview
  logPreview(task.id, 'just prompt');

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  NEXT AVAILABLE TASK (preview only - not claimed)              │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`  Task:     ${task.id}`);
  console.log(`  Title:    ${task.title}`);
  console.log(`  Story:    ${task.story || '(none)'}`);
  console.log(`  Priority: P${task.priority}`);
  console.log(`  Status:   ${task.status}`);
  if (task.output) {
    console.log(`  Output:   ${task.output}`);
  }
  console.log('');
  if (task.description) {
    console.log('  Description:');
    const descLines = task.description.trim().split('\n');
    for (const line of descLines.slice(0, 5)) {
      console.log(`    ${line}`);
    }
    if (descLines.length > 5) {
      console.log(`    ... (${descLines.length - 5} more lines)`);
    }
    console.log('');
  }
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('');
  console.log('  To claim this task and get the full prompt:');
  console.log('');
  console.log(`    just prompt --accept`);
  console.log('');
  console.log('  Or claim a specific task by ID:');
  console.log('');
  console.log(`    just prompt ${task.id}`);
  console.log('');
  if (storyFilter) {
    console.log(`  (Filtered to story: ${storyFilter})`);
    console.log('');
  }
}

// =============================================================================
// Show Current Task
// =============================================================================

function showCurrentTask(): void {
  const currentTask = getCurrentTask();
  if (!currentTask) {
    console.log('No task currently claimed.');
    console.log('Run `just prompt` to see available tasks.');
    process.exit(1);
  }

  const graph = loadTaskGraph();
  const task = graph.nodes.find((t) => t.id === currentTask.task_id);

  console.log('');
  console.log('┌─────────────────────────────────────────────────────────────────┐');
  console.log('│  CURRENTLY CLAIMED TASK                                         │');
  console.log('└─────────────────────────────────────────────────────────────────┘');
  console.log('');
  console.log(`  Task:       ${currentTask.task_id}`);
  if (task) {
    console.log(`  Title:      ${task.title}`);
    console.log(`  Story:      ${task.story || '(none)'}`);
    console.log(`  Priority:   P${task.priority}`);
    if (task.output) {
      console.log(`  Output:     ${task.output}`);
    }
  }
  console.log(`  Claimed at: ${currentTask.claimed_at}`);
  if (currentTask.worktree) {
    console.log(`  Worktree:   ${currentTask.worktree}`);
  }
  console.log('');
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('');
  console.log(`  When done:  just task-complete ${currentTask.task_id}`);
  console.log(`  To reset:   just task-reset ${currentTask.task_id}`);
  console.log('');
}

// =============================================================================
// Task Claiming with File Locking
// =============================================================================

async function claimAndGeneratePrompt(specificTaskId?: string): Promise<void> {
  if (isLinkedWorktree()) {
    printWorktreeWarning();
  }

  // Run worktree alignment validation
  const alignment = validateWorktreeAlignment();
  printAlignmentWarnings(alignment);

  // Run guards
  if (!checkMainRepoGuard()) {
    process.exit(2);
  }

  const { ok: singleTaskOk } = checkSingleTaskGuard();
  if (!singleTaskOk) {
    process.exit(2);
  }

  let release: (() => Promise<void>) | null = null;

  try {
    // Acquire exclusive lock to prevent race conditions
    release = await lockfile.lock(TASK_GRAPH_PATH, {
      retries: {
        retries: 5,
        minTimeout: 100,
        maxTimeout: 1000,
      },
    });

    const graph = loadTaskGraph();

    // Check story filter guard
    if (!checkStoryFilterGuard(graph)) {
      process.exit(2);
    }

    let task: Task | null;

    if (specificTaskId) {
      // User requested a specific task
      task = findTaskById(graph, specificTaskId);
      if (!task) {
        console.error(`Error: Task '${specificTaskId}' not found in task graph.`);
        process.exit(1);
      }

      // Check for cross-story claiming
      const storyFilter = process.env.WORKTREE_STORY;
      if (storyFilter && task.story && task.story !== storyFilter) {
        console.error('');
        console.error(`⚠️  Cross-story claim warning:`);
        console.error(`   Task ${task.id} belongs to ${task.story}`);
        console.error(`   but WORKTREE_STORY is set to ${storyFilter}`);
        console.error('');
        console.error('   This may cause cross-story pollution.');
        console.error('   If intentional, unset WORKTREE_STORY or use --force.');
        console.error('');

        // Check for --force flag
        if (!args.includes('--force')) {
          logClaimBlocked(specificTaskId, 'just prompt', `Cross-story claim: task is ${task.story}, filter is ${storyFilter}`);
          process.exit(2);
        }
        console.error('   Proceeding due to --force flag...');
        console.error('');
      }

      // Check if task can be claimed
      const { claimable, reason } = isTaskClaimable(task);
      if (!claimable) {
        console.error(`Error: Cannot claim task '${specificTaskId}'.`);
        console.error(`Reason: ${reason}`);
        console.error('');
        console.error('Run `just dag-status` to see current task states.');
        logClaimBlocked(specificTaskId, 'just prompt', reason || 'Unknown');
        process.exit(2);
      }

      // Check dependencies
      if (!areDependenciesSatisfied(graph, task)) {
        const deps = getDependencies(graph, task.id);
        const incomplete = deps.filter((d) => !getCompletedTaskIds(graph).has(d));
        console.error(`Error: Cannot claim task '${specificTaskId}'.`);
        console.error(`Reason: Dependencies not satisfied: ${incomplete.join(', ')}`);
        logClaimBlocked(specificTaskId, 'just prompt', `Dependencies not met: ${incomplete.join(', ')}`);
        process.exit(2);
      }
    } else {
      // Auto-select next task
      task = selectNextTask(graph);
      if (!task) {
        console.log('No tasks available. All tasks are either complete, in-progress, or blocked.');
        process.exit(1);
      }

      // Double-check the task is still claimable (race condition guard)
      const { claimable, reason } = isTaskClaimable(task);
      if (!claimable) {
        console.error(`Error: Task '${task.id}' was claimed by another process.`);
        console.error(`Reason: ${reason}`);
        console.error('');
        console.error('Run `just prompt` to see the next available task.');
        logClaimBlocked(task.id, 'just prompt --accept', reason || 'Race condition');
        process.exit(2);
      }
    }

    // Pre-claim remote verification: check if task is still available on origin/main
    const remoteCheck = verifyTaskAvailableOnRemote(task.id);
    if (remoteCheck.warning) {
      console.error(`Warning: ${remoteCheck.warning}`);
      console.error('');
    }
    if (!remoteCheck.ok) {
      console.error(`Error: ${remoteCheck.reason}`);
      logClaimBlocked(task.id, specificTaskId ? `just prompt ${specificTaskId}` : 'just prompt --accept', remoteCheck.reason || 'Remote verification failed');
      process.exit(2);
    }

    // Claim the task
    const oldStatus = task.status;
    task.status = 'in-progress';
    task.claimed_at = new Date().toISOString();
    const worktreeName = getWorktreeName();
    if (worktreeName) {
      task.claimed_by = worktreeName;
    }

    updateMetaCounts(graph);
    saveTaskGraph(graph);

    // Track current task
    const ticketPath = (task as any).path || null;
    setCurrentTask(task, ticketPath);

    // Log the claim
    logClaimed(task.id, oldStatus, specificTaskId ? `just prompt ${specificTaskId}` : 'just prompt --accept');

    // Output success indicator before the prompt
    console.error(`✓ Claimed task: ${task.id}`);
    console.error('');

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

async function main(): Promise<void> {
  if (currentFlag) {
    // Show current task
    showCurrentTask();
  } else if (acceptFlag || taskIdArg) {
    // Claim mode: --accept flag or specific task ID
    await claimAndGeneratePrompt(taskIdArg);
  } else {
    // Preview mode: read-only, show next task without claiming
    previewNextTask();
  }
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
