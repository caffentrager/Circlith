# Claude — Circlith `codex/logic-simulation` 독립 검증 보고서

- 검증자: Claude (독립 Verification / Digital Logic / QA 관점)
- 검증일: 2026-10-18
- 대상: `codex/logic-simulation` @ `eb44fc5e36edd66bfe91fcebdb6030ad0acdded8` (`feat: add four-state combinational logic simulation`)
- 기준 문서: `docs/CIRCLITH_MASTER_SPEC.md`(§5.2, §23~24), `docs/SIMULATION.md`
- 원칙: 원본 브랜치의 production code·기존 테스트·기존 문서는 수정하지 않았다. 추가 테스트는 임시 detached worktree(`scratchpad`)에서만 작성·실행했고 저장소에 커밋하지 않았다.

---

## A. Tested Revision

```text
Target Branch:   codex/logic-simulation
Target SHA:      eb44fc5e36edd66bfe91fcebdb6030ad0acdded8
Baseline Branch: feat/editor-prototype
Baseline SHA:    045a293bf17d5d4c90e8ebab90e07a0b5ed1ba35   (merge-base = baseline SHA, 즉 대상은 기준 위의 1개 커밋)
Compared range:  feat/editor-prototype...codex/logic-simulation  (16 files, +708/-44)
Working Tree:    검증 시작·대부분의 실행 동안 clean. 22:17경 다른 작업자가 원본 working tree에
                 Pages 배포 관련 파일(.github/workflows, docs, scripts, src/geometry/routing.ts,
                 src/input/profiles.ts 등)을 수정하기 시작함 → 이 수정은 검증 대상이 아님.
                 단위·QA·변이 검증은 eb44fc5의 별도 worktree에서 실행했고, 브라우저 검증은
                 eb44fc5와 동일한 소스를 서빙하던 dev server(127.0.0.1:5173)에 대해 실행했다.
Node Version:    v24.19.0 (Codex 런타임에 포함된 node.exe 직접 호출. README 요구 22.23.3 이상 충족)
Chromium:        156.0.8078.4 (Playwright 1.64.0, build/.playwright의 chromium-1248)
Tools:           vitest 5.0.4, TypeScript 5.9.3, React 19.3.0
Machine:         Windows 10 Pro, AMD Ryzen 5 5600 6-core, 64 GB RAM
```

## B. Baseline Results

| 항목 | 결과 | 비고 |
|---|---|---|
| `npm ci` | **NOT RUN** | 실행 중인 dev server와 다른 작업자의 `node_modules`를 파괴할 위험이 있어 생략. lockfile과 설치본의 일치는 미검증 |
| `npx tsc --noEmit` | PASS (exit 0) | 대상, 기준 브랜치 모두 |
| `npm run build` | PASS | `tsc --noEmit` + `vite build`를 별도 출력 폴더에서 실행. 243 modules, JS 488.69 kB. 산출 파일 해시가 기존 `dist`와 동일 |
| `npm test` (대상) | **311 passed, 1 skipped** (13 files) | 문서의 "311개 통과, soak 1개 skip"과 일치 |
| `npm run test:browser` (대상) | **129 passed** (1.3 min) | 문서의 129개와 일치 |
| 기준 브랜치 `tsc` | PASS | |
| 기준 브랜치 `npm test` | 179 passed, 1 skipped | 대상은 +132 |
| 기준 브랜치 `test:browser` | 123 passed | 대상은 +6 (시뮬레이션 브라우저 테스트 6개) |
| `git diff --check` (비교 범위) | PASS | |
| `npm audit --audit-level=moderate` | **PASS 상당** (npm 자체는 없음) | lockfile의 100개 패키지 버전을 registry bulk advisory API에 조회: HTTP 200, **advisory 0건** (전 심각도) |

판정: 문서에 기재된 수치(단위 311+1 skip, 브라우저 129, 빌드/타입 통과)를 **독립 실행으로 재현**했다. 기준 브랜치의 모든 기존 브라우저·단위 테스트가 대상에서도 통과한다. `tests/browser/adversarial-latest.spec.ts`의 변경은 라이브러리/캔버스 글리프 비교를 3종에서 7종으로 확장한 것이며 약화가 아니다.

## C. Simulation Correctness Matrix

모든 기대값은 구현의 `evaluateGate()`/`resolveDrivers()`를 쓰지 않고 **독립 기준**으로 만들었다.

