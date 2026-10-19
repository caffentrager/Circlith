# Documentation Audit

2026-10-19 Asia/Seoul · 기준 `f59efd2755e31be9b1bb4f70514cb20680421be7` · PR-0.

**기존 문서 내용·경로·Master Spec 권위는 유지한다.** 새 platform 문서는 현황의 보완 기록 및 미래 제안이다. 플랫폼 목표가 기존 명세를 자동 폐기하거나 PR-1 이후를 승인하지 않는다. 문서 진입점은 [Repository Index](../REPOSITORY_INDEX.md)다.

## 1. 권위와 시점

| 계층 | 문서 | 효력 |
|---|---|---|
| 제품 기준 | [CIRCLITH_MASTER_SPEC.md](../CIRCLITH_MASTER_SPEC.md) | CANONICAL. CURRENT/PROVISIONAL/EXPERIMENTAL/DEFERRED와 DEC를 구분. 목표와 구현 완료를 동일시하지 않음 |
| 현재 구현 증거 | 실제 main 코드·기본 테스트·Pages workflow/manifest | 기준 SHA의 동작 확인. 명세 충돌 시 코드가 자동으로 새 명세가 되는 것은 아님 |
| 사용·운영 보완 | INPUT_CONTROLS, WIRE_EDITING, SIMULATION, SEQUENTIAL_SIMULATION, PAGES_DEPLOYMENT | 각 영역의 구현/검증/절차. Master Spec 아래에서 읽고 시점별 제한을 적용 |
| 계획 | EDITOR_EXPANSION_SCOPE, PAGES_DRIVE_STORAGE, 새 Architecture/Migration/Handoff | 미래 제안/이전 합의의 범위. 존재 자체가 모든 기능 착수 승인 아님 |
| 역사 기록 | docs/archive, review, 날짜별 qa-audit | 당시 commit에 대한 근거. 현재 미해결 결함 목록/현재 배포를 뜻하지 않음 |

기준 명세는 구현 완료 보고서가 아님을 §42에서 명시한다. Appendix D도 새 결정은 Master Spec DEC/본문에 먼저 반영하고 별도 문서에 다른 최종값을 만들지 말라고 정한다. 이번 platform 설계는 이 규칙을 폐기하지 않는다. 향후 범위 확정 시 승인받아 명세와 새 문서의 소유 범위를 연결해야 한다.

## 2. 발견한 현재성 충돌

| 위치 | 실제 확인한 내용 | 현재 기준과 처리 |
|---|---|---|
| README 상단 | sequential/UI/QA 브랜치 작업 기록이 연속 배치, 409·147 같은 과거 수치 | 현재 main은 Clock/DFF 포함 단일 앱. PR-0에서 짧은 현황·인덱스 안내만 추가. 본문 기록·숫자는 원래 시점으로 보존 |
| README의 2026-10-18 설명 | Clock·순차·파형이 후속이라고 서술 | 당시 조합논리 단계 이력. 지금 미구현이라는 뜻으로 읽지 않도록 새 인덱스에서 SEQUENTIAL 문서 연결 |
| SIMULATION.md 범위 | Clock/FF/시간·파형을 조합논리 단계의 후속으로 명시 | 조합 엔진의 설명은 유효. 현재 전체 앱 지원 범위는 SEQUENTIAL 및 Master Spec의 순차 절을 함께 읽음 |
| EDITOR_PROTOTYPE | 초기 prototype의 목표·미구현 목록 | 초기 단계 기록과 현재 조작 설명 혼재. 여전히 입력/배선 판단 근거가 있어 이동 전 절별 대조 필요 |
| EDITOR_EXPANSION_SCOPE | 기준 51552a7, T1 이후 확장 계획/진척 | main·별도 branch 완료를 구분. 저장/clipboard가 main에 들어왔다고 추정하지 않음 |
| CAD_SCOPE_GAP / CAD_HANDOFF_VERDICT | 순차 기능 다수가 T6 미구현, 다음 branch 시작점이 UI branch | UI 개편 시점 판정. 지금 후속 구현자는 오래된 시작 branch 지시를 그대로 실행하지 않고 최신 main을 재확인 |
| UX_CRITICAL_AUDIT | public Pages 982bf5c·구 UI/두 경로 상태를 실측 | 당시 증거로 유효. UI_AUDIT_RESPONSE와 현재 Pages 검사 결과로 현황 연결 |
| SEQUENTIAL_IMPLEMENTATION | 두 production mode 검증·공개 배포 미포함이라고 기록 | 해당 구현 commit 시점 이력. 이후 f59efd2 단일 main 배포는 PAGES_DEPLOYMENT가 설명 |
| SEQUENTIAL_SIMULATION 검증 절 | “두 production mode 검증”이라는 당시 표현 | 개발 모드 테스트 기록이고 공개 배포 정책이 아님. 현재 공개 앱은 하나 |
| qa-audit FIXES / REVIEW | 당시 “아직 merge 안 됨”, “untracked” 등 | 현재 Git에는 추적/병합됨. 원문을 현재 status처럼 수정하지 않고 branch 감사와 연결 |
| PAGES_DRIVE_STORAGE | Drive 저장의 가능성·권장안 | 미구현 연구. OAuth/Drive 연결을 이번 감사에서 생성하지 않음 |

