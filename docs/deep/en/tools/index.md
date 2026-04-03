# Tool System Overview

Claude Code's tool system is the backbone of its coding capabilities. The leaked source reveals **43+ built-in tools**, each defined with a JSON Schema. Tool definitions consume **14-17K tokens** per API request. This is the single largest component of the system prompt.

## Tool Registration Architecture

The Claude Code system maintains a centralized registry of all available tools. Each tool is defined with metadata including its name, description, parameter schema, execution function, and whether it uses deferred loading. The registry distinguishes between two categories of tools:

**Eager-loaded tools** are included in every API request to Claude. These are the most frequently-used tools like Read, Write, Edit, Bash, and Grep. Their combined schema size (14-17K tokens) represents the single largest component of the system prompt.

**Deferred tools** are loaded on-demand via the ToolSearch tool. These include less-frequently-used tools like TodoWrite, AskUserQuestion, and ExitPlanMode. By deferring their schemas, Claude Code saves 3-5K tokens in every request, only paying the cost when the model specifically needs them.

Each tool definition encapsulates the complete interface: a JSON Schema for parameter validation, an async execute function that implements the tool's behavior, and permission metadata (read, write, execute, or network) that controls which permission layer evaluates the tool.

```mermaid
graph LR
    A["Tool Registration<br/>(name, schema, execute)"] --> B["Eager Load?"]
    B -->|"Yes"| C["Included in<br/>API Request<br/>14-17K tokens"]
    B -->|"No"| D["Deferred Load<br/>Via ToolSearch"]
    D --> E["Loaded on<br/>First Use"]
    E --> C
    
    style C fill:#c8e6c9
    style D fill:#fff9c4
```

## Tool Dispatch Pipeline

When the model returns a tool call, it flows through a multi-stage pipeline:

```mermaid
flowchart TB
    ModelResponse["Model response:<br/>tool_use { name, input }"] --> Parse["1. Parse tool call<br/>Extract name + params"]

    Parse --> SchemaLookup["2. Schema lookup<br/>registry.get(toolName)"]
    SchemaLookup --> NotFound{"Tool found?"}
    NotFound -->|"No"| Error1["Return error:<br/>'Unknown tool'"]
    NotFound -->|"Yes"| Validate

    Validate["3. Schema validation<br/>schemaValidator.validate(<br/>  tool.parameters,<br/>  input<br/>)"] --> Valid{"Valid?"}
    Valid -->|"No"| Error2["Return error:<br/>validation details"]
    Valid -->|"Yes"| PermCheck

    PermCheck["4. Permission check<br/>permissionChecker.check(<br/>  toolCall,<br/>  permissionMode<br/>)"] --> PermResult{"Permission?"}

    PermResult -->|"Auto-allow<br/>(Layer 1/2)"| Execute
    PermResult -->|"Classify<br/>(Layer 3)"| Classifier["toolUseClassifier<br/>.classify(toolCall)"]
    PermResult -->|"Always deny"| Deny["Return denial"]

    Classifier -->|"safe"| Execute
    Classifier -->|"risky"| AskUser["Display PermissionPrompt<br/>Wait for user response"]
    AskUser -->|"approved"| Execute
    AskUser -->|"denied"| Deny

    Execute["5. Execute tool<br/>tool.execute(validatedParams)"] --> Sandbox{"Needs sandbox?"}
    Sandbox -->|"Bash tool"| SB["BashSandbox<br/>createSandboxedProcess()"]
    Sandbox -->|"Other tools"| Direct["Direct execution"]

    SB --> Result["6. Tool result"]
    Direct --> Result

    Result --> Format["7. Format result<br/>Truncate if > limit<br/>Add to conversation"]

    style Classifier fill:#f0e68c
    style SB fill:#ffcccc
```

### Parallel vs Sequential Dispatch

When Claude makes multiple tool calls in a single response, Claude Code automatically optimizes execution order to maximize parallelism while respecting dependencies. The dispatcher analyzes the tool call parameters to detect when one tool's result is referenced by another (e.g., a tool that takes the output of a previous tool as input).

**Independent tool calls** are executed concurrently using `Promise.all()`. For example, reading two unrelated files, or searching across three separate directories can all happen in parallel. This significantly reduces total execution time.

**Dependent tool calls** are executed sequentially. When tool B requires the result from tool A, the dispatcher waits for A to complete before invoking B. This is detected through parameter analysis. If tool B's parameters reference a result placeholder from tool A, they're treated as dependent.

The dispatcher returns results in the same order as the original tool calls from Claude, preserving the model's expected ordering even though some completed out-of-order.