| 검사 | 독립 기준 | 범위 | 결과 |
|---|---|---|---|
| 게이트 4상태 진리표 | 가능성 집합 의미론(X/Z 입력은 0 또는 1 둘 다 가능, 모든 일관된 할당이 같은 값이면 확정) | 6개 2입력 게이트 × 16 + NOT × 4 + 교환법칙 96 | **PASS 0 불일치** |
| 드라이버 결합 | Master Spec §24 표를 접어 계산 | 0~4개 드라이버의 모든 값 조합과 모든 순열(총 357 케이스) | **PASS 0 불일치** |
| 진단의 순열 불변 | MULTIPLE_DRIVERS/DRIVE_CONFLICT 판정 | 위와 동일 | **PASS** |
| X 전파 ≠ 충돌 | X+0, X+1, X+X는 DRIVE_CONFLICT 아님 | 8개 조합(실제 회로, Input 2개 → Output) | **PASS** |
| 반가산기 | SUM=A⊕B, CARRY=A·B | 4 조합, 진단 0 | PASS |
| 전가산기 | 정수 덧셈 | 8 조합, 진단 0 | PASS |
| 2:1 MUX | y = s ? b : a | 8 조합 + 비선택 입력의 X/Z가 가려지는지 | PASS |
| 2→4 디코더 | one-hot | 4 조합 | PASS |
| 1비트 비교기 | A>B, A=B, A<B | 4 조합 | PASS |
| NOT 직렬 체인 | 단수 홀짝 | 길이 1,2,3,10,11,399,400,1001,3001 | PASS |
| 재수렴 팬아웃 | XOR(g,g)=0 | 4 조합 (0/1) | PASS |
| 부유 입력 | AND(1,Z)=X, AND(0,Z)=0, 미연결 Output=Z, FLOATING 진단 2개 | | PASS |
| 다중 구동 | 값 + 진단 행렬 | 8 조합 | PASS |
| 조합 피드백 | SCC 구성원 | 자기 루프, 2/3/4/7-NOT 링, AND/OR 혼합, 독립 두 순환, 순환 상·하류 게이트, 다중 구동 net 자기 루프 | **PASS** — 실제 순환 구성원만 보고되고 순환 밖은 정상 계산(순환 X가 OR의 1에 가려짐 포함) |
| 등록 순서·geometry·회전 독립 | 같은 topology를 부품 위치·회전·배선 방향·삽입 순서를 바꿔 다시 구성 | 무작위 2,000 회로(시드 고정), 같은 topology를 독립적으로 두 번 구성해 pin별 값·진단 비교 | **PASS 0 불일치** |
| 참조 시뮬레이터 대조 | Tarjan SCC + 메모이즈 재귀로 별도 구현한 참조 | 위 2,000 회로(순환 포함 1,234, 다중 구동 973) | **PASS 0 불일치**, `INVALID_CIRCUIT` 0건 |
| 결과 비파괴성 | 재귀적으로 `Object.freeze`한 circuit·inputs·이전 result | compile/simulate 반복 호출 | **PASS** (변경 시도 시 예외가 났을 것) |
| 실행 반복성 | 같은 plan을 입력 바꿔가며 반복 | 64 입력 조합 ×2 | **PASS** (누적/드라이버 중복 없음) |
| 거대 SCC | 50,000개 NOT 링 | 스택 오버플로 없음, compile 2.1 s | PASS |
| 오류 주입 | CORRUPTED DATA TEST | §E의 [P3-5] 참고 | **FAIL 일부** (예외 발생 3종) |
| 에디터 연동(실제 Editor API) | 분기 junction ≡ 직접 배선, wire 삭제·부품 삭제로 net 분할, 교차 join, 이동/회전, Undo/Redo | 6 시나리오 + 40회 × 25스텝 무작위 편집 시퀀스(매 스텝 `validateCircuit`=[], 전체 Undo→빈 결과, 전체 Redo→동일 결과) | **PASS** |
| `INVALID_CIRCUIT` 화면 표시 | | UI로 만들 수 없음 | **NOT VERIFIED** (코드 읽기: §E [P3-11]) |

한계(정직한 기록): 첫 실행의 순환·네트 구성이 순환에 치우쳐(1,200회로 중 1,055개가 순환) 순환 없는 구성 비중이 낮아, 별도로 DAG만 생성한 800회로(순환 포함 179는 확장 연결 때문)도 함께 돌렸다. 결과는 동일하게 0 불일치다. 내가 처음 작성한 Python 포팅 검증에서 1건의 단언이 실패했으나 구현이 아니라 **내 기대값 오류**(`i=0`에서 OR(X,0)=X인데 1로 기대)였고, 이어 올바른 기대값으로 작성한 두 단언은 통과했다.

## D. Dynamic Browser Matrix

대상 코드를 서빙하는 실제 dev server에 Playwright(Chromium 156)로 접속해 실제 마우스·키보드로 조작했다. 모든 테스트에서 console error와 page error를 수집했으며 **0건**이었다.

