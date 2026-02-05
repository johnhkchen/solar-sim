# Solar-Sim Justfile
#
# Core commands for multi-agent development workflow.
# See CLAUDE.md for agent instructions, README.md for human overview.

set shell := ["bash", "-cu"]

# Default: show available commands
default:
    @just --list

# ============================================================================
# TOOL INSTALLATION
# ============================================================================

# Install DAG tool dependencies
install-tools:
    cd tools && npm install

# ============================================================================
# AGENT WORKFLOW COMMANDS
# ============================================================================

# Start a Ralph Loop - autonomous coding agent that pulls tasks from the DAG
# Use WORKTREE_STORY env var to filter by story (e.g., WORKTREE_STORY=S-005 just ralph)
ralph:
    @./tools/ralph.sh

# Start a Ralph Loop filtered to a specific story
ralph-story story:
    @WORKTREE_STORY={{story}} ./tools/ralph.sh

# Show Ralph loop status (heartbeat and recent log entries)
ralph-status:
    #!/usr/bin/env bash
    echo "🔄 Ralph Loop Status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    if [ -f logs/ralph.heartbeat ]; then
        hb=$(cat logs/ralph.heartbeat)
        echo "Last heartbeat: $hb"
    else
        echo "No heartbeat file found (loop not running or never started)"
    fi
    echo ""
    echo "Recent log entries:"
    if [ -f logs/ralph.jsonl ]; then
        if command -v jq >/dev/null 2>&1; then
            tail -5 logs/ralph.jsonl | jq -r '"  [\(.iteration)] \(.action): \(.outcome)"'
        else
            tail -5 logs/ralph.jsonl
        fi
    else
        echo "  (no log file found)"
    fi
    echo ""
    echo "Run 'just dag-status' to see task graph state"

# Tail Ralph logs in real-time with formatted output
ralph-logs:
    #!/usr/bin/env bash
    if [ -f logs/ralph.jsonl ]; then
        if command -v jq >/dev/null 2>&1; then
            tail -f logs/ralph.jsonl | jq -r '"[\(.timestamp)] [\(.iteration)] \(.action): \(.outcome)"'
        else
            tail -f logs/ralph.jsonl
        fi
    else
        echo "No log file found. Start the loop with 'just ralph' first."
    fi

# Preview the next available task (read-only, does not claim)
prompt *args:
    @node --experimental-strip-types tools/prompt.ts {{args}}

# Show current DAG status
dag-status:
    node --experimental-strip-types tools/dag.ts status

# Regenerate DAG from document frontmatter
dag-refresh:
    node --experimental-strip-types tools/dag.ts refresh

# ============================================================================
# TASK LIFECYCLE COMMANDS
# ============================================================================

# Mark a task as complete (runs completion guards)
task-complete id *args:
    node --experimental-strip-types tools/dag.ts task-complete {{id}} {{args}}

# Reset a task to ready (for recovery from failures)
task-reset id:
    node --experimental-strip-types tools/dag.ts task-reset {{id}}

# Show currently claimed task
prompt-current:
    @node --experimental-strip-types tools/prompt.ts --current

# View task audit log (last 20 entries)
task-audit:
    #!/usr/bin/env bash
    if [ -f logs/task-audit.jsonl ]; then
        if command -v jq >/dev/null 2>&1; then
            echo "Task Audit Log (last 20 entries):"
            echo "================================="
            tail -20 logs/task-audit.jsonl | jq -r '"[\(.timestamp)] \(.event): \(.task_id // "n/a") (\(.old_status // "?") -> \(.new_status // "?"))"'
        else
            tail -20 logs/task-audit.jsonl
        fi
    else
        echo "No audit log found. Task state changes will be logged to logs/task-audit.jsonl"
    fi

# ============================================================================
# WORKTREE COMMANDS
# ============================================================================

# Create a new worktree for parallel development
worktree-new name:
    #!/usr/bin/env bash
    set -euo pipefail

    NAME="{{name}}"
    WORKTREE_PATH="../solar-sim-${NAME}"
    BRANCH="feature/${NAME}"

    # Validate name: only alphanumeric, hyphens, and underscores
    if [[ ! "$NAME" =~ ^[a-zA-Z0-9_-]+$ ]]; then
        echo "❌ Invalid name: '$NAME'"
        echo "   Names must contain only alphanumeric characters, hyphens, and underscores."
        exit 1
    fi

    # Check if worktree already exists
    if git worktree list --porcelain | grep -q "worktree.*/solar-sim-${NAME}$"; then
        echo "❌ Worktree already exists: $WORKTREE_PATH"
        echo "   Use 'just worktree-list' to see active worktrees."
        exit 1
    fi

    echo "Creating worktree: $WORKTREE_PATH"

    # Check if branch exists; use -B to reset if it does, -b to create if it doesn't
    if git show-ref --verify --quiet "refs/heads/${BRANCH}"; then
        echo "  Branch $BRANCH exists, resetting to current HEAD..."
        git worktree add "$WORKTREE_PATH" -B "$BRANCH"
    else
        git worktree add "$WORKTREE_PATH" -b "$BRANCH"
    fi

    echo "  Branch: $BRANCH"

    # Install project dependencies in the new worktree
    if [ -f "${WORKTREE_PATH}/package.json" ]; then
        echo "  Installing project dependencies..."
        (cd "${WORKTREE_PATH}" && npm install --silent 2>/dev/null || true)
    fi

    # Install tools dependencies in the new worktree
    if [ -f "${WORKTREE_PATH}/tools/package.json" ]; then
        echo "  Installing tool dependencies..."
        (cd "${WORKTREE_PATH}/tools" && npm install --silent)
    fi

    echo "  Status: Ready"
    echo ""
    echo "To start working:"
    echo "  cd $WORKTREE_PATH"
    echo "  just prompt"

