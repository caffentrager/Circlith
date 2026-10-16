# CIRCLITH MASTER SPEC

**통합 설계·조작·단축키·입력·시뮬레이션·검증 기준 문서**  
작성일: 2026-10-13  
문서 상태: **MASTER DRAFT / 구현 기준 후보**  
대상: Circlith 논리회로 시뮬레이션 CAD

> 이 문서는 현재 대화에서 확보된 Circlith 관련 설계 문서를 하나의 기준 문서로 통합한 것이다. 기존 문서의 중복 내용은 합쳤고, 충돌하는 제안은 결정 레지스트리와 부록에 이력을 남겼다. 사용자 승인이나 실제 사용성 검증을 거치지 않은 항목은 `PROVISIONAL`, `EXPERIMENTAL`, `DEFERRED`로 표시하며 임의로 확정된 것으로 취급하지 않는다.

---

## 0. 문서 권위와 읽는 법

### 0.1 이 문서의 역할

앞으로 Circlith 설계에서 같은 주제를 여러 문서가 다르게 설명할 경우 **이 문서를 우선 기준으로 사용한다.** 과거 문서는 연구·검토·변경 이력으로 보존한다.

단, 이 문서 안에서도 상태가 `PROVISIONAL`, `EXPERIMENTAL`, `DEFERRED`인 항목은 최종 승인을 뜻하지 않는다.

### 0.2 결정 상태

| 상태 | 의미 |
|---|---|
| `CURRENT` | 현재 구현 기준으로 사용해도 되는 기본값. 실제 사용자 검증 완료를 뜻하지는 않음 |
| `PROVISIONAL` | 현재 권장안이 있으나 사용자 승인 또는 프로토타입 검증이 더 필요함 |
| `EXPERIMENTAL` | 비교 실험 후 채택 여부를 결정할 후보 |
| `DEFERRED` | 해당 기능 단계가 오기 전까지 활성화하지 않음 |
| `REJECTED` | 현재 기본안에서 제외. 변경 이력에는 보존 |

### 0.3 이번 통합에 직접 사용한 자료

1. `codex LF final.md` — 제품 목표, 화면, 조작, 배선, Undo, 시뮬레이션, 저장, 입력, 검증의 통합 설계안.
2. `SHORTCUTS_Consolidated.md` — 단축키 벤치마크와 Claude/Codex 버전 비교, 키 설계의 근거와 후보.
3. `Circlith_남은_문제점_검토서.docx` — 두 문서의 충돌과 구현 전 미결정 사항을 P0/P1/P2로 분석한 검토서.
4. `ISSUES_AND_SOLUTIONS_Codex.md` — 검토서에 대한 Codex의 해결안과 일부 정정.
5. `REVIEW_RESPONSE_Claude.md` — 검토서에 대한 Claude의 수용·이견·보완.

다음 문서는 위 자료에서 이름과 경로가 언급되지만 이번 대화에 원문이 제공되지 않았으므로 **내용을 추정하여 통합하지 않는다.**

- `docs/PLAN.md`
- `docs/INTERACTION.md`
- `docs/USABILITY.md`
- `docs/SHORTCUTS.md`
- `docs/SHORTCUTS_v0.2.md`
- `docs/SHORTCUTS_Codex_v0.2.md`
- `docs/SHORTCUTS_Claude_v0.3.md`
- 원본 CAD 단축키 벤치마크 문서

향후 이 원문들을 가져오면 본 문서와 충돌 여부를 다시 대조한다.

---

# Part I. 제품 정의

## 1. 제품 목표

**Circlith는 회로를 빠르게 그리고, 연결 상태를 쉽게 이해하고, 실수를 바로 복구할 수 있는 논리회로 시뮬레이션 CAD를 목표로 한다. 가장 중요한 평가 기준은 조작성이다.**

완료 시간만 줄이는 것이 목적은 아니다. 다음 항목을 함께 평가한다.

- 오선택 빈도
- 의도하지 않은 연결·단선
- 불필요한 도구 전환
- 사용자가 막히는 지점
- 잘못된 작업을 취소·Undo로 복구하는 성공률
- 현재 도구와 다음 입력 결과의 예측 가능성

### 1.1 조작성 원칙

1. 현재 도구와 다음 클릭의 결과를 알 수 있어야 한다.
2. 배치·이동·배선은 확정 전에 미리보기를 제공한다.
3. 부품이나 배선 경로를 이동해도 논리 연결은 의도하지 않게 바뀌지 않는다.
4. 교차·접속·미연결을 명확히 구분한다.
5. 진행 중 작업은 취소할 수 있고, 확정된 작업은 명확한 Undo 단위로 복구할 수 있어야 한다.
6. 단축키를 외우지 않아도 버튼·메뉴·검색으로 같은 명령에 접근할 수 있어야 한다.
7. 색만으로 신호·선택·오류 의미를 전달하지 않는다.
8. 후보 기능을 예약했다는 이유만으로 초기 구현 범위를 확대하지 않는다.
9. 벤치마크 제품과 같은 키를 사용한다는 이유만으로 학습 비용이 0이라고 주장하지 않는다.
10. 측정되지 않은 성능·속도·사용성 향상을 사실처럼 표현하지 않는다.

## 2. 사용자와 사용 환경 가정

### 2.1 우선 환경

- Windows 데스크톱
- 마우스 + 키보드 우선
- 트랙패드를 위한 화면 이동 대안 제공
- 우선 검증 화면 폭: 1024px 이상
- 좁은 화면에서는 패널 접기
- 모바일 터치 편집은 후속 명세
- 기본 실습은 계정·운영 서버가 없어도 가능한 정적 웹 구조를 우선 검토

### 2.2 우선 사용자

- 논리회로 실습 학생
- 작은 회로를 설명하는 교사
- 전문 회로 설계자가 주 사용자인지는 추가 확인 대상

### 2.3 대표 작업

입력·게이트·출력을 배치하고 배선을 연결한 뒤, 입력 값을 바꾸며 결과를 확인한다.

---

## 3. Logic Forge에서 가져올 원칙

Logic Forge 검토에서 확인한 구조적 참고점은 다음과 같다.

- `core`: 배선·핀 연결망, 기본 소자, 0/1/X/Z 계산, 진리표
- `editor`: 부품 변환, 배선 경로, 클립보드
- `simulation/formats/export/storage`: 입력 패턴, 파일 형식, 구조 내보내기, 저장
- `ui`: 입력 이벤트와 상태 연결, 메뉴·패널·렌더링

Circlith에 가져올 핵심은 다음이다.

1. 논리 모델과 도면 경로를 분리한다.
2. 편집 안정성·시뮬레이션 정확성·저장 검증을 각각 테스트한다.
3. 논리 단위 테스트가 실제 브라우저 조작 검증을 대체한다고 보지 않는다.
4. 모든 책임을 하나의 거대한 controller에 누적하지 않는다.
5. MyLogic 전체 데이터·라이브러리 호환은 초기 완료 조건으로 삼지 않는다.

---

## 4. 화면 구성

### 4.1 패널형 — 기본 프로토타입 시작안

| 위치 | 내용 | 목적 |
|---|---|---|
| 상단 | 프로젝트 이름, 저장 상태, 선택/배선 도구, Undo/Redo. 시간 기능 이후 Run/Pause/Step | 현재 작업·실행 상태 확인 |
| 왼쪽 | 부품 검색, 최근 사용, 기본 논리 부품 | 검색→배치 진입 단축 |
| 중앙 | 도면, 그리드, 핀, 배선, 선택, 미리보기 | 주 작업 공간 |
| 오른쪽 | 선택 대상 속성 또는 안내 | 편집 대상·설정 확인 |
| 하단 | 현재 도구, 상황별 키 안내, 필요 시 진단·파형 | 다음 조작·문제 원인 확인 |

### 4.2 도면 집중형 — 비교안

부품 패널을 접고 검색/목록을 필요할 때 열며, 속성은 선택 중에만 보인다. 도면 폭은 늘어나지만 패널을 다시 여는 조작이 추가된다.

**상태: `EXPERIMENTAL`** — 같은 회로 작성 과제로 패널형과 비교한다.

---

## 5. 기능 범위와 제작 순서

| 단계 | 범위 | 통과 조건 |
|---|---|---|
| 설계 — 현재 | 제품 계획, 조작 명세, 화면안, 단축키, 결정 레지스트리, 검증 계획 | 핵심 상태 전환과 CURRENT/PROVISIONAL 항목 명확화 |
| 편집 프로토타입 | 배치, 선택, 이동, 회전, 직각 배선, 분기, 삭제, Undo/Redo | 반가산기 편집, 취소·복구, 연결 불변식 검증 |
| 첫 사용 가능 버전 | AND/OR/NOT/XOR/NAND/NOR/XNOR, 입력·출력, 복사·붙여넣기, JSON 저장·복구, 0/1/X/Z 조합 계산 | 작은 조합회로 작성·저장 왕복·오류 복구 |
| 시간 시뮬레이션 | D FF, Clock, Run/Step/Reset, 파형 | 이벤트 순서·동시 이벤트·상태 초기화 규칙 검증 |
| 확장 | Net Label, Probe, 계층, 추가 소자, Bus, 필요한 호환 | 실제 사용 요구와 재현 가능한 검증 확보 |

초기 범위 밖:

- SPICE
- FPGA 제작 플로우
- 실제 게이트 지연의 물리적 재현
- 클라우드 협업
- AI 회로 생성
- 원본 MyLogic 전체 라이브러리/파일 호환

### 5.1 `feat/editor-prototype` 브랜치 우선순위 — 2026-10-15 사용자 지시

