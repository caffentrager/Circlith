# Circlith 단축키 설계 종합 정리

> **보관 문서 / 구현 기준 아님.** 현재 설계와 구현은 [CIRCLITH_MASTER_SPEC.md](../CIRCLITH_MASTER_SPEC.md)를 우선한다. 아래 내용은 통합 이전의 제안·검토 이력이며, 서로 다른 기본값이나 후보는 현재 명세를 대체하지 않는다.

작성일: 2026-10-13. 벤치마크 분석부터 Claude 0.3까지의 작업을 한 문서로 묶은 것이다. 설계 제안이며, 구현과 사용자 검증은 아직 진행하지 않았다. 어떤 세트가 더 빠르다거나 조작성이 검증됐다는 주장은 하지 않는다.

---

## 1. 요약

- **목표:** 논리회로 설계용 웹 CAD(Circlith)의 단축키 세트를 만들고, 키마다 선정 근거를 둔다.
- **출발점:** 6개 CAD(KiCad 9, Altium, EasyEDA Pro, Fusion/EAGLE, LibrePCB, OrCAD X)의 단축키 벤치마크. 이 자료는 비교용이며 요구사항이 아니다.
- **통합 이전 권장안:** [Claude 0.3](SHORTCUTS_Claude_v0.3.md). 첫 버전 기본 키는 Codex v0.1과 같고, 후속 기능 키와 후보만 단계적으로 보강했다.
- **핵심 설계 방향:**
  1. 수렴하는 키(`A W R E Esc Delete`, 휠 줌 등)는 그대로 쓴다.
  2. 연결을 잃기 쉬운 작업은 안전한 기본을 우선한다(`M`=연결 유지 이동).
  3. 브라우저 포커스·IME·접근성을 해치는 키(`Tab` 가로채기, `Space` 과적재)는 쓰지 않는다.
  4. 키가 없는 명령은 `/` 팔레트와 메뉴로 접근한다. 모든 명령에 키를 주지 않는다.
  5. 기능이 없으면 예약 키도 가로채지 않는다.
- **미해결:** `M`/`G` 의미(잠정), Place 메뉴 채택 여부, 그룹/서브회로 데이터 의미, Step 의미, 입출력 배치 접근. 모두 §8에 있다.

---

## 2. 작업 경과

| 순서 | 문서 | 작성 | 한 일 | 상태 |
|---|---|---|---|---|
| 0 | Circlith_CAD_Shortcut_Benchmark_v0.md | (사용자 제공) | 6개 CAD 단축키·조작 비교 | 입력 자료 |
| 1 | `Circlith_Shortcut_Set_v0.md` | Claude | 벤치마크 기반 최초 추천 세트. 키마다 근거 표기 | 초안. 아래 §6의 문제 있음 |
| 2 | [SHORTCUTS.md](SHORTCUTS.md) (v0.1) | Codex | 기존 Circlith 초안 + 벤치마크로 추천 세트 작성. 근거 범위·검증 계획 포함 | 당시 기준 문서 |
| 3 | v0 ↔ v0.1 비교 | Claude | 일치·충돌·한쪽에만 있는 키 정리, v0.1 기준 병합 권고 | 이 대화 |
| 4 | [SHORTCUTS_v0.2.md](SHORTCUTS_v0.2.md) | Claude | v0.1 기준 + 서브회로 키·빠른 배치 후보 병합 | 3의 결과 |
| 5 | [SHORTCUTS_Codex_v0.2.md](SHORTCUTS_Codex_v0.2.md) | Codex | v0와 v0.1 비교, `P` 배치 메뉴·`/` 팔레트·간격 복제 제안, 표현 정정 | 4를 참조하지 않고 작성 |
| 6 | [SHORTCUTS_Claude_v0.3.md](SHORTCUTS_Claude_v0.3.md) | Claude | v0.2에 Codex 0.2의 비교 결과 반영 | **통합 이전 권장안** |
| 7 | 이 문서 | Claude | 전체 종합 | — |

---

## 3. 버전별 비교

