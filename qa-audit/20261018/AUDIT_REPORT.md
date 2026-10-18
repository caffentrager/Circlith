# Circlith — 통합 독립 감사 보고서

검증일 2026-10-18/19 · 검증자: 독립 Verification/QA (구현자 아님) · **production code 수정 0건, merge/push/commit 0건**

## A. Executive Summary

1. 현재 `main`(cd8bf7e)의 **논리 계산은 UI로 도달 가능한 모든 회로에서 정확**하다: 독립 오라클 대조(전수 4상태 진리표·16입력·반전 버블·다중 드라이버·무작위 그래프·메타모픽·8 000회 상태 퍼즈) **불일치 0건**.
2. 이전 감사 결함은 **전부 그대로 남아 있다** (15개 항목 중 FIXED 0). F1(P0, 노출 없음)·F2(P2, 모든 프리셋에서 직접 노출)·F3(P2, API 계약)가 재현된다.
3. **신규 결함 7건**: N1 *게이트 입력 수를 늘리면 배선이 새 몸체를 관통해 커밋됨(320개 시나리오 중 72개)*, N2 XOR/XNOR ≥8입력의 바깥쪽 반전 버블이 핀을 삼킴, N3 고정 경유점에서 Apply가 “배선 경유점 오류”로 거부, N4 모달 배경 클릭 뒤 Esc 불능, N5 Pages 동일 커밋 검사 약함, N6 문서 낡음, **N7 입력 토글·팬·줌마다 SVG 전체를 O(N²)로 다시 그림 (1 000게이트 ≈ 0.5 s)**.
4. 새 기능(Properties·가변 입력·반전 버블·점프 브리지)은 핵심 무결성을 지킨다: 핀 ID 보존, 연결된 핀 제거 거부의 원자성, 1 Undo, 키 격리, 브리지는 순수 파생(회로·history 불변).
5. 기존 테스트(340+1 skip / 141)는 모두 통과하지만 20개 의미 변이 중 3개를 못 잡는다(M04 충돌 severity, M05 SCC 목록 절단, M17 핀 소유권 검사). F1·F2·F3·N1·N2·N7은 기존 테스트가 전혀 감지하지 못한다.
6. **Final Verdict: FIX CORE EDITOR INTERACTION ISSUES FIRST** (F1은 저장/불러오기 도입 전 반드시 해결 — 그 시점에 NOT READY로 승격).

## B. Tested Revision
| 항목 | 값 |
|---|---|
| 대상 | `main` = `cd8bf7e3ff50a72b81781a5c53b675dbcb8e1655` (`git ls-remote origin` 일치 확인; `git fetch`는 원본 트리 보호를 위해 생략) |
| `codex/logic-simulation` | `f1d9d8a` — main의 조상 (`merge-base --is-ancestor` = 0) |
| 이전 감사 기준 | `eb44fc5` — main의 조상. `git diff eb44fc5..main` = 36 files, +1129/−71, `git diff --check` 통과 |
| QA 사본 | `build/qa-audit-20261018/work`(단위·변이), `work-browser`(브라우저·Pages): `git archive` + 독립 `npm ci`, node_modules junction 없음 |
| 환경 | Windows 10, Ryzen 5 5600 / 64 GB, Node 24.21.0, npm 11.17, Chromium 156 (Playwright 1.64), Vitest 5.0.4, TS 5.9.3, Vite 6 |
| 원본 상태 | 종료 시 `git status` = 시작과 동일(이전 감사 파일 `review/CLAUDE_…` 미추적만). 사용자의 5173 dev server·기존 프로세스 미종료. 변이 실행이 멈춰 내가 시작한 vitest 프로세스 2개만 종료했고 QA 사본 `src`를 `src.orig`에서 복원(diff 동일 확인) |
| 읽은 보고서 | `REPORT_codex_20261018.md`, `CLAUDE_logic-simulation_verification_eb44fc5.md` 원문 모두 읽음 |
| 읽은 문서 | README, MASTER_SPEC(§9.4,§13.8,§24,DEC 표), SIMULATION, PAGES_DEPLOYMENT 등 존재 확인. `docs/EDITOR_EXPANSION_SCOPE.md` 존재, 지시서의 나머지 파일도 존재 |

