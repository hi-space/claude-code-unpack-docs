import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const enConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  title: 'Claude Code Deep Dive',
  description: 'A deep dive into Claude Code\'s internal architecture, reverse-engineered from the leaked source code',
  themeConfig: {
    sidebar: {
      '/deep/en/': [
        {
          text: 'Overview',
          items: [
            { text: 'The Leak', link: '/deep/en/overview/the-leak' },
            { text: 'Architecture', link: '/deep/en/overview/architecture' },
          ],
        },
        {
          text: 'System Prompt',
          items: [
            { text: 'Prompt Structure', link: '/deep/en/system-prompt/structure' },
            { text: 'Prompt Caching', link: '/deep/en/system-prompt/prompt-caching' },
            { text: 'Safety Rules', link: '/deep/en/system-prompt/safety-rules' },
            { text: 'Behavioral Directives', link: '/deep/en/system-prompt/behavioral-directives' },
          ],
        },
        {
          text: 'Tool System',
          items: [
            { text: 'Tool Catalog', link: '/deep/en/tools/' },
            { text: 'File Tools', link: '/deep/en/tools/file-tools' },
            { text: 'Execution Tools', link: '/deep/en/tools/execution-tools' },
            { text: 'Web Tools', link: '/deep/en/tools/web-tools' },
            { text: 'Agent Tools', link: '/deep/en/tools/agent-tools' },
            { text: 'Task Tools', link: '/deep/en/tools/task-tools' },
            { text: 'MCP Tools', link: '/deep/en/tools/mcp-tools' },
          ],
        },
        {
          text: 'Multi-Agent Architecture',
          items: [
            { text: 'Coordinator Mode', link: '/deep/en/agents/coordinator' },
            { text: 'Subagent Types', link: '/deep/en/agents/subagent-types' },
            { text: 'KAIROS', link: '/deep/en/agents/kairos' },
          ],
        },
        {
          text: 'Security',
          items: [
            { text: 'Permission Model', link: '/deep/en/security/permission-model' },
            { text: 'Anti-Distillation', link: '/deep/en/security/anti-distillation' },
            { text: 'Client Attestation', link: '/deep/en/security/client-attestation' },
            { text: 'Undercover Mode', link: '/deep/en/security/undercover-mode' },
          ],
        },
        {
          text: 'Memory',
          items: [
            { text: 'Self-Healing Memory', link: '/deep/en/memory/self-healing-memory' },
            { text: 'Context Budgeting', link: '/deep/en/memory/context-budgeting' },
          ],
        },
        {
          text: 'Hidden Features',
          items: [
            { text: 'Feature Flags', link: '/deep/en/hidden-features/feature-flags' },
            { text: 'Model Codenames', link: '/deep/en/hidden-features/model-codenames' },
            { text: 'Unreleased Features', link: '/deep/en/hidden-features/unreleased-features' },
          ],
        },
      ],
    },
  },
}
