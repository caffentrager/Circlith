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

1. 선을 클릭하면 선택된다. Shift+클릭은 추가·해제, 빈 공간은 선택 해제, Ctrl+A는 부품·배선 전체 선택이다. 좌→우 선택박스는 경로 전체 포함, 우→좌는 실제 선분 교차다.
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

공선점 제거는 사용자가 선택한 경로 편집에만 적용하며 기존 부품 Safe Move 정책을 변경하지 않는다. 장애물 회피 autorouter, 교차 자동 접속, 분기 생성, endpoint 재연결, 전기적 삭제는 제공하지 않는다. 경로가 다른 선·부품과 겹치는 것을 피하는 작업은 사용자가 맡는다. 회로 파일 저장·자동 복구·시뮬레이션은 여전히 후속이다.
