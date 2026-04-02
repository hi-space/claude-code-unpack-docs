# Self-Healing Memory

The leaked source code reveals a three-layer memory architecture designed to prevent **context entropy**, the gradual degradation of context quality in long-running AI sessions that leads to hallucination and self-contradiction.

## The Problem

In long coding sessions, AI assistants face a fundamental challenge:

```mermaid
graph LR
    T1["Turn 1-10<br/>Full context<br/>✅ Accurate"] --> T2["Turn 10-30<br/>Context growing<br/>⚠️ Starting to forget"]
    T2 --> T3["Turn 30-60<br/>Context full<br/>❌ Hallucinating"]
    T3 --> T4["Turn 60+<br/>Context overflow<br/>💥 Contradicting itself"]

    style T1 fill:#2ecc71,color:#fff
    style T2 fill:#f1c40f,color:#000
    style T3 fill:#e67e22,color:#fff
    style T4 fill:#e74c3c,color:#fff
```

## Three-Layer Architecture

```mermaid
graph TB
    subgraph L1["Layer 1: MEMORY.md - Permanent Index"]
        direction LR
        MD["MEMORY.md file<br/>~150 chars/line<br/>Always in context"]
        MD --> P1["- Project: TS + Bun, see tsconfig.json"]
        MD --> P2["- Auth: JWT, refresh via /api/auth/refresh"]
        MD --> P3["- DB: PostgreSQL + Drizzle, migrations in db/"]
        MD --> P4["- Tests: Vitest, run npm test"]
        MD --> P5["- Deploy: GH Actions → AWS ECS"]
    end

    subgraph L2["Layer 2: ConversationCompressor"]
        direction TB
        Trigger["tokenBudgetAllocator<br/>.isOverBudget()"]
        Trigger --> Select["Select oldest N messages<br/>(skip system prompt + last 2 turns)"]
        Select --> Summarize["Send to Claude for summarization"]
        Summarize --> Replace["Replace originals with summary"]
        Replace --> Extract["Extract new facts → MEMORY.md"]
    end

    subgraph L3["Layer 3: TokenBudgetAllocator"]
        direction TB
        Budget["Total context: ~1M tokens"]
        Budget --> Sys["System prompt: ~20-25K (fixed)"]
        Budget --> Tools["Tool schemas: 14-17K (cached)"]
        Budget --> Mem["MEMORY.md: ~500-1K (fixed)"]
        Budget --> Conv["Conversation: ~950K (dynamic)"]
        Budget --> Reserve["Response reserve: ~8K"]
    end

    L3 -->|"Triggers when<br/>conv exceeds budget"| L2
    L2 -->|"Extracts facts to"| L1
    L1 -->|"Provides context for"| L2

    style L1 fill:#3498db,color:#fff
    style L2 fill:#2ecc71,color:#fff
    style L3 fill:#e67e22,color:#fff
```

## Layer 1: MEMORY.md - Implementation Deep Dive

### File Location and Loading

MEMORY.md uses a cascading search pattern to find the most relevant index for the current session. The loader checks for a project-level memory file first (highest priority), falling back to user-level memory if no project-specific index exists. This allows users to maintain both global preferences and project-specific context.

Once loaded, the memory index is injected into the system prompt's suffix, the section appended at the tail of every API request. This ensures MEMORY.md stays in context across all turns, regardless of conversation length or compaction cycles. The suffix injection pattern means the model always sees the current pointer index before generating responses.

```mermaid
graph LR
    A["Session starts"] --> B["Check project/.claude/MEMORY.md"]
    B -->|Found| C["✅ Load project memory"]
    B -->|Not found| D["Check ~/.claude/MEMORY.md"]
    D -->|Found| E["✅ Load user memory"]
    D -->|Not found| F["✅ Empty index"]
    
    C --> G["Inject into system prompt suffix"]
    E --> G
    F --> G
    
    G --> H["Every API call includes MEMORY.md"]
    
    style C fill:#2ecc71,color:#fff
    style E fill:#2ecc71,color:#fff
    style F fill:#f39c12,color:#fff
    style H fill:#3498db,color:#fff
```

### Format Constraints

MEMORY.md enforces a strict format for token efficiency:

```markdown
# MEMORY.md
## Project
- TypeScript + Bun runtime, config in tsconfig.json and bunfig.toml
- React + Ink terminal UI
- Build: `bun run build`, outputs to dist/

## Architecture
- Core loop (conversation loop)

## Conventions
- Tests: Vitest, co-located as *.test.ts, run `bun test`
- Lint: ESLint + Prettier, run `bun run lint`
- Commits: conventional commits (feat:, fix:, chore:)

## Known Issues
- API timeout on large files > 10MB, use streaming read
- CI flaky on test/integration/auth.test.ts, retry usually fixes
```

