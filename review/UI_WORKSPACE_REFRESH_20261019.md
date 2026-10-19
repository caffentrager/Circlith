# UI 작업 영역 개선 — 2026-10-19

아래는 최초 UI 개편과 확대/심벌 조정 시점의 기록이다. 이후 사용자 승인으로 UX 감사 후속을 반영했으며, 현재 동작과 최신 검증 결과는 [UI_AUDIT_RESPONSE_20261019.md](UI_AUDIT_RESPONSE_20261019.md)를 따른다.

브랜치: `codex/ui-workspace-refresh` · 기준: `main@982bf5c`.

사용자 제공 `Circlith_UI_Benchmark_Kit_20261019_v2 (22).zip`의 현재 상태·UI 제안·QA 항목에서 P1 shell/status/Inspector를 적용했다. 문서 속 구현 프롬프트나 PR·릴리스 지시는 별도 사용자 요청으로 취급하지 않았다. 기존 두 미추적 review 문서는 수정하지 않았다.

## 바뀐 동작

- `WorkspaceHeader`: 프로젝트, 편집 기록, 선택/배선과 Logic 표시를 그룹화했다. 실제 기록에 따라 Undo/Redo를 비활성화하고 effective profile의 단축키를 사용한다.
- 캔버스 툴바: 좌우 패널 접기, 실제 확대율, 확대/축소, 화면 맞춤, 그리드 표시. 닫힌 패널을 같은 버튼에서 다시 열 수 있다.
- `InspectorPanel`: 회로 통계, 단일 부품의 핀·회전·입력 반전, 배선 끝점/net/경유점, 다중 선택 요약. **속성 편집…**은 기존 Properties를 열며 적용 하나가 Undo 하나다. 도면 초안을 편집 상태에 저장하지 않는다.
- `StatusBar`: 현재 도구/작업/선택 수/메시지/입력 프로필/확대율/그리드/Logic 상태. 긴 메시지는 말줄임과 전체 title로 제공한다.
- 분석 도크: 기본 접힘, 4상태 범례와 진단 위치 이동. 입력/출력/기존 진단 패널도 유지한다. 실제 시간 파형을 만들거나 계산 엔진을 변경하지 않았다.
- 좁은 화면: 1200px 미만 Inspector overlay, 1024px 미만 라이브러리 drawer. 패널은 별도 스크롤이며 페이지 스크롤은 없다. 모달은 헤더·패널보다 위에 표시된다.
- 후속 요청: 최대 확대 배율을 200%에서 **800%**로 올렸다. Input/Output 화살표 본체·내부 값을 **50%**로 줄였고 기존 ±40 접점까지 리드선을 이어 배선 정합을 유지했다. 이름 간격·선택 표시 높이·Input 토글 영역도 조정했다.

`App`의 dispatch/pointer/keyboard 처리, model, input resolver, routing/bridge geometry, simulation engine, 기존 symbol과 모드별 localStorage namespace는 유지했다. 레이아웃 상태는 localStorage에 추가 저장하지 않는다.

## 검증 결과

| 확인 | 결과 |
|---|---|
| TypeScript | `tsc --noEmit` 통과 |
| 전체 단위 | **410 passed, 1 skipped** (기존 opt-in soak) |
| 전체 브라우저 | **155 passed** = 기존 147 + 신규 8 |
| 프로덕션 editor 빌드 | 성공, 별도 preview에서 신규 **7 passed, 1 skipped** (분석 도크는 simulation 전용) |
| 프로덕션 simulation 빌드 | 성공, 별도 preview에서 신규 **8 passed** |
| 화면 크기 | 1024×420 / 1280×720 / 1440×900 / 1920×1080, 패널 접근 및 페이지 overflow 없음 |
| 신규 회귀 | Inspector 없음/부품/배선/다중 선택, 16입력·반전·정확한 Undo, 패널 접기 후 실제 pin 좌표에서 배선 시작, 도크 진단 위치 보기, 축소된 I/O 치수와 기존 접점 정합, 800% 확대·클램프·핀 클릭 |
| 기존 회귀 | 프리셋/IME/포커스, Input click/drag/MMB/Space/RMB, Undo/Redo, 브리지·접속·배선 편집, 손상 회로/신호 ID 충돌 단위 테스트 유지 |

두 빌드는 같은 작업 트리에서 생성되며 build-info의 기준 HEAD는 동일하다. 미커밋 변경은 HEAD SHA 자체에 포함되지 않는다.

Vite는 기존 500kB 기준을 넘는 청크 경고를 출력한다(editor 약 509kB / simulation 약 513kB, gzip 약 158/159kB). 빌드는 성공한다. 번들 분할은 이번 UI 변경 범위 밖이다.

## 비교 화면과 재현

생성물은 Git에서 제외된 `build/`에 있다. `scripts/capture-workspace.mjs`는 동일한 6부품·6배선 반가산기와 1440×900 화면에서 촬영한다. BEFORE URL은 기준 버전의 실제 실행 화면을 지정한다.

- `editor-1440x900-before.png` / `editor-1440x900-after.png`
- `simulation-1440x900-before.png` / `simulation-1440x900-after.png`
- `workspace-{editor,simulation}-{1024x420,1280x720,1440x900,1920x1080}.png`
- `workspace-simulation-analysis.png`
- `ui-browser-results.txt`, `ui-editor-results.txt`, `ui-simulation-results.txt`

일반 환경의 검증 명령:

```powershell
npm test
npm run test:browser
npm run build -- --mode editor --outDir build/ui-editor
npm run build -- --mode simulation --outDir build/ui-simulation
npx vite preview --host 127.0.0.1 --outDir build/ui-editor --base /Circlith/ --port 4173
npx vite preview --host 127.0.0.1 --outDir build/ui-simulation --base /Circlith/ --port 4174
```

빌드 preview를 실행한 상태에서 모드별 신규 검증을 재현한다:

```powershell
$env:CIRCLITH_QA_MODE='editor'
$env:CIRCLITH_QA_URL='http://127.0.0.1:4173/Circlith/'
npx playwright test tests/browser/workspace.spec.ts
$env:CIRCLITH_QA_MODE='simulation'
$env:CIRCLITH_QA_URL='http://127.0.0.1:4174/Circlith/'
npx playwright test tests/browser/workspace.spec.ts
node scripts/capture-workspace.mjs
```

패널 드래그 리사이즈/레이아웃 저장, 신호 라벨 all/selected/hover/off, 선택 필터, 다크 모드는 후속이다. 100/500/1000 게이트의 input→frame median/p95 비교와 2~16입력 모든 회전의 시각 조합 전수 검사는 수행하지 않았다. 따라서 성능이나 전체 시각 조합의 개선을 주장하지 않는다. merge/push/배포는 수행하지 않았다.