이 브랜치는 조작과 제어, UI/UX 성숙을 우선한다. 기존 선택·드래그·배선·회전·뷰 조작의 일관성, 입력 소유권, 상태 피드백, 취소·Undo/Redo와 브라우저 충돌을 먼저 다듬는다. Delete·클립보드·저장·추가 부품·시뮬레이션 등 미구현 목록은 즉시 구현할 작업 순서가 아니다. 추가 기능은 조작 흐름이 충분히 성숙한 뒤 진행한다. 위 단계별 표는 장기 제품 범위이며 이 브랜치의 현재 구현 우선순위를 덮어쓰지 않는다.

---

# Part II. 결정 레지스트리

## 6. 핵심 결정

| ID | 주제 | 현재 상태 | 통합 기준 |
|---|---|---|---|
| DEC-001 | 문서 권위 | `CURRENT` | 이 Master Spec 하나를 구현 기준으로 사용. 기존 문서는 참고/이력 |
| DEC-002 | 기본 이동 | `CURRENT` | `M` = 논리 연결을 유지하는 Move. `G` = Grid 표시 토글 |
| DEC-003 | 빠른 배치 P/Q | `EXPERIMENTAL` | v1은 `A` 검색이 기본. `P`는 Probe용으로 보존. 필요 시 `Q` Quick Place 비교 |
| DEC-004 | 검색 정렬 | `CURRENT` | 검색어 있음: exact name/alias → prefix → keyword/fuzzy → recent 동점 보조. 빈 검색어: Recent/Favorites |
| DEC-005 | 상태 모델 | `PROVISIONAL` | Tool / Operation / Transient / Focus를 분리한 직교 상태 모델 |
| DEC-006 | Preview 중 Undo | `PROVISIONAL` | 안전 우선안: 첫 `Ctrl+Z`는 활성 초안만 취소, 다음 `Ctrl+Z`가 history Undo. Codex 단일입력안은 부록에 보존 |
| DEC-007 | Safe Move geometry | `PROVISIONAL` | 전체 autoroute 금지. 선택 내부는 강체 이동, 외부 연결만 최소 orthogonal stretch |
| DEC-008 | 우클릭 | `CURRENT` | Master Spec 기본 구현 정정: Modern은 짧은 RMB 메뉴, MMB/Space+LMB Pan. RMB drag Pan은 호환 프리셋 또는 사용자 바인딩 |
| DEC-009 | 다중 Properties | `PROVISIONAL` | 의미적으로 호환되는 공통 속성만 일괄 편집. 혼합값 표시, 원자적 변경, 1 Undo |
| DEC-010 | 0/1/X/Z resolution | `PROVISIONAL` | 4상태 논리와 진단을 분리. Simulator 단계 전 확정 |
| DEC-011 | 미연결 배선 종료 | `PROVISIONAL` | v1에서 빈 공간 더블클릭 종료 제외. 필요 시 명시적 Finish Unconnected 명령 |
| DEC-012 | 그룹/서브회로 | `DEFERRED` | 그룹=비전기적 편집 묶음, 서브회로=포트·내부 회로·저장 경계가 있는 전기적 단위 |
| DEC-013 | 시간 Step | `DEFERRED` | 이벤트 Step과 clock edge/period를 분리. 동시 이벤트 semantics 이후 키 확정 |
| DEC-014 | 성능 기준 | `PROVISIONAL` | 수치보다 측정 지표를 먼저 정의. 60Hz 16.7ms는 목표 후보, 기존 33ms는 과거 잠정안으로 보존 |
| DEC-015 | 브라우저 억제 | `PROVISIONAL` | key/pointer × state/focus 매트릭스로 `preventDefault`/전파 종료를 관리 |
| DEC-016 | 입력 프로필 | `CURRENT` | Command Registry → Binding → Preset 분리. Modern 기본, 버전 있는 외부 JSON, built-in + 사용자 override. 입력 재배정은 연결 유지 등 명령 불변식을 바꾸지 않음. 미지원 명령은 표시하며 실행하지 않음 |
| DEC-017 | 현재 브랜치 우선순위 | `CURRENT` | `feat/editor-prototype`은 조작·제어·UI/UX 성숙을 우선한다. 미구현 기능 확장은 그 이후다. §5.1 |

### 6.1 입력 프리셋 구현 결정

2026-10-13 후속 사용자 지시로 `IMPLEMENTATION_PROMPT.md`를 우선 반영한다. 기본 우클릭은 메뉴이며 Altium/EasyEDA 등의 RMB click/drag는 threshold로 구분한다. 좌클릭 box와 부품 패널/접점 직접 조작은 유지한다. 순차 accelerator는 설정 가능한 timeout과 대기 표시를 제공하며 Esc/focus/modal/IME에서 취소한다(Quick Place Q의 timeout과는 별도 기능). Settings → Input & Controls에서 선택·혼합·바인딩 수정·개별/전체 reset·충돌 검사·JSON import/export를 지원한다. 프로필만 독립 localStorage 버전 1.0으로 저장하며 회로 저장과 혼동하지 않는다. 형식/명령 오류는 현재 프로필을 유지하며 안내한다. compatibility/source metadata는 seed 자료의 정보이며 1:1 호환 검증 완료를 뜻하지 않는다.

---

# Part III. 편집 상태와 입력 모델

## 7. 상태 모델

상태를 하나의 거대한 enum으로 만들지 않고 네 층으로 분리한다.

### 7.1 Tool — 지속 도구

| 값 | 의미 |
|---|---|
| `SELECT` | 선택·배치·이동 등 일반 편집의 기본 도구 |
| `WIRE` | 배선 대기 도구 |

### 7.2 Operation — 확정 전 편집 작업

동시에 하나만 활성화한다.

| 값 | 의미 |
|---|---|
| `NONE` | 진행 편집 없음 |
| `BOX_SELECT` | 영역 선택 드래그 |
| `PLACE` | 부품 배치 미리보기 |
| `MOVE` | 연결 유지 이동 미리보기 |
| `WIRE_DRAFT` | 배선 초안 |
| `SEGMENT_MOVE` | 배선 선분 이동 |
| `PASTE` | 붙여넣기/복제 미리보기 |

### 7.3 Transient — 잠시 끼어드는 동작

| 값 | 의미 |
|---|---|
| `NONE` | 없음 |
| `PAN` | Space/middle drag 화면 이동 |

PAN 종료 시 원래 Tool과 Operation을 그대로 복원한다.

### 7.4 Focus — 입력 소유 계층

| 값 | 의미 |
|---|---|
| `CANVAS` | 도면이 키 입력 소유 |
| `TEXT_EDITOR` | 검색/속성/텍스트 입력이 키 입력 소유 |
| `MODAL` | 모달·메뉴·입력을 소유한 팝오버가 입력 소유 |
| `IME_COMPOSING` | 한글 등 IME 조합 중 |

단순 설명 tooltip은 입력 소유자가 아니다.

### 7.5 상태 전이 기본표

| 현재 상태/조건 | 이벤트 | 결과 | Commit | Undo 기록 |
|---|---|---|---|---|
| SELECT + NONE | `A` | 검색 UI → 결과 선택 후 PLACE | 없음 | 없음 |
| SELECT + NONE | `W` | WIRE tool 활성 | 없음 | 없음 |
| WIRE + 대상 위 | 클릭 또는 `W` | WIRE_DRAFT 시작 | 없음 | 없음 |
| PLACE/PASTE | 클릭 또는 유효 `Enter` | 초안 확정 → SELECT/NONE | 1회 | 1개 |
| MOVE | 클릭/Enter 또는 drag release | 위치·경로 함께 확정 | 1회 | 1개 |
| WIRE_DRAFT | 대상 클릭/유효 Enter | 연결 확정 → WIRE/NONE | 1회 | 1개 |
| WIRE_DRAFT | 빈 공간 클릭 | waypoint 추가 | 아직 없음 | 없음 |
| WIRE_DRAFT | `Backspace` | 마지막 waypoint 제거 | 없음 | 없음 |
| 초안 | `Esc` | 초안만 폐기 | 없음 | 없음 |
| WIRE/NONE | `Esc` | SELECT/NONE | 없음 | 없음 |
| SELECT/NONE + 선택 있음 | `Esc` | 선택 해제 | 없음 | 없음 |
| 안정된 초안 | Space+drag | PAN → 종료 후 같은 초안 복귀 | 없음 | 없음 |
| 포인터 drag 중 | 창 비활성/캡처 상실 | 해당 gesture rollback | 없음 | 없음 |
| 안정된 초안 | `Tab` | UI focus 이동, 초안 유지 | 없음 | 없음 |
| pointer drag 중 | `Tab` | drag rollback 후 UI focus 이동 | 없음 | 없음 |

### 7.6 새 도구 요청

- 진행 초안 중 다른 도구를 누르면 기본적으로 초안을 폐기한 뒤 전환한다.
- 서로 호환되지 않는 명령은 실행하지 않고 이유를 안내한다.
- 팔레트로 실행한 명령도 단축키와 동일한 대상·안전 규칙을 따른다.

---

## 8. 선택과 대상 우선순위

### 8.1 선택

- 부품과 배선 경로 모두 클릭·Shift+클릭·영역 선택·전체 선택의 대상이다. 배선 선택은 연결 변경이나 경로 이동을 자동 실행하지 않는다.
- 클릭은 기존 선택을 교체한다.
- `Shift+클릭`은 선택 추가/제거 토글.
- 이미 선택된 부품을 드래그하면 다중 선택 전체를 이동.
- 비선택 부품을 드래그하면 먼저 해당 부품만 선택.
- 좌→우 box select: 완전히 포함된 대상만.
- 우→좌 box select: 걸친 대상도 포함.
- `Shift+영역 선택`: 현재 선택에 추가.
- `Ctrl+A`: 도면 전체 편집 대상 선택. 입력 필드에서는 텍스트 전체 선택.
- 빈 공간 drag: box select.
- 기본 pan은 Space+LMB / MMB drag다. RMB drag Pan은 호환 프리셋/사용자 바인딩에서 선택한다.