| 시나리오 | 실제 조작 | 결과 |
|---|---|---|
| 6개 2입력 게이트의 4상태 진리표 | Input×2→게이트→Output을 UI로 배치·결선, 패널에서 0/1/X/Z 선택 | **96/96 일치** |
| NOT 4값 + 선 패턴 | Input 값 0/1/X/Z | 출력 일치, 선 `data-value`/클래스/라벨 일치, X는 `stroke-dasharray` 3 포함, Z는 9 포함, 0/1은 실선 |
| 전가산기를 UI로 직접 작도 | 부품 10개, 배선 12개를 클릭으로 연결 | **8/8 조합 일치**, 진단 0 |
| Input 몸체 중앙 클릭·Enter 키·패널 선택 | | 값 전환이 서로 일관, 이력 항목 수 불변 |
| 시뮬레이션 켜기/끄기 | 입력을 바꾼 뒤 끄고 켬 | 입력 유지, 회로·선택·viewport·wire ID/points·이력 불변 |
| Undo/Redo | 입력 변경 후 Ctrl+Z | 마지막 구조 편집만 되돌아가고 입력값은 유지, Redo 후 결과 복구 |
| 입력 삭제 후 Undo | 두 입력 중 하나 삭제 | 남은 입력은 자기 값 유지(번호만 재부여), 복원된 입력은 0 |
| 초안 중 | 배치 초안 | 입력 패널 비활성, 토글 제거, 출력은 확정 회로 값 유지 |
| 진단 | 충돌/다중/부유 상황 반복 전환 | 조건에서만 나타나고 조건이 사라지면 즉시 사라짐, 관련 위치 보기가 원인 객체 선택, 선택 후 Delete는 선택된 객체에 적용 |
| 확대·축소 | 0.75×~1.33× | 값 라벨이 일정한 화면 크기 약 12 px |
| 뷰포트 | 1024×768, 1440×900, 1920×1080, 1024×420 | 패널 우측 경계가 뷰포트 안, 가로 스크롤 없음, 오른쪽 패널은 세로 스크롤(스크린샷 확인) |
| 입력→다음 프레임 지연 | 전가산기에서 입력 300회 전환 | p50 16.7 ms, p95 17.9 ms, 최대 18.3 ms (60 Hz 화면 vsync 한계, 시간 증가 없음) |
| 시뮬레이션 ON에서 편집 | 아래 [P2-1]~[P2-3] | **회귀 있음** |
| 큰 회로의 브라우저 지연 | | **NOT VERIFIED** (UI로 수백 게이트 작도 불가) |
| 실제 한글 IME | | **NOT VERIFIED** |

## E. Confirmed Findings

P0, P1은 없다. 4상태 계산, 해석, 순환 검출, 드라이버 결합, 에디터 연동에서 **틀린 논리값을 내는 반례를 찾지 못했다.**

### [P2-1] Input 토글 영역이 몸체 중앙을 독점해 선택·이동·Shift 선택·메뉴가 불가능

```text
Confidence:     CONFIRMED (브라우저 프로브)
Affected files: src/renderer/CircuitSvg.tsx:64-72 (토글 <g>, onPointerDown에서 stopPropagation),
                docs/SIMULATION.md:13
Reproduction:   시뮬레이션 ON, Input 배치. 선택을 비운 뒤
                (a) 몸체 중앙 클릭  (b) Shift+중앙 클릭  (c) 중앙에서 드래그
                (d) 중앙 정확히 우클릭  (e) 몸체 왼쪽 가장자리 2px 지점 클릭/드래그
Expected:       §8.1 비선택 부품 클릭·드래그는 선택/이동, Shift+클릭은 토글, §21 RMB는 객체 메뉴
Actual:         (a) 선택 안 됨(값만 전환) (b) 선택 안 됨 (c) 이동 안 됨 (d) 메뉴 안 열림
                (e) 선택·이동은 가능. 이름 라벨은 pointer-events:none이라 대체 수단이 아님
Root cause:     토글 rect가 몸체 60×40 중 50×32를 덮고 pointerdown을 svg 핸들러로 올려보내지 않음
Impact:         시뮬레이션 ON에서 Input의 주 조작 면적 대부분이 편집 불가. 가장자리 띠는 100%에서 5×4 px,
                50% 줌에서 2.5×2 px. 문서 "핀·상단 이름·몸체 가장자리는 기존 편집 대상으로 유지"는
                "상단 이름"에 대해 사실이 아니다. (선택박스·Ctrl+A·도면 트리로는 선택 가능)
Recommended fix: 클릭(이동 임계값 미만)만 토글로 처리하고 드래그·수식키·우클릭·Space는 기존 제스처로 통과시킨다.
                또는 토글을 값 배지 같은 작은 별도 영역으로 줄인다.
Regression test: 시뮬레이션 ON에서 Input 중앙 드래그가 이동, Shift+클릭이 선택 토글, RMB가 메뉴를 여는지, 중앙 단순 클릭은 토글하는지.
```

