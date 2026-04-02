<div align="center">

# Claude Code Under the Hood

### The Unofficial Architecture Analysis of Claude Code

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VitePress](https://img.shields.io/badge/Built%20with-VitePress-646cff.svg)](https://vitepress.dev)
[![i18n](https://img.shields.io/badge/i18n-KO%20%7C%20EN-blue.svg)](#)

[한국어](README.md)

An unofficial technical documentation site analyzing the internal architecture of Claude Code, based on the source code leaked via npm source maps on March 31, 2026.

🌐 **[Visit the Site](https://hi-space.github.io/claude-code-under-the-hood/)** 🌐

</div>

---

> [!NOTE]
> This is an independent educational analysis project. It does not redistribute Anthropic's source code and is not affiliated with Anthropic.

## Lite

**[hi-space.github.io/claude-code-under-the-hood/lite/](https://hi-space.github.io/claude-code-under-the-hood/lite/)**

A quick overview of Claude Code's entire architecture. Covers system prompts, tool system, multi-agent orchestration, security, and memory at a glance.

## Deep Dive

In-depth analysis of each component's internal implementation, design philosophy, and mechanics. Built with VitePress, spanning 50+ pages across 7 sections.

- **English**: [hi-space.github.io/claude-code-under-the-hood/deep/en/](https://hi-space.github.io/claude-code-under-the-hood/deep/en/)
- **한국어**: [hi-space.github.io/claude-code-under-the-hood/deep/ko/](https://hi-space.github.io/claude-code-under-the-hood/deep/ko/)

| Section | Content |
|---------|---------|
| Architecture Overview | 512K lines TypeScript, Bun runtime, React+Ink terminal UI |
| System Prompt | Dynamic assembly of 110+ instructions, caching strategy, safety rules |
| Tool System | 23+ built-in tools, JSON Schema, three-layer permission model |
| Multi-Agent | Coordinator mode, 5+ subagent types, KAIROS daemon |
| Security | Anti-distillation, client attestation (DRM), undercover mode |
| Memory | Self-healing memory, context budgeting |
| Hidden Features | 44 feature flags, model codenames |

## Project Structure

```
docs/
├── index.md                 # Landing page
├── deep/
│   ├── ko/                  # Korean Deep Dive
│   └── en/                  # English Deep Dive
└── public/
    └── lite/                # Lite (standalone HTML)
```

## Quick Start

```bash
git clone https://github.com/hi-space/claude-code-under-the-hood.git
cd claude-code-under-the-hood
npm install
npm run docs:dev
```

## License

MIT
