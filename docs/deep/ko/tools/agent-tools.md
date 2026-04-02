# Agent Tool

## Agent

복잡한 작업을 자율적으로 처리하기 위한 특화 Subagent 프로세스를 시작한다.

| 속성 | 값 |
|------|-----|
| 목적 | 복잡/병렬 작업을 위한 Subagent 스폰 |
| 유형 | 5+ 특화 Agent 유형 |
| 동시성 | 여러 Agent 병렬 실행 가능 |
| 격리 | 선택적 `Worktree` 모드 |
| 통신 | `SendMessage`로 실행 중인 Agent 계속 |

### Subagent 유형

| 유형 | 목적 | 사용 가능한 도구 |
|------|---------|----------------|
| `general-purpose` | 복잡한 다단계 작업 | 모든 도구 |
| `Explore` | 빠른 코드베이스 탐색 | Agent, Edit, Write 제외 모든 도구 |
| `Plan` | 구현 계획 | Agent, Edit, Write 제외 모든 도구 |
| `claude-code-guide` | Claude Code 사용 질문 | Glob, Grep, Read, WebFetch, WebSearch |
| `statusline-setup` | 상태 줄 구성 | Read, Edit |
| `verification` (선택 기능: VERIFICATION_AGENT) | 코드 검토 및 검증 | Read, Glob, Grep, WebFetch, WebSearch |

### 프롬프트 가이드라인
> "방금 방에 들어온 똑똑한 동료에게 브리핑하듯 에이전트에게 설명하라. 이 대화를 본 적 없고, 시도한 것도 모르고, 이 작업이 왜 중요한지 이해하지 못한다."

## EnterWorktree

격리된 git Worktree를 생성하고 세션을 이동시킵니다.

| 속성 | 값 |
|------|-----|
| 목적 | 임시 격리 git Worktree 생성 |
| 격리 | 별도 분기의 저장소 완전 복사본 |
| 자동 정리 | 변경사항이 없으면 Worktree 정리 |
| 반환값 | Worktree 경로 및 분기명 (변경사항 있는 경우) |

---

## ExitWorktree

Worktree 세션을 종료하고 원래 작업 디렉토리로 복원합니다.

| 속성 | 값 |
|------|-----|
| 목적 | 격리 Worktree 종료 및 원래 디렉토리 복원 |
| 작업 | `"keep"` (Worktree 유지) 또는 `"remove"` (Worktree 삭제) |
| 안전 확인 | 커밋되지 않은 변경사항 있으면 확인 필요 |

---

## TeamCreate

여러 Agent가 함께 프로젝트를 조정하는 팀을 생성합니다.

| 속성 | 값 |
|------|-----|
| 목적 | 여러 Agent 조정을 위한 팀 생성 및 작업 목록 연결 |
| 생성 | 팀 디렉토리 + 작업 목록 디렉토리 |
| 반환값 | 팀 이름 및 구성 |

---

## TeamDelete

팀과 작업 리소스를 제거합니다.

| 속성 | 값 |
|------|-----|
| 목적 | 팀 및 작업 리소스 정리 |
| 제거 | 팀 디렉토리 + 작업 디렉토리 |
| 요구사항 | 모든 활성 팀원 먼저 종료 필요 |

---

## EnterPlanMode

코드베이스를 탐색하고 사용자 승인을 위한 구현 접근 방식을 설계합니다.

| 속성 | 값 |
|------|-----|
| 목적 | 구현을 위한 계획 단계로 전환 |
| 기간 | ExitPlanMode 호출 시까지 |
| 사용자 상호작용 | 진행 승인 필요 |

---

## ExitPlanMode

계획 설계를 완료하고 사용자 승인을 요청합니다.

| 속성 | 값 |
|------|-----|
| 목적 | 계획 완료 신호 및 승인 요청 |
| 읽기 출처 | 계획 모드 시스템 메시지에 지정된 계획 파일 |
| 복귀 | 승인된 경우 구현 단계로 이동 |

---

## ToolSearch

지연 정의된 Tool의 전체 Schema를 가져온다.

| 속성 | 값 |
|------|-----|
| 목적 | 지연 Tool Schema 로드 |
| 쿼리 모드 | `select:ToolName` (정확) 또는 키워드 검색 |
| 출력 | 완전한 JSON Schema 정의 |

### 동작 방식
1. 지연 Tool가 시스템 리마인더에 이름으로 표시
2. 가져오기 전에는 이름만 알려짐. Schema 없음, 호출 불가.
3. `ToolSearch`가 전체 Schema 반환
4. 가져온 후 빌트인 Tool처럼 호출 가능
