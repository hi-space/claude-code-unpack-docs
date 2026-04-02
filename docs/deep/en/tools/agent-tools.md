# Agent Tools

## Agent

Launches specialized subagent processes to handle complex tasks autonomously. This is the core of Claude Code's [multi-agent architecture](../agents/coordinator.md).

| Property | Value |
|----------|-------|
| Purpose | Spawn subagent for complex/parallel tasks |
| Types | 5+ specialized agent types |
| Concurrency | Multiple agents can run in parallel |
| Isolation | Optional `worktree` mode for git isolation |
| Communication | `SendMessage` to continue running agents |

### Subagent Types

| Type | Purpose | Tools Available |
|------|---------|----------------|
| `general-purpose` | Complex multi-step tasks | All tools |
| `Explore` | Fast codebase exploration | All except Agent, Edit, Write |
| `Plan` | Implementation planning | All except Agent, Edit, Write |
| `claude-code-guide` | Claude Code usage questions | Glob, Grep, Read, WebFetch, WebSearch |
| `statusline-setup` | Status line configuration | Read, Edit |
| `verification` (Feature-flagged: VERIFICATION_AGENT) | Code review and verification | Read, Glob, Grep, WebFetch, WebSearch |

### Key Behaviors
- Each agent starts fresh. Must provide complete task description.
- Agents can run in foreground (blocking) or background (async)
- Background agents notify on completion. No polling needed.
- `worktree` isolation creates a temporary git worktree for the agent
- Results are not visible to user. Main agent must summarize.
- Up to 3 Explore agents can run in parallel

### Prompt Guidelines
The system prompt provides detailed guidance on briefing agents:
> "Brief the agent like a smart colleague who just walked into the room. It hasn't seen this conversation, doesn't know what you've tried, doesn't understand why this task matters."

## EnterWorktree

Creates an isolated git worktree and switches the session into it for isolated development work.

### Properties

| Property | Value |
|----------|-------|
| Purpose | Create temporary isolated git worktree |
| Isolation | Complete repository copy on separate branch |
| Auto-cleanup | Worktrees cleaned up if no changes made |
| Return value | Worktree path and branch name if changes made |

### Use Cases

- User explicitly requests worktree isolation
- Experimental changes that should be isolated from main branch
- Parallel work on independent features

### Key Behaviors

- Only use when user explicitly mentions "worktree"
- Creates worktree in `.claude/worktrees/` directory
- Returns to original directory on exit
- Supports optional custom worktree name

---

## ExitWorktree

Exit a worktree session and return to the original working directory.

### Properties

| Property | Value |
|----------|-------|
| Purpose | Exit isolated worktree and restore original directory |
| Actions | `"keep"` (preserve worktree) or `"remove"` (delete worktree) |
| Safety check | Requires confirmation if uncommitted changes present |

### Use Cases

- Completing work in a worktree
- Returning to main branch after exploration
- Cleaning up temporary worktree

### Key Behaviors

- Only exits worktrees created by EnterWorktree in current session
- `action: "keep"` leaves worktree and branch intact
- `action: "remove"` deletes worktree and branch
- `discard_changes: true` required if removing worktree with uncommitted changes

---

## TeamCreate

Create a team for coordinating multiple agents working on a project together.

### Properties

| Property | Value |
|----------|-------|
| Purpose | Create team and associated task list |
| Creates | Team directory + task list directory |
| Returns | Team name and configuration |

### Use Cases

- User explicitly requests team/swarm of agents
- Complex projects requiring parallel work by multiple agents
- Coordinated multi-agent workflows

### Key Behaviors

- Creates team file at `~/.claude/teams/{team-name}/config.json`
- Creates task list at `~/.claude/tasks/{team-name}/`
- Teams have 1:1 correspondence with task lists
- Teammates automatically discover other members via team config

---

## TeamDelete

Remove team and task directories when swarm work is complete.

### Properties

| Property | Value |
|----------|-------|
| Purpose | Clean up team and task resources |
| Removes | Team directory + task directory |
| Requirement | All active teammates must be terminated first |

### Use Cases

- Completing team-based project
- Cleaning up resources after collaboration

### Key Behaviors

- Fails if team still has active members
- Removes both team and task directories
- Clears team context from current session

---

## EnterPlanMode

Enter plan mode to explore codebase and design implementation approach for user approval.

### Properties

| Property | Value |
|----------|-------|
| Purpose | Transition to planning phase for implementation |
| Duration | Until ExitPlanMode is called |
| User interaction | Requires user approval to proceed |

### When to Use

- New feature implementation with architectural decisions
- Multiple valid approaches possible
- Code modifications affecting existing behavior
- Multi-file changes
- Unclear requirements needing exploration

### When NOT to Use

- Simple single-line fixes or typos
- User has given very specific detailed instructions
- Pure research/exploration tasks

---

## ExitPlanMode

Exit plan mode after designing implementation approach, requesting user approval.

### Properties

| Property | Value |
|----------|-------|
| Purpose | Signal completion of planning and request approval |
| Reads from | Plan file specified in plan mode system message |
| Returns to | Implementation phase (if approved) |

### Key Behaviors

- Reads plan from file (parameters not needed)
- Requests user review and approval
- Do NOT use to ask "Is this plan okay?" That's what this tool does.
- Only use for implementation planning, not research tasks

---

## ToolSearch

Fetches full schema definitions for deferred tools.

| Property | Value |
|----------|-------|
| Purpose | Load lazily-defined tool schemas |
| Query modes | `select:ToolName` (exact) or keyword search |
| Output | Complete JSON Schema definitions |
| Max results | Configurable (default 5) |

### How It Works
1. Deferred tools appear by name in system reminders
2. Until fetched, only the name is known. No schema, can't invoke.
3. `ToolSearch` returns the full schema
4. Once fetched, the tool is callable like any built-in tool

### Query Forms
- `"select:Read,Edit,Grep"`: Fetch exact tools by name
- `"notebook jupyter"`: Keyword search, up to max_results
- `"+slack send"`: Require "slack" in name, rank by remaining terms
