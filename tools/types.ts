/**
 * Type definitions for Solar-Sim DAG tooling.
 *
 * These interfaces define the structure of task-graph.yaml and document frontmatter.
 */

export type TaskStatus = 'pending' | 'ready' | 'in-progress' | 'complete' | 'blocked';
export type Complexity = 'S' | 'M' | 'L' | 'XL';

export interface Task {
  id: string;
  title: string;
  story?: string;
  milestone?: string;
  milestones?: string[];
  description: string;
  priority: number;
  complexity: Complexity;
  status: TaskStatus;
  assignee: string | null;
  output?: string | null;
  claimed_at?: string;
  claimed_by?: string;
  completed_at?: string;
}

export interface Story {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: number;
  milestone?: string | null;
  milestones?: string[];
  path: string;
}

export interface Milestone {
  id: string;
  title: string;
  description: string;
  status: string;
  tasks: string[];
  depends_on?: string[];
}

export interface Edge {
  from: string;
  to: string;
}

export interface Meta {
  total_stories: number;
  total_tasks: number;
  total_milestones: number;
  by_status: Record<string, number>;
  by_priority: Record<string, number>;
  by_milestone: Record<string, string[]>;
}

export interface TaskGraph {
  version: string;
  last_updated: string;
  milestones: Milestone[];
  stories: Story[];
  nodes: Task[];
  edges: Edge[];
  meta: Meta;
}

export interface Frontmatter {
  id: string;
  title: string;
  status: string;
  priority?: number;
  complexity?: Complexity;
  depends_on?: string[];
  blocks?: string[];
  milestones?: string[];
  assignee?: string | null;
  created?: string;
  updated?: string;
}