### 8.2 대상 우선순위

1. `R`: 활성 배치/붙여넣기 초안 → 명시적 선택 → cursor 아래 단일 대상.
2. `M`/`E`: 명시적 선택 우선. 선택이 없으면 cursor 아래 대상.
3. `W`: 선택과 무관하게 cursor 아래 연결 가능한 핀/접속점/선분 우선.
4. Delete/Cut/Duplicate/Group: 명시적 선택에만 적용.
5. 후보가 겹치면 이름·강조·선택 popup으로 구분.
6. 모호한 상태에서 회로를 즉시 변경하지 않는다.
7. 선택 그룹이 있으면 cursor가 다른 객체 위에 있어도 selection group이 명령 대상이다. 단 우클릭의 별도 정책은 §19 참조.

---

# Part IV. 배치·검색·빠른 배치

## 9. 부품 배치

### 9.1 기본 경로

`A` → 부품 검색 → 결과 선택 → PLACE preview → 클릭/Enter로 확정.

- 검색 결과 선택은 부품 생성 완료가 아니라 preview 시작이다.
- `Esc`는 preview 폐기.
- 연속 배치는 `Shift`를 누른 채 배치 확정하는 안을 현재 기본으로 둔다.
- 연속 배치의 각 확정은 별도 Undo 단위.

### 9.2 부품 패널 드래그 배치

사용자 요청 반영(2026-10-13): 부품 패널에서 도면으로 드래그하면 PLACE 미리보기를 제공하고, 도면에서 놓을 때 하나의 배치 Command로 확정한다. 도면 밖에서 놓거나 Esc·포인터 취소·캡처 상실로 중단하면 확정하지 않는다. 기존 클릭/검색 배치 경로도 유지한다.

### 9.3 기본 게이트 심벌 — 2026-10-16 사용자 요청

AND는 D자, OR는 곡선형, NOT은 삼각형과 출력 반전 원으로 표시한다. AND/OR는 2입력·1출력, NOT은 1입력·1출력이다. 기존 ±40 핀 좌표와 회전·연결 보존 규칙을 유지한다. 라이브러리와 도면은 같은 SVG 심벌을 사용한다. 부품 추가는 편집 모델 범위이며 시뮬레이터 구현을 뜻하지 않는다.

## 10. 검색 정렬

### 10.1 검색어가 없을 때

- Recent
- Favorites
- 기본 카테고리

를 우선 보여줄 수 있다.

### 10.2 검색어가 있을 때

다음 순서로 묶는다.

1. exact canonical name
2. exact alias
3. prefix match
4. keyword/fuzzy match
5. 같은 일치 등급 안에서 recent-use score를 보조 정렬

최근 사용 부품을 검색어와 무관하게 무조건 첫 결과로 올리지 않는다.

### 10.3 Enter 규칙

- 화면에서 현재 강조된 결과만 preview로 넘긴다.
- 유일한 정확 일치는 기본 강조 가능.
- 정확 일치 후보가 여러 개면 충돌을 표시하고 명시적 선택을 요구하는 안을 우선 검토한다.
- 결과 없음, 갱신 중, 모호한 exact conflict 상태에서는 Enter로 자동 배치하지 않는다.
- 결과 이름·심벌·라이브러리/종류를 표시한다.

## 11. Quick Place

**상태: `EXPERIMENTAL`. 편집 프로토타입의 착수 조건이 아니다.**

기본은 A 검색을 먼저 구현한다. 반복 배치 실험에서 필요성이 확인될 때만 `Q` Quick Place를 검토한다.

### 11.1 Q 메뉴 후보

- 시간 제한 없음.
- `Q`를 누르면 두 번째 키와 대상 이름을 표시.
- 두 번째 키/클릭/Esc로 종료.
- 메뉴가 열린 동안 두 번째 키가 일반 도면 단일키보다 우선.
- 선택 결과는 PLACE preview 시작.

| 두 번째 키 | 대상 |
|---|---|
| `A` / `Shift+A` | AND / NAND |
| `O` / `Shift+O` | OR / NOR |
| `X` / `Shift+X` | XOR / XNOR |
| `B` / `Shift+B` | Buffer / NOT |
| `M` | MUX |
| `F` | D Flip-Flop — 시간 기능 단계 |
| `C` | Clock — 시간 기능 단계 |
| `0` / `1` | Constant 0 / 1 |

Input/Output은 우선 A 검색 또는 명시적 메뉴에서 제공한다. 방향 전환과 논리 반전을 같은 Shift 규칙으로 설명하지 않는다.

### 11.2 P 키

`P`는 Probe 후보를 보존한다. `P=Place, P,P=Probe` 안은 과거 제안으로 부록에 보존하지만 현재 기본안에서는 사용하지 않는다.

---

# Part V. 이동·회전·배선 geometry

## 12. Safe Move

### 12.1 원칙

`M`과 기본 drag는 논리 연결을 유지하는 이동이다.

- 부품·핀의 논리 연결 그래프를 바꾸지 않는다.
- 도면 경로는 움직이는 geometry에 맞춰 수정한다.
- 자동으로 연결을 삭제하거나 새 전기적 연결을 만들지 않는다.
- 이동·회전과 경로 변경은 하나의 transaction/Undo 단위.

### 12.2 v1 경로 재구성

1. 선택 집합 내부의 부품과 함께 움직이며 외부 branch에 공유되지 않는 wire 구간은 동일한 rigid translation을 적용한다.
2. 움직이는 pin에서 첫 번째 고정 waypoint/junction/반대편 pin까지의 구간만 재구성한다.
3. 공유 branch junction은 기본적으로 고정한다. 명시적으로 이동 대상에 포함된 경우만 함께 이동.
4. 경로는 orthogonal segment만 사용.
5. 기존 첫 출발 방향과 waypoint를 가능한 한 보존.
6. 후보가 동점이면 결정적(deterministic) 순서를 사용.
7. 길이 0 segment, 중복 waypoint와 공선 되접힘을 공통 정규화 함수로 제거. 실제 junction은 분할된 wire의 endpoint로 보존하고 논리 연결은 변경하지 않는다.
8. 전체 net을 재배치하지 않는다. 배선 설정의 자동 우회에서는 부품 몸체와 충돌하는 경로만 직각 탐색으로 복구한다. 명시적 경유점과 공유 junction은 고정한다. 경고 모드에서는 겹침을 표시하고 허용한다.
9. 우회 실패 시 이유와 충돌 위치를 표시하고 확정을 막는다. 겹침은 자동 접속·삭제하지 않는다.

### 12.3 회전

- `R` / `Shift+R`로 90° 반대 방향 회전.
- 회전 후 pin 방향도 함께 변환.
- 첫 wire segment는 새 pin 법선 방향에서 시작하도록 조정하는 안을 `PROVISIONAL`로 둔다.
- 다중 회전은 표시된 selection bounds의 중심을 기준으로 한다.
- 선택 부품을 드래그하거나 M 이동 중에도 R/Shift+R로 회전한다. 원본에서 누적 회전·이동을 계산하며 release/확정 시 한 Undo, Esc/Tab/포커스 상실/도면 밖 release 시 전체 초안을 취소한다.

### 12.4 테스트 불변식

- 이동/회전 전후 논리 그래프 동일.
- 모든 wire segment 수평/수직.
- 길이 0 segment 없음.
- 동일 상태·동일 이동이면 동일 geometry 생성.
- Undo 후 원래 좌표와 연결 복구.
- 일회성 회전이 실패하면 원본과 history/Redo를 유지하고 임시 MOVE를 폐기한다. 실제 MOVE/선분 drag가 release에서 실패해도 원본으로 복구하고 초안을 종료한다. 오류 이유를 표시하며 마우스 버튼 없이 초안이 따라다니지 않는다. M 이동·배선 다시 그리기 등 명시적으로 시작한 안정 초안은 수정/취소 가능 상태를 유지한다.

### 12.5 배선 경로 편집 — 2026-10-15

- 선택한 배선의 선분을 직접 끌면 수평선은 위/아래, 수직선은 좌/우로 이동한다. 연결된 양 끝 핀·공유 junction은 고정하고 필요 시 직각 연결 구간을 추가한다.
- 모서리의 사각 핸들은 꼭짓점 이동, 선분 중앙의 원형 핸들은 선분 이동, 마름모 핸들은 국소 우회 구간 추가다. 핸들은 화면 기준 크기를 유지한다.
- 4 screen px 이상 drag부터 초안을 갱신하고 release로 한 번 확정한다. Esc/Ctrl+Z/Tab/창 비활성/캡처 상실/도면 밖 release는 drag 초안만 취소한다.
- 경로 다시 그리기는 기존 두 endpoint를 고정한다. 빈 공간 클릭으로 경유점, Backspace로 마지막 경유점 취소, Shift+Space로 꺾임 방향, Enter/완료 버튼으로 경로 전체를 한 번 확정한다. 다른 핀과 교차해도 새 접속을 만들지 않는다.
- 가로/세로 우선 정리는 선택 배선의 경유점을 의도적으로 제거하고 두 endpoint 사이의 최소 직각 경로로 대체한다. 여러 배선도 한 Undo다.
- 모든 경로 수정은 wire ID, from/to, net, 부품·핀·junction을 보존한다. 중복점과 불필요 공선점을 정리하며 결과는 유한 좌표·직각·고정 endpoint 검증 후 commit한다.
- 분기 생성은 §13.5의 명시적 접속 transaction으로 분리한다. endpoint 재연결·전기적 삭제는 후속 기능이다.

---

## 13. 배선

### 13.1 배선 시작

