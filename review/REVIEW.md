# Circlith 독립 리뷰 — `feat/editor-prototype` @ 2c52562

리뷰어: Claude (독립 리뷰). 기준: `docs/CIRCLITH_MASTER_SPEC.md`. PR description은 사실로 전제하지 않고 코드와 실행 결과로 검증했다.

재현 테스트: [review_repro.test.ts](review_repro.test.ts), [review_repro.spec.ts](review_repro.spec.ts). 실행하려면 각각 `tests/unit/`, `tests/browser/`로 복사한다. 이 폴더는 untracked이며 커밋하지 않았다.

## Summary

React 없는 `Editor`, 전기 구조와 geometry의 분리, Draft와 history의 분리는 Master Spec 방향과 맞고, 핵심 안전 불변식 대부분이 실제로 지켜진다.

직접 실행해서 확인한 것:

- 기존 단위 테스트 8개, 브라우저 테스트 5개, `tsc --noEmit` 통과.
- Draft에서 Esc를 누르면 committed circuit이 변하지 않는다.
- 2단계 Ctrl+Z: 첫 입력은 Draft만 취소하고 history는 유지한다.
- Draft 생성/취소만으로 Redo branch가 지워지지 않는다.
- window blur와 pointercancel 시 drag가 rollback된다.
- 드래그 중 Ctrl+Z가 history를 남기지 않는다.
- 좌표가 겹쳐도 연결이 추론되지 않는다. `connect()`가 유일한 연결 생성 경로다.
- 같은 입력에 대해 `transform` 결과가 결정적이다.

그러나 입력 상태와 geometry에서 실제 재현되는 결함이 있다. HIGH 2건은 사용자가 의도하지 않은 핀에 연결하거나, 키보드가 완전히 죽는 문제다. 불변식 테스트 일부는 구조상 실패할 수 없는 동어반복이다.

BLOCKER(데이터 손실, Undo 손상, 저장/로드 손상)는 찾지 못했다. 저장/로드와 삭제는 아직 없어 검토 대상이 아니다.

## Blocking issues

### H1 — 오래된 hover 때문에 포인터 아래에 없는 핀에 연결된다

```text
Severity: HIGH
Location: src/ui/App.tsx:231, 266-300 (hover 갱신), 370-371 (Enter)
Problem: hover.current는 pointermove에서만 갱신된다. Pan 시작/진행, 캔버스 이탈, wheel, blur로
         핀이 포인터 아래에서 벗어나도 지워지지 않는다. pointerdown과 Enter는
         `target(e.target) ?? hover.current`, `editor.confirm(hover.current)`로 이 값을 신뢰한다.
Why it matters: 포인터 위치와 무관한 핀에 wire가 commit된다. Master Spec §1.1.3(의도하지 않은 연결 금지) 위반이다.
Reproduction: review_repro.spec.ts › B6, B5
  W → Input 핀 클릭(WIRE_DRAFT) → 대상 핀 위에 hover → Space+drag로 pan(핀이 포인터에서 멀어짐)
  → Space 해제 → Enter
Expected: 포인터 아래에 유효 대상이 없으므로 Enter는 아무것도 하지 않는다(wire 0개).
Actual: 이전 hover 핀에 연결되어 wire 1개가 commit된다(B5, B6 모두 실패).
Suggested fix: hover를 "마지막 pointer 좌표에서 계산한 파생값"으로 만든다.
  pan/wheel/pointerleave/blur/viewport 변경 시 cursor 좌표로 재계산하거나 undefined로 비운다.
  pointerdown과 Enter 직전에도 재계산한다.
Suggested test: B5, B6 그대로 사용한다.
Related Master Spec: §1.1.3, §13.2.5, §13.4, §7.5
```

### H2 — 컨텍스트 메뉴가 열리면 키보드 입력이 모두 죽고 Esc로 닫히지 않는다