# List active worktrees with status
worktree-list:
    #!/usr/bin/env bash
    set -euo pipefail

    echo "Worktrees:"

    # Get the main worktree path (first entry in porcelain output)
    MAIN_PATH=$(git worktree list --porcelain | head -1 | cut -d' ' -f2)

    # Parse and display each worktree
    while IFS= read -r line; do
        # Extract path, commit, and branch from standard output format
        # Format: /path/to/worktree  abc1234 [branch]
        PATH_PART=$(echo "$line" | awk '{print $1}')
        BRANCH_PART=$(echo "$line" | grep -o '\[.*\]' || echo "[detached]")

        if [[ "$PATH_PART" == "$MAIN_PATH" ]]; then
            echo "  * $PATH_PART $BRANCH_PART [main worktree]"
        else
            echo "    $PATH_PART $BRANCH_PART"
        fi
    done < <(git worktree list)

    # Check for prunable worktrees
    PRUNABLE=$(git worktree list --porcelain | grep -c "^prunable" || true)
    if [[ "$PRUNABLE" -gt 0 ]]; then
        echo ""
        echo "⚠ Warning: $PRUNABLE prunable worktree(s) found."
        echo "  Run 'git worktree prune' to clean up stale entries."
    fi

# Remove a worktree (with safety checks)
worktree-remove name:
    #!/usr/bin/env bash
    set -euo pipefail

    NAME="{{name}}"
    WORKTREE_PATH="../solar-sim-${NAME}"
    BRANCH="feature/${NAME}"

    # Check if worktree exists
    if [[ ! -d "$WORKTREE_PATH" ]]; then
        echo "❌ Worktree not found: $WORKTREE_PATH"
        exit 1
    fi

    echo "Removing worktree: $WORKTREE_PATH"

    # Check for uncommitted changes
    CHANGES=$(git -C "$WORKTREE_PATH" status --porcelain 2>/dev/null || true)
    if [[ -n "$CHANGES" ]]; then
        echo "❌ Worktree has uncommitted changes:"
        echo "$CHANGES" | head -10 | sed 's/^/   /'
        COUNT=$(echo "$CHANGES" | wc -l | tr -d ' ')
        if [[ "$COUNT" -gt 10 ]]; then
            echo "   ... and $((COUNT - 10)) more"
        fi
        echo ""
        echo "Options:"
        echo "  1. Commit your changes first"
        echo "  2. Discard changes: git -C $WORKTREE_PATH checkout ."
        echo "  3. Force removal: just worktree-remove-force $NAME"
        exit 1
    fi

    # Remove the worktree
    git worktree remove "$WORKTREE_PATH"
    echo "  ✓ Worktree removed"

    # Check if branch has been merged to main
    if git branch --merged main 2>/dev/null | grep -q "feature/${NAME}$"; then
        git branch -d "$BRANCH" 2>/dev/null || true
        echo "  ✓ Branch $BRANCH deleted (was merged to main)"
    elif git show-ref --verify --quiet "refs/heads/${BRANCH}" 2>/dev/null; then
        echo "  ℹ Branch $BRANCH preserved (has unmerged commits)"
    fi

# Remove a worktree forcefully (skips safety checks)
worktree-remove-force name:
    #!/usr/bin/env bash
    set -euo pipefail

    NAME="{{name}}"
    WORKTREE_PATH="../solar-sim-${NAME}"
    BRANCH="feature/${NAME}"

    # Check if worktree exists
    if [[ ! -d "$WORKTREE_PATH" ]]; then
        echo "❌ Worktree not found: $WORKTREE_PATH"
        exit 1
    fi

    echo "Force removing worktree: $WORKTREE_PATH"

    # Force remove the worktree
    git worktree remove "$WORKTREE_PATH" --force
    echo "  ✓ Worktree removed"

    # Force delete the branch
    if git show-ref --verify --quiet "refs/heads/${BRANCH}" 2>/dev/null; then
        git branch -D "$BRANCH" 2>/dev/null || true
        echo "  ✓ Branch $BRANCH deleted"
    fi