- `W`로 WIRE 도구 활성.
- 핀/접속점/기존 선분 위에서 시작 가능.
- 빈 공간에서 W를 누르면 WIRE 대기만 시작.
- 사용자 요청 반영(2026-10-13): SELECT 도구에서도 부품 접점을 클릭하거나 클릭 드래그하면 WIRE_DRAFT를 시작한다. 접점은 부품 본체 이동보다 우선한다. 클릭 시작 후 다른 접점 클릭으로 연결하거나, 다른 접점까지 드래그해 놓으면 연결을 확정한다. 빈 공간에서 드래그를 놓으면 미확정 배선 초안을 유지한다. 도면 밖 release와 gesture 취소는 드래그 초안을 폐기한다.
- 기존 선분에서 branch를 시작할 경우 접속점은 wire commit 전까지 초안.

### 13.2 배선 진행

1. 직각 경로 preview.
2. 빈 공간 클릭 → waypoint 고정.
3. `Shift+Space` → 마지막 구간의 horizontal-first / vertical-first 전환.
4. `Backspace` → 마지막 waypoint 제거. 시작점만 남으면 draft 취소 가능.
5. 강조된 유효 pin/segment를 클릭하거나 유효 target에서 Enter → commit.
6. 단순 교차는 접속이 아니다.
7. 명시적으로 연결된 junction만 점 표시.
8. pin/junction snap candidate는 확정 전에 강조.

### 13.3 미연결 끝점

**현재 권장: v1에서는 빈 공간 더블클릭으로 wire를 끝내지 않는다.**

필요성이 확인되면 팔레트/초안 context menu에 `Finish Unconnected` 명령을 추가한다. 이 명령은 draft를 한 번만 commit하고 dangling endpoint를 시각적으로 표시한다.

### 13.4 Snap 초기 가설

- pin/junction radius: 13 screen px (2026-10-16 클릭 여유 확대)
- wire hit distance: 12 screen px (2026-10-16 클릭 여유 확대)
- drag start: 4 screen px
- grid: 10 drawing units

모두 검증 전 가설이다.

직각 선분 투영은 가변 축의 좌표를 선분 범위로 clamp하고 고정 축은 원래 값을 그대로 사용한다. grid 좌표를 비율로 재계산해 미세 소수를 만들지 않는다. 화면 hit 허용 거리와 저장 좌표의 일치를 구분하며, 좌표가 가까운 별개 endpoint를 전기적으로 합치지 않는다.

판정 거리는 zoom과 무관한 screen px로 관리하고 drawing coordinate와 분리한다.

우선순위:

`pin/junction snap > wire snap > grid`

`Alt`는 grid snap만 잠시 해제하는 후보. 좌표가 우연히 겹쳤다고 전기적 연결을 새로 만들지 않는다.

### 13.5 분기·배선 합치기와 피드백 — 2026-10-15

2026-10-16 QA 수정: SELECT에서 배선의 투명 hit stroke들이 겹치면 DOM 그리기 순서 대신 실제 선분까지의 화면 거리를 비교한다. 기존 선택 허용 폭(중심선에서 6px)을 유지하고, 최근접에서 0.5px 이내인 후보가 여러 개면 선택 창에서 명시적으로 고른다. 선택은 교차점 자석 판정과 분리하며 전기적 연결을 변경하지 않는다. 핀·접속점 배선 시작 및 연결 후보 선택은 기존 규칙을 유지한다.

2026-10-16 후속 사용자 승인: 초안 없는 SELECT에서 실제 몸체(심벌·반전 원·이름)를 직접 누르면 넓은 핀 포획보다 부품 선택을 우선한다. 핀 원 직접 클릭과 몸체 밖의 기존 포획 반경은 유지한다. pin lead는 몸체 보호 영역으로 보지 않는다. WIRE 도구·배선 초안 연결 의도에는 기존 후보 판정을 유지한다. 이 정책은 DOM surface를 전달받는 입력 판정 계층에서 적용하며 저수준 거리 계산의 반경을 축소하지 않는다.

- WIRE 대기에서 핀·기존 junction·선분을 클릭하거나, SELECT에서 선분 위 W / 선택 배선의 분기 버튼으로 시작한다. SELECT의 단순 선 클릭·드래그는 선택·경로 편집을 유지한다.
- 초안 시작·종료 대상은 pin/junction 또는 명시적으로 선택한 wire 위의 투영 좌표다. 선분 내부는 10 단위 grid에 투영하되 가까운 endpoint를 재사용한다. pin/junction 13 screen px → wire 12 screen px 우선이며 최근접 후보를 강조한다. 12px 안의 직각 교차점은 같은 좌표로 자석 스냅하여 후보를 선택하기 쉽게 하되, 실제 접속은 명시적 확정으로만 생성한다.
- 시작선 분할·끝선 분할·junction 생성·net 병합·새 경로는 전체 검증 후 하나의 Command로 commit한다. 취소·실패 중에는 기존 회로와 Redo를 보존한다. 같은 선의 서로 다른 두 지점 연결과 기존 junction 재사용을 지원한다.
- 분기점에 wire를 분할하며 기존 wire ID는 첫 구간에 유지한다. 공유 junction은 이동·회전·경로 정리로 삭제하거나 옮기지 않는다.
- 단순 교차는 미접속이다. 동거리 대상이 여러 개면 후보 선택 창으로 구분한다. 정확히 같은 내부 교차점의 후보에는 별도 접속 버튼을 제공하며, 명시적으로 누른 경우에만 한 junction으로 합친다.
- 유효 접속 후보·분기 예정점·연결된 pin·실제 junction·현재 배선 모드를 색과 형태/문자로 함께 구분한다. 선에서 시작한 초안의 junction은 commit 전에 미리보기만 표시한다.
- 연결망 선택은 동일 net의 wire를 모두 선택한다. 부품 이동과 경로 편집은 연결망을 자동 병합하지 않는다.
- wire/net/endpoint 참조·net 구성원·실제 연결성·유한 좌표·직각·endpoint 일치를 검증한다. 파일 저장·시뮬레이션은 별도 범위다.

### 13.6 배선 설정 — 2026-10-15 사용자 요청

- 설정에서 경로 생성: 스마트 자동(기본)/가로 우선/세로 우선, 부품 겹침: 자동 우회(기본)/경고하며 허용을 독립 선택한다. 브라우저에 별도 버전 키로 저장하며 입력 프로필 JSON과 분리한다. 설정 변경만으로 확정 회로를 바꾸지 않는다.
- 스마트는 핀 방향·거리·꺾임 비용을 반영한 결정적 직각 경로를 생성한다. 자동 우회는 회전된 부품 몸체에 10 도면 단위 여유를 둔다. 고정 방향도 장애물 때문에 필요한 경우 우회한다. 다른 배선은 장애물이 아니며 교차는 미접속이다.
- 수동 클릭 경유점은 자동 탐색·부품 이동 중 보존한다. 경유점이 부품 안에 들어가거나 경로를 찾지 못하면 실패를 표시한다. 명시적 경로 다시 그리기/가로·세로·설정대로 정리는 기존 경유점을 재설정한다.
- Shift+Space는 현재 초안 구간의 우선 축만 임시 전환하며 저장 설정을 바꾸지 않는다. 상태 표시에서 현재 모드와 겹침/실패를 확인한다. 충돌은 몸체 위 점선으로 겹쳐 표시해 가려진 선을 찾을 수 있게 한다.
- 구현 탐색은 좌표 압축 직각 그래프와 방향 상태를 사용한다. 탐색 크기를 제한하고 한도 초과 시 조용히 겹침을 허용하지 않는다.

### 13.7 중복 우회 경로 정리 — 2026-10-15 사용자 사례

- 직선과 ㄷ자 우회가 같은 두 접속점 사이에 중복으로 남는 사례를 기존 배선 조작 개선으로 다룬다. 일반 Delete 구현으로 확대하지 않는다.
- 배선을 선택한 뒤 **연결망 중복 정리**를 실행한다. 선택 배선이 속한 연결망만 검사하며, 같은 net과 동일한 두 endpoint ID를 가진 병렬 wire를 중복 후보로 본다. 좌표만 같은 별개 endpoint나 다른 net의 교차는 합치지 않는다.
- 부품 몸체를 통과하지 않는 경로를 우선하고, 그중 길이가 짧고 꺾임이 적은 경로 하나를 남긴다. 동점은 기존 순서로 결정한다. 중간에 실제 분기가 있어 나뉜 경로와 여러 wire를 잇는 일반 cycle은 정리 대상에서 제외한다.
- 제거 예정 wire는 빨간 점선, 남길 wire는 초록 강조로 표시한다. 범위·개수·수동 경유점 제거 여부를 안내하며 Enter/완료 버튼으로 한 번 확정, Esc/초안 Undo로 취소한다. 미리보기만으로 circuit/history/Redo는 바뀌지 않는다.
- 부품·핀·net 구성원·junction ID/좌표와 남는 wire ID/경로는 보존한다. 제거 wire ID 때문에 물리 wire 목록 fingerprint는 바뀌지만, 모든 기존 pin/junction의 연결성은 유지되어야 한다. 전체 검증 후 하나의 Undo로 정확히 복구한다.
- 같은 net이라는 이유만으로 임의 배선·cycle을 지우거나, 분기된 우회를 자동 삭제하거나, 이동 중 사용자 경유점을 조용히 제거하지 않는다.

---

# Part VI. 삭제·클립보드·Undo/Redo

## 14. 삭제

### 14.1 부품 삭제

- 삭제된 pin에 연결된 외부 wire는 남긴다.
- 삭제된 pin 쪽 끝점을 dangling endpoint로 전환.
- 영향을 미리 표시.
- Undo는 부품·wire·연결 상태를 함께 복구.

### 14.2 wire 삭제

- 선택한 경로만 제거.
- 다른 branch 유지.
- 불필요 junction 정리는 같은 transaction에 포함.

### 14.3 삭제와 꺾임점 조작 — 2026-10-16 사용자 요청

