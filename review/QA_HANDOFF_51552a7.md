# Circlith 독립 QA 인수인계 — `feat/editor-prototype` @ 51552a7

대상: 구현 담당 에이전트. 작성: 독립 QA(Claude). 기준 문서: `docs/CIRCLITH_MASTER_SPEC.md`.
이 문서는 **무엇이 실제로 깨졌는지, 어떤 테스트로 재현되는지, 무엇을 고치면 통과로 바뀌는지**만 다룬다. 이전 `review/AUDIT_*.md`, `review/REVIEW.md`는 과거 기록이다.

## 0. 먼저 읽을 것

- 이 QA는 production 코드(`src/**`, `docs/**`)를 **수정하지 않았다**. 추가한 파일은 테스트 2개뿐이다.
  - `tests/unit/adversarial-latest.test.ts`
  - `tests/browser/adversarial-latest.spec.ts`
- 두 파일에는 **의도적으로 실패하는 회귀 테스트 8개**가 있다. 버그가 고쳐지기 전에는 `npm test`와 `npm run test:browser`가 red이고, `.github/workflows/pages.yml`은 두 테스트가 통과해야 배포한다. **실패하는 테스트를 삭제·약화·`skip`·`fails` 처리하지 말고 버그를 고쳐서 통과시켜라.** 기대값이 틀렸다고 판단되면 아래 "사용자 결정 필요" 항목처럼 사용자에게 먼저 묻는다.
- 기존 테스트(unit 75, browser 63)는 전부 통과했다. 새 테스트 중 통과하는 148개는 회귀 방지용이므로 그대로 둔다.
- 회로 무결성 쪽(delete / net 재분할 / Undo·Redo / Safe Move / 연결 보존)은 깨지지 않았다. **P0, P1 없음.** 아래는 전부 입력·UX 계층의 문제다.

## 1. 수정 대상 (우선순위 순)

### P2-1. 낮은 zoom에서 pin 포획 반경이 부품 몸체를 삼킨다

- 증상: Input을 놓고 약 25%로 축소한 뒤 몸체 중앙을 클릭하면 선택·이동 대신 배선 draft(`WIRE_DRAFT`)가 시작된다. AND를 약 50%로 보고 몸체 오른쪽 1/3을 클릭해도 같다.
- 실패 테스트
  - browser: `hit radius: AND at ~50% zoom …`, `hit radius: Input at ~25% zoom …`, `hit radius: Output at ~25% zoom …`, `hit radius: NOT at ~50% zoom …` (4개)
  - unit: `a gate's body centre is not swallowed by pin capture at the supported zooms`
  - 참고: `AND at ~25%` 케이스는 통과한다. 핀 3개가 거리 동률이라 선택 창이 뜨며 문제가 가려질 뿐이다. 이 통과를 근거로 해결됐다고 판단하지 마라.
- 원인
  - `src/geometry/connection-hit.ts:11` — 핀/junction이 13 screen px 안이면 무조건 다른 모든 후보보다 우선한다.
  - `src/ui/App.tsx:792` — `pin = target(e.target) ?? hitConnection(e)`.
  - `src/ui/App.tsx:806` — `pin`이 있으면 `wire.start`로 분기. 몸체 클릭 여부는 보지 않는다.
  - 몸체 중심에서 핀까지는 40 drawing unit이라 zoom ≤ 0.325에서는 몸체 전체가 13px 안이다.
- 수정 방향 (택1, 사용자 취향 문제이므로 구현 전에 선택지를 코드 주석이나 PR 설명에 남겨라)
  1. DOM 히트가 부품 몸체(`[data-component]`)이고 포인터가 몸체 내부면 몸체를 우선한다. 핀은 핀 원 DOM 히트이거나 몸체 밖일 때만 포획.
  2. 포획 반경을 `min(13px, 핀~몸체 가장자리 거리 × zoom)`처럼 zoom에 따라 줄인다.
