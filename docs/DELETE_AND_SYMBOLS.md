# 삭제·꺾임점·기본 게이트 — 2026-10-16

사용자 요청에 따른 명시적 범위: 부품/배선 Delete, 배선 중 경유점 표시, 완성된 꺾임점 제거, 접속 판정 확대, AND 심벌 변경 및 OR/NOT 편집 부품 추가. 기존 Master Spec §9.3/13.4/13.5/14.3과 Command Registry를 따른다.

## 조작

- 부품/배선을 선택한 후 Delete 또는 오른쪽 **선택 삭제**. 다중 선택도 한 번에 삭제하며 한 번의 Undo로 전체 복원한다.
- 부품 삭제 시 선택하지 않은 외부 wire는 남기고, 삭제된 핀 끝을 미연결 끝점(빈 원)으로 표시한다. 동일 핀에 여러 wire가 붙었다면 공유한 endpoint를 하나만 만들어 기존 연결을 유지한다.
- 배선 중 클릭 경유점은 번호 있는 사각형으로 표시한다. Backspace는 마지막 점, Esc는 초안을 취소한다. 아직 회로와 history에는 포함하지 않는다.
- 완성된 배선 선택 → 사각 꺾임점 클릭 → 주황 강조 → Delete로 해당 점만 제거한다. 인접 고정점 사이를 반대 L 경로로 이어 직각을 유지한다. 다른 anchor 손실이나 부품 충돌이 있으면 오류를 안내하고 변경하지 않는다. 경우에 따라 대체 꺾임점이 생기며 전기 junction과 wire endpoint는 제거하지 않는다.
- 핀/junction은 13 screen px, wire는 12 screen px로 판정을 넓혔다. 가까운 직각 교차점(12px)은 동일 좌표에 후보를 모아 선택하기 쉽게 한다. 다중 후보 창의 명시적 접속 버튼 없이는 서로 다른 net을 합치지 않는다.
- AND는 D자, OR는 곡선, NOT은 삼각형/반전 원이다. 라이브러리에서도 같은 SVG를 표시한다. 기존 좌표와 회전 정책을 사용하며 OR 입력 2/출력 1, NOT 입력 1/출력 1이다. 시뮬레이션은 추가하지 않았다.

## 구조와 판단

`src/model/deletion.ts`는 clone에서 선택 wire를 제거하고 삭제 pin을 junction endpoint로 치환한 후, 남은 wire의 endpoint ID 인접 그래프로 net을 다시 분할한다. 좌표 일치로 연결하지 않는다. 새로 분리된 연결망에만 새 net ID를 주고 사용하지 않는 net/junction은 제거한다. assertCircuit 성공 후 Editor가 한 Command로 commit한다.

꺾임점 선택은 Editor-only `selectedCorner`이며 circuit/history에 저장하지 않는다. selection/tool 변경과 commit/Undo/Redo 시 정리한다. geometry의 removeWireCorner는 wire endpoint/net을 변경하지 않으며 다른 pinned anchor는 검증으로 보호한다. 사용자 승인에 따라 직각 유지에 필요한 이웃 비고정 꺾임점의 정리·대체와 핀 출입 방향 변경은 허용한다. 영향받지 않는 주변 구간은 유지하고 임의 전체 autoroute는 하지 않는다. 끝점·연결·다른 고정 경유점을 보존하지 못하거나 현재 충돌 정책에 어긋나면 거부하고, 한 번의 Undo로 원래 경로 전체를 복원한다.

GateBody는 SVG/native asset으로 구현했으며 이미지 생성이나 DOM 상태를 모델에 넣지 않았다. 새로운 심벌의 몸체도 기존 routing bounds 안에 두었다. 부품 수 증가로 창 전체가 스크롤되어 drop 좌표가 흔들리지 않도록 library를 독립 스크롤 패널로 만들었다.

## 검증

```sh
npm run build
npm test
npm run test:browser
git diff --check
```

단위 75개, 브라우저 63개: net 분할/공유 말단/다중 삭제/정확한 Undo·Redo/초안 보호/anchor 보존, gate 핀 방향과 회전, screen px snap과 명시적 crossing 접속, SVG/삭제 UI/입력 보호/마커/꺾임점 제거 및 기존 전체 회귀 테스트를 포함한다. 성능 수치나 사용성 검증 완료를 주장하지 않는다. 회로 파일 저장, clipboard, simulation은 여전히 별도 범위다.
