# Logic Forge 참고 및 순차논리 도입 제안

검토일: 2026-10-19 (Asia/Seoul). 설계 제안이며 구현 명세 확정이나 구현 완료를 뜻하지 않는다.

## 검토 대상과 현재 상태

- Logic Forge `main`: `e74aa8c7507da121941c5b870eac6a3634cb373e` (커밋 날짜 2026-10-06).
- Circlith 비교 기준: `cd8bf7e`의 모델·편집기·조합논리 시뮬레이터와 Master Spec §24~25.
- GitHub API로 특정 커밋의 원문을 읽었다. 공개 웹 페이지 도구에서는 저장소를 읽지 못했다.
- 참고 사본은 `build/logic-forge-reference-e74aa8c/`에만 저장했다. 애플리케이션 코드·QA 브랜치·배포는 변경하지 않았다.
- Logic Forge의 전체 테스트나 UI를 실행하지 않았다. 아래의 구현 유무는 코드 확인 결과이고, 순차 동작의 정확성 보증은 아니다.

## 가져올 만한 부분

| 대상 | 확인한 Logic Forge 구현 | Circlith 도입 방향 |
|---|---|---|
| 순차소자 동작 | `src/core/primitives.js`: D/JK/T FF, 래치, 일부 레지스터·메모리, enable/reset/set | 순수한 다음 상태 계산 함수로 이식. 첫 구현은 DFF로 한정하고 다른 소자는 후속 추가 |
| 상태·클록 기록 | `primitives.js`: 부품 인스턴스별 `state[path]`, `clockState[path]`; 확정된 0→1 검출 | UUID를 키로 하는 세션 상태와 이전 클록값. 이름을 바꿔도 상태 식별이 바뀌지 않게 유지 |
| 계산과 상태 확정 분리 | `src/core/simulator.js`: `pending` 반환, `src/ui/app.js`의 `evaluate(record)`에서 상태·클록 확정 | 모든 순차소자의 다음 상태를 같은 이전 상태에서 계산하고 한꺼번에 확정. 이후 조합논리를 재계산 |
| 실행 세션 | `src/ui/CONTROLLER.md`: state/clocks/time/파형을 simulation session으로 묶는 분리 계획 | 편집 history와 별도 세션. 화면 갱신·줌·선택은 시간이나 상태를 진행시키지 않음 |
| 시간 입력 | `src/simulation/stimulus.js`: CLOCK/GEN, 시간별 입력 선택, WATCH/VECTOR 파싱 | 첫 단계는 수동 클록과 Step. 이후 입력 이벤트·반복 클록을 같은 시간축에서 처리 |
| 파형 | `src/ui/app.js`: 시간별 입출력 표본, `src/formats/vcd.js`: VCD 출력 | 먼저 간단한 신호 기록, 이후 파형 패널·WATCH·VCD 순으로 확장 |
| 회귀 검증 | `tests/engine.test.mjs`: DFF 상승엣지 캡처 및 유지, `tests/regression.test.mjs`: 고정된 출력 비교 | 기본 DFF 검사를 참고하되 동시 엣지·다단 FF·X/Z·리셋 우선순위까지 독립 기대값으로 보강 |

원문:

