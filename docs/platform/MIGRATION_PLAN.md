# 안전한 플랫폼 이전 계획

2026-10-19 Asia/Seoul · 기준 `f59efd2755e31be9b1bb4f70514cb20680421be7` · **미래 계획, PR-0만 이번 실행 범위**. [Master Spec](../CIRCLITH_MASTER_SPEC.md)을 대체하지 않는다. [Architecture](PLATFORM_ARCHITECTURE.md)의 Alternative A를 추천한다.

## 공통 gate와 보존 규칙

각 PR은 직전 PR의 검증·리뷰 완료 후 시작한다. 예상하지 못한 main 변경이 있으면 새 기준으로 diff와 테스트를 다시 확인한다. 소스 이동, 문서 이동, 배포·보호 정책 변경은 이 계획의 존재만으로 승인된 것이 아니다. 한 PR에서 engine 의미론 변경과 파일 이동을 결합하지 않는다.

Gate G: `npm ci`, `npm test`, `npm run build`, `npm run test:browser`, Pages simulation build → 새 목적지 assemble → check-pages, `git diff --check`가 통과해야 한다. 기존 opt-in soak skip은 유지·표시한다. 실패한 기존 테스트를 삭제/완화하거나 CI 단계를 생략하지 않는다. 기존 profile/routing/wire-display 저장 키와 값, data 모델, 조작 정책을 보존한다.

회귀 기준: 배치·선택·Shift/영역 선택, 생성/분기/교차/경로수정/되짚음 배선, Pin/Net 무결성, Properties/핀 ID, 실패 원자성·Undo/Redo, 0/1/X/Z·부동·다중구동·피드백, Clock/DFF·동시 엣지·세 Step·Reset/Run/Pause, 파형 커서와 live 상태, 설정 격리, Pages 단일 경로·manifest·출처·구 경로 404. 근거 테스트 파일은 [Repository Audit](REPOSITORY_AUDIT.md)의 매트릭스를 따른다.

## PR-0 — Repository Audit & Documentation (이번 작업)

| 항목 | 내용 |
|---|---|
| Goal | 최신 main·이력·문서·코드·검증 근거와 안전한 후속 계약 확립 |
| Prerequisites | 깨끗한 작업 트리, remote 재조회, 기존 브랜치/worktree 보존 |
| Target files | docs/platform의 6개 보고서, docs/REPOSITORY_INDEX.md, README 진입 링크 |
| Expected changes | 추가 문서와 현재 상태 안내만. README 전체 재구성은 제안만 |
| Potential regressions | 잘못된 문서 권위·링크·기준 SHA, 미통합 기능을 현재 기능으로 안내 |
| Required tests | Gate G, 새 문서 링크·변경 경로 검사, 실서비스 Pages 검사 가능 시 수행 |
| Completion criteria | 7개 필수 문서, 모든 ref 분류, 명시적인 미검증/미결정, 금지 변경 0 |
| Rollback strategy | 추가 문서와 README 안내만 되돌리는 PR. main/ref/기존 기록을 초기화하지 않음 |

## 선행 통합 검토 — 기존 T1/T2 보존

PR-1 전에 `claude/storage-recovery@90f0a39`와 `claude/clipboard-duplicate@8b55eef`를 소유자와 검토한다. T2는 T1에 의존한다. 두 브랜치는 순차회로/단일 Pages 이전 `fc6520c`에서 갈라졌다. main과 branch tip 전체를 교체하거나 오래된 workflow를 되가져오지 않는다. T1/T2 통합은 이번 PR-0 범위 밖이며 별도 승인·작은 PR로 처리한다.

검토 산출물: Clock/DFF kind·핀·clock/dff 속성 round trip, 구 v1 fixture 호환, 파일 버전 정책, session replacement, T2 fragment/clipboard의 순차 부품 보존, 새 입력 명령과 profile 정책, 현재 main Pages 유지. 미통합 시 후속 PR은 해당 기능을 main에 있다고 가정할 수 없다. PR-1의 metadata 타입 설계는 가능하지만 PR-4 persistence 확정은 이 gate 이후다.

## PR-1 — Project / Document Data Model

