import { defineConfig } from 'vitepress'
import { withMermaid } from 'vitepress-plugin-mermaid'
import { enConfig } from './config/en'
import { koConfig } from './config/ko'

export default withMermaid(
  defineConfig({
    base: '/claude-code-unpack-docs/',
    title: 'Claude Code Deep Dive',
    description: 'A deep dive into Claude Code\'s internal architecture, reverse-engineered from the leaked source code',

    head: [
      ['meta', { property: 'og:title', content: 'Claude Code Deep Dive' }],
      ['meta', { property: 'og:description', content: 'A deep dive into Claude Code\'s internal architecture, reverse-engineered from the leaked source code' }],
      ['meta', { property: 'og:type', content: 'website' }],
      ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
    ],

    locales: {
      'deep/ko': {
        label: '한국어',
        lang: 'ko',
        ...koConfig,
      },
      'deep/en': {
        label: 'English',
        lang: 'en',
        ...enConfig,
      },
    },

    themeConfig: {
      nav: [],
      search: {
        provider: 'local',
      },
      socialLinks: [
        { icon: 'github', link: 'https://github.com/hi-space/claude-code-unpack-docs' },
      ],
    },

    mermaid: {
      theme: 'neutral',
    },
  })
)