각 안이 같은 주제를 어떻게 정했는지 한눈에 본다.

| 주제 | Claude v0 (최초) | Codex v0.1 | Codex 0.2 | **Claude 0.3 (최종)** |
|---|---|---|---|---|
| `M` | 이동 (연결 유지 안 함) | 연결 유지 이동 | 연결 유지 이동 | 연결 유지 이동 |
| `G` | 연결 유지 Drag | 그리드 표시 토글 | 그리드 표시 토글 | 그리드 표시 토글 |
| `Space` | 회전·배선 꺾임·시뮬 입력 토글 겸용 | 화면 이동(+드래그)만 | 화면 이동만 | 화면 이동만 |
| 배선 꺾임 | `Space` | `Shift+Space` | `Shift+Space` | `Shift+Space` |
| `Tab` | 배치 중 속성 | 브라우저 포커스 이동 | 포커스 이동 | 포커스 이동 (속성은 `E`) |
| 스냅 임시 해제 | `Ctrl` 유지 | `Alt` 유지 | `Alt` 유지 | `Alt` 유지 |
| 복제 | `Ctrl+D` | `Shift+D` | `Shift+D`, `Ctrl+D`는 검증 후 | `Shift+D`(간격 반복), `Ctrl+D`는 후보 |
| 넷 라벨 | `L` 주, `N` 별칭 | `N` | `N` 기본, `L` 별칭 후보 | `N`, `L` 별칭 후보 |
| 선택 도구 | `Esc`만 | `V` | `V` | `V` |
| 빠른 배치 | `P` 시퀀스(1.5초 제한) | A 검색만, 검증 후 결정 | `P` Place 메뉴(시간 제한 없음) | A 검색 보강 → `P` Place 메뉴(후보) |
| `P` 키 | Place 접두사 | Probe | Place 메뉴 (`P,P`=Probe) | Place 메뉴 (`P,P`=Probe) |
| 직전 도구 재실행 | `Enter` | 없음 | 별도 명령 | 팔레트 명령 (키 미정) |
| 명령 팔레트 | `/` | 없음 | `/` 추가 제안 | `/` (후보) |
| 서브회로 | `Ctrl+G`, `Ctrl+↑/↓` | 없음 | 키 미확정, 메뉴 우선 | 키 미확정 후보 |
| 정렬 | `Alt+L/R/T/B` | 메뉴 | 메뉴/팔레트 | 메뉴/팔레트 |
| 시뮬레이션 | `Ctrl+Enter`, `Ctrl+.`(스텝) | `Ctrl+Enter`, `Shift+Enter`(이벤트), `Ctrl+Shift+Enter`(리셋) | 동일, Step 의미 분리 필요 | 동일, `Shift+Enter`=이벤트 1개 |
| 줌 | `PgUp/PgDn`, `Z`, `Home` | `+/-`, `Home`, `Shift+Home` | 동일 + `Z` 후보 | `+/-`, `Home`, `Shift+Home`, `Z` 후보 |
| 우클릭 | 드래그 팬 | 컨텍스트 메뉴 | 우클릭 드래그는 설정 후보 | 우클릭 드래그는 설정 후보 |
| 정책 문서화 | 간단 | IME·포커스·재배정·접근성 상세 | 표현 정정, 비교 과제 | 위 둘 반영 |

---

## 4. 통합 이전 키 세트 (Claude 0.3)

근거 표기: 관습은 출처에서 확인한 선례, 설계 판단은 Circlith에 맞춘 제안이다. 둘 다 업계 표준이나 측정된 효과를 뜻하지 않는다. 출처 약칭은 §10.

### 4-1. 첫 버전