| 항목 | 내용 |
|---|---|
| Goal | 도메인 구분된 프로젝트/문서 envelope 및 ID·revision 계약 |
| Prerequisites | PR-0 리뷰, 모델 범위·저장 형식 정책 승인, T1/T2 처리 방향 기록 |
| Target files | 신규 src/platform project/document 타입·검증, tests/unit 프로젝트 fixture, Master Spec 승인된 관련 절 |
| Expected changes | 프로젝트에 여러 Logic/Electronics 문서 descriptor, 기존 Logic Circuit을 변경 없이 포함. Electronics payload 계약만 정의 |
| Potential regressions | ID 재발급, 구 파일 암묵 변환, unknown field 유실, serialization에 runtime 혼입 |
| Required tests | Gate G + ID 중복/도메인 판별/미지원 버전·손상 거부·기존 Circuit 불변 테스트 |
| Completion criteria | 타입/validator의 범위 확정, 기존 kind·net 규칙 불변, 현재 앱 실행 경로 유지 |
| Rollback strategy | 새 envelope 연결만 되돌림. 사용자 파일 migration/자동 저장 전이라 원본 변경 없음 |

## PR-2 — Runtime Workspace Shell

| 항목 | 내용 |
|---|---|
| Goal | 하나의 React 앱에서 workspace/document 수명과 전환 계약 |
| Prerequisites | PR-1 통과, 전환·모달·pause 정책 승인 |
| Target files | src/main.tsx, src/ui/App.tsx의 최소 연결, 신규 platform shell/runtime, 관련 browser 테스트 |
| Expected changes | 현재 App 전체를 Logic adapter로 감싸기. 문서별 editor/history/view/session 소유자 마련, workspace는 등록된 것만 표시 |
| Potential regressions | remount 시 history/session 유실, 비활성 timer·키 입력, stale 비동기 입력, 초안 자동 확정 |
| Required tests | Gate G + 두 Logic 문서 교대, Undo/Redo/viewport 유지, 배선·move·pan 중 전환 취소, 모달 전환 차단, timer pause, 재진입 focus |
| Completion criteria | 새로고침 없음, 미확정 편집이 다른 문서로 유입 안 됨, 순차 세션 복원. Electronics 가짜 엔진 없음 |
| Rollback strategy | shell adapter 연결 PR revert. runtime만 추가, 파일 저장 구조를 이 PR에서 변경하지 않음 |

## PR-3 — Logic Workspace Isolation

| 항목 | 내용 |
|---|---|
| Goal | Logic 전용 모듈을 격리하고 입증된 순수 CAD/입력 기구만 공유 |
| Prerequisites | PR-2 통과, 파일별 소스 이동 승인, 공개 import 계약 합의 |
| Target files | src/editor, model, renderer, simulation, input, geometry, ui/App.tsx; 신규 logic/common; 기존 tests import |
| Expected changes | 여러 작은 PR로 나누기: 3a Logic 경로/호환 facade, 3b input·gesture 내부 추출, 3c Point/path/zoom 순수 경계. 각 소단계도 Gate G |
| Potential regressions | model↔geometry 순환 의존, registry 가용 명령 변화, event 순서·pointer rollback·경로/핀 오차 |
| Required tests | Gate G + migration 전후 동일 fixture 비교, runtime 보존, import 방향 검사. 기존 기대값은 수정 없이 유지 |
| Completion criteria | common은 도메인 import 0, Electronics가 Logic internals를 요구하지 않는 공개 계약, 조작/계산 변화 0 |
| Rollback strategy | 소단계별 revert. rename과 의미 변경 분리, 임시 facade 제거는 별도 검증 후 |

## PR-4 — Project Persistence

| 항목 | 내용 |
|---|---|
| Goal | 프로젝트 저장·열기·복구와 기존 circuit 파일 호환 |
| Prerequisites | PR-3 통과, T1 검증 통합 또는 명시적인 대체 계획, schema/unknown version·복구 정책 확정 |
| Target files | platform storage coordinator, 도메인 codec, T1 src/storage 및 useDocumentSession 통합 위치, file/recovery UI·fixtures |
| Expected changes | 원본 보존 import, 전체 검증 뒤 원자적 교체, per-tab recovery와 project/document dirty 기준, 기존 설정 유지 |
| Potential regressions | Clock/DFF 속성 유실, 다운로드 취소를 저장 성공 처리, quota/탭 충돌, dirty 오판·파일과 복구본 혼동 |
| Required tests | Gate G + 구 v1·순차 fixture 왕복, 다중 문서 round trip, 미지원 버전/손상/실패/취소/확인 흐름, 설정·history·session 분리 |
| Completion criteria | 새 형식·구 import 계약 문서화, 실제 파일·복구 실패 원자성, 성공 전에 saved baseline 갱신 안 함 |
| Rollback strategy | 새 형식 원본/backup 보존, 구 reader 유지. 구 앱으로 읽을 수 없는 새 형식이 있으면 자동 downgrade 금지·사용자 export 경로 제공 |

