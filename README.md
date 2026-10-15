# Circlith

회로를 빠르게 그리고, 연결 상태를 이해하고, 실수를 복구할 수 있는 논리회로 시뮬레이션 CAD를 위한 설계 저장소입니다. 가장 중요한 평가 기준은 조작성입니다.

**설계와 구현의 유일한 기준은 [CIRCLITH_MASTER_SPEC.md](docs/CIRCLITH_MASTER_SPEC.md)입니다.** 다른 문서와 충돌하면 Master Spec을 우선합니다.

현재는 첫 편집 프로토타입 단계입니다. AND/Input/Output을 옆 부품 패널에서 도면으로 드래그해 배치하고, 접점을 클릭하거나 접점 간 드래그로 배선할 수 있습니다. 선택, 연결 유지 이동·회전, 직각 배선, Esc, Undo/Redo도 제공합니다. `CURRENT`는 현재 구현 기준이며, `PROVISIONAL`, `EXPERIMENTAL`, `DEFERRED`는 확정되거나 사용성이 검증된 기능을 뜻하지 않습니다.

Node.js 22.23.3 이상에서 `npm ci` 후 `npm run dev`로 실행합니다. `npm run build`, `npm test`, `npx playwright install chromium`, `npm run test:browser`로 검증합니다. 현재 회로는 메모리에만 유지되며 파일 저장·시뮬레이션은 후속 단계입니다.

공개 프로토타입: [GitHub Pages](https://caffentrager.github.io/Circlith/). `main` 또는 `feat/editor-prototype`에 push하면 단위·브라우저 테스트와 빌드 성공 후 GitHub Actions로 배포합니다. 로컬 개발은 `/`, Pages 빌드는 `/Circlith/` 경로를 사용합니다.

부품과 배선은 클릭으로 선택하고 Shift+클릭으로 추가·해제합니다. 선택 배선은 선분 드래그, 모서리 이동, 우회 구간 추가, 경로 다시 그리기와 가로/세로 우선 정리가 가능합니다. 양 끝 연결은 고정하며 수정 하나마다 Undo로 복구합니다. [배선 편집 사용법과 공식 문서 조사](docs/WIRE_EDITING.md)를 참고하세요.

선 위에서 `W`를 누르거나 배선 도구에서 선을 클릭하면 중간에서 분기합니다. 다른 핀·접속점·선 위에서 클릭/놓기로 연결하며, 분기점 생성과 연결망 합치기는 하나의 Undo로 복구됩니다. 점 없는 교차는 미접속입니다. 겹친 후보는 선택 창에서 구분하고, 명시적인 `이 교차점을 접속` 버튼으로 교차선을 합칠 수 있습니다. 부품 이동으로 생기는 공선 되접힘은 자동 정리하며 기존 접속점은 보존합니다.

빈 공간 좌클릭 드래그는 부품·배선 선택박스입니다. 기본 Circlith Modern은 짧은 우클릭 메뉴, Space+좌드래그/가운데 버튼 드래그 화면 이동입니다. 선택박스는 좌→우 전체 포함, 우→좌 교차 선택이며 Shift로 기존 선택에 추가합니다. `입력 설정`에서 8개 프리셋 선택·navigation 혼합·바인딩 수정·JSON 가져오기/내보내기가 가능합니다. 설정은 브라우저에 저장하며 회로는 저장하지 않습니다.

## 문서

- [Master Spec](docs/CIRCLITH_MASTER_SPEC.md): 제품 정의, 결정 레지스트리, 조작·입력·배선·시뮬레이션·저장·검증 기준.
- [편집 프로토타입 구현 기록](docs/EDITOR_PROTOTYPE.md): 구조, 범위, 잠정 설계 판단, 입력 매트릭스, 검증과 한계.
- [입력 프리셋 구현 기록](docs/INPUT_CONTROLS.md): 명령/resolver/dispatcher 경계, 프리셋 의미론, 사용자 설정, 검증과 미지원 명령.
- [배선 경로 편집](docs/WIRE_EDITING.md): 공식 문서 비교, 핸들·선분 드래그·경로 다시 그리기와 검증 범위.
- [이전 문서 목록](docs/archive/README.md): 통합 이전 계획, 단축키 제안, 검토 및 회신 이력.
- [업로드 전 정보 검토 기록](docs/INFORMATION_REVIEW.md): 제거한 정보와 검토 범위.

새로운 결정은 Master Spec의 관련 DEC 항목과 본문에 먼저 반영합니다. 별도 문서에서 충돌하는 최종값을 유지하지 않습니다. 다음 단계는 프로토타입 검증을 확대하고 분기·geometry edge case와 실제 Windows IME 입력을 확인하는 것입니다.
