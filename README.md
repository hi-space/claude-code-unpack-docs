<div align="center">

# Claude Code Under the Hood

### Claude Code 아키텍처 비공식 분석

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![VitePress](https://img.shields.io/badge/Built%20with-VitePress-646cff.svg)](https://vitepress.dev)
[![i18n](https://img.shields.io/badge/i18n-KO%20%7C%20EN-blue.svg)](#)

[English](README.en.md)

2026년 3월 31일 npm 소스맵을 통해 유출된 Claude Code의 내부 아키텍처를 분석한 비공식 기술 문서 사이트입니다.

🌐 **[사이트 바로가기](https://hi-space.github.io/claude-code-unpack-docs/)** 🌐

</div>

---

> [!NOTE]
> 이 프로젝트는 독립적인 교육 목적의 분석 프로젝트입니다. Anthropic의 소스코드를 재배포하지 않으며, Anthropic과 관련이 없습니다.

## Lite

**[hi-space.github.io/claude-code-unpack-docs/lite/](https://hi-space.github.io/claude-code-unpack-docs/lite/)**

Claude Code의 전체 구조를 빠르게 파악할 수 있는 오버뷰입니다. 시스템 프롬프트, 도구 시스템, 멀티 에이전트, 보안, 메모리 등 주요 영역을 한 눈에 훑어볼 수 있습니다.

## Deep Dive

각 컴포넌트의 내부 구현, 설계 철학, 동작 원리를 심층적으로 분석합니다. VitePress 기반으로 7개 섹션에 걸쳐 50+ 페이지로 구성되어 있습니다.

- **한국어**: [hi-space.github.io/claude-code-unpack-docs/deep/ko/](https://hi-space.github.io/claude-code-unpack-docs/deep/ko/)
- **English**: [hi-space.github.io/claude-code-unpack-docs/deep/en/](https://hi-space.github.io/claude-code-unpack-docs/deep/en/)

| 섹션 | 내용 |
|------|------|
| 아키텍처 개요 | 512K줄 TypeScript, Bun 런타임, React+Ink 터미널 UI |
| 시스템 프롬프트 | 110+ 명령의 동적 조립, 캐싱 전략, 안전 규칙 |
| 도구 시스템 | 23+ 빌트인 도구, JSON Schema, 3단계 권한 모델 |
| 멀티 에이전트 | 코디네이터 모드, 5+ 서브에이전트 유형, KAIROS 데몬 |
| 보안 | 안티 디스틸레이션, 클라이언트 인증(DRM), 언더커버 모드 |
| 메모리 | 자가 치유 메모리, 컨텍스트 예산 관리 |
| 숨겨진 기능 | 44개 피처 플래그, 모델 코드네임 |

## 프로젝트 구조

```
docs/
├── index.md                 # 랜딩 페이지
├── deep/
│   ├── ko/                  # 한국어 Deep Dive
│   └── en/                  # English Deep Dive
└── public/
    └── lite/                # Lite (standalone HTML)
```

## Quick Start

```bash
git clone https://github.com/hi-space/claude-code-unpack-docs.git
cd claude-code-unpack-docs
npm install
npm run docs:dev
```

## License

MIT