```mermaid
sequenceDiagram
    participant Model as Claude Model
    participant Dispatcher as Tool Dispatcher
    participant ToolA as Tool A
    participant ToolB as Tool B
    participant ToolC as Tool C
    
    Model->>Dispatcher: [ToolA(), ToolB(uses ToolA), ToolC()]
    
    par Independent Execution
        Dispatcher->>ToolA: Execute (independent)
        Dispatcher->>ToolC: Execute (independent)
    and Waiting
        Note over Dispatcher: ToolB is dependent<br/>on ToolA result
    end
    
    ToolA-->>Dispatcher: Result A
    ToolC-->>Dispatcher: Result C
    
    Dispatcher->>ToolB: Execute (now has ToolA result)
    ToolB-->>Dispatcher: Result B
    
    Dispatcher-->>Model: [Result A, Result B, Result C]
```

## Complete Tool Catalog

### File Tools

| Tool | Key Implementation Detail |
|------|---------------------------|
| **Read** | Returns output in `cat -n` format with line numbers. Supports reading images as base64 for multimodal input. PDF reading limited to 20 pages per call. Large files support `offset`/`limit` parameters for partial reads. |
| **Write** | **Requires prior Read**: tracks files to prevent accidental overwrites. If a file hasn't been read first and already exists, an error is returned. |
| **Edit** | Uses exact string matching (not regex). If multiple matches exist for `old_string`, returns error listing all positions. `replace_all` flag allows replacing all occurrences at once. |
| **Glob** | Pure path matching without file content reading. Results sorted by modification time (most recently modified first). |
| **Grep** | Content search using ripgrep. Three output modes: `files_with_matches` (default, paths only), `content` (matching lines with context), `count` (match counts per file). Default limit: 250 results. |

### Code Intelligence Tools

| Tool | File | Key Implementation Detail |
|------|------|---------------------------|
| **LSP** | `lsp.ts` | Language Server Protocol integration for code intelligence: go-to-definition, find-references, hover, diagnostics, workspace symbols, implementations, call hierarchy. Requires LSP server configured for file type. |

### Execution Tools

| Tool | Key Implementation Detail |
|------|---------------------------|
| **Bash** | Executes in an isolated sandbox. Working directory persists between calls (stored in session state), but shell environment resets. Timeout: 120s default, 600s max. `run_in_background` flag spawns a detached process and returns immediately. |
| **PowerShell** | Windows-equivalent execution tool with the same security model as Bash. Detects PowerShell version (5.1 vs 7+) and provides appropriate syntax guidance. |
| **Sleep** (Feature-flagged: PROACTIVE/KAIROS) | Waits for specified duration. Preferred over Bash sleep as it doesn't hold a shell process. Can run concurrently with other tools and is user-interruptible. |
| **NotebookEdit** | Edits Jupyter notebooks at the cell level. Operations: insert, replace, or delete cells. Preserves notebook metadata and output cells. |

### Bash Sandbox Implementation

The Bash tool executes shell commands in an isolated sandbox environment. This sandbox provides multiple layers of protection: filesystem restrictions keep commands confined to the project workspace, environment variables are carefully controlled, and command execution is monitored for security violations.

**Working directory persistence** is a key feature. Each session maintains a persistent working directory that is preserved across multiple bash calls. When you run `cd /home/project` in one bash call, subsequent calls in the same session start in that directory. However, the shell environment itself resets between calls. Environment variables don't automatically persist (though commands can export them if needed).

**Timeout handling** is critical for user experience. By default, bash commands have a 120-second timeout, with a maximum limit of 600 seconds. This prevents runaway commands from blocking the session indefinitely. Background execution is supported via the `run_in_background` parameter, which spawns a detached process and returns immediately with a process ID. Notifications are sent when background tasks complete.

**Output handling** ensures that extremely verbose commands don't consume excessive tokens. Tool results are truncated if they exceed the configured limit. Additionally, the sandbox captures both stdout and stderr, combines them, and returns the result to Claude along with the exit code.

```mermaid
flowchart LR
    A["Command<br/>with options"] --> B["Spawn process<br/>via runtime"]
    B --> C{"run_in_background?"}
    
    C -->|"Yes"| D["Return immediately<br/>with process ID"]
    D --> E["Process runs<br/>in background"]
    E --> F["Notification<br/>sent on completion"]
    
    C -->|"No"| G["Wait for<br/>process exit"]
    G --> H["Capture stdout<br/>& stderr"]
    H --> I{"Output<br/>too large?"}
    I -->|"Yes"| J["Truncate<br/>output"]
    I -->|"No"| K["Return result"]
    J --> K
    
    style D fill:#fff9c4
    style K fill:#c8e6c9
```

