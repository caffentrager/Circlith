# 후속 구현자 인계서

2026-10-19 Asia/Seoul · PR-0 감사 기준 `f59efd2755e31be9b1bb4f70514cb20680421be7`.

**이 문서는 작업 분할 제안이다. PR-1 이후 실행 승인을 대신하지 않는다.** 기존 [Master Spec](../CIRCLITH_MASTER_SPEC.md)이 유일한 기준이며 플랫폼 제안은 보완/미래 설계다.

## 인수 시 먼저 실행할 것

```sh
git status --short
git branch -a
git log --oneline -20
git remote -v
git fetch origin
git ls-remote --symref origin HEAD
git worktree list --porcelain
```

dirty 상태면 덮어쓰기·stash·reset·clean 없이 변경 소유자와 안전한 worktree를 먼저 보고한다. 로컬 main은 감사 시 `982bf5c`로 원격보다 4커밋 뒤였다. 로컬 main을 최신이라 가정하지 않는다. 사용자와 다른 에이전트가 작업하는 worktree를 수정하지 않는다. `.claude/worktrees`, `build/*`에는 실제 checkout이 있다.

읽는 순서: [Repository Index](../REPOSITORY_INDEX.md) → Master Spec → [Repository Audit](REPOSITORY_AUDIT.md) → [Branch Audit](BRANCH_AUDIT.md) → [Documentation Audit](DOCUMENTATION_AUDIT.md) → [Architecture](PLATFORM_ARCHITECTURE.md) → [Migration Plan](MIGRATION_PLAN.md).

## 현재 사실과 미통합 작업

main은 단일 앱에서 Logic 편집·조합논리·Clock/DFF 시간 시뮬레이션·파형을 제공한다. Project 다중 문서, Logic/Electronics runtime 탭, Electronics 엔진, circuit 파일 저장·복구·clipboard는 main에 없다. Vite editor 모드는 개발용이고 공개 배포는 simulation build 한 개다.

`claude/storage-recovery@90f0a39`는 v1 파일·복구, `claude/clipboard-duplicate@8b55eef`는 T1 기반 복사/붙여넣기/PASTE 초안을 포함한다. 둘 다 main에 없는 고유 패치다. branch 전체 diff의 순차회로 삭제 표시를 기능 삭제 의도로 해석하지 않는다. 공통 조상 `fc6520c` 이후 각자 변경을 3-way로 평가한다. T2는 T1에 의존한다. 구 sanitizer가 새 kind·clock/dff 설계 속성을 모두 보존하는지 확인하지 않고 merge하지 않는다.

## PR 의존 관계와 소유권

```text
PR-0 audit → [T1/T2 통합 방향 + 파일 호환 정책 검토]
           → PR-1 project/document model
           → PR-2 runtime shell
           → PR-3a/3b/3c Logic isolation / input / pure CAD
           → PR-4 persistence
           → PR-5 Electronics skeleton
           → PR-6 Electronics model
           → PR-7 engine integration
```

각 화살표는 검증과 리뷰가 끝나야 다음 구현을 시작한다는 뜻이다. T1/T2 통합은 별도 기능 PR이며 PR-0에 끼워 넣지 않는다. PR별 Goal/Prerequisites/Target files/Expected changes/Potential regressions/Required tests/Completion criteria/Rollback은 Migration Plan에 모두 있다.

| 담당 영역 | 소유 파일·책임 | 타 영역 수정 규칙 |
|---|---|---|
| Platform | project/document runtime, shell, 저장 coordinator, 공개 workspace 계약 | domain internals를 import/해석하지 않음 |
| Logic 담당 | 기존 editor/model/renderer/simulation 및 Logic UI | common 계약 변경은 소비자 양쪽 영향 제시 |
| Electronics 담당 | 신규 electronics model/editor/engine adapter/codec | Logic Editor·Net 재사용/개조 금지, common 공개 기능만 사용 |
| Common 담당(초기에는 platform reviewer) | 순수 CAD/input/UI 프레임 계약 | 소유자 한 명이 병합 조정, 양쪽 회귀 검증 필요 |

두 AI가 병렬 구현할 때도 main·공통 파일·lockfile을 동시에 편집하지 않는다. 각 작업은 별도 브랜치/worktree를 사용한다. PR-1/2/3 공통 계약이 확정되기 전에는 Electronics 구현 대신 명세 검토·fixture 설계만 독립 진행 가능하다. 이 인계서는 이번 감사에서 별도 에이전트를 실행했다는 뜻이 아니다.

## 보존할 계약

- Circuit component/pin/net/junction/geometry 구조와 ID, 명시적 접속 의미, 점 없는 교차의 미접속.
- draft는 preview만 바꾸고 commit 하나는 history 하나. 초안 Undo는 취소부터, 실패는 회로/history/future 불변.
- 배치·선택·이동·회전·Properties·핀 소유권과 경유점 보존, 10–800% 줌·커서 중심·패널 focus·IME 보호.
- 4상태 평가·Logic diagnostics, DFF 동시 샘플링·초기 상태·불명 엣지·시간 정밀도·안전 한도.
- 편집 history와 시뮬레이션 Input/Q/time/watch/waveform 분리. 확정 회로 편집·Undo/Redo 후 pause/t=0.
- `circlith.simulation.*` 운영 설정 키, `circlith.*` 개발 editor 설정 격리. 새 namespace 도입 시 기존 값을 삭제/자동 초기화하지 않음.
- main 전용 Pages 게시, `/Circlith/` simulation 단일 산출물, 과거 `/simulation/`·`/editor/` 404, build-info/deployment의 commit 일치.

## 검증과 PR 리뷰 패킷

기본 명령은 기존 package scripts를 그대로 사용한다. [Pages Deployment](../PAGES_DEPLOYMENT.md)의 simulation build → **존재하지 않는** 목적지 assemble → check-pages를 포함한다. 2026-10-19 로컬 환경·성공/차단·재실행 결과는 Repository Audit에 기록했다. CI Node 22.23.3과 이번 로컬 Node 24.19.0의 차이도 표시한다. QA archive의 mutation harness를 production checkout에서 실행하지 않는다.

PR에는 기준 SHA, diff 범위·소유자, Master Spec DEC 영향, 기존 형식/설정 호환, 새 테스트의 실제 사용자 시나리오, 전체 테스트/Pages 결과, rollback을 적는다. 테스트 기대값 변경은 migration 자체의 증거가 아니며 계산·조작 변경이 필요하면 별도 승인/PR로 나눈다. 파일 이동 PR은 `git diff --find-renames`와 import 변화/내용 변화를 구분해 검토한다.

최종 점검은 `git status --short`, `git diff --check`, `git diff --stat`와 새 파일까지 포함한 목록이다. 모노레포·명세 교체·대량 이동·브랜치 삭제·배포 정책 변경은 별도 사용자 결정이다. main에 보호 규칙이 없다는 감사 결과만으로 보호 설정을 변경하지 않는다.
