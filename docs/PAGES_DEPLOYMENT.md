# GitHub Pages: main의 공통 소스를 두 모드로 배포

| 모드 | 소스 | 주소 | 설정 키 prefix |
|---|---|---|---|
| editor | main의 같은 커밋 | `/Circlith/` | `circlith.` |
| simulation | main의 같은 커밋 | `/Circlith/simulation/` | `circlith.simulation.` |

## 개발과 배포

기능은 개발 브랜치에서 구현하고 main에 병합한다. `check.yml`은 기능 브랜치 push와 main 대상 PR에서 공통 단위·브라우저 검사 및 두 모드의 빌드·실행 검증을 수행하며 배포하지 않는다. `pages.yml`은 main push에서 같은 검증 후 두 모드를 한 산출물로 배포한다. 수동 실행도 main에서만 게시한다. Pages 환경은 main만 허용한다.

공통 편집기는 한 코드이며 `src/config/app-mode.ts`에서 Vite mode에 따라 시뮬레이션 기능과 설정 namespace만 선택한다. 로컬 기본은 simulation이다. editor 모드는 `npm run dev -- --mode editor`로 실행한다. 과거 Phase 브랜치는 비교 기준으로 보존하고 서비스 소스로 사용하지 않는다. 편집 기능 수정이 main에 들어가면 두 URL에 함께 반영된다.

## 빌드와 검증 명령

```sh
npm run build -- --mode editor --base=/Circlith/ --outDir build/editor-dist
npm run build -- --mode simulation --base=/Circlith/simulation/ --outDir build/simulation-dist
node scripts/assemble-pages.mjs build/editor-dist build/simulation-dist build/pages-site
node scripts/check-pages.mjs build/pages-site
```

조립 대상 디렉터리는 새 경로여야 한다. 조립 스크립트는 두 base와 source commit 일치를 검사하고 `/Circlith/deployment.json`에 version 2·source commit·각 mode를 기록한다. 브라우저 검사는 빌드 산출물의 두 URL, 계산 기능의 노출 차이, 공통 교차 점프, 설정의 상호 독립, 입력 변경에 따른 결과, 자산 로딩을 확인한다. 배포 후에는 `node scripts/check-pages.mjs https://caffentrager.github.io/Circlith/`로 같은 검사를 실행한다.

`build-pages.yml`은 테스트·두 빌드·조립·브라우저 검사를 공통 수행하며, `pages.yml`만 게시 권한을 사용한다. 한 모드가 실패하면 새 산출물을 게시하지 않는다. 복구할 때도 main의 검증된 커밋에서 두 모드를 함께 다시 빌드한다. 과거 브랜치의 이전 배포 워크플로를 실행하지 않는다.

## 설정과 데이터

두 주소는 같은 origin이지만 입력 프로필·경로 생성·교차 표시의 localStorage 키를 분리한다. 기존 editor 입력·배선 설정은 유지하며 새 교차 표시 설정은 `circlith.wire-display.v1`에 저장한다. simulation은 동일한 suffix에 `circlith.simulation.` prefix를 쓴다. 회로는 두 모드 모두 메모리에 유지되며 저장 기능과는 별개다.
