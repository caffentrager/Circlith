# 독립 리뷰 후속 응답

원본 `REVIEW.md`는 `2c52562` 시점의 리뷰이며 이후 수정 여부는 이 응답을 따른다. 입력 프리셋 작업은 별도 요청 범위이며 geometry/삭제/저장 기능을 임의 확장하지 않았다.

| 항목 | Disposition | 근거 / 상태 |
|---|---|---|
| H1 stale hover | ACCEPT / 일부 재현 PARTIAL ACCEPT | canvas leave 후 Enter 오접속 수정 및 브라우저 회귀 테스트 추가. B6 Pan은 target pin과 포인터가 같이 움직여 같은 screen 좌표이므로 B6 실패 자체는 오접속 증거가 아님 |
| H2 메뉴 Esc / focus | ACCEPT | 메뉴 release에서 열기, autofocus, modal ownership 우선, Esc close/focus restore와 브라우저 테스트 추가 |
| M1 회전 후 grid | NEEDS SPEC DECISION | selection center vs grid 우선순위 결정 필요. 입력 작업에서 geometry 정책 변경하지 않음 |
| M2 spur | PARTIAL ACCEPT / NEEDS SPEC DECISION | 재현 확인. fixed waypoint 제거는 명세 판단 필요. geometry warning 구현은 아직 후속 |
| M3 graph invariant / validation | ACCEPT | endpoint 포함 canonical connectivity 및 validator 필요. 삭제·저장 기능 착수 전 후속으로 처리하며 이번 입력 시스템에서 해결했다고 주장 안 함 |
| M4 feedback | PARTIAL ACCEPT | 미구현 명령 및 설정/검증/저장 오류 안내 추가. 모든 operation 거부 이유/stale feedback를 구조화하는 작업은 후속 |
| M5 출력끼리 연결 | REJECT (편집 단계 금지 제안) | 명시적 연결은 허용. 이후 DEC-010 diagnostics로 다룰 문제이며 새로운 금지 규칙을 추가하지 않음 |
| 50% snap | PARTIAL ACCEPT | 모호한 후보 처리 개선 필요. Master Spec은 pin→wire→grid 우선순위를 정의하지만 최근접 자동 선택을 최종값으로 명시하지 않음 |
| App hardcoded input | ACCEPT | JSON preset, InputResolver, keyboard adapter, command dispatcher로 분리. Editor state/history 책임 유지 |
| preview ghost ID / performance | ACCEPT (후속) | rendering ID 안정성과 측정 기반 scheduling 보강은 후속 |
| feature branch Pages 배포 | REJECT (현재 요청 범위) | 사용자가 공개 prototype 배포를 요청했으며 main merge 전 feature branch deploy가 의도된 설정. 권한 범위는 main/해당 feature branch만 유지 |
| secure-context ID | PARTIAL ACCEPT | 공개 Pages HTTPS 및 localhost 확인. LAN HTTP 지원 완료로 주장하지 않음 |

원본 reviewer 재현 테스트는 당시 발견 기록으로 보존하며 현재 CI 테스트 집합에 자동 포함하지 않는다. 원본 문서의 사용자 홈 runtime 경로만 공개 저장소 정보 정책에 따라 제거했다.
