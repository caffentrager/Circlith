# Git Branch Audit

2026-10-19 Asia/Seoul · 원격 재조회 기준 main `f59efd2755e31be9b1bb4f70514cb20680421be7`.

아래 ref·SHA·게시 여부는 PR-0 문서를 커밋하기 전 감사 시점의 snapshot이다. 후속 감사 브랜치 게시로 생기는 ref·PR·CI는 Git 이력과 PR에서 확인하며, 아래 과거 비교 기준을 현재 상태로 덮어쓰지 않는다.

**브랜치 삭제·merge·rebase·tag 변경은 수행하지 않았다.** 기존 로컬 main은 그대로다. 신규 `chore/repository-preparation`만 원격 main 기준으로 만들었다. [Repository Audit](REPOSITORY_AUDIT.md)과 함께 읽는다.

## 조회 방법과 해석

시작 시 status/branch/log -20/remote를 확인했다. clean tree를 확인한 후 `git fetch origin`(prune 없음), `git ls-remote --symref origin HEAD`, GitHub branches API 전체 결과로 최신 SHA·기본 branch·protected 상태를 재확인했다. 로컬 refs는 `git for-each-ref`, worktree는 `git worktree list --porcelain`로 조사했다. origin/HEAD는 symbolic ref이며 별도 branch로 세지 않는다.

각 ref에 `git merge-base`, `git rev-list --left-right --count origin/main...REF`, `git log origin/main..REF`, `git cherry origin/main REF`, 공통 조상→branch의 실제 diff와 main→branch의 tree diff를 비교했다. 통합된 조상 branch도 해당 tip의 변경 이력을 확인했다. 아래 “main만/branch만”은 symmetric difference 커밋 수다. 동일 patch-id가 나오면 cherry는 `-`, 고유 patch는 `+`이다. merge-base만으로 squash/cherry-pick 통합을 추정하지 않았다.

원격 branch 9개와 로컬 branch 11개(신규 감사 branch 포함)를 모두 아래에 표시했다. 동일 tip인 local/origin ref도 이름을 명시한다. 마지막 변경 시각은 commit의 committer date이며 branch ref 자체의 생성·수정 시각은 아니다. 날짜는 원래 offset(+09:00)을 보존했다.

## 전체 ref snapshot

