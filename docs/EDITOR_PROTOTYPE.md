# 편집 프로토타입 구현 기록

구현 기준: [Master Spec](CIRCLITH_MASTER_SPEC.md). 이 문서는 구현 범위와 검증 기록이며 상위 설계를 대체하지 않는다.

## 목적과 관련 결정

첫 개발 목표인 Component 배치 → 선택 → Move → Rotate → Wire → bend 변경 → Esc → Undo를 검증할 실행 가능한 프로토타입을 만든다.

2026-10-13 사용자 후속 요청으로 부품 패널 드래그 배치와 도구 전환 없이 접점 클릭/드래그 배선을 추가했다. 도면 밖 부품 drop은 취소하며, 핀까지 wire drag 후 release는 하나의 Wire Command다. 빈 공간에서 release는 초안으로 유지한다. 캡처 상실과 pointercancel은 드래그 초안만 폐기한다. 좌표·접점 후보는 현재 포인터와 viewport로 다시 계산하여 canvas 이탈 후 오래된 hover로 Enter 연결되는 문제를 수정했다.

- DEC-001: Master Spec 우선. 기존 archive는 구현 기준으로 사용하지 않는다.
- DEC-002: M은 연결 유지 이동. G는 그리드 표시만 변경.
- DEC-003/004: A 검색, AND/Input/Output만 제공. Q/P 예약 기능 비활성.
- DEC-005: Tool / Operation / Transient / Focus 분리. 검증용 구현이며 결정 상태는 PROVISIONAL 유지.
- DEC-006: 첨부 개발 지시에서 명시한 2단계 Undo 적용. 첫 Ctrl+Z는 Draft만 취소. Draft 중 Redo 차단.
- DEC-007: 연결 그래프를 유지하는 최소 orthogonal stretch. 경로 정책은 PROVISIONAL 유지.
- DEC-008: 입력 지침을 반영해 Master Spec 기본값(짧은 RMB 메뉴, MMB/Space+LMB Pan)으로 정정했다. RMB drag Pan은 호환 프리셋/사용자 바인딩이다.
- DEC-011: 빈 공간 더블클릭 배선 확정 제외.
- DEC-015: 도면이 포커스를 소유할 때만 도면 키 처리. 아래 표와 브라우저 테스트로 현재 범위를 기록.

## 책임 경계

| 위치 | 책임 |
|---|---|
| `src/model/circuit.ts` | Component / Pin / Net / Junction stable ID, 명시적 연결과 net 병합 |
| `src/geometry/geometry.ts` | 좌표, 핀 변환, 직각 경로, 연결 유지 이동·회전 |
| `src/editor/editor.ts` | Draft, Command, History, 상태 전이. React 의존 없음 |
| `src/renderer/CircuitSvg.tsx` | 전달받은 회로의 SVG 표현. 논리 모델 소유 안 함 |
| `src/ui/App.tsx` | React UI, 포인터·키보드 입력, 화면 좌표 변환 |
| `tests/unit`, `tests/browser` | 모델·geometry·history 불변식, 실제 Chromium 상호작용 |

전기 구조와 도면 geometry는 서로 다른 필드에 저장한다. 연결은 좌표로 추론하지 않는다. Preview는 committed circuit을 변경하지 않는다. Command는 변경 전후 회로 snapshot을 보관한다. 선택·viewport·focus·Draft는 history에 넣지 않는다. 안정된 Draft는 Pan과 Tab 포커스 이동 동안 유지한다. 실제 drag는 pointercancel/capture loss/window blur에서 rollback한다.

## 잠정 설계 판단과 한계

