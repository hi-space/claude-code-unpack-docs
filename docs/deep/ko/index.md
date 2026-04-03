---
layout: home

hero:
  name: Claude Code 내부 분석
  text: 비공식 아키텍처 딥다이브
  tagline: 유출된 소스코드 분석을 기반으로 한 Claude Code의 내부 아키텍처, 도구 시스템, 멀티 에이전트 협업, 보안 메커니즘에 대한 기술 분석.
  actions:
    - theme: brand
      text: 아키텍처 개요
      link: /deep/ko/overview/architecture
    - theme: alt
      text: Lite 버전으로 빠르게 보기
      link: https://hi-space.github.io/claude-code-under-the-hood/lite/

features:
  - icon: 🔧
    title: 43+ 빌트인 도구
    details: 파일 작업, 셸 실행, 웹 접근, 서브 에이전트 스폰, MCP 통합 등 Claude Code의 모든 도구 카탈로그.
    link: /deep/ko/tools/
  - icon: 🤖
    title: 멀티 에이전트 아키텍처
    details: 코디네이터 모드, KAIROS 데몬, 5+ 서브에이전트 유형이 프롬프트 기반 오케스트레이션을 통해 복잡한 작업을 수행하는 방식.
    link: /deep/ko/agents/coordinator
  - icon: 🛡️
    title: 안티 디스틸레이션 & DRM
    details: 가짜 도구 주입, 암호화 서명 기반 추론 요약, Bun/Zig HTTP 레벨 클라이언트 인증.
    link: /deep/ko/security/anti-distillation
  - icon: 🧠
    title: 자가 치유 메모리
    details: MEMORY.md 포인터 시스템을 사용한 3단계 메모리 아키텍처. 장시간 세션에서의 환각 방지 설계.
    link: /deep/ko/memory/self-healing-memory
  - icon: 🚩
    title: 50개 이상의 피처 플래그
    details: "약 10개 컴파일 타임 + 15+ 런타임 GrowthBook 플래그: KAIROS, 음성 모드, UltraPlan, Buddy 터미널 펫 등."
    link: /deep/ko/hidden-features/feature-flags
  - icon: 🔐
    title: 권한 & 보안 모델
    details: Sonnet 4.6 분류 모델이 자동 모드에서 모든 도구 호출을 평가하는 다단계 보안 파이프라인.
    link: /deep/ko/security/permission-model
---