- `edit.delete`를 활성화한다. 선택 부품/배선은 Delete·선택 삭제 버튼·메뉴로 삭제하며 다중 삭제는 하나의 Command다. text/modal/IME 입력 소유권은 유지하고 진행 초안/드래그 중 확정 회로 삭제를 막는다. hover만으로 삭제하지 않는다.
- 삭제된 pin에 남는 wire가 있으면 해당 위치에 하나의 junction endpoint를 만들고 공유된 wire 끝들을 그 endpoint로 치환한다. 단일 말단은 빈 원으로 표시한다. 선택한 wire는 그 경로만 제거하며 실제 endpoint 그래프로 net을 다시 분할한다. 미사용 junction/net은 정리하고, 남는 경로/부품의 좌표와 wire ID는 유지한다. 전체 검증 후 commit하며 Undo/Redo는 정확한 snapshot을 복원한다.
- WIRE_DRAFT/WIRE_ROUTE의 클릭 고정 경유점은 번호 있는 사각 마커로 표시한다. 실제 전기 junction(원)과 구분하고 Backspace/Esc로 함께 제거한다.
- SELECT에서 완성된 wire의 사각 꺾임 핸들을 클릭하면 해당 점을 선택한다. Delete는 wire 전체가 아니라 그 꺾임점만 제거한다. 인접한 고정 좌표 사이를 반대 직각 경로로 재연결하며 endpoint/net/junction을 바꾸지 않는다. 다른 고정 anchor를 잃거나 자동 우회 정책에서 부품과 충돌하면 안내하고 기존 회로/history를 보존한다. 직각을 유지하려면 대체 꺾임점이 생길 수 있다. 실제 junction·양 끝 endpoint는 이 작업으로 삭제하지 않는다.
- 2026-10-16 후속 사용자 승인: 꺾임점 삭제에서 양 끝점·전기적 연결·나머지 고정 경유점은 보존한다. 직각 유지에 필요한 국소 경로 정규화로 이웃한 비고정 꺾임점이 없어지거나 대체 꺾임점이 생길 수 있으며, 핀 출입 방향의 변경도 허용한다. 전체 회로를 임의 재배선하지 않는다. 위 보존 조건·현재 충돌 정책을 만족하지 못하면 명확한 이유와 경로 다시 그리기 안내를 제공하고 삭제를 거부한다. 한 번의 Undo로 원래 경로 전체를 복원한다.

## 15. Clipboard

- Copy: 선택 부품 + 내부 wire 포함.
- 명시적으로 선택한 외부 wire도 포함 가능.
- 복사되지 않은 외부 회로에 붙었던 끝점은 pasted copy에서 dangling으로 변환.
- Paste: 새 ID 부여 → cursor preview → 클릭/Enter commit.
- Cut: clipboard 기록 성공 후에만 삭제.
- Duplicate: `Shift+D` preview.
- 반복 duplicate의 같은 변위 재사용은 `EXPERIMENTAL`.

## 16. Undo/Redo

### 16.1 Undo 기록 단위

각각 하나의 history item:

- Move
- Rotate
- Wire commit
- Segment move
- Delete
- Paste
- Duplicate commit
- Property change
- 성공한 다중 property 일괄 변경

다음은 circuit-structure history와 분리:

- selection
- zoom
- pan
- input toggle
- simulation running state
- 확정 전 preview

Arrow key autorepeat 이동은 keydown~keyup 사이를 하나의 이동으로 묶는 안을 유지한다.

### 16.2 Preview 중 Ctrl+Z — 현재 권장안

이 항목은 Codex와 Claude 의견이 갈렸으며, 현재 Master Spec은 **데이터 손실 위험을 낮추는 2단계 안을 `PROVISIONAL` 기본으로 둔다.**

| 상태 | `Ctrl+Z` |
|---|---|
| preview 없음 | 마지막 확정 작업 Undo |
| PLACE/MOVE/PASTE preview | preview만 폐기. history 변화 없음 |
| WIRE_DRAFT | wire draft 전체 폐기. 마지막 waypoint만 제거하려면 Backspace |
| pointer drag 진행 중 | 기본안은 처리하지 않거나 gesture rollback 후 안내. 실제 브라우저 동작 검증 필요 |
| TEXT_EDITOR | 텍스트 Undo에 맡김. circuit history 건드리지 않음 |

preview가 취소된 뒤 다시 `Ctrl+Z`를 누르면 마지막 확정 작업을 Undo한다.

### 16.3 Redo

- `Ctrl+Shift+Z` / `Ctrl+Y`.
- preview가 존재하면 기본안은 실행하지 않고 안내한다.
- 새 확정 편집이 생겼을 때만 Redo branch 폐기.
- preview 생성/취소만으로 Redo branch를 지우지 않는다.

### 16.4 반대안 보존

Codex는 “preview는 history가 아니므로 한 번의 Ctrl+Z에서 preview를 discard한 뒤 같은 입력으로 history.undo()까지 수행”하는 안을 제안했다. 이 안은 빠르지만 한 입력이 미확정 작업과 확정 작업을 동시에 제거할 수 있다는 반론이 있어 현재 기본으로 채택하지 않았다. 사용자 테스트 후 변경 가능하다.

---

# Part VII. 단축키 기준

## 17. 첫 편집 버전 기본 키

| 키 | 기능 | 상태/주의 |
|---|---|---|
| `A` | 부품 검색·추가 | `CURRENT` |
| `W` | Wire 도구 / 연결 대상 위에서는 wire 시작 | `CURRENT` |
| `V` | Select 도구 복귀 | 초안 취소 후 selection 유지 방향 |
| `M` | Safe Move | 논리 연결 유지 |
| `R` / `Shift+R` | 반시계 / 시계 90° 회전 | preview에도 동일 |
| `E` | Properties | selection 또는 PLACE preview |
| `F2` | 이름/문자 직접 편집 | 단일 대상 우선 |
| `Shift+D` | Duplicate preview | `Ctrl+D` 브라우저 충돌 회피 |
| `Delete` | 명시적 selection 삭제 | hover-only 삭제 금지 |
| Arrow / `Shift+Arrow` | grid 1칸 / 10칸 이동 | Safe Move 의미 유지 |
| `Shift+Space` | wire bend orientation 전환 | WIRE_DRAFT에서만 |
| `Backspace` | 마지막 wire waypoint 제거 | WIRE_DRAFT |
| `Enter` | 유효 preview 확정 / 유효 target 연결 | idle에서 재실행 용도로 쓰지 않음 |
| `Esc` | 가장 가까운 작업 한 단계 취소/종료 | simulation stop과 혼용 안 함 |
| `Alt` hold | grid snap 임시 해제 | Windows browser 검증 필요 |
| `Shift+Click` | selection toggle / placement 연속 배치 | 상태에 따라 UI에 의미 표시 |
| `Tab` / `Shift+Tab` | UI focus 이동 | CAD command로 가로채지 않음 |
| `Ctrl+A` | 전체 선택 | text UI에서는 text select all |
| `Ctrl+C/X/V` | Copy/Cut/Paste | paste는 preview |
| `Ctrl+Z` | Undo | preview 규칙은 §16 |
| `Ctrl+Shift+Z` / `Ctrl+Y` | Redo | preview 중 기본 실행 안 함 |
| `Ctrl+S` / `Ctrl+O` | Save/Open | app-owned focus에서만 처리 |
| `Ctrl+F` | 현재 회로 대상 검색 | library 검색 A와 구분 |
| `?` | 현재 상태 키 도움말 | F1과 구분 |
| Space+drag | Pan | transient |
| Middle-drag | Pan | browser autoscroll 검증 |
| Wheel | cursor 중심 zoom | |
| `+` / `-` | 화면 중심 zoom | browser page zoom과 구분 |
| `Home` / `Shift+Home` | 전체 / selection fit | |
| `G` | Grid 표시 토글 | snap enable과 구분 |

초기 학습 핵심 키:

`A / W / M / R / E / V / Esc / Backspace / Ctrl+Z / Space+drag`

## 18. 후속 기능 키

| 키 | 기능 | 상태 |
|---|---|---|
| `N` | Net Label | `DEFERRED` |
| `L` | Net Label alias | 필요성 확인 후 |
| `T` | 설명 Text | `DEFERRED` |
| `H` / `Shift+H` | Net highlight / clear | `DEFERRED` |
| `P` | Probe | `DEFERRED`, Quick Place와 분리 |
| `Q` | Quick Place menu | `EXPERIMENTAL` |
| `X` / `Y` | mirror horizontal / vertical | `DEFERRED` |
| `B` | Bus | `DEFERRED` |
| `/` | Command palette | `EXPERIMENTAL` |
| `Ctrl+Enter` | simulation Run/Pause | 시간 기능 단계 |
| `Shift+Enter` | event Step 후보 | semantics 확정 후 |
| `Ctrl+Shift+Enter` | simulation Reset | 시간 기능 단계 |
| `Ctrl+G` / `Shift+G` | group/ungroup 후보 | 데이터 모델 확정 전 비활성 |
| `Ctrl+↓` / `Ctrl+↑` | subcircuit enter/up 후보 | 데이터 모델 확정 전 비활성 |
| `Ctrl+D` | Duplicate alias 후보 | browser bookmark 충돌 실측 후 |
| `Z` | selection fit alias 후보 | selection 없음 동작 결정 후 |

### 18.1 명령 팔레트

`/`는 후속 후보.

- A = 부품 검색
- / = 명령 검색
- 명령 이름, 현재 shortcut, 실행 불가 이유 표시
- 입력 필드에서는 `/`를 문자로 입력
- 모든 명령에 shortcut을 부여하지 않아도 됨

### 18.2 직전 도구 재실행

`Enter`에는 재실행을 겸용하지 않는다. 필요성이 확인되면 palette 명령 또는 별도 shortcut으로 검토.