| ref | HEAD SHA | 마지막 commit 시각 | main만 / branch만 | main에도 도달 가능한 commit 수 | 공통 조상 SHA |
|---|---|---|---|---|---|
| `chore/repository-preparation` | `f59efd2755e31be9b1bb4f70514cb20680421be7` | 2026-10-19T13:36:20+09:00 | 0 / 0 | 47 | `f59efd2755e31be9b1bb4f70514cb20680421be7` |
| `claude/clipboard-duplicate` | `8b55eefbac010408d24cfea67d4e2a8c9a2b2591` | 2026-10-19T13:51:32+09:00 | 2 / 2 | 45 | `fc6520c682afa8708fe0b12f2ae7cbff3034bb8d` |
| `claude/storage-recovery` | `90f0a393e5c137c946b6e9a6227a3c584177c129` | 2026-10-19T13:23:25+09:00 | 2 / 1 | 45 | `fc6520c682afa8708fe0b12f2ae7cbff3034bb8d` |
| `codex/logic-simulation` | `f1d9d8aaadc15a3d18856ef6568e2dccf4018aaf` | 2026-10-18T23:10:58+09:00 | 17 / 0 | 30 | `f1d9d8aaadc15a3d18856ef6568e2dccf4018aaf` |
| `codex/pages-single-circlith` | `f59efd2755e31be9b1bb4f70514cb20680421be7` | 2026-10-19T13:36:20+09:00 | 0 / 0 | 47 | `f59efd2755e31be9b1bb4f70514cb20680421be7` |
| `codex/qa-integration-20261019` | `d42f456dbafe42d6f9e04ca4f6eecefe934ec197` | 2026-10-19T01:29:38+09:00 | 6 / 0 | 41 | `d42f456dbafe42d6f9e04ca4f6eecefe934ec197` |
| `codex/sequential-simulation` | `373fb5b165f94082bd527e59c4788e07215c197e` | 2026-10-19T13:28:14+09:00 | 1 / 0 | 46 | `373fb5b165f94082bd527e59c4788e07215c197e` |
| `codex/symbol-refresh` | `afa72a7dc3d31d97b314ae954be2b8a803210e09` | 2026-10-19T00:51:58+09:00 | 12 / 0 | 35 | `afa72a7dc3d31d97b314ae954be2b8a803210e09` |
| `codex/ui-workspace-refresh` | `fc6520c682afa8708fe0b12f2ae7cbff3034bb8d` | 2026-10-19T12:53:22+09:00 | 2 / 0 | 45 | `fc6520c682afa8708fe0b12f2ae7cbff3034bb8d` |
| `feat/editor-prototype` | `552febacb8e56a536e2f6d6392a6b3b05a868097` | 2026-10-18T22:21:01+09:00 | 23 / 1 | 24 | `045a293bf17d5d4c90e8ebab90e07a0b5ed1ba35` |
| `main` | `982bf5c5ecf3268d583d6a1cb23afed84c24b355` | 2026-10-19T01:29:45+09:00 | 4 / 0 | 43 | `982bf5c5ecf3268d583d6a1cb23afed84c24b355` |
| `origin/codex/logic-simulation` | `f1d9d8aaadc15a3d18856ef6568e2dccf4018aaf` | 2026-10-18T23:10:58+09:00 | 17 / 0 | 30 | `f1d9d8aaadc15a3d18856ef6568e2dccf4018aaf` |
| `origin/codex/pages-single-circlith` | `f59efd2755e31be9b1bb4f70514cb20680421be7` | 2026-10-19T13:36:20+09:00 | 0 / 0 | 47 | `f59efd2755e31be9b1bb4f70514cb20680421be7` |
| `origin/codex/qa-integration-20261019` | `d42f456dbafe42d6f9e04ca4f6eecefe934ec197` | 2026-10-19T01:29:38+09:00 | 6 / 0 | 41 | `d42f456dbafe42d6f9e04ca4f6eecefe934ec197` |
| `origin/codex/sequential-simulation` | `373fb5b165f94082bd527e59c4788e07215c197e` | 2026-10-19T13:28:14+09:00 | 1 / 0 | 46 | `373fb5b165f94082bd527e59c4788e07215c197e` |
| `origin/codex/symbol-refresh` | `afa72a7dc3d31d97b314ae954be2b8a803210e09` | 2026-10-19T00:51:58+09:00 | 12 / 0 | 35 | `afa72a7dc3d31d97b314ae954be2b8a803210e09` |
| `origin/codex/ui-workspace-refresh` | `fc6520c682afa8708fe0b12f2ae7cbff3034bb8d` | 2026-10-19T12:53:22+09:00 | 2 / 0 | 45 | `fc6520c682afa8708fe0b12f2ae7cbff3034bb8d` |
| `origin/feat/editor-prototype` | `552febacb8e56a536e2f6d6392a6b3b05a868097` | 2026-10-18T22:21:01+09:00 | 23 / 1 | 24 | `045a293bf17d5d4c90e8ebab90e07a0b5ed1ba35` |
| `origin/main` | `f59efd2755e31be9b1bb4f70514cb20680421be7` | 2026-10-19T13:36:20+09:00 | 0 / 0 | 47 | `f59efd2755e31be9b1bb4f70514cb20680421be7` |
| `origin/qa/independent-audit-20261018` | `9c47291209a7d30b52d7b86be5c4010df64b4771` | 2026-10-19T00:50:54+09:00 | 11 / 0 | 36 | `9c47291209a7d30b52d7b86be5c4010df64b4771` |

## 분류와 권고

| branch (local/origin 해당 시 모두) | 추천 | 통합/내용 근거 및 보존 이유 |
|---|---|---|
| main / origin/main | KEEP_ACTIVE | 기본 서비스 기준. 로컬은 982bf5c로 뒤처짐, 이번에 갱신하지 않음 |
| chore/repository-preparation (local) | KEEP_ACTIVE | 이번 PR-0 문서 작업. 원격 branch/push 없음 |
| claude/storage-recovery (local only) | KEEP_ACTIVE | 90f0a39 파일 저장·열기·새 도면·자동 복구 고유 1커밋. main 미통합, 아직 유효한 기능 작업 |
| claude/clipboard-duplicate (local only) | KEEP_ACTIVE | T1+8b55eef 고유 2커밋. PASTE 초안·clipboard·Duplicate. 별도 worktree 작업 보존 |
| codex/logic-simulation | KEEP_REFERENCE | tip f1d9d8a 및 모든 조상 main에 포함. 4상태·속성/입력수 변경의 비교 기준 |
| codex/sequential-simulation | KEEP_REFERENCE | tip 373fb5b main 직계 조상. Clock/DFF/시간/파형은 현재 main에 존속 |
| codex/symbol-refresh | KEEP_REFERENCE | afa72a7은 9f650c2 merge를 통해 통합. 심벌 크기·핀/표시 회귀 비교 기준 |
| codex/ui-workspace-refresh | KEEP_REFERENCE | fc6520c까지 main 조상. UI·UX 응답·CAD 범위 판정의 인계 기준 |
| codex/qa-integration-20261019 | KEEP_REFERENCE | d42f456은 982bf5c merge를 통해 통합. 입력/경유점/진단 수정 이력 |
| codex/pages-single-circlith | KEEP_REFERENCE | tip과 origin/main의 commit/tree가 완전히 동일. 단일 배포 전환 기준, checked-out worktree 있음 |
| qa/independent-audit-20261018 (origin only) | KEEP_REFERENCE | 9c47291과 감사 26a0eba 모두 main에 포함. 독립 감사·수정 증거 보존 |
| feat/editor-prototype | NEEDS_REVIEW | 045a293 기준 기능은 main 조상이나 tip 552feba의 CI 고유 patch는 미통합. 현재 정책으로 대체된 부분인지 확인 필요 |

