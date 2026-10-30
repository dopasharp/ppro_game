# 빼빼로게임

GitHub Pages + Firebase Realtime Database의 2인용 탭 게임입니다.

## 게임 모드

첫 화면의 **만나서하기 / 원격으로 하기** 버튼으로 바로 방을 만듭니다. 두 버튼 아래에 **혼자 테스트**가 있습니다. 초대받은 사람은 같은 모드로 연결됩니다.

- **만나서하기**: 왼쪽/오른쪽 카메라 고정. 나란히 둔 두 휴대폰이 하나의 세계를 표시합니다.
- **원격으로 하기**: 각자 자기 곰을 부드럽게 따라갑니다. 종료 시 양쪽 화면 모두 두 곰을 표시합니다. 원격 화면에는 가운데 구분선이 없습니다.
- 카메라 좌표는 Firebase에 전송하지 않습니다. 방 모드와 탭 수만 공유합니다.
- 방을 만든 뒤에는 모드를 바꿀 수 없습니다. 모드를 바꾸려면 새 방을 만드세요.

## 변경된 게임 규칙

- 각자 탭하면 자기 곰만 이동합니다. 다른 곰의 위치에는 영향을 주지 않습니다.
- 1회 탭당 논리 좌표 약 24.67px 이동합니다. 두 사람 합계 24회에 만납니다.
- 왼쪽 곰은 왼쪽 끝, 오른쪽 곰은 오른쪽 끝에서 시작합니다.
- 더 많이 탭한 곰이 상대 휴대폰 쪽으로 넘어갑니다. 이전의 끌어당기기 규칙은 제거했습니다.
- 390 × 844 화면 두 개가 780 × 844 세계를 반씩 표시합니다. 모바일에서 가로를 채웁니다. 크기 슬라이더로 두 기기의 물리 크기를 조절할 수 있습니다.
- 장식 문구를 제거하고 방 만들기, 초대 링크, 입력 및 결과만 표시합니다.

## 기존 버전에서 업데이트

1. 새 ZIP의 파일로 기존 게임 폴더를 덮어쓰세요. Firebase 웹 설정은 입력된 상태입니다.
2. **Firebase Console → Realtime Database → Rules에서 새 database.rules.json을 다시 게시하세요.** 종료 기준 24회, 방 모드와 공유 다시하기를 검증하는 규칙입니다.
3. 실행 중인 양쪽 브라우저를 새로고침하고 새 방을 만드세요. 이전 방은 사용하지 마세요.
4. GitHub Pages를 사용 중이라면 같은 파일을 저장소에도 반영하세요.

## 로컬 실행

Node.js 20 이상에서 이 폴더의 터미널에 `npm run preview`를 입력하고 http://localhost:8080 에 접속합니다. 설치 없이 혼자 테스트할 수 있습니다. 다른 프로세스가 8080을 사용한다면 기존 서버에서 변경된 파일을 제공하는지 확인하세요. PowerShell에서 다른 포트를 쓰려면 `$env:PORT='8081'`을 입력한 뒤 `npm run preview`를 실행합니다.

새 방은 왼쪽·오른쪽 링크를 따로 사용합니다. 방을 만든 사람은 왼쪽이고, 자동 복사되는 링크는 상대용 오른쪽 링크입니다. 상단에서 각 자리 링크를 복사할 수 있습니다. 같은 브라우저에서도 자리별 로그인을 분리하므로 두 탭으로 테스트할 수 있습니다. 자리 확인 키가 포함된 전체 링크를 열면 다른 브라우저에서도 기존 위치·탭 수를 유지하고 조작을 이어받습니다. 이전 브라우저는 화면을 볼 수 있지만 조작은 새 브라우저에서 진행합니다. 이 기능을 쓰려면 database.rules.json을 다시 게시하고 새 방을 만드세요.

## Firebase 설정