# ============================================================================
# DEVELOPMENT COMMANDS
# ============================================================================

# Install dependencies (once SvelteKit is initialized)
install:
    #!/usr/bin/env bash
    if [ -f "package.json" ]; then
        npm install
    else
        echo "No package.json found. Run SvelteKit initialization first."
        echo "See docs/active/stories/S-004-sveltekit-scaffold.md"
        exit 1
    fi

# Start development server
dev:
    npm run dev

# Build for production
build:
    npm run build

# Run tests
test:
    npm run test

# Type check
check:
    npm run check

# ============================================================================
# DOCUMENTATION COMMANDS
# ============================================================================

# Open specification in editor
spec:
    ${EDITOR:-code} docs/specification.md

# Open roadmap
roadmap:
    ${EDITOR:-code} docs/active/ROADMAP.md

# List all stories
stories:
    @ls -la docs/active/stories/*.md 2>/dev/null || echo "No stories yet."

# List all tickets
tickets:
    @ls -la docs/active/tickets/*.md 2>/dev/null || echo "No tickets yet."

# ============================================================================
# INFRASTRUCTURE COMMANDS (Self-Hosted Deployment)
# ============================================================================

# Full infrastructure setup: download data, initialize services
infra-setup:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "☀️  Solar-Sim Infrastructure Setup"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""

    # Create .env from example if not exists
    if [ ! -f infrastructure/.env ]; then
        echo "Creating .env from example..."
        cp infrastructure/.env.example infrastructure/.env
        echo "⚠️  Edit infrastructure/.env before starting services!"
        echo ""
    fi

    # Download canopy tiles
    echo "📥 Downloading Bay Area canopy tiles..."
    ./infrastructure/scripts/download-canopy.sh
    echo ""

    # Note about Overpass initialization
    echo "ℹ️  Overpass API will initialize on first 'infra-up' (takes 4-12 hours)"
    echo "   Set OVERPASS_MODE=clone in .env after first successful run"
    echo ""
    echo "✅ Setup complete! Run 'just infra-up' to start services."

# Download Bay Area canopy tiles only
infra-download-canopy:
    ./infrastructure/scripts/download-canopy.sh

# Pre-cache climate data for Bay Area grid
infra-seed-climate:
    node infrastructure/scripts/seed-climate.js

# Start all infrastructure services
infra-up *args:
    docker compose -f infrastructure/docker/docker-compose.yml up -d {{args}}

# Start in development mode (with hot reload, exposed ports)
infra-up-dev *args:
    docker compose -f infrastructure/docker/docker-compose.yml -f infrastructure/docker/docker-compose.dev.yml up {{args}}

# Stop all services
infra-down:
    docker compose -f infrastructure/docker/docker-compose.yml down

# View logs (all services or specific service)
infra-logs *service:
    docker compose -f infrastructure/docker/docker-compose.yml logs -f {{service}}

# Show service status
infra-status:
    #!/usr/bin/env bash
    echo "☀️  Solar-Sim Infrastructure Status"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    docker compose -f infrastructure/docker/docker-compose.yml ps
    echo ""
    echo "Data volumes:"
    du -sh infrastructure/data/* 2>/dev/null || echo "  (no data yet)"

# Restart a specific service
infra-restart service:
    docker compose -f infrastructure/docker/docker-compose.yml restart {{service}}

# Build/rebuild images
infra-build *args:
    docker compose -f infrastructure/docker/docker-compose.yml build {{args}}

# Run database migrations (if needed)
infra-db-migrate:
    docker compose -f infrastructure/docker/docker-compose.yml exec postgres psql -U solar -d solar_sim -f /docker-entrypoint-initdb.d/init.sql

# Open psql shell
infra-db-shell:
    docker compose -f infrastructure/docker/docker-compose.yml exec postgres psql -U solar -d solar_sim

# Run backup
infra-backup:
    ./infrastructure/scripts/backup.sh

# Pull latest images and restart
infra-upgrade:
    #!/usr/bin/env bash
    set -euo pipefail
    echo "Pulling latest images..."
    docker compose -f infrastructure/docker/docker-compose.yml pull
    echo "Rebuilding application..."
    docker compose -f infrastructure/docker/docker-compose.yml build solar-sim
    echo "Restarting services..."
    docker compose -f infrastructure/docker/docker-compose.yml up -d
    echo "✅ Upgrade complete!"

# Clean up Docker resources (images, volumes, networks)
infra-clean:
    #!/usr/bin/env bash
    echo "⚠️  This will remove all Solar-Sim Docker resources."
    echo "   Data in infrastructure/data/ will NOT be deleted."
    read -p "Continue? [y/N] " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker compose -f infrastructure/docker/docker-compose.yml down -v --rmi local
        echo "✅ Cleanup complete."
    fi
