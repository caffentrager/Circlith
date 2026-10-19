# Circlith 기능 갭 비판 목록 (타 CAD 대비)

- 작성일: 2026-10-19 · 대상: `codex/ui-workspace-refresh` 작업 트리 (HEAD `982bf5c` + 미커밋 UI 개편)
- 코드는 수정하지 않았다.

## 0. 증거와 한계

| 표기 | 의미 |
|---|---|
| **[코드]** | 이 저장소의 소스·문서를 읽고 확인 (`src/`, `docs/`) |
| **[문서]** | Master Spec/README가 "후속·DEFERRED"로 명시 |
| **[지식]** | 타 제품 기능은 제 제품 지식 기반. **이번 세션에서 각 제품 공식 문서를 다시 열람해 검증하지 않았다.** 제품별 버전에 따라 다를 수 있다 |

비교 대상: Logisim-evolution, Digital(hneemann), CircuitJS(Falstad), Tinkercad Circuits, Wokwi, Proteus, Multisim, LTspice, KiCad, Altium, EasyEDA, Fusion Electronics(Eagle), Quartus/Vivado 스키매틱.

**우선순위 기준** — Circlith의 정의("논리회로 시뮬레이션 CAD", 교육·프로토타입 성격, 조작성 우선)에 비추어:
- **P0**: 이게 없으면 반복 작업 도구로 못 씀 (저장·복사 등)
- **P1**: 논리회로 CAD라고 부르려면 있어야 함
- **P2**: 경쟁 제품 대비 차별 격차, 있으면 크게 유리
- **P3**: 범위 확장(PCB·아날로그·FPGA 등). 지금 안 만드는 게 맞을 수 있으나 "없다"는 사실은 기록

현재 상태 요약: 부품 9종(AND/OR/NOT/XOR/NAND/NOR/XNOR/Input/Output), 조합논리 4상태(0/1/X/Z) 시뮬레이션, 배선 편집, 입력 프리셋은 **이미 강하다**. 반면 **저장·클립보드·순차소자·텍스트·출력 장치는 전무**하다.

---

## A. 파일·프로젝트 (14)

| # | 없는 기능 | 타 CAD 사례 | 현재 상태 | 우선 |
|---|---|---|---|---|
| 1 | **회로 저장/열기 (파일)** | 전 제품 | 회로는 메모리에만 존재, 새로고침 시 소실 **[코드]** `localStorage`는 설정 3종만 | P0 |
| 2 | **자동 저장·충돌 복구** | Tinkercad, EasyEDA, Wokwi | 없음 | P0 |
| 3 | **미저장 변경 표시 + 종료 경고(beforeunload)** | 거의 모든 제품 | 없음. 헤더에 "메모리에서 편집 중"만 표시 | P0 |
| 4 | **새 프로젝트 / 다른 이름으로 저장 / 최근 파일** | 전 제품 | 없음 | P1 |
| 5 | **파일 포맷 버전·마이그레이션** | KiCad, Logisim | 입력 프로필 JSON만 버전 있음, 회로 포맷 없음 | P1 |
| 6 | **PNG 내보내기** | Logisim, CircuitJS, Digital | 없음 | P1 |
| 7 | **SVG 내보내기** | Logisim, Digital, KiCad | 없음 (렌더러가 SVG인데도 없음) | P1 |
| 8 | **PDF 출력 / 인쇄 설정(용지·축척·여백)** | KiCad, Altium, Logisim | 없음 | P2 |
| 9 | **타 도구 가져오기** (Logisim `.circ`, Digital `.dig`, CircuitJS 텍스트, KiCad 넷리스트) | Digital→Logisim 변환 등 | 없음 | P2 |
| 10 | **링크 공유 / 임베드 / 읽기 전용 뷰** | CircuitJS(URL 인코딩), Tinkercad, Wokwi | 없음 | P2 |
| 11 | **예제·템플릿 갤러리 (반가산기·SR 래치·4비트 가산기 등)** | Logisim, Digital, Tinkercad | 없음. 빈 도면 안내도 캔버스 위에 없음 | P1 |
| 12 | **프로젝트 메타데이터** (이름·작성자·날짜·리비전) | KiCad, Altium | 이름 입력칸이 있으나 어디에도 저장 안 됨 (UX 감사) | P1 |
| 13 | **클라우드 연동 (Drive 등)** | Tinkercad, EasyEDA, Wokwi | 조사 문서만 있음 **[문서]** `PAGES_DRIVE_STORAGE.md`, 미구현 | P3 |
| 14 | **버전 이력·스냅샷·diff** | Altium 365, Git 연동 KiCad | 없음. Undo 스택만 | P3 |

