# Circlith Repository Audit & Preparation

감사일: 2026-10-19 Asia/Seoul · 실행 범위 PR-0 · 상태: 문서 감사/비파괴적 준비.

이 보고서는 현재 구현의 증거와 향후 제안을 구분한다. [Master Spec](../CIRCLITH_MASTER_SPEC.md)의 권위를 바꾸지 않는다. 후속 설계는 [Platform Architecture](PLATFORM_ARCHITECTURE.md), 단계별 실행은 [Migration Plan](MIGRATION_PLAN.md), 문서 탐색은 [Repository Index](../REPOSITORY_INDEX.md)를 따른다.

## 1. 기준과 저장소 건강

| 항목 | 감사 시 관측 |
|---|---|
| Base commit | `f59efd2755e31be9b1bb4f70514cb20680421be7` |
| Working branch | `chore/repository-preparation`, origin/main에서 새로 생성 |
| 시작 checkout | `claude/storage-recovery@90f0a393e5c137c946b6e9a6227a3c584177c129` |
| 시작 작업 트리 | `git status --short` 빈 출력, 미추적 파일 없음 |
| 로컬 main | `982bf5c5ecf3268d583d6a1cb23afed84c24b355`, 원격보다 4커밋 뒤 |
| 최신 main 재확인 | git fetch origin 후 ls-remote HEAD, origin/main, GitHub branches API 모두 f59efd2 |
| 기본 branch / remote | main / https://github.com/caffentrager/Circlith.git |
| GitHub 보호 | branches API protected=false, protection API 404 “Branch not protected”, rulesets=[] |
| 태그 | 로컬 git tag 및 완료 시점 git ls-remote --tags origin 모두 빈 결과 |
| 저장소 지침 | 루트/상위 및 추적 파일·작업 대상에서 AGENTS.md 발견 안 됨. .claude/settings.local.json만 추적 |

main은 단일 Logic 앱으로 편집·조합논리·Clock/DFF·시간 제어·파형을 제공한다. 파일 저장/복구와 clipboard는 **별도 로컬 브랜치에만** 존재한다. Electronics/프로젝트 다중 문서/런타임 Workspace 선택은 아직 없다. 현재 자동 검증과 배포는 작동하지만 문서의 시점 혼재와 App의 책임 집중이 다음 이전의 주요 위험이다.

시작 브랜치의 미커밋 작업은 없었으므로 최신 origin/main에서 감사 브랜치로 전환했다. 원래 storage 브랜치 ref, clipboard worktree, 로컬 main은 이동/병합/초기화하지 않았다. `build/pages-editor`, `build/qa-integration-20261019`, `build/sequential-worktree`, `build/symbol-refresh`, `.claude/worktrees/inspiring-gauss-4020ea`는 실제 Git worktree다. build 디렉터리라는 이유로 삭제할 수 없다.

## 2. 전수 목록의 범위와 분류

`git ls-tree -r --name-only HEAD`의 **326개 추적 파일**을 기준으로 집계했다. 부록은 모든 파일의 분류와 역할을 포함한다. node_modules/dist/test-results 및 중첩 worktree는 별도 checkout/생성물이며 원본 소스로 중복 집계하지 않았다. 디렉터리별 수는 하위 폴더를 포함한 합계와 직접 포함 수를 구분한다. 이번에 추가된 감사 문서는 아래 기준 수에 포함하지 않는다.

| 경로 | 재귀 파일 수 | 역할·보존 판단 |
|---|---:|---|
| 루트 | 10 (직접) | README, package/lock, HTML, TS/Vite/Vitest/Playwright, Git 설정; 유지 |
| src/ | 61 | 런타임·입력 데이터·스타일·타입; ACTIVE |
| docs/ | 23 | 현재 명세·구현 기록 11 + archive 12; 권위 구분 후 전부 보존 |
| review/ | 18 | Markdown 16, 재현 테스트 2; HISTORY/수정 응답의 근거 |
| qa-audit/ | 164 | 날짜별 검증·독립 테스트·JSON·화면 증거; 역사적 증거 보존 |
| tests/ | 43 | unit 19, browser 24(23 spec + zoom helper); ACTIVE |
| scripts/ | 3 | Pages 조립/검증 및 UI 촬영; 전부 참조 근거 있음 |
| .github/ | 3 | reusable build, feature checks, main Pages publish; ACTIVE |
| .claude/ | 1 (추적만) | 로컬 allow 명령 설정. runtime/CI에서는 사용 안 함, 개발 도구용 |

분류는 ACTIVE, CANONICAL, HISTORICAL, ARCHIVE_CANDIDATE, DUPLICATE_CANDIDATE, GENERATED, UNKNOWN을 사용한다. UNUSED/DELETE 판정은 하지 않는다. GENERATED는 삭제 허가가 아니다. 증거 JSON/PNG는 생성된 자료이지만 이력으로 추적 중이므로 역사적 보존이 우선한다.

## 3. 실제 빌드·테스트 진입점과 의존성

`index.html → src/main.tsx → src/ui/App.tsx`가 앱 진입점이다. Vite는 단일 앱을 빌드하며 app-mode는 MODE가 editor일 때만 계산 UI를 끈다. package.json에는 dev/build/test/test:browser 네 스크립트만 있다. npm workspace 설정은 없다. TypeScript strict, ES2022, Bundler 해석, include는 src/tests/*.ts 설정 파일이다.

| 의존성 | package.json 범위 | package-lock 실설치 버전 |
|---|---|---|
| react / react-dom | ^19.0.0 / ^19.0.0 | 19.3.0 / 19.3.0 |
| ajv | ^8.20.0 | 8.20.0 |
| typescript | ^5.7.0 | 5.9.3 |
| vite | ^6.0.0 | 6.4.4 |
| vitest | ^5.0.4 | 5.0.4 |
| @playwright/test | ^1.50.0 | 1.64.0 |
| @types/node | ^26.6.5 | 26.6.5 |

Vitest는 tests/unit/**/*.test.ts만 발견한다. Playwright는 tests/browser와 기본 Chromium을 사용한다. qa-audit의 독립 테스트와 review의 repro는 기본 CI 대상이 아니다. 예전 QA config는 qa/**/*.test.ts를 기대하고 helpers는 ../src를 참조하므로 원래 scratch checkout 배치가 필요하다. 기본 테스트에 포함되지 않는다고 불필요한 파일로 판정하지 않는다.

`profiles.ts`는 schema/catalog/extensions/adaptations와 preset glob을 읽고 Ajv 검증을 수행한다. JSON은 단순 참고 자료가 아니라 런타임 입력이다. command seed의 미구현 항목도 availability를 설명하므로 임의 제거할 수 없다. `capture-workspace.mjs`는 UI_WORKSPACE_REFRESH 문서가 참조하는 수동 촬영 도구이며 CI에 없더라도 보존한다.

## 4. 핵심 위험과 정리 후보

| 우선도 | 관측 근거 | 영향·권고 |
|---|---|---|
| 높음 | main 보호 없음, repo ruleset 없음 | 실수로 직접 push 가능. 필수 check/리뷰 정책 도입을 별도 승인 의제로 제안; 이번 설정 변경 0 |
| 높음 | T1/T2가 fc6520c에서 분기, main에 + 고유 패치 | 오래된 전체 트리로 덮으면 순차/단일 Pages 유실 위험. 3-way 통합, kind·clock/dff sanitizer 호환부터 확인 |
| 높음 | App.tsx 1,506줄, Editor 373줄에 Circuit snapshot | 단순 탭/조건부 mount로 history·timer·gesture가 섞이거나 사라질 위험. 문서 runtime 소유권부터 분리 |
| 중간 | geometry 함수가 Logic pin/게이트 크기/Circuit/net을 참조 | geometry 전체를 common으로 이동하지 않음. Point/path/zoom 순수 부분부터 |
| 중간 | README/SIMULATION/과거 CAD gap의 “순차 미구현” | 현재 Clock/DFF와 충돌. 원문 보존, 인덱스에 scope와 기준 commit 명시 |
| 중간 | JS minified 536.26 kB / gzip 166.83 kB | 빌드 경고. 두 엔진 추가 전 측정 후 workspace lazy load 검토; 경고 임계값 변경 없음 |
| 중간 | build/ 안에 실제 Git worktree 존재 | 생성물 일괄 청소 시 다른 작업 손상. worktree inventory 선행, 이번 삭제 0 |
| 낮음 | review/review_repro.*는 과거 복사 실행 전제 | 현재 위치에서 ../../src가 맞지 않음. 역사적 재현 환경 설명 대상으로 보존; CI에 바로 편입 금지 |
| 검토 | .claude/settings.local.json이 tracked | 읽은 내용은 xargs wc/sort allow 두 명령. 팀 공통 설정인지 개인 환경인지 소유자 확인; 비밀정보라고 단정/삭제하지 않음 |