## C. Baseline Test Results
| 검사 | 결과 |
|---|---|
| `npm ci` | PASS (50 pkgs, 0 vulnerabilities) |
| `tsc --noEmit` | PASS |
| `vite build` | PASS (247 modules, JS 499.33 kB) |
| Unit (`vitest run`) | **340 passed, 1 skipped (soak), 0 failed** — 15 files |
| Browser (Playwright, 동일 testDir, 5173 점유로 포트 5290 사용자 config) | **141 passed, 0 failed/skipped/flaky**, 62 s |
| `git diff --check` / `npm audit --audit-level=moderate` | PASS / 0 취약점 |
| Pages | editor/simulation 빌드 → `assemble-pages` → `check-pages` **PASS** (공통 브리지·Properties, 저장 키 분리, 자산 오류 0) |
| CI workflow | 코드 리뷰만(GitHub 실행은 미수행): `pages.yml` deploy `needs: build`+`ref==main`; `check.yml`은 배포 없음; 액션 SHA 고정 |
| 이전 보고서 수치와 차이 | 이전 311+1 / 129 → 현재 340+1 / 141 (신규 테스트 +29/+12). 문서는 아직 311/129 (N6) |

## D. Previous Findings Verification (PART 20)
| ID | 원 발견 (커밋) | 현재 위치 | 재현 테스트 | 현재 결과 | 상태 | 권고 |
|---|---|---|---|---|---|---|
| Codex F1 (eb44fc5) | net ID `pin:<floating>` 충돌 | simulator.ts:82-91 | qa-tests/unit/prior.test.ts | 16조합 중 42 불일치, 진단 없음. 접두사 `pin:`만 충돌 | **STILL REPRODUCIBLE** (P0 무결성 / 노출 없음) | 별도 Map/객체 키, import 전 필수 |
| Codex F2 | Input 토글이 Pan/RMB 차단 | CircuitSvg.tsx:102-112 | browser/f2.spec.ts, presets.spec.ts | 8프리셋 모두 재현 | **STILL REPRODUCIBLE** (P2) | 좌클릭 클릭만 소유 |
| Codex F3 | 손상 데이터 TypeError | connections.ts / simulator.ts | prior.test.ts | 24 fixture 중 12 throw | **STILL REPRODUCIBLE** (P2, UI 비노출) | 형태 방어 + 컴파일 경계 |
| Claude P2-1 | Input 중앙 독점(선택·이동·Shift·메뉴) | 위와 동일 | f2.spec.ts | 재현 (F2와 같은 원인) | STILL REPRODUCIBLE | F2에 통합 |
| Claude P2-2 | 포커스/Space/Esc | 위와 동일 | f2.spec.ts | 첫 Space-drag = 박스선택, W→Esc 불능 재현 | STILL REPRODUCIBLE | F2에 통합 |
| Claude P2-3 | 토글 후 Delete가 이전 선택 삭제 | CircuitSvg.tsx:106 | f2.spec.ts | NOT 선택→토글→Delete: 3→2. 단 NOT은 계속 **하이라이트** | 동작 재현, **PRODUCT DECISION** | 선택 유지 vs 해제 결정 |
| Claude P3-4 | validate O(F²) | connections.ts:113-114 | qa/perf.test.ts | 4× per 2×; 8000 sink 1.24 s | STILL REPRODUCIBLE | Map<string,string[]> |
| Claude P3-5 | 손상 데이터 예외 | F3과 동일 | prior.test.ts | 재현 | STILL REPRODUCIBLE | F3에 통합 |
| Claude P3-6 | 잘못된 입력값 → 0 | simulator.ts:126 | prior.test.ts | 12/12 값이 조용히 0 | STILL REPRODUCIBLE / 정책 결정 | 거부 vs X |
| Claude P3-7 | MULTIPLE+CONFLICT 이중 진단 | simulator.ts:145-148 | prior.test.ts | 충돌 시 2개, 같은값은 1개, X는 충돌 아님 | **문서화됨**(SIMULATION.md “같은 값의 다중 출력도 다중 구동 진단…”) → NOT A BUG / PRODUCT DECISION | UI 묶음 표시 선택 |
| Claude P3-8 | 진단 대상/메시지 | simulator.ts:149-151 | prior.test.ts | FLOATING objects 중복 ID 재현; 같은 이름 게이트 메시지 동일; 이제 이름 변경으로 완화 | **PARTIALLY FIXED** | objects dedupe, 메시지에 ID/위치 |
| Claude P3-9 | X pessimism 미문서 | docs | prior.test.ts | XOR(g,g)=X 재현, 문서 미기재 | STILL (설계 한계) | 문서화 |
| Claude P3-10 | 문서 불일치 | SIMULATION.md:13,42 | grep | Space/상단 이름 문구 그대로, 카운트 낡음 | STILL REPRODUCIBLE | 문서 갱신(N6) |
| Claude P3-11 | INVALID_CIRCUIT가 X로 표시 | CircuitSvg.tsx:60,65 | browser/invalid.spec.ts | Output·핀 모두 `X`, 패널만 “회로 데이터 오류” | STILL REPRODUCIBLE | 별도 표시 |
| Claude P3-12 | compile↔geometry 결합 | simulator.ts:66 | prior.test.ts | 대각선 배선 하나로 전체 값 소실 | STILL (아키텍처/스펙 모호) | 위상·도면 검증 분리 검토 |