- [소자 모델](https://github.com/caffentrager/Logic-Forge/blob/e74aa8c7507da121941c5b870eac6a3634cb373e/src/core/primitives.js)
- [시뮬레이터](https://github.com/caffentrager/Logic-Forge/blob/e74aa8c7507da121941c5b870eac6a3634cb373e/src/core/simulator.js)
- [입력 패턴](https://github.com/caffentrager/Logic-Forge/blob/e74aa8c7507da121941c5b870eac6a3634cb373e/src/simulation/stimulus.js)
- [controller 분리 계획](https://github.com/caffentrager/Logic-Forge/blob/e74aa8c7507da121941c5b870eac6a3634cb373e/src/ui/CONTROLLER.md)
- [DFF 검사](https://github.com/caffentrager/Logic-Forge/blob/e74aa8c7507da121941c5b870eac6a3634cb373e/tests/engine.test.mjs)
- [로드맵](https://github.com/caffentrager/Logic-Forge/blob/e74aa8c7507da121941c5b870eac6a3634cb373e/ROADMAP.md)

## 그대로 이식하기 전에 맞출 차이

1. **신호 형식:** Logic Forge는 숫자 `0/1`과 문자열 `X/Z`를 함께 쓴다. Circlith의 문자열 `LogicValue`로 통일해야 한다. 파일을 그대로 복사하면 엄격 비교에서 동작이 달라질 수 있다.
2. **연결 모델:** Logic Forge는 자체 geometry 컴파일과 라이브러리 핀 이름에 의존한다. Circlith의 명시적 pin/net/endpoint ID를 유지하고, 소자별 핀 역할(D/CLK/Q 등)을 정의해야 한다.
3. **피드백 판정:** 현재 Circlith의 조합 SCC→X 정책은 유지하되 FF의 D→Q를 같은 조합 의존 경로로 취급하지 않는다. FF는 상태 경계다. 래치의 투명 구간은 별도 안정화 규칙이 필요하다.
4. **동시 엣지:** `pending`을 쓰는 것만으로 정확성이 입증되지는 않는다. 두 FF가 같은 클록에서 각자 이전 Q를 읽는지, 부품 등록 순서를 바꿔도 같은지 확인해야 한다.
5. **초기 상태:** Logic Forge는 기본 상태를 0으로 둔다. Circlith의 초기 Q, 초기 CLK, X/Z 엣지, reset/set 동시 활성 정책은 구현 전에 명시한다. 권장 초안은 Q=X, 확정된 0→1만 상승엣지, reset으로 알려진 상태를 만드는 방식이다.
6. **시간:** Logic Forge의 입력 토글은 `time += 10`을 사용한다. Circlith는 UI 클릭 횟수와 논리 시간을 분리한다. 같은 시각의 입력을 묶어 적용하고 안정화까지 마친 결과를 한 이벤트 Step으로 표시한다(Master Spec §25.1).
7. **스케줄러:** Logic Forge도 이벤트 스케줄러·지연 모델 확장을 ROADMAP의 후속 과제로 둔다. 해당 구현이 이미 완성된 것으로 간주하지 않는다. 첫 단계는 지연 없는 디지털 순차논리이며 실제 IC 타이밍 모델은 별도 단계다.
8. **데이터:** README는 MyLogic 심벌·넷리스트 데이터에 별도 재배포 라이선스를 부여하지 않는다고 명시한다. 이번 도입 제안은 소자 동작·세션 구조·검증 방식을 대상으로 하며 그 데이터 번들은 포함하지 않는다.

## 권장 작업 순서

QA 수정은 Claude가 담당한다. 그 결과가 통합된 main을 기준으로 별도의 `codex/sequential-simulation` 브랜치를 시작하는 구상이다.

1. **세션 기반 + DFF:** `SequentialState`와 이전 CLK 저장, D/CLK/Q 핀, 수동 클록, reset, 한 번의 엣지 진행. 기존 조합회로 결과와 편집 동작 보존.
2. **이벤트 진행:** 동일 시각 입력의 일괄 적용 → 조합 안정화 → 순차소자 다음 상태 계산 → 동시 확정 → 조합 재안정화. Step/Run/Pause/Reset 연결.
3. **순차소자 확대:** enable·비동기 reset/set의 우선순위를 명시하고 D latch, JK/T FF, 단일 비트들을 조합한 레지스터·카운터 추가.
4. **관찰·입력 도구:** 신호 기록·파형, 자동 Clock, 시간별 입력, WATCH/VCD. 다비트 버스·계층·메모리는 별도 범위로 설계.

수동 클록 Step, 다음 이벤트 Step, 한 주기 진행은 서로 구분한다. 최초의 DFF 동작 확인과 완전한 이벤트 실행 UI를 각각 작은 변경으로 나눌 수 있다.

## 완료 판단에 필요한 검증

- DFF: 상승엣지에서만 캡처, 높은 클록 유지 중 D 변화 무시, 다음 상승엣지 반영.
- 직렬 2단 FF: 첫 엣지에서 첫 FF만 새 D를 캡처하고 두 번째는 첫 FF의 이전 Q를 캡처.
- 병렬 FF·부품 등록 순서 변경·다중 클록에서 결정적인 결과.
- X/Z 데이터·불명확한 클록·reset/enable의 정책별 기대값.
- 토글·Step·Run과 선택/이동/속성 편집의 입력 소유권 및 포커스.
- 편집·Undo/Redo 시 실행 정지와 세션 초기화, 취소한 초안은 세션을 바꾸지 않음.
- 화면 확대·이동·모달·패널 재렌더가 상태·시간·파형에 표본을 추가하지 않음.
- 기존 조합논리 검사와 두 Pages 모드의 공통 편집 기능 유지.

이 문서는 참고 범위와 구현 순서를 정리한 것이다. 애플리케이션 코드 이식·새 브랜치 생성·커밋·푸시·배포는 수행하지 않았다.
