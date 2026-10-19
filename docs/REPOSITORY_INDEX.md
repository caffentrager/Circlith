# Circlith 저장소·문서 인덱스

2026-10-19 감사 기준: main `f59efd2755e31be9b1bb4f70514cb20680421be7`.

**제품 설계·구현의 기준은 [CIRCLITH_MASTER_SPEC.md](CIRCLITH_MASTER_SPEC.md)다.** 이 인덱스와 platform 문서는 기준 명세를 교체하지 않는다. CURRENT는 구현 기준, PROVISIONAL/EXPERIMENTAL/DEFERRED는 확정·검증 완료가 아니다.

## 현재 상태부터 읽기

현재 main은 `/Circlith/` 하나에서 Logic 편집·조합논리·Clock/DFF 시간 시뮬레이션·파형을 제공한다. 개발용 Vite editor/simulation 모드는 Logic/Electronics workspace 선택이 아니다. Project 다중 문서·Electronics·회로 파일 저장/복구·clipboard는 main 기준 미구현이다. 저장·복구와 clipboard의 별도 로컬 branch는 [Branch Audit](platform/BRANCH_AUDIT.md)에 보존/통합 과제로 기록했다.

| 읽는 목적 | 문서와 효력 |
|---|---|
| 제품 규칙·조작·결정 | [Master Spec](CIRCLITH_MASTER_SPEC.md), CANONICAL |
| 입력 프로필·resolver/dispatcher | [Input Controls](INPUT_CONTROLS.md), 구현 보완 |
| 배선·선택·연결 유지 수정 | [Wire Editing](WIRE_EDITING.md), [Delete and Symbols](DELETE_AND_SYMBOLS.md), 구현 기록 |
| 4상태 조합 계산 | [Simulation](SIMULATION.md), 조합 단계 범위. 순차 미지원 설명은 당시 단계에 한정 |
| Clock/DFF·시간·파형 | [Sequential Simulation](SEQUENTIAL_SIMULATION.md), [구현 검증](../review/SEQUENTIAL_IMPLEMENTATION_20261019.md) |
| 후속 순차소자 확장·게이트 래치 | [Sequential Components](SEQUENTIAL_COMPONENTS.md), JK/T/SR FF·D/SR 래치·Enable/비동기 S/R DFF의 기능 브랜치 기록 |
| 현재 단일 앱 배포 | [Pages Deployment](PAGES_DEPLOYMENT.md), 현재 운영 절차 |
| 저장소 현황·테스트·파일 분류 | [Repository Audit](platform/REPOSITORY_AUDIT.md), 기준 SHA snapshot |
| 모든 branch와 고유 변경 | [Branch Audit](platform/BRANCH_AUDIT.md), 보존·통합 권고 |
| 어떤 문서가 현재/과거인가 | [Documentation Audit](platform/DOCUMENTATION_AUDIT.md), 파일별 권위·시점 |

## 플랫폼 전환 검토

이 문서들은 **미래 설계/계획**이다. 이번 PR-0은 문서 감사만 수행하며 소스 이동·새 모델·엔진 구현은 포함하지 않는다.

1. [Platform Architecture](platform/PLATFORM_ARCHITECTURE.md): 기존 src 구조를 유지한 단계적 경계, Project/Workspace/Document 예시, 엔진 분리.
2. [Migration Plan](platform/MIGRATION_PLAN.md): PR-0~7별 조건·회귀·테스트·완료·rollback.
3. [Implementation Handoff](platform/IMPLEMENTATION_HANDOFF.md): 다음 구현자 시작점·소유권·검증·PR 의존.

## 과거 기록과 계획

| 묶음 | 읽는 법 |
|---|---|
| [Editor Prototype](EDITOR_PROTOTYPE.md) | 초기 조작 개발과 검증 이력. 현재 앱 전체 지원 범위는 아님 |
| [Editor Expansion Scope](EDITOR_EXPANSION_SCOPE.md) | 51552a7 이후 계획·당시 진척. 현재 main 완료 목록으로 읽지 않음 |
| [Pages / Drive Storage](PAGES_DRIVE_STORAGE.md) | 미구현 저장 방향 조사. Drive 연결/배포 변경 승인 아님 |
| [QA 통합 결과](../review/QA_INTEGRATION_RESULT_20261019.md) | 2026-10-19 통합 시점. 당시 테스트 수는 현재 수와 다를 수 있음 |
| [UI Audit Response](../review/UI_AUDIT_RESPONSE_20261019.md) | UX 원본 감사의 수용/보류 및 실제 반영 |
| [CAD Handoff Verdict](../review/CAD_HANDOFF_VERDICT_20261019.md) | UI 완료 시점 T1/T6 등 판정. 최신 main 이후 변경은 별도 확인 |
| [Independent QA](../qa-audit/20261018/README.md) | cd8bf7e 검증·결함·후속 수정·증거. 현재 미해결 목록으로 단정 금지 |
| [Archive Index](archive/README.md) | 초기 계획·조작·단축키 대안. 구현 기준 아님 |
| [Information Review](INFORMATION_REVIEW.md) | 당시 업로드 전 자료 검토 이력 |

전체 문서 목적/시점/중복·이동 제안은 Documentation Audit 표를 따른다. README의 날짜별 branch 설명과 review의 지시 예시는 그 시점의 기록이며 현재 작업 승인을 대신하지 않는다. 대량 문서/소스 이동·branch 삭제·명세 교체·모노레포·배포 정책 변경은 별도 승인 대상이다.
