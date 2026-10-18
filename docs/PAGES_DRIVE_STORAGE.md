# Pages 기반 운영과 Google Drive 프로젝트 저장 검토

조사일: 2026-10-16

상태: 사용자 요청으로 기록한 조사 결과와 권장안. 인증·클라우드 저장은 미구현이며, 외부 리소스 생성이나 권한 연결을 수행하지 않았다.

## 운영 방향과 기술적 가능성

GitHub Pages에서 에디터를 제공하고, 브라우저에서 Google 인증·권한 동의를 거쳐 사용자의 Google Drive에 프로젝트 파일을 저장하는 구조가 가능하다. Circlith가 별도 애플리케이션 서버를 운영할 필요는 없지만 Google 인증·저장 서비스를 이용하고 최초 앱 등록·설정은 필요하다. 실제 배포 도메인과 OAuth 설정을 이용한 통합 검증은 아직 하지 않았다.

Pages는 HTML·CSS·JavaScript 정적 호스팅을 제공한다. Google Identity Services의 token model은 브라우저에 접근 토큰을 반환하며, 브라우저에서 REST/CORS로 Google API를 직접 호출할 수 있다. 로그인으로 신원을 확인하는 것과 Drive 파일 접근 권한을 받는 것은 구분한다.

근거: [GitHub Pages 설명](https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages), [Google token model](https://developers.google.com/identity/oauth2/web/guides/use-token-model), [인증과 API 권한 개요](https://developers.google.com/identity/oauth2/web/guides/overview).

## 권장 구성

| 역할 | 저장·실행 위치 |
|---|---|
| 에디터 실행·배포 | GitHub Pages |
| 새로고침 복구·오프라인 편집 | 브라우저 저장소 |
| 사용자 직접 백업·이동 | JSON 파일 저장·열기 |
| 선택적인 기기 간 프로젝트 이동 | 사용자 Google Drive |

로그인 없이 편집·임시저장·파일 저장을 사용할 수 있게 만들고, 이후 사용자가 필요할 때 **Google Drive 연결**을 선택하도록 한다. 브라우저 복구 데이터, 파일 저장본, Drive 업로드 상태는 별개로 표시한다. 동일한 버전 있는 프로젝트 문서 형식을 파일과 Drive 저장에 사용하고, 저장 대상별 처리는 Editor와 분리한다.

## Drive 저장 방식

권장안은 사용자가 Drive에서 확인·관리할 수 있는 일반 프로젝트 파일을 저장하고 `drive.file` 범위를 요청하는 것이다. 이 권한은 앱이 생성한 파일 또는 사용자가 앱에 열어 준 파일에 접근하는 데 사용한다. 임의의 모든 Drive 파일을 열람할 수 있는 권한으로 취급하지 않는다. 기존 파일 선택에는 Google Picker 연동을 검토한다.

`drive.appdata`를 사용하는 숨김 앱 데이터 폴더도 가능하지만, 사용자와 다른 Drive 앱에서 내용을 직접 볼 수 없어 일반 프로젝트 보관함보다는 앱 전용 설정·보조 데이터 후보로 둔다.

근거: [Drive 권한 범위](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [앱 전용 데이터 폴더](https://developers.google.com/workspace/drive/api/guides/appdata).

## 초기 설정과 제약

- Google Cloud 프로젝트에서 Drive API를 활성화하고 웹용 OAuth 클라이언트, 동의 화면·요청 권한·허용 JavaScript origin을 설정해야 한다. 개발·실배포 origin을 각각 검증한다.
- 브라우저용 client ID를 사용한다. 서버용 client secret이나 서비스 계정 비밀키를 Pages 코드·저장소에 포함하지 않는다.
- Google의 공개 앱 등록·검증 요건은 선택한 권한과 배포 상태에 맞춰 확인한다. `drive.file`은 비민감 권한이지만 등록·검증 절차가 전혀 없다고 가정하지 않는다.
- token model의 접근 토큰은 수명이 짧다. 만료 시 사용자 동작으로 새 토큰을 요청해야 할 수 있으며, 영구 로그인·무인 동기화를 보장하지 않는다. 접근 토큰은 회로 파일·복구 데이터에 포함하지 않고 메모리에서 관리하는 방안을 기준으로 한다.
- 브라우저가 닫힌 동안 서버에서 자동 동기화하는 기능은 이 구성에 포함하지 않는다.

근거: [OAuth client ID 설정](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid), [Drive JavaScript 시작 안내](https://developers.google.com/workspace/drive/api/quickstart/js), [Drive 권한·검증](https://developers.google.com/workspace/drive/api/guides/api-specific-auth), [토큰 요청·만료 처리](https://developers.google.com/identity/oauth2/web/guides/use-token-model).

## 연결 기능을 구현할 때의 동작 기준

- 연결 거부·취소, 토큰 만료, 네트워크 단절, Drive 저장 실패 중에도 로컬 편집과 복구 저장을 유지한다.
- 마지막 업로드 시각·대상 파일·업로드 성공 여부를 표시하고 실패한 업로드를 성공으로 표시하지 않는다.
- 다른 기기·탭에서 수정된 파일은 조용히 덮어쓰지 않는다. 원격 변경 감지와 충돌 처리 방식을 구현 전에 정의하고, 다른 이름으로 저장하는 복구 경로를 제공한다.
- Drive에서 연 문서도 전체 형식·회로 검증 후에만 현재 작업을 교체한다. 미저장 작업 교체 정책은 로컬 파일 열기와 일치시킨다.
- 연결 해제나 계정 변경으로 현재 로컬 회로를 삭제하지 않는다. 다른 계정 파일에 잘못 업로드하지 않도록 계정·대상 상태를 재설정한다.
- 초기 범위는 프로젝트 저장·열기와 기기 간 이동이다. 실시간 공동 편집은 별도 기능이다.

## 진행 순서

1. 로컬 임시저장·복구와 JSON 파일 저장·열기를 먼저 구현한다.
2. 프로젝트 문서 형식과 저장 책임 경계를 안정화한다.
3. Google 앱 설정과 실제 Pages 도메인에서의 인증·Drive 파일 접근을 검증한다.
4. 사용자가 선택하는 Drive 연결·저장·열기, 만료·실패·충돌 처리를 추가한다.

이 문서는 조사 기록이며 즉시 인증 연동 구현을 시작한다는 의미는 아니다. 전체 에디터 작업 범위는 [EDITOR_EXPANSION_SCOPE.md](EDITOR_EXPANSION_SCOPE.md)를 따른다.
