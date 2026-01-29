/**
 * Audit logging for Solar-Sim task management.
 *
 * Creates a forensic record of all task state transitions in logs/task-audit.jsonl.
 * This helps debug workflow issues by providing a clear history of claims,
 * completions, resets, and guard rejections.
 */

import { writeFileSync, existsSync, mkdirSync, appendFileSync } from 'fs';
import { join, dirname } from 'path';

const LOGS_DIR = join(process.cwd(), 'logs');
const AUDIT_LOG_PATH = join(LOGS_DIR, 'task-audit.jsonl');

export type AuditEvent =
  | 'claimed'
  | 'completed'
  | 'force-completed'
  | 'reset'
  | 'claim-blocked'
  | 'complete-blocked'
  | 'preview';

export interface AuditEntry {
  timestamp: string;
  event: AuditEvent;
  task_id: string | null;
  old_status: string | null;
  new_status: string | null;
  worktree: string | null;
  trigger: string;
  notes?: string;
}

function ensureLogsDir(): void {
  if (!existsSync(LOGS_DIR)) {
    mkdirSync(LOGS_DIR, { recursive: true });
  }
}

function getTimestamp(): string {
  return new Date().toISOString();
}

function getWorktreeName(): string | null {
  return process.env.WORKTREE || process.env.WORKTREE_STORY || null;
}

/**
 * Write an audit entry to the task audit log.
 */
export function logAuditEvent(
  event: AuditEvent,
  taskId: string | null,
  trigger: string,
  options: {
    oldStatus?: string | null;
    newStatus?: string | null;
    notes?: string;
  } = {}
): void {
  ensureLogsDir();

  const entry: AuditEntry = {
    timestamp: getTimestamp(),
    event,
    task_id: taskId,
    old_status: options.oldStatus ?? null,
    new_status: options.newStatus ?? null,
    worktree: getWorktreeName(),
    trigger,
    ...(options.notes && { notes: options.notes }),
  };

  const line = JSON.stringify(entry) + '\n';
  appendFileSync(AUDIT_LOG_PATH, line, 'utf8');
}

/**
 * Log a task claim event.
 */
export function logClaimed(
  taskId: string,
  oldStatus: string,
  trigger: string,
  notes?: string
): void {
  logAuditEvent('claimed', taskId, trigger, {
    oldStatus,
    newStatus: 'in-progress',
    notes,
  });
}

/**
 * Log a task completion event.
 */
export function logCompleted(
  taskId: string,
  trigger: string,
  force: boolean = false,
  notes?: string
): void {
  logAuditEvent(force ? 'force-completed' : 'completed', taskId, trigger, {
    oldStatus: 'in-progress',
    newStatus: 'complete',
    notes,
  });
}

/**
 * Log a task reset event.
 */
export function logReset(
  taskId: string,
  oldStatus: string,
  trigger: string,
  notes?: string
): void {
  logAuditEvent('reset', taskId, trigger, {
    oldStatus,
    newStatus: 'ready',
    notes,
  });
}

/**
 * Log a blocked claim attempt.
 */
export function logClaimBlocked(
  taskId: string | null,
  trigger: string,
  reason: string
): void {
  logAuditEvent('claim-blocked', taskId, trigger, {
    notes: reason,
  });
}

/**
 * Log a blocked completion attempt.
 */
export function logCompleteBlocked(
  taskId: string,
  trigger: string,
  reason: string
): void {
  logAuditEvent('complete-blocked', taskId, trigger, {
    oldStatus: 'in-progress',
    notes: reason,
  });
}

/**
 * Log a task preview (read-only prompt).
 */
export function logPreview(taskId: string, trigger: string): void {
  logAuditEvent('preview', taskId, trigger, {
    notes: 'Read-only preview, no state change',
  });
}