**Target**: ~150 characters per line. Each line is a **pointer** (tells the model where to find details), not a **store** (doesn't contain the details themselves).

### Why Pointers Instead of Storage?

```mermaid
graph TB
    subgraph Store["Approach A: Store everything"]
        S1["MEMORY.md (5000+ tokens)"]
        S1 --> S2["Contains full function signatures,<br/>API schemas, config details..."]
        S2 --> S3["❌ Grows unbounded<br/>❌ Stale data persists<br/>❌ Consumes context budget"]
    end

    subgraph Pointer["Approach B: Pointers (what Claude Code uses)"]
        P1["MEMORY.md (~500 tokens)"]
        P1 --> P2["Points to files, dirs, commands"]
        P2 --> P3["Model uses Read/Grep to<br/>retrieve details on demand"]
        P3 --> P4["✅ Constant size<br/>✅ Always current (reads live files)<br/>✅ Minimal context cost"]
    end

    style Store fill:#ffcccc
    style Pointer fill:#ccffcc
```

The pointer approach means MEMORY.md uses ~500-1000 tokens regardless of project size, while giving the model a map to navigate the entire codebase.

## Layer 2: ConversationCompressor - Implementation

### Compression Trigger

When the token budget allocator detects overage, the compression system enters a three-phase process. First, it identifies which messages can be safely summarized. The system **never** compresses the system prompt, MEMORY.md index, or the last 2 user-assistant turns. These form a protected tail that ensures the model always has recent context to understand ongoing work. If fewer than 4 compressible messages exist, compression is skipped (too risky to lose detail on small conversations).

The second phase summarizes the oldest batch of protected messages using Claude, generating a compact digest that preserves decision rationale, file changes, and key findings while discarding verbose tool outputs and superseded reasoning. Concurrently, the compressor extracts any new persistent facts from the conversation that should be added to MEMORY.md: discoveries about project structure, architecture, tools, or user preferences that future sessions need.

The third phase replaces the original messages with the compressed summary and the preserved tail, then returns the streamlined conversation. This single compaction cycle can reduce a 200K-token conversation to 50-100K tokens while preserving coherence.

```mermaid
graph TB
    Start["Compression triggered<br/>by budget overrun"] --> Check["Protected section check:<br/>✅ System prompt<br/>✅ MEMORY.md<br/>✅ Last 2 turns"]
    
    Check --> Count["Count compressible<br/>messages"]
    Count -->|< 4 messages| Skip["❌ Skip<br/>Too risky"]
    Count -->|>= 4 messages| Select["Select oldest batch"]
    
    Select --> Summarize["Phase 1: Summarize<br/>with Claude"]
    Select --> Extract["Phase 2: Extract new facts<br/>append to MEMORY.md"]
    
    Summarize --> Compress["Compressed digest<br/>decisions + changes"]
    Extract --> Facts["New pointers<br/>for MEMORY.md"]
    
    Compress --> Replace["Phase 3: Replace originals<br/>with summary"]
    Facts --> Replace
    
    Replace --> Result["Result: Streamlined context<br/>200K+ → 50-100K tokens"]
    Skip --> Noop["No change"]
    
    style Result fill:#2ecc71,color:#fff
    style Noop fill:#95a5a6,color:#fff
```


### Summarization Call

The compressor makes a focused API call to Claude asking it to produce a concise summary. The system prompt is carefully tuned to preserve what matters: key decisions and their reasoning, specific file modifications, blockers discovered, and user constraints. It explicitly discards noise: verbose tool outputs (file contents remain on disk), failed searches with no results, and intermediate reasoning that was superseded by later findings. This filtering keeps the summary dense and decision-focused rather than transcript-like.

The summarizer output is typically 500-1500 tokens for a 50-100K token conversation segment, a 50-100x compression ratio that maintains coherence because it's intelligently lossy.

### Fact Extraction

After generating the summary, a second API call runs in parallel to extract persistent facts. The compressor shows Claude the current MEMORY.md and the conversation, asking it to identify new patterns or discoveries that should be remembered across sessions. The facts must be formatted as short pointer lines (under 150 characters each) following the MEMORY.md convention, and the extractor deduplicates against existing entries to avoid redundant copies.

The extracted facts are appended to MEMORY.md, making them available to the next session without losing them during compaction. This creates a positive feedback loop: older sessions contribute their learned patterns to the persistent index, gradually improving the context quality for future conversations.


## Layer 3: TokenBudgetAllocator

The token budget allocator divides the model's context window (typically 1M tokens for Claude 3.5 Sonnet) into fixed and dynamic zones. The fixed zones hold system prompt instructions (~25K tokens), tool schema definitions (~17K tokens), and MEMORY.md index (~1K tokens). These are overhead that doesn't change per request.

The response reserve (8K tokens) is held back for the model's output. API errors occur if the model generates beyond its budget, so reserving this space prevents that failure mode. Everything else (approximately 950K tokens in the default allocation) forms the conversation history budget: the space available for the user's input history and the assistant's prior responses.

When the conversation history exceeds this budget, the allocator triggers compression. The compression target isn't just to get back under budget; it aims 20% below the limit to create breathing room for the next few turns. This prevents thrashing: if the allocator just barely squeezed under budget, the next turn might exceed it again, triggering another compaction immediately.

```mermaid
graph TB
    Total["Model context window<br/>~1M tokens"] 
    
    Total --> Fixed["Fixed overhead"]
    Total --> Dynamic["Dynamic"]
    
    Fixed --> SysPrompt["System prompt: 25K<br/>(instructions)"]
    Fixed --> Tools["Tool schemas: 17K<br/>(cached definitions)"]
    Fixed --> Memory["MEMORY.md: 1K<br/>(pointer index)"]
    Fixed --> Reserve["Response reserve: 8K<br/>(model output)"]
    
    Dynamic --> Budget["Conversation budget:<br/>~950K tokens"]
    
    Budget --> Monitor["Allocator monitors<br/>conversation size"]
    Monitor -->|Under budget| Continue["✅ Continue normally"]
    Monitor -->|Over budget| Calc["Calculate overage"]
    
    Calc --> Target["Compression target =<br/>overage + 20% margin"]
    Target --> Trigger["Trigger compaction"]
    Trigger --> Compress["ConversationCompressor<br/>reduces conversation"]
    
    style Continue fill:#2ecc71,color:#fff
    style SysPrompt fill:#3498db,color:#fff
    style Tools fill:#3498db,color:#fff
    style Memory fill:#3498db,color:#fff
    style Reserve fill:#e74c3c,color:#fff
    style Budget fill:#f39c12,color:#fff
```

The 20% margin is crucial for stability. If the allocator compressed only to the limit, the next turn's automatic attachments (re-injected tools, agent listings, plan files) could immediately exceed budget again. By targeting 80% of the budget, the compressor ensures at least one full turn of breathing room before the next compaction trigger.


## Self-Healing Feedback Loop

The "self-healing" aspect comes from the interaction between all three layers:

```mermaid
flowchart TB
    Session["Long session running..."] --> Detect["TokenBudgetAllocator<br/>detects overage"]
    Detect --> Compress["ConversationCompressor<br/>summarizes old messages"]
    Compress --> Extract["Extract new persistent facts"]
    Extract --> Update["Update MEMORY.md<br/>with new pointer entries"]
    Update --> Better["Next API call has:<br/>✅ Fresh compressed context<br/>✅ Updated MEMORY.md<br/>✅ Budget headroom"]
    Better --> Quality["Context quality IMPROVES<br/>rather than degrades"]
    Quality --> Session

    style Quality fill:#2ecc71,color:#fff
```

Key insight: compression doesn't just remove old context. It **upgrades** it. Verbose conversation messages (thousands of tokens) become:
1. A compact summary (hundreds of tokens)
2. New MEMORY.md entries (tens of tokens per fact)

The model loses detail but gains **structure**: organized pointers instead of raw conversation logs.

## KAIROS autoDream Integration

In the unreleased [KAIROS daemon mode](../agents/kairos.md), the `autoDream` system extends self-healing memory from **passive** (triggered by budget pressure) to **active** (triggered during idle time):

| Dimension | Current Self-Healing | KAIROS autoDream |
|-----------|---------------------|-----------------|
| **Trigger** | Context budget exceeded | Idle time threshold |
| **Input** | Conversation messages | Daily log observations |
| **Process** | Summarize + extract facts | Merge + deduplicate + crystallize |
| **Output** | Compressed messages + MEMORY.md updates | Consolidated MEMORY.md entries |
| **Timing** | Reactive (when needed) | Proactive (during downtime) |
| **Cross-session** | No | Yes (persistent daemon) |
