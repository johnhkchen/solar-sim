#!/usr/bin/env bash
#
# ralph.sh - Autonomous coding loop for processing DAG tasks
#
# This script continuously pulls tasks from task-graph.yaml via `just prompt`
# and executes them through Claude Code. It runs until all tasks are complete
# or blocked, handling errors gracefully without crashing on individual failures.
#
# Logs are written to logs/ralph.jsonl in newline-delimited JSON format.
# A heartbeat timestamp is written to logs/ralph.heartbeat each iteration.
#
# Usage: just ralph
#        WORKTREE_STORY=S-005 just ralph  # Only process tasks for story S-005
#
# Environment variables:
#   WORKTREE_STORY - If set, only claim tasks belonging to this story
#                    (e.g., "S-005" for solar engine, "S-006" for location)
#
# Exit codes:
#   0 - All tasks complete or all remaining tasks blocked
#   130 - Interrupted by SIGINT (Ctrl-C)
#   143 - Interrupted by SIGTERM

set -uo pipefail

# Determine script directory and project root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
LOGS_DIR="$PROJECT_ROOT/logs"
LOG_FILE="$LOGS_DIR/ralph.jsonl"
HEARTBEAT_FILE="$LOGS_DIR/ralph.heartbeat"

# Create logs directory if it doesn't exist
mkdir -p "$LOGS_DIR"

# Track statistics for summary
iteration=0
completed=0
failed=0
start_time=$(date +%s)

# Rate limit backoff tracking
rate_limit_wait=60
rate_limit_max=600
consecutive_rate_limits=0

# Temp file for prompt content
prompt_file=$(mktemp)

# Get current ISO 8601 timestamp
get_timestamp() {
    date -u +"%Y-%m-%dT%H:%M:%SZ"
}

# Write heartbeat timestamp to file
write_heartbeat() {
    echo "$(get_timestamp)" > "$HEARTBEAT_FILE"
}

# Log entry to JSONL file
# Usage: log_entry <iteration> <task_id> <action> <duration> <exit_code> <outcome>
# Pass "null" for task_id or exit_code if not applicable
log_entry() {
    local iter="$1"
    local task_id="$2"
    local action="$3"
    local duration="$4"
    local exit_code="$5"
    local outcome="$6"
    local timestamp
    timestamp=$(get_timestamp)

    # Build JSON entry - use jq if available for proper escaping
    local json_line
    local temp_log

    if command -v jq &>/dev/null; then
        # Use jq for proper JSON construction and escaping
        json_line=$(jq -n -c \
            --arg ts "$timestamp" \
            --argjson iter "$iter" \
            --arg tid "$task_id" \
            --arg act "$action" \
            --argjson dur "$duration" \
            --arg ec "$exit_code" \
            --arg out "$outcome" \
            '{
                timestamp: $ts,
                iteration: $iter,
                task_id: (if $tid == "null" then null else $tid end),
                action: $act,
                duration_seconds: $dur,
                exit_code: (if $ec == "null" then null else ($ec | tonumber) end),
                outcome: $out
            }')
    else
        # Manual JSON construction - escape special characters in outcome
        local escaped_outcome
        escaped_outcome=$(echo "$outcome" | sed 's/\\/\\\\/g; s/"/\\"/g; s/	/\\t/g' | tr '\n' ' ')

        local task_json
        if [ "$task_id" = "null" ]; then
            task_json="null"
        else
            task_json="\"$task_id\""
        fi

        local exit_json
        if [ "$exit_code" = "null" ]; then
            exit_json="null"
        else
            exit_json="$exit_code"
        fi

        json_line="{\"timestamp\":\"$timestamp\",\"iteration\":$iter,\"task_id\":$task_json,\"action\":\"$action\",\"duration_seconds\":$duration,\"exit_code\":$exit_json,\"outcome\":\"$escaped_outcome\"}"
    fi

    # Atomic write: write to temp file then move
    temp_log=$(mktemp)
    echo "$json_line" > "$temp_log"
    cat "$temp_log" >> "$LOG_FILE"
    rm -f "$temp_log"
}

# Check for rate limit in output and handle backoff
# Returns 0 if rate limited, 1 otherwise
check_rate_limit() {
    local stderr_content="$1"

    if echo "$stderr_content" | grep -qi "rate.limit\|too.many.requests\|429"; then
        return 0
    fi
    return 1
}

# Handle rate limit backoff
handle_rate_limit() {
    consecutive_rate_limits=$((consecutive_rate_limits + 1))

    # Calculate wait time with exponential backoff
    local wait_time=$((rate_limit_wait * (2 ** (consecutive_rate_limits - 1))))
    if [ "$wait_time" -gt "$rate_limit_max" ]; then
        wait_time=$rate_limit_max
    fi

    echo "    ⏳ Rate limited - waiting ${wait_time}s before retry..."
    log_entry "$iteration" "null" "rate_limited" 0 "null" "Rate limit detected, waiting ${wait_time}s"
    sleep "$wait_time"
}

# Reset rate limit tracking after successful operation
reset_rate_limit() {
    consecutive_rate_limits=0
}

# Cleanup function
cleanup() {
    rm -f "$prompt_file"
}

# Signal handlers
handle_sigint() {
    echo ""
    echo "🛑 Interrupted by user (SIGINT)"
    log_entry "$iteration" "null" "interrupted" 0 130 "Loop interrupted by SIGINT"
    print_summary
    cleanup
    exit 130
}

