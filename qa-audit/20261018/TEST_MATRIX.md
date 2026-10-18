# TEST_MATRIX

## 기존 스위트 (main cd8bf7e, QA 사본)
| 스위트 | 결과 |
|---|---|
| tsc --noEmit / vite build | PASS / PASS |
| vitest (tests/unit, 15 files) | 340 pass, 1 skip, 0 fail |
| Playwright (tests/browser, 19 files) | 141 pass, 0 fail/skip/flaky (62 s) |
| check-pages (두 모드) | PASS |
| npm audit (moderate+) / git diff --check | 0 / PASS |

## 독립 QA 스위트 (qa-tests/)
| 파일 | 내용 | 결과 |
|---|---|---|
| unit/prior.test.ts (55) | F1(9 ID형), F3/P3-5(24 fixture), P3-6(12 값), P3-7/8/9/11/12 | 28 pass / **27 fail = 재현된 결함** (F1 ×1, F3 ×12, P3-6 ×12, P3-8 ×2) |
| unit/oracle.test.ts (45) | 독립 4상태 오라클, 전수 n=2–4×반전 마스크, 넓은 게이트, 드라이버, 400 무작위 그래프, 600 메타모픽 | **45 pass** |
| unit/properties.test.ts (153) | 이름 135, 전이 6×36, 연결 제거 매트릭스, 원자성, 배선 재구성(140), 경유점(40), 자기 피드백 | 151 pass / 2 fail (N1·N3 근거; 아래 collisions가 정밀 계측) |
| unit/collisions.test.ts (1) | 입력 수 변경 후 배선×몸체 관통 | **fail**: 72/320 |
| unit/geometry.test.ts (38) | GateBody SVG 파싱(버블/핀), 912핀 회전×수×종류 경계 | 32 pass / 6 fail (N2) |
| unit/bridges.test.ts (11) | 교차/접속점/근접/무작위 300필드/순수성/성능 | **11 pass** |
| unit/fuzz.test.ts (8×1000 op) | Editor 상태 퍼즈 + 독립 참조 시뮬레이터 + undo/redo 전체 | **8 pass** (위반 0) |
| unit/perf.test.ts (2) | 팬아웃 100–8000, 체인 100–5000 | pass (수치 기록) |
| unit/probe-proto.test.ts, probe-wires.test.ts | Object.prototype ID, 경유점·충돌 샘플 | 기록용 |
| unit/mutate.mjs | 변이 20개 (QA 사본, 매번 src.orig로 복원) | 기존 17/20, QA 19/20 검출 |
| browser/f2.spec.ts | 제스처 9×위치 3×ON/OFF=54 + 포커스/Delete/Esc/더블클릭/모드 | matrix test **fail**(F2 재현), 나머지 기록 |
| browser/presets.spec.ts | 프리셋 8 × ON/OFF × 제스처 5 × 위치 2 = 160 | pass(기록) → lost-effects 50 |
| browser/props.spec.ts | 키 격리, Tab trap, 포커스 체인, 이름 edge, backdrop, 16입력 DOM 기하 | XOR16 기하 **fail**(N2), 나머지 pass |
| browser/bridges.spec.ts | 호 클릭/선택/설정/줌/시뮬레이션 색 | **4 pass** |
| browser/viewport.spec.ts | 4 해상도 + 줌 6단계 | **5 pass** |
| browser/perf.spec.ts, profile.spec.ts | 100–2000 게이트 렌더 지연, CPU 프로파일(dev/prod) | pass(수치 기록) |
| browser/shapes.spec.ts, closeup.spec.ts, invalid.spec.ts | 심벌 갤러리/확대/INVALID 표시 | 스크린샷 |

## 변이 결과 (evidence/mutation-results.json)
M01 invert(Z)=Z · M02 XOR 패리티 반전 · M03 AND 지배 0 무시 · **M04 DRIVE_CONFLICT severity(기존 미검출)** · **M05 SCC 목록 절단(기존 미검출)** · M06 입력 수 off-by-one · M07 resize 시 핀 ID 재생성 · M08 history 2회 기록 · M09 브리지가 junction 생성 · M10 반전 미적용 · M11 XNOR 미반전 · M12 X+0→0 · M13 FLOATING 진단 제거 · M14 제거 핀 레코드 잔존 · M15 출력 index 미갱신 · M16 연결 입력 제거 허용 · **M17 핀 소유권 검사 삭제(둘 다 미검출)** · M18 피드백 게이트 계산 · M19 undo가 redo 스택 미보존 · M20 브리지 반경 무제한.

## 커버리지 공백 (이번 감사 기준)
ID 이름공간, 손상 데이터 totality, 토글 제스처·포커스, 몸체 확대 후 배선, 반전 버블 지오메트리, 렌더 비용 예산, 모달 backdrop, 고아 pin fixture, 진단 severity/SCC 멤버.
