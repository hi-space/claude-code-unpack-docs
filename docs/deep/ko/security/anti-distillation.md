# Anti-Distillation 메커니즘

유출된 소스코드에서 가장 놀라운 발견 중 하나는 경쟁사가 API 트래픽을 녹화/재생하여 Claude Code의 능력을 디스틸레이션하는 것을 방지하기 위한 다중 레이어 시스템이었다. 구현은 클라이언트 사이드와 서버 사이드 컴포넌트 모두에 걸쳐 있다.

## 개요

Claude Code는 세 가지 서로 다른 Anti-Distillation 메커니즘을 사용한다:

1. **가짜 도구 주입**: 클라이언트 사이드는 디코이 도구 정의로 학습 데이터를 오염시킴
2. **추론 요약**: 서버 사이드는 전체 추론 체인 캡처를 방지
3. **Client Attestation**: 전송 레벨은 비인가 API 접근을 완전히 차단 ([별도 페이지](./client-attestation.md) 참조)

## 1. 가짜 도구 주입

### 클라이언트 사이드 신호만

**클라이언트 사이드** 가짜 도구 주입은 요청 파라미터 설정으로 제한된다. 응답에 가짜 도구를 실제로 주입하는 것은 완전히 **서버 사이드**에서 Anthropic의 인프라에서 일어난다. Claude Code 클라이언트는 가짜 도구 정의를 생성하거나 주입하는 로직을 포함하지 않는다.

### 구현 상세

Anti-Distillation 메커니즘은 다중 게이트 권한 시스템을 사용한다. 가짜 도구 주입은 모두 충족되어야 하는 세 개의 독립적인 게이트를 통해 작동한다: 컴파일 타임 플래그는 기능이 3rd-party 빌드에서 완전히 제거되도록 보장하고(데드 코드 제거), 런타임 GrowthBook 플래그는 Anthropic이 원격으로 트리거할 수 있는 긴급 킬스위치를 제공하며, 1st-party 세션 체크는 요청이 정품 Claude Code 바이너리에서 온 것을 검증한다.

활성화되면, 가짜 도구 주입 메커니즘은 응답에 기만적 도구 정의를 포함시키도록 서버에 신호한다. 이 접근법은 세 조건 모두가 동시에 충족될 때만 기능이 활성화되도록 보장하며, 단순 런타임 패칭으로 우회하는 것을 불가능하게 한다.

**핵심 포인트:** 클라이언트 소스 코드에 가짜 도구 정의는 존재하지 않는다. 클라이언트는 서버에 신호하기 위해 파라미터만 전송한다. 서버는 이 신호를 받을 때 응답에 가짜 도구를 주입할지 결정한다.


### 요청/응답 흐름

```mermaid
sequenceDiagram
    participant CC as Claude Code 클라이언트
    participant AD as Anti-Distillation<br/>Gate Check
    participant API as Claude API 서버
    participant Spy as 트래픽 레코더 ❌

    CC->>AD: API 요청 준비
    AD->>AD: ANTI_DISTILLATION_CC 플래그 확인
    AD->>AD: tengu_anti_distill_fake_tool_injection 확인
    AD->>AD: 1st-party CLI 세션 검증

    alt 모든 검사 통과
        AD->>CC: anti_distillation: ['fake_tools'] 추가
    else 검사 실패
        AD->>CC: 수정되지 않은 요청 반환
    end

    CC->>API: POST /v1/messages<br/>{...request, anti_distillation: ['fake_tools']}

    Note over API: 서버가 일반적으로 요청 처리<br/>하지만 시스템 프롬프트에<br/>디코이 도구 정의 주입

    API->>CC: 실제 + 가짜 도구 혼합 응답

    Note over Spy: 트래픽 녹화 시, 캡처된 데이터<br/>는 실제 도구와 대응되지 않는<br/>가짜 도구 스키마를 포함.<br/>이걸로 학습하면 → 모델이<br/>존재하지 않는 도구를 호출.
```

### 왜 가짜 도구가 작동하는가

가짜 도구 주입은 오염 방어(poisoning defense)다: 가짜 도구가 응답에 삽입되어 트래픽 녹화로 캡처된 학습 데이터를 망친다. 기록된 트래픽으로 학습한 모델은 존재하지 않는 도구들을 호출하는 것을 배우게 되어 프로덕션에서는 깨진 도구 호출을 생성한다. 이는 **API 도용에 대한 카나리 함정**이다. 가짜 도구를 주입하는 비용은 추론 시간에 무시할 수 있지만, 도용된 학습 데이터에서 파괴하는 가치는 엄청나다.