| 키 | 기능 | 핵심 근거 |
|---|---|---|
| `A` | 부품 검색창 → 배치 미리보기 | Add 첫 글자, KiCad·LibrePCB 선례 [K][L]. 부품별 키를 외우기 전의 단일 진입점. |
| `W` | 배선. 핀/선분 위에서는 그 위치에서 시작 | KiCad·EasyEDA·LibrePCB 선례 [K][E][L]. 빈 공간에서는 초안만 시작. |
| `V` | 선택 도구로 복귀(초안 취소, 선택 유지) | 기존 Circlith 초안 유지. 공통 표준이라는 주장은 하지 않음. |
| `M` | 연결 유지 이동 | 설계 판단. KiCad의 M과 의미가 다르다 [K]. |
| `R` / `Shift+R` | 반시계 / 시계 90° 회전 | KiCad·LibrePCB 선례 [K][L]. |
| `E` | 속성. 배치 초안의 설정(입력 개수·비트 폭)도 여기서 | KiCad·LibrePCB 선례. `Tab`을 포커스에 남기기 위함. |
| `F2` | 이름·문자 직접 편집 | Altium 선례 [A]. |
| `Shift+D` | 복제 미리보기. 연속 시 같은 변위 제안 | Chrome `Ctrl+D` 회피 [C]. 간격 반복은 EasyEDA·Altium 방향과 유사 [E][A]. |
| `Delete` | 명시적 선택 삭제 | 공통. 커서 아래 직접 삭제 안 함. |
| 방향키 / `Shift+방향키` | 선택 1칸 / 10칸 이동 | 선택 객체 이동(Altium은 커서 이동). 연결 유지. |
| `Shift+Space` | 배선 꺾임 전환 | 설계 판단. `Tab`·`Space` 단독과 구분. |
| `Backspace` | 마지막 경유점 제거 | Altium 선례 [A]. |
| `Enter` | 미리보기 확정, 유효 대상 연결 | Altium 선례 [A]. 대기 상태에서는 새 도구를 시작하지 않음. |
| `Esc` | 작업 취소 → 배선 대기 종료 → 선택 해제 | 가장 가까운 작업부터 단계적. |
| `Alt` 유지 | 그리드 스냅 임시 해제 | 설계 판단. `Ctrl`·`Shift`의 역할 회피. |
| `Shift+클릭` | 배치 중 연속 배치 / 선택 토글 | 선택 토글은 Altium 선례 [A]. |
| `Tab` / `Shift+Tab` | UI 포커스 이동 (도면 단축키는 입력 필드에서 멈춤) | 브라우저 기본 탐색·접근성 보존. |
| `Ctrl+A/C/X/V` | 전체 선택, 복사, 잘라내기, 붙여넣기 미리보기 | 공통 관습. |
| `Ctrl+Z` / `Ctrl+Shift+Z`, `Ctrl+Y` | Undo / Redo | 공통 관습. [L] |
| `Ctrl+S` / `Ctrl+O` | 저장 / 열기 (앱 포커스에서만) | 공통 관습. 실패한 열기는 현재 회로를 덮지 않음. |
| `Ctrl+F` | 회로 대상 검색 | 공통 관습. 라이브러리 검색은 `A`. |
| `?` | 현재 상태의 단축키 안내 | `F1` 브라우저 도움말과 구분 [C]. |
| `Space`+드래그 / 휠 버튼 드래그 | 화면 이동 | 트랙패드 지원. 중간 버튼은 KiCad·LibrePCB 선례 [K][L]. |
| 휠, `+` / `-` | 커서 중심 / 화면 중심 확대·축소 | `Ctrl` 없이 브라우저 페이지 확대와 구분. |
| `Home` / `Shift+Home` | 전체 / 선택 영역 보기 맞춤 | 기존 Circlith 초안 유지. |
| `G` | 그리드 표시 토글 (스냅 설정은 유지) | `M`이 연결 유지 이동이라 `G`를 Drag로 쓰지 않음. |

### 4-2. 후속 기능용 예약 키

