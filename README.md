# Solar-Sim

A webapp for calculating sun hours and light requirement categories for any location on Earth. Designed for gardeners, farmers, and land planners who need accurate solar exposure data without diving into complex astronomical mathematics.

---

## Quick Start for Agents

**Paste this into Claude Code to begin working:**

```
Read CLAUDE.md, then check task-graph.yaml for available work. Pick up the highest priority task with status "ready" and follow the Research-Plan-Implement pattern. Update task status as you work.
```

**For autonomous operation (Ralph Loop):**

```bash
just ralph
```

This starts a continuous loop that pulls tasks from the DAG and executes them via Claude.

**For parallel development:**

```bash
# Create isolated worktrees for concurrent agents
just worktree-new agent1
just worktree-new agent2

# Each agent works in its own directory
cd ../solar-sim-agent1 && just ralph
cd ../solar-sim-agent2 && just ralph
```

See `CLAUDE.md` for detailed agent instructions.

---

## Purpose

Determining optimal planting locations requires understanding how sunlight interacts with a specific plot of land throughout the year. This involves:

- Solar position calculations (altitude, azimuth) based on latitude, longitude, date, and time
- Accounting for Earth's axial tilt and orbital dynamics
- Translating raw sun-hours into practical categories (full sun, partial shade, full shade)
- Visualizing shadow patterns and exposure windows

Solar-Sim handles this complexity, providing actionable insights for real-world growing decisions.

## Technology

- **Framework**: SvelteKit
- **Deployment**: Cloudflare Workers
- **Approach**: Client-heavy computation with edge deployment for low-latency responses

## Project Structure

```
solar-sim/
├── README.md                     # This file
├── task-graph.yaml               # DAG of implementation tasks
│
├── docs/
│   ├── specification.md          # Living project specification
│   ├── happy_path.md             # Core use case & demo experience
│   │
│   ├── active/
│   │   ├── ROADMAP.md            # Development dashboard
│   │   ├── stories/              # Feature requests (S-NNN-title.md)
│   │   └── tickets/              # Decomposed tasks for agents
│   │
│   ├── archive/
│   │   ├── stories/              # Completed stories
│   │   └── tickets/              # Completed tickets
│   │
│   └── knowledge/
│       ├── requirements/         # Product requirement documents
│       └── research/             # Technical research & findings
│
├── tools/                        # Task graph parser, workflow helpers
│
└── src/                          # SvelteKit application source
```

## Development Workflow

This project uses a multi-agent development workflow with autonomous coding agents.

### Core Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                        RALPH LOOP                               │
│                                                                 │
│   ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐    │
│   │  just   │───▶│  Parse  │───▶│  Claude │───▶│ Update  │──┐ │
│   │ prompt  │    │   DAG   │    │ Execute │    │  Status │  │ │
│   └─────────┘    └─────────┘    └─────────┘    └─────────┘  │ │
│        ▲                                                     │ │
│        └─────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Workflow Phases

1. **Specification Phase**: `specification.md` and `happy_path.md` define the project vision
2. **Research Phase**: Concurrent agents populate `docs/knowledge/` with findings
3. **Story Creation**: Features are documented in `docs/active/stories/`
4. **Ticket Decomposition**: Stories break down into actionable tickets
5. **Task Graph**: `task-graph.yaml` defines a DAG of prioritized work
6. **Agent Execution**: Coding agents pull from the task graph and implement
7. **Archival**: Completed work moves to `docs/archive/`

### Key Commands

```bash
just ralph          # Start autonomous agent loop
just prompt         # Get next task (used by ralph internally)
just dag-status     # View current task graph state
just dag-refresh    # Regenerate DAG from doc frontmatter

just worktree-new <name>   # Create worktree for parallel agent
just worktree-list         # Show active worktrees
```

### Parallel Development with Git Worktrees

Multiple agents can work concurrently using Git worktrees. Each worktree is an independent working directory with its own branch, sharing Git history with the main repo.

```bash
# Main repo at ./solar-sim
# Agent worktrees at ../solar-sim-{name}

just worktree-new alpha    # Creates ../solar-sim-alpha
just worktree-new beta     # Creates ../solar-sim-beta
```

Agents coordinate via:
- `task-graph.yaml` - Work assignment and dependencies
- Separate branches - Avoid merge conflicts
- `ROADMAP.md` - Progress visibility

The `ROADMAP.md` provides a human-readable dashboard of progress, while `task-graph.yaml` serves as the machine-readable work queue.

## Documentation

| Document | Purpose |
|----------|---------|
| `docs/specification.md` | Living technical specification (evolves with findings) |
| `docs/happy_path.md` | The 5-minute demo experience we're building toward |
| `docs/knowledge/requirements/` | Hardened PRDs that anchor the specification |
| `docs/active/ROADMAP.md` | Current state and planned work |

## Status

**Phase**: Foundation & Tooling

Building the multi-agent workflow infrastructure before application implementation:

| Story | Description | Status |
|-------|-------------|--------|
| S-001 | Ralph Loop integration | Research |
| S-002 | DAG parsing & prompt generation | Research |
| S-003 | Git worktree workflow | Research |
| S-004 | SvelteKit project scaffolding | Pending |

## Prerequisites

- [just](https://github.com/casey/just) - Command runner
- [Claude Code](https://claude.ai/code) - AI coding assistant
- [Ralph](https://github.com/snarktank/ralph) - Autonomous loop runner (optional, for `just ralph`)
- Node.js 18+ (once SvelteKit is initialized)