```text
Severity: HIGH
Location: src/ui/App.tsx:200-212 (`editor.focus = "MODAL"`), 332-339 (가드), 531-562 (메뉴)
Problem: 메뉴를 열면서 상태만 MODAL로 바꾼다. DOM focus는 svg에 남고 dialog로 이동하지 않는다.
         svg keydown 가드는 `focus !== "CANVAS"`이면 return하므로 Esc도 무시된다.
         메뉴에는 Esc 핸들러가 없다.
Why it matters: 마우스로 버튼을 눌러야만 닫힌다. Modal은 입력 소유자이며 Esc는 "가장 가까운 층"을 닫아야 한다.
         `editor.focus`가 DOM focus와 별개의 두 번째 진실원이라 쉽게 어긋난다.
Reproduction: review_repro.spec.ts › B1
  부품 배치 → 우클릭 → Esc
Expected: 메뉴가 닫히고 canvas가 입력을 되찾는다.
Actual: 메뉴가 그대로 남는다(B1 실패).
Suggested fix: 메뉴 열 때 dialog 안으로 focus를 옮기고 Esc/바깥 클릭으로 닫는다. 닫을 때 svg로 focus를 복원한다.
  `editor.focus`는 `document.activeElement`에서 파생하거나 제거한다.
  부품 검색 dialog도 같은 구조로 정리한다.
Suggested test: B1.
Related Master Spec: §7.4, §19, §21
```

## Non-blocking issues

### M1 — 다중 선택 회전이 격자(10)를 벗어난 좌표를 만든다

```text
Severity: MEDIUM (쌍의 약 절반에서 발생)
Location: src/geometry/geometry.ts:57-67
Problem: 회전 중심을 항상 80x40 박스의 합집합 중심으로 계산한다. 이미 회전된 부품은 40x80이다.
         x=100과 x=130 두 부품이면 중심이 (115,100)이다. 90° 회전 후 위치가 (115,85)가 되어 격자 밖이다.
         이후 핀과 wire 끝점도 격자 밖이 된다.
Reproduction: review_repro.test.ts › R1. 두 AND (100,100),(130,100)를 함께 90° 회전하면 실패한다.
Expected: 모든 component와 pin 좌표가 10의 배수다(§13.4 grid=10).
Suggested fix: 중심을 격자에 snap한다(NEEDS SPEC DECISION: §12.3의 "표시된 selection bounds 중심"과 격자 중 무엇을 우선하는가).
  회전 후 상태를 반영한 실제 bounds를 사용한다.
Suggested test: R1, 그리고 임의 위치 쌍 × 4방향 property test.
Related Master Spec: §12.3, §13.4
```

### M2 — Safe Move가 wire를 자기 자신 위로 되접는다(spur)

```text
Severity: MEDIUM
Location: src/geometry/geometry.ts:86-94 (stretch)
Problem: 고정 waypoint까지만 다시 그리면서, 새 접근 구간이 기존 다음 구간과 공선이고 방향이 반대인 경우를 정리하지 않는다.
         `clean()`은 중복 점만 제거한다.
Reproduction: review_repro.test.ts › R2.
  Input→AND wire [(140,100),(200,100),(200,180),(260,180)]에서 Input을 아래로 200 이동한다.
  결과: (140,300)→(200,300)→(200,100)→(200,180)→(260,180).
  (200,100)↔(200,180) 구간을 두 번 지난다.
Expected: 공선 반전 없음(§12.2.7의 정신), 최소한 겹침 경고(§12.2.9).
Actual: 연결 그래프는 보존되지만 정체 모를 돌출선이 생긴다. 드래그 한 번으로 쉽게 발생한다.
Suggested fix: stretch 후 공선 점을 병합하고 반전 spur를 제거한다. 고정 waypoint가 spur 꼭짓점이면 버린다.
  제거 여부는 NEEDS SPEC DECISION(§12.2.2 "고정 waypoint 보존"과 충돌 가능).
Suggested test: R2와, 이동 전후 모든 인접 segment 쌍이 반전하지 않는다는 property test.
Related Master Spec: §12.2, §12.4
```

### M3 — `electricalGraph()` 불변식이 wire 끝점을 보지 못하고, transform 테스트는 구조상 실패할 수 없다

```text
Severity: MEDIUM
Location: src/model/circuit.ts:92-99, tests/unit/editor.test.ts:119,143,163
Problem: electricalGraph는 components/pins/nets/junctions만 직렬화한다. 연결의 실제 증거인
         geometry.wires[].from/to와 wire.net은 geometry 쪽에 있어 제외된다.
         transform()은 nets를 아예 건드리지 않으므로 "이동 전후 graph 동일" assertion은 transform이 어떻게 바뀌어도 통과한다.
         또한 JSON 문자열 비교라 net/pin 배열 순서에 민감하다.
Reproduction: review_repro.test.ts › R3. wire의 `to`를 다른 핀으로 바꿔도 electricalGraph 문자열이 같다(통과 = 불변식 도구가 맹목적).
Why it matters: Move/Rotate/Segment move가 연결을 바꾸는 회귀가 생겨도 잡아내지 못한다.
         이는 Master Spec §32가 가장 중요하게 보는 불변식이다.
Suggested fix: (1) wire endpoint까지 포함하고 정렬한 `connectivity(c)` 정규형을 만든다.
  (2) `validate(circuit)`를 만든다: wire.net 존재, 끝점이 net 목록에 속함, pin 존재, 중복 ID 없음.
  이 validator는 §27 로드 검증에도 재사용된다.
  (3) 테스트마다 validate와 connectivity를 확인한다.
Related Master Spec: §12.4, §27, §32
```