Master Spec과 플랫폼 목표의 차이도 남는다. 기존 제품은 Logic CAD 중심이고 이번 요구는 Electronics까지 확장하는 미래 방향이다. 새 platform 문서에 미구현·제안 효력을 명시했으며 공식 범위 변경은 후속 의제다.

## 3. 파일별 목적·분류·정리 권고

아래는 기준 commit의 모든 Markdown 문서다(README 포함). 파일 내용을 열어 제목·시점·권위 선언·관련 결론을 확인했다. 전체를 새 문서로 덮어쓰지 않는다. 분류는 주된 역할이고 ACTIVE 문서에도 일부 역사 절이 있을 수 있다.

| 문서 | 분류 | 목적 | 현재성/권위 | 중복·이동·통합 권고 |
|---|---|---|---|---|
| `README.md` | ACTIVE | 제품 개요·실행·현재/과거 branch 기록 | snapshot/이력 혼재 | 인덱스로 현재성 안내, 전체 재구성은 제안만 |
| `docs/CIRCLITH_MASTER_SPEC.md` | CANONICAL | 제품·DEC·조작/모델/계산/저장 기준 | 공식 기준, 계획 포함 | 현 경로/권위 유지; 플랫폼 확정 시 승인된 보완 |
| `docs/DELETE_AND_SYMBOLS.md` | ACTIVE | Delete·꺾임점·심벌 및 승인 정책 | Master Spec 보완 | 현행 정책 근거 유지 |
| `docs/EDITOR_EXPANSION_SCOPE.md` | HISTORICAL | 51552a7 이후 단계별 확장 범위 | 당시 합의/계획 | ARCHIVE_CANDIDATE; 현재 진척 대조 후 이동 승인 |
| `docs/EDITOR_PROTOTYPE.md` | HISTORICAL | 초기 editor 구조·조작·검증 | 초기 기록+유효 조작 | ARCHIVE_CANDIDATE; 절별 현행 설명 추출 전 이동 금지 |
| `docs/INFORMATION_REVIEW.md` | HISTORICAL | 2026-10-13 업로드 전 자료 검토 | 당시 검토 범위만 | 개인정보 부재의 현재 보증으로 읽지 않음 |
| `docs/INPUT_CONTROLS.md` | ACTIVE | registry/resolver/프로필 정책·검증 | 현행 입력 보완 | 명령 availability/기존 namespace 유지 |
| `docs/PAGES_DEPLOYMENT.md` | ACTIVE | 단일 앱 build/assemble/check/deploy 절차 | f59efd2 현재 절차 | 현 경로 유지, 운영 정책 변경 금지 |
| `docs/PAGES_DRIVE_STORAGE.md` | HISTORICAL | Drive 저장 가능성/운영 조사 | 미구현 제안 | 인증·연결 자동 실행 금지; archive 이동은 제안 |
| `docs/SEQUENTIAL_SIMULATION.md` | ACTIVE | Clock/DFF 시간·파형·저장 통합 정책 | Master Spec §25 보완 | 동시 엣지·제약·T1 통합 근거 유지 |
| `docs/SIMULATION.md` | ACTIVE | 4상태 조합 engine·UI·검증 | 조합 단계 범위 | 순차 지원은 SEQUENTIAL과 함께 읽음 |
| `docs/WIRE_EDITING.md` | ACTIVE | 배선 조작/공식 비교/검증 | Master Spec 보완 | 현재 조작 근거 유지 |
| `docs/archive/INTERACTION.md` | HISTORICAL | 초기 조작 상태/명령 경계 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `docs/archive/ISSUES_AND_SOLUTIONS_Codex.md` | HISTORICAL | 검토서 쟁점과 해결 제안 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `docs/archive/PLAN.md` | HISTORICAL | 초기 제품 계획/목표 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `docs/archive/README.md` | HISTORICAL | 통합 이전 보관 자료 인덱스 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `docs/archive/REVIEW_RESPONSE_Claude.md` | HISTORICAL | 검토서 회신/이견 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `docs/archive/SHORTCUTS.md` | HISTORICAL | 초기 단축키 v0.1 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `docs/archive/SHORTCUTS_Claude_v0.3.md` | HISTORICAL | Claude v0.3 단축키 대안 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `docs/archive/SHORTCUTS_Codex_v0.2.md` | HISTORICAL | Codex v0.2 비교/추천 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `docs/archive/SHORTCUTS_Consolidated.md` | HISTORICAL | 통합 이전 단축키 종합 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `docs/archive/SHORTCUTS_v0.2.md` | HISTORICAL | 별도 단축키 v0.2 제안 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `docs/archive/USABILITY.md` | HISTORICAL | 초기 사용성 검증 가설/계획 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `docs/archive/codex LF final.md` | HISTORICAL | 초기 통합 설계안 | 상단 보관 표시·구현 기준 아님 | 현 위치 보존; 버전 차이는 중복 삭제 근거 아님 |
| `qa-audit/20261018/AUDIT_REPORT.md` | HISTORICAL | cd8bf7e 독립 통합 감사 | 당시 결함·oracle·성능 | FIXES/통합 결과와 연결 |
| `qa-audit/20261018/FINDINGS.md` | HISTORICAL | 독립 결함·노출·profile 근거 | cd8bf7e | 증거/재현 보존 |
| `qa-audit/20261018/FIXES.md` | HISTORICAL | 9c47291 수정·회귀 검증 | 이후 main 병합됨 | 당시 미병합 문구 보존 |
| `qa-audit/20261018/FIX_PLAN.md` | HISTORICAL | 독립 수정 순서 제안 | 당시 계획 | 현재 수정 완료와 별도 기록 |
| `qa-audit/20261018/README.md` | HISTORICAL | 감사 자료/재현 배치 안내 | 원래 checkout 재현 | 현재 CI 대상 아님을 명시 |
| `qa-audit/20261018/TEST_MATRIX.md` | HISTORICAL | 독립 진리표·퍼즈·브라우저/변이 범위 | 당시 검증 매트릭스 | 누락 회귀 판단 근거 유지 |
| `review/AUDIT_7ae3b32.md` | HISTORICAL | 7ae3b32 독립 감사 | 당시 commit | 수정 응답과 함께 보존, 이동만 추후 검토 |
| `review/CAD_FEATURE_GAP_20261019.md` | HISTORICAL | 타 CAD 대비 기능 gap 조사 | 제안/비교, 127개 항목 | 채택 범위는 HANDOFF 판정 확인; 전부 구현 지시 아님 |
| `review/CAD_HANDOFF_VERDICT_20261019.md` | HISTORICAL | UI 완료·184 항목 범위 판정/T1 인계 | fc6520c 인계 시점 | 기존 지시 예시 보존; 시작점은 최신 main 재조회 |
| `review/CAD_SCOPE_GAP_20261019.md` | HISTORICAL | 제품 범위 안의 미구현 gap | UI 개편 작업 시점 | 순차 완료 전 목록; 현재 TODO로 복사하지 않음 |
| `review/CLAUDE_logic-simulation_verification_eb44fc5.md` | HISTORICAL | eb44fc5 독립 계산/조작/변이 검증 | 당시 commit | 내용 보존, 실제 링크 b 한 곳만 anchor 수정 |
| `review/LOGIC_FORGE_ADOPTION_20261019.md` | HISTORICAL | 참고 프로젝트와 순차 도입 제안 | cd8bf7e 비교 | 현재 순차 구현 명세 대체 아님 |
| `review/QA_FIXES_20261016.md` | HISTORICAL | QA disposition·몸체/핀 승인 정책 | 당시 수정/승인 기록 | 현 조작 추적 가치; 현재 회귀와 연결 |
| `review/QA_HANDOFF_51552a7.md` | HISTORICAL | 51552a7 독립 QA/실패 재현 인계 | 당시 실패 상태 | QA_FIXES·후속 통합으로 추적 |
| `review/QA_INTEGRATION_READINESS_20261019.md` | HISTORICAL | b06adc4 통합 준비·잔여 문제 | 후속 결과에 연결됨 | QA_INTEGRATION_RESULT와 함께 보존 |
| `review/QA_INTEGRATION_RESULT_20261019.md` | HISTORICAL | d42f456 통합 정책·검증 | 병합된 수정 기록 | 입력/경유점/진단 회귀 근거 유지 |
| `review/REVIEW.md` | HISTORICAL | 2c52562 독립 review와 repro | 초기 결함·당시 untracked | REVIEW_RESPONSE와 결론 구분; archive 후보 |
| `review/REVIEW_RESPONSE.md` | HISTORICAL | 초기 review 수용/보류 | 당시 disposition | 원본과 함께 보존 |
| `review/SEQUENTIAL_IMPLEMENTATION_20261019.md` | HISTORICAL | 373fb5b 순차 구현/검증 | 현재 코드 근거·당시 배포 전 | 현재 공개 정책은 PAGES_DEPLOYMENT |
| `review/UI_AUDIT_RESPONSE_20261019.md` | HISTORICAL | UX 감사 후속 수용/보류·검증 | UI branch 후속 | 원본 감사·수정의 연결 유지 |
| `review/UI_WORKSPACE_REFRESH_20261019.md` | HISTORICAL | UI shell/Inspector/상태바·촬영 | 후속 응답 연결됨 | capture-workspace 참조 보존 |
| `review/UX_CRITICAL_AUDIT_20261019.md` | HISTORICAL | 미커밋 UI/구 Pages 실측 독립 감사 | 982bf5c+UI 당시 상태 | 현재 결함 단정 금지; 응답/최신 검사 대조 |