## E. New Confirmed Findings
N1–N7: [FINDINGS.md](FINDINGS.md) 참조 (재현 절차·근거 파일·수정 방향 포함). 한 줄 요약:
* **N1 P2** 입력 수 증가 후 배선이 새 몸체를 관통 (72/320, 모두 우회 경로 존재).
* **N2 P3** XOR/XNOR 8/15/16입력 바깥 2개 반전 핀: 핀 중심↔버블 중심 2.51 px, 리드 역방향 (DOM·스크린샷 확인).
* **N3 P3** 고정 경유점+축소 시 Apply 거부, 메시지 불친절 (40개 중 5개).
* **N4 P3** 모달 배경 클릭 → focus BODY → Esc 무반응.
* **N5 P3** `assemble-pages` 낡은 dist 통과·새 SHA로 표기 (재현 로그 보관).
* **N6 P3** 문서 낡음.
* **N7 P2(성능)** 100/500/1000게이트에서 토글·줌 한 번 32/136/494 ms (production, 2프레임=32 ms 포함). 프로파일 상 ≈90 %가 (a) 핀마다 전체 net 스캔, (b) 매 렌더 `collidingSegments`(배선×부품 장애물 재생성).

## F. Simulation Correctness
| 영역 | 방법 | 결과 |
|---|---|---|
| 게이트 진리표 | 독립 가능성집합 오라클(brute force + closed form 상호검증 28 032 tuple); AND/OR/XOR/NAND/NOR/XNOR × n=2,3,4 × **모든 반전 마스크 × 모든 0/1/X/Z 조합**을 실제 회로로 4672 시뮬×6 | 불일치 0, 핀 표시값 = 반전 전 값 확인 |
| 넓은 게이트 | n=8/15/16 × 구조 케이스(전 0/1, 1개 0/1/X/Z, 패리티 0,1,2,7,8,15,16) + 400 seed 무작위 × 3 마스크 | 0 / 3 270 |
| NOT (반전 포함) | 4값 × {plain, inverted} | 통과 (invert(Z)=X, invert(X)=X) |
| 드라이버 | 1–3 드라이버 전 순열, 진단 개수 | 0 |
| SCC | 자기루프, 2/3/5/9 링, 독립 다중 SCC, 무작위 400 그래프(796 벡터에 순환 포함) vs 독립 폐포 참조 | 0 (반전 버블은 의존성 판정에 영향 없음) |
| 메타모픽 | 등록 순서(부품·핀·net·wire·net.pins), 전체 이동+90° 회전, 전체 ID 개명 ×200그래프 | 0 / 600 |
| F1 경계 | 9개 ID 형태 + Object.prototype 이름 | `pin:`만 오계산 (F1) |
| 한계 | 무작위 그래프의 다중 드라이버는 퍼즈(Editor 연산)에서 별도 검증. X pessimism은 설계 한계 |

