# Circlith 독립 구현 감사 보고서

- 대상: `feat/editor-prototype` @ `7ae3b32` (`fix: isolate app context menus from browser defaults`)
- 감사일: 2026-10-15
- 기준: `docs/CIRCLITH_MASTER_SPEC.md` (충돌 시 Master Spec 우선). `docs/archive/`는 요구사항으로 취급하지 않았다.
- 방식: 읽기 전용 정적 감사. 애플리케이션 코드는 수정하지 않았다(§8 참고).

## 1. 검증 환경과 한계

| 항목 | 상태 |
|---|---|
| `npm ci`, `npm run build`, `npm test`, `npm run test:browser`, `npm audit` | **실행하지 못함.** 이 PC에 Node.js가 없다(bash/PowerShell에서 `npm`, `node` 없음, Program Files·AppData·D: 검색 결과 없음, Claude.exe를 Node 대용으로 쓰는 시도는 접근 거부). 문서의 통과 수치는 확인하지 못했다. |
| `git diff --check` | working tree가 clean이어서 해당 없음 |
| 단위 테스트 개수 | `it(` 개수 50개 = 문서 50개 일치 |
| 브라우저 테스트 개수 | 실제 46개(`context-menu.spec.ts` 3개 포함) vs 문서 43개 |
| 대체 검증 | Python 재구현으로 (a) 프리셋 병합·충돌 검사, (b) 이동/회전/선분 편집 기하 fuzz 약 6만 건, (c) `projectSegment` 부동소수점 검사를 수행했다. TS 원본이 아니므로 확정 전 `npm test`로 재현해야 한다. |
| 브라우저 동작 | 트랙패드 휠, 포커스 이동, 숫자 입력 타이핑 등은 코드 읽기로 추정했다. 실제 Chromium 동작은 미확인. |
| 지시문 | 전달받은 지시문이 §5.1(하드코딩 재유입) 중간에서 끊겨 있었다. 5.2 이후 항목은 검토하지 못했다. |
| 작업 중 변화 | 감사 중 HEAD가 `7547b64` → `7ae3b32`로 이동했다(우클릭 메뉴 격리). 해당 diff도 검토했다. |

## 2. 총평

- 구조(React 없는 Editor, 전기 구조와 geometry의 분리, 초안과 history의 분리, snapshot 기반 정확한 Undo)는 Master Spec 방향과 맞고, 이동·회전·선분 편집 geometry는 fuzz에서 위반이 나오지 않을 만큼 견고하다.
- 데이터 흐름 `DOM → Resolver → Command ID → Dispatcher → handler → Editor`는 유지된다. `if (preset === ...)` 같은 프리셋 이름 분기는 없다.
- 반면 좌표 정밀도, 상태 전이의 예외 경로, 포커스 소유권, 프리셋 병합, 성능 구조에 실제 결함이 있다. 데이터를 직접 파괴하는 BLOCKER는 찾지 못했다.

## 3. 발견 사항

### F1 · 중상 · `projectSegment` 부동소수점 오차로 분기점이 격자에서 벗어남
- 위치: `src/geometry/connection-hit.ts:24`, `src/ui/App.tsx:310`, `src/geometry/path.ts:26`
- 원인: 스냅한 점을 `projectSegment`로 다시 투영하며 `a.x + t*dx`를 계산한다. 결과가 정수가 아닐 수 있다.
- 재현: 가로선 (870,540)→(30,540)의 x=380 투영 → 379.99999999999994. (20,130)→(310,130)의 x=190 → 189.99999999999997. 정수 격자점 약 20만 개 중 약 0.7%에서 오차가 발생했다(JS와 같은 IEEE 연산).
- 영향:
  - junction이 비정수 좌표에 생성된다.
  - 끝점 근처 분기에서 `same()` 비교가 실패하면 길이 약 1e-14의 사실상 0길이 wire 조각이 생길 수 있다(§12.4 "0길이 segment 없음" 위배).
  - 두 교차선의 hit 위치가 `same()`으로 일치하지 않으면 `joinCrossing`이 "같은 교차점을 선택하세요"로 실패한다(`src/model/connections.ts:63`). 후보 창의 "이 교차점을 접속" 버튼도 숨겨진다(`App.tsx:1117`). 교차점 약 1~1.4%에서 발생한다.