- 부품 핀과 공유 junction은 별도 endpoint이다. 핀·접속점·선분 사이 배선과 명시적 교차점 접속을 제공한다. 선분은 commit 시 junction을 기준으로 분할한다.
- 양쪽 endpoint의 부품이 선택되면 내부 배선 전체를 강체 변환한다. 한쪽만 선택되면 그 endpoint와 인접한 첫 waypoint 사이만 직각으로 늘린다. 외부 공유 junction은 고정한다.
- 다중 회전 중심은 현재 동일한 부품 bounds(가로 80, 세로 40)의 합집합 중심이다. 새 pin 법선 방향 강제는 미구현이며 Master Spec의 잠정 회전 규칙에 대한 후속 검증 대상이다.
- Waypoint는 사용자 클릭 단위 checkpoint로 관리한다. Backspace는 자동 bend 하나가 아니라 마지막 클릭 전체를 제거한다.
- History snapshot 방식은 정확한 복원을 우선한 초기 선택이다. 큰 회로 메모리 사용과 응답성은 측정하지 않았다.
- grid=10, pin hit=9 screen px, drag threshold=4 screen px는 검증 전 가설이다. zoom 범위는 프로토타입에서 50–200%로 제한했다.
- 검색 라이브러리는 세 부품만 포함한다. exact/prefix/부분 문자열 및 in/out 별칭을 제공한다. 결과가 하나면 Enter, 여러 결과는 명시적 버튼 선택. Favorites/recent/fuzzy 확장은 후속이다.
- 저장·자동 복구·시뮬레이션·삭제·clipboard·Properties·hover 부품 명령·Alt snap은 미구현이다. 입력 재배정은 입력 프리셋 기록을 따른다. 새로고침 후 회로는 유지되지 않는다.
- 빈 공간 좌클릭 drag는 BOX_SELECT다. 좌→우는 핀을 포함한 부품 bounds와 배선 경로 전체가 포함된 대상을, 우→좌는 실제로 교차하는 부품·배선 선분을 선택한다. 회전과 zoom을 반영하고 Shift는 기존 선택에 추가한다. 선택은 release에서만 변경하며 취소는 기존 선택을 보존한다. PAN은 안정된 Draft와 selection/history를 유지하며 바인딩은 [입력 프리셋 기록](INPUT_CONTROLS.md)을 따른다. 단순 빈 공간 좌클릭은 선택 해제다.
- 4상태 truth/resolution과 feedback stabilization은 DEC-010 확정 전 구현하지 않는다. 시간·계층·Bus·Q Quick Place 등도 활성화하지 않는다.

## 배선 선택 보강 — 2026-10-15

배선도 클릭·Shift+클릭·선택박스·Ctrl+A로 선택하며 점선 강조와 선택 개수를 표시한다. 클릭 판정은 zoom과 무관하게 선 중심에서 6 screen px다. 배선 완료 후 WIRE 대기 상태에서 기존 선을 클릭하면 SELECT로 전환해 선택한다. 활성 배선 초안과 핀 직접 배선은 기존 동작을 유지한다. 후속 경로 편집 구현은 아래 기록을 따른다.

선택은 부품·배선 ID를 함께 보관하며 회로 편집/Undo 이후 실제 존재하는 ID만 유지한다. 배선만 선택한 상태에서는 부품 Move/Rotate 버튼을 비활성화하며, 혼합 선택의 부품 변환은 기존 endpoint 기반 배선 갱신 규칙을 따른다. Shift+Home은 선택 배선도 화면에 맞춘다. 선택으로 회로·history·Redo를 변경하지 않는다.

Node.js 24.19.0 / Windows / Playwright Chromium 156에서 빌드, 단위 테스트 27개, 브라우저 테스트 24개 통과. 기존 21개 브라우저 테스트와 배선 클릭·Shift·전체 선택·취소·Undo/Redo, L자 경로의 실제 교차, 50% zoom·Pan 후 screen px 판정 및 핀 배선 우선순위 회귀 테스트를 포함한다.

## 배선 경로 편집 구현 — 2026-10-15

Master Spec §12.5에 따라 선분·모서리 드래그, 국소 우회 구간 추가, 경로 다시 그리기와 일괄 가로/세로 우선 정리를 추가했다. `geometry/wire-edit.ts`가 geometry와 경로 검증을, `WireHandles.tsx`가 편집 핸들을 담당한다. Editor의 `SEGMENT_MOVE`/`WIRE_ROUTE` 초안은 확정 전 committed circuit을 바꾸지 않는다. `electricalGraph()`에 wire endpoint와 net을 포함해 기존 불변식 검사가 endpoint 변경도 검출한다.

조사 출처·조작법·기능 한계는 [WIRE_EDITING.md](WIRE_EDITING.md)를 따른다. Node.js 24.19.0 / Windows / Playwright Chromium 156에서 빌드, 단위 테스트 32개와 브라우저 테스트 29개 통과. geometry 조합 275개에서 고정 endpoint·직각·결정성·연결 보존을 확인하며, 브라우저에서는 직접 드래그·핸들·초안 취소·Undo/Redo·경로 다시 그리기와 50/200% zoom을 포함한다.