## G. Component Properties
* 이름: 9종 × 15 케이스(trim, 80/81자, 공백/줄바꿈, 한글, 이모지(UTF-16 단위: 41개 이모지=82 → 거부), HTML) — 사양대로. **이름은 React 텍스트로만 렌더**(canvas/트리/진단 모두 `<img onerror>` 비실행, XSS 0).
* 입력 수 2~16: 6게이트 × 6 × 6 전이(216): 기존 입력·출력 핀 ID 보존, index 재부여, 고아 pin 없음, 다른 부품 불변, 원본 회로 비변경, validator·compile 통과.
* 연결된 입력 제거: 7 연결패턴 × 3 목표(21) 전부 사양대로 거부/허용, 거부 시 회로·history 동일; 분기(junction) net의 핀도 거부.
* 원자성: 이름+수+반전+배선 = history 1, no-op/invalid = 0, Undo/Redo 정확, draft 중 거부.
* 키 격리: W,M,R,G,A,Delete,Backspace,Ctrl+Z,Ctrl+Shift+Z,Ctrl+A,Space,Tab… 15종 — 회로/history/operation 불변, Tab trap 정상.
* **결함**: N1, N3, N4 (+N2는 렌더링).

## H. Wire Geometry and Bridges
* 배선 재구성(4 회전 × 7 소스 위치 × 9 전이, 140 유효): endpoint·wire/net ID 보존, 직교·유한, endpoint 정렬 위반 0, **retrace 0**. 자기 피드백(출력→자기 입력) 4회전×4전이 등 양끝 이동 케이스 통과(피드백 진단 유지). → 결함은 **몸체 관통(N1)** 과 **경유점 거부(N3)** 뿐.
* 브리지: 단위 11 + 무작위 300필드(5 401 브리지, 위반 0) + 브라우저: 호 정상 1개, 호 꼭대기 클릭=소유 배선, 교차 중앙 클릭=기존 후보 선택창(접속점 생성 없음, history 불변), On/Off/축 전환은 history·net 불변, 설정 저장·손상 복구, 줌 10–200 % 반경 3.3–5 px. 근접 교차(간격 6→반경 2, 5→생략), 접속점 인접 억제, 끝점/모서리 생략 확인.
* 성능(브리지만): 희소 3000배선 48 ms, 전부 교차 3000배선 785 ms (줌 단계·MOVE 초안 프레임마다 재계산).
* 미확인: 선택된 배선 마스크(`6/zoom`)의 10 % 줌 시각 확인 — 시도했으나 테스트 조작이 WIRE 초안을 시작해 무효 → **NOT VERIFIED**.