### [P2-2] 토글이 DOM 포커스와 Space를 잡아 두어 키보드 소유권이 깨짐

```text
Confidence:     CONFIRMED (브라우저 프로브)
Affected files: src/renderer/CircuitSvg.tsx:66-72 (포커스 이동, Space/Enter keydown·keyup stopPropagation),
                src/ui/App.tsx:~1054 (draft 중 토글을 아예 렌더링하지 않음)
Reproduction:   (a) 토글 클릭 → 빈 캔버스에서 Space+드래그
                (b) 토글 클릭 → 핀 위에서 W(배선 초안 시작) → Esc
Expected:       (a) Space+드래그는 Pan (문서: "Space는 도면 이동 기능을 유지한다")
                (b) §7.5 초안은 Esc로 폐기
Actual:         (a) 통제군(svg 포커스)에서는 Pan 성공, 토글 클릭 직후는 **Pan 실패**(Space가 svg 어댑터에
                    도달하지 않아 박스 선택으로 해석), 두 번째 시도는 성공
                (b) W로 초안이 시작되면 토글이 언마운트되어 activeElement=BODY, **Esc 후에도
                    operation=WIRE_DRAFT 유지**. 캔버스를 클릭해야 취소 가능
Root cause:     토글이 포커스를 유지하며 Space를 소비하고, 초안 중 토글을 제거해 포커스를 잃음
Impact:         키보드 중심 작업에서 초안을 취소하지 못하고 첫 Pan이 박스 선택이 됨(데이터 손상은 없음)
Recommended fix: 토글 처리 후 포커스를 svg로 돌려주거나 포커스를 유지하지 않는 포인터 전용 토글로 변경.
                토글은 초안 중에도 마운트한 채 disabled 처리. Space 이벤트는 어댑터로 전달.
Regression test: 토글 클릭 직후 Space+드래그가 Pan, 토글 포커스 상태에서 W→Esc가 초안을 취소.
```

### [P2-3] 토글 클릭이 선택을 바꾸지 않아 이어지는 Delete가 다른 객체를 삭제

```text
Confidence:     CONFIRMED (브라우저 프로브)
Affected files: src/renderer/CircuitSvg.tsx:69 (onClick이 선택을 갱신하지 않음)
Reproduction:   NOT 게이트 선택 → Input 토글 클릭(값 전환) → Delete
Expected:       사용자가 방금 조작한 Input이 대상이거나 Delete가 거부됨
Actual:         구성요소 3→2. Input은 남고 **이전에 선택해 둔 NOT이 삭제**됨 (Undo로 복구 가능)
Root cause:     토글은 입력 전용 경로이며 선택 상태를 갱신하지도 해제하지도 않음
Impact:         눈에 띄지 않는 선택 대상에 파괴적 명령이 적용됨
Recommended fix: 토글 시 해당 Input을 선택하거나 기존 선택을 해제한다.
Regression test: 위 시나리오에서 Delete의 대상 검증.
```

### [P3-4] `validateCircuit`가 높은 팬아웃에서 O(F²)이며 매 commit의 compile에 포함됨

```text
Confidence:     CONFIRMED (Node 측정)
Affected files: src/model/connections.ts:109-110 (adjacency Set 복사), src/simulation/simulator.ts:66
Reproduction:   한 출력 핀에서 N개 입력 핀으로 직접 배선(별 모양 net)
Actual:         N=1000: 33 ms, 2000: 114 ms, 4000: 341 ms, 8000: 1,410 ms (두 배마다 약 4배)
Impact:         현실적인 팬아웃(수십)에는 영향 없음. 수천 단위에서 편집 commit마다 지연. 5,000 게이트 팬아웃 compile 973 ms
Recommended fix: adjacency를 Map<string, string[]>에 push 방식으로 구성(O(E)).
Regression test: 팬아웃 4,000에서 compile < 100 ms 상한.
```

### [P3-5] 형식이 깨진 데이터에서 `INVALID_CIRCUIT` 대신 예외가 발생 (CORRUPTED DATA TEST)

```text
Confidence:     CONFIRMED (메모리 fixture, 사용자 경로로는 만들 수 없음)
Affected files: src/model/connections.ts (validateCircuit), src/simulation/simulator.ts:66-74,
                src/ui/App.tsx:56 (useMemo 안에서 compile, 에러 경계 없음)
Reproduction:   components 레코드만 삭제(geometry에는 남김) / component.pins=undefined / component=null
Expected:       INVALID_CIRCUIT 진단, 계산 중단
Actual:         TypeError throw. 나머지 8종(핀 레코드·net 레코드 삭제, geometry 누락, 방향/인덱스 오류,
                지원하지 않는 kind, net 소유 불일치, 없는 junction)은 모두 INVALID_CIRCUIT로 정상 처리
Impact:         현재는 회로 로드 기능이 없어 도달 불가. 저장/로드 도입 시 흰 화면 위험
Recommended fix: validateCircuit를 형태 방어적으로 만들고 compile 전체를 try/catch로 감싸 INVALID_CIRCUIT로 변환.
Regression test: 위 3종 fixture가 INVALID_CIRCUIT를 반환.
```