### M4 — 잘못된 조작에 대한 피드백이 없다 / 안내 문구가 오래 남는다

```text
Severity: MEDIUM (stale message 자체는 LOW)
Location: src/ui/App.tsx:32-34, 77-81, 489-494
Problem: (a) `message`는 Redo 차단 때만 설정되고 지워지지 않는다. Esc로 Draft를 닫은 뒤에도
             "초안을 확정하거나 취소한 후 Redo를 실행하세요."가 footer에 남는다.
         (b) 무음 no-op: 대상 없이 Enter(WIRE_DRAFT), 선택 없이 M, MOVE 중 R, WIRE_DRAFT 중 W,
             검색 결과가 여러 개일 때 Enter.
Reproduction: review_repro.spec.ts › B3 (stale message 확인).
Why it matters: 사용자는 입력이 왜 무시되는지 알 수 없다. 키 오입력인지 버그인지 구분할 수 없다.
Suggested fix: 거부 사유를 상태 기반 구조화 메시지로 반환하고 상태 전이 시 지운다.
Related Master Spec: §1.1.1, §7.6
```

### M5 — wire 끝점 검증이 전혀 없다 (NEEDS SPEC DECISION)

```text
Severity: MEDIUM
Location: src/editor/editor.ts:142-153, src/model/circuit.ts:63-91
Observation: output↔output, input↔input, 같은 두 핀 사이의 중복 wire(경로만 다름), 같은 부품 내부 핀끼리의 연결이 모두 허용된다.
         review_repro.test.ts › R4에서 확인했다. 연결 생성은 항상 명시적이므로 데이터는 일관된다.
현재 구현: 모두 허용.
대안 A: 편집 시 거부. 초보 사용자의 실수는 막지만, 의도적인 버스/풀업 회로까지 막을 수 있다.
대안 B: 허용하고 DEC-010의 진단(`DRIVE_CONFLICT`, `MULTIPLE_DRIVERS`)으로 표시. Master Spec의 방향이다.
내 추천: B를 유지하되 "같은 net에 이미 속한 두 핀을 중복 wire로 잇는 경우"만 경고 후보로 둔다.
Master Spec 영향: §13.2, §24. 변경 불필요.
```

## Master Spec mismatch

| 항목 | 상태 |
|---|---|
| §13.4 pin snap은 최근접 우선 | 후보가 2개 이상이면 hover를 비운다(`App.tsx:287-290`). B2 재현: zoom 0.5(허용 최소)에서 AND 입력 핀은 화면상 10px 간격이다. 핀에서 4px 벗어난 클릭은 연결되지 않고 waypoint가 추가된다. §30의 "50/100/200%에서 10회 중 9회" 기준과 충돌한다. 수정: 거리 오름차순으로 가장 가까운 핀을 선택한다(MEDIUM). |
| §33 pointermove마다 전체 재계산 금지 | MOVE 미리보기에서 pointermove마다 `transform()`(structuredClone)과 React 전체 render가 일어난다. 최신 포인터 좌표를 rAF에서만 반영한다(LOW, 측정 후 판단). |
| §19.2 modal 입력 소유 | H2 참조. |
| §8.2 `M`/`E`는 선택이 없으면 cursor 아래 대상 | 미구현(문서에 명시됨, scope 내 gap). |
| §12.2.9 겹침 경고 | 없음. M2 참조. |
| hover 링과 pin 후보가 committed 위치 사용 | MOVE 미리보기 중 핀 심볼은 이동 위치에, hover 링과 후보 계산은 committed 위치(`App.tsx:276-286, 423-432`)에 그려진다. 코드 리뷰로만 확인했고 실행으로는 확인하지 않았다(LOW). |
| 문서가 밝힌 미구현 | 분기 UI, 삭제, 저장/로드, box select, Alt snap, 복사/붙여넣기, E/F2. 결함이 아니라 scope gap으로만 기록한다. |

## Missing tests