이번에는 DELETE_CANDIDATE로 권고한 branch가 없다. 모든 병합 branch는 감사·회귀 재현 가치가 있다. 이름상 오래돼 보여도 삭제/아카이브를 자동 수행하지 않는다. 유지 목적을 설명한 이 표만 추가한다.

## SHA와 내용이 다른 경우의 실제 비교

### 1. 완전히 통합된 refs

logic/sequential/symbol/UI/QA integration/independent audit의 tip은 모두 원격 main의 조상이며 `git cherry` 고유 결과는 없다. 코드 내용도 main에서 확인했다. 순차회로의 `src/model/temporal-properties.ts`, `src/simulation/time-session.ts`, `src/ui/{TimeControls,WaveformPanel,useTimeSession}`와 관련 테스트가 존속한다. UI 패널·심벌·QA 회귀 테스트도 현재 트리에 있다. “branch보다 main의 diff가 많다”는 이유로 미통합이라고 판정하지 않는다.

### 2. feat/editor-prototype의 고유 CI commit

공통 조상은 `045a293bf17d5d4c90e8ebab90e07a0b5ed1ba35`. `552febacb8e56a536e2f6d6392a6b3b05a868097`은 .github/workflows/pages.yml 한 파일을 6줄 추가/32줄 삭제해 `caffentrager/Circlith/.github/workflows/deploy-pages.yml@codex/logic-simulation` 호출로 바꿨다. cherry는 `+`여서 patch-equivalent 통합 증거는 없다.

현재 main은 e734386 이후 로컬 build-pages.yml을 재사용하고 main에서만 게시하며, f59efd2에서 단일 앱 산출물로 바뀌었다. 공유 검증이라는 목적은 발전한 정책으로 충족되지만 **552feba의 정확한 변경이 squash 통합됐다고 주장하지 않는다.** 구 workflow를 되가져올 실익은 확인되지 않았다. 기록 보존 후 소유자 검토가 적절하다. `[skip ci]`는 당시 commit 메시지의 사실이며 이번 작업에서 사용하지 않았다.

### 3. storage / clipboard의 실제 고유 작업

두 branch의 공통 조상은 `fc6520c682afa8708fe0b12f2ae7cbff3034bb8d`. main 쪽 고유 commit은 373fb5b(순차)·f59efd2(단일 배포), storage 쪽은 90f0a39, clipboard 쪽은 90f0a39+8b55eef다. cherry 결과는 모두 `+`다. 실제 diff에서 storage/{document,file-gateway,recovery}, UI 문서 session/dialog/banner, fixture 및 storage 테스트를 확인했다. clipboard는 fragment/payload/service, PASTE Editor 경로·registry·테스트를 추가한다.

main→branch tree diff에는 순차 모듈/테스트가 삭제된 것처럼 표시된다. 이는 branch가 순차 추가 이전에서 갈라졌기 때문이며 branch 작성자의 삭제 의도로 단정하지 않는다. 반대로 branch를 통째로 서비스 기준으로 삼으면 순차와 단일 배포가 사라질 수 있다. 통합은 3-way와 파일별 의미 검토가 필요하며 이번 감사에서 수행하지 않았다.

storage sanitizer는 branch의 구 componentKinds를 검사하고 허용 필드만 새 객체로 복사한다. Clock/DFF kind·핀 구조와 clock/dff 속성을 함께 보존/검증하지 않으면 데이터 유실 위험이 있다. clipboard도 같은 sanitizer를 공유하므로 T1만 고쳐도 T2 round trip을 별도로 검증해야 한다. 향후 파일 버전·구 fixture 호환과 time-session 교체/초기화 규칙을 먼저 확정한다.

## 작업 트리와 현행성의 한계

시작 checkout만 clean을 확인했다. 다른 worktree의 미커밋 내용·작업자의 향후 의도는 이번 감사 범위 밖이다. KEEP_ACTIVE는 유효한 고유 기능이 있다는 권고이며 지금 사람이 편집 중이라는 단정이 아니다. GitHub PR list API(state=all, per_page=100)는 이번 조회에서 빈 목록을 반환했으므로 merge 여부는 PR 번호 대신 Git DAG와 patch/content를 근거로 했다.

GitHub protected=false는 모든 원격 branch에서 관측했다. main protection API는 404 “Branch not protected”, rulesets API는 빈 배열이었다. 보호 정책 추가는 권고만 하며 변경하지 않았다. branch 이름 변경·삭제·보관 tag 생성·worktree 제거는 이후 승인 대상이다.