## I. Dynamic Browser Evaluation
F2 매트릭스 54회(제스처 9 × 위치 3 × ON/OFF) + 프리셋 160회 + 포커스 체인 + 더블클릭 + 모달 + 배경 클릭 + 뷰포트 4종 + 줌 6단계. 핵심 결과는 FINDINGS F2/N4와 evidence/browser-*.json. 추가:
* 더블클릭(ON, Input 중앙): Properties 열림, 값 2회 토글 → 변화 없음, history 불변.
* 시뮬레이션 ON/OFF: 선택·viewport·회로 보존; ON 전환 시 초안 취소(history 불변) — 사양대로.
* Properties 닫은 뒤(Esc/Apply) focus=`svg`, 단축키 복귀(W→Esc→Space-pan 정상).
* 뷰포트 1024×420/768, 1440×900, 1920×1080: 가로 overflow 없음, 모달(16입력) 화면 내·내부 스크롤, Apply 버튼 보임. 1024×420은 페이지 세로 스크롤(기존 min-height 500).
* 16입력 게이트 줌 0.1–2: 본체 클릭 선택 정상 (핀 지름 1.2–24 px).
* **IME: NOT VERIFIED** (실제 Windows 한국어 IME 미사용, synthetic composition으로 검증했다고 주장하지 않음). 스크린리더 NOT VERIFIED.