handle_sigterm() {
    echo ""
    echo "🛑 Received SIGTERM"
    log_entry "$iteration" "null" "interrupted" 0 143 "Loop interrupted by SIGTERM"
    print_summary
    cleanup
    exit 143
}

# Print summary of loop execution
print_summary() {
    local end_time=$(date +%s)
    local runtime=$((end_time - start_time))
    local minutes=$((runtime / 60))
    local seconds=$((runtime % 60))

    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Ralph Loop Summary"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "   Iterations: $iteration"
    echo "   Completed:  $completed"
    echo "   Failed:     $failed"
    printf "   Runtime:    %dm %ds\n" $minutes $seconds
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
}

# Register signal handlers
trap handle_sigint SIGINT
trap handle_sigterm SIGTERM
trap cleanup EXIT

# Main header
echo "🔄 Starting Ralph Loop..."
echo "   Pulling tasks from DAG and executing via Claude Code"
if [ -n "${WORKTREE_STORY:-}" ]; then
    echo "   Story filter: $WORKTREE_STORY"
    export WORKTREE_STORY
fi
echo "   Logs: $LOG_FILE"
echo "   Heartbeat: $HEARTBEAT_FILE"
echo ""

# Log loop start
log_entry 0 "null" "loop_started" 0 "null" "Ralph loop starting"

# Main loop
while true; do
    iteration=$((iteration + 1))

    # Write heartbeat at start of each iteration
    write_heartbeat

    # Capture prompt, stderr, and exit code
    prompt_stderr=$(mktemp)
    claude_stderr=$(mktemp)
    if just prompt > "$prompt_file" 2> "$prompt_stderr"; then
        # Got a task - extract task ID from prompt for display
        task_id=$(grep -m1 "^Your task:" "$prompt_file" | sed 's/Your task: \([^ ]*\).*/\1/' || echo "unknown")
        if [ "$task_id" = "unknown" ] || [ -z "$task_id" ]; then
            # Try alternate pattern
            task_id=$(grep -m1 "Task:" "$prompt_file" | head -1 | sed 's/.*Task: \([^ ]*\).*/\1/' || echo "unknown")
        fi

        echo "[$iteration] 📋 Task: $task_id"
        echo "    → Executing via Claude..."

        # Log task started
        log_entry "$iteration" "$task_id" "started" 0 "null" "Task execution beginning"

        # Execute Claude with the prompt, capturing exit code and stderr
        task_start=$(date +%s)
        if claude --dangerously-skip-permissions < "$prompt_file" 2> "$claude_stderr"; then
            task_end=$(date +%s)
            task_duration=$((task_end - task_start))
            echo "    ✓ Complete (${task_duration}s)"
            completed=$((completed + 1))
            reset_rate_limit

            # Log task completed
            log_entry "$iteration" "$task_id" "completed" "$task_duration" 0 "Task completed successfully"
        else
            exit_code=$?
            task_end=$(date +%s)
            task_duration=$((task_end - task_start))
            claude_err=$(cat "$claude_stderr")

            # Check for rate limiting
            if check_rate_limit "$claude_err"; then
                echo "    ⚠ Rate limited (exit $exit_code, ${task_duration}s)"
                handle_rate_limit
            else
                echo "    ✗ Failed (exit $exit_code, ${task_duration}s)"
                echo "    → Task left in-progress for manual review"
                failed=$((failed + 1))
                reset_rate_limit

                # Log task failed
                log_entry "$iteration" "$task_id" "failed" "$task_duration" "$exit_code" "Task failed, left in-progress for review"
            fi
        fi

        rm -f "$prompt_stderr" "$claude_stderr"

        # Delay between iterations
        sleep 2
    else
        prompt_exit=$?
        stderr_content=$(cat "$prompt_stderr")
        rm -f "$prompt_stderr" "$claude_stderr"

        # Check the reason for no work
        if echo "$stderr_content" | grep -qi "all.*complete\|no.*tasks\|complete"; then
            echo ""
            echo "✓ All tasks complete!"
            log_entry "$iteration" "null" "finished" 0 "null" "All tasks complete"
            print_summary
            exit 0
        elif echo "$stderr_content" | grep -qi "blocked\|in.progress\|waiting"; then
            echo ""
            echo "⏸ No tasks available - remaining tasks are blocked or in progress"
            echo "  Run 'just dag-status' to see current state"
            log_entry "$iteration" "null" "blocked" 0 "null" "No tasks available - all blocked or in progress"
            print_summary
            exit 0
        else
            # Unknown reason - check if it's just that no tasks are ready
            if [ -z "$(cat "$prompt_file")" ]; then
                echo ""
                echo "⏸ No tasks available"
                echo "  Run 'just dag-status' to see current state"
                log_entry "$iteration" "null" "finished" 0 "null" "No tasks available"
                print_summary
                exit 0
            else
                # Some other error from just prompt
                echo ""
                echo "⚠ Unexpected error from 'just prompt' (exit $prompt_exit)"
                echo "  stderr: $stderr_content"
                echo "  Continuing to next iteration..."
                log_entry "$iteration" "null" "error" 0 "$prompt_exit" "Unexpected error from just prompt: $stderr_content"
                sleep 2
            fi
        fi
    fi
done