## B. 선택·편집 기본기 (22)

| # | 없는 기능 | 타 CAD 사례 | 현재 상태 | 우선 |
|---|---|---|---|---|
| 15 | **복사 (Ctrl+C)** | 전 제품 | `clipboard.copy` ID만 등록, **핸들러 없음** **[코드]** | P0 |
| 16 | **잘라내기 (Ctrl+X)** | 전 제품 | 위와 동일 | P0 |
| 17 | **붙여넣기 (Ctrl+V)** — 내부 연결 보존, 커서 위치에 배치 | 전 제품 | 위와 동일 | P0 |
| 18 | **복제 (Ctrl+D / Alt-드래그 복제)** | Figma식, Altium, Logisim | 없음 | P1 |
| 19 | **탭·창 간 / OS 클립보드 교환 (회로 텍스트 형식)** | KiCad, Altium | 없음 | P2 |
| 20 | **배열 붙여넣기 (N×M 복제, 간격 지정)** | Altium Paste Array | 없음. 8비트 회로를 그릴 때 치명적 | P1 |
| 21 | **방향키 미세 이동(넛지)** | 전 제품 | 핸들러 없음 **[코드]** (방향키 바인딩 grep 결과 없음) | P1 |
| 22 | **좌우/상하 반전(Mirror)** | KiCad X/Y, Altium, Eagle | `X`/`Y` DEFERRED **[문서]**. 회전만 가능 | P1 |
| 23 | **정렬·균등 분배** (좌/우/상/하/중앙) | Altium, Eagle, Figma | 없음 | P1 |
| 24 | **종류별/유사 선택, 같은 net 전체 선택, 선택 반전** | Altium "Select Similar", KiCad "Select Connected" | `selection.all`만 있음 | P1 |
| 25 | **연결된 net 전체 하이라이트(H) / 호버 시 net 강조** | KiCad, Altium, Digital | `H`/`Shift+H` DEFERRED **[문서]**. UX 감사가 1순위 개선으로 지적 | P1 |
| 26 | **부품 종류 교체** (NAND→AND, 연결 유지) | Altium Change, Eagle `CHANGE` | Properties는 이름·입력수·반전만 변경, 종류 변경 불가 **[코드]** | P1 |
| 27 | **다중 선택 일괄 속성 편집** | Altium Inspector, KiCad | 속성 창은 단일 부품 대상 | P2 |
| 28 | **속성 복사/서식 붙여넣기** | Altium Format Painter, Figma | 없음 | P3 |
| 29 | **인라인 이름 편집 (F2/더블클릭 라벨)** | Figma, Tinkercad | 모달 Properties만. 도면 트리에서도 이름 편집은 후속 **[문서]** | P1 |
| 30 | **부품 잠금/고정(Lock)** | Altium, Figma | 없음 | P3 |
| 31 | **스냅 정밀 제어** (격자 크기 변경, 핀/배선 스냅, 스냅 토글, 정렬 가이드선) | KiCad, Altium, Figma | 격자 표시 on/off만. 크기 설정 없음 | P1 |
| 32 | **자동 삽입: 부품을 배선 위에 놓으면 끼워넣기** | Logisim, CircuitJS, Altium | 없음 | P2 |
| 33 | **핀 근접 자동 연결 (붙이면 접속)** | Digital, Logisim | 명시적 배선만 | P2 |
| 34 | **자동 정리(Tidy up)/자동 배치·자동 배선** | Altium Autorouter, ELK 기반 도구 | 없음 | P2 |
| 35 | **배선 색·굵기·선 스타일 사용자 지정** | KiCad, Altium, Logisim(비트폭 색) | 값 기반 색만 | P2 |
| 36 | **Undo 히스토리 패널 (원하는 시점으로 점프)** | Fusion, Photoshop류, Altium | 선형 Undo/Redo만. UI는 "N committed edits" 숫자만 | P3 |

## C. 주석·텍스트·도면 문서화 (11)