- 근본 원인: 좌표 동등성 정책이 둘로 갈라져 있다. `same`, `simplifyPath`, `validateCircuit`은 엄격한 `===`, `pointOnSegment`는 1e-7 허용오차다. `validateCircuit`에는 정수/격자 좌표 검증이 없다.
- 수정안: 투영 대신 스냅된 좌표를 쓰고 선분 범위로만 clamp한다. `validateCircuit`에 "저장 좌표는 정수" 불변식을 추가한다. 동등성 정책을 한 곳으로 통일한다.
- 누락 테스트: 임의 선분 × 격자점 property test. 현재 테스트는 우연히 정확한 값만 쓴다.

### F2 · 중 · 일회성 `rotate()` 실패 시 원점 기준 MOVE 초안이 남아 부품이 튐
- 위치: `src/editor/editor.ts:228-238`, `:131`, `:285`
- 원인: 초안이 없을 때 `rotate()`는 `move({0,0})`로 `origin=(0,0)` 초안을 만들고 `confirm()`을 호출한다. `confirm()`은 `blocked`이면 `cancel()` 전에 throw한다.
- 재현: 단일 AND에 연결된 wire에 수동 경유점이 있고, 회전 후 몸체(여유 10 포함)가 그 경유점을 덮는 경우 R을 누른다. 몸체 영역이 가로 ±30에서 세로 ±40으로 커진다.
- 영향: 오류 메시지만 보이고 `MOVE{origin:(0,0)}` 초안이 남는다. 다음 pointermove에서 `update()`가 position을 커서 절대 좌표로 바꿔 delta가 커서 좌표만큼 되어 선택 부품이 도면 밖으로 튄다. Esc로 복구는 되지만 §7.5에 어긋난다.
- 수정안: `rotate()` 안에서 실패 시 `cancel()` 후 재throw, 또는 실제 커서를 origin으로 쓰는 별도 즉시 변환 API.
- 누락 테스트: 차단 상태에서의 one-shot rotate.

### F3 · 중 · 툴바/팔레트 버튼 클릭 후 `editor.focus="MODAL"`이 되어 휠 줌과 키가 죽음
- 위치: `src/ui/App.tsx:510-517`(`onFocusCapture`), `:422-428`(휠 핸들러)
- 원인: svg 밖의 모든 버튼 포커스를 `MODAL`로 기록한다. 휠 핸들러는 `contexts()`가 `["modal"]`이면 canvas 바인딩을 적용하지 않는다. 키보드 핸들러는 svg에만 달려 있다.
- 재현: Undo/Redo/선택/설정 버튼을 클릭한 뒤(포커스가 버튼에 남음) 도면 위에서 휠을 굴리면 줌이 안 된다. Ctrl+Z/Y도 안 된다. 도면을 클릭해야 풀린다.
- 비고: 이전 리뷰가 "검증 못함 LOW"로 남긴 항목이며 코드상 확정이다.
- 수정안: `editor.focus`를 DOM 포커스에서 파생하거나 제거한다. 일반 버튼은 `MODAL`이 아니라 canvas 입력 소유로 보고, 클릭 후 svg로 포커스를 복원한다.

### F4 · 중 · 휠 줌이 delta 크기를 무시
- 위치: `src/ui/App.tsx:242-256`, `:422-437`
- 이벤트마다 부호만 보고 ×1.1 / ÷1.1을 적용한다. 트랙패드는 작은 delta를 초당 수십 번 보내므로 줌이 폭주한다.
- `deltaY === 0`이면 방향이 "down"으로 처리되고 `direction<0`이 거짓이라 줌 아웃된다. 수평 스크롤이 줌 아웃을 일으킨다.
- 스펙 §2.1은 트랙패드 대안을 요구한다. 기존 테스트는 `wheel(0,100)` 8회 고정이라 잡지 못한다.
- 수정안: `deltaMode`/크기 정규화(`exp(-deltaY*k)`)와 `deltaY==0` 무시.

### F5 · 중 · `fitView` 줌 범위(0.1)와 `zoomAt` clamp(0.5) 불일치
- 위치: `src/geometry/view.ts:28`, `src/ui/App.tsx:248`
- 큰 회로에서 Home을 누르면 줌 0.24 등이 된다. 이후 `-`(줌 아웃)를 누르면 `max(0.5,…)`로 오히려 줌 인되어 0.5로 튄다. `+`도 24%→50%로 점프한다.
- EDITOR_PROTOTYPE.md의 "50–200%"와도 불일치한다.
- 누락 테스트: Home 후 줌.

