# 순차소자 확장·게이트 기억 회로

2026-10-19 · 기능 브랜치 codex/sequential-components · 기준 main 7c4d2ea.

규칙의 기준은 [Master Spec §25.2](CIRCLITH_MASTER_SPEC.md#252-순차소자-확장과-게이트-피드백--2026-10-19)다. 과거 저장소 감사 문서는 이전 main의 snapshot이며 이 기능을 기술하지 않는다.

## 추가한 부품

순차소자 폴더에 JKFF, TFF, SRFF, DFFE, DFFSR, DLatch, SRLatch를 추가한다. 기존 Clock/DFF의 핀·좌표·dff 속성은 그대로 유지한다. 새 부품은 마지막 핀이 Q 출력이고 왼쪽 핀의 이름과 순서대로 연결한다.

| 부품 | 입력 핀 | 사용 방법 |
|---|---|---|
| JKFF | J, K, CLK | 엣지에서 00 유지, 10 Set, 01 Reset, 11 Toggle |
| TFF | T, CLK | 엣지에서 T=1이면 Toggle. T=0이면 유지 |
| SRFF | S, R, CLK | 엣지에서 Set/Reset. S=R=1이면 Q=X |
| DFFE | D, EN, CLK | EN=1일 때만 엣지에서 D를 저장 |
| DFFSR | D, CLK, S, R | S/R은 활성 High 비동기 입력. CLK 없이도 우선 적용 |
| DLatch | D, EN | EN 활성 동안 D를 따라가며 비활성 때 값을 유지 |
| SRLatch | S, R | 활성 High Set/Reset. 00 유지, 11 금지(X) |

부품을 더블클릭해 Properties에서 초기 Q와 동작 엣지를 선택한다. DLatch는 EN 활성 레벨도 선택할 수 있다. 기본 초기 Q는 X다. 특히 JK/T를 Toggle만 하면 X에서 알려진 값이 되지 않으므로 초기 Q=0/1을 지정하거나 Set/Reset으로 초기화한다. 보수 출력은 NOT로 구성한다. 다중 비트 Register/Counter 전용 블록은 이번 범위 밖이지만 TFF를 연결한 리플 카운터와 DFF 체인은 지원한다.

Clock이 없으면 Run/Step이 비활성화된다. 래치와 수동 CLK 회로는 시뮬레이션을 켜고 Input을 바꾸면 t=0에서도 즉시 반응한다. 자동 실행 중에는 기존처럼 입력·구조 편집을 잠그며 일시정지 후 바꾼다. “초기화”는 시뮬레이션 세션을 다시 만드는 버튼이고 부품의 R 핀과 별개다.

## 게이트로 만든 래치의 기존 제한과 변경

기존 앱은 순환 게이트 출력을 항상 X로 처리했다. 따라서 NOR/NAND 2개로 직접 만든 SR 래치는 Set/Reset을 줘도 상태를 계산할 수 없었다. 현재 앱은 이런 회로를 상태 보존 세션으로 전환해 이전 게이트 출력에서 동시 반복으로 안정화한다. 알려진 상태에서 Set/Reset을 해제하면 유지된다. 어떤 안정 상태인지 결정할 수 없으면 임의의 값을 고르지 않는다.

각 강결합 성분은 최대 64회, 의존 순서대로 평가한다. 한 루프가 수렴하지 않아도 독립된 래치의 값을 지우지 않는다. 초기 상태 미정과 안정화 실패를 서로 다른 안내로 표시한다. 상태 없는 simulate API의 기본 보수적 계산은 유지하며 TimeSession만 피드백 안정화를 요청한다. 게이트만 있는 피드백 회로의 기존 입출력·진단 화면은 유지하며 Clock/기억소자가 있을 때만 시간 실행 UI를 표시한다. 물리적인 gate delay나 발진 주파수는 모델링하지 않으므로 임의의 발진기/게이트로 만든 경합 회로 모두를 보장하지 않는다.

## 구현·호환

- model/circuit: memory kind/핀 이름, 기존 DFF 형식 유지, 새 memory 속성.
- simulation/memory: JK/T/SR/D/Enable/비동기 S/R의 상태 전이와 불명 제어 병합.
- TimeSession: 동시 FF 갱신, 래치/파생 클럭 delta, 피드백 상태와 실패 rollback.
- simulator: SCC별 상태 보존 안정화와 진단, 기존 4상태 계산·다중 구동 규칙 유지.
- geometry/renderer/UI: 핀 좌표, 심벌·극성, palette/search, Properties/Inspector·파형.

main에는 회로 파일 저장이 아직 없다. 별도 storage/clipboard를 통합할 때 모든 새 kind의 핀 수·방향과 memory의 edge/initial/activeLevel을 검증·보존해야 한다. live Q/피드백 상태·시간·파형은 설계 속성에 저장하지 않는다. 새 부품을 구 parser가 조용히 잘라내도록 통합하지 않는다.

## 근거·검증 범위

JK/비동기 Set/Clear의 동작은 [TI SN74HC112 데이터시트](https://www.ti.com/lit/ds/symlink/sn74hc112.pdf), DFF 비동기 제어는 [TI SN74HC74 데이터시트](https://www.ti.com/lit/ds/symlink/sn74hc74.pdf), 투명 래치는 [Nexperia 74HC373 데이터시트](https://assets.nexperia.com/documents/data-sheet/74HC_HCT373.pdf)의 기능 표를 참고했다. 이는 이상적 공통 부품의 논리 기능 근거이며 특정 IC의 active-low 핀/전원/타이밍/3상 출력을 그대로 복제한 모델이 아니다. DFFSR·SRLatch의 S/R은 명시적으로 active-high다.

tests/unit/sequential-components.test.ts는 진리표·불명 제어·초기화·수동 CLK·비동기 우선순위·Properties/Undo·핀/회전 무결성·4단 리플 카운터·NOR/NAND 래치·독립 루프 실패 격리를 검증한다. tests/browser/sequential-components.spec.ts는 7종의 실제 배치/배선/입력/출력, 기본 게이트 7종의 모든 이진 입력 조합, 게이트 래치 유지·리셋, 새 속성/극성/Undo와 파형을 검증한다. 기존 순차/편집 회귀도 전체 실행한다.

### 로컬 실행 결과

기준 main 7c4d2ea에서 변경한 작업 트리, Windows/Node 24.19.0/Playwright Chromium v1248에서 검증했다. 실제 게시 커밋의 결과는 후속 PR/Actions를 따른다.

| 검증 | 결과 |
|---|---|
| 전체 단위 | 463 passed, 기존 opt-in soak 1 skipped (20 files) |
| 전체 브라우저 | 181 passed (기존 165 + 신규 16), 약 2.6분 / 2 workers |
| TypeScript | tsc --noEmit 통과 |
| Vite 일반/Pages production build | 통과; JS 약 541.60 kB, 기존 500 kB 청크 경고 유지 |
| Pages assemble/check | 단일 경로·구 경로 404·설정·DFF·시간/파형·새 palette·SRLatch Set/유지/Reset 모두 통과 |
| 기존 회귀 테스트·의존성·Actions workflow | 변경/삭제 없음 |

첫 전체 브라우저 실행에서 게이트 피드백을 순차 UI로 바꿔 기존 진단 영역을 찾을 수 없는 회귀를 발견했다. 제품 UI를 원래대로 유지하도록 고치고 기존 테스트 기대값을 그대로 둔 재실행에서 181개가 통과했다. 신규 테스트의 조합/순차 탭 선택 오류와 개발 중 새로고침도 해결한 후 소스를 고정해 검증했다.

사용자 문제 회로 원본은 제공되지 않아 일반적인 “많은 회로가 작동하지 않음”의 모든 사례가 동일 원인이었다고 단정하지 않는다. 확인해 수정한 것은 게이트로 만든 기억 회로의 X 고정 제한과 이번 확장 중 발견한 초기 안정화/화면 회귀다.