### 3단계 게이트 권한

메커니즘은 세 게이트가 모두 열려야 한다:

| 게이트 | 유형 | 제어자 |
|-------|------|--------|
| `ANTI_DISTILLATION_CC` | 컴파일 타임 플래그 | 빌드 시 설정; 런타임에 변경 불가 |
| `tengu_anti_distill_fake_tool_injection` | GrowthBook 런타임 플래그 | Anthropic이 원격 제어 |
| 1st-party 세션 검증 | 런타임 체크 | 클라이언트 인증 시스템 |

이 설계는 두 가지 목적을 제공한다:
1. **컴파일 타임 게이트**: 기능이 3rd-party 빌드에서 완전히 제거되도록 보장 (데드 코드 제거)
2. **런타임 게이트**: Anthropic이 새 빌드를 푸시할 필요 없이 원격으로 기능을 비활성화할 수 있게 함

### 1st-Party 세션 감지

1st-party 세션 체크는 요청이 3rd-party 통합이 아닌 공식 Claude Code 바이너리에서 유래했는지 검증한다. 이는 [클라이언트 인증](./client-attestation.md) 시스템에 의존하며, 여기서 전송 레벨 암호화 해시가 바이너리가 정품인지 확인한다.

## 2. 추론 요약

### 서버 사이드 전용

추론 요약은 **Anthropic 서버에서만 구현된다**. Claude Code 클라이언트는 요약 로직이나 코드를 포함하지 않는다. 클라이언트의 유일한 관련은 서버에 안티 디스틸레이션 보호를 적용해야 함을 신호하는 요청 파라미터(`anti_distillation: ['fake_tools']` 또는 유사)를 설정하는 것이다. 서버는 클라이언트에 응답을 반환하기 전에 어시스턴트의 추론 체인에 요약을 적용한다.

> **주의:** 아래에 설명된 서버 사이드 처리 파이프라인은 클라이언트의 요청 파라미터와 관찰된 응답 동작으로부터 추론된 것이다. 실제 서버 구현—특정 컴포넌트 이름 및 처리 단계 포함—은 클라이언트 소스 코드에 보이지 않는다.

> **소스 코드 참조:** 이 메커니즘은 내부적으로 "커넥터 텍스트 요약"이라고 불리며 전용 베타 API 헤더 및 GrowthBook 플래그로 게이팅된다. 이름은 그 대상을 반영한다: 연속적인 도구 호출을 연결하는 텍스트다.

### 설계 철학

추론 요약 메커니즘은 가장 가치 있는 학습 신호를 파괴한다: 도구 선택과 코드 분석 뒤의 상세한 사고 과정. 도구 호출 간의 커넥터 텍스트를 필수 요점으로만 요약함으로써, 이 방어는 추론 시간에 영향을 주지 않으면서 디스틸레이션 가치를 줄인다. 요약만으로 학습한 모델은 Claude Code를 효과적으로 만드는 미묘한 추론을 잃어버린다.

### 처리 파이프라인

```mermaid
flowchart TB
    subgraph Client["Client (JavaScript)"]
        Req[API Request] --> Send[Send to server]
    end

    subgraph Server["Server (Anthropic Infrastructure)"]
        Recv[Receive request] --> Process[Process with Claude model]
        Process --> Generate[Generate assistant response]

        Generate --> Buffer["Connector Text Buffer<br/>Collects text between tool calls"]

        Buffer --> Summarize["Reasoning Summarizer<br/>Compresses to key points"]
        Summarize --> Sign["Signature Module<br/>Adds cryptographic signature"]
        Sign --> Output["Output: summary + signature"]
    end

    subgraph Transport["Transport Layer"]
        Output --> Response[HTTP Response]
        Response --> |"Summary only,<br/>not full reasoning"| Client2[Client receives response]
    end

    subgraph Attacker["Traffic Recorder"]
        Response -.-> |"Can only capture<br/>summaries, not<br/>full CoT"| Captured["Captured Data:<br/>- Compressed summaries ✓<br/>- Crypto signatures ✓<br/>- Full reasoning chains ✗<br/>- Detailed tool rationale ✗"]
    end

    style Attacker fill:#ffcccc
```

### 요약되는 것

**커넥터 텍스트** (연속적인 도구 호출 사이의 어시스턴트 추론)이 주요 대상이다:

