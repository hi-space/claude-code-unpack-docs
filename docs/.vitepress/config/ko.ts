import type { DefaultTheme, LocaleSpecificConfig } from 'vitepress'

export const koConfig: LocaleSpecificConfig<DefaultTheme.Config> = {
  title: 'Claude Code Deep Dive',
  description: '유출된 소스코드를 리버스 엔지니어링하여 Claude Code의 내부 아키텍처를 심층 탐구합니다',
  themeConfig: {
    sidebar: {
      '/deep/ko/': [
        {
          text: '개요',
          items: [
            { text: '유출 경위', link: '/deep/ko/overview/the-leak' },
            { text: '아키텍처', link: '/deep/ko/overview/architecture' },
          ],
        },
        {
          text: '시스템 프롬프트',
          items: [
            { text: '프롬프트 구조', link: '/deep/ko/system-prompt/structure' },
            { text: '프롬프트 캐싱', link: '/deep/ko/system-prompt/prompt-caching' },
            { text: '안전 규칙', link: '/deep/ko/system-prompt/safety-rules' },
            { text: '행동 지시사항', link: '/deep/ko/system-prompt/behavioral-directives' },
          ],
        },
        {
          text: '도구 시스템',
          items: [
            { text: '도구 카탈로그', link: '/deep/ko/tools/' },
            { text: '파일 도구', link: '/deep/ko/tools/file-tools' },
            { text: '실행 도구', link: '/deep/ko/tools/execution-tools' },
            { text: '웹 도구', link: '/deep/ko/tools/web-tools' },
            { text: '에이전트 도구', link: '/deep/ko/tools/agent-tools' },
            { text: '작업 도구', link: '/deep/ko/tools/task-tools' },
            { text: 'MCP 도구', link: '/deep/ko/tools/mcp-tools' },
          ],
        },
        {
          text: '멀티 에이전트 아키텍처',
          items: [
            { text: '코디네이터 모드', link: '/deep/ko/agents/coordinator' },
            { text: '서브에이전트 유형', link: '/deep/ko/agents/subagent-types' },
            { text: 'KAIROS', link: '/deep/ko/agents/kairos' },
          ],
        },
        {
          text: '보안',
          items: [
            { text: '권한 모델', link: '/deep/ko/security/permission-model' },
            { text: '안티 디스틸레이션', link: '/deep/ko/security/anti-distillation' },
            { text: '클라이언트 인증', link: '/deep/ko/security/client-attestation' },
            { text: '언더커버 모드', link: '/deep/ko/security/undercover-mode' },
          ],
        },
        {
          text: '메모리',
          items: [
            { text: '자가 치유 메모리', link: '/deep/ko/memory/self-healing-memory' },
            { text: '컨텍스트 예산 관리', link: '/deep/ko/memory/context-budgeting' },
          ],
        },
        {
          text: '숨겨진 기능',
          items: [
            { text: '피처 플래그', link: '/deep/ko/hidden-features/feature-flags' },
            { text: '모델 코드네임', link: '/deep/ko/hidden-features/model-codenames' },
            { text: '미출시 기능', link: '/deep/ko/hidden-features/unreleased-features' },
          ],
        },
      ],
    },
  },
}
