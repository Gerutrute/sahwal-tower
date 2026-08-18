# 사용자 요청

RoGolike 저장소를 한 Vercel 프로젝트에 연결해 `main`은 Production, `dev`는 Preview로 자동 배포할 수 있도록 작업을 진행한다.

## 합의된 구조

- 저장소: https://github.com/Gerutrute/sahwal-tower
- Vercel 프로젝트 1개
- Production Branch: main
- dev branch: Preview deployment
- Vite build output: dist
- 최신 dev 제품은 승인된 기본값을 코드에 내장하지 않고 Vercel 환경 변수에서 GameConfig를 주입한다.
- Preview는 개발 플레이테스트 구성임을 화면에 명시한다.
- Production/Preview GameConfig는 Vercel 환경에서 분리한다.

## 요구사항

1. Vercel build에서 GameConfig 환경 변수를 안전하게 runtime-config.js로 생성한다.
2. 값이 없거나 JSON이 잘못되면 Vercel build는 fail closed 한다.
3. 일반 로컬 build/test 계약과 승인 수치 미내장 원칙을 유지한다.
4. runtime config 파일과 환경 값이 Git에 커밋되지 않는다.
5. 실제 Vercel 방식 빌드와 380px 브라우저 부팅을 검증한다.
6. 최신 로컬 dev 변경 전체를 검증 후 dev에 commit/push해 Vercel Preview가 볼 수 있게 한다.
7. main은 병합하지 않으며 Production branch로 유지한다.
8. Vercel 계정/GitHub import가 로그인으로 차단되면 사용자에게 Dashboard에서 수행할 정확한 단계와 환경 변수 등록 방법을 제공한다.
