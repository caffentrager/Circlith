# Input & Controls 구현 기록

기준: Master Spec DEC-002/005/006/008/015/016와 사용자 제공 `IMPLEMENTATION_PROMPT.md`. 입력 시스템 때문에 삭제·클립보드 등 새 Editor 기능을 추가하지 않는다.

## 기존 구조와 변경 경계

기존 Editor는 React 없이 Circuit/Draft/Command/History를 관리한다. 이 책임은 유지했다. 기존 App의 키별 Editor 호출을 다음 흐름으로 정리했다.

`DOM event → keyboard adapter / InputResolver → command ID → CommandDispatcher → 기존 Editor 또는 UI/View handler`

| 파일 | 책임 |
|---|---|
| `src/input/registry.ts` | seed 명령 ID·의미·category 및 구현 가능 여부. Delete/Clipboard/Properties/palette는 unavailable |
| `src/input/types.ts` | input/context/profile 모델, canonical input signature, 충돌 분류 |
| `src/input/resolver.ts` | context/focus 기반 key/chord/sequence/mouse/wheel 해석. Editor state를 소유하지 않음 |
| `src/input/profiles.ts` | catalog+JSON glob 로드, basePreset 합성, immutable built-in, 사용자 override, JSON Schema/semantic 검증 |
| `src/input/data/` | 공급된 registry/catalog/schema/8개 seed와 별도 native extensions/adaptation JSON |
| `src/editor/dispatcher.ts` | stateless 명령 dispatch. 미구현 handler는 안내하고 실행하지 않음 |
| `src/ui/keyboardAdapter.ts` | DOM keyboard normalization/Tab/IME/Space ownership. Editor 의미론 없음 |
| `src/ui/InputSettings.tsx` | 프로필 선택·navigation 혼합·수정·reset·conflict·import/export |
| `src/ui/App.tsx` | 기존 Editor를 연결하는 handler와 pointer gesture lifecycle, UI focus/feedback |
| `src/geometry/view.ts` | 공통 줌 범위, 휠 delta 정규화, 확대 중심 보존, Home/Shift+Home fit 계산 |
| `tests/unit/input.test.ts`, `tests/browser/input-settings.spec.ts` | resolver/프로필/설정/포커스와 실제 pointer 동작 |

## 프로필 합성과 의미론

내장 JSON은 재귀 freeze하며 런타임에 수정하지 않는다. effective = base preset + child preset + 사용자 override이다. child에서 새로 정의한 명령은 같은 명령의 기존 바인딩을 대체한다. 새 입력이나 accelerator prefix와 겹치는 inherited 입력도 제거하여 KiCad M이나 Altium M/V가 뜻밖의 native 명령을 실행하지 않는다. 그 후 사용자 override를 적용한다. 메뉴·버튼은 shortcut 없이도 같은 command ID를 dispatch한다.

입력 종류는 key, keyChord, keySequence, mouseClick, mouseDoubleClick, mouseDrag, wheel, wheelChord를 지원한다. button/modifier는 정확히 비교한다. RMB click과 drag는 pointer-down capture 후 임계값(기본 4px)으로 구분하여 메뉴는 release에서만 연다. sequence 기본 timeout은 900ms이고 100–10000ms 범위로 변경 가능하다. 대기 상태를 표시하며 Esc/focus/modal/IME/window blur에서 취소한다. 단축키 autorepeat는 무시한다. Tab은 UI 탐색으로 유지한다.

기본 mouse 동작은 Master Spec에 맞게 구현을 정정했다: RMB click 메뉴, MMB drag 또는 Space+LMB drag Pan. 기존 부품 패널/접점 직접 조작과 direction-sensitive box는 유지한다. 프로필은 입력을 바꿀 뿐 connectivity-preserving Move, staged Esc, Draft-only Undo 등 Editor 불변식을 변경하지 않는다.

`native-extensions.json`은 기존 Shift+R, Ctrl+Shift+Z, Shift+Space bend, Ctrl+A, +/-와 기본 좌클릭 선택을 명령 ID로 보존한다. `profile-adaptations.json`은 EasyEDA seed의 RMB cancel behavior를 명시적 mouseClick binding으로 표현한다. 공급된 원본 seed의 metadata를 덮어쓰지 않는다.

## 설정과 저장

Settings → Input & Controls에서 built-in 원본, effective bindings, user overrides, unsupported/unmapped target actions, unavailable Circlith commands를 별도 표시한다. JSON 편집기로 기존 바인딩 수정/새 바인딩 추가/해제/개별 reset을 제공하고 전체 reset도 제공한다. 내장 데이터가 변경된 것이 아니라 override가 있을 때 `(Modified)`로 표시한다.

navigation 혼합은 pan/zoom 명령의 바인딩만 다른 프리셋에서 가져온다. KiCad keyboard + Modern navigation, Altium accelerator + MMB pan, reversed wheel을 구성할 수 있다.

충돌은 hard unconditional collision / disjoint contexts / sequence prefix ambiguity / click-drag sharing을 구분한다. Hard collision만 저장을 거부한다. Prefix는 timeout까지 대기해 구분하며 click-drag는 threshold로 구분한다.