## 입력 억제 범위

2026-10-15 후속 배선 검토: `path.ts` 공통 정규화로 부품 Move/Rotate의 공선 되접힘을 수정하고, `model/connections.ts`의 분할·병합 transaction과 회로 검증기를 추가했다. 접속 후보는 `connection-hit.ts`에서 화면 거리·최근접·우선순위로 계산한다. 후보 선택 창은 MODAL 입력을 소유하고 Esc는 창만 닫아 안정된 배선 초안을 보존한다. WIRE 모드의 선 클릭은 분기이며 SELECT 모드의 선 클릭은 선택이다. 상세 조작과 검토 범위는 [배선 기능 재검토](WIRE_EDITING.md#배선-기능-재검토--분기와-연결망)를 따른다.

| 입력/조건 | handled | preventDefault | stopPropagation | 안내/브라우저 검증 |
|---|---|---|---|---|
| CANVAS Ctrl+Z | yes | yes | yes | Draft만 취소 또는 History Undo. Chromium 검증 |
| CANVAS Ctrl+Shift+Z / Ctrl+Y | yes | yes | yes | Draft 중 차단 안내. Chromium 검증 |
| CANVAS WIRE_DRAFT Shift+Space | yes | yes | yes | bend 변경. page scroll 없음 |
| CANVAS Space/middle drag | yes | yes | 키만 yes | Pan. 안정된 Draft 유지 |
| Tab | no | no | no | 기본 탐색. drag 진행 중 rollback |
| TEXT / MODAL / IME | no | no | no | canvas handler에서 명령 실행 안 함 |
| Ctrl+D / Ctrl+S/O/F 등 미구현 키 | no | no | no | browser 기본 동작 유지 |
| canvas contextmenu | yes | yes | no | prototype 메뉴 |
| Alt/Meta 조합 | no | no | no | 별도 지원 검증 전 미구현 |

문자 단축키는 체크박스로 끌 수 있고, 핵심 명령은 버튼 경로를 제공한다. 회전 등 일회성 명령의 autorepeat는 무시한다. 실제 Windows 한/영 전환 및 IME 조합 세션, Chrome/Edge 전체 UI의 예약키·Alt·autoscroll 실측, 사용자 사용성 검사는 아직 수행하지 않았다. 합성 IME 이벤트 테스트를 실제 IME 검증으로 간주하지 않는다.

## 실행 및 검증

Node.js 22.23.3, Windows, Playwright Chromium 156에서 실행했다.

```sh
npm ci
npm run dev
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

초기 선택박스 단계 검증: 단위 테스트 10개, 브라우저 시나리오 14개 통과. 입력 프리셋 이후 전체 검증 결과는 [INPUT_CONTROLS.md](INPUT_CONTROLS.md)에 기록한다. 사용성·성능 검증 완료를 뜻하지 않는다.

브라우저 시나리오: 연결된 부품의 pointer 이동·회전 및 정확한 wire Undo, 배치/선택/이동/회전/정확한 Undo·Redo, wire bend/Backspace/commit/복원, text/IME/Tab/autorepeat 보호, Pan 중 Draft 유지 및 pointercancel rollback.

## 독립 리뷰용 범위

목적: 안전한 첫 편집 흐름과 책임 경계 검증.
변경 범위: TypeScript/React/Vite 앱, 모델·geometry·editor·SVG·테스트 및 실행 문서.
구현하지 않은 범위: 위 한계 목록과 첫 사용 가능 버전의 저장·시뮬레이션.
알려진 문제: 범위 밖 명령·플랫폼은 검증하지 않았으며 새 pin 법선 routing은 후속이다.
설계 판단: snapshot history와 endpoint 기반 연결 분리. PROVISIONAL 결정은 확정 상태로 변경하지 않았다.

Claude 독립 리뷰를 `review/`에서 확인했다. 오래된 hover의 canvas 이탈은 드래그 입력 변경에서, 메뉴 Esc는 입력 프리셋 변경에서 수정했다. 당시 리뷰와 후속 disposition은 [REVIEW_RESPONSE.md](../review/REVIEW_RESPONSE.md)에 보존한다. 다중 회전·routing·graph validator 문제를 이번 입력 변경에서 해결했다고 주장하지 않는다.