1. 포인터 아래에 없는 핀에 연결되지 않는다 (H1: B5, B6).
2. Modal 입력 소유권: Esc로 메뉴가 닫히고 focus가 복원된다 (H2: B1).
3. zoom 50/100/200%에서 최근접 핀 선택 (B2).
4. 임의 선택 × 4방향 회전 후 모든 좌표가 격자 위에 있다 (R1).
5. 재작성된 `connectivity()`와 `validate()`를 모든 Move/Rotate 케이스에 적용한다 (M3).
6. 랜덤 시퀀스 property test: place/move/rotate/wire/undo/redo/Esc. Undo를 끝까지 하면 empty와 동일하고, Redo를 끝까지 하면 최종과 동일하며, 모든 단계에서 validate가 통과한다.
7. 다중 부품 이동이 Undo 1개인지 확인하는 테스트. 코드상으로는 맞지만 테스트는 단일 부품만 다룬다.
8. 같은 net의 두 부품을 함께/따로 이동, junction이 있는 net 이동, 다른 wire와 교차/겹침 이동 후 wire 수와 net 수가 불변.
9. Move 확정 후 Undo 중 Redo branch 유지, Draft 중 Redo가 막혔다가 Esc 후 되살아나는지 (단위 테스트에는 있으나 브라우저에는 없음).
10. 진짜 IME 세션. 현재 IME 테스트는 합성 keydown(`isComposing:true`)뿐이며, `IME_COMPOSING` 상태는 실제로 진입할 수 없다(svg는 composition 이벤트를 받지 않는다).

## Architecture observations

좋은 점:

- Editor가 React에서 독립되어 있고, model/geometry/renderer의 책임이 분리되어 있다.
- Draft는 committed circuit과 객체를 공유하지 않는다(`preview()`가 clone을 반환).
- Command가 before/after snapshot을 가지므로 Undo가 정확하다.
- 연결은 오직 `connect()`로 생성되며 좌표에서 추론하지 않는다.

우려 사항:

- UI가 Editor 필드를 직접 변경한다. `editor.draft.horizontal = !...`가 키와 버튼에 중복되어 있고, `editor.selection`, `viewport`, `transient`, `focus`도 마찬가지다. `toggleBend()`, `select()` 같은 API로 모으면 상태 전이를 테스트할 수 있다.
- `editor.focus`가 DOM focus와 이중 진실원이다(H2의 근본 원인).
- `App.tsx` 566줄에 gesture/hover/keyboard가 모여 있다. 지금은 허용 범위지만 Master Spec §3.4가 경고한 거대 controller의 초기 모양이므로, InputController(gesture·hover·키 매트릭스)를 분리한다.
- `ghost`를 만들기 위해 render마다 `addComponent`를 호출해 `randomUUID` key를 새로 만든다. 렌더 안의 ID 생성은 부작용이며 ghost SVG가 매 pointermove마다 remount된다.
- Wire가 `net`을 중복 보유한다(`wire.net`, `net.pins/junctions`). 삭제가 생기면 이중 상태 불일치 위험이 크다(M3).
- 보안/운영: `pages.yml`이 `feat/editor-prototype` push에서도 Pages(production environment)에 배포한다. 리뷰 전 브랜치가 공개 사이트를 덮어쓴다. main만 배포하는 것이 안전하다(LOW).
- `crypto.randomUUID`는 secure context가 필요하다. `http://<LAN IP>` 같은 비-secure origin에서는 ID 생성이 실패한다(SUGGESTION).

## 검증하지 못한 항목

- 실제 Windows 한글 IME 조합 세션.
- Alt 단독 hold의 브라우저 메뉴 포커스.
- 가운데 버튼 autoscroll (pointerdown의 `preventDefault`가 mousedown 기본 동작을 막는지 확인하지 못함).
- Edge, Firefox.
- 툴바 Undo/Redo 클릭 후 Ctrl+Z가 죽는 현상. 코드상 핸들러가 svg에만 있어 그렇다고 판단했으나 실행 확인은 하지 않았다(LOW).

Runtime: Node.js 22.23.3 (local workspace runtime).

## Merge recommendation

```text
REQUEST CHANGES
```

`main`으로 합치기 전에 H1, H2는 수정해야 한다. 둘 다 수정 범위가 작다. M1, M2, M3, 최근접 핀 선택은 이번 PR에서 같이 고치거나 후속 PR로 분리해도 된다. 다만 M3(불변식 도구)은 삭제와 저장 기능을 얹기 전에 반드시 선행되어야 한다.
