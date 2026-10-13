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
- DEC-008: 우클릭 메뉴, Space/middle drag Pan.
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

- 부품 핀과 공유 junction은 별도 endpoint이다. 현재 UI는 pin-to-pin 배선만 제공한다. junction 분기는 모델·geometry에서만 지원하며 분기 UI는 후속 작업이다.
- 양쪽 endpoint의 부품이 선택되면 내부 배선 전체를 강체 변환한다. 한쪽만 선택되면 그 endpoint와 인접한 첫 waypoint 사이만 직각으로 늘린다. 외부 공유 junction은 고정한다.
- 다중 회전 중심은 현재 동일한 부품 bounds(가로 80, 세로 40)의 합집합 중심이다. 새 pin 법선 방향 강제는 미구현이며 Master Spec의 잠정 회전 규칙에 대한 후속 검증 대상이다.
- Waypoint는 사용자 클릭 단위 checkpoint로 관리한다. Backspace는 자동 bend 하나가 아니라 마지막 클릭 전체를 제거한다.
- History snapshot 방식은 정확한 복원을 우선한 초기 선택이다. 큰 회로 메모리 사용과 응답성은 측정하지 않았다.
- grid=10, pin hit=9 screen px, drag threshold=4 screen px는 검증 전 가설이다. zoom 범위는 프로토타입에서 50–200%로 제한했다.
- 검색 라이브러리는 세 부품만 포함한다. exact/prefix/부분 문자열 및 in/out 별칭을 제공한다. 결과가 하나면 Enter, 여러 결과는 명시적 버튼 선택. Favorites/recent/fuzzy 확장은 후속이다.
- 저장·자동 복구·시뮬레이션·분기 UI·box select·삭제·clipboard·Properties·hover 부품 명령·키 재배정·Alt snap은 미구현이다. 새로고침 후 회로는 유지되지 않는다.
- 4상태 truth/resolution과 feedback stabilization은 DEC-010 확정 전 구현하지 않는다. 시간·계층·Bus·Q Quick Place 등도 활성화하지 않는다.

## 입력 억제 범위

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

2026-10-13 검증: build 성공, 단위 테스트 8개, 브라우저 시나리오 11개 통과. dependency audit에서 보고된 Vitest 취약점은 패키지 업데이트 후 해소했다. 사용성·성능 검증 완료를 뜻하지 않는다.

브라우저 시나리오: 연결된 부품의 pointer 이동·회전 및 정확한 wire Undo, 배치/선택/이동/회전/정확한 Undo·Redo, wire bend/Backspace/commit/복원, text/IME/Tab/autorepeat 보호, Pan 중 Draft 유지 및 pointercancel rollback.

## 독립 리뷰용 범위

목적: 안전한 첫 편집 흐름과 책임 경계 검증.
변경 범위: TypeScript/React/Vite 앱, 모델·geometry·editor·SVG·테스트 및 실행 문서.
구현하지 않은 범위: 위 한계 목록과 첫 사용 가능 버전의 저장·시뮬레이션.
알려진 문제: 범위 밖 명령·플랫폼은 검증하지 않았으며 새 pin 법선 routing은 후속이다.
설계 판단: snapshot history와 endpoint 기반 연결 분리. PROVISIONAL 결정은 확정 상태로 변경하지 않았다.

Claude 독립 리뷰를 로컬 `review/`에서 확인했다. 오래된 hover의 canvas 이탈 재현은 ACCEPT하여 이번 입력 변경에서 수정했다. Pan 시작점에 핀이 있는 재현은 Pan 후 핀이 포인터 아래에 그대로 있으므로 실패 결과만으로 잘못된 접속을 입증하지 못한다. 메뉴 Esc와 연결 검증 보강 등 나머지 항목은 후속 작업이며 이번 드래그 입력 변경에서 완료했다고 주장하지 않는다. 독립 리뷰 원본은 이번 변경에 포함하지 않았다.