| # | 없는 기능 | 타 CAD 사례 | 현재 상태 | 우선 |
|---|---|---|---|---|
| 37 | **텍스트 박스 / 메모 (`T`)** | 전 제품 (Logisim Text, Digital Text) | DEFERRED **[문서]** | P0 |
| 38 | **Net Label / 이름 붙은 배선(터널)** — 선을 이어 그리지 않고 같은 이름으로 연결 | KiCad, Altium, Logisim Tunnel, Digital Tunnel | `N` DEFERRED **[문서]**. 회로가 커지면 배선 지옥 | P1 |
| 39 | **전원·접지 심벌 (VCC/GND)** | 모든 EDA | 없음 | P1 |
| 40 | **오프시트 커넥터 / 포트** | KiCad Hierarchical Label, Altium Port | 없음 | P2 |
| 41 | **도형 주석** (선·사각형·원·화살표·이미지 삽입) | KiCad, Altium, Draw.io 류 | 없음 | P2 |
| 42 | **표제란(Title block) / 도면 테두리·용지 크기** | KiCad, Altium | 없음. 헤더의 "도면 01"은 클릭 불가 정적 라벨 | P2 |
| 43 | **치수·측정 도구 (눈금자, 거리 측정)** | Fusion, Altium | 없음 | P3 |
| 44 | **리뷰용 코멘트·핀 메모** | Altium 365, Figma, Wokwi 일부 | 없음 | P3 |
| 45 | **참조 지정자 자동 부여 (U1, G1…) / Annotate** | KiCad, Altium, Proteus | 이름이 `AND`, `AND2`, `AND 1` 세 가지로 불일치 (UX 감사) | P1 |
| 46 | **Net 이름 보기·편집 (신호 이름)** | KiCad, Altium, Digital | net은 내부 UUID뿐, 사용자에게 안 보임 | P1 |
| 47 | **교차 참조/찾기: 이름·net·핀으로 도면 내 검색 후 점프** | KiCad Find, Altium Navigator | 라이브러리 검색만. 도면 객체 검색 없음 | P1 |

## D. 부품 라이브러리 (논리/디지털) (27)

현재 부품: AND/OR/NOT/XOR/NAND/NOR/XNOR/Input/Output **9종뿐**. 즉 **버퍼조차 없다**.

| # | 없는 부품 | 타 CAD 사례 | 현재 상태 | 우선 |
|---|---|---|---|---|
| 48 | **버퍼 (비반전)** | 전 제품 | 없음 (NOT 두 개로 대체해야 함) | P1 |
| 49 | **트라이스테이트 버퍼 / 3-state 출력** | Logisim, Digital | **4상태에 Z가 있는데 Z를 만들 부품이 없음.** Input에서 Z를 수동 지정할 수밖에 | P1 |
| 50 | **상수 0/1 소스 (Constant)** | 전 제품 | Input을 고정값으로 쓰는 우회뿐 | P1 |
| 51 | **Clock 소스** | 전 제품 | 순차회로 후속 **[문서]** | P0 |
| 52 | **푸시버튼 / 토글 스위치 / DIP 스위치** | Tinkercad, Wokwi, Digital | Input 토글 하나뿐. 모멘터리 버튼 없음 | P1 |
| 53 | **LED (단일)** | Tinkercad, Wokwi, CircuitJS | Output 화살표만 | P1 |
| 54 | **7세그먼트(FND) 디스플레이** — 1자리/다자리, 공통 애노드·캐소드, 점(DP) | Logisim, Digital, Proteus, Tinkercad, Wokwi | **없음** | P1 |
| 55 | **FND 디코더 (7447/7448/7449, BCD→7seg)** | Proteus, Multisim, Digital | 없음 | P1 |
| 56 | **LED 바 그래프 / RGB LED** | Wokwi, Tinkercad | 없음 | P2 |
| 57 | **도트 매트릭스(8×8 등) / LCD1602 / OLED** | Wokwi, Proteus | 없음 | P2 |
| 58 | **Hex/10진 숫자 표시기** (버스 값을 숫자로) | Logisim Hex Digit, Digital | 없음 | P2 |
| 59 | **D / JK / T 플립플롭, SR/D 래치** | 전 제품 | 순차소자 전무. 로드맵만 있음 **[문서]** `LOGIC_FORGE_ADOPTION` | P0 |
| 60 | **레지스터, 시프트 레지스터, 카운터 (2진/BCD/링/존슨)** | Logisim, Digital | 없음 | P1 |
| 61 | **Mux / Demux** | 전 제품 | 없음 | P1 |
| 62 | **Decoder / Encoder / 우선순위 인코더** | 전 제품 | 없음 | P1 |
| 63 | **반가산기·전가산기·N비트 가산/감산기, 비교기, ALU** | Logisim, Digital | 없음. 사용자가 게이트로 직접 조립해야 함 | P1 |
| 64 | **ROM / RAM / 룩업 테이블 + 헥스 에디터** | Logisim, Digital | 없음 | P2 |
| 65 | **74xx / 40xx IC 라이브러리 (7400, 7404, 7474, 74LS138 …) + 핀번호** | Proteus, Multisim, Logisim | 없음. 실제 부품 번호로 설계 불가 | P1 |
| 66 | **다중 비트 와이어/버스 + 스플리터/머저** | Logisim, Digital, KiCad Bus | `B` Bus DEFERRED **[문서]**. 신호는 1비트뿐 | P1 |
| 67 | **풀업/풀다운 저항, 오픈 컬렉터 / 와이어드-AND** | Logisim, CircuitJS | 없음 | P2 |
| 68 | **지연 소자 / 게이트별 전파 지연 속성** | Digital, Logisim | 지연 모델 없음 **[문서]** | P2 |
| 69 | **키보드·TTY·난수 생성기·입력 장치** | Logisim | 없음 | P3 |
| 70 | **사용자 정의 부품 편집기 (심벌 그리기 + 핀 정의)** | KiCad Symbol Editor, Altium, Eagle | 없음 | P2 |
| 71 | **서브회로 / 계층 / 모듈화 (회로를 부품으로 포장)** | Logisim, Digital, KiCad 계층 시트 | DEFERRED DEC-012 **[문서]**. 규모 큰 회로의 사실상 필수 | P1 |
| 72 | **라이브러리 관리자 (가져오기·내보내기·공유)** | KiCad, Altium | 없음 | P2 |
| 73 | **즐겨찾기 / 최근 사용 부품** | Altium, Eagle | DEFERRED **[문서]** | P2 |
| 74 | **게이트 심벌 표준 전환 (ANSI 모양 ↔ IEC 사각형)** | Logisim, Digital, KiCad | ANSI 모양 하나 | P2 |