### F6 · 중 · 프리셋 병합이 의도치 않은 키를 지움 (Python 시뮬레이션으로 확인)
규칙: `src/input/profiles.ts:132-147` — 자식이 같은 command ID를 정의하면 부모의 해당 command 바인딩을 전부 제거한다.
- **Ctrl+Shift+Z Redo 소실**: KiCad, Altium, EasyEDA, Fusion Electronics에서는 Ctrl+Y만 남는다. 푸터는 모든 프리셋에서 "Ctrl+Shift+Z Redo"를 고정 문구로 표시한다(`App.tsx:1098`). INPUT_CONTROLS.md도 native-extensions가 "보존"된다고 적었다.
- **Altium**: `tool.select`(V)가 `V,F`의 접두어라 제거된다. 반시계 회전은 Space가 placement/move 컨텍스트에만 있어 선택 부품의 일회성 반시계 회전 키가 없다(Shift+R 시계만 남음).
- **Fusion Electronics**: `wire.start`를 R에 매핑해 R(반시계 회전)과 W가 사라진다. 이 매핑이 원출처와 맞는지는 확인하지 못했다. 다만 고정 문구 "드래그 중 R: ↶ 90°"는 이 프리셋에서 틀린다.
- 참고: 모든 내장 프리셋에서 `selection.box ↔ selection.replaceItem`이 "gesture" 충돌로 항상 표시된다(의도된 구분이지만 "충돌 없음"은 영영 표시되지 않음).
- 수정안: 병합 규칙을 "같은 command의 같은 context 그룹만 대체"로 좁히거나, 프리셋별 기대 바인딩 표를 스냅샷 테스트로 고정한다. 안내 문구는 프로필에서 생성한다.

### F7 · 중 · 성능 구조 (§33 위배, 문서도 "측정 안 함"으로 인정)
- pointermove마다 `hitConnection → editor.preview()`, render의 `previewResult()`(`App.tsx:452`), `snapHits → preview()`(`:459`)가 반복된다. `preview()` 한 번이 MOVE 중에는 `transform` + 충돌 wire 재탐색이다.
- `collisions`는 wire마다 `componentObstacles` 배열을 새로 만들어 O(W·C)다(`App.tsx:456`).
- A* 격자에 모든 부품의 모서리 좌표가 들어가고 30,000노드를 넘으면 `null`을 반환해 `blocked`가 된다(`src/geometry/routing.ts:83`). 도면이 넓거나 부품이 많고 정렬이 어긋나면 우회가 필요한 배선이 자동 우회 모드에서 확정 불가가 된다. 현재 테스트의 100개 대각선 배치가 이 한계를 재현한다. 질의 근처 장애물만 쓰는 방식이 필요하다.
- 유령 부품은 render마다 UUID를 새로 만들어 SVG가 매번 remount된다(`App.tsx:478`). 이전 리뷰가 후속으로 미룬 항목이다.
- 수정안: pointer 입력은 rAF당 한 번만 반영하고, preview는 draft 변경 시점에만 계산해 캐시한다.

### F8 · 중하 · 확정이 막힌 뒤 놓은 드래그가 버튼 없이 커서를 따라다니는 초안으로 남음
- 위치: `src/ui/App.tsx:890-900` 부근. 이동/선분 편집의 `pointerup`에서 `confirm`이 `blocked`로 throw하면 `gesture`는 이미 null이다.
- MOVE/SEGMENT_MOVE 초안이 남아 버튼 없는 pointermove로 계속 갱신되고, 클릭하면 다시 확정을 시도한다. §7.5의 "drag release → 확정"과 다르다.

### F9 · 중하 · 핀 직접 배선이 Tool을 WIRE로 영구 전환
- 위치: `src/editor/editor.ts:244`. 배선을 끝내도 WIRE 도구가 남는다.
- 이후 부품 몸체 클릭이 선택/이동되지 않고 선택박스도 막힌다(`App.tsx:771`). V나 Esc가 필요하다.
- 문서는 "도구 전환 없이 접점 배선"이라고 하며 테스트도 배선 후 `data-tool`을 확인하지 않는다. 의도라면 문서를, 아니면 코드를 고쳐야 한다.

### F10 · 중하 · 순차 키 대기시간 숫자 입력이 타이핑으로 편집 불가
- 위치: `src/ui/InputSettings.tsx:203-219`
- controlled input에서 `onChange`마다 `validateUser`를 돌린다. 입력 중간값("3" 등 100 미만)이 오류가 되면 값이 900으로 되돌아간다. 스피너나 붙여넣기 외에는 바꾸기 어렵다.
- 이 입력을 쓰는 브라우저 테스트가 없다(`fill()`을 썼다면 통과했을 구조).