## J. Performance Results
Core (Node, median, 5회, warm-up 1):
| 구성 | 크기 | validate | compile | simulate |
|---|---|---|---|---|
| 팬아웃 | 100/500/1000/2000/4000/8000 | 0.5/5.4/19/71/270/**1245** ms | 0.5/5.6/19/70/264/1227 | 0.05–4.5 |
| NOT 체인 | 100/500/1000/2000/5000 | – | 0.7/4.1/6.1/14/39 | 0.16/0.6/1.1/2.7/7.5 |
Browser (production, 헤드리스 Chromium, 이벤트→2프레임, 20회):
| 게이트 | 토글 median / p95 | 줌 step median / p95 |
|---|---|---|
| 100 | 32 / 33 | 32 / 33 |
| 500 | 136 / 212 | 132 / 175 |
| 1000 | 494 / 609 | 469 / 579 |
(dev, 2000게이트 ≈ 2.1 s. 토글 핸들러 자체 0.3 ms; compile 재실행 아님.) 이전 Codex 수치(1000게이트 150 ms)와 다른 것은 배선 밀도(내 고정물: 게이트당 1.3 배선·3핀) 때문으로 추정 — 동일 fixture 비교는 하지 않음. 메모리/누수는 GC 통제 불가로 **NOT VERIFIED**; 5000게이트 브라우저 **NOT VERIFIED**.

## K. Test Suite Quality
* 기존 테스트 품질: 진리표는 리터럴 표, evaluateGate로 기대값을 만들지 않음(양호). 공백: ID 충돌, 손상 데이터, 토글 제스처/포커스, 입력 수 변경 후 배선·몸체 교차, 반전 버블 지오메트리, 렌더 비용, Esc/backdrop, 진단 severity·SCC 멤버.
* 변이 20개(QA 사본): 기존 스위트 **17/20 검출** (미검출 M04 conflict severity, M05 SCC 목록 절단, M17 핀 소유권 검사 삭제). 내 QA 스위트 **19/20** (M17 미검출 — 고아 pin fixture 부재; 동등 변이 여부는 미판정). F1·F2·F3는 실제 결함이 기존 스위트를 통과하고 있음이 그 자체로 “생존 변이” 증거. 상세: evidence/mutation-results.json.
* 플래키/거짓 PASS: 기존 브라우저 141 전부 1회 통과(flaky 0). `waitForTimeout`은 소수. 기존 `toggle.focus()+Enter` 시나리오가 실제 클릭→Space/Esc 흐름을 건너뛰어 F2를 놓침.
* 새 회귀 테스트(보관: `qa-tests/`): prior, oracle, properties, geometry, bridges, fuzz, perf, collisions, + browser 11 spec. 실패하는 것은 의도된 결함 증거(prior 27, geometry 6, properties 2→N1/N3, collisions 1).

## L. Architecture Assessment
* 분리(Circuit → compile → simulate → UI)는 양호; plan은 `editor.circuit` 참조로 캐시되어 geometry 변경에도 재컴파일(허용), 입력 토글은 재컴파일 없음.
* 위험: (1) 시그널 키 네임스페이스(F1), (2) validator/compile 비전역성(F3)과 topology↔geometry 결합(P3-12), (3) **렌더러가 모든 상호작용에서 전체 SVG와 O(N²) 보조 계산을 수행(N7)**, (4) Properties 배선 재구성이 라우터 장애물/앵커 규칙과 별개의 코드 경로(N1, N3), (5) 입력 토글이 pointer/keyboard 소유권을 직접 관리(F2).
* 순차회로 확장 시 현 SCC→X 정책은 기억 소자로 재사용 불가 (이전 보고서와 동의).

## M. CI/CD Assessment
* 동일 소스 두 모드 빌드/조립/브라우저 검증 모두 통과. editor 모드에는 시뮬레이션 UI 없음, 공통 Properties·브리지는 동일 동작. localStorage: `circlith.*` vs `circlith.simulation.*` 분리 확인(`circlith.simulation.wire-display.v1` 등).
* 게이트: `pages.yml` deploy는 `needs: build` + main; 테스트/빌드/check-pages 실패 시 배포 불가(워크플로 코드 기준, 실행 미확인).
* **N5**: 동일 커밋 검사가 `git rev-parse HEAD`라 낡은 dist를 못 잡음(재현). CI에서는 신선한 checkout이라 실영향 낮음.
* 로컬 `npm run test:browser`는 `npm run dev`를 webServer로 쓰므로 PATH에 npm이 없거나 5173이 점유되면 동작하지 않음(환경 이슈, 제품 결함 아님).

## N. Recommended Corrections → [FIX_PLAN.md](FIX_PLAN.md)

## O. Product Decisions Needed
1. 토글 후 선택 정책(P2-3): 유지(현재, NOT은 계속 하이라이트) vs 토글한 Input 선택 vs 선택 해제.
2. 잘못된 Input 값/ID 정책: 거부(INVALID) vs X 처리; ID 형식 제한(UUID만) 여부 — F1 해결 방식과 독립적으로 “조용한 오계산 금지”.
3. 충돌 시 진단 2개를 1개로 줄일지(P3-7).
4. X pessimism 허용 여부 및 문서화(P3-9).
5. Properties 입력 수 변경 시 배선: 자동 재라우팅 vs 거부/경고 (N1).
6. topology 검증과 geometry 검증을 분리해 도면 오류가 계산을 막지 않게 할지(P3-12).

## P. Final Verdict
**FIX CORE EDITOR INTERACTION ISSUES FIRST**

근거: 계산·무결성 코어는 UI 경로에서 반례가 없고(F1은 비노출), 새 기능의 무결성도 양호하다. 그러나 3회 연속 감사에서 확인된 F2가 그대로 main에 병합·배포됐고, 새 기능이 N1(몸체 관통 배선)·N7(상호작용 지연)을 추가했다. 저장/불러오기·붙여넣기 등 외부 데이터를 받는 단계로 가기 전에는 **F1·F3를 반드시** 먼저 닫아야 한다(그 시점에는 NOT READY — CIRCUIT INTEGRITY RISK). 이 판정은 기존 배포를 되돌릴지 여부가 아니다.

## 부록: NOT VERIFIED
실제 Windows 한국어 IME · 스크린리더 · 장기 soak/메모리 누수 · 5000게이트 브라우저 · 선택 배선 마스크 10 % 줌 시각 · GitHub에서의 실제 CI 실행/배포 URL(로컬 빌드 산출물로 대체) · `git fetch`(ls-remote로 대체) · 모든 입력 프리셋×모든 제스처의 포커스 상호작용(제스처 5종×프리셋 8종만).

## 부록: 산출물
`AUDIT_REPORT.md`, `FINDINGS.md`, `FIX_PLAN.md`, `TEST_MATRIX.md`, `evidence/`(JSON·로그), `screens/`(PNG), `qa-tests/`(unit·browser·config·mutation harness). 재현: `qa-tests/config/*` 와 `env.ps1` (경로는 QA 사본 기준).