## E. 시뮬레이션 (조합논리를 넘어) (20)

| # | 없는 기능 | 타 CAD 사례 | 현재 상태 | 우선 |
|---|---|---|---|---|
| 75 | **순차 시뮬레이션 (엣지·상태)** | 전 제품 | 후속 **[문서]**. 자기 피드백/SR 래치는 X로 처리 **[코드]** 즉 기억 회로를 못 그림 | P0 |
| 76 | **실행 제어: Run / Pause / Step / Reset / 속도 슬라이더** | Logisim, Digital, CircuitJS | DEFERRED DEC-013 **[문서]** | P0 |
| 77 | **파형 뷰어 / 타이밍 다이어그램** | Logisim Chronogram, Digital, Wokwi, Proteus | 없음 | P0 |
| 78 | **VCD / CSV 파형 내보내기** | Digital, Logisim, Quartus | 없음 | P2 |
| 79 | **프로브 / 와치 신호 (`P`)** | Digital, Proteus | DEFERRED **[문서]**. 현재는 배선 위 값 문자 | P1 |
| 80 | **로직 애널라이저 / 오실로스코프 부품** | Proteus, Tinkercad, Wokwi, CircuitJS | 없음 | P2 |
| 81 | **진리표 자동 생성 (회로 → 표)** | Logisim "Combinational Analysis", Digital | 없음. 4상태 엔진은 있는데 전수 열거 기능이 없음 | P1 |
| 82 | **진리표/불 대수식 → 회로 합성** | Logisim, Digital | 없음 | P1 |
| 83 | **불 대수식 표시 (출력의 논리식)** | Logisim, Digital | 없음 | P2 |
| 84 | **카르노 맵 / Quine–McCluskey 최소화** | Logisim, Digital, 교육용 도구 | 없음 | P2 |
| 85 | **테스트벤치 / 테스트 벡터 / 자동 검증** | Digital Test Case, Logisim Test Vector | 사용자 테스트벤치 후속 **[문서]**. 자체 단위테스트(409개)는 개발용이지 사용자 기능 아님 | P1 |
| 86 | **전파 지연·임계 경로·타이밍 분석** | Quartus TimeQuest, Vivado | 없음 | P2 |
| 87 | **글리치/해저드 감지** | 교육용 도구, 일부 EDA | 없음 | P3 |
| 88 | **결함 주입 (stuck-at-0/1)** | 테스트 공학 도구 | 없음 | P3 |
| 89 | **동치 검사 (두 회로 동일 기능 비교)** | 교육 도구, 형식검증 도구 | 없음 | P3 |
| 90 | **초기 상태 지정·시뮬레이션 스냅샷 저장/복원** | Digital, Proteus | 입력값만 세션 유지, 저장 불가 | P2 |
| 91 | **조합 피드백의 실제 안정화 (발진/래치 판정)** | Logisim 오실레이션 검출, CircuitJS | 순환은 전부 X로 포기 **[코드]** `docs/SIMULATION.md` | P1 |
| 92 | **대규모 회로 성능 (컴파일형/이벤트 큐/Web Worker)** | Digital 고속 모드 | 대형 배선 성능 측정 안 됨 (UX 감사 한계 5). 매 변화 전체 재계산 | P2 |
| 93 | **아날로그 시뮬레이션 (SPICE: R/C/L/다이오드/트랜지스터/연산증폭기)** | CircuitJS, LTspice, Multisim, Tinkercad | 범위 밖 선언 ("실제 IC의 전압·지연 모델링 안 함") | P3 |
| 94 | **혼합 신호 (ADC/DAC, PWM)** | Proteus, Wokwi | 없음 | P3 |