**Security validation** occurs before execution. The sandbox analyzes commands for dangerous patterns (like `rm -rf`, formatting operations) and checks against permission rules. Commands that attempt to escape the workspace or access restricted paths are blocked. Permission modes can escalate this: "auto" mode allows whitelisted commands, "plan" mode requires explicit user approval, and "bypass" mode disables checks entirely for trusted contexts.

### Web Tools

| Tool | Key Implementation Detail |
|------|---------------------------|
| **WebSearch** | Returns search results with title, URL, and snippet. Includes prompt injection detection: results are flagged if suspicious content patterns are identified. |
| **WebFetch** | Fetches URL and extracts readable content (HTML converted to text). Results checked for prompt injection before inclusion in conversation. Supports truncation for large pages. |

### Task & Coordination Tools

| Tool | Key Implementation Detail |
|------|---------------------------|
| **TaskOutput** | Reads output from running or completed tasks. Supports blocking (wait for completion) or non-blocking (poll status). Deprecated in favor of directly reading the task output file. |
| **CronCreate** (Feature-flagged: AGENT_TRIGGERS) | Schedule prompts to run at future times. Uses 5-field cron syntax in local timezone. Supports durable (persistent across sessions) or session-only scheduling. |
| **CronDelete** (Feature-flagged: AGENT_TRIGGERS) | Cancel scheduled cron jobs by ID. Removes from persistent storage or session store. |
| **CronList** (Feature-flagged: AGENT_TRIGGERS) | List all scheduled cron jobs with execution and next-run details. |
| **AskUserQuestion** | Gather information from users via multiple choice questions. Supports multiselect, custom text input ("Other" option), and optional visual previews for comparisons. |
| **SendMessage** | Send messages to teammates or broadcast to all. Messages auto-deliver on receiver's next tool round. Supports legacy protocol responses for plan approval workflows. |

### Agent & Worktree Tools

| Tool | Key Implementation Detail |
|------|---------------------------|
| **Agent** | Spawns specialized subagent with tool restrictions based on `subagent_type`. `isolation: "worktree"` creates an isolated git worktree for filesystem isolation. `run_in_background` enables async execution with notifications on completion. |
| **EnterWorktree** | Create isolated git worktree for experimental work. Creates worktree in `.claude/worktrees/` with new branch. Only use when user explicitly requests worktree mode. |
| **ExitWorktree** | Exit worktree and return to original directory. Actions: `"keep"` (preserve worktree and branch) or `"remove"` (delete). Requires confirmation if uncommitted changes exist. |
| **TeamCreate** (Feature-flagged: Agent Swarms) | Create team for coordinating multiple agents working together. Creates team config and associated task list (1:1 correspondence). |
| **TeamDelete** (Feature-flagged: Agent Swarms) | Remove team and task resources when collaboration is complete. Fails if active teammates remain. |
| **EnterPlanMode** | Transition to planning phase to explore codebase and design implementation approach for user approval before proceeding. |
| **ExitPlanMode** | Exit plan mode after finalizing implementation plan. Requests user review and approval before execution continues. |
| **ToolSearch** | Fetch deferred tool schemas on-demand. Supports exact lookup (`select:Name`) and fuzzy keyword search. Returns complete JSON Schema definitions. |

### Agent Spawning Internals

Agent spawning is Claude Code's mechanism for parallel, specialized work. When you invoke the Agent tool, Claude Code launches a new instance of the query engine with its own system prompt, tool set, and execution context. This enables sophisticated multi-agent workflows where different agents can specialize in different tasks (exploration, architecture, writing, etc.) while maintaining isolation and control.

**Agent type determines capability scope.** When spawning an agent, you specify a `subagent_type` (e.g., "explore", "architect", "writer"). Each type has a predefined set of allowed tools and a customized system prompt. For example, the Explore agent has access to Read, Grep, Glob, and Bash (for safe commands), but NOT Edit, Write, or Agent tools. This prevents accidental modifications or runaway sub-agent spawning. This design ensures agents stay within their domain of responsibility.

**Isolation modes** control workspace visibility. By default, agents inherit the parent's working directory and can see all files. With `isolation: "worktree"`, Claude Code creates a temporary git worktree. This is a complete copy of the repository on a separate branch. The agent works in isolation; changes don't affect the main branch until explicitly merged. This is invaluable for exploratory tasks or risky operations.

**Background execution** enables parent agents to delegate work without blocking. When `run_in_background: true`, the agent spawns asynchronously and returns immediately with an agent ID. The parent receives notifications when the agent completes. This unlocks workflows where one agent spawns multiple workers, collects their results, and synthesizes them. All of this happens within a single parent session.

