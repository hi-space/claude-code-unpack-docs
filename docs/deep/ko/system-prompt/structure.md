# System Prompt 구조

Claude Code의 System Prompt는 정적 문자열이 아니다. **다양한 개별 Instruction Block**에서 런타임에 동적으로 조립되며, **캐시 가능한 prefix와 세션별 suffix**로 구성된다.

## 조립 파이프라인

```mermaid
flowchart TB
    subgraph AssemblerInput["SystemPromptAssembler 입력"]
        Blocks["InstructionBlock 모듈"]
        Config["세션 구성<br/>(model, permissions, features)"]
        MCP["MCP 서버 연결<br/>(동적 도구 스키마)"]
        Hooks["사용자 훅<br/>(.claude/settings.json)"]
        Repo["레포지토리 컨텍스트<br/>(git status, project type)"]
        Flags["GrowthBook 피처 플래그<br/>(tengu_* 접두사)"]
    end

    subgraph Assembly["assembleSystemPrompt()"]
        direction TB
        Step1["1. buildIdentityBlock()"]
        Step1 --> Step2["2. buildToolDefinitions()<br/>14-17K 토큰"]
        Step2 --> Step3["3. buildSafetyRules()"]
        Step3 --> Step4["4. buildTaskInstructions()<br/>12개 지시사항 블록"]
        Step4 --> Step5["5. buildGitProtocol()"]
        Step5 --> Step6["6. buildToneDirectives()"]
        Step6 --> Step7["7. buildOutputRules()"]

        Step7 --> Boundary["═══ 캐시 경계 ═══<br/>cache_control: { type: 'ephemeral' }"]

        Boundary --> Step8["8. buildMCPToolSchemas()<br/>(세션별 동적)"]
        Step8 --> Step9["9. buildHookInstructions()"]
        Step9 --> Step10["10. buildRepoContext()"]
        Step10 --> Step11["11. buildSystemReminders()"]
        Step11 --> Step12["12. buildMemoryMd()"]
    end

    AssemblerInput --> Assembly

    subgraph Output["조립된 시스템 프롬프트"]
        Prefix["캐시된 PREFIX<br/>~20K 토큰<br/>요청 간 안정적"]
        Suffix["캐시되지 않은 SUFFIX<br/>(DANGEROUS_uncachedSystemPromptSection)<br/>~3-5K 토큰, 매 요청마다 재처리"]
    end

    Assembly --> Output

    style Boundary fill:#ff6b6b,color:#fff
    style Prefix fill:#2ecc71,color:#fff
    style Suffix fill:#e74c3c,color:#fff
```

## Instruction Blocks: System Prompt 구축

Instruction Block은 Claude Code의 System Prompt의 기본 구성 요소입니다. 각 블록은 단일 의미론적 지시사항 또는 기능(identity, tool usage rules, git protocol, safety rules 등)을 캡슐화합니다. 블록은 최종 조립 prompt에 어떻게 들어가는지를 제어하는 메타데이터로 구성됩니다:

- 각 블록은 **카테고리 식별자** (예: `identity`, `tool-usage`)를 가집니다
- 각각은 **캐시된 prefix** (요청 간 안정적) 또는 **캐시되지 않은 suffix** (요청마다 재처리)로 표시됩니다
- 각각은 최종 prompt에서 그 위치를 결정하는 **우선순위 수준** (0 = 최고 우선순위, 먼저 렌더링)을 가집니다
- 각각은 예산 책정을 위한 **예상 토큰 수**를 포함합니다
- 각각은 session 구성을 기반으로 자신을 포함하거나 제외하는 조건 로직을 가집니다 ("git 리포지토리에만 포함" 같은 기능 게이트에 유용)

모든 블록은 시작 시 등록되고 우선순위별로 정렬됩니다. 어셈블러는 순서대로 연결하여, 핵심 조립 로직을 수정하지 않고도 기능을 켜고 끌 수 있습니다. 도구 관련 블록은 현재 사용 가능한 도구(14-17K 토큰의 JSON 스키마)로 동적으로 주입됩니다. Identity 및 기타 기본 블록은 항상 렌더링됩니다. 이 모듈식 설계는 효율적인 확장을 가능하게 합니다: 새로운 지시사항 기능 추가는 새로운 블록 추가일 뿐, 핵심 조립 로직 리팩토링이 아닙니다.