### 중복·아카이브 후보의 실제 확인

전 추적 파일의 바이트 동일 비교에서 한 쌍을 찾았다.

- qa-audit/20261018/evidence/browser-profile-dev.json
- qa-audit/20261018/evidence-after/browser-profile-dev-BEFORE.json

SHA-256은 둘 다 `1e27027b55c4cc64439d4ded3f81fd73910ab07eaecdca17fb9e53ee0bbb521c`이다. 실제 내용은 100/500/1000 gate의 toggle/zoom 및 함수 profile 수치로, BEFORE 대조 증거를 복사한 것으로 해석할 수 있다. FINDINGS.md가 원본 profile을 참조한다. 분류는 DUPLICATE_CANDIDATE이지만 전후 비교 문맥이 다르므로 둘 다 보존한다. 단일 경로 alias/manifest로 대체할지는 이후 별도 결정이다.

archive의 SHORTCUTS 계열은 제목·버전·작성자·기본 키 후보가 다르다. 상단 보관 표시와 P/Q·Undo 제안 차이를 확인했으며 동일 파일이 아니다. 중복 주제라는 이유로 통합/삭제하지 않는다. review의 최초 감사→응답→통합 결과도 별도 판단 이력이므로 내용 중복만으로 합치지 않는다.

ARCHIVE_CANDIDATE: EDITOR_PROTOTYPE의 초기 단계 설명, EDITOR_EXPANSION_SCOPE의 과거 진척 표, review의 완료된 QA/UX 기록은 **문서 이동 제안**만 한다. 아직 현재 조작의 근거가 포함되어 있어 [Documentation Audit](DOCUMENTATION_AUDIT.md)의 경로·권위 대조 후 승인받아야 한다. 이번 이동 없음.

### 생성물과 확인 보류

node_modules/, dist/, test-results/, playwright-report/, coverage/는 도구 산출물 경로이며 .gitignore에 있다. build/에는 산출물·감사 로그와 worktree가 섞인다. .claude/worktrees도 Git의 로컬 exclude로 무시된다. 무시된 모든 외부 checkout의 미커밋 변경까지 감사한 것은 아니다. `.git`/사용자 설정/캐시는 정리 대상에서 제외했다. 불명 파일을 DELETE로 분류하지 않았다.

## 5. CI와 Pages 기준

`.github/workflows/check.yml`은 non-main push와 main PR에서 reusable build-pages.yml을 호출한다. build-pages는 CI Node **22.23.3**, npm ci, unit, Chromium 설치, browser, simulation production build, fresh assemble, check-pages, artifact 업로드를 수행한다. pages.yml은 main push/수동 실행 뒤 검증을 통과해야 main에서만 deploy한다.

