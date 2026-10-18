# FIX_PLAN — 수정 제안 (코드는 수정하지 않음)

순서는 권장 착수 순. 각 항목: Severity / Effort / Regression risk / 파일 / 의존 / 테스트.

| # | 항목 | Sev | Effort | 회귀 위험 | 파일 | 의존 | 필요한 테스트 |
|---|---|---|---|---|---|---|---|
| 1 | **F2** 토글은 “버튼 0·수식키 없음·이동 임계값 미만 클릭”만 소유. 나머지는 resolver로 전달. Space keydown/up 소비 금지. 토글 후 `svg`로 focus 복원. draft 중 토글 unmount 대신 disabled | P2 | S–M | 중 (제스처/선택 충돌) | `renderer/CircuitSvg.tsx`, `ui/App.tsx` | 없음 (선택 정책 결정과 함께) | `qa-tests/browser/f2.spec.ts` (`lost effects == []`), `presets.spec.ts` 8프리셋, 토글→Space-drag 첫 시도 pan, 토글→W→Esc |
| 2 | **N7** 렌더 비용: (a) 핀 연결 여부를 `Set`으로 1회 계산(`useMemo[circuit]`), (b) `collisions`는 장애물 rect를 1회 계산·필요 시에만, (c) 컴포넌트/배선 서브트리 `React.memo`, (d) wireBridges 줌 단계에서 재계산 최소화 | P2(perf) | M | 낮음 | `renderer/CircuitSvg.tsx`, `ui/App.tsx:534`, `geometry/routing.ts` | 없음 | `qa-tests/browser/profile.spec.ts` 예산(예: 1000게이트 토글 < 100 ms, 500 < 50 ms) + 기존 141 |
| 3 | **N1** 입력 수 변경 후 배선이 몸체를 관통하면 재라우팅(`planRoute`, anchors 존중) 또는 Apply 거부+안내 | P2 | M | 중 | `model/component-properties.ts` | 제품 결정 O-5 | `qa-tests/unit/collisions.test.ts` (introduced == 0, 320 시나리오), 기존 properties 테스트 |
| 4 | **F1** 합성 신호를 별도 Map/객체 키로 분리 (prefix 방식 금지). 필요 시 ID 형식 검증 병행(별개 결정) | P0 (비노출) | S | 낮음~중 | `simulation/simulator.ts` | **저장/불러오기 도입 전 완료** | `prior.test.ts` F1 블록, result.pins 완전성, ID 개명 메타모픽 |
| 5 | **F3/P3-5** validator 형태 방어(레코드/하위 필드 존재 확인 후 진행), compile 경계에서 통제된 오류 → `INVALID_CIRCUIT` (정상값 반환으로 삼키지 말 것) | P2 | S–M | 중 (공통 validator) | `model/connections.ts`, `simulation/simulator.ts` | 4와 함께 | `prior.test.ts` F3 24 fixture 전부 no-throw + INVALID_CIRCUIT |
| 6 | **N2** 반전 버블: lead 끝 `max(edge-8, -38)` 또는 XOR 보조 곡선/버블 위치 조정; 핀 점 r=5와 버블 겹침 정리 | P3 | S | 낮음 | `renderer/GateBody.tsx` | 없음 | `qa-tests/unit/geometry.test.ts` (reversed==0, pinInsideBubble==0), 브라우저 DOM 거리 ≥ r |
| 7 | **N3** Apply의 경로 단순화를 anchor-aware로(planRoute와 동일), 실패 시 의미 있는 메시지 | P3 | S | 낮음 | `model/component-properties.ts` | 3과 함께 | `properties.test.ts` waypoint 40 시나리오 → rejected 0 |
| 8 | **N4** 모달 backdrop pointerdown에서 focus 유지 또는 document 레벨 Esc | P3 | S | 낮음 | `ui/App.tsx`, `ComponentProperties.tsx`, `InputSettings.tsx` | 없음 | `props.spec.ts` backdrop-focus (Esc가 닫음) |
| 9 | **P3-4** validate adjacency `Map<string,string[]>` push 방식 O(E) | P3 | S | 낮음 | `model/connections.ts` | 없음 | `perf.test.ts` 8000 sink < 100 ms |
| 10 | **P3-6** 잘못된 Input 값 정책 구현(거부 진단 또는 X) | P3 | S | 낮음 | `simulation/simulator.ts` | 결정 O-2 | `prior.test.ts` P3-6 |
| 11 | **P3-8/11** 진단 objects dedupe, 메시지에 ID/위치; INVALID 시 값 표시를 `X`와 구분(예: `—`/오류 배지) | P3 | S | 낮음 | `simulator.ts`, `CircuitSvg.tsx`, `SimulationPanel.tsx` | 없음 | `prior.test.ts`, `invalid.spec.ts` |
| 12 | **N5** 빌드에 commit 해시 주입(`define`) → `assemble-pages`가 dist 내부 값과 대조 | P3 | S | 낮음 | `vite.config.ts`, `scripts/assemble-pages.mjs` | 없음 | stale-dist 재현 스크립트가 거부되는지 |
| 13 | **N6/P3-10/P3-9** 문서: 테스트 수(340+1/141), Space/상단 이름 문구, X pessimism, 현재 선택 정책 | P3 | S | 없음 | `docs/SIMULATION.md`, `README.md` | F2·정책 결정 후 | — |
| 14 | 테스트 보강 편입: oracle(전수), fuzz(고정 seed 1–2개), 변이 생존 M04/M05/M17 대응 테스트, 고아 pin fixture | – | M | 없음 | `tests/unit/*` | 1–11 | 변이 재실행 20/20 |

권고 순서 근거: 1–3은 사용자 경험, 4–5는 외부 데이터 경계 전 필수, 나머지는 소규모. 1과 2는 서로 독립이라 병행 가능, 3은 결정(O-5)이 먼저.