- 통과 조건: 위 5개 테스트 통과. 기존 `wire hit tolerance stays in screen pixels…`, `branch button, wire tool and snap thresholds work at 50% and 200% zoom`, unit `allows pin/junction capture at 12px…`, `zoom N: a pin is captured at 12.9 screen px…`(새 테스트)가 계속 통과해야 한다. 즉 **핀 자체 근처의 13px 포획은 유지**하고 몸체 클릭만 구제한다.
- 주의: 핀 위에서 시작하는 드래그 배선(직접 배선)이 깨지면 안 된다.

### P2-2. 평행한 두 wire 중 클릭한 것이 아닌 wire가 선택된다 (그 상태에서 Delete하면 엉뚱한 wire 삭제)

- 증상: 서로 다른 net의 wire 두 개가 10 unit 간격으로 평행할 때, 50% zoom에서 A 선 위를 정확히 클릭해도 DOM 순서상 나중인 B가 선택된다. Delete는 B를 지운다.
- 실패 테스트: browser `hit radius: a wire sitting 5px from a parallel wire of ANOTHER net is selected by what is under the pointer (50% zoom)`.
- 원인
  - `src/ui/style.css:122` — `.wire-hit`이 12px non-scaling stroke(±6px)라서 5px 간격이면 영역이 겹친다.
  - `src/ui/App.tsx:766` — `objectKey`를 DOM 최상단 요소의 `data-wire-hit`에서 얻는다. 거리 비교가 없다.
  - 반면 `connectionHits()`는 최근접을 올바르게 고른다(unit 테스트 `parallel wires of different nets 10 units apart…` 통과).
- 수정 방향: wire 선택 대상을 `connectionHits`와 같은 최근접 계산으로 결정하거나, 겹침이 있을 때 최근접 wire를 고르는 별도 판정을 쓴다. 동률이면 기존 선택 창 정책을 따른다.
- 통과 조건: 위 테스트 통과 + 기존 `wire-selection.spec.ts` 전체 통과.

### P3-a. Redo가 corner 선택과 stale selection을 정리하지 않는다

- 증상
  1. wire를 편집 → Undo → corner 선택 → Redo: Redo로 wire geometry가 바뀌었는데 `.active-corner` 표시와 `selectedCorner`가 그대로 남는다. 이후 Delete는 **다른 위치의 corner**를 제거한다. 문서(`docs/DELETE_AND_SYMBOLS.md`, `EDITOR_PROTOTYPE`)는 Undo/Redo가 지운다고 적고 있다.
  2. 부품 Delete → Undo → 같은 부품을 다시 선택 → Redo: 부품이 다시 삭제되지만 `selection`에 삭제된 ID가 남는다.
- 실패 테스트
  - unit: `stale selectedCorner: a Redo that changes the wire geometry must drop the corner selection…`
  - unit: `stale selection: Redo of a delete must prune IDs that no longer exist`
  - browser: `stale corner after Redo: the highlighted corner must not survive an Undo/Redo that changes the wire`
- 원인: `src/editor/editor.ts:120` `redo()`가 `commit()`·`undo()`와 달리 `pruneSelection()`을 호출하지 않는다.
- 수정: `redo()`에서 circuit 교체 후 `this.pruneSelection()` 호출(= `selectedCorner = null` + 존재하지 않는 ID 제거). 한 줄 수준이다.
- 통과 조건: 위 3개 통과. `selectedCorner is cleared by Undo, tool change, box-select finish, Esc, any commit…`(이미 통과)이 유지되어야 한다.

### P3-b. 핀 고정 경유점이 있는 wire의 corner 삭제 실패 메시지가 불친절하다

- 증상: 다른 pinned waypoint를 보호하려고 삭제를 거부할 때 사용자에게 "배선 경유점 오류"만 보인다. 회로는 안전하다(변경 없음).
- 원인: `Editor.deleteSelection()`이 `assertCircuit` 예외 문구를 그대로 노출한다(`src/editor/editor.ts` corner 분기).
- 수정 방향: 이 경우를 잡아 "다른 고정 경유점 때문에 이 꺾임점을 제거할 수 없습니다. 경로 다시 그리기를 사용하세요." 같은 문구로 바꾼다. 전용 테스트는 없다. 추가하고 싶으면 fuzz 로그에서 재현된 `corner` 연산 + 앵커 2개 wire로 만들 수 있다.

