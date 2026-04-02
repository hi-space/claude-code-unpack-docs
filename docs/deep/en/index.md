---
layout: home

hero:
  name: Claude Code Under the Hood
  text: Unofficial Architecture Deep Dive
  tagline: In-depth analysis of Claude Code's internal architecture, tool system, multi-agent coordination, and security mechanisms, based on the leaked source code.
  actions:
    - theme: brand
      text: Architecture Overview
      link: /deep/en/overview/architecture
    - theme: alt
      text: Quick Overview (Lite)
      link: https://hi-space.github.io/claude-code-under-the-hood/lite/

features:
  - icon: 🔧
    title: 23+ Built-in Tools
    details: "Complete catalog of every tool in Claude Code's arsenal: file operations, shell execution, web access, sub-agent spawning, and MCP integration."
    link: /deep/en/tools/
  - icon: 🤖
    title: Multi-Agent Architecture
    details: "How Coordinator Mode, KAIROS daemon, and 5+ subagent types orchestrate complex tasks through prompt-based orchestration."
    link: /deep/en/agents/coordinator
  - icon: 🛡️
    title: Anti-Distillation & DRM
    details: Fake tool injection, reasoning summarization with cryptographic signatures, and Bun/Zig HTTP-level client attestation.
    link: /deep/en/security/anti-distillation
  - icon: 🧠
    title: Self-Healing Memory
    details: Three-layer memory architecture with MEMORY.md pointer system designed to prevent hallucination in long-running sessions.
    link: /deep/en/memory/self-healing-memory
  - icon: 🚩
    title: 44 Feature Flags
    details: "12 compile-time and 15+ runtime flags via GrowthBook: KAIROS, Voice Mode, UltraPlan, Buddy terminal pet, and more."
    link: /deep/en/hidden-features/feature-flags
  - icon: 🔐
    title: Permission & Security Model
    details: Three-layer security architecture with a Sonnet 4.6 classifier model evaluating every tool call in auto mode.
    link: /deep/en/security/permission-model
---
