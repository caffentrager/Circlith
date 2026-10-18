# QA 브랜치 반영 준비 결과 — 2026-10-19

## 기준과 범위

- 현재 서비스/main: `9f650c209ec5d76ef40a92456b24a9f4c5dc165b`.
- 검토한 Claude 브랜치: `qa/independent-audit-20261018`, 수정 커밋 `9c47291209a7d30b52d7b86be5c4010df64b4771`.
- QA 브랜치는 감사 자료 `26a0eba`와 실제 수정 `9c47291`의 두 커밋이다.
- 로컬 통합 후보: `codex/qa-integration-20261019`, 작업 폴더 `D:/Circlith/build/qa-integration-20261019`.
- 요청 범위는 반영 준비다. main 병합·푸시·배포는 수행하지 않았다. 외형은 후속 재작업 대상으로 두고 기능 검증을 우선했다.

## 포함되는 수정

- F1: 실제 net과 부동 핀 신호의 키 공간을 분리해 ID 충돌에 의한 오계산 방지.
- F2: Input 중앙의 드래그·MMB/RMB·Space·수식키를 도면 제스처에 전달하고, 이동 없는 일반 좌클릭만 토글. 클릭한 Input을 선택하므로 다음 Delete는 해당 Input에 적용된다.
- F3: 손상된 회로 레코드를 예외 대신 검증 오류/INVALID_CIRCUIT로 반환.
- N1: 입력 수 변경으로 새로 몸체를 관통하는 배선을 우회하고, 우회 불가능하면 원자적으로 거부.
- N2/N3: 입력 버블 간격 방어, 고정 경유점 손실·불명확한 거부 일부 수정. N3 잔여 사례는 아래 참고.
- N4: 모달 바깥 클릭 후 Esc가 작동하도록 포커스 유지.
- N5: 빌드 시 commit/mode를 build-info.json에 기록하고 Pages 조립 시 실제 산출물의 출처 확인.
- N7/P3-4: 연결된 핀·입력 순번·접속점 차수 캐시, 장애물 배열 공유, 고팬아웃 검증기 비용 개선.
- P3-8 일부: FLOATING_INPUT의 중복 관련 ID 제거.

## 시험 병합에서 처리한 부분

충돌 파일은 `src/renderer/CircuitSvg.tsx`, `src/renderer/GateBody.tsx` 두 개다. 토글 이벤트·비활성 상태·캐시는 QA 수정으로 결합하고, 현재 SVG 형상에 맞는 클릭 영역·핀 표식·라벨과 버블 간격 방어를 함께 정리했다. 자동 병합이 중복 선언한 connectedPins도 하나로 합쳤다.

## 이 검토에서 직접 실행한 검증

| 검사 | 결과 |
|---|---|
| TypeScript | 통과 |
| 정규 단위 테스트 | 367 통과, 1 skipped |
| 정규 브라우저 테스트 | 145 통과 |
| editor/simulation 빌드·Pages 조립·check-pages | 통과 |
| 산출물 stamp를 과거 커밋으로 바꾼 조립 | 거부 확인, 원본 stamp 복원 |
| 독립 QA: collisions | 320 시나리오, 새 몸체 관통 0 |
| 독립 QA: geometry | 38 통과 |
| 독립 QA: oracle | 45 통과 |
| 독립 QA: prior | 42 통과, 정책/표시 관련 13 실패 |
| 독립 QA: properties | 152 통과, 경유점 검사 1 실패 |
| 독립 QA 선택 실행 합계 | 292개 중 278 통과, 14 실패 |

독립 테스트는 import/증거 출력 경로만 별도 build 폴더로 옮겨 실행했다. 원본 감사 증거와 QA 테스트는 수정하지 않았다. 변이 테스트, 전체 퍼즈, 성능 프로파일은 이번 검토에서 다시 실행하지 않았다. 따라서 Claude의 성능 수치는 원 보고 수치이며 이 검토의 재측정 결과로 주장하지 않는다.

## 추가 확인된 N3 잔여 사례

`qa-tests/unit/properties.test.ts`의 고정 경유점 검사가 실패한다. 40개 조합에서 경유점과 회로 참조는 보존되지만 아래 5개에서 배선이 되돌아가 동일 구간을 겹쳐 지난다.

- Z형 경유점 16→2 입력, pin0.
- 게이트 앞 (340,300) 경유점 8→3 입력, pin0/pin1.
- 같은 경유점 16→2 입력, pin0/pin1.

이 결과는 통합 후보뿐 아니라 **9c47291의 src만 별도로 추출한 원본 QA 코드**에서도 동일하게 재현했다(153개 중 152 통과, 같은 검사 1 실패). 심벌 병합으로 생긴 회귀가 아니다. 정규 회귀 테스트는 경유점 보존만 확인해 이 되짚음을 잡지 못한다.

검토 방향: 경유점이 있는 경로를 clean(joined)로 보존하는 fallback에서 되짚음이 생기면, 같은 경유점 방문 순서를 유지한 planRoute 재계획을 검토한다. 성공 시 경유점·핀·wire/net ID 보존과 되짚음 0을 함께 확인하고, 실패 시 회로/history를 바꾸지 않고 구체적인 안내로 거부한다. 본 준비 작업에서는 Claude 수정의 추가 의미 변경을 하지 않았다.

## 문서에 이미 남겨 둔 미해결 사항

- 잘못된 Input 값의 기본 0 처리: 거부/진단 또는 X 처리 정책 미결정(독립 prior의 12 실패).
- 이름이 같은 게이트의 진단 메시지가 동일함(독립 prior의 1 실패).
- INVALID_CIRCUIT의 X 표시와 geometry/계산 검증 결합.
- 큰 회로의 줌·팬에서 전체 SVG 재렌더 비용 일부 잔존.
- README의 과거 테스트 수치.

핵심 수정과 통합 후보는 검증됐지만 모든 독립 QA가 통과한 상태는 아니다. main 반영 전 N3의 되짚음 5개 사례를 보완하거나 알려진 잔여 항목으로 명시적으로 처리할 필요가 있다.

## 다음 반영 순서

1. N3 경유점 되짚음 사례 처리 및 같은 독립 검사 재실행.
2. 원격 main/QA 브랜치가 더 갱신됐는지 확인하고 후보 갱신.
3. 최종 후보 커밋을 기준으로 두 모드를 다시 빌드해 source stamp 생성.
4. main 통합·푸시 후 GitHub Actions 성공과 실제 Pages source commit 확인.

## 로컬 근거

- `build/qa-integration-checks/evidence/results.json`: 독립 292개 검사 결과.
- `build/qa-integration-checks/evidence/properties-outcomes.json`: 40개 경유점 사례와 5개 되짚음.
- `build/qa-only-verification/results.json`: 원본 QA src의 동일 실패 재현.
- `build/test-results/.last-run.json`: 정규 브라우저 검사 결과.
- `build/qa-pages-site/deployment.json`: 로컬 조립 결과. 준비 당시 미커밋 통합 후보 빌드이므로 source stamp는 시작 HEAD를 가리키며 서비스 배포 증거가 아니다.
