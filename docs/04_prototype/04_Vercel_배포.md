# Vercel 브랜치 배포 실행서

이 실행서는 하나의 Vercel 프로젝트에서 `main`을 Production, `dev`를 Preview로 운영하기 위한 사람 수행 절차다. 실제 환경 변수 값과 승인 수치는 Vercel에만 두고 저장소, 이슈, 채팅, 증적 로그에는 복제하지 않는다.

## 1. 프로젝트 Import

1. vercel.com에 GitHub 계정으로 로그인한다.
2. **Add New → Project**에서 `Gerutrute/sahwal-tower`를 Import한다.
3. Import 화면은 기본 브랜치 `main`을 기준으로 표시된다. 현재 `main`에는 `vercel.json`이 없으므로 Vite 기본값인 `npm run build`와 `dist`가 보이는 것이 정상이다. H-3에서 Production 차단을 선택하지 않는 한 이 화면의 Build Command를 override하지 않는다.
4. `dev` 커밋은 해당 커밋의 `vercel.json`에 선언된 `npm run build:vercel`, `dist`, `npm ci`를 배포 단위로 사용하며 이 설정은 대시보드의 프로젝트 기본값보다 우선한다.

이번 설정은 한 프로젝트만 사용한다. `vercel.json`이 병합 전까지 `dev`에만 있으므로, `main` Production은 자체 Vite 기본값으로 구형 프로토타입을 빌드하고 `dev` Preview만 fail-closed 런타임 설정 빌드를 사용한다.

## 2. 환경 변수 등록

Project → Settings → Environment Variables에서 같은 이름의 `ROGOLIKE_GAME_CONFIG_JSON`을 두 번 등록한다.

- Production만 선택: 사람이 승인한 Production GameConfig JSON. 현재 승인 수치가 미확정이므로 등록 전 Production 빌드가 fail closed로 실패하는 것이 정상이다.
- Preview만 선택: 개발 플레이테스트 JSON. 로컬에서 아래 명령으로 미승인 draft를 생성해 복사하고, 필요하면 Vercel 입력 화면에서 seed만 바꾼다.

```bash
npx vite-node scripts/vercel-export-draft-config.ts
```

출력은 미승인 플레이테스트 draft다. 값은 Vercel에만 보관하고 파일, 커밋, 이슈, 채팅, 빌드 로그에 남기지 않는다. `NODE_ENV` 환경 변수는 추가하지 않는다. 이를 `production`으로 지정하면 Vite 같은 devDependencies가 설치되지 않아 빌드가 깨질 수 있다.

## 3. 브랜치와 자동 배포

1. Settings → Git에서 **Production Branch**가 `main`인지 확인한다.
2. `dev` push는 Preview 배포를 만든다. 고정 브랜치 URL은 `sahwal-tower-git-dev-<scope>.vercel.app` 형식이며, 각 배포 URL은 Deployments 탭에서 확인한다.
3. `vercel.json`의 `git.deploymentEnabled`는 `"**": false`, `main: true`, `dev: true` 화이트리스트다. Vercel은 미명시 브랜치를 기본 활성화하므로 `"**": false`가 반드시 필요하다.
4. 이 규칙은 push된 커밋에 `vercel.json`이 있을 때 적용된다. 아직 이 파일이 없는 `main` 또는 그 지점에서 갈라진 브랜치에는 병합 전까지 적용되지 않는다.

## 4. H-3: 현재 Production 상태 선택

현재 `main`은 구형 프로토타입 커밋이다. 사람은 아래 중 하나를 선택한다.

- 기본값 유지: Production 도메인에 현재 `main`의 구형 빌드가 배포된다.
- Production 차단: Project Build Command를 `npm run build:vercel`로 override한다. 구형 `main`에는 이 스크립트가 없으므로 빌드가 실패해 Production을 사실상 비워 둔다. `dev` Preview는 커밋의 `vercel.json`이 우선하므로 영향받지 않는다.

## 5. 배포 확인

1. 환경 변수를 등록한 뒤 이전 실패 배포는 Deployments → Redeploy로 다시 실행한다.
2. Preview URL을 380px 모바일 에뮬레이션 또는 실기기에서 연다.
3. 타이틀 화면, `등반 시작`, 지도 진입, 가로 스크롤 부재를 확인한다.
4. 화면에 `개발 플레이테스트 구성 · 승인된 제품 수치가 아닙니다` 배너가 계속 표시되는지 확인한다. 이 Preview 수치는 승인된 제품 수치가 아니다.

로컬 재현은 `npm run check:vercel-preview`로 수행한다. 이 명령은 draft를 메모리에서 환경 변수로 전달해 Vercel 방식 빌드를 실행하고, 380×844 브라우저 검사를 마친 뒤 `dist`를 정리한다.

## 6. 아직 사람에게 남은 작업

- H-1: Vercel 로그인, GitHub Import, 프로젝트 생성
- H-2: Production/Preview 범위를 분리한 환경 변수 등록
- H-3: 구형 `main` 노출 허용 또는 Production 차단 선택
- H-4: 실제 Preview URL을 380px 실기기에서 확인
- H-5: 추후 `main` 병합 시점과 승인