웹 앱 설정은 firebase-config.js에 반영되어 있습니다. [Firebase Console](https://console.firebase.google.com/project/pp-game-2f9bd/overview)에서 다음을 설정하세요.

1. Authentication → Sign-in method → Anonymous 활성화.
2. Realtime Database → Rules에 database.rules.json 전체를 붙여넣고 게시.
3. 필요한 경우 Authentication → Settings → Authorized domains에 localhost와 GitHub Pages 도메인을 추가.

웹 설정은 공개 식별자입니다. 관리자 서비스 계정 키는 넣지 마세요. Analytics는 사용하지 않습니다.

## GitHub Pages

폴더 내용 전체를 저장소 최상위에 올리세요. index.html, assets 폴더, .nojekyll을 포함하고 node_modules 및 로그는 제외합니다. Settings → Pages → Deploy from a branch → main / (root) → Save를 선택합니다. 게시된 주소에서 방을 만들고 링크를 공유하세요. localhost 링크는 다른 휴대폰에서 열 수 없습니다.

## 다시하기

어느 쪽에서든 **다시하기**를 누르면 같은 방·링크·참가자를 유지하고 양쪽 탭 수, 곰 위치, 카메라를 초기화합니다. 3초 뒤 재시작합니다. 이전 라운드의 입력은 새 라운드에 반영되지 않습니다. 상대가 아직 없을 때는 초기화하지 않습니다. 혼자 테스트도 다시하기로 초기화할 수 있습니다.

## 공유 상태와 권한

랜덤 방 ID 아래에 좌우 플레이어의 uid, taps, lastTap과 시작 시간을 저장합니다. 만들 때 정한 mode는 이후 변경할 수 없습니다. 자기 카운터만 트랜잭션으로 올리며, 서버 간격 60ms 미만 입력과 합계 24회 초과 입력은 거부합니다. 연결이 끊기면 입력을 멈춥니다. 전송 중 연타 일부는 처리되지 않을 수 있어 네트워크 지연이 입력 속도에 영향을 줍니다.

방 링크를 아는 로그인 사용자는 방을 읽고 빈 두 번째 자리에 들어갈 수 있습니다. 방 목록과 타인의 카운터 수정은 허용하지 않습니다. 방과 자리는 자동 삭제되지 않습니다. 새로고침은 같은 계정을 유지합니다. 브라우저 데이터를 지우면 기존 자리를 복구할 수 없습니다.

## 이미지

사용자가 제공한 이미지에서 배경만 투명 처리한 PNG를 사용합니다.

- assets/cream.png: 왼쪽 크림 곰, 4열 × 2행.
- assets/pink.png: 오른쪽 분홍 곰, 4열 × 2행. 화면에서 좌우 반전합니다.
- 첫 행은 걷기, 둘째 행은 입을 벌린 걷기·먹기 프레임입니다. 각자 탭할 때만 자기 곰의 걷기 프레임을 재생합니다.
- assets/pepero.png: 제공된 빼빼로 5종. 같은 방의 두 기기는 동일한 종류를 표시합니다.
- assets/sprites.json: 각 프레임의 투명 여백을 제외한 표시 영역. 입 높이를 같은 위치에 맞춥니다.
- 빼빼로는 양쪽에서 먹은 만큼 잘라서 표시하므로 무늬가 함께 눌려 줄어들지 않습니다.
- 이전 SVG 기본 이미지 파일은 남아 있지만 게임에서 사용하지 않습니다.

이미지 교체 자체는 Rules 변경이 없지만, 이번 다시하기 버전은 round 필드와 공유 초기화 권한을 추가했으므로 Rules를 다시 게시해야 합니다. 파일을 덮어쓰고 새로고침한 뒤 새 방을 만드세요.

## 테스트

- `npm test`: 독립 이동, 큰 이동량, 양끝 시작, 화면 통과, 충돌 및 입력 제한.
- Node.js 20 이상 + Java 21에서 `npm install` 후 `npm run test:rules`: Firebase Database Emulator로 권한과 동시 마지막 입력 검사.
- 전체 에뮬레이터는 `npx firebase emulators:start --project demo-pepero`; 웹은 localhost에서 `?emulator=1`로 연결합니다. 데모 프로젝트를 쓸 때 firebase-config.js도 데모 식별자로 바꾸세요.

## 공식 문서

[익명 인증](https://firebase.google.com/docs/auth/web/anonymous-auth) · [데이터 트랜잭션](https://firebase.google.com/docs/database/web/read-and-write) · [보안 규칙](https://firebase.google.com/docs/database/security) · [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