| 키 | 기능 | 비고 |
|---|---|---|
| `N` | 넷 라벨 | EasyEDA·LibrePCB 선례 [E][L] |
| `T` | 설명 문자 | EasyEDA·LibrePCB 선례 [E][L] |
| `H` / `Shift+H` | 네트 강조 / 전체 해제 | EasyEDA 선례 [E] |
| `P` | Place 메뉴 (§4-3), Probe는 `P,P` | KiCad·Altium의 Place 계열 선례 [K][A] |
| `X` / `Y` | 좌우 / 상하 대칭 | KiCad 선례 [K] |
| `B` | Bus (예약만) | 버스 지원 시 활성화 |
| `Ctrl+Enter` | 시뮬레이션 실행/일시정지 | 주소창에서는 의미가 다름. 도면 포커스·초안 없음일 때만 [C] |
| `Shift+Enter` | 다음 이벤트 1개 진행 | 일시정지 상태에서만 |
| `Ctrl+Shift+Enter` | 시뮬레이션 Reset | 자동 반복 무시 |

첫 조합회로 버전은 입력 변화마다 재계산하므로 시간 제어 키가 필요 없다.

### 4-3. 확장 후보 (검증 통과 전에는 활성화하지 않음)

**빠른 배치: 단계적으로 시도한다.**

1. `A` 검색 보강: `and`, `nand`, `in`, `out`, `0`, `1` 같은 짧은 이름 입력 + `Enter`로 바로 배치. 최근 부품을 맨 위에. 새 키 불필요.
2. `P` Place 메뉴: 시간 제한 없음, 두 번째 키·클릭·`Esc`로 종료. 항목을 고르면 미리보기부터 시작.
3. `/` 명령 팔레트: 이름 검색·실행, 배정 키 표시, 실행 불가 사유 표시. 입력 필드에서는 열지 않음.

Place 메뉴의 두 번째 키(`Shift` 반전은 게이트 쌍에만 적용):

| 시퀀스 | 대상 |
|---|---|
| `P,A` / `P,Shift+A` | AND / NAND |
| `P,O` / `P,Shift+O` | OR / NOR |
| `P,X` / `P,Shift+X` | XOR / XNOR |
| `P,B` / `P,Shift+B` | Buffer / NOT (`P,N` 별칭은 검증) |
| `P,M` · `P,F` · `P,C` | MUX · D 플립플롭 · Clock |
| `P,0` / `P,1` | 상수 0 / 1 |
| `P,P` · `P,S` | Probe · 서브회로 |
| Input / Output | 키 미정. 메뉴 항목 또는 `A` 검색 |

**호환·보조 후보**

| 후보 | 동작 | 확인할 점 |
|---|---|---|
| `L` | 넷 라벨 별칭 | 같은 명령을 호출하게 한다 |
| `Ctrl+D` | 복제 별칭 | 브라우저 북마크와 겹침. 앱 포커스에서 이벤트 수신·실패 동작을 검사 |
| `Z` | 선택 영역 보기 맞춤 | 선택이 없을 때의 동작 |
| 우클릭 드래그 | 화면 이동(설정으로 켬) | 짧은 우클릭은 메뉴로 유지 |
| 핀 클릭 | 배선 시작 | 핀 선택과의 우선순위 |

**키 미확정 후보 (메뉴·팔레트 우선)**

| 항목 | 방향 | 먼저 필요한 것 |
|---|---|---|
| 그룹/서브회로/계층 이동 | 후보: `Ctrl+G`, `Shift+G`, `Ctrl+↓/↑` | 그룹과 서브회로의 데이터 의미. `Shift+G`↔`G` 오조작, `Ctrl+G` 이벤트 수신 확인 |
| 정렬·간격 조정 | 메뉴/팔레트 | 사용 빈도, 브라우저별 Alt 조합 |
| 직전 도구 재실행 | 팔레트 명령 | 반복 사용 빈도 측정 후 키 결정 |
| 클록 1주기 Step | 팔레트 명령 | 이벤트 Step과 의미 구분 |

---

## 5. 핵심 설계 결정과 근거

업계에서 같은 키가 서로 다른 의미로 쓰이는 경우를 어떻게 정했는지다.