---

# Part VIII. 포커스·IME·브라우저 입력

## 19. 입력 소유권

한 physical event는 한 계층만 소비한다.

권장 우선순위:

1. `IME_COMPOSING`
2. 입력을 소유하는 Modal/Menu/Popover
3. Text editor / property editor
4. Transient gesture
5. Active Operation
6. Tool
7. Selection

### 19.1 IME

- `isComposing` 중에는 canvas 명령 실행 금지.
- 조합 중 Enter/Esc도 IME에 맡긴다.
- `event.code`만 사용한다고 IME 안전성이 확보되는 것은 아니다.

### 19.2 Text editor

- `Ctrl+A/C/X/V/Z`, Arrow 등은 text UI에 맡긴다.
- Text edit의 Esc는 그 편집만 닫거나 미확정 값을 취소.
- 같은 Esc를 canvas까지 전달하지 않는다.
- UI에서 canvas로 focus가 돌아오면 기존 안정된 preview는 유지하고 다음 pointer update에서 위치 갱신.
- 일반 도구·Undo/Redo·편집 버튼은 모달로 분류하지 않는다. 앱의 일반 명령 버튼 실행 후 도면에 키보드 포커스를 돌린다. 검색·설정·후보/메뉴 overlay와 텍스트 입력은 자체 입력 소유권을 유지한다.

### 19.3 Tab

- Tab/Shift+Tab은 기본 UI keyboard navigation.
- draft는 안정된 상태라면 잠시 유지.
- pointer drag 중 Tab은 drag rollback 후 focus 이동하는 안을 우선 검토.

### 19.4 줌 조작 — 2026-10-15 감사 수정

- 휠·키보드·Home/선택 맞춤은 같은 10–200% 범위를 사용한다. 화면 맞춤이 50% 아래일 때도 줌 아웃이 역으로 확대되지 않는다.
- 휠의 세로 delta 크기에 비례한 지수 배율을 사용한다. deltaY=0/비유한 값은 줌하지 않는다. line은 16px, page는 도면 높이로 정규화하고 이벤트당 최대 240px으로 제한한다. 기준 100px은 약 10% 변화이며 감도는 초기 조작 파라미터다. 실제 트랙패드 사용성 측정 완료를 뜻하지 않는다.
- 확대 중심의 도면 좌표를 유지하고 휠 반전 설정을 적용한다. 텍스트/모달 입력 소유 중에는 도면 줌을 실행하지 않는다. 반복 배율 계산의 잔여 오차가 경계 선택을 흔들지 않도록 뷰 좌표/배율은 소수 12자리로 안정화한다. 회로 좌표를 반올림하는 정책과는 구분한다.

## 20. Browser default suppression matrix

| 입력 | 앱이 처리하는 조건 | 앱 처리 시 | 그 밖의 처리 |
|---|---|---|---|
| `Shift+Space` | CANVAS + WIRE_DRAFT | bend 변경 + `preventDefault` | text UI에서는 기본 처리. idle canvas 정책은 별도 실측 |
| Space+drag | CANVAS + pan 가능 | PAN 시작, 페이지 scroll 방지 | input/textarea에서는 Space 유지 |
| Middle button | canvas pan 시작 | browser autoscroll 억제 검토 | canvas 밖 기본 동작 |
| Tab/Shift+Tab | UI navigation | 기본 탐색 유지 | CAD 명령으로 소비하지 않음 |
| Delete | CANVAS + 명시적 selection + 안전 상태 | selection 삭제 | text UI 문자 삭제. 위험 preview 중에는 삭제 금지/안내 |
| Ctrl+Z | CANVAS history 처리 가능 | §16 정책 | text UI에서는 text undo |
| Ctrl+S/O/F | app-owned focus에서 수신 가능 | 앱 명령 + 필요 시 default 억제 | 이벤트 수신 불가 환경은 버튼 fallback |
| Right-click/contextmenu | 앱의 비텍스트 UI, 도면·메뉴·오버레이 | 앱 루트 capture에서 default와 전파 억제. 짧은 RMB 메뉴와 호환 프리셋 drag Pan을 유지하며 메뉴가 열린 뒤 도착하는 contextmenu도 차단 | input/textarea/contenteditable의 텍스트 편집 메뉴와 앱 밖 browser menu 유지 |
| Alt hold | canvas + snap 후보 기능 | grid snap 임시 해제 | Windows browser menu focus 실측 필요 |

실제 구현 문서에는 `handled`, `preventDefault`, `stopPropagation`, `user feedback`, `browser support`를 별도 열로 기록한다.

### 20.1 자동 반복

기본적으로 keydown autorepeat 무시:

- Rotate
- Delete
- Place command start
- simulation run toggle

의도적으로 허용:

- Arrow 이동

keyup / focus loss에서 이동 transaction을 마감한다.

### 20.2 재배정

- shortcuts reset 가능.
- 같은 상태에서 충돌하는 key binding은 저장 전에 표시.
- single-letter command 전체 비활성 설정 후보.
- 모든 핵심 기능은 버튼/메뉴 대체 경로 제공.
- macOS는 별도 profile 검증. Windows key를 기계적으로 치환해 지원 완료라 주장하지 않는다.

---

# Part IX. 마우스·컨텍스트 메뉴·Properties

## 21. 우클릭

기본은 **짧은 우클릭 Context menu**다. Pan은 MMB/Space+LMB drag이며 호환 프로필에서는 RMB drag에도 배정할 수 있다. 기존 코드가 다른 경우 Master Spec 기본값에 맞게 정정한다.

- 선택 대상 위: 기존 selection group용 메뉴.
- 비선택 대상 위: 그 대상을 선택한 뒤 object menu를 여는 안을 현재 권장.
- 빈 공간: canvas menu. 기존 selection 유지 가능.
- active preview 중: preview용 context menu. 기존 회로 selection을 자동 변경하지 않음.
- click/drag가 공유된 버튼은 pointer-down에 메뉴를 열지 않는다. threshold 미만 release는 click, 이상 움직이면 drag를 실행한다. 실제 drag 후 메뉴를 추가로 열지 않는다.

## 22. 다중 선택 Properties

### 22.1 공통 속성 정의

이름이 같다는 이유만으로 공통 속성으로 보지 않는다. 다음이 호환되는 속성만 교집합에 포함한다.

- property ID
- value type
- unit
- constraints
- semantic meaning

### 22.2 표시와 변경

- 모든 대상에서 같은 값: 실제 값 표시.
- 값이 다름: `Multiple Values`/혼합값 표시.
- 혼합값 placeholder를 실제 property 값으로 저장하지 않는다.
- 공통 속성이 없으면 선택 개수와 유형 요약 표시.
- name/reference ID의 다중 편집은 초기에는 막는 방향.
- commit 전에 모든 대상 유효성 검사.
- 하나라도 invalid면 전체 변경 취소.
- 성공한 일괄 변경은 하나의 Undo.

---

# Part X. 시뮬레이션

## 23. 첫 버전

첫 사용 가능 버전은 조합회로 중심이다.

- 입력 변화마다 재계산.
- 시간 Run/Step key 불필요.
- input switch는 selection과 구분되는 명시적 toggle hit area 제공.
- Space를 input toggle에 중복 배정하지 않음.
- 0/1/X/Z를 값과 line style로 표시.
- diagnosis에서 원인 object 선택/fit-to-view로 연결.

## 24. 4상태 Net Resolution — 후보 규칙

**상태: `PROVISIONAL`. Simulator 구현 전에 확정.**

첫 모델은 drive strength·pull-up/down 없는 4상태 논리로 제한한다.

| 결합 | 0 | 1 | X | Z |
|---|---:|---:|---:|---:|
| **0** | 0 | X | X | 0 |
| **1** | X | 1 | X | 1 |
| **X** | X | X | X | X |
| **Z** | 0 | 1 | X | Z |

규칙 후보:

- Z는 active drive를 하지 않음.
- driver가 없거나 모두 Z면 net = Z.
- 일반 gate input에서 Z를 읽으면 X로 해석하는 안을 우선 검토.
- 0과 1 active drive 충돌 → X + conflict diagnostic.
- 같은 값의 다중 active driver는 값 유지 가능하되 `MULTIPLE_DRIVERS` 진단.
- X propagation과 physical driver conflict 진단은 구분.

진단 코드 후보:

- `FLOATING_INPUT`
- `MULTIPLE_DRIVERS`
- `DRIVE_CONFLICT`
- `UNSUPPORTED_COMPONENT`
- `UNSTABLE_COMBINATIONAL_FEEDBACK`

각 gate의 X/Z truth table과 combinational feedback 안정성 규칙은 별도 simulator spec에서 확정한다.

## 25. 시간 시뮬레이션

**상태: `DEFERRED`.**

- 구조 edit 확정 전 running simulation 정지.
- 새 구조에서 state/time/waveform 초기화.
- 유효한 input ID의 current input value 유지 여부는 현재 제안대로 검토.
- Run = 현재 시점에서 재개.
- Reset = t=0, internal state/waveform reset.
- 구조 Undo/Redo 시 simulation 정지·초기화.

### 25.1 Step

다음 개념은 서로 다르다.

- next event time 처리
- clock edge 하나
- clock period 하나

현재 권장 방향은 **동일 timestamp의 이벤트 묶음을 처리하고 필요한 combinational stabilization까지 끝낸 결과를 한 Step으로 보여주는 것**이다. 단순 queue item 1개 처리 방식은 등록 순서에 따른 중간 상태를 사용자가 최종 결과로 오해할 수 있다.

이벤트 Step과 clock edge/period command는 분리한다.

---

# Part XI. 그룹·계층·확장 기능

## 26. Group과 Subcircuit

### 26.1 Group