```mermaid
graph TB
    A["Agent Tool Called<br/>subagent_type: explore"] --> B["Load Agent Config<br/>& Tool Restrictions"]
    
    B --> C{"Isolation<br/>mode?"}
    C -->|"worktree"| D["Create git worktree<br/>Isolated repo copy"]
    C -->|"none"| E["Use parent<br/>working directory"]
    
    D --> F["Spawn new<br/>QueryEngine"]
    E --> F
    
    F --> G{"run_in_background?"}
    G -->|"Yes"| H["Spawn async<br/>Return agent ID"]
    G -->|"No"| I["Run synchronously<br/>Wait for result"]
    
    H --> J["Parent continues<br/>Agent runs in background"]
    I --> K["Parent waits<br/>Agent blocks execution"]
    
    J --> L["Notification<br/>on completion"]
    K --> L
    
    style D fill:#ffcccc
    style H fill:#fff9c4
    style I fill:#c8e6c9
```

**System prompt customization** is key to agent specialization. Each agent type receives a customized system prompt that emphasizes its domain. Explore agents focus on discovery and diagnosis, architects on design decisions, writers on content quality. This prompt engineering, combined with tool restrictions, shapes agent behavior without needing explicit instructions in the parent's query.

**Parent-child relationships** are tracked. Spawned agents know their parent's ID, enabling bi-directional communication (parent can send messages, agent can notify parent). This relationship is essential for background agents that need to report results back to their parent and for coordinator modes that orchestrate large multi-agent workflows.


### Task Tools

| Tool | Key Implementation Detail |
|------|---------------------------|
| **TodoWrite** | Manages user-visible task list with states: `pending`, `in_progress`, `completed`. Enforces invariant: exactly one task in progress at a time. Each task has two forms: `content` (imperative action) and `activeForm` (present continuous description). |
| **Skill** | Executes pre-built workflows stored in the skill registry. Each skill is a complete implementation of a complex procedure (e.g., git commit protocol with all validation and hooks). Triggered via `/skill-name` or contextual pattern detection. |

### MCP Tools

| Tool | Key Implementation Detail |
|------|---------------------------|
| **MCP Bridge** | Forwards tool calls to connected MCP servers via the Model Context Protocol. Tool schemas loaded dynamically when servers connect. Placed in **session suffix** (not cached prefix) because tool lists change with server connections, which would break prompt caching. |

## Tool Schema Size Analysis

Why do tool definitions consume 14-17K tokens?

```
Tool Schema Token Breakdown (approximate):
├── Read:           ~800 tokens  (complex params: file_path, offset, limit, pages)
├── Write:          ~400 tokens
├── Edit:           ~600 tokens  (detailed replacement semantics)
├── Bash:           ~1,200 tokens (extensive usage notes, safety rules)
├── Grep:           ~900 tokens  (many params: pattern, glob, type, output_mode, context)
├── Glob:           ~300 tokens
├── Agent:          ~2,000 tokens (5 agent types, all params, detailed briefing guide)
├── TodoWrite:      ~1,500 tokens (complex state machine, when to use / when not to)
├── AskUserQuestion: ~800 tokens (option schema, multiselect, preview)
├── Skill:          ~300 tokens
├── ToolSearch:     ~400 tokens
├── WebSearch:      ~200 tokens
├── WebFetch:       ~200 tokens
├── NotebookEdit:   ~400 tokens
├── ExitPlanMode:   ~400 tokens
├── Other tools:    ~2,500 tokens
└── TOTAL:          ~12,000-14,000 tokens (tool definitions only)
    + Usage instructions in system prompt: ~3,000 tokens
    = ~14,000-17,000 tokens total tool-related content
```

The `Agent` and `TodoWrite` tools are the most token-expensive because they include extensive behavioral guidance in their descriptions. Not just schema, but instructions on when and how to use them effectively.

## Deferred Tool Loading Pattern

Not all tools have their schemas loaded upfront. Some use a lazy-loading pattern to reduce initial token cost:

```mermaid
sequenceDiagram
    participant SP as System Prompt
    participant Model as Claude Model
    participant TS as ToolSearch
    participant Registry as Tool Registry

    Note over SP: System reminder mentions:<br/>"AskUserQuestion, ExitPlanMode,<br/>TodoWrite available via ToolSearch"

    Model->>Model: Needs to use TodoWrite
    Model->>TS: ToolSearch({ query: "select:TodoWrite" })
    TS->>Registry: Look up deferred tool schema
    Registry-->>TS: Full JSON Schema definition
    TS-->>Model: Complete tool definition returned

    Note over Model: TodoWrite is now callable<br/>as if it were always loaded

    Model->>Model: Call TodoWrite with params
```

This pattern reduces the initial system prompt size by ~3-5K tokens for tools that are used infrequently.
