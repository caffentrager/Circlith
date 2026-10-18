# GitHub Pages 분리 배포

사용자 요청: 기존 편집기를 유지하고 조합논리 버전을 별도 주소로 제공한다.

| 소스 | 배포 주소 | 빌드 base |
|---|---|---|
| `feat/editor-prototype` | `/Circlith/` | `/Circlith/` |
| `codex/logic-simulation` | `/Circlith/simulation/` | `/Circlith/simulation/` |

## 공통 배포 흐름

`main`, `feat/editor-prototype`, `codex/logic-simulation`의 `.github/workflows/pages.yml`은 모두 시뮬레이션 브랜치에 있는 공통 `.github/workflows/deploy-pages.yml`을 호출한다. 워크플로가 브랜치마다 다른 산출물을 배포해 다른 버전의 폴더를 지우지 않도록 진입 구성을 통일한다. 공통 워크플로를 변경할 때는 시뮬레이션 브랜치에서 수정한다.

두 소스를 별도 디렉터리로 checkout하고 각각 의존성 설치, 단위·브라우저 테스트, 타입 검사·빌드를 수행한다. 소스 브랜치 자체의 push에서는 해당 이벤트의 SHA를 빌드하며, 다른 소스는 해당 브랜치 최신 커밋을 사용한다. main의 push는 두 소스의 최신 버전을 배포한다. `main`의 문서 전용 소스를 웹앱으로 빌드하지 않는다.

`scripts/assemble-pages.mjs`는 각 index.html의 자산 base를 검사한 뒤 비어 있는 새 디렉터리에 편집기와 `simulation/`을 조립한다. 한 Pages 산출물을 올리므로 두 버전의 빌드·테스트가 모두 성공해야 배포된다. 배포 실패 시 기존 사이트는 그대로 유지된다. Pages 환경의 브랜치 허용 목록에는 세 진입 브랜치가 필요하다.

`/Circlith/deployment.json`에는 실제로 빌드한 두 소스의 커밋 SHA를 기록한다. Actions 성공 후 이 파일과 두 URL의 HTML/자산·브라우저 실행을 확인한다. 이전 커밋을 다시 제공하려면 소스 ref를 명시적으로 바꿔 함께 재배포한다. 한 버전만 담은 이전 Pages 워크플로를 실행하지 않는다.

## 브라우저 설정 분리

두 경로는 같은 origin이다. 시뮬레이션은 `circlith.simulation.input-profile.v1` 및 `circlith.simulation.routing.v1`을 사용하고 기존 편집기의 키를 유지한다. 기존 편집기의 단축키·배선 설정은 새 시뮬레이션에 자동으로 복사하지 않는다. 입력 프로필 JSON은 사용자가 필요할 때 수동으로 가져올 수 있다. 회로 자체는 두 버전 모두 메모리에만 유지된다.
