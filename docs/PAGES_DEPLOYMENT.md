# GitHub Pages: 단일 Circlith 앱

2026-10-19 사용자의 단일 앱 배포 요청이 이전 두 모드 게시 정책을 대체한다.
공개 주소는 https://caffentrager.github.io/Circlith/ 하나다.
편집·조합논리·Clock/DFF 시간 시뮬레이션을 포함한 simulation 빌드를 루트에 배포한다.
이전 /Circlith/simulation/과 별도 editor 디렉터리는 산출물에 포함하지 않으며 404로 종료한다.
브랜치·개발 소스·Git 이력을 삭제하는 작업은 아니다.

## 개발·배포 경계

기능 브랜치는 check.yml로 단위·브라우저·단일 생산 빌드·Pages 산출물을 검사하며 게시하지 않는다.
pages.yml은 main push(또는 main에서 수동 실행)에 같은 검증을 수행한 뒤 Pages를 게시한다.
검증 실패 시 새 산출물은 게시하지 않는다.
로컬 editor 모드는 개발·회귀 검증 목적으로 유지하지만 별도 URL로 공개하지 않는다.

## 빌드·조립·검사

```sh
npm ci
npm test
npx playwright install chromium
npm run test:browser
npm run build -- --mode simulation --base=/Circlith/ --outDir build/circlith-dist
node scripts/assemble-pages.mjs build/circlith-dist build/pages-site
node scripts/check-pages.mjs build/pages-site
```

조립 목적지는 새 경로여야 한다. 기존 산출물을 덮어 조립하지 않으며,
입력 빌드 안에 simulation/editor 하위 앱이 있으면 거부한다.
base=/Circlith/, mode=simulation, build-info.json의 commit=현재 HEAD를 검사한다.
deployment.json은 version 3, source commit, 단일 application의 commit/mode/path와 제거한 경로를 기록한다.

브라우저 검사는 build-info와 manifest, 자산 오류 없음, 기본 게이트·Clock/DFF·편집기 UI,
설정 저장/복원, 실제 DFF 배선·엣지 샘플링·Step·Run/Pause/Reset,
과거 파형 커서의 읽기 전용 동작, 이전 simulation/editor 경로 404를 확인한다.
상태바 문구 대신 data-input-profile과 실제 설정값을 검사한다.

배포 후:

```sh
CIRCLITH_EXPECT_COMMIT=<deployed-sha> node scripts/check-pages.mjs https://caffentrager.github.io/Circlith/
```

CIRCLITH_SCREENSHOT 환경변수를 지정하면 최종 화면을 해당 경로에 저장한다.
Windows PowerShell은 환경변수를 $env:변수명으로 지정한다.

## 설정·데이터

앱을 root로 옮겨도 기존 simulation 설정 키인 circlith.simulation.*를 유지한다.
기존 circlith.* editor 설정을 자동 복사·수정·삭제하지 않는다.
회로와 실행 세션은 이 배포 기준에서 메모리에만 있으며 저장·복구는 별도 개발 브랜치다.
새 배포는 브라우저에 이미 열린 미저장 도면을 서버에 저장해 주지 않는다.