GitHub API로 확인한 [main run 39200584729](https://github.com/caffentrager/Circlith/actions/runs/39200584729)은 f59efd2의 build/deploy 및 모든 검증 step이 success다(2026-10-19 13:39:43 KST 생성). [feature run 39200312138](https://github.com/caffentrager/Circlith/actions/runs/39200312138)도 success다. 이전 sequential/UI 브랜치 run은 failure 기록이 남아 있다. 이번 감사에서 그 과거 실패 job의 원인을 별도 재현하지 않았으므로 현재 결함이라고 단정하지 않는다.

Pages API는 workflow 게시·HTTPS·main source를 반환했다. [실서비스 deployment manifest](https://caffentrager.github.io/Circlith/deployment.json)의 version=3, source/application commit=f59efd2, mode=simulation, path=/Circlith/를 직접 확인했다. 로컬 및 실서비스에서 기존 check-pages가 설정 유지·Clock/DFF·Run/Pause/Step/Reset·파형·asset error 없음과 retired editor/simulation URL 404를 통과했다. 브랜치·정책·서비스 변경은 하지 않았다.

## 6. 필수 회귀 매트릭스

| 계약 | 기존 필수 테스트/검사 |
|---|---|
| 게이트 배치·선택·이동·회전 | unit/editor, selection, selection-hit, control-regressions; browser/editor, selection-pan, drag-wiring, control-regressions |
| 배선 생성·수정·경유점·분기·교차 | unit/routing, wire-edit, wire-cleanup, wire-bridges, connections, connection-intent, qa-integration-followups; browser/wire-*, routing-settings |
| Pin/Net와 실패 원자성 | unit/connections, component-properties, audit-regressions, adversarial-latest |
| Undo/Redo·삭제·Properties | unit/editor, delete-and-gates, component-properties; browser/동명 spec, audit-regressions |
| 0/1/X/Z·부동/다중구동·피드백 | unit/simulation, audit-regressions, qa-integration-followups; browser/simulation |
| Clock/DFF·동시 엣지·Run/Pause/Step/Reset | unit/time-session; browser/sequential |
| Waveform 관측·과거 cursor/live 구분 | unit/time-session; browser/sequential; scripts/check-pages.mjs |
| 기존 사용자 설정·프로필·IME 가드 | unit/input, control-regressions; browser/input-settings, settings-isolation, context-menu, ux-audit-followups |
| 배포 경로·출처·설정·실제 순차 조작 | scripts/assemble-pages.mjs, check-pages.mjs + 기존 Actions 전체 |

이름은 각각 tests/unit/*.test.ts, tests/browser/*.spec.ts의 축약이다. 모든 기본 suite를 유지한다. 실제 Windows IME 입력·스크린리더·사용자 사용성·대형 아날로그/순차 성능은 자동 통과와 별개로 미검증이다.

## 7. 실행 결과와 환경

Windows PowerShell, Node v24.19.0, npm 10.9.4, lockfile 기반 설치. 호스트 PATH에 npm이 없어 공식 npm tarball을 **무시되는 build/audit-pr0/tools**에만 준비했다. package.json/lockfile/CI는 변경하지 않았다. `npm` 명령은 해당 npm-cli.js를 node로 실행한 동등 호출이며 browser webServer용 임시 npm.cmd를 PATH에 추가했다. 로컬 Node는 CI와 다르므로 CI 성공 근거도 별도로 기록했다.

첫 browser/Pages 검사는 Playwright headless shell v1248 미설치로 실행되지 못했다. 첫 browser 실행은 오류 후 프로세스가 남아 해당 감사의 process tree만 식별해 종료했다. 로그는 browser-initial-missing-chromium.log로 보존했다. Chromium을 build/audit-pr0/browsers에 설치하고 PLAYWRIGHT_BROWSERS_PATH를 지정해 재실행했다. 기존 테스트/설정은 수정하지 않았다. 이 준비 실패는 문서 변경에 따른 제품 회귀가 아니다.

| Command | Result | Test count / evidence | Execution time | Failure details |
|---|---|---|---|---|
| npm ci | PASS | 설치 50 packages | 14.223s | 없음; build 크기 경고만 |
| npm test | PASS | 425 passed, 1 skipped | 4.252s | 없음; build 크기 경고만 |
| npm run build | PASS | TS+Vite PASS; 536.26 kB warning | 5.506s | 없음; build 크기 경고만 |
| npm run test:browser | PASS | 165 passed | 63.520s | 없음; build 크기 경고만 |
| simulation Pages build | PASS | 260 modules, PASS | 5.376s | 없음; build 크기 경고만 |
| node scripts/assemble-pages.mjs <dist> <fresh-site> | PASS | manifest v3 / commit 일치 | 0.083s | 없음; build 크기 경고만 |
| node scripts/check-pages.mjs <local-site> | PASS | 실제 브라우저 smoke 전체 PASS | 2.870s | 없음; build 크기 경고만 |
| CIRCLITH_EXPECT_COMMIT=f59efd2… node scripts/check-pages.mjs <live-url> | PASS | 실서비스 smoke 전체 PASS | 6.980s | 없음; build 크기 경고만 |

Tests executed: unit 426(soak 1 포함), browser 165 및 두 Pages smoke. Tests passed: unit 425 + browser 165 = **590**, Pages smoke 2회 별도 통과. Tests failed: 최종 성공 실행 0. 첫 browser/Pages 시도는 Chromium 미설치로 BLOCKED(제품 assertion 실패로 계산하지 않음). soak 1개는 기존 opt-in skip이다.

문서 작성 후 단위·빌드·전체 브라우저를 다시 실행해 동일한 결과를 확인했다. 재실행 결과는 아래와 같다.

| Command | Result | Test count | Execution time | Environment / failure details |
|---|---|---|---|---|
| npm test | PASS | 425 passed, 1 skipped (19 files) | 3.763s | Windows / Node 24.19.0 / npm 10.9.4; 실패 없음 |
| npm run build | PASS | tsc + Vite 260 modules | 5.241s | 같은 환경; 기존 536.26 kB chunk 경고 유지 |
| npm run test:browser | PASS | 165 passed, 6 workers | 58.452s | 같은 환경 / Chromium v1248; 실패 없음 |

기준 실행과 최종 재실행을 합산해 테스트 종류가 늘었다고 계산하지 않는다. 고유 기본 테스트 통과는 590개, skip은 1개다. 로컬/실서비스 Pages smoke는 각각 별도로 통과했다.

로그·시간·명령 원본은 로컬 build/audit-pr0/{unit,build,browser,pages-build,pages-assemble,pages-check,live-check}.{log,json}, npm-ci.log에 있다. 최초 성공 기준 로그는 baseline-{unit,build,browser}.{log,json}에 보존했다. 생성물은 Git에 포함하지 않는다. 과거 보고서 수치를 이번 측정으로 덮어쓰지 않았다.

## 8. 실제 정리와 마무리

Files added: docs/platform/REPOSITORY_AUDIT.md, BRANCH_AUDIT.md, DOCUMENTATION_AUDIT.md, PLATFORM_ARCHITECTURE.md, MIGRATION_PLAN.md, IMPLEMENTATION_HANDOFF.md 및 docs/REPOSITORY_INDEX.md (7개).

Files modified: README.md (감사 인덱스·현재 상태의 짧은 안내 추가), review/CLAUDE_logic-simulation_verification_eb44fc5.md (없는 파일 b를 가리키던 링크 하나를 동일 문서 P2-2 anchor로 수정).

Files moved: 0. Files deleted: 0. 기존 기록의 내용은 보존하고 링크 한 곳만 수정했다. 소스/기존 명세/테스트/워크플로/package 설정 변경: 0. 초기 감사 종료 시점의 branch/tag/history 삭제·main 수정·push·배포: 0. 초기 감사 변경은 검토 가능한 작업 트리에 남겼으며 그 시점에는 커밋·PR 생성·push를 하지 않았다.

| 최종 검사 | 결과 |
|---|---|
| git status --short --untracked-files=all | 추가 7개·수정 2개만 존재; 아래 목록과 일치 |
| git diff --check | PASS, 빈 출력 |
| git diff --stat | 기존 추적 파일 2개: 5 insertions, 1 deletion(링크 치환). 신규 미추적 문서 7개는 이 명령에 포함되지 않아 별도 전수 검사 |
| 변경 경로 허용 목록 대조 | PASS, src/tests/.github/package/기존 명세 변경 없음 |
| 신규 문서 공백·충돌 marker·완성 여부 | PASS, trailing whitespace/미완료 placeholder 없음 |
| 상대 Markdown 파일 링크 | 151개 대상 검사, 누락 0; 수정한 P2-2 heading slug도 대조 |
| 최종 remote heads/tags 재조회 | main f59efd2 및 원격 9 branch 변동 없음, tags 없음 |

실행·scope·링크 결과의 상세 로컬 기록은 build/audit-pr0/document-checks.json에 있다. 기존 README 본문과 QA 결론은 보존했다. source checkout은 위 기준 main이며, 이 표는 초기 감사 변경을 커밋하기 전의 snapshot이다. 후속 사용자 요청에 따른 감사 브랜치 게시·PR·CI 상태는 Git 이력과 해당 PR에서 확인한다. 게시만으로 PR-1 이후 구현이나 main 병합을 수행하지 않는다.

Known limitations: 다른 worktree 미커밋 내용, 실제 IME·스크린리더·대형 회로 성능, 과거 실패 CI 원인, 별도 브랜치 기능의 현재 main 통합 동작은 미검증이다. remote와 CI 상태는 조회 시점 snapshot이며 다음 작업에서 재조회해야 한다.

Unresolved decisions: T1/T2 통합 순서·형식 호환, project 파일 버전·unknown domain 처리, 플랫폼 범위의 Master Spec 반영, 소스/문서 이동 단위·소유권, 보호 정책 도입, 향후 Electronics 엔진·라이선스. 이번 단계는 결정 제안만 하며 [Handoff](IMPLEMENTATION_HANDOFF.md)를 따른다.

## 부록 A. 직접 포함 디렉터리별 파일 수

| 디렉터리 | 직접 파일 수 |
|---|---|
| . | 10 |
| .claude | 1 |
| .github/workflows | 3 |
| docs | 11 |
| docs/archive | 12 |
| qa-audit/20261018 | 6 |
| qa-audit/20261018/evidence | 81 |
| qa-audit/20261018/evidence-after | 11 |
| qa-audit/20261018/qa-tests/browser | 12 |
| qa-audit/20261018/qa-tests/config | 2 |
| qa-audit/20261018/qa-tests/unit | 13 |
| qa-audit/20261018/screens | 38 |
| qa-audit/20261019/evidence-integration | 1 |
| review | 18 |
| scripts | 3 |
| src | 2 |
| src/config | 1 |
| src/editor | 2 |
| src/geometry | 9 |
| src/input | 5 |
| src/input/data | 4 |
| src/input/data/presets | 8 |
| src/input/data/schema | 1 |
| src/model | 6 |
| src/renderer | 3 |
| src/simulation | 3 |
| src/ui | 17 |
| tests/browser | 24 |
| tests/unit | 19 |

## 부록 B. 소스 파일별 책임·의존·재사용 평가

전체 src 파일의 존재·import/export를 확인하고 경계 판단에 필요한 모델/Editor/App/geometry/input/simulation/UI 코드를 읽었다. 아래 난이도/위험은 변경 규모 추정이며 측정값이 아니다. 의존은 현재 직접 import의 요약이고, “공유 후보”는 즉시 이동 허가가 아니다. JSON 데이터도 마지막 전수 목록에 개별 포함한다.

| 파일 | 현재 책임 | 직접 의존(import) | 재사용 판단 | 공통화/격리 변경 | 난이도 | 회귀 위험 |
|---|---|---|---|---|---|---|
| `src/config/app-mode.ts` | Vite mode와 settingsKey | 직접 import 없음 | 정책 분리 필요 | Logic 빌드 모드/기존 namespace 유지; workspace와 분리 | 중간 | 높음 |
| `src/editor/dispatcher.ts` | 명령 metadata 검사/handler dispatch | `../input/registry` | 기구 공유 후보 | 전역 registry를 작업별 주입; ID 유지 | 낮음 | 중간 |
| `src/editor/editor.ts` | Circuit·draft·history·selection·view 소유 | `../model/circuit, ../geometry/geometry, ../geometry/wire-edit, ../model/deletion, ../model/connections, ../geometry/path, ../geometry/routing, ../model/wire-cleanup, ../model/component-properties` | Logic 전용 | 문서별 인스턴스; Electronics 별도 Editor | 높음 | 높음 |
| `src/geometry/connection-hit.ts` | 핀/접속점/선분의 연결 hit | `../model/circuit, ./geometry, ./path` | Logic 전용 adapter | pinPosition/endpoint/회로 후보 의미 유지 | 중간 | 높음 |
| `src/geometry/geometry.ts` | snap/rotate와 Logic pin/선택/연결유지 transform | `../model/circuit, ./path` | 부분 공유 후보 | 순수 수학과 Circuit 변환 분리; pin 규칙 Logic 잔류 | 높음 | 높음 |
| `src/geometry/path.ts` | 점 비교/투영/경로 정리/경유점 offset | `../model/circuit` | 순수 함수 공유 후보 | Point 타입 의존만 분리; anchor 순서 유지 | 낮음 | 중간 |
| `src/geometry/routing.ts` | Logic obstacle·우회·routing 설정 | `../model/circuit, ./geometry, ./path, ../config/app-mode` | 부분 공유 후보 | bounds/endpoint adapter와 저장 정책 분리 | 높음 | 높음 |
| `src/geometry/selection-hit.ts` | 화면 거리 기반 배선 선택 후보 | `../model/circuit, ./path` | 기하 기구 공유 후보 | Circuit 대신 ID+polyline 입력 | 중간 | 중간 |
| `src/geometry/view.ts` | 줌 수학/게이트 bounds 화면 맞춤 | `../model/circuit` | 부분 공유 후보 | zoom 수학 추출; fitView에 도메인 bounds 주입 | 중간 | 중간 |
| `src/geometry/wire-bridges.ts` | 미접속 교차 점프 표시/설정 | `../model/circuit, ./path, ../config/app-mode` | 표시 알고리즘 후보 | net/junction 차이 adapter; 연결성 변경 금지 | 중간 | 높음 |
| `src/geometry/wire-edit.ts` | 선분/코너/jog와 endpoint 보존 교체 | `../model/circuit, ./geometry, ./path` | 부분 공유 후보 | 점 편집만 추출; replaceWirePath는 Logic 검증 | 중간 | 높음 |
| `src/geometry/wire-overlaps.ts` | 다른 net 공선 겹침 경고 | `../model/circuit` | 도메인 adapter 필요 | polyline/net identity와 도메인 경고 분리 | 중간 | 중간 |
| `src/input/connection-intent.ts` | 몸체 선택/핀 연결 우선 해석 | `../model/circuit, ../geometry/connection-hit` | Logic 전용 | DOM surface·Logic 연결 후보 유지 | 중간 | 높음 |
| `src/input/profiles.ts` | Ajv·preset/override·저장 형식 검증 | `ajv/dist/2020, ../config/app-mode, ./data/schema/input-profile.schema.json, ./data/preset-catalog.json, ./data/native-extensions.json, ./data/profile-adaptations.json, ./registry, ./types` | 기구 공유 후보 | registry·settingsKey adapter, 구 profile 호환 | 중간 | 높음 |
| `src/input/registry.ts` | 명령 seed·구현 availability | `./data/command-registry.seed.json` | Logic 및 공통 정책 혼재 | 기구/작업별 명령 등록 분리; 미구현 key 선점 금지 | 중간 | 높음 |
| `src/input/resolver.ts` | 키 sequence·wheel·mouse/context 해석 | `./types` | 기구 공유 후보 | 도메인 명령 주입, focus/IME/sequence 취소 유지 | 중간 | 높음 |
| `src/input/types.ts` | binding/profile/context·충돌/signature | 직접 import 없음 | 기구 공유 후보 | 기존 schema/context/키 의미 보존 | 낮음 | 중간 |
| `src/main.tsx` | React 앱 mount | `react-dom/client, ./ui/App` | Platform 진입점 | 단일 root 유지, shell 연결 | 낮음 | 중간 |
| `src/model/circuit.ts` | Logic kind/pin/net/geometry·ID·연결 | 직접 import 없음 | Logic 전용 | 현재 모델 유지; Point만 추출 후보 | 높음 | 높음 |
| `src/model/component-properties.ts` | 핀수/반전/이름/시간 속성 원자 갱신 | `./circuit, ./temporal-properties, ../geometry/geometry, ../geometry/path, ../geometry/routing, ./connections` | Logic 전용 | 안전 우회·핀 ID·history 계약 유지 | 높음 | 높음 |
| `src/model/connections.ts` | 명시적 분기/교차/연결·회로 무결성 | `./circuit, ../geometry/geometry, ./temporal-properties, ../geometry/path` | Logic 전용 | geometry와 의미론 경계를 보존 | 높음 | 높음 |
| `src/model/deletion.ts` | 부품/배선 삭제와 dangling 연결 보존 | `./circuit, ../geometry/geometry, ./connections` | Logic 전용 | 외부 endpoint·net 재구성은 공유하지 않음 | 높음 | 높음 |
| `src/model/temporal-properties.ts` | Clock/DFF 기본·속성 validator | `./circuit` | Logic 전용 | 파일 codec에 설계 속성 보존·검증 연결 | 낮음 | 높음 |
| `src/model/wire-cleanup.ts` | 같은 net 중복 경로 계획/적용 검증 | `./circuit, ./connections, ../geometry/path, ../geometry/routing` | Logic 전용 | 전기 graph와 route 선택 보존 | 중간 | 높음 |
| `src/renderer/CircuitSvg.tsx` | Logic 심벌/배선/핀/신호/강조 SVG | `../model/circuit, ../geometry/geometry, ./GateBody, ../simulation/simulator, ../simulation/logic, react, ../geometry/wire-bridges, ../ui/circuit-labels` | Logic 전용 | 공통 canvas frame과 도메인 renderer 분리 | 높음 | 높음 |
| `src/renderer/GateBody.tsx` | gate/Input/Output/Clock/DFF 심벌 | `../model/circuit` | Logic 전용 | Logic 심벌 유지, Electronics 별도 심벌 | 낮음 | 중간 |
| `src/renderer/WireHandles.tsx` | Circuit 선택 배선 편집 handles | `../model/circuit, ../geometry/wire-edit` | 표시 프레임 후보 | 도메인 segment descriptor 주입 필요 | 중간 | 중간 |
| `src/simulation/logic.ts` | 0/1/X/Z 반전/구동/게이트 평가 | `../model/circuit` | Logic 전용 | SPICE와 결합하지 않음; 의미 변경 없음 | 낮음 | 높음 |
| `src/simulation/simulator.ts` | validator·SCC·compile/evaluate·진단 | `../model/circuit, ../model/temporal-properties, ../model/connections, ./logic` | Logic 전용 | 도메인 result 유지; UI envelope만 adapter | 높음 | 높음 |
| `src/simulation/time-session.ts` | 정수시간·Clock/DFF·step/watch/trace | `../model/circuit, ../model/temporal-properties, ./simulator, ./logic` | Logic 전용 | 문서 소유자 연결; 기존 상한/원자성 유지 | 높음 | 높음 |
| `src/ui/App.tsx` | Editor/입력/시뮬/UI/DOM gesture 통합 | `react, ../editor/editor, ../model/circuit, ../geometry/geometry, ../input/connection-intent, ../geometry/selection-hit, ../geometry/path, ../model/connections, ../model/wire-cleanup, ../renderer/CircuitSvg, ../renderer/WireHandles, ../renderer/GateBody, ../geometry/wire-edit, ../editor/dispatcher, ../input/profiles, ../input/resolver, ../input/types, ./keyboardAdapter, ./InputSettings, ./EditorSidebar, ./SimulationPanel, ../simulation/simulator, ../simulation/logic, ../geometry/view, ../geometry/routing, ../geometry/wire-bridges, ../config/app-mode, ./ComponentProperties, ./WorkspaceHeader, ./StatusBar, ./InspectorPanel, ./circuit-labels, ../geometry/wire-overlaps, ./DrawingWarnings, ./useTimeSession, ./TimeControls, ./WaveformPanel, ./style.css, ./workspace.css, ./sequential.css` | Logic orchestration | runtime 소유권→workspace wrapper→내부 hooks 순서 | 높음 | 높음 |
| `src/ui/ComponentProperties.tsx` | Logic 속성 modal와 Apply | `react, ../model/circuit, ../model/temporal-properties, ../model/component-properties` | Logic 전용 | 기존 검증/실패/focus 보존 | 중간 | 높음 |
| `src/ui/DrawingWarnings.tsx` | 배선 겹침 경고와 locate | `../geometry/wire-overlaps, ./circuit-labels` | 프레임만 공유 후보 | 도메인 경고 payload adapter | 낮음 | 중간 |
| `src/ui/EditorSidebar.tsx` | Logic library/도면트리·검색·선택 | `react, ../model/circuit, ./circuit-labels` | Logic 전용/프레임 후보 | tree frame과 Logic kind/net 노드 분리 | 중간 | 중간 |
| `src/ui/InputSettings.tsx` | profile/override/routing/bridge 설정 UI | `react, ../input/profiles, ../input/types, ../input/registry, ../geometry/routing, ../geometry/wire-bridges` | 부분 공유 후보 | 공통 profile editor와 Logic 옵션 분리 | 높음 | 높음 |
| `src/ui/InspectorPanel.tsx` | Logic 선택·속성/신호/net 요약 | `react, ../model/circuit, ../model/temporal-properties, ../simulation/simulator, ./circuit-labels` | Logic 전용/프레임 후보 | panel frame과 도메인 content 분리 | 중간 | 중간 |
| `src/ui/SimulationPanel.tsx` | Logic 입력/출력/diagnostic 조작 | `../model/circuit, ../simulation/logic, ../simulation/simulator, ./circuit-labels` | Logic 전용 | diagnostic 외관만 공통 adapter | 중간 | 높음 |
| `src/ui/StatusBar.tsx` | 도구·선택·줌·profile 상태 | `../config/app-mode, react` | 프레임 공유 후보 | props의 도메인 문자열을 view model로 | 낮음 | 중간 |
| `src/ui/TimeControls.tsx` | Logic Run/Pause/Step/Reset·clock 선택 | `react, ./circuit-labels, ./useTimeSession, ../simulation/time-session` | Logic 전용 | TimeController 수명만 문서별 보존 | 중간 | 높음 |
| `src/ui/WaveformPanel.tsx` | Logic watch/sample/cursor UI | `react, ../model/circuit, ./circuit-labels, ../simulation/logic, ../simulation/time-session` | Logic 전용 | 아날로그 축/단위를 억지로 통합하지 않음 | 중간 | 높음 |
| `src/ui/WorkspaceHeader.tsx` | 이름/이력/도구/시뮬 설정 헤더 | `../config/app-mode` | 프레임 공유 후보 | project/document/workspace 표시와 Logic 도구 분리 | 중간 | 중간 |
| `src/ui/circuit-labels.ts` | Logic 부품/핀/net 공유 표시명 | `../model/circuit` | Logic 전용 | 문서별 registry 유지; 전역 ID 추정 금지 | 중간 | 중간 |
| `src/ui/keyboardAdapter.ts` | React keyboard와 resolver/rollback 연결 | `react, ../input/resolver, ../input/types` | 기구 공유 후보 | DOM focus/IME 보호와 active 문서 gating | 중간 | 높음 |
| `src/ui/sequential.css` | 시간 제어/파형 전용 스타일 | `CSS selectors` | Logic 전용 | Logic scope 유지 | 낮음 | 중간 |
| `src/ui/style.css` | 앱 기본/도면/설정 UI 전역 스타일 | `CSS selectors` | 부분 공유 후보 | 기본 토큰/도메인 selector 범위 분리 | 중간 | 중간 |
| `src/ui/useTimeSession.ts` | React 세션/입력 sync·timer/hidden pause | `react, ../model/circuit, ../simulation/logic, ../simulation/time-session` | Logic 전용 | unmount와 session 소유 분리; deactivate 필수 | 높음 | 높음 |
| `src/ui/workspace.css` | header/sidebar/inspector/dock 반응형 | `CSS selectors` | 프레임 공유 후보 | 도메인 leakage와 작은 화면 focus 검증 | 중간 | 중간 |
| `src/vite-env.d.ts` | Vite ambient types | `Vite types` | 공통 빌드 | 현재 선언 유지 | 낮음 | 낮음 |

## 부록 C. 기준 commit의 전체 파일 분류

각 경로의 파일 종류·역할과 보존 근거를 기록한다. JSON/PNG 증거는 HISTORICAL(생성 자료)로 보존하며 두 동일 파일만 DUPLICATE_CANDIDATE로 표시한다. 경로 전체를 추측만으로 unused 처리하지 않았다.

| 파일 | 종류 | 분류 | 역할 | 사용/보존 근거 |
|---|---|---|---|---|
| `.claude/settings.local.json` | .json | UNKNOWN | 로컬 Claude allow 명령 2개 | 개발 도구용; 팀 공통 소유 여부 확인 필요 |
| `.gitattributes` | (설정) | ACTIVE | 줄바꿈 정책 | Git/npm/TS/Vite/Vitest/Playwright 실행 진입 |
| `.github/workflows/build-pages.yml` | .yml | ACTIVE | CI/Pages workflow | check/pages → build-pages 재사용 |
| `.github/workflows/check.yml` | .yml | ACTIVE | CI/Pages workflow | check/pages → build-pages 재사용 |
| `.github/workflows/pages.yml` | .yml | ACTIVE | CI/Pages workflow | check/pages → build-pages 재사용 |
| `.gitignore` | (설정) | ACTIVE | 로컬/생성물 제외 | Git/npm/TS/Vite/Vitest/Playwright 실행 진입 |
| `README.md` | .md | ACTIVE | 제품 개요·실행·현재/과거 branch 기록 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/CIRCLITH_MASTER_SPEC.md` | .md | CANONICAL | 제품·DEC·조작/모델/계산/저장 기준 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/DELETE_AND_SYMBOLS.md` | .md | ACTIVE | Delete·꺾임점·심벌 및 승인 정책 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/EDITOR_EXPANSION_SCOPE.md` | .md | HISTORICAL | 51552a7 이후 단계별 확장 범위 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/EDITOR_PROTOTYPE.md` | .md | HISTORICAL | 초기 editor 구조·조작·검증 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/INFORMATION_REVIEW.md` | .md | HISTORICAL | 2026-10-13 업로드 전 자료 검토 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/INPUT_CONTROLS.md` | .md | ACTIVE | registry/resolver/프로필 정책·검증 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/PAGES_DEPLOYMENT.md` | .md | ACTIVE | 단일 앱 build/assemble/check/deploy 절차 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/PAGES_DRIVE_STORAGE.md` | .md | HISTORICAL | Drive 저장 가능성/운영 조사 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/SEQUENTIAL_SIMULATION.md` | .md | ACTIVE | Clock/DFF 시간·파형·저장 통합 정책 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/SIMULATION.md` | .md | ACTIVE | 4상태 조합 engine·UI·검증 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/WIRE_EDITING.md` | .md | ACTIVE | 배선 조작/공식 비교/검증 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/INTERACTION.md` | .md | HISTORICAL | 초기 조작 상태/명령 경계 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/ISSUES_AND_SOLUTIONS_Codex.md` | .md | HISTORICAL | 검토서 쟁점과 해결 제안 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/PLAN.md` | .md | HISTORICAL | 초기 제품 계획/목표 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/README.md` | .md | HISTORICAL | 통합 이전 보관 자료 인덱스 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/REVIEW_RESPONSE_Claude.md` | .md | HISTORICAL | 검토서 회신/이견 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/SHORTCUTS.md` | .md | HISTORICAL | 초기 단축키 v0.1 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/SHORTCUTS_Claude_v0.3.md` | .md | HISTORICAL | Claude v0.3 단축키 대안 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/SHORTCUTS_Codex_v0.2.md` | .md | HISTORICAL | Codex v0.2 비교/추천 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/SHORTCUTS_Consolidated.md` | .md | HISTORICAL | 통합 이전 단축키 종합 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/SHORTCUTS_v0.2.md` | .md | HISTORICAL | 별도 단축키 v0.2 제안 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/USABILITY.md` | .md | HISTORICAL | 초기 사용성 검증 가설/계획 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `docs/archive/codex LF final.md` | .md | HISTORICAL | 초기 통합 설계안 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `index.html` | .html | ACTIVE | React HTML entry | Git/npm/TS/Vite/Vitest/Playwright 실행 진입 |
| `package-lock.json` | .json | ACTIVE | 의존 잠금 | Git/npm/TS/Vite/Vitest/Playwright 실행 진입 |
| `package.json` | .json | ACTIVE | npm scripts와 의존 선언 | Git/npm/TS/Vite/Vitest/Playwright 실행 진입 |
| `playwright.config.ts` | .ts | ACTIVE | browser 발견/서버 | Git/npm/TS/Vite/Vitest/Playwright 실행 진입 |
| `qa-audit/20261018/AUDIT_REPORT.md` | .md | HISTORICAL | cd8bf7e 독립 통합 감사 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `qa-audit/20261018/FINDINGS.md` | .md | HISTORICAL | 독립 결함·노출·profile 근거 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `qa-audit/20261018/FIXES.md` | .md | HISTORICAL | 9c47291 수정·회귀 검증 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `qa-audit/20261018/FIX_PLAN.md` | .md | HISTORICAL | 독립 수정 순서 제안 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `qa-audit/20261018/README.md` | .md | HISTORICAL | 감사 자료/재현 배치 안내 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `qa-audit/20261018/TEST_MATRIX.md` | .md | HISTORICAL | 독립 진리표·퍼즈·브라우저/변이 범위 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `qa-audit/20261018/evidence-after/browser-profile-dev-BEFORE.json` | .json | DUPLICATE_CANDIDATE | 동일 dev profile BEFORE 대조 증거 | 전체 내용/SHA-256 확인; 역사적 문맥 보존 |
| `qa-audit/20261018/evidence-after/collision-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence-after/fix-browser-f2-lost-effects.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence-after/fix-browser-f2-matrix.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence-after/fix-browser-profile-dev.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence-after/fix-browser-results.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence-after/fix-qa-browser.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence-after/geometry-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence-after/perf-core-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence-after/prior-findings-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence-after/properties-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/bridges-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-bridges.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-f2-lost-effects.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-f2-matrix.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-focus.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-invalid.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-performance.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-presets.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-profile-dev.json` | .json | DUPLICATE_CANDIDATE | 동일 dev profile BEFORE 대조 증거 | 전체 내용/SHA-256 확인; 역사적 문맥 보존 |
| `qa-audit/20261018/evidence/browser-profile-prod.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-properties.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-bridges.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-closeup.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-f2.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-f2b.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-invalid.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-perf.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-presets.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-profile.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-props.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-props2.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-shapes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-viewport.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-qa-viewport2.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-results.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/browser-viewports.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/collision-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/existing-unit-results.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/fuzz-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/geometry-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M01-invert-Z-keeps-Z.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M02-xor-parity-reversed.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M03-and-controlling-zero-ignored.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M04-conflict-severity-warning.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M05-scc-objects-truncated.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M06-input-count-off-by-one.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M07-pin-ids-regenerated-on-resize.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M08-history-recorded-twice.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M09-bridge-mutates-connectivity.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M10-input-inversion-not-applied.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M11-xnor-not-inverted.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M12-resolve-X-with-0-gives-0.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M13-floating-input-diag-removed.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M14-removed-pin-records-kept.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M15-output-pin-index-not-updated.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M16-connected-removal-allowed.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M17-validator-skips-pin-ownership.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M18-feedback-gates-computed-anyway.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M19-undo-forgets-future.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-M20-wire-bridge-radius-unbounded.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-existingUnit-baseline.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M01-invert-Z-keeps-Z.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M02-xor-parity-reversed.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M03-and-controlling-zero-ignored.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M04-conflict-severity-warning.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M05-scc-objects-truncated.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M06-input-count-off-by-one.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M07-pin-ids-regenerated-on-resize.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M08-history-recorded-twice.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M09-bridge-mutates-connectivity.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M10-input-inversion-not-applied.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M11-xnor-not-inverted.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M12-resolve-X-with-0-gives-0.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M13-floating-input-diag-removed.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M14-removed-pin-records-kept.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M15-output-pin-index-not-updated.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M16-connected-removal-allowed.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M17-validator-skips-pin-ownership.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M18-feedback-gates-computed-anyway.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M19-undo-forgets-future.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-M20-wire-bridge-radius-unbounded.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mut-qa-baseline.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/mutation-results.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/oracle-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/perf-core-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/prior-findings-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/probe-proto-ids.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/probe-waypoint-rejections.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/probe-wire-collisions-count.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/probe-wire-collisions.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/evidence/properties-outcomes.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/bridges.spec.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/closeup.spec.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/f2.spec.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/gen.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/invalid.spec.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/lib.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/perf.spec.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/presets.spec.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/profile.spec.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/props.spec.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/shapes.spec.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/browser/viewport.spec.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/config/qa-playwright.config.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/config/qa.vitest.config.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/bridges.test.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/collisions.test.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/fuzz.test.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/geometry.test.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/helpers.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/mutate.mjs` | .mjs | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/oracle.test.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/perf.test.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/prior.test.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/probe-proto.test.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/probe-wires.test.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/properties.test.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/qa-tests/unit/reference.ts` | .ts | HISTORICAL | 독립 재현 테스트/config/harness | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/bridge-selected-100.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/bridge-zoom-0.1.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/bridge-zoom-0.25.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/bridge-zoom-0.5.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/bridge-zoom-1.5.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/bridge-zoom-1.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/bridge-zoom-2.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/bridge-zoom-min-selected.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/closeup-AND16-top.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/closeup-OR16-top.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/closeup-XOR16-top.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/gallery-rot0-inverted.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/gallery-rot0-plain.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/gallery-rot90-inverted.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/gallery-rot90-plain.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/invalid-circuit-display.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/perf-1000-gates.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1024x420-main.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1024x420-properties16.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1024x420-settings.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1024x768-main.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1024x768-properties16.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1024x768-settings.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1440x900-main.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1440x900-properties16.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1440x900-settings.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1920x1080-main.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1920x1080-properties16.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/viewport-1920x1080-settings.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/xor16-inverted-rot0.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/xor16-inverted-rot90-closeup.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/xor16-inverted-rot90.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/zoom-0.1-xor16.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/zoom-0.25-xor16.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/zoom-0.5-xor16.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/zoom-1-xor16.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/zoom-1.5-xor16.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261018/screens/zoom-2-xor16.png` | .png | HISTORICAL | 생성된 화면 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `qa-audit/20261019/evidence-integration/verification-summary.json` | .json | HISTORICAL | 생성된 JSON 검증 증거 | 날짜별 README/TEST_MATRIX/보고서 문맥; 기본 CI 제외 |
| `review/AUDIT_7ae3b32.md` | .md | HISTORICAL | 7ae3b32 독립 감사 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/CAD_FEATURE_GAP_20261019.md` | .md | HISTORICAL | 타 CAD 대비 기능 gap 조사 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/CAD_HANDOFF_VERDICT_20261019.md` | .md | HISTORICAL | UI 완료·184 항목 범위 판정/T1 인계 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/CAD_SCOPE_GAP_20261019.md` | .md | HISTORICAL | 제품 범위 안의 미구현 gap | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/CLAUDE_logic-simulation_verification_eb44fc5.md` | .md | HISTORICAL | eb44fc5 독립 계산/조작/변이 검증 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/LOGIC_FORGE_ADOPTION_20261019.md` | .md | HISTORICAL | 참고 프로젝트와 순차 도입 제안 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/QA_FIXES_20261016.md` | .md | HISTORICAL | QA disposition·몸체/핀 승인 정책 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/QA_HANDOFF_51552a7.md` | .md | HISTORICAL | 51552a7 독립 QA/실패 재현 인계 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/QA_INTEGRATION_READINESS_20261019.md` | .md | HISTORICAL | b06adc4 통합 준비·잔여 문제 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/QA_INTEGRATION_RESULT_20261019.md` | .md | HISTORICAL | d42f456 통합 정책·검증 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/REVIEW.md` | .md | HISTORICAL | 2c52562 독립 review와 repro | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/REVIEW_RESPONSE.md` | .md | HISTORICAL | 초기 review 수용/보류 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/SEQUENTIAL_IMPLEMENTATION_20261019.md` | .md | HISTORICAL | 373fb5b 순차 구현/검증 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/UI_AUDIT_RESPONSE_20261019.md` | .md | HISTORICAL | UX 감사 후속 수용/보류·검증 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/UI_WORKSPACE_REFRESH_20261019.md` | .md | HISTORICAL | UI shell/Inspector/상태바·촬영 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/UX_CRITICAL_AUDIT_20261019.md` | .md | HISTORICAL | 미커밋 UI/구 Pages 실측 독립 감사 | 문서/인덱스·이력 참조; 권위 표 대조 |
| `review/review_repro.spec.ts` | .ts | HISTORICAL | 과거 결함 재현 코드 | REVIEW.md 복사 실행 안내; 기본 CI 제외 |
| `review/review_repro.test.ts` | .ts | HISTORICAL | 과거 결함 재현 코드 | REVIEW.md 복사 실행 안내; 기본 CI 제외 |
| `scripts/assemble-pages.mjs` | .mjs | ACTIVE | Pages 조립/검증 | build-pages workflow 직접 호출 |
| `scripts/capture-workspace.mjs` | .mjs | ACTIVE | 수동 UI 촬영 | UI_WORKSPACE_REFRESH에서 참조 |
| `scripts/check-pages.mjs` | .mjs | ACTIVE | Pages 조립/검증 | build-pages workflow 직접 호출 |
| `src/config/app-mode.ts` | .ts | ACTIVE | Vite mode와 settingsKey | 직접 import 참조 6곳 |
| `src/editor/dispatcher.ts` | .ts | ACTIVE | 명령 metadata 검사/handler dispatch | 직접 import 참조 2곳 |
| `src/editor/editor.ts` | .ts | ACTIVE | Circuit·draft·history·selection·view 소유 | 직접 import 참조 12곳 |
| `src/geometry/connection-hit.ts` | .ts | ACTIVE | 핀/접속점/선분의 연결 hit | 직접 import 참조 5곳 |
| `src/geometry/geometry.ts` | .ts | ACTIVE | snap/rotate와 Logic pin/선택/연결유지 transform | 직접 import 참조 24곳 |
| `src/geometry/path.ts` | .ts | ACTIVE | 점 비교/투영/경로 정리/경유점 offset | 직접 import 참조 16곳 |
| `src/geometry/routing.ts` | .ts | ACTIVE | Logic obstacle·우회·routing 설정 | 직접 import 참조 10곳 |
| `src/geometry/selection-hit.ts` | .ts | ACTIVE | 화면 거리 기반 배선 선택 후보 | 직접 import 참조 2곳 |
| `src/geometry/view.ts` | .ts | ACTIVE | 줌 수학/게이트 bounds 화면 맞춤 | 직접 import 참조 4곳 |
| `src/geometry/wire-bridges.ts` | .ts | ACTIVE | 미접속 교차 점프 표시/설정 | 직접 import 참조 4곳 |
| `src/geometry/wire-edit.ts` | .ts | ACTIVE | 선분/코너/jog와 endpoint 보존 교체 | 직접 import 참조 5곳 |
| `src/geometry/wire-overlaps.ts` | .ts | ACTIVE | 다른 net 공선 겹침 경고 | 직접 import 참조 3곳 |
| `src/input/connection-intent.ts` | .ts | ACTIVE | 몸체 선택/핀 연결 우선 해석 | 직접 import 참조 3곳 |
| `src/input/data/command-registry.seed.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: command-registry.seed | profiles/registry 직접 import |
| `src/input/data/native-extensions.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: native-extensions | profiles/registry 직접 import |
| `src/input/data/preset-catalog.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: preset-catalog | profiles/registry 직접 import |
| `src/input/data/presets/altium-designer-2026.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: altium-designer-2026 | profiles eager glob |
| `src/input/data/presets/circlith-modern.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: circlith-modern | profiles eager glob |
| `src/input/data/presets/easyeda-pro.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: easyeda-pro | profiles eager glob |
| `src/input/data/presets/figma-modern-canvas.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: figma-modern-canvas | profiles eager glob |
| `src/input/data/presets/fusion-electronics-2026.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: fusion-electronics-2026 | profiles eager glob |
| `src/input/data/presets/fusion-navigation.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: fusion-navigation | profiles eager glob |
| `src/input/data/presets/kicad-9.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: kicad-9 | profiles eager glob |
| `src/input/data/presets/shapr3d-navigation.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: shapr3d-navigation | profiles eager glob |
| `src/input/data/profile-adaptations.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: profile-adaptations | profiles/registry 직접 import |
| `src/input/data/schema/input-profile.schema.json` | .json | ACTIVE | 입력 프로필 런타임 데이터: input-profile.schema | profiles/registry 직접 import |
| `src/input/profiles.ts` | .ts | ACTIVE | Ajv·preset/override·저장 형식 검증 | 직접 import 참조 3곳 |
| `src/input/registry.ts` | .ts | ACTIVE | 명령 seed·구현 availability | 직접 import 참조 4곳 |
| `src/input/resolver.ts` | .ts | ACTIVE | 키 sequence·wheel·mouse/context 해석 | 직접 import 참조 3곳 |
| `src/input/types.ts` | .ts | ACTIVE | binding/profile/context·충돌/signature | 직접 import 참조 6곳 |
| `src/main.tsx` | .tsx | ACTIVE | React 앱 mount | HTML entry |
| `src/model/circuit.ts` | .ts | ACTIVE | Logic kind/pin/net/geometry·ID·연결 | 직접 import 참조 49곳 |
| `src/model/component-properties.ts` | .ts | ACTIVE | 핀수/반전/이름/시간 속성 원자 갱신 | 직접 import 참조 6곳 |
| `src/model/connections.ts` | .ts | ACTIVE | 명시적 분기/교차/연결·회로 무결성 | 직접 import 참조 16곳 |
| `src/model/deletion.ts` | .ts | ACTIVE | 부품/배선 삭제와 dangling 연결 보존 | 직접 import 참조 3곳 |
| `src/model/temporal-properties.ts` | .ts | ACTIVE | Clock/DFF 기본·속성 validator | 직접 import 참조 6곳 |
| `src/model/wire-cleanup.ts` | .ts | ACTIVE | 같은 net 중복 경로 계획/적용 검증 | 직접 import 참조 3곳 |
| `src/renderer/CircuitSvg.tsx` | .tsx | ACTIVE | Logic 심벌/배선/핀/신호/강조 SVG | 직접 import 참조 2곳 |
| `src/renderer/GateBody.tsx` | .tsx | ACTIVE | gate/Input/Output/Clock/DFF 심벌 | 직접 import 참조 3곳 |
| `src/renderer/WireHandles.tsx` | .tsx | ACTIVE | Circuit 선택 배선 편집 handles | 직접 import 참조 1곳 |
| `src/simulation/logic.ts` | .ts | ACTIVE | 0/1/X/Z 반전/구동/게이트 평가 | 직접 import 참조 11곳 |
| `src/simulation/simulator.ts` | .ts | ACTIVE | validator·SCC·compile/evaluate·진단 | 직접 import 참조 11곳 |
| `src/simulation/time-session.ts` | .ts | ACTIVE | 정수시간·Clock/DFF·step/watch/trace | 직접 import 참조 4곳 |
| `src/ui/App.tsx` | .tsx | ACTIVE | Editor/입력/시뮬/UI/DOM gesture 통합 | 직접 import 참조 1곳 |
| `src/ui/ComponentProperties.tsx` | .tsx | ACTIVE | Logic 속성 modal와 Apply | 직접 import 참조 1곳 |
| `src/ui/DrawingWarnings.tsx` | .tsx | ACTIVE | 배선 겹침 경고와 locate | 직접 import 참조 1곳 |
| `src/ui/EditorSidebar.tsx` | .tsx | ACTIVE | Logic library/도면트리·검색·선택 | 직접 import 참조 1곳 |
| `src/ui/InputSettings.tsx` | .tsx | ACTIVE | profile/override/routing/bridge 설정 UI | 직접 import 참조 1곳 |
| `src/ui/InspectorPanel.tsx` | .tsx | ACTIVE | Logic 선택·속성/신호/net 요약 | 직접 import 참조 1곳 |
| `src/ui/SimulationPanel.tsx` | .tsx | ACTIVE | Logic 입력/출력/diagnostic 조작 | 직접 import 참조 2곳 |
| `src/ui/StatusBar.tsx` | .tsx | ACTIVE | 도구·선택·줌·profile 상태 | 직접 import 참조 1곳 |
| `src/ui/TimeControls.tsx` | .tsx | ACTIVE | Logic Run/Pause/Step/Reset·clock 선택 | 직접 import 참조 1곳 |
| `src/ui/WaveformPanel.tsx` | .tsx | ACTIVE | Logic watch/sample/cursor UI | 직접 import 참조 1곳 |
| `src/ui/WorkspaceHeader.tsx` | .tsx | ACTIVE | 이름/이력/도구/시뮬 설정 헤더 | 직접 import 참조 1곳 |
| `src/ui/circuit-labels.ts` | .ts | ACTIVE | Logic 부품/핀/net 공유 표시명 | 직접 import 참조 10곳 |
| `src/ui/keyboardAdapter.ts` | .ts | ACTIVE | React keyboard와 resolver/rollback 연결 | 직접 import 참조 1곳 |
| `src/ui/sequential.css` | .css | ACTIVE | 시간 제어/파형 전용 스타일 | 직접 import 참조 1곳 |
| `src/ui/style.css` | .css | ACTIVE | 앱 기본/도면/설정 UI 전역 스타일 | 직접 import 참조 1곳 |
| `src/ui/useTimeSession.ts` | .ts | ACTIVE | React 세션/입력 sync·timer/hidden pause | 직접 import 참조 2곳 |
| `src/ui/workspace.css` | .css | ACTIVE | header/sidebar/inspector/dock 반응형 | 직접 import 참조 1곳 |
| `src/vite-env.d.ts` | .ts | ACTIVE | Vite ambient types | TypeScript/CSS 설정 또는 진입점 |
| `tests/browser/adversarial-latest.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: adversarial-latest.spec | Playwright testDir / spec import |
| `tests/browser/audit-regressions.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: audit-regressions.spec | Playwright testDir / spec import |
| `tests/browser/component-properties.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: component-properties.spec | Playwright testDir / spec import |
| `tests/browser/context-menu.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: context-menu.spec | Playwright testDir / spec import |
| `tests/browser/control-regressions.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: control-regressions.spec | Playwright testDir / spec import |
| `tests/browser/delete-and-gates.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: delete-and-gates.spec | Playwright testDir / spec import |
| `tests/browser/drag-wiring.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: drag-wiring.spec | Playwright testDir / spec import |
| `tests/browser/editor.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: editor.spec | Playwright testDir / spec import |
| `tests/browser/input-settings.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: input-settings.spec | Playwright testDir / spec import |
| `tests/browser/qa-fixes.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: qa-fixes.spec | Playwright testDir / spec import |
| `tests/browser/routing-settings.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: routing-settings.spec | Playwright testDir / spec import |
| `tests/browser/selection-pan.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: selection-pan.spec | Playwright testDir / spec import |
| `tests/browser/sequential.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: sequential.spec | Playwright testDir / spec import |
| `tests/browser/settings-isolation.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: settings-isolation.spec | Playwright testDir / spec import |
| `tests/browser/sidebar.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: sidebar.spec | Playwright testDir / spec import |
| `tests/browser/simulation.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: simulation.spec | Playwright testDir / spec import |
| `tests/browser/ux-audit-followups.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: ux-audit-followups.spec | Playwright testDir / spec import |
| `tests/browser/wire-bridges.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: wire-bridges.spec | Playwright testDir / spec import |
| `tests/browser/wire-cleanup.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: wire-cleanup.spec | Playwright testDir / spec import |
| `tests/browser/wire-edit.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: wire-edit.spec | Playwright testDir / spec import |
| `tests/browser/wire-junctions.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: wire-junctions.spec | Playwright testDir / spec import |
| `tests/browser/wire-selection.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: wire-selection.spec | Playwright testDir / spec import |
| `tests/browser/workspace.spec.ts` | .ts | ACTIVE | 브라우저 회귀/보조: workspace.spec | Playwright testDir / spec import |
| `tests/browser/zoom-helper.ts` | .ts | ACTIVE | 브라우저 회귀/보조: zoom-helper | Playwright testDir / spec import |
| `tests/unit/adversarial-latest.test.ts` | .ts | ACTIVE | 단위 회귀: adversarial-latest.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/audit-regressions.test.ts` | .ts | ACTIVE | 단위 회귀: audit-regressions.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/component-properties.test.ts` | .ts | ACTIVE | 단위 회귀: component-properties.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/connection-intent.test.ts` | .ts | ACTIVE | 단위 회귀: connection-intent.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/connections.test.ts` | .ts | ACTIVE | 단위 회귀: connections.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/control-regressions.test.ts` | .ts | ACTIVE | 단위 회귀: control-regressions.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/delete-and-gates.test.ts` | .ts | ACTIVE | 단위 회귀: delete-and-gates.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/drawing-feedback.test.ts` | .ts | ACTIVE | 단위 회귀: drawing-feedback.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/editor.test.ts` | .ts | ACTIVE | 단위 회귀: editor.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/input.test.ts` | .ts | ACTIVE | 단위 회귀: input.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/qa-integration-followups.test.ts` | .ts | ACTIVE | 단위 회귀: qa-integration-followups.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/routing.test.ts` | .ts | ACTIVE | 단위 회귀: routing.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/selection-hit.test.ts` | .ts | ACTIVE | 단위 회귀: selection-hit.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/selection.test.ts` | .ts | ACTIVE | 단위 회귀: selection.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/simulation.test.ts` | .ts | ACTIVE | 단위 회귀: simulation.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/time-session.test.ts` | .ts | ACTIVE | 단위 회귀: time-session.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/wire-bridges.test.ts` | .ts | ACTIVE | 단위 회귀: wire-bridges.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/wire-cleanup.test.ts` | .ts | ACTIVE | 단위 회귀: wire-cleanup.test | Vitest include tests/unit/**/*.test.ts |
| `tests/unit/wire-edit.test.ts` | .ts | ACTIVE | 단위 회귀: wire-edit.test | Vitest include tests/unit/**/*.test.ts |
| `tsconfig.json` | .json | ACTIVE | strict TS 해석 | Git/npm/TS/Vite/Vitest/Playwright 실행 진입 |
| `vite.config.ts` | .ts | ACTIVE | 단일 앱/base/출처 stamp | Git/npm/TS/Vite/Vitest/Playwright 실행 진입 |
| `vitest.config.ts` | .ts | ACTIVE | unit 발견 | Git/npm/TS/Vite/Vitest/Playwright 실행 진입 |