### P3-c. 낮은 viewport 높이에서 부품 drop 후 페이지가 스크롤된다 (확신도 높음, 테스트 미저장)

- 관찰: `.app { height:100vh; min-height:500px }`(`style.css:47`)라서 창 높이 < 500px이면 문서가 스크롤 가능해진다. 높이 420px에서 palette drop 후 `svg.focus()`가 페이지를 38px 스크롤했다(`window.scrollY` 0 → 38). 560px에서는 재현되지 않는다.
- 수정 방향: drop 후 포커스 복원에서 `svg.current?.focus({ preventScroll: true })`를 쓴다(`App.tsx`의 palette `onPointerUp`와 `place()` 등. 버튼 `onClick`은 이미 `preventScroll`을 쓴다).
- 우선순위 낮음. 도면 좌표 계산 자체는 `getBoundingClientRect`를 써서 정확하다.

## 2. 사용자 결정 필요 (임의로 정하지 말 것)

구현자가 결정하지 말고 Master Spec에 DEC로 올리거나 사용자에게 묻는다.

1. **A, B 두 부품을 함께 삭제했지만 둘을 잇는 wire는 선택하지 않은 경우**: 현재는 양 끝이 서로 다른 dangling junction인 떠 있는 wire가 남는다. 결과는 valid하고 Undo도 정확하다. 이 동작이 의도인가?
2. **corner 삭제가 pin 출입 방향을 바꾼다**: 확인한 사례 — L자에서 corner를 지우면 Input 핀에서 수직으로 나가고, Z자의 두 번째 corner를 지우면 Output 핀으로 수직 진입한다. §12.3의 "pin 법선 방향 시작"은 PROVISIONAL이다. 법선 규칙을 corner 삭제에도 적용할지 정해야 한다.
3. **corner 삭제의 부수 효과 허용 범위**: 계단형 wire에서 한 corner를 지우면 이웃 corner 둘이 사라지고 새 corner가 생길 수 있다(끝점 고정 + 직각 제약 때문에 거의 불가피). "다른 corner를 지우지 않는다"가 어디까지 요구인지 정의가 필요하다.
4. **핀 포획 vs 몸체 우선순위**: §13.4는 pin/junction > wire > grid만 말하고 부품 몸체는 말하지 않는다. P2-1의 수정 방향 선택은 이 결정에 의존한다.

## 3. 통과해야 하는 목록 (회귀 방지)

수정 후 아래가 모두 통과해야 한다.

- 기존 unit 75, browser 63 — 변경 금지.
- 새 테스트 148개(전부 현재 통과) — 변경 금지. 특히 다음 그룹은 이번 수정의 부수 효과 감시용이다.
  - 핀 13px 포획 / 인접 AND 핀 / 평행 wire 최근접 / crossing 비병합 (unit `connection hit testing in screen space`).
  - `Delete under preset …` 4개 + 텍스트·모달·IME·wire draft 보호.
  - 실패한 gesture 매트릭스 8개(pointercancel, lostpointercapture, blur, Esc, Tab, Ctrl+Z, SVG 밖 release, blocked route).
  - fuzz 6개(seed 12345 포함).
- `npm run build`는 `tsc --noEmit`이 `tests/`도 타입 검사한다. 테스트 수정이 타입 오류를 내면 빌드가 깨진다.

## 4. 이번 QA의 방법과 한계

