# 순차회로 인터페이스 구현·검증

2026-10-19. 사용자 “진행해” 요청으로 제안한 Clock/DFF 시간 인터페이스를 구현했다.
브랜치 codex/sequential-simulation, 시작 커밋 fc6520c. 작업 트리는 D:/Circlith/build/sequential-worktree다.
다른 에이전트의 claude/storage-recovery 작업은 수정하지 않았다.

## 구현

- Clock/DFF를 공통 부품 라이브러리·검색·배치·회전·연결·Properties·표시 이름에 통합.
  DFF 핀은 D/CLK/Q. 상승/하강엣지·초기 Q, Clock 주기·듀티·초기 레벨을 편집하며 1 Undo.
- 시뮬레이션 모드의 순차 도면에 실행바. Run/Pause, 다음 이벤트/선택 Clock 상승엣지/한 주기,
  Reset, 논리 시각, 독립 화면 재생 속도.
- 같은 시각의 소스 변화 일괄 적용 후 이전 Q 기반 DFF 동시 갱신. 파생 클럭은 delta 안정화.
  기존 4상태 조합 엔진과 진단 재사용. 순차 경계는 조합 피드백 SCC에서 제외.
- 구조 편집/Undo/Redo는 새 시간 세션. Input·시간·Q·파형 변화는 편집 history에 넣지 않음.
  실행 중 구조/수동 입력 잠금, 선택·pan·zoom·관측 허용. 숨겨진 탭에서 일시정지.
- Pause와 시뮬레이션 표시 토글은 상태 유지, Reset은 t=0·초기 Q·초기 Clock 위상·파형 초기화.
  외부 Input과 관측 목록은 Reset에서 유지.
- 파형/입출력·진단 탭, 핀/net 관측 추가·제거. 과거 커서는 현재 상태를 바꾸지 않음.
  32신호·512시각 한도, X/Z 문자·구간 표시, 새 관측 신호의 과거 값을 만들어 넣지 않음.
- 시간 정수 정밀도 검사, 동일 시각 64회/한 Step 2048개 시각 한도와 실패 원자적 복구·오류 정지.
- 낮은 높이 화면에서 실행바·도크가 겹치지 않으며 활성화 후 회로가 화면 밖이면 한 번 화면 맞춤.
  스크롤된 라이브러리의 부품이 sticky 헤더에 가려져 드래그가 실패하는 기존 경로도 scroll padding/margin으로 수정.
- Playwright에 CIRCLITH_TEST_URL을 추가해 다른 에이전트의 서버와 분리 검증.
  JSX automatic runtime과 React 개발 의존성 최적화를 명시하여 독립 worktree 환경에서도 일관되게 실행.

상세 의미론·수용 한도는 [SEQUENTIAL_SIMULATION.md](../docs/SEQUENTIAL_SIMULATION.md),
최상위 구현 기준은 Master Spec §25/DEC-013/DEC-021이다.

## 최종 검증

| 검증 | 결과 |
|---|---|
| TypeScript | 통과 |
| 전체 단위 | **425 passed, 1 skipped** (기존 opt-in soak). 새 time-session 11개 |
| 전체 브라우저 | **165 passed** (기존 161 + 순차 4) |
| editor/simulation 프로덕션 빌드 | 둘 다 성공 |
| editor production preview | **12 passed, 2 skipped** (시뮬레이션 전용 제외) |
| simulation production preview | **18 passed** (기존 UI/감사 14 + 순차 4) |

단위 검증: 활성/비활성 엣지, Input 변경 후 Q 유지, Reset, 원본 모델 불변, 등록 순서 무관 체인,
두 Clock 동시 처리, 비50% 듀티·초기 high·하강엣지, 파생 클럭, 수동·불명 CLK 및 X/Z D,
Step 구분·중간 이벤트 보존, 파형 상한·새 관측의 과거 공백, 속성 검증·실패 불변, Step 한도 롤백.

브라우저 검증: 실제 배치/배선, Input→DFF→Output, 파형 과거 값과 live Q 분리,
Run 편집/입력 잠금, Pause·표시 토글·Reset, Clock/DFF Properties 적용/취소/Undo,
세 Step, 초기 Q와 하강엣지 버블, 1024×420의 컨트롤 접근·회로 표시·overflow.

로그는 worktree의 build/sequential-{unit,browser,editor,simulation}-results.txt.
화면은 build/sequential-dff.png 및 build/sequential-small.png.
생성물은 Git에서 제외되어 있으며 소스 테스트로 다시 생성할 수 있다.
빌드 청크 경고는 남아 있다(editor 약 520kB, simulation 약 536kB).
실제 IME·스크린리더·사용자 사용성·대형 순차 회로 성능은 검증하지 않았다.

## 통합할 때 필요한 일

별도 저장·복구 브랜치는 Clock/DFF가 없는 구 모델의 kind 목록으로 파일을 검증할 수 있다.
통합자는 Clock/DFF kind·핀 역할·clock/dff 설계 속성 검증과 보존, 파일 버전/호환 정책을 함께 반영해야 한다.
실행 중 Q·시간·파형은 회로 파일 속성으로 저장하지 않는다.
이 브랜치에서 저장·복구 기능까지 완성했다고 판정하지 않는다.

미포함: 비동기 Set/Reset/Enable, 추가 FF/래치/레지스터, 입력 시간표, 파형 줌/팬/측정·export,
되감기·조건 정지, 물리 지연·setup/hold·메타안정성, 공개 사이트 배포.