| 키 | 업계 용례 | 최종 | 이유 |
|---|---|---|---|
| `A` | Add (KiCad, Fusion, LibrePCB) / Align 메뉴 (Altium) | Add | 다수. 정렬은 메뉴/팔레트. |
| `E` | Properties (KiCad, LibrePCB) / Errors (Fusion) | Properties | 다수. 배치 초안 설정도 `E`로 통일. |
| `M` | Move (KiCad, Fusion, EasyEDA) / Mirror (LibrePCB) | 연결 유지 Move | 다수 + 연결 손실 방지. KiCad 사용자와 의미가 달라지므로 §8에서 재확인. |
| `G` | Drag (KiCad) / Grid (Fusion) | Grid 표시 | `M`이 연결 유지를 맡아 Drag가 불필요. |
| `N` / `L` | Net Label (EasyEDA, LibrePCB, KiCad `L`) | `N` 기본, `L` 별칭 후보 | 두 관습 수용. 같은 명령을 호출. |
| `P` | Pin (EasyEDA, Fusion) / Polygon (LibrePCB) / Place (KiCad, Altium) | Place 메뉴 | 논리회로 도면에는 Pin·Polygon 도구가 당장 없다. 단, 장기적으로 불필요하다고 단정하지는 않는다. |
| `Space` | Rotate (Altium) | 화면 이동 전용 | 한 키에 회로 변경 의미를 여러 개 얹지 않는다. 트랙패드 지원. |
| `Tab` | Properties (EasyEDA) / Toolbar (LibrePCB) | 포커스 이동 | 키보드 접근성. 속성은 `E`. |
| 스냅 해제 | `Ctrl` 유지 (KiCad) | `Alt` 유지 | `Ctrl`의 선택·클립보드 역할을 비켜감. Windows 브라우저에서 `Alt` 단독 입력의 메뉴 포커스 여부는 검증 필요. |
| 복제 | `Ctrl+D` (EasyEDA, LibrePCB) | `Shift+D` | Chrome 북마크 키 회피 [C]. `Ctrl+D`는 실측 후 별칭 여부 결정. |
| 선택 `S` | Select 메뉴 / Shortcut / Snap으로 갈림 | 미할당 | 의미가 갈려 비워 둠. |

기본 원칙:
- 반복 작업에는 단일 키, 긴 꼬리 기능은 메뉴·팔레트.
- `Shift`는 반대 방향·변형에 쓰되 모든 조합에 적용되는 규칙으로 설명하지 않는다.
- 파괴적 명령(삭제·잘라내기·복제·그룹)은 명시적 선택에만 적용한다. Hover만으로 실행하지 않는다.
- 팔레트로 실행한 명령도 키 명령과 같은 대상·안전 규칙을 따른다.

대상 선택 규칙(요지):
1. `R`: 배치 초안 → 명시적 선택 → 커서 아래 단일 대상.
2. `M`/`E`: 초안 없으면 명시적 선택 우선, 없으면 커서 아래 대상을 강조하고 동작.
3. `W`: 선택과 무관하게 커서 아래 연결 가능한 핀/접속점/선분 우선.
4. 후보가 중첩되면 선택 팝업. 모호한 상태에서 회로를 바로 바꾸지 않는다.
5. 초안 중 새 도구를 누르면 초안을 폐기하고 전환. 호환되지 않는 명령은 안내만.

---

## 6. 정정한 내용 (Claude 초안의 문제)

Claude v0에는 아래 문제가 있었고, v0.3에서 고쳤다.

