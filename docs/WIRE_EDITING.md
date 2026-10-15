# 배선 선택·경로 편집

기준: [Master Spec §12.5](CIRCLITH_MASTER_SPEC.md). 조사·구현일: 2026-10-15.

## 공식 문서 조사와 채택 판단

| 참고 | 확인한 조작 | Circlith에 적용한 판단 |
|---|---|---|
| [KiCad 9 Schematic Editor](https://docs.kicad.org/9.0/en/eeschema/eeschema.html#selection-and-the-selection-filter) | 클릭 선택, 방향에 따른 영역 선택, Esc 취소, 연결 유지 Drag와 연결을 끊는 Move의 구분 | 선택·Shift·영역 선택을 유지하고 경로 편집은 연결을 보존 |
| [Altium Schematic Placement & Editing](https://www.altium.com/documentation/altium-designer/schematic/placement-editing-techniques) | 선택 시 편집 핸들, 핸들 드래그, 연결 유지 Drag, 직각 배선 모드 | 선분과 모서리에 직접 조작 핸들, 양 끝 고정·직각 미리보기 |
| [EasyEDA Wiring Tools](https://docs.easyeda.com/en/Schematic/Wiring-Tools/index.html) | 선택한 선의 꼭짓점 핸들, 가상 노드를 끌어 실제 노드 생성 | 선분 중앙 원은 이동, 마름모는 국소 우회 구간 추가 |

반복 작업에서 도구 전환을 줄이고 편집 결과를 미리 볼 수 있다는 판단으로 위 기능을 우선했다. 실제 사용자 비교 측정으로 가장 빠르다고 입증한 결과는 아니다. 제품별 키·연결 규칙 전체를 복제하지 않는다.

## 사용법

1. SELECT 도구에서 선을 클릭하면 선택된다. Shift+클릭은 추가·해제, 빈 공간은 선택 해제, Ctrl+A는 부품·배선 전체 선택이다. 좌→우 선택박스는 경로 전체 포함, 우→좌는 실제 선분 교차다. WIRE 도구의 선 클릭은 분기를 시작하므로 편집하려면 V 또는 Esc로 SELECT에 복귀한다.
2. 선분 자체나 **원형 핸들**을 끌면 수평선은 위아래, 수직선은 좌우로 이동한다. 양 끝 핀은 고정되고 필요한 직각 연결 구간이 추가된다.
3. **사각 핸들**은 모서리를 옮긴다. 인접 선분도 직각을 유지하며 따라온다.
4. **마름모 핸들**을 선 바깥으로 끌면 중간에 우회 구간을 추가한다. 30 도면 단위 이상이고 화면상 65px 이상인 선분에 표시한다.
5. 선 하나를 선택하고 **경로 다시 그리기**를 누른다. 빈 공간 클릭은 경유점 추가, Shift+Space는 꺾임 방향 전환, Backspace는 마지막 경유점 제거다. Enter, 원래 끝 핀 클릭 또는 **경로 수정 완료**로 확정한다. 끝 핀은 바뀌지 않는다.
6. **가로 우선 정리 / 세로 우선 정리**는 선택한 배선의 경유점을 없애고 양 끝을 최소 직각 경로로 연결한다. 여러 선을 함께 선택해 일괄 적용할 수 있다.
7. 드래그는 놓으면 확정, Esc는 취소, Ctrl+Z/Ctrl+Y는 Undo/Redo다. 한 번의 경로 수정은 한 Undo다. 초안 중 Ctrl+Z는 초안만 취소한다.

핸들은 zoom과 무관한 화면 크기를 유지한다. 핀 직접 배선과 Space/가운데 버튼 Pan은 기존 동작을 유지한다. 안정된 다시 그리기 초안은 Pan·Tab 동안 유지하고 실제 드래그는 Tab·창 비활성·캡처 상실·pointercancel·도면 밖 release에서 취소한다.

## 구현과 한계

- `geometry/wire-edit.ts`: 순수 선분·모서리·우회 geometry, 공선점 정리, endpoint·유한 좌표·직각 검증.
- `Editor`: `SEGMENT_MOVE`와 `WIRE_ROUTE` 초안, snapshot 기반 확정·Undo. UI가 committed 경로를 직접 수정하지 않는다.
- `WireHandles.tsx`: 선택 배선의 화면 크기 일정한 핸들.
- `CommandDispatcher`: `wire.editPath`, `wire.reroute`, `wire.tidyHorizontal`, `wire.tidyVertical`. 버튼과 포인터가 같은 명령을 호출하며 입력 설정에서 명령에 키를 배정할 수 있다.
- `electricalGraph()`는 wire ID·net·from/to도 포함해 경로 변경이 endpoint 연결을 바꾸면 검출한다.

공선점 제거는 부품 Move/Rotate와 배선 경로 편집 모두에 적용한다. 명시적 분기와 교차점 접속은 아래 transaction으로 구현한다. 장애물 회피 autorouter, 교차 자동 접속, 기존 wire endpoint 재연결, 전기적 삭제는 제공하지 않는다. 경로가 다른 선·부품과 겹치는 것을 피하는 작업은 사용자가 맡는다. 회로 파일 저장·자동 복구·시뮬레이션은 여전히 후속이다.

## 배선 기능 재검토 — 분기와 연결망

2026-10-15 사용자 보고를 반영했다. 기준은 Master Spec §12.2/13.5다.

| 공식 자료 | 확인한 동작 | 적용 |
|---|---|---|
| [KiCad 9 Wires](https://docs.kicad.org/9.0/en/eeschema/eeschema.html#wires) | 선 끝을 선·핀에 붙여 연결하며 중간 교차는 미접속. 연결 여부를 접속 표시로 구분 | 명시적 시작·끝 접속만 회로를 변경하고 연결된 핀을 채운 원으로 표시 |
| [Altium Circuit Connectivity](https://www.altium.com/documentation/altium-designer/schematic/creating-circuit-connectivity) | T분기 junction, junction에서 선분 분할 옵션 | 확정 시 원래 선을 분할하고 실제 junction을 생성 |
| [EasyEDA Pro Junction Flag](https://prodocs.easyeda.com/en/schematic/place-junction-flag/) | 교차점에 별도 junction을 놓아 접속으로 변경 | 겹친 후보 창에서 별도 교차점 접속 버튼 제공. 단순 더블클릭으로 합치지 않음 |

출처는 조작의 선례다. 제품별 자동 접속·키 동작을 그대로 복제하거나 사용성 우위를 실측했다고 주장하지 않는다.

| 검토 영역 | 수정·유지한 동작 | 검증 |
|---|---|---|
| 공선 되접힘 | 중복점·공선 왕복을 O(n) 스택으로 정리. 이동·회전·경로 편집이 공통 함수를 사용 | 사용자 사례 좌표, 실제 부품 드래그, 연결·Undo 보존 |
| 시작/종료 | 핀↔선, junction↔핀, 선↔선. 선 위 W, 분기 버튼, WIRE의 선 클릭 | 클릭·드래그 및 기존 직접 핀 배선 회귀 |
| 분할·병합 | 시작선/끝선 분할, junction 생성과 net 병합을 원자적으로 확정. 같은 선을 두 번 자를 때도 원래 선의 분할 계보만 추적 | 양방향 같은 선 연결·다른 net 병합·원본 ID 복원 |
| 교차·모호성 | 겹친 후보를 선택. 한 선만 고르거나 명시적으로 내부 교차 전체를 접속 | 후보 취소 시 초안 유지, 한 선 선택 시 다른 net 보존 |
| 피드백 | 최근접 핀/접속점 → 선분 우선, 링/문자 안내, 예정 junction, 실제 dot, 연결 pin 채움, 도구 활성 표시 | 50/100/200% 화면 거리, 실제 UI 캡처 검토 |
| 취소·복구 | 초안에는 회로 변경 없음. 전체 접속은 1 Undo. Tab/캡처 상실/blur는 drag만 rollback | 기존 편집/취소/Redo 및 분기 회귀 |
| 연결망 검사 | 실제 endpoint 인접 그래프와 net 구성원 일치, 참조·ID·유한 좌표·직각·고정 endpoint 검증 | 잘못된 net·배선 밖 접속·단선된 net 거부 |

### 분기와 합치기 사용법

1. **선에서 시작:** 선 위 W, WIRE 도구에서 선 클릭, 또는 선 하나를 선택하고 `이 선에서 분기`를 누른다. 원래 선은 아직 변경되지 않고 예정 분기점만 나타난다. 수평선에서는 세로로, 수직선에서는 가로로 출발하는 꺾임을 기본으로 한다.
2. **선에 연결:** 배선 초안 중 다른 선을 클릭하거나 핀에서 선까지 끌어 놓는다. 확정할 때 필요한 선 분할·junction·연결망 병합을 함께 수행한다. 가까운 기존 끝점·junction은 재사용한다.
3. **교차점:** WIRE 도구/선 위 W로 겹친 후보를 열고 연결할 선을 선택한다. 배선 초안이 없는 내부 교차점에서는 `이 교차점을 접속`으로 해당 선들을 한 점에 합칠 수 있다. 초안 종료 후보 창에서는 한 선만 선택한다.
4. **접속 확인:** 실제 junction은 채운 점, 시작선의 미확정 junction은 점선 원이다. 연결된 pin은 채운 원이다. `연결망 전체 선택`은 같은 net의 분할 구간을 모두 선택한다. 후보 창은 연결망 번호와 양 끝 이름으로 선을 구분한다.
5. **취소:** 후보 선택 창에서 Esc는 창만 닫는다. 이어서 Esc를 누르면 배선 초안을 취소한다. Undo 한 번으로 새 선과 양쪽 분할·접속점·병합 이전 net까지 복원한다.

공선 정규화는 **한 wire 안에서만** 수행한다. junction은 wire endpoint로 분리되어 실제 분기를 삭제하지 않는다. unrelated net을 좌표로 합치거나 임의로 말단 가지를 삭제하지 않는다.

이미 연결된 두 핀이 이동으로 같은 좌표에 겹치면 wire는 한 점의 경로로 접힐 수 있다. 논리 연결을 유지하고 다시 분리해 이동하면 직각 경로로 복원한다. 이 경우 길이 0인 선분을 새로 생성하지 않는다.

### 현재 검증 결과

2026-10-15 Windows / Node.js 24.19.0 / Playwright Chromium 156: 빌드, 단위 테스트 40개, 브라우저 테스트 36개 통과. 새 연결 transaction·공선 되접힘·끝점 겹침 복원, 시작/종료선 분할과 같은 선 재분할, 네트워크 병합·후보 선택·취소·Undo/Redo, 50/200% 조작을 포함한다. 브라우저 캡처로 새 접속점·핀 상태·도구 활성·도움말 배치를 확인했다. UI 검증이 실제 사용자 사용성 비교를 대신하지 않는다.

미측정/후속: 실제 Windows IME 세션, 대규모 pointer 처리 성능, 사용성 비교, 교차 우회 기호·겹침 경고, 장애물 회피, 자동 중복 배선 정리, junction 자체 이동, 기존 endpoint 재연결·삭제와 파일 저장. 검증기는 현재 모델의 접속 transaction용이며 파일 형식 검증 완료를 뜻하지 않는다.