### [P3-6] 잘못된 입력값이 조용히 0으로 처리됨

```text
Confidence:     CONFIRMED
Affected files: src/simulation/simulator.ts:125
Actual:         inputs[id]="Q" → 0으로 계산하고 진단 없음. UI의 Input 몸체는 원시 문자열을 그대로 표시
Impact:         현재 UI로는 도달 불가. 외부 상태 주입 시 오류가 숨음
Recommended fix: 유효하지 않으면 진단 또는 예외. 단위 테스트 추가(변이 S14가 기존·QA 어디서도 잡히지 않음)
```

### [P3-7] 같은 원인에 두 진단(MULTIPLE_DRIVERS + DRIVE_CONFLICT)이 함께 표시됨

```text
Confidence:     SPEC AMBIGUITY
Affected files: src/simulation/simulator.ts:143-146, 테스트가 이중 발생을 기대
Detail:         §24는 "0과 1 충돌 → X + conflict diagnostic"과 "같은 값의 다중 active driver → MULTIPLE_DRIVERS"를
                구분해 적었다. 구현은 충돌에도 MULTIPLE_DRIVERS를 추가한다.
Recommended:    제품 결정 필요. 하나로 줄이거나 UI에서 묶어 표시.
```

### [P3-8] 진단 메시지 식별성 및 미검증 속성

```text
Confidence:     CONFIRMED
Detail:         메시지가 게이트를 종류로만 지칭("AND 입력 2")해 같은 종류가 여럿이면 구분 불가(위치 이동 버튼으로 보완).
                FLOATING_INPUT의 objects에 같은 부품 id가 중복되는 경우가 있음(simulator.ts:149).
                severity와 FLOATING objects는 어떤 테스트도 검증하지 않음(변이 S11, S16 생존).
```

### [P3-9] X 비관성(pessimism)이 문서화되지 않음

```text
Confidence:     CONFIRMED (설계 한계)
Detail:         g=X일 때 재수렴 XOR(g,g)는 X, a AND NOT a도 X (실제 논리값은 0). 3값 논리의 고전적 한계이며
                구현 오류가 아님. SIMULATION.md에 한계로 적을 것을 권한다.
```

### [P3-10] 문서·결정 상태 불일치

```text
Confidence:     CONFIRMED
Detail:         - SIMULATION.md:13 "Space는 도면 이동 기능을 유지한다": [P2-2](a)에서 첫 Space+드래그는 실패
                - 같은 줄 "상단 이름 … 기존 편집 대상으로 유지": 라벨은 pointer-events:none
                - DEC-010이 이 커밋에서 PROVISIONAL → CURRENT로 승격됨. 사용자 승인 기록은 §5.2의 브랜치 요청뿐이고
                  Z→X 해석, 순환 X 처리 같은 의미 선택에 대한 개별 승인은 보이지 않음
```

### [P3-11] `INVALID_CIRCUIT`일 때 캔버스가 모든 배선·출력을 "X"로 표시

```text
Confidence:     HIGH CONFIDENCE (코드 읽기, 화면 재현은 불가)
Affected files: src/renderer/CircuitSvg.tsx:~40-60 (`?? 'X'`), src/ui/SimulationPanel.tsx
Detail:         result.nets/outputs가 비어 있어도 fallback으로 X를 표시해 계산 실패와 계산된 X를 구분하기 어려움.
                진단 패널은 INVALID_CIRCUIT를 보여준다.
```

### [P3-12] compile이 도면 geometry 검증에 의존 (아키텍처)

```text
Confidence:     HIGH CONFIDENCE
Detail:         `compileCircuit`이 `validateCircuit`(wire 경로 직각성·끝점 일치 포함)를 그대로 호출하므로
                topology가 올바른데 선 모양만 깨진 회로도 INVALID_CIRCUIT이 되어 전체 값이 사라진다.
                전기적 topology 검증과 도면 검증을 분리하는 편이 "geometry 독립" 원칙에 맞는다.
```

## F. Architecture Assessment

좋은 점:

- `Circuit → compile(Plan) → simulate(inputs) → Result → Rendering` 경계가 분명하다. `simulation/*`는 React·Editor에 의존하지 않고 순수하다.
- Plan은 확정 회로 참조(`editor.circuit`, commit/Undo/Redo마다 새 clone)를 키로 `useMemo` 캐시된다. 입력 전환은 재컴파일 없이 `simulate`만 호출한다(측정에서도 5,000 게이트 simulate 약 18~29 ms 대비 compile 125~170 ms로 분리).
- 입력값은 history와 분리된 세션 상태이고, 존재하지 않게 된 Input은 `useEffect`로 가지치기한다. 실제 에디터 연산(분기, 삭제, 병합, 이동/회전, Undo/Redo) 위에서 결과가 일관됨을 확인했다.
- 반복형 Kosaraju라 스택 한도가 없고(50,000 링 확인), 순환 밖 게이트는 정상 계산된다.

위험:

- 순차회로 확장: 순환 게이트를 X로 고정하는 현재 방식은 SR 래치·플립플롭 같은 기억 소자를 표현할 수 없다. 이후에는 피드백 영역을 별도의 "안정화/이벤트 영역"으로 취급하는 모델이 필요하며, `simulate(plan, inputs)` 시그니처에는 이전 상태·시간·이벤트가 없다.
- `compileCircuit`이 렌더 중 동기 실행된다. 1,000 게이트에서 commit마다 compile 25~70 ms, 5,000 게이트에서 125~970 ms로 16.7 ms 예산을 넘는다. 워커 분리 또는 변경 영역만 재컴파일이 필요해질 수 있다.
- topology 검증과 geometry 검증의 결합([P3-12]), 형식 오류에서 예외([P3-5]).
- UI: 토글이 포인터·포커스·키보드 소유권을 직접 다루는 부분([P2-1~3])이 가장 취약한 접점이다.

## G. Performance Results

환경: Node v24.19.0, vitest 안에서 `performance.now()`, AMD Ryzen 5 5600, 64 GB. 합성 회로(별 모양 net 구성)이며 `simulate`는 한 입력을 바꿔 50회 반복한 평균.

| 구성 | 게이트 | compile | simulate(평균) | 비고 |
|---|---:|---:|---:|---|
| 직렬 체인 | 100 / 500 / 1,000 / 5,000 | 2.3 / 13.1 / 24.8 / 125 ms | 0.42 / 1.15 / 2.45 / 18.3 ms | 선형, 20회 후반 평균이 늘어나지 않음 |
| 큰 팬아웃 | 100 / 500 / 1,000 / 5,000 | 2.0 / 19.5 / 71.8 / **973 ms** | 0.19 / 1.12 / 2.70 / 29.0 ms | compile은 [P3-4]로 초선형 |
| 밀집 재수렴 DAG | 100 / 500 / 1,000 / 5,000 | 3.0 / 23.7 / 27.8 / 172 ms | 0.26 / 1.27 / 2.94 / 28.3 ms | |
| 다중 SCC(10개 링 단위) | 100 / 500 / 1,000 / 5,000 | 1.3 / 7.5 / 14.5 / 120 ms | 0.15 / 0.65 / 1.24 / 11.4 ms | 진단 500개까지 정상 |
| 10,000개 링 × 10 | 100,000 | 5,139 ms | — | |
| 단일 거대 SCC | 50,000 | 2,143 ms | — | 스택 오버플로 없음 |

- 같은 plan으로 입력만 바꿀 때 topology를 다시 컴파일하지 않음을 확인했다(코드 + 시간 분리). 캐시가 stale 결과를 반환하지 않음은 Undo/Redo/삭제 시나리오와 무작위 편집 시퀀스로 확인했다.
- 브라우저 입력→다음 프레임: 전가산기(부품 10, 배선 12)에서 300회 전환의 p50 16.7 ms, p95 17.9 ms, max 18.3 ms. 화면 주사율 한계이며 시간 증가가 없다.
- 메모리: 반복 전환 전후 `heapUsed` 차이가 GC 영향으로 부호가 섞여(-110 ~ +44 MB) **결론을 내릴 수 없다.** 메모리 PASS는 주장하지 않는다.
- 1,000+ 게이트 회로의 **브라우저** 지연: NOT VERIFIED.

## H. Test Coverage Gaps (가치 순 상위 10)

변이 검증 결과: 실제 TypeScript에 24개 의미 변이를 적용해 기존 `tests/unit/simulation.test.ts`로 실행했다. **16개 사망, 8개 생존.** 생존 8개 중 S12(재평가 중복), S15(조기 반환은 크래시 방어)는 관측 가능한 의미상 동등한 변이였고, 나머지 6개는 실제 공백이다. 별도의 독립 QA 스위트는 그중 S4·S9·S10 세 개를 잡았으며 S11·S14·S16은 어느 쪽에서도 잡히지 않았다.