| 문제 | 정정 |
|---|---|
| `Space` 하나에 회전·꺾임·입력 토글을 얹음 | `Space`는 화면 이동 전용, 꺾임은 `Shift+Space` |
| `Tab`을 배치 속성에 사용 | 포커스 이동 유지, 속성은 `E` |
| "같은 키를 쓰면 학습 비용이 0" | 틀린 표현. KiCad `M`/`G`와 Circlith `M`은 의미가 다르다. |
| "브라우저 예약 키와 겹치지 않는다"(`Ctrl+Enter`) | 절대 표현 삭제. 주소창에서는 의미가 다르다. |
| `Ctrl+D`를 앱이 막으면 된다는 전제 | `Shift+D`를 기본으로, `Ctrl+D`는 실측 후 별칭 |
| `P` 시퀀스의 1.5초 제한 | 시간 제한 없는 메뉴로 변경 |
| `Q` 접두사(P가 Probe로 선점돼 만든 우회책) | `P`를 Place 메뉴로 옮겨 폐기 |
| `Enter`를 직전 도구 재실행에 겸용 | 확정만. 재실행은 팔레트 명령 |
| 서브회로 키를 확정 예약으로 둠 | 데이터 의미 미정이므로 후보로 강등 |
| 입력/출력 포트에 `Shift` 반전 규칙 적용 | 방향 전환과 논리 반전은 다른 개념. 게이트 쌍에만 적용 |
| 물리 키 판정(`event.code`)이면 IME에 안전하다는 암시 | 입력 필드·조합 상태·포커스 보호를 별도로 둔다 |
| "논리 CAD에는 핀·도형 편집이 불필요" | 초기 범위 제외와 장기 필요를 구분 |
| 시간 절약을 기정사실처럼 서술 | 측정 전에는 주장하지 않는다 |

---

## 7. 웹·한글 입력·키 설정 정책

- 입력·검색·textarea·contenteditable·모달이 활성이면 도면 단일 키와 편집 명령을 처리하지 않는다. `Ctrl+A/C/X/V/Z`와 방향키는 입력 UI에 맡긴다.
- 도면은 클릭/키보드 탐색으로 명시적으로 포커스를 얻는다. 마우스가 위에 있다는 이유로 다른 입력 필드의 포커스를 빼앗지 않는다.
- IME 조합 중(`isComposing`)에는 도면 명령을 실행하지 않는다 [M]. 단일 영문 명령은 물리 키 위치(`event.code`) 기준으로 한/영 상태와 무관하게 동작하는 안을 먼저 검증한다.
- `+`와 `?` 같은 기호는 입력 문자와 숫자패드 키를 별도로 처리한다. 수정키 조합을 정확히 구분한다(예: `Shift+D`가 `D`나 `Ctrl+D`로 처리되지 않게).
- 유효한 명령을 처리했을 때만 `preventDefault`를 적용한다. `Tab`은 기본 이동을 유지한다.
- 배치·회전·삭제·실행 토글의 keydown 자동 반복은 무시한다. 방향키만 반복 이동을 허용하고 keyup/포커스 상실에서 작업을 마감한다.
- 단축키는 재배정·초기화가 가능해야 하고, 같은 상태의 중복 배정은 저장 전에 표시한다. 브라우저 예약 키는 경고하고 대체 버튼을 둔다.
- 문자 하나로 동작하는 명령을 끌 수 있는 설정을 제공한다. 스크린리더·음성 입력·다른 키보드 배열을 함께 검증한다.
- macOS는 별도 프로필에서 검증한다. Windows `Ctrl`/`Alt`를 기계적으로 치환해 지원 완료로 주장하지 않는다.
- `Ctrl+S/O/F`는 브라우저와 겹치는 명령을 앱 포커스에서 의도적으로 처리하는 예외다. 이벤트를 받지 못하는 환경에서는 화면 버튼을 쓴다.
- `Ctrl+N`, `Ctrl+Shift+S`, `Ctrl+Shift+A`는 기본 세트에서 제외한다(새 도면·내보내기는 메뉴).

---

## 8. 열린 결정과 검증 계획

### 열린 결정

1. **`M`/`G` 의미.** 현재는 `M`=연결 유지 이동, `G`=그리드 토글(잠정). KiCad 호환 프로필(`M`=연결 없이 이동, `G`=연결 유지 드래그, 그리드 토글은 다른 키)을 따로 둘지는 사용성 검사 후 정한다.
2. **Place 메뉴 채택.** 반가산기 과제 비교 결과로 도입과 `P,N` 별칭 여부를 정한다. `A` 검색 보강만으로 충분하면 도입하지 않는다.
3. **그룹/서브회로 데이터 의미.** 이것이 정해져야 `Ctrl+G`, `Ctrl+↓/↑`를 확정하거나 폐기할 수 있다.
4. **Step 의미.** 이벤트 1개와 클록 1주기를 어떤 명령·키로 나눌지.
5. **입출력 포트 배치 접근.** 메뉴와 `A` 검색으로 충분한지.