### F11 · 낮음 · 무음 no-op과 오래 남는 안내
- 선택이 없을 때 M·R 키는 피드백이 없다. 이전 리뷰 M4가 일부 열려 있다.
- WIRE_DRAFT 중 W는 무반응이다.

### F12 · 낮음 · 입력/운영 세부
- `keyToken`이 물리 키(`code`)를 쓴다. Dvorak/AZERTY에서는 표시 글자와 실제 키가 어긋난다. IME 안전성에는 유리하지만 문서에 없다.
- "문자 단축키 끄기"가 수식키 없는 A–Z만 막는다. Shift+R은 계속 동작한다(`src/ui/keyboardAdapter.ts:32`).
- 사용자 override 키가 바인딩 내용(`bindingId`)에서 나온다. 내장 프리셋 JSON을 고치면 저장된 override가 새 바인딩으로 오인되어 중복 충돌이 나고, 로드 실패 시 조용히 기본값으로 복구되어 사용자 설정이 사라진다.
- `.github/workflows/pages.yml`이 feature 브랜치 push를 곧바로 공개 Pages에 배포한다(소유자가 이전에 의도로 기각). CI에 `npm audit`이 없고 `package.json`에 `engines`가 없어 README의 "Node 22.23.3 이상"이 강제되지 않는다.

## 4. 입력 시스템 점검 (§5.1)

- 프리셋 이름 분기와 문자 키 하드코딩은 없다(grep 확인). 미구현 명령은 handler를 우회하고 안내만 표시한다.
- 남아 있는 하드코딩:
  - Esc: 후보 창, 메뉴, 검색, 설정이 `e.key`/`e.code === "Escape"`를 직접 비교한다(`App.tsx:1106`, `:1133`, `:1163`, `InputSettings.tsx:107`). 메뉴만 `code`, 나머지는 `key`를 쓴다. Resolver의 `app.cancel` 바인딩을 우회한다.
  - Space, Tab, A–Z 단일키 판정은 `keyboardAdapter.ts`, sequence 취소용 `Escape`는 `resolver.ts:67`에 있다.
  - `e.shiftKey`: 연속 배치와 박스 선택 추가(`App.tsx:765`, `:820`, `:826`).
  - 핀 클릭 → 배선 시작, 객체 클릭 → `selection.replaceItem` dispatch는 바인딩 조회 없이 코드에 있다. native-extensions의 해당 바인딩을 해제해도 동작한다.
  - 고정 안내 문구("W", "Shift+Space", "R/Shift+R", "Ctrl+Shift+Z" 등)는 프로필과 무관하다(F6).
- `modal` context는 overlay가 포커스를 받으면 svg 키 핸들러가 호출되지 않아 사실상 쓰이지 않는다. 휠 차단에만 영향을 준다(F3).
- `app.cancel` 핸들러의 `p?.operation` 특수 분기는 읽기 어렵다(메뉴의 "초안 취소" 버튼용).
- 최신 커밋(`7ae3b32`)의 앱 루트 `contextmenu` capture 차단: 입력칸은 제외되어 의도대로 보이나, `<select>`와 `<pre>`(JSON 내용) 위에서도 기본 메뉴(복사 등)가 막힌다. 문서 요구에는 영향 없는 사소한 사항이다.

## 5. Master Spec · 문서 불일치

| 항목 | 위치 | 상태 |
|---|---|---|
| preview 계산을 pointermove마다 전체 재계산하지 않음 (§33) | `App.tsx:452-459` | 위배 (F7) |
| 줌 50–200% | EDITOR_PROTOTYPE.md vs `view.ts:28` | 불일치 (F5) |
| "도구 전환 없이 접점 배선" | EDITOR_PROTOTYPE.md, README vs `editor.ts:244` | 불일치 (F9) |
| Ctrl+Shift+Z "보존" | INPUT_CONTROLS.md vs 4개 프리셋 | 불일치 (F6) |
| 브라우저 테스트 개수 43 | WIRE_EDITING.md vs 실제 46 | 문서 낡음(실행은 못 함) |
| `review/REVIEW.md`의 "untracked" 안내 | review/REVIEW.md | 현재는 tracked이며 CI에는 포함되지 않음 |
| "0길이 segment 없음" (§12.4) | F1 | float 오차로 깨질 수 있음 |
| M/E의 cursor 아래 대상 (§8.2) | 문서에 미구현 명시 | 결함 아님 |