## PR-5 — Electronics Workspace Skeleton

| 항목 | 내용 |
|---|---|
| Goal | 동일 프로젝트에서 전환 가능한 빈 Electronics workspace |
| Prerequisites | PR-4 통과, Electronics 범위 및 최소 문서 codec 계약 승인 |
| Target files | 신규 src/electronics 진입점, workspace 등록, Electronics 안내/빈 상태, 전환 테스트 |
| Expected changes | Logic/Electronics 탭, 마지막 활성 문서·Inspector 유지, 별도 circuit/runtime. 미구현 simulation은 비활성/안내 |
| Potential regressions | 빌드 모드와 workspace 혼동, 전역 CSS·설정 누출, Logic timer 잔류 |
| Required tests | Gate G + 두 workspace 교대, 각 문서 history/view/Inspector·저장 복원, 구 설정 유지·inactive 입력 격리 |
| Completion criteria | 단일 페이지·단일 앱, Logic 전체 회귀 통과, 가짜 아날로그 결과 없음 |
| Rollback strategy | Electronics 등록 해제. 이미 저장된 Electronics 문서는 제거하지 않고 미지원 형식으로 보존·안내 |

## PR-6 — Electronics Circuit Model

| 항목 | 내용 |
|---|---|
| Goal | 독립 component/terminal/net/단위 모델과 최소 편집·연결 검증 |
| Prerequisites | PR-5 통과, 소자·접지·단위·전원/연결 규칙·파일 version 명세 승인 |
| Target files | electronics model/editor/codec/renderer, 도메인 fixture와 unit/browser 테스트 |
| Expected changes | Logic Net을 수정하지 않고 Electronics 모델 추가. CAD 도형 입력 adapter만 공유 |
| Potential regressions | 위치 겹침을 접속으로 처리, 단위 혼동, 도메인 간 참조 혼입, common API의 Logic 회귀 |
| Required tests | Gate G + 접속/분기/삭제/Undo·단위·접지·모델 validator·파일 왕복·문서 격리 |
| Completion criteria | 정해진 소자 범위로 유효 netlist 입력 생성 가능, Logic import 직접 의존 0 |
| Rollback strategy | 신규 도메인 기능 revert, 발행한 파일 version의 reader/원본 보존 |

## PR-7 — Electronics Simulation Integration

| 항목 | 내용 |
|---|---|
| Goal | 승인된 디지털/아날로그 해석 범위의 실제 엔진 연결 |
| Prerequisites | PR-6 통과, 엔진/라이선스/자산·Worker·오프라인/수렴·해석 범위 ADR 승인 |
| Target files | electronics netlist/compiler/engine adapter/results UI, 필요 시 Worker 자산과 Vite 설정의 별도 검토 |
| Expected changes | 문서·revision·세대 토큰별 session, 단위 있는 결과·수렴 진단. mixed-signal 구현 제외 |
| Potential regressions | UI block, 취소 후 stale 결과, 다른 문서 결과 표시, WASM Pages 경로·번들 크기, 잘못된 수치 |
| Required tests | Gate G + 알려진 소회로 해석값/허용오차, 수렴 실패·취소·timeout·문서 전환·stale 결과 무시, 엔진 자산 Pages 검사 |
| Completion criteria | 독립 수치 oracle/허용오차, 실패 의미·라이선스 기록, Logic 의미론 불변, 실측 성능 기준 충족 |
| Rollback strategy | 엔진 adapter 기능 비활성화/revert, 도면 codec 보존. 결과 snapshot으로 잘못된 계산을 대신하지 않음 |

## 후속 문서 재배치

`docs/platform/{ARCHITECTURE,PROJECT_MODEL,WORKSPACE_MODEL}.md`, `docs/logic/*`, `docs/electronics/*`는 향후 목적지 제안이다. 기존 Master Spec 절/DEC→새 절 매핑, 모든 상대 링크·README·review 인용, authority 선언, 소유자를 표로 만든 뒤 소규모 이동 PR을 요청한다. 이동 승인 전에는 현 경로를 유지한다. [Documentation Audit](DOCUMENTATION_AUDIT.md)의 권위 표를 따른다.