### 블록 등록 및 조립

System Prompt 어셈블러는 완전한 System Prompt의 조립을 조율합니다. 초기화 시 모든 Instruction Block을 중앙 목록에 등록합니다. 블록은 다양한 관심사를 다룹니다: 기본 identity (Claude Code가 무엇인가), 기능 경계 (어떤 도구가 사용 가능한가), 안전 제약 (어떤 위험을 피할 것인가), 실행 패턴 (작업에 어떻게 접근할 것인가), 런타임 상태 (현재 리포지토리, git status, 사용 가능한 MCP 서버).

조립 프로세스는 예측 가능하고 반복 가능한 순서를 따릅니다:

1. **초기화**: 모든 Instruction Block이 로드되고 시작 시 등록됩니다
2. **정렬**: 블록은 우선순위로 정렬됩니다 (작은 번호가 먼저), identity 같은 기본 블록이 agent guidance 같은 특수 블록보다 먼저 나타나도록 보장합니다
3. **섹션별 필터링**: 블록은 두 그룹으로 분할됩니다: prefix 블록 (캐시 가능, ~20K 토큰) 및 suffix 블록 (요청마다 재처리, ~3-5K 토큰)
4. **콘텐츠 생성**: 각 블록에 대해 session 구성에 따라 조건 로직이 블록을 포함할지 여부를 결정합니다. 블록이 비활성화되면 (예: "git repo에만 git protocol"), 필터링됩니다
5. **연결**: 결과 블록은 섹션 구분 기호와 함께 결합되어 응집력 있는 마크다운 섹션을 형성합니다
6. **토큰 예산**: 모니터링 및 리소스 할당을 위해 총 토큰 수가 계산됩니다

최종 조립 System Prompt는 세 가지 구성 요소를 가집니다: 캐시 가능한 prefix (요청 간 안정적), 캐시되지 않은 suffix (요청마다 재생성), 및 모니터링을 위한 총 토큰 예산.

이 설계는 우려사항을 분리합니다: 블록은 *어떤* 콘텐츠를 포함해야 하는지 정의하고 어셈블러는 *어떻게* 결합할 것인지 정의합니다. 새로운 기능은 조립 로직을 건드리지 않고도 새로운 블록으로 추가될 수 있습니다. 조건부 포함은 각 블록 자체 로직으로 처리되어, 의존성을 로컬로 유지합니다.

```mermaid
flowchart TD
    A["지시사항 블록<br/>여러 모듈"] --> B["생성자에서<br/>등록"]
    B --> C["우선순위별 정렬<br/>작은 번호 먼저"]
    C --> D{"세션<br/>구성?"}
    D --> E["Prefix & Suffix로<br/>분할"]
    E --> F["각 블록마다:<br/>content() 호출"]
    F --> G{비어<br/>있음?}
    G -->|예| H["필터 아웃<br/>조건부 스킵"]
    G -->|아니오| I["블록 텍스트<br/>수집"]
    H --> J["개행으로<br/>결합"]
    I --> J
    J --> K["SystemPrompt<br/>prefix + suffix"]
    D -.->|SessionConfig| F
```


## 토큰 예산 분석