- **oracle 분리**: 새 unit 테스트는 구현 함수를 기대값 계산에 쓰지 않는다. pin 좌표(SVG rotate 모델), 회로 유효성(`rawCheck`), 연결 그룹(endpoint 인접 그래프)을 테스트 안에서 독립적으로 다시 계산한다. 제품 `validateCircuit`은 보조 검사로만 병행한다.
- **fuzz**: place / wire / waypoint wire / branch / move(+rotate) / rotate / delete(wire·component·혼합) / corner delete / segment·jog·corner edit / reroute / tidy / cleanup / crossing join / undo / redo를 고정 seed로 실행한다. 매 단계 검사: 두 validator, 좌표·직각·끝점 일치, wire/net/junction 참조, 10-grid 정렬, 실패한 연산 후 회로 불변, 전기적 identity(이동·회전·편집류), history 1개/0개, Undo·Redo 정확 복원, 전체 Undo = 빈 회로, 전체 Redo = 최종 상태.
- **soak**: 200 seed × 500 step(약 10만 step)도 통과했다. `FUZZ_EXTRA=200 npx vitest run tests/unit/adversarial-latest.test.ts -t soak` (기본은 skip).
- **한계**: fuzz는 pointer gesture가 아니라 Editor API를 구동한다. Safe Move/회전 후 wire가 부품 몸체를 피하는지는 fuzz가 확인하지 않는다(gate × 회전 개별 테스트에서는 확인함). 실제 Windows IME, Alt 키, 가운데 버튼 autoscroll, Edge/Firefox, 트랙패드, 성능, 대형 회로는 검증하지 않았다. 합성 IME 이벤트 테스트는 실제 IME를 대체하지 않는다. 이전 audit F9(핀 직접 배선이 Tool을 WIRE로 영구 전환)는 재검증하지 않았다.

## 5. 실행 방법과 환경 함정

Node가 PATH에 없을 수 있다. Codex 런타임 `C:\Users\user\.codex\tmp\circlith-runtime\node-v22.23.3-win-x64`를 PATH 앞에 추가해서 썼다.

```sh
npm run build
npm test                                   # unit (현재 3개 실패 = P3-a ×2, P2-1 ×1)
npm run test:browser                       # browser (현재 6개 실패 = P2-1 ×4, P2-2 ×1, P3-a ×1)
npx vitest run tests/unit/adversarial-latest.test.ts
npx playwright test tests/browser/adversarial-latest.spec.ts
```

- **`npm ci`를 dev server가 떠 있는 상태에서 실행하지 마라.** `npm run dev`(Vite)가 `node_modules/@esbuild/win32-x64/esbuild.exe`를 잡고 있으면 EPERM으로 실패하고 `node_modules`가 반쯤 지워진 채 남는다. 이번에 실제로 발생했고, 별도 clone에서 clean install 후 `robocopy`로 복구했다. 지금 `C:\worksplace\Circlith`에는 아직 도는 dev server(PID 21520, 10:26 시작)가 있을 수 있으니 필요하면 먼저 종료하라.
- Playwright 설정은 `127.0.0.1:5173` dev server를 `reuseExistingServer`로 재사용한다. 이미 떠 있는 서버가 다른 작업 트리를 서빙하면 엉뚱한 코드를 테스트한다.
- 새 browser 테스트의 좌표는 기본 viewport 1280×800, 기본 보기(zoom 1, 이동 없음)에서 svg 폭이 858px임을 전제로 한다. 도면 x > 858에 부품을 놓으면 canvas 밖 클릭이 되어 PLACE draft만 남는다(디버깅 중 내가 한 실수였다). 새 테스트를 추가할 때 주의하라.
- library scroll 테스트는 viewport 1280×560을 쓴다. 500px 미만에서는 P3-c 때문에 페이지가 스크롤된다.

## 6. 수정 후 확인 요청

1. 위 8개 실패 테스트가 통과하는지, 나머지가 그대로인지 전체 실행 결과(수치)를 보고한다.
2. P2-1/P2-2는 수정 방식을 1~2문장으로 설명하고, 어떤 기존 동작(핀 직접 배선, 분기 시작, 선택 창)을 일부러 유지했는지 적는다.
3. §2의 결정 항목은 구현하지 말고 사용자 질문으로 남긴다.
4. 이 문서의 어떤 주장이 코드와 다르다고 판단되면 테스트가 아니라 이 문서의 해당 항목을 반박하는 근거(재현 절차)를 제시한다.