### 프로토타입 비교 과제

- 같은 반가산기를 `A` 검색 / `A` 검색 보강 / `P` Place 메뉴로 작성해 완료 시간, 오입력, 학습 시간을 비교한다.
- 흐름 `A`→검색→배치→`R`→`W`→`Shift+Space`→연결→`M`→`Esc`를 마우스 메뉴 없이 수행한다.
- 이동·회전 후 논리 연결 보존을 확인하고, KiCad 사용자와 신규 사용자의 `M`/`G` 이해 차이를 기록한다.
- 배선 중 `Shift+Space`, `Space`+드래그, `Tab`, `Esc`를 연속 사용해 초안 유지·취소를 확인한다. `Shift+Space`가 페이지 스크롤이나 도면 이동을 일으키지 않아야 한다.
- 반복 복제의 간격 재사용, 배치 취소, Undo/Redo.
- 한/영 상태, IME 조합, 검색창·속성 필드, 자동 반복에서 오명령 여부.
- Chrome·Edge·Firefox·내장 브라우저에서 파일 열기/저장/복사 키, `Ctrl+Enter`, 후보 키(`Ctrl+D`, `Ctrl+G`, `Ctrl+↑/↓`)의 이벤트 수신. `Alt` 단독 입력이 메뉴 포커스를 만들지 않는지. 아직 검사한 것이 아니다.
- `Shift+G`↔`G` 오조작 빈도, 핀 클릭 배선 시작과 핀 선택의 충돌.

기록 항목은 완료 시간, 오명령, 잘못된 연결, 도구 전환, 도움 요청, 복구 성공 여부다.

---

## 9. 파일 위치

| 문서 | 경로 |
|---|---|
| Claude v0 (최초) | `Circlith_Shortcut_Set_v0.md` |
| Codex v0.1 | `SHORTCUTS.md` |
| Claude v0.2 | `SHORTCUTS_v0.2.md` |
| Codex 0.2 | `SHORTCUTS_Codex_v0.2.md` |
| **Claude 0.3 (당시 권장안)** | `SHORTCUTS_Claude_v0.3.md` |
| 이 문서 | `SHORTCUTS_Consolidated.md` |

---

## 10. 출처와 주의

- [K] [KiCad 9 Schematic Editor](https://docs.kicad.org/9.0/en/eeschema/eeschema.html)
- [E] [EasyEDA Pro Shortcut Key](https://prodocs.easyeda.com/en/introduction/hotkeys/)
- [L] [LibrePCB 0.1.7 Shortcut Reference](https://librepcb.org/blog/2022-10-03_release_0.1.7/keyboard_shortcuts_reference.pdf): 2022년 0.1.7 자료. 최신 버전의 모든 기본값을 보증하지 않는다.
- [A] [Altium Schematic Editor Shortcuts](https://www.altium.com/documentation/altium-designer/shortcut-keys/schematic-editors)
- [F] [Autodesk Fusion Electronics 단축키](https://help.autodesk.com/cloudhelp/ENU/Fusion-ECAD/files/ECD-KEYBOARD-SHORTCUTS.htm): `/` Command Line, `Ctrl+↓/↑`. **벤치마크 문서를 통해서만 확인했고 원문은 열람하지 않았다.**
- [C] [Chrome keyboard shortcuts](https://support.google.com/chrome/answer/157179?hl=en): 다른 브라우저는 별도 검사 대상.
- [M] [KeyboardEvent.isComposing](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/isComposing), [KeyboardEvent.code](https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code)

제품·버전·회로도/PCB 맥락이 서로 달라서 벤치마크의 '수렴 키'를 업계 공통 표준으로 표현하지 않는다. OrCAD X Presto의 PCB 키는 논리회로 CAD 기본키의 근거로 쓰지 않았다. PCB 전용 기능(Via, Route, Layer, Diff-pair, 3D, Measure)은 이번 범위에서 제외했다.