사용자 상태 `{schemaVersion:"1.0",presetId,overrides,behavior}`만 `circlith.input-profile.v1` localStorage에 저장한다. built-in 및 회로 데이터를 저장하지 않는다. 구버전은 자동 추측 migration 없이 유용한 오류로 거부한다. import는 사용자 상태 또는 공급 schema의 standalone profile을 받을 수 있다. standalone profile은 base preset + overrides로 정규화되며 사용자 export는 이 정규화 상태다. validate 전체 성공 후만 현재 상태를 교체한다. 손상 데이터는 Modern으로 안전 복구하면서 오류를 표시한다. quota/storage 실패는 현재 세션 설정을 사용할 수 있게 하되 저장 실패와 JSON export 대안을 안내한다.

## 프리셋별 지원 범위

| 프리셋 | 현재 적용 / 의미론 차이 |
|---|---|
| Circlith Modern | M Safe Move, G Grid, A/W/V/R, staged Escape, Home/Shift+Home, 기본 mouse navigation |
| KiCad 9 | G Safe Move. 연결을 끊는 M은 미매핑. E/Delete/Clipboard는 handler가 없어 실행 안 함. Alt+4 및 line-mode parity는 seed의 unmapped 설명 유지 |
| Altium Designer 2026 | P→W Wire, M→M adapted Safe Move, V→F fit; RMB click/menu vs drag/pan, Ctrl+wheel. Space rotation은 placement/move context에 해당하며 MOVE 중 누적 회전을 지원한다. double-click Properties는 unavailable |
| EasyEDA Pro | W/M/Space/K, RMB click cancel vs drag Pan. cross selection 전용 명령 없음 |
| Fusion Electronics 2026 | A/M/G/R/F6와 navigation. F6 browser interception의 플랫폼 실측은 미완료. partial |
| Fusion Navigation | MMB/wheel 중심 2D navigation. Shift+MMB Orbit은 미매핑. navigation-only |
| Shapr3D Navigation | MMB/wheel 중심. RMB Orbit/face zoom 미매핑. navigation-only |
| Figma / Modern Canvas | Space+LMB 및 Ctrl+ +/- 참고값. 실제 Figma CAD 호환을 주장하지 않음. reference-only |

source URL/checkedAt/compatibility 값은 공급 데이터의 provenance를 보존한 것이다. 대상 CAD별 공식 문서 전체 재검증 또는 1:1 제품 호환 검증 결과는 아니다. 알 수 없는 command ID/버전/context/잘못된 input/unsafe Move semantics는 검증 실패다. 미래 Orbit·PCB·simulation 명령을 구현하지 않는다.

2026-10-15 우클릭 보정: pointerup에서 메뉴가 열린 뒤 contextmenu의 target이 overlay로 바뀌는 경우를 재현했다. SVG만의 bubble handler 대신 앱 루트 capture에서 기본 동작과 전파를 차단한다. 도면·메뉴·설정의 비텍스트 영역·툴바에서 앱 메뉴와 브라우저 메뉴가 겹치지 않으며, input/textarea/contenteditable의 편집 메뉴는 유지한다. 모달의 비텍스트 영역 우클릭은 키보드 포커스를 유지해 backdrop 우클릭 후에도 Esc로 닫힌다. 프리셋의 RMB click/cancel/drag Pan 바인딩과 회로·history 의미론은 바꾸지 않는다. 실제 우클릭 이벤트의 defaultPrevented/전파, 반복 우클릭과 Esc, 텍스트 입력 메뉴, RMB Pan, 안정된 배선 초안·history 보존을 브라우저 회귀 테스트로 확인한다.

## 검증

2026-10-15 감사 대응: 일반 버튼은 `MODAL`로 분류하지 않고 실행 뒤 svg 키보드 포커스를 복구한다. 검색·설정·후보/메뉴는 자체 포커스를 유지하며 text/IME를 canvas 명령으로 처리하지 않는다. 휠은 delta 크기에 비례해 처리하고, line/page 단위 정규화·한 이벤트 최대 240px·수평(deltaY=0) 무시·반전 설정·10–200% 공통 범위를 적용한다. 50% 아래 fit에서 휠/키보드 줌 아웃이 확대되는 회귀를 검사한다. 드래그 release 확정 실패는 feedback을 남기고 원래 geometry로 돌아가며, 다음 hover로 움직이지 않는다.

2026-10-13 Windows / Node.js 22.23.3 / Playwright Chromium 156:

```sh
npm ci
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm audit --audit-level=moderate
git diff --check
```

build 성공, 단위 테스트 25개, 브라우저 테스트 21개 통과, audit 보고 취약점 0개. 기존 편집 테스트와 새 resolver/프로필/모달/sequence/override/reset/mixing/import-export/storage-failure를 포함한다. 실제 한글 IME 세션·다른 browser·OS reserved shortcut 수신·사용성·대규모 성능은 검증하지 않았다. 예약 Editor 기능은 여전히 미구현이고 회로는 새로고침 후 유지되지 않는다.