review의 두 `.test.ts/.spec.ts`와 qa-audit 테스트/JSON/PNG의 실행·보존 분류는 [Repository Audit](REPOSITORY_AUDIT.md)의 전수 목록을 따른다. 원래 reproduction 스크립트의 경로 배치까지 현재 테스트와 같다고 가정하지 않는다.

## 4. 중복과 링크

README·SIMULATION·Master Spec에는 조합 기능 설명이 반복된다. 목적이 개요/사용법/정책으로 달라 파일 중복은 아니다. archive의 SHORTCUTS 6종은 실제 버전/작성자/선택이 다르며 P/Q, Undo, placement 후보를 비교하는 이력이다. 삭제·내용 통합을 권고하지 않는다.

추적 파일 전체 바이트 비교에서 정확히 같은 파일은 QA profile JSON 한 쌍뿐이다. [Repository Audit](REPOSITORY_AUDIT.md)에 내용·SHA-256과 BEFORE 역할을 기록했다. 동일 파일도 전후 증거 문맥을 보존한다. 감사 보고서와 수정 응답도 서로 대체하지 않는다.

상대 Markdown 링크의 대상 파일 존재 여부를 검사했다. CLAUDE 검증 보고서의 `(a)`는 fenced code 안의 당시 표현이라 유지했다. 같은 보고서 표의 실제 `[P2-2](b)` 링크는 존재하지 않는 파일 b를 가리켰다. 원문 결론은 그대로 두고 동일 문서의 P2-2 제목 anchor로 안전하게 고쳤다. fenced/inline code 제외 후 실제 파일 링크 누락 여부를 최종 검증했다. 모든 외부 URL 유효성·code span 안의 역사적 경로까지 검증한 것은 아니다. Archive에 “원본 미포함”으로 명시한 benchmark/docx는 현재 자료처럼 복구·추정하지 않는다.