1. 다중 구동 net이 게이트로 가는 경우의 의존성(변이 S4: 첫 드라이버만 보는 코드가 통과)
2. 미연결 게이트 출력 핀의 값 표시(S9)
3. 3개 이상 구성원의 피드백 진단 `objects`(S10: 2개만 보고해도 통과)
4. DRIVE_CONFLICT의 severity(S11)
5. 유효하지 않은 입력값(S14)과 FLOATING 진단 대상(S16)
6. 시뮬레이션 ON에서의 편집 제스처: 중앙 드래그, Shift+클릭, 우클릭, Space Pan, 토글 직후 키보드 흐름([P2-1~3], 기존 6개 브라우저 테스트에 없음)
7. 전가산기·MUX·디코더·비교기 같은 다단 실제 회로의 end-to-end(단위 테스트는 반가산기와 체인뿐)
8. 등록 순서 독립성의 확대: 현재는 부품 순서만 뒤집음(wire/net/pin 순서, 배선 모양, 회전 미검증)
9. 6개 게이트 전부의 UI 진리표(브라우저 테스트는 XOR만)
10. 구조 편집 후 결과 일치의 property 테스트(무작위 편집·Undo/Redo, 형식 오류 fixture). 이번 독립 스위트(`sim-editor.test.ts` 등)를 그대로 편입할 수 있다.

기존 테스트 품질: 진리표 기대값은 문자열 표로 독립 작성되어 구현을 따라가지 않아 좋다. 반면 브라우저 테스트는 `toggle.focus()` 후 Enter처럼 사용자가 실제로 하는 포인터·포커스 이동을 건너뛰는 부분이 있어 [P2-2]를 놓쳤다.

## I. Master Spec Deviations