```
전체 시스템 프롬프트: ~20-25K 토큰
│
├── 캐시된 PREFIX (~20K 토큰)
│   │
│   ├── Identity 블록                    ~100 토큰
│   │   "You are Claude Code, Anthropic's official CLI for Claude"
│   │
│   ├── 도구 정의                        14,000-17,000 토큰  ████████████████
│   │   ├── Read 도구 스키마              ~800 토큰
│   │   ├── Write 도구 스키마             ~400 토큰
│   │   ├── Edit 도구 스키마              ~600 토큰
│   │   ├── Bash 도구 스키마              ~1,200 토큰 (가장 큰 개별 도구)
│   │   ├── Grep 도구 스키마              ~900 토큰
│   │   ├── Agent 도구 스키마             ~2,000 토큰 (가장 큼, 모든 에이전트 타입 포함)
│   │   ├── TodoWrite 도구 스키마         ~1,500 토큰
│   │   └── ... 15+ 추가 도구             ~6,600 토큰
│   │
│   ├── 도구 사용 규칙                   ~800 토큰
│   │   "Bash 도구를 사용하지 마세요 (전용 도구가 있을 때)"
│   │   "Read를 cat 대신 사용하세요, Edit를 sed 대신 사용하세요..."
│   │
│   ├── 안전 규칙                        ~600 토큰
│   │   OWASP 인식, 보안 테스팅 정책
│   │
│   ├── 작업 실행 (12개 지시사항)        ~1,200 토큰
│   │   "수정 전 읽기", "불필요한 기능 추가 금지"
│   │   "3개 유사 줄 > 조기 추상화"
│   │
│   ├── Git 프로토콜                     ~1,500 토큰
│   │   커밋 프로토콜, PR 프로토콜, 안전 규칙
│   │
│   ├── 톤 & 출력 스타일                ~400 토큰
│   │   "핵심으로 직진", "이모지 없음"
│   │
│   └── 에이전트 지침                    ~500 토큰
│       Agent 도구 언제 사용, 에이전트에게 지시하는 방법
│
│   ═══════════ 캐시 경계 ═══════════
│
└── 캐시되지 않은 SUFFIX (~3-5K 토큰, 가변)
    │
    ├── MCP 도구 스키마                  0-3,000 토큰 (연결에 따라 다름)
    ├── 훅 지시사항                      0-500 토큰
    ├── 레포지토리 컨텍스트              ~200 토큰
    │   플랫폼, 셸, git status
    ├── 시스템 리마인더                  ~500 토큰
    │   사용 가능한 지연 도구, 기술
    └── MEMORY.md 내용                  500-1,000 토큰
```

## `DANGEROUS_uncachedSystemPromptSection`

Suffix 섹션은 개발자에게 캐시 영향을 신호하기 위해 명시적으로 이름이 지정됩니다. `DANGEROUS_` 접두사는 의도적인 명명 선택으로 경고합니다: suffix에 추가된 모든 것은 모든 API 호출에서 재처리되고, 여기에 콘텐츠를 추가하면 캐시 효율성이 깨지며, 개발자는 suffix에 무언가를 넣기 전에 신중하게 생각해야 합니다. 이 명명 규칙은 suffix가 직접적인 성능 및 비용 영향을 가진다는 상수 상기 역할을 합니다. suffix의 모든 것이 프롬프트 캐싱을 우회하기 때문입니다.

## 조건부 블록

많은 지시사항 블록은 구성에 따라 조건부로 포함됩니다. 예를 들어, git protocol 블록은 사용자가 git 리포지토리에 있는 경우에만 렌더링됩니다. Agent system 블록은 agent가 session에서 활성화된 경우에만 agent guidance를 포함합니다. Undercover mode 블록은 시스템이 오픈 소스 리포지토리 컨텍스트에서 작동하는 경우에만 나타납니다. 각 블록의 조건 로직은 자체 포함되어 있습니다. 블록은 어셈블러가 복잡한 포함/제외 규칙을 관리하도록 요구하는 대신 자신의 조건을 평가합니다.

## 캐시 경계 설계 원칙

각 지시사항 블록의 배치 (prefix vs suffix)는 다음 규칙을 따릅니다:

| 원칙 | 규칙 | 이유 |
|-----------|------|--------|
| **안정성** | 요청 간 변경되지 않는 콘텐츠 → prefix | 캐시 히트율 최대화 |
| **빈도** | 거의 변경되지 않는 콘텐츠 → prefix | 변경될 *수* 있더라도 자주 하지 않으면 캐시 승리 |
| **동적성** | 세션당 변경되는 콘텐츠 → suffix | MCP 도구, 훅, 리포 상태 |
| **크기** | 큰 안정 콘텐츠 → 먼저 prefix | 도구 스키마 (14-17K 토큰)는 캐싱에서 가장 이익) |
| **위험** | 변경 시 캐시를 깨는 콘텐츠 → suffix | prefix로 이동하면 자주 변경되는 경우 캐싱하지 않는 것이 더 나쁨 |

결과: **시스템 프롬프트의 60-70%가 캐시되며**, 가장 토큰 비용이 큰 구성 요소 (도구 정의)는 항상 캐시된 prefix에 있습니다.