- selection/move 편의용 비전기적 묶음.
- 기존 component ID, pin, logical net을 바꾸지 않는다.
- group 생성 자체가 simulation 결과를 바꾸면 안 된다.

### 26.2 Subcircuit

- external ports
- internal circuit
- hierarchy instance
- storage boundary/ID
- simulation boundary semantics

를 갖는 전기적 단위.

키보다 먼저 다음을 정의해야 한다.

- port 생성/이름/ID
- cyclic hierarchy 허용 여부
- instance vs definition 관계
- internal edit propagation
- Undo/Redo
- parent/child navigation

계층 진입은 선택한 subcircuit 필요. 상위 복귀는 현재 circuit의 parent만 있으면 되며 component selection을 요구하지 않는다.

---

# Part XII. 저장·복구

## 27. 파일 저장

- JSON에는 schema version과 stable ID 포함.
- 파일 전체 parse + validation 성공 후에만 current circuit 교체.
- 손상, duplicate ID, nonexistent pin reference → 기존 circuit 유지.
- changed circuit을 다른 circuit으로 교체할 때만 Save / Discard / Cancel 제공.

## 28. Auto Recovery

- 마지막 확정 edit 이후 저장.
- browser recovery와 explicit file save 상태 구분.
- storage failure/limit exceeded를 조용히 무시하지 않음.
- 원인 안내 + explicit file save 경로 제공.
- draft/selection/view state와 circuit structure 저장 범위 분리.

초안 중 explicit save는 마지막 확정 circuit만 저장하며 초안 제외 사실을 사용자에게 알린다.

---

# Part XIII. 기술 구조

## 29. 책임 경계

| 영역 | 책임 |
|---|---|
| Circuit Model | component, pin, junction, logical net, property, stable ID |
| Drawing Geometry | wire waypoint, placement, transform. logical net과 분리 |
| Edit Command | preview, commit transaction, Undo/Redo |
| Input/Interaction | focus, key, pointer, snap, state transition |
| Renderer | 전달된 state의 drawing/selection/signal/preview 표현 |
| Simulation Session | logic evaluation, sequential state, time, waveform |
| Storage | file validation, version, recovery, errors |
| UI Shell | menu, panel, current tool, diagnostics |

핵심 원칙:

- geometry 변경이 논리 연결을 암묵적으로 변경하지 않는다.
- preview는 committed circuit, save, simulation과 분리한다.
- framework/rendering 기술은 prototype에서 hit-test/geometry/응답성을 확인한 뒤 확정한다.

---

# Part XIV. 검증 계획

## 30. 사용성 과제

초기 관찰 제안:

- 논리 게이트 개념을 아는 신규 사용자 5명 이상
- 기존 CAD 경험자 별도 포함
- 설명 없이 첫 작업 시작
- 도움 제공 시점 기록
- 학습 후 같은 작업 재시도

| 과제 | 확인 | 잠정 목표 |
|---|---|---|
| 반가산기 작성 | Search→Place→Branch→Input/Output | 5명 중 4명 이상이 5분 내 개입 없이 완료 |
| 연결된 gate 이동/회전 | route preview와 connection 유지 | 의도하지 않은 단선/접속 0 |
| 잘못된 wire 취소 | Backspace vs Esc | committed circuit 손상 없이 재시작 |
| 교차/분기 | junction 의미 | 참가자가 연결 여부 설명 가능 |
| 다중 선택/복사/이동 | 내부/외부 wire policy | 원본 logical connection 손실 0 |
| Delete/Undo/Redo | transaction·branch | 구조 완전 복구, 새 edit 후 과거 redo 불가 |
| 50/100/200% zoom | pin snap | 각 zoom에서 10회 중 9회 이상 의도 pin 선택 후보 |
| Box select/Pan | gesture 구분 | 10회 중 오제스처 1회 이하 후보 |
| Signal/diagnostics | floating/conflict 추적 | 도움 없이 원인 object 찾기 |
| Save/Open/Recovery | file/recovery 구분 | committed circuit loss 0 |

## 31. 단축키·검색 비교

- gate 20개 이상 과제: A 검색 / alias 보강 / 필요 시 Q Quick Place 비교.
- Quick Place 후보에는 필수 sequence timeout 없음. 호환 accelerator timeout은 DEC-016의 설정을 따른다.
- 완료 시간, 오입력, 학습 시간 기록.
- KiCad 경험자의 M/G 이해도 기록.
- `Shift+Space`가 WIRE_DRAFT에서 page scroll/pan을 일으키지 않는지.
- Tab UI navigation 후 preview resume/cancel 확인.
- Duplicate interval reuse 후보 검증.
- 한/영, IME, input field, autorepeat, browser event 수신 검증.
- Windows browser에서 Alt 단독 hold가 menu focus를 만드는지.
- 후보 `Ctrl+D`, `Ctrl+G`, `Ctrl+↑/↓` event 수신 확인.
- `Shift+G`↔`G` 오조작 빈도.
- pin click wire start와 pin selection 충돌.

## 32. 무결성

- Move/Rotate/Segment move 전후 logical graph 동일.
- explicit connect/delete command에서만 connectivity 변경.
- cancel/capture loss/window blur가 중간 data loss를 만들지 않음.
- corrupted file, duplicate ID, invalid pin reference, storage quota failure 재현.

## 33. 성능 측정

기존 문서의 “100 components / 200 wires에서 preview p95 33ms”는 과거 잠정 목표이며, 현재 Master Spec에서는 수치를 바로 확정하지 않는다.

먼저 다음 지표를 분리해 측정한다.

1. geometry/path calculation time
2. frame interval
3. input event → visible frame latency
4. p95 latency
5. long stall/jank
6. pointer와 preview 사이의 시각적 거리

환경 기록:

- CPU/RAM
- browser/version
- display refresh rate
- device pixel ratio / zoom
- 100/200 normal circuit
- 500/1000 stress circuit

60Hz 환경에서 frame interval을 16.7ms 부근으로 유지하는 것은 **목표 후보**이지 검증 완료 기준이 아니다. stress 규모에서는 더 느슨한 기준을 별도로 둘 수 있다.

pointermove마다 전체 circuit을 재계산하지 않고, 필요하면 최신 pointer position만 next animation frame에 반영한다.

---

# Part XV. 구현 순서

## 34. 실제 추천 순서

1. **이 Master Spec을 기준 문서로 선언**하고 파생 문서에서 “최종안” 표현 제거.
2. State model + input ownership + browser suppression matrix를 코드에 옮길 수 있는 표로 확정.
3. Undo preview 정책을 사용자 승인/작은 프로토타입으로 최종 결정.
4. Safe Move/Rotate geometry의 fixed point, branch, multi-select edge case 명세.
5. 기본 편집 프로토타입: `A/W/M/R/E/V/Esc`, selection, wire, delete, Undo/Redo.
6. browser/IME/Alt/middle button/Shift+Space 실측.
7. 사용성·응답성 측정.
8. 첫 simulator 전에 0/1/X/Z resolution과 diagnostics 확정.
9. 필요성이 있으면 Q Quick Place, `/` palette, repeated duplicate 실험.
10. hierarchy/time simulation 착수 전에 해당 data/event model 확정.

---

# Part XVI. 남은 결정

## 35. 편집 프로토타입 전에 최종 확인할 항목

| 항목 | 현재안 | 필요한 확인 |
|---|---|---|
| Undo preview | 2단계 취소/Undo | 사용자 의도·오작동 비교 |
| State model | Tool/Operation/Transient/Focus | 실제 코드 전이표 |
| Safe Move fixed point | 첫 외부 waypoint/junction/pin | branch·multi-select geometry cases |
| Alt snap bypass | Alt hold | Windows browser 실측 |
| 우클릭 비선택 대상 | 대상 선택 후 menu | selection 유지 선호 비교 |
| 다중 Properties | semantic intersection | property schema와 validation |

## 36. 프로토타입 뒤 결정할 항목

| 항목 | 현재 방향 |
|---|---|
| 패널형 vs 도면 집중형 | 같은 과제 비교 |
| M/G 호환 프로필 | 기본은 Safe Move/Grid 유지, KiCad profile 필요성 측정 |
| Q Quick Place | A 검색이 부족할 때만 |
| Input/Output 빠른 키 | A 검색/명시 메뉴 우선 |
| `/` palette | 긴 꼬리 command discoverability 필요성 |
| repeat duplicate | 변위 재사용 UX/Undo 검사 |
| right-drag pan | 호환 프리셋/사용자 바인딩 |

## 37. 해당 기능 착수 전에 결정할 항목

- 0/1/X/Z truth/resolution 상세
- combinational feedback stabilization
- group/subcircuit model
- hierarchy navigation
- event queue/time Step semantics
- clock edge/period command
- bus semantics
- MyLogic compatibility 요구

---

# Part XVII. 이전 검토 이슈 처리 현황

## 38. 문제점 검토서 P0/P1/P2 disposition

| 기존 이슈 | 현재 처리 |
|---|---|
| 단일 기준 문서 부재 | **해결 방향 채택**: 본 Master Spec이 기준 |
| P/Q 충돌 | **정리**: P Probe 보존, Q Quick Place experimental. v1은 A 검색 |
| 검색 정렬 불일치 | **정리**: exact/prefix/fuzzy + recent tie-break |
| Undo와 preview | **부분 해결**: 2단계안을 provisional. Codex 반대안 보존 |
| 암묵적 state machine | **정리**: 4층 상태 모델 제안 |
| Safe Move path rule | **정리**: 최소 orthogonal stretch provisional |
| Esc/Tab/input 우선순위 | **정리**: input ownership hierarchy 정의 |
| 우클릭 기본 미정 | **정정**: 기존 문서에 context menu가 있었음. 남은 것은 대상 정책 |
| 다중 E 규칙 없음 | **정정**: 공통 속성 원칙은 있었음. semantic compatibility를 추가 |
| 0/1/X/Z table | **후속 명세**: 후보 table 포함, simulator 전에 확정 |
| Group/Subcircuit | **DEFERRED** |
| Step 의미 | **DEFERRED** |
| dangling double-click | **v1 제외 권장** |
| browser preventDefault | **matrix로 승격** |
| p95 33ms | **수치 보류**, measurement definition 우선 |

