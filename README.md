# Circlith

회로를 빠르게 그리고, 연결 상태를 이해하고, 실수를 복구할 수 있는 논리회로 시뮬레이션 CAD를 위한 설계 저장소입니다. 가장 중요한 평가 기준은 조작성입니다.

**설계와 구현의 유일한 기준은 [CIRCLITH_MASTER_SPEC.md](docs/CIRCLITH_MASTER_SPEC.md)입니다.** 다른 문서와 충돌하면 Master Spec을 우선합니다.

현재는 설계 단계입니다. 구현 코드나 사용성·성능 검증 결과는 포함되어 있지 않습니다. `CURRENT`는 현재 구현 기준이며, `PROVISIONAL`, `EXPERIMENTAL`, `DEFERRED`는 확정되거나 검증된 기능을 뜻하지 않습니다.

## 문서

- [Master Spec](docs/CIRCLITH_MASTER_SPEC.md): 제품 정의, 결정 레지스트리, 조작·입력·배선·시뮬레이션·저장·검증 기준.
- [이전 문서 목록](docs/archive/README.md): 통합 이전 계획, 단축키 제안, 검토 및 회신 이력.
- [업로드 전 정보 검토 기록](docs/INFORMATION_REVIEW.md): 제거한 정보와 검토 범위.

새로운 결정은 Master Spec의 관련 DEC 항목과 본문에 먼저 반영합니다. 별도 문서에서 충돌하는 최종값을 유지하지 않습니다. 다음 단계는 핵심 상태 전이, 입력 소유권, Undo 초안 정책과 연결 유지 이동의 경로 규칙을 확인한 뒤 편집 프로토타입을 만드는 것입니다.
