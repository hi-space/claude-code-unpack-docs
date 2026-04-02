# The Leak

## What Happened

On March 31, 2026, security researcher **Chaofan Shou** ([@Fried_rice](https://twitter.com/Fried_rice)) discovered at 4:23 AM ET that version **2.1.88** of the `@anthropic-ai/claude-code` npm package contained a **59.8 MB JavaScript source map file** (`.map`).

This source map pointed to an unobfuscated zip archive hosted on Anthropic's Cloudflare R2 bucket, exposing approximately **512,000 lines of TypeScript** across roughly **1,900 files**. The complete source code of Claude Code was exposed.

## How It Happened

The root cause was a combination of two factors:

1. **Bun's default behavior**: Claude Code is compiled and bundled using [Bun](https://bun.sh/), which generates source maps by default during the bundling process.

2. **Missing `.npmignore` entry**: The `.npmignore` file did not exclude the generated `.map` file, allowing it to be included in the published npm package.

```
@anthropic-ai/claude-code@2.1.88
├── cli.mjs           (bundled JavaScript)
├── cli.mjs.map       (59.8 MB source map ← the leak)
└── package.json
```

The source map contained mappings back to the original TypeScript source files, effectively making the entire codebase readable.

## Scale of the Leak

| Metric | Value |
|--------|-------|
| Package version | `@anthropic-ai/claude-code@2.1.88` |
| Source map size | 59.8 MB |
| TypeScript files | ~1,900 |
| Lines of code | ~512,000 |
| Discovery time | March 31, 2026, 4:23 AM ET |
| Time to 50K GitHub stars | ~2 hours (fastest in history) |

## Community Response

The leak triggered an unprecedented response in the open-source community:

- Multiple analysis repositories were created within hours
- The repository documenting the leak became the **fastest GitHub repository to reach 50,000 stars** in history, achieving the milestone in approximately 2 hours
- Anthropic responded by removing the affected package version, stating it was human error rather than a security breach
- Several DMCA takedown requests were filed against repositories that directly hosted the source code (as opposed to analysis/commentary)

## What Was Revealed

The leaked source revealed several previously unknown aspects of Claude Code:

- **44 feature flags** controlling unreleased capabilities
- **KAIROS**: a fully implemented autonomous daemon mode
- **Anti-distillation mechanisms** including fake tool injection
- **Client attestation (DRM)** implemented at the Zig/Bun HTTP transport layer
- **Internal model codenames**: Capybara, Fennec, Numbat, Tengu
- **Three-layer self-healing memory** architecture
- The complete **system prompt** structure with 110+ instructions

Each of these findings is analyzed in detail in the subsequent sections of this documentation.