---

# Part XVIII. 변경 이력과 대안 보존

## 39. 단축키 설계 계보

기존 단축키 종합 문서에 기록된 흐름을 보존한다.

1. 사용자 제공 CAD shortcut benchmark.
2. Claude v0: 벤치마크 기반 최초 추천.
3. Codex v0.1: 기존 Circlith + benchmark로 기준안.
4. Claude 비교: v0 ↔ v0.1 병합 권고.
5. Claude v0.2: subcircuit key와 빠른 배치 후보 추가.
6. 독립 Codex 0.2: P Place menu, `/` palette, interval duplicate 제안.
7. Claude v0.3: Codex 0.2 일부 반영.
8. `SHORTCUTS_Consolidated`: Claude 0.3을 당시 “현재 최종안”으로 정리.
9. `codex LF final`: P Probe + Q Quick Place 방향으로 다시 통합.
10. 문제점 검토서: P/Q·검색·Undo·상태·geometry 등의 충돌 지적.
11. Codex/Claude 회신: 대부분 수렴, Undo에서 주요 이견.
12. **본 Master Spec**: 모든 자료를 한 기준 문서로 통합.

## 40. 과거 제안 중 현재 기본에서 제외한 것

### 40.1 Space 과적재 — `REJECTED`

과거 Claude 초안의 Space 회전/배선 꺾임/input toggle 겸용을 폐기.

현재:

- Space+drag = Pan
- Shift+Space = wire bend mode
- input toggle = 별도 hit area

### 40.2 Tab = placement property — `REJECTED`

Tab은 UI focus navigation에 남기고 Properties는 E.

### 40.3 Ctrl+D 기본 Duplicate — `REJECTED` as default

기본은 Shift+D. Ctrl+D는 browser bookmark 충돌 실측 후 alias 후보.

### 40.4 P Place / P,P Probe — `REJECTED` as current default

과거 Claude 0.3/Consolidated 안. 현재는 P Probe 보존, Q Quick Place experimental.

### 40.5 1.5초 Quick Place timeout — `REJECTED`

sequence menu는 시간 제한 없이 읽고 선택할 수 있게 한다.

### 40.6 Enter = previous tool repeat — `REJECTED` as default

Enter는 confirm 의미로 유지. Repeat는 별도 palette/shortcut 후보.

### 40.7 Shift로 Input/Output 방향 전환과 gate inversion 통일 — `REJECTED`

방향과 논리 반전은 다른 개념. gate complement pair에서만 Shift 변형을 설명할 수 있다.

### 40.8 빈 공간 double-click wire finish — `REJECTED` for v1

필요 시 명시적 Finish Unconnected로 재검토.

### 40.9 right-drag pan — 과거 `REJECTED` 기본안

기본은 Context menu 우선이다. 중간 프로토타입에서는 사용자 요청으로 빈 공간 RMB drag Pan을 지원했으며, 후속 입력 지침에서 Master Spec 기본값으로 정정했다. 현재 RMB drag Pan은 호환 프리셋/사용자 바인딩에만 적용한다.

---

# Part XIX. 출처와 주의

## 41. 기존 문서에서 참조한 제품·기술 자료

- Logic Forge README / ROADMAP / controller 분리 계획 — 참고 프로젝트의 구조와 검증 방향.
- KiCad 9 Schematic Editor — 선택/Hover, Move/Drag, 회전·배선·뷰 선례.
- EasyEDA Pro shortcuts — W/N/T/H 등 shortcut 사례.
- LibrePCB shortcut reference — A/W/E, 회전, edit/view 사례. 과거 문서 기준 0.1.7 자료이므로 최신 default 전체를 보증하지 않음.
- Altium Schematic shortcuts — F2, selection, incremental movement, Backspace, Enter, context action 사례.
- Chrome shortcuts — browser reserved/default key 참고.
- `KeyboardEvent.code`, `KeyboardEvent.isComposing` — physical key와 IME 보호의 구분.
- Autodesk Fusion Electronics — hierarchy/command 관련 일부 내용은 기존 benchmark를 통한 간접 참고였으며 이번 통합에서 원문 재검증하지 않음.
- OrCAD X Presto PCB 전용 key는 논리회로 CAD 기본 키 근거로 사용하지 않음.

이 문서는 이번 통합 과정에서 외부 웹 재검증을 추가로 수행하지 않았다. 위 항목은 원본 문서가 이미 인용한 출처 목록을 보존한 것이다.

## 42. 주의

- 이 Master Spec은 **설계 통합본**이지 구현·사용성 검증 완료 보고서가 아니다.
- `CURRENT`는 “현재 구현 기준”을 뜻하며 업계 표준 또는 측정된 최적값을 뜻하지 않는다.
- `PROVISIONAL`/`EXPERIMENTAL` 항목은 도움말의 확정 기본값처럼 표시하지 않는다.
- 기능이 존재하지 않는 단계에서는 예약 key를 선점하지 않는다.
- 향후 `PLAN.md`, `INTERACTION.md`, `USABILITY.md`, 원본 shortcut 문서가 제공되면 이 Master Spec과 다시 대조하고, 중복 spec을 두 곳에서 동시에 유지하지 않는다.

---

# Appendix A. 구현 전 체크리스트

- [ ] Master Spec만 구현 기준으로 사용하고 있음
- [ ] Tool / Operation / Transient / Focus 상태표가 코드와 일치함
- [ ] Ctrl+Z preview 정책이 사용자 승인 또는 prototype test로 확정됨
- [ ] `A` 검색 ranking과 Enter 조건이 명시됨
- [ ] `M` Safe Move의 fixed point / branch / rotation 규칙이 geometry test에 있음
- [ ] `Esc`, `Enter`, `Tab`, `E`, `R`, `M`, `W`의 상태별 의미가 전이표에 있음
- [ ] Right-click / middle / Space pan 정책이 구현됨
- [ ] `Alt` hold의 Windows browser 동작을 실측함
- [ ] Multi-selection Properties의 semantic intersection과 atomic commit이 구현됨
- [ ] WIRE_DRAFT에서 Shift+Space의 browser scroll을 막음
- [ ] IME composing 중 canvas command가 실행되지 않음
- [ ] focus loss / pointer capture loss에서 gesture가 rollback됨
- [ ] logical graph invariant test가 Move/Rotate/Segment move에 있음
- [ ] save/open validation 실패 시 current circuit이 보존됨
- [ ] simulator 시작 전에 0/1/X/Z와 diagnostic 규칙을 확정함
- [ ] hierarchy/time 기능의 data/event semantics 확정 전 관련 key를 활성화하지 않음
- [ ] performance 수치는 측정 지표·환경과 함께 기록함

---

# Appendix B. 리뷰 간 주요 합의와 이견

## B.1 합의

Codex와 Claude 회신 모두 다음 방향에는 사실상 합의했다.

- 단일 기준 문서 필요
- A 검색 우선, 최근 사용은 검색 의도를 침범하지 않음
- state machine 명문화 필요
- Safe Move는 full autoroute가 아니라 최소 orthogonal stretch
- IME/Text/Modal과 canvas input ownership 분리
- 0/1/X/Z 계산과 diagnostic 분리
- Group과 Subcircuit 구분
- dangling double-click은 v1에서 제외 가능
- browser suppression matrix 필요
- 성능 수치는 측정 정의가 먼저
- Quick Place/Hierarchy/Time 기능이 기본 편집 prototype을 막아서는 안 됨

## B.2 Undo 이견

**Codex안**

- preview가 있어도 한 번의 Ctrl+Z에서 preview discard 후 history Undo까지 수행.
- Esc는 preview만 취소.

**Claude안**

- preview가 있으면 첫 Ctrl+Z는 preview만 취소.
- 다음 Ctrl+Z에서 history Undo.
- 한 입력이 미확정 상태와 확정 데이터를 동시에 제거하지 않는 것이 안전.

**Master Spec 현재안**

- Claude식 2단계안을 `PROVISIONAL`로 선택.
- 사용자 테스트나 실제 prototype에서 혼동이 더 크다면 재검토.

---

# Appendix C. 기존 P/Q 충돌 보존

| 문서 계열 | 제안 |
|---|---|
| Codex v0.1 / LF final 방향 | `P` Probe, `Q` Quick Place 후보 |
| Codex 0.2 / Claude 0.3 / SHORTCUTS_Consolidated 방향 | `P` Place menu, `P,P` Probe |
| 문제점 검토 후 통합 | v1은 A 검색. P Probe를 보존하고 Q Quick Place를 필요 시 실험 |

어느 안이 더 빠른지는 측정되지 않았다. 현재 선택의 근거는 “기존 Probe 예약을 이동시키지 않고, 빠른 배치 기능 자체를 늦게 도입할 수 있다”는 변경 비용과 역할 분리다.

---

# Appendix D. 문서 유지 정책

향후 저장소에서는 다음 구조를 권장한다.

```text
docs/
  CIRCLITH_MASTER_SPEC.md      # 유일한 기준 문서
  archive/
    codex_LF_final.md
    SHORTCUTS_Consolidated.md
    ISSUES_AND_SOLUTIONS_Codex.md
    REVIEW_RESPONSE_Claude.md
    Circlith_남은_문제점_검토서.docx
```

새로운 결정을 내릴 때는 먼저 Master Spec의 DEC 항목과 해당 절을 수정하고, 별도 파생 문서에 다른 “최종값”을 만들지 않는다.

---

**END OF MASTER SPEC**
