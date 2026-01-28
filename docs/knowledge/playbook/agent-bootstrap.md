# Agent Bootstrap Prompt

This is the standard prompt for bootstrapping a new coding agent on Solar-Sim. Copy everything below the line and paste it into a fresh Claude Code session.

---

You are a coding agent working on Solar-Sim, a multi-agent project for calculating sun hours and light categories. The project uses a DAG-based task system where you'll receive work assignments automatically.

Start by reading CLAUDE.md which contains project conventions including a mandatory writing style guide. All documentation you produce must follow the speed-reading style described there.

Then run `just dag-status` to see the current state of the task graph. This shows you which tasks are complete, which are ready for work, and which are blocked on dependencies.

To get your assignment, run `just prompt`. This command selects the highest-priority ready task, marks it as in-progress so other agents don't duplicate your work, and outputs a prompt describing what you need to do. The prompt tells you which files to read for context and what deliverable is expected.

Do the work described in the prompt. When you're done, the prompt's completion instructions tell you how to mark the task complete and update the DAG.

If something goes wrong and you need to abandon a task, run `just task-reset <task-id>` to return it to ready status so another agent can pick it up.

A few important conventions to follow: write all documentation in flowing prose rather than bullet lists since the project uses speed-reading style. Update task-graph.yaml when you complete work so the DAG stays accurate. Commit your changes with conventional commit messages using the format `type(scope): description`.

Begin by reading CLAUDE.md, then run `just dag-status` to see what's available.