## F. MCU · HDL · FPGA · 실제 하드웨어 (14)

| # | 없는 기능 | 타 CAD 사례 | 현재 상태 | 우선 |
|---|---|---|---|---|
| 95 | **MCU 가상 보드 (Arduino Uno/Nano, ESP32, RP2040, STM32)** | Wokwi, Tinkercad, Proteus | 없음 | P3 |
| 96 | **MCU 프로그래밍: 코드 에디터 + 컴파일 + 펌웨어 로드 + 실행** | Wokwi, Tinkercad Code, Proteus VSM | 없음 | P3 |
| 97 | **시리얼 모니터 / UART 터미널** | Wokwi, Tinkercad, Proteus | 없음 | P3 |
| 98 | **GPIO·핀 매핑 (MCU 핀 ↔ 회로 net)** | Wokwi, Proteus | 없음 | P3 |
| 99 | **Verilog/VHDL 내보내기 (회로 → HDL)** | Logisim, Digital, Quartus 스키매틱 | 없음 | P2 |
| 100 | **HDL 모듈 가져오기·내장 HDL 부품** | Digital(Verilog 연동), Logisim, Vivado | 없음 | P3 |
| 101 | **FPGA 흐름: 핀 제약 파일(XDC/QSF), Yosys/Quartus/Vivado 프로젝트 내보내기, 비트스트림** | Digital(FPGA 보드 내보내기), Quartus, Vivado | 없음 | P3 |
| 102 | **어셈블러 / 프로그램 로더 (직접 만든 CPU의 ROM 적재)** | Logisim, Digital | 없음 (ROM 자체가 없음) | P3 |
| 103 | **Arduino 스케치 내보내기 / 실제 보드 업로드 (WebSerial/WebUSB)** | Tinkercad→Arduino IDE, Wokwi | 없음 | P3 |
| 104 | **브레드보드 뷰 (물리 배선 보기)** | Tinkercad, Fritzing | 없음. 스키매틱 단일 뷰 | P3 |
| 105 | **PCB 레이아웃·풋프린트·DRC·Gerber** | KiCad, Altium, EasyEDA | 의도적 범위 밖. 단 EasyEDA/KiCad 입력 프리셋을 넣어둔 만큼 이용자 기대치는 생김 | P3 |
| 106 | **BOM(부품표) 출력** | KiCad, Altium, EasyEDA, Proteus | 없음 | P2 |
| 107 | **3D 보기** | KiCad, Altium, EasyEDA | 없음 | P3 |
| 108 | **회로 → 넷리스트 (KiCad .net, SPICE, EDIF) 내보내기** | 전 EDA | 내부 net 모델은 있으나 내보내기 없음 | P2 |

## G. 검증·진단 (6)

