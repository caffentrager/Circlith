# Circlith

회로를 빠르게 그리고, 연결 상태를 이해하고, 실수를 복구할 수 있는 논리회로 시뮬레이션 CAD를 위한 설계 저장소입니다. 가장 중요한 평가 기준은 조작성입니다.

**설계와 구현의 유일한 기준은 [CIRCLITH_MASTER_SPEC.md](docs/CIRCLITH_MASTER_SPEC.md)입니다.** 다른 문서와 충돌하면 Master Spec을 우선합니다.

현재는 첫 편집 프로토타입 단계입니다. AND/Input/Output 배치, 선택, 연결 유지 이동·회전, 핀 사이 직각 배선, Esc, Undo/Redo를 구현했습니다. `CURRENT`는 현재 구현 기준이며, `PROVISIONAL`, `EXPERIMENTAL`, `DEFERRED`는 확정되거나 사용성이 검증된 기능을 뜻하지 않습니다.

Node.js 22.23.3 이상에서 `npm ci` 후 `npm run dev`로 실행합니다. `npm run build`, `npm test`, `npx playwright install chromium`, `npm run test:browser`로 검증합니다. 현재 회로는 메모리에만 유지되며 파일 저장·시뮬레이션은 후속 단계입니다.

공개 프로토타입: [GitHub Pages](https://caffentrager.github.io/Circlith/). `main` 또는 `feat/editor-prototype`에 push하면 단위·브라우저 테스트와 빌드 성공 후 GitHub Actions로 배포합니다. 로컬 개발은 `/`, Pages 빌드는 `/Circlith/` 경로를 사용합니다.

## 문서

- [Master Spec](docs/CIRCLITH_MASTER_SPEC.md): 제품 정의, 결정 레지스트리, 조작·입력·배선·시뮬레이션·저장·검증 기준.
- [편집 프로토타입 구현 기록](docs/EDITOR_PROTOTYPE.md): 구조, 범위, 잠정 설계 판단, 입력 매트릭스, 검증과 한계.
- [이전 문서 목록](docs/archive/README.md): 통합 이전 계획, 단축키 제안, 검토 및 회신 이력.
- [업로드 전 정보 검토 기록](docs/INFORMATION_REVIEW.md): 제거한 정보와 검토 범위.

새로운 결정은 Master Spec의 관련 DEC 항목과 본문에 먼저 반영합니다. 별도 문서에서 충돌하는 최종값을 유지하지 않습니다. 다음 단계는 프로토타입 검증을 확대하고 분기·geometry edge case와 실제 Windows IME 입력을 확인하는 것입니다.