| 항목 | 명세 | 구현 |
|---|---|---|
| §8.1 비선택 부품을 드래그하면 먼저 선택 | 모든 부품 | 시뮬레이션 ON의 Input 몸체 중앙은 불가 ([P2-1]) |
| §21 RMB는 대상 위 object menu | | Input 중앙에서 메뉴 안 열림 ([P2-1]) |
| §7.5 초안 Esc는 초안 폐기 | | 토글 포커스에서 시작한 키보드 초안은 Esc 불가 ([P2-2](#p2-2-토글이-dom-포커스와-space를-잡아-두어-키보드-소유권이-깨짐)) |
| §24 다중 구동 진단 구분 | 충돌과 같은 값 다중 구동을 구분 | 충돌 시 두 진단 모두 발생 ([P3-7], 명세 모호) |
| DEC-010 | Simulator 구현 전에 확정 | 구현 커밋이 CURRENT로 승격 ([P3-10]) |

§23 입력 토글의 "선택과 구분되는 명시적 hit area", Space를 토글에 배정하지 않음, 0/1/X/Z의 값·선 스타일 표시, 진단의 선택/화면 맞춤, 입력 변화마다 재계산은 모두 충족한다.

## J. Correction Plan

| 순서 | 항목 | Severity | 난이도 | 회귀 위험 | 의존 | 제품 결정 필요 |
|---:|---|---|---|---|---|---|
| 1 | [P2-1] 토글을 클릭 전용으로 만들고 드래그/수식키/RMB/Space는 통과 | P2 | 낮음~중 | 중 (포인터 제스처) | 없음 | 토글 면적·방식(중앙 클릭 유지 여부) |
| 2 | [P2-2] 토글 후 svg 포커스 복원, 초안 중 토글 유지(disabled), Space 전달 | P2 | 낮음 | 중 (키보드 소유권) | 1과 함께 | 없음 |
| 3 | [P2-3] 토글 시 해당 Input 선택 또는 선택 해제 | P2 | 낮음 | 낮음 | 1과 함께 | 선택 정책 |
| 4 | [P3-6][P3-5][P3-12] compile 방어: 입력값 검증, 형식 방어, topology/geometry 검증 분리 | P3 | 중 | 낮음 | 로드/저장 도입 전 | 없음 |
| 5 | [P3-4] `validateCircuit` adjacency를 O(E)로 | P3 | 낮음 | 낮음 | 없음 | 없음 |
| 6 | [P3-7][P3-8] 진단 중복·메시지 식별성 | P3 | 낮음 | 낮음 | 진단 정책 | 충돌 시 한 진단으로 줄일지 |
| 7 | [P3-9][P3-10] 문서(X 비관성, Space·이름 문구, DEC-010 승인 기록) | P3 | 낮음 | 없음 | 없음 | DEC-010 승인 |
| 8 | §H 테스트 보강(독립 스위트 편입) | — | 중 | 없음 | 1~6 이후 | 없음 |

## K. Merge Verdict

```text
READY AFTER MINOR FIXES
```

근거:

1. **시뮬레이션 정확성은 반례 없음.** 4상태 게이트 100케이스와 드라이버 결합 357케이스를 독립 기준으로 전수 검증했고, 7종 실제 회로(전가산기 포함), 순환·비순환 혼합, 다중 구동, 약 2,000개 무작위 회로의 참조 시뮬레이터 대조·순서/geometry 독립성, 40×25스텝 무작위 편집 시퀀스가 모두 0 불일치였다.
2. **기준선 재현.** 타입·빌드·단위 311+1 skip·브라우저 129가 문서와 같이 통과했고, 기준 브랜치의 123개 브라우저와 179+1 단위 테스트도 대상에서 보존된다. 의존성 advisory 0건.
3. **에디터와의 상태 격리는 건전.** 입력 변경은 history/회로/선택/viewport를 바꾸지 않고, 구조 편집·Undo/Redo 후 즉시 재계산되며 입력 수명 정책이 문서대로 동작한다.
4. **다만 시뮬레이션 ON의 Input 조작에 실제 회귀가 있다.** 중앙 영역 독점([P2-1]), 포커스·키보드 소유권([P2-2]), 토글 후 Delete의 대상 불일치([P2-3])는 모두 재현되었고 P0/P1은 아니지만 병합 전에 고치는 것이 좋다. 수정 범위는 `CircuitSvg.tsx`의 토글 한 곳이다.
5. **미검증 범위가 남아 있다.** 큰 회로의 브라우저 지연, 실제 IME, `npm ci`, 형식 오류 UI 표시는 NOT VERIFIED이며 이를 근거로 안전성을 주장하지 않는다.

## 부록 1. 검증 중 발생한 사고와 정정

- **내 도구 때문에 파일이 지워졌다가 복구함.** 임시 worktree에서 `node_modules`를 junction으로 연결한 상태에서 `git worktree remove --force`를 실행했고, git이 junction을 통과해 `D:\Circlith\node_modules\.bin`(10월 15일 감사 때 존재를 확인한 폴더)을 삭제한 것으로 보인다(오류 "Invalid argument"로 중단됨). 숨김 파일 `.package-lock.json`이 원래 있었는지는 확인하지 못했다. 패키지 본체 50개는 lockfile 기준으로 모두 남아 있었다(나머지 50개는 다른 OS용 optional 패키지). 발견 즉시 `npm rebuild --ignore-scripts --offline --package-lock=false`로 `.bin`의 10개 shim(esbuild, nanoid, playwright, playwright-core, rollup, tsc, tsserver, vite, vitest, why-is-node-running)을 복구했고 `package-lock.json`은 변경되지 않았다. `npm test`가 다시 311 passed로 동작함을 확인했다. **숨김 파일 `node_modules/.package-lock.json`은 현재 없으며 복구하지 않았다.** 기능에는 영향이 없고 다음 `npm ci`/`install`이 재생성한다. 다른 작업자가 그 사이 `.bin`이 필요한 명령을 실행했다면 일시적으로 실패했을 수 있다.
- **내 단언 오류 2건.** (1) Python 포팅 시험의 `OR(loopX,0)` 기대값, (2) 브라우저 시험에서 X 상태 토글 후 기대 출력. 둘 다 구현 결함이 아니라 내 기대값 실수였고 정정했다. 또 첫 브라우저 프로브는 배치 직후 선택 상태가 남아 있어 "중앙 클릭이 선택한다"고 잘못 보였는데, 선택을 비운 통제 프로브로 다시 확인해 [P2-1]의 근거를 바로잡았다.
- **dev server를 직접 띄움.** 기준 브랜치 브라우저 테스트를 위해 임시로 5174 포트에 Vite를 띄웠다가 종료했다. 5173의 기존 서버는 그대로다.
- **원본 working tree 변경.** 작업 후반 다른 작업자가 원본 working tree를 수정하기 시작했다. 이 보고서의 판단은 eb44fc5 기준이다.

## 부록 2. 재현 자산

독립 QA 소스는 `…\scratchpad\qa-sources\`에 보관했다(저장소에는 넣지 않음).

- `sim-qa.test.ts`: 진리표·결합·실제 회로·메타모픽·피드백·성능·형식 오류
- `sim-editor.test.ts`: 실제 Editor 연산 + 무작위 편집 시퀀스
- `sim-dyn.spec.ts`, `sim-probe2.spec.ts`, `sim-probe3.spec.ts`: Playwright 동적 검증과 [P2] 프로브
- `mutate.mjs`: 실제 TS 대상 변이 검증, `audit.mjs`: advisory 조회
- `t_*.py`, `sim.py`: 초기 Python 교차 검증

실행 예(별도 worktree에서): `vitest run --config vitest.qa.config.ts`, `playwright test --config playwright.qa.config.ts`.