```
[도구 호출 1: Read file.ts]
→ 커넥터 텍스트: "함수의 버그를 42번 줄에서 볼 수 있다.
   조건 검사가 반전되어 있다. 변수 `isValid`는
   거짓성이 아닌 참성을 확인해야 한다. 이 경우를 다루는
   테스트가 있는지도 확인해보자..."
[도구 호출 2: Grep for test files]
```

요약 후:

```
[도구 호출 1: Read file.ts]
→ 요약: "42번 줄에서 버그 발견. 테스트 확인 중."
→ 서명: 0xa3f7...
[도구 호출 2: Grep for test files]
```

**상세한 추론** (모델의 코드 이해, 디버깅 전략, 의사결정 프로세스를 담는 것)이 가장 유용한 학습 신호다. 이를 요약하면, 트래픽 레코더에 대해 이 신호는 파괴된다.

### 암호화 서명

각 요약은 다음을 수행하는 암호화 서명과 함께 서명된다:

1. **Anthropic 서버가 요약을 생성했음을 증명** (변조되지 않음)
2. **3rd-party가 요약을 수정할 경우 감지 가능** 
3. **Anthropic이 캡처된 데이터의 무결성을 검증할 수 있는 감사 흔적 제공**

## 3. 통합 방어 매트릭스

```mermaid
graph TB
    subgraph DefenseLayers["방어 계층"]
        L1["계층 1: 클라이언트 인증 (전송)"]
        L2["계층 2: 가짜 도구 주입 (애플리케이션)"]
        L3["계층 3: 추론 요약 (서버)"]
    end

    Attacker1["공격자: 비인가 클라이언트"] --> L1
    L1 -->|"BLOCKED"| X1["❌ API 호출 불가"]

    Attacker2["공격자: 트래픽 녹화 수정 CLI"] --> L2
    L2 -->|"POISONED"| X2["⚠️ 캡처된 데이터가<br/>가짜 도구 포함<br/>→ 학습 손상"]

    Attacker3["공격자: 정당한 트래픽 네트워크 태핑"] --> L3
    L3 -->|"DEGRADED"| X3["⚠️ 요약만 캡처<br/>→ 추론 체인 손실"]

    style L1 fill:#e74c3c,color:#fff
    style L2 fill:#f39c12,color:#fff
    style L3 fill:#f1c40f,color:#000
```

| 공격 벡터 | 방어 계층 | 결과 |
|----------|----------|------|
| 비인가 API 클라이언트 | 클라이언트 인증 | 완전히 차단 |
| 트래픽 녹화 수정 CLI | 가짜 도구 주입 | 학습 데이터 오염 |
| 네트워크 레벨 트래픽 캡처 | 추론 요약 | 요약만 사용 가능 |
| 중간자 프록시 | 세 계층 모두 | 차단, 오염, 저하 |
| 공식 CLI 트래픽 녹화 | 가짜 도구 + 요약 | 오염, 저하 |

## GrowthBook 설정

안티 디스틸레이션 시스템은 GrowthBook과 통합되어 있다. GrowthBook은 클라이언트 업데이트를 푸시할 필요 없이 원격으로 동작을 제어하는 피처 관리 플랫폼이다. `tengu_anti_distill_fake_tool_injection` 피처 플래그는 클라이언트 버전, 배포 환경, 또는 사용자 코호트에 따른 조건부 규칙으로 설정될 수 있다. 기본적으로 플래그는 비활성화되지만, Anthropic은 선택적으로 활성화할 수 있다. 예를 들어, 방어가 활성화되기 전에 기본 기능을 보장하기 위해 클라이언트 버전 >= 2.1.0에 대해서만.

이 아키텍처는 Anthropic에 가짜 도구 주입에 대한 세밀한 제어를 제공한다: 팀은 모든 설치에 걸쳐 전역적으로 기능을 활성화 또는 비활성화할 수 있고 초 단위로 처리하고, 롤아웃 위험을 관리하기 위해 특정 클라이언트 버전을 대상으로 지정하고, 사용자 경험과 시스템 성능에 미치는 영향을 측정하기 위해 A/B 테스트를 수행하고, 메커니즘이 예상치 못한 부작용이나 성능 저하를 일으킬 경우 긴급 비활성화를 트리거할 수 있다. 컴파일 타임과 런타임 게이트의 분리는 런타임 플래그가 손상되더라도 기능이 non-1st-party 빌드에서 완전히 제거된 상태로 유지된다는 의미다.