## 6. 구조적 우려

- 부품 bounds가 5곳에 따로 정의되어 있다: 박스 선택 ±40×±20(`geometry.ts`), 회전 중심 ±40×±20, 라우팅 장애물 ±30×±20+여유(`routing.ts:22`), fitView ±50, 렌더러 60×40. `Kind`별 분기도 `addComponent`, `pinPosition`, 렌더러에 흩어져 있다. 새 게이트나 다른 크기의 부품을 넣으려면 5개 파일을 함께 고쳐야 한다. 부품 정의 테이블(핀, bounds, 심볼)로 모으길 권한다.
- Editor 불변식이 UI로 샌다. `wire.toggleBend`의 방향 계산이 App 핸들러에 있고, App이 `editor.selection`, `viewport`, `draft`를 직접 변경한다. `editor.focus`와 DOM 포커스가 이중 진실원이다(F3의 원인). App.tsx가 약 1,200줄이고 포인터 제스처 상태 기계가 그 안에 있다.
- 검증기(`assertCircuit`)가 일부 경로에서만 쓰인다. `connectTargets`, `joinCrossing`, MOVE/편집 확정에는 있으나 `place`, `tidyWires`, Undo/Redo 결과에는 없고 정수·격자 좌표 검사도 없다.
- history가 커밋마다 회로 전체를 2번 복제한다(before/after). 메모리가 N×H로 늘어난다. 문서도 "측정 안 함"이라 적었다.

## 7. 테스트가 놓친 것

1. F1: 임의 선분 × 격자점의 정수성 property test
2. F2: 차단 상태의 one-shot rotate
3. F3: 툴바 클릭 후 휠 줌, Ctrl+Z
4. F4/F5: 휠 delta 크기와 `deltaY=0`, Home 이후 줌
5. F6: 프리셋별 기대 바인딩 스냅샷(redo, rotate, select tool)
6. F9: 핀 직접 배선 후 `data-tool`
7. F10: 대기시간 입력을 키 단위로 타이핑
8. 이전 리뷰가 요청했고 아직 비어 있는 것: place/move/rotate/wire/undo/redo/Esc 랜덤 시퀀스에서 매 단계 `validateCircuit`을 검증하는 property test
9. 실제 IME 세션(문서에도 미검증으로 명시)

## 8. 이전 `review/REVIEW.md`와의 비교 (독립 검사 후 대조)

| 이전 항목 | 현재 |
|---|---|
| H1 stale hover | 수정됨 (hover를 포인터 좌표에서 매번 재계산) |
| H2 메뉴 Esc/포커스 | 수정됨 (autofocus + Esc 처리, 우클릭 backdrop까지 보완) |
| M1 회전 후 격자 이탈 | 수정됨 (중심을 `snap`). 중심 계산은 여전히 회전 전 bounds를 씀 |
| M2 spur | 수정됨 (`simplifyPath` 공통화). fuzz에서도 재현 안 됨 |
| M3 불변식 도구 | 부분 수정 (`validateCircuit`, `electricalGraph`에 wire 포함). 랜덤 시퀀스 검증은 없음 |
| M4 피드백 | 일부 개선. F11 참고 |
| 50% 스냅 | 최근접 선택으로 개선됨. 동거리일 때만 후보 창 |
| 렌더 중 UUID, 성능 | 그대로 (F7) |

이번에 새로 확인한 항목은 F1~F10이다.

## 9. 작업 경위

감사 중 사용자 요청에 따라 F1~F3 수정 단계로 들어가던 중, 직후 사용자의 중지 지시를 받았다. 그 사이 `src/editor/editor.ts`(F2), `src/ui/App.tsx`(F3)에 미커밋 수정을 2건 적용했으나, 사용자의 요청에 따라 `git checkout`으로 원복했다. 최종 확인 시 working tree는 clean, HEAD는 `7ae3b32`였다. 이 보고서 파일(`review/AUDIT_7ae3b32.md`)만 추가되었고 커밋하지 않았다.

## 10. 권장 다음 단계

1. Node.js 설치 후 `npm ci && npm run build && npm test && npm run test:browser && npm audit`로 이 보고서의 추정 항목(F3/F4/F10)과 기존 통과 수치를 확정한다.
2. 수정 우선순위 제안: F1 → F2 → F3 → F5 → F4 → F6 → F9/F10 → F7(측정 후 설계).
3. 수정과 함께 위 §7의 테스트를 추가한다.