## 5. README 재구성 제안 (이번에는 전체 재작성하지 않음)

| 권장 순서 | 내용 | 보존 방법 |
|---:|---|---|
| 1 | Circlith 소개: 현재 Logic, 미래 플랫폼 방향 구분 | 기존 핵심 소개 유지 |
| 2 | 현재 제공 기능: 7 gate·I/O·Clock/DFF·편집/계산/파형 | 코드·현재 검증에 맞춰 요약 |
| 3 | 현재 상태/한계: main은 저장·다중문서·Electronics 없음 | 별도 branch를 완료 기능으로 안내하지 않음 |
| 4 | Node/npm 개발 환경·실행 | CI 버전과 로컬 버전 구분 |
| 5 | 단위/브라우저 테스트와 opt-in soak | 테스트 수는 날짜·SHA와 묶음 |
| 6 | 단일 Pages 앱/개발 editor mode | PAGES_DEPLOYMENT 절차로 연결 |
| 7 | 실제 프로젝트 구조 | 미래 src/common 목표와 구분 |
| 8 | 문서 링크·권위 | Repository Index와 Master Spec |
| 9 | 로드맵 | PR-1 이후는 미승인 설계로 표시 |

과거 branch/date별 설명은 별도 DEVELOPMENT_HISTORY 같은 문서에 **원문 그대로 복사하고 출처 SHA를 보존**한 뒤 README를 재구성하는 방안을 권한다. 이는 기존 기록 이동/재구성이므로 이번에는 제안만 한다. PR-0의 README 변경은 원문 앞에 현재 상태·문서 효력·인덱스 링크를 추가하는 범위다.

## 6. 문서 권위 분리의 조건

목표 docs/platform(architecture/project/workspace), docs/logic(spec/editor/simulation), docs/electronics(scope/engine), docs/archive 구조는 합리적이다. 하지만 “Master Spec 삭제 후 Logic Spec 복사”는 채택하지 않는다.

이동 전 각 절/DEC의 현재 소유자·새 소유자·보완/대체 여부·참조 경로·동기화 책임·승인자를 표로 만든다. Master Spec을 그대로 남기는 과도기에는 새 문서가 미래 제안인지 세부 구현 기록인지 상단에 표시한다. 승인 후 대체 절을 발행할 경우 기존 문서에는 해당 절의 이전 목적지와 효력 발생 기준을 명시하고, 옛 QA의 commit 인용은 보존한다. 링크 redirect/facade 문서 유지 비용도 평가한다.

이번에 추가한 REPOSITORY_AUDIT/BRANCH_AUDIT/DOCUMENTATION_AUDIT는 snapshot 기록, PLATFORM_ARCHITECTURE는 미래 설계, MIGRATION_PLAN/IMPLEMENTATION_HANDOFF는 후속 제안이다. REPOSITORY_INDEX는 탐색만 담당한다. 기존 명세를 대체하는 문서는 **없다**.
