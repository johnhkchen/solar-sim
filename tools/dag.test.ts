/**
 * Tests for DAG operations in dag.ts
 *
 * These tests verify edge deduplication and metadata validation
 * to prevent bugs in task-graph.yaml generation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { readFileSync, writeFileSync, existsSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';
import { execSync } from 'child_process';
import { load } from 'js-yaml';
import type { TaskGraph, Edge } from './types.ts';

const TEST_DIR = join(process.cwd(), 'test-fixtures');
const TEST_GRAPH_PATH = join(TEST_DIR, 'task-graph.yaml');
const TEST_TICKETS_DIR = join(TEST_DIR, 'docs', 'active', 'tickets');

// Helper to create a minimal task graph for testing
function createTestGraph(overrides: Partial<TaskGraph> = {}): TaskGraph {
  return {
    version: '1.0',
    last_updated: '2026-01-28',
    milestones: [],
    stories: [],
    nodes: [],
    edges: [],
    meta: {
      total_stories: 0,
      total_tasks: 0,
      total_milestones: 0,
      by_status: {},
      by_priority: {},
      by_milestone: {},
    },
    ...overrides,
  };
}

// Helper to count edge occurrences
function countEdges(edges: Edge[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const edge of edges) {
    const key = `${edge.from}→${edge.to}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return counts;
}

// Helper to find duplicate edges
function findDuplicateEdges(edges: Edge[]): string[] {
  const counts = countEdges(edges);
  const duplicates: string[] = [];
  for (const [key, count] of counts) {
    if (count > 1) {
      duplicates.push(`${key} (×${count})`);
    }
  }
  return duplicates;
}

describe('dag.ts edge deduplication', () => {
  it('should not have duplicate edges after dag-refresh', () => {
    // Load the actual task-graph.yaml
    const graphPath = join(process.cwd(), 'task-graph.yaml');
    const content = readFileSync(graphPath, 'utf8');
    const graph = load(content) as TaskGraph;

    const duplicates = findDuplicateEdges(graph.edges);

    expect(duplicates).toEqual([]);
  });

  it('should have each from→to pair appear exactly once', () => {
    const graphPath = join(process.cwd(), 'task-graph.yaml');
    const content = readFileSync(graphPath, 'utf8');
    const graph = load(content) as TaskGraph;

    const counts = countEdges(graph.edges);
    const maxCount = Math.max(...counts.values());

    expect(maxCount).toBe(1);
  });
});

describe('dag.ts meta.by_milestone validation', () => {
  it('should only reference node IDs that exist in the nodes array', () => {
    const graphPath = join(process.cwd(), 'task-graph.yaml');
    const content = readFileSync(graphPath, 'utf8');
    const graph = load(content) as TaskGraph;

    const nodeIds = new Set(graph.nodes.map(n => n.id));
    const invalidRefs: string[] = [];

    for (const [milestone, taskIds] of Object.entries(graph.meta.by_milestone)) {
      for (const taskId of taskIds) {
        if (!nodeIds.has(taskId)) {
          invalidRefs.push(`${milestone}: ${taskId}`);
        }
      }
    }

    expect(invalidRefs).toEqual([]);
  });
});

describe('dag.ts edge endpoint validation', () => {
  it('should have all edge endpoints reference existing nodes', () => {
    const graphPath = join(process.cwd(), 'task-graph.yaml');
    const content = readFileSync(graphPath, 'utf8');
    const graph = load(content) as TaskGraph;

    const nodeIds = new Set(graph.nodes.map(n => n.id));
    const invalidEdges: string[] = [];

    for (const edge of graph.edges) {
      if (!nodeIds.has(edge.from)) {
        invalidEdges.push(`Edge from non-existent node: ${edge.from}→${edge.to}`);
      }
      if (!nodeIds.has(edge.to)) {
        invalidEdges.push(`Edge to non-existent node: ${edge.from}→${edge.to}`);
      }
    }

    expect(invalidEdges).toEqual([]);
  });
});