| # | 없는 기능 | 타 CAD 사례 | 현재 상태 | 우선 |
|---|---|---|---|---|
| 109 | **편집 모드 ERC (전기 규칙 검사)** — 미연결 핀, 다중 구동, 이름 중복 | KiCad ERC, Altium | 진단은 **시뮬레이션 모드 전용** **[코드]** `simulationAvailable` | P1 |
| 110 | **ERC 규칙 설정 (심각도·무시·마커 고정)** | KiCad, Altium | 없음 | P2 |
| 111 | **문제 패널: 필터/정렬/무시/수정 제안** | KiCad, Altium Messages | 진단 도크 있으나 단순 목록 | P2 |
| 112 | **서로 다른 net이 겹친 배선 감지** | Altium 겹침 검사, KiCad | 재현된 Critical 결함, 진단 0개 (UX 감사 #1) | P1 |
| 113 | **회로 통계 (게이트 수·논리 깊이·fan-in/out)** | Quartus, Digital | 부품/배선 개수 수준 | P2 |
| 114 | **Net/핀 목록 뷰어 (Navigator)** | Altium Navigator, KiCad Net Navigator | 도면 트리는 있으나 net 단위 이름·핀 목록 없음 | P2 |

## H. UI·접근성·협업 (13)

| # | 없는 기능 | 타 CAD 사례 | 현재 상태 | 우선 |
|---|---|---|---|---|
| 115 | **명령 팔레트 (Ctrl+K)** | Figma, VS Code, KiCad(일부), Fusion | `commandPalette.open` ID만 등록, 핸들러 없음 **[코드]** | P1 |
| 116 | **풍부한 우클릭 메뉴** (복사·붙여넣기·반전·속성 등) | KiCad, Altium | "짧은" 메뉴만 | P1 |
| 117 | **다크 모드 / 테마 / 고대비** | KiCad, Altium, Wokwi | 없음. CSS에 `prefers-color-scheme` 없음 **[코드]** | P2 |
| 118 | **다국어(i18n) 전환** | KiCad, Altium | 한국어·영어·약어 혼재 (`N committed edits` 등) | P2 |
| 119 | **접근성: 스크린리더, 폰트 크기 조절, 키보드 전용 배선** | 일부 | 글자의 71%가 11px 이하 (UX 감사). 스크린리더 미검증 | P1 |
| 120 | **터치·펜·모바일 편집** | Tinkercad, Wokwi, EasyEDA | DEFERRED **[문서]** | P2 |
| 121 | **튜토리얼 / 온보딩 / 실습 과제 모드** | Tinkercad, Logisim 튜토리얼, Digital 예제 | 없음. 첫 화면 안내 없음 | P1 |
| 122 | **단축키 치트시트 오버레이, 툴팁 체계, 도움말 검색** | Figma `?`, KiCad | 힌트 일부만 | P2 |
| 123 | **패널 크기 조절·도킹·레이아웃 저장** | Altium, KiCad, Fusion | 고정 폭 (좌 240 / 우 292) | P2 |
| 124 | **미니맵 / 영역 줌 / 줌 이력** | Figma, Altium | 맞춤·줌만 | P3 |
| 125 | **상태바 커서 좌표·단위** | KiCad, Altium, Eagle | 도구·줌·선택수만. 좌표 표시 없음 **[코드]** `StatusBar.tsx` | P2 |
| 126 | **실시간 공동 편집** | EasyEDA Pro, Altium 365, Figma, Tinkercad | 없음 | P3 |
| 127 | **오프라인 사용 (PWA/Service Worker)** | Logisim/Digital는 데스크톱 앱이라 해당 | 웹앱이면서 오프라인 지원 없음 | P2 |

---

## 요약 통계

| 우선순위 | 개수 | 성격 |
|---|---|---|
| P0 | 12 | 저장·자동저장·미저장 경고(1~3), 복사/잘라내기/붙여넣기(15~17), 텍스트(37), Clock(51), 플립플롭(59), 순차 시뮬(75), 실행 제어(76), 파형(77) |
| P1 | 약 46 | 편집 기본기(미러·정렬·넛지), 부품(버퍼·상수·FND·Mux·가산기·74xx), 버스, 서브회로, 진리표/합성, ERC |
| P2 | 약 44 | 내보내기·가져오기, 라이브러리 관리, 테마, 성능 |
| P3 | 약 25 | MCU/FPGA/PCB/아날로그/협업 등 범위 확장 |
| **합계** | **127** | |

## 비판적 코멘트

1. **"없는 것"의 상당수는 이미 인지된 것이다.** 24건 가량이 Master Spec의 DEFERRED이거나 키 예약만 된 상태(Net Label, Text, Mirror, Probe, Bus, Net highlight, Group). 새 발견이라기보다 **우선순위를 못 정한 채 쌓인 부채**다.
2. **가장 치명적인 모순은 "명령은 있는데 기능은 없다"는 점.** `clipboard.copy/cut/paste`, `commandPalette.open`은 명령 레지스트리에 등록되어 입력 프리셋(KiCad/Altium 등)에서 키까지 매핑되지만 App에 핸들러가 없다. KiCad 프리셋으로 바꾼 사용자가 Ctrl+C를 눌러도 아무 일도 안 일어난다. 프리셋 8개를 지원한다고 광고하는 것과 모순된다.
3. **4상태(Z)를 만들 부품이 없다.** 시뮬레이터는 Z와 다중 구동을 정교하게 진단하지만, 트라이스테이트 버퍼가 없어 정상적인 버스 공유 회로를 그릴 수 없다. 엔진 능력이 부품 라이브러리를 앞서 있다.
4. **엔진은 앞서가고 사용자 기능은 뒤처진다.** 단위 테스트 409개, 입력 프리셋 8종, 배선 편집 정밀도는 경쟁 제품보다 낫거나 비슷하다. 하지만 파일을 저장할 수 없고 복사도 못 하고 텍스트도 못 쓰는 도구는, 배선 UX가 아무리 좋아도 **한 번의 데모 이상으로 쓰이기 어렵다.**
5. **경쟁 제품과의 현실적 거리.** Logisim-evolution/Digital 수준(교육용 디지털 로직)이 현실적인 1차 목표다. 해당 도구에 있고 Circlith에 없는 것은 위 A~E의 P0–P1 약 60건으로 압축된다. MCU/FPGA/PCB(F, 일부 E)는 Wokwi/KiCad가 이미 잘하는 영역이라 **당장 따라가면 정체성이 흐려진다.**
6. **MCU 프로그래밍은 사실상 별도 제품이다.** AVR/ARM 에뮬레이터, 툴체인(컴파일), 주변장치 모델링이 필요하다. 하려면 자체 개발보다 Wokwi 같은 기존 엔진 연동/임베드가 현실적이다.

## 이 목록에서 의도적으로 뺀 것

- 이미 구현된 것: 선택 박스(교차/포함), 배선 편집, 점프(교차 표시), 입력 프리셋·JSON 가져오기, 부품 검색, 도면 트리, Select All, Undo/Redo, Delete, 회전.
- 개발 인프라(CI, 배포): 사용자 기능이 아니라서 제외.
- 사용자 요청이 없는 순수 상상 기능.

---

## I. 확정 우선순위 (구현 순서)

위 P0~P3은 "얼마나 중요한가"이고, 이 절은 "무엇부터 만드는가"다. 정렬 기준은 ① 되돌릴 수 없는 손실·오동작 먼저, ② 다른 기능의 기반이 되는 것 먼저, ③ 엔진이 이미 지원하는데 UI/부품만 없는 것(저비용) 먼저, ④ 정체성(논리회로 교육·설계 CAD)에서 먼 것은 마지막이다. 기준 목표는 **Logisim-evolution/Digital 수준**이다.

### 순서 변경 사항 (위 표 대비)

| 항목 | 변경 | 이유 |
|---|---|---|
| #112 서로 다른 net 배선 겹침 | P1 → **최상위** | 기능 부재가 아니라 **회로가 틀리게 읽히는 결함**. 시뮬 값이 선 위에서 1/X로 번갈아 보임 |
| #91 조합 피드백 안정화 | P1 → **순차 단계 뒤** | 래치/FF 부품이 생기면 대부분 해결되고, 남는 건 교육용 경고 정도 |
| #15–17 클립보드 | P0 유지, **저장 직후** | 직렬화 코드를 공유 |
| #54 FND | P1 → **부품 1차 묶음** | 새 엔진 기능 없이 8핀 출력 장치로 구현 가능, 사용자 요청 |
| #95–98 MCU | P3 → **계획 제외(연동 검토)** | 에뮬레이터·툴체인이 필요한 별개 제품 |

### 단계

| 단계 | 내용 (항목 #) | 선행 조건 | 규모 | 완료 기준 |
|---|---|---|---|---|
| **S0 정확성** | 겹친 net 배선 검출·경고 (112), 편집 모드에서도 진단 표시 (109) | 없음 | 소 | 2입력×2게이트 재현 회로에서 경고 발생, 진단 0개 상태 소멸 |
| **S1 영속성** | 회로 직렬화 포맷+버전 (5), 파일 저장/열기 (1,4), 자동저장·복구 (2), 미저장 표시·종료 경고 (3), 프로젝트 메타 (12) | S0과 병행 가능 | 중 | 새로고침·재열기 후 회로 동일(전기 그래프 `electricalGraph` 동일), 손상 파일은 현재 작업을 건드리지 않고 거부 |
| **S2 클립보드** | 복사·잘라내기·붙여넣기 (15–17), 복제 (18), 방향키 넛지 (21), 우클릭 메뉴 연결 (116) | S1 직렬화 | 중 | 선택 부분 회로의 내부 연결 보존, 외부 연결은 끊김, 붙여넣기 1회 = Undo 1회, KiCad/Altium 프리셋의 Ctrl+C가 실제 동작 |
| **S3 부품 1차** | 버퍼 (48), 상수 (50), 트라이스테이트 (49), LED (53), **FND (54)**, 푸시버튼/DIP (52), 참조 지정자 (45) | S1 (포맷에 종류 추가) | 중 | 기존 4상태 엔진·진단과 일관, Z를 만드는 정상 경로 생김 |
| **S4 문서화** | 텍스트 박스 (37), Net Label/터널 (38), 전원·접지 (39), net 이름 (46), 객체 검색 (47), 예제 갤러리 (11) | S1 | 중~대 | Net Label은 net 모델 변경이므로 별도 설계 문서 먼저 |
| **S5 순차 시뮬** | Clock (51) → DFF·세션 상태 (59,75) → Step/Run/Pause/Reset (76) → 파형 (77) → JK/T/래치/레지스터/카운터 (59,60) | S3, [Logic Forge 도입 제안](LOGIC_FORGE_ADOPTION_20261019.md) | **대** | 직렬 2단 FF 시프트, 부품 등록 순서 불변, 동시 엣지 결정성 |
| **S6 분석 도구** | 진리표 생성 (81), 식→회로 합성 (82), 불 대수식 (83), 테스트벤치 (85), 프로브/와치 (79), VCD (78) | S5 일부(프로브·VCD), 나머지는 S3만 있으면 가능 | 중 | 진리표 전수 열거가 기존 시뮬 엔진과 일치 |
| **S7 구조화** | 버스·스플리터 (66), 서브회로 (71), Mux/Decoder/가산기/비교기 (61–63), 7447 등 FND 디코더 (55), 74xx 라이브러리 (65) | S5, S4 | 대 | 8비트 회로를 서브회로 하나로 재사용 |
| **S8 편집 고급** | 미러 (22), 정렬 (23), 유사 선택·net 선택 (24), net 하이라이트 (25), 부품 종류 교체 (26), 스냅 설정 (31), 배열 붙여넣기 (20) | S2 | 중 | 각각 독립, 아무 때나 끼울 수 있음 |
| **S9 출력·접근성** | PNG/SVG/PDF (6–8), Verilog·넷리스트 (99,108), 명령 팔레트 (115), 튜토리얼 (121), 테마·i18n·접근성 (117–119), 상태바 좌표 (125), 패널 크기 (123) | S1 | 중 | — |
| **보류** | MCU (95–98,103), FPGA (101), PCB·3D·BOM (105–107), SPICE (93,94), 실시간 협업 (126), 클라우드 (13,14) | — | — | 정체성과 거리가 멀다. MCU만 Wokwi 연동 가능성 별도 검토 |

### 바로 시작할 때 권장 묶음

1. **첫 PR: S0 + S1** — 저장이 없으면 이후 모든 단계의 테스트·시연 비용이 커진다. 포맷에 `version` 필드를 처음부터 넣을 것.
2. **둘째 PR: S2** — 이미 등록된 명령의 핸들러를 채우는 일이라 입력 프리셋 약속과 실제 동작의 모순을 해소한다.
3. **셋째: S3 → S5** — S3이 S5의 입력(Clock/버튼)·출력(LED/FND) 부품을 먼저 깔아 준다.

### 하지 않기로 한 것 (이유)

- **S5 전에 서브회로(S7)를 하지 않는다.** 서브회로는 포트·내부 상태 경계를 정의해야 하는데 순차 상태 모델이 없으면 다시 만들게 된다.
- **S1 전에 Net Label(S4)을 하지 않는다.** 포맷이 정해지기 전에 net 모델을 바꾸면 마이그레이션 비용이 생긴다.
- **MCU를 지금 계획에 넣지 않는다.** 위 S0~S9가 끝난 뒤에도 필요하면 그때 연동 방식을 정한다.
