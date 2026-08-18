# 11 — 최종 요약

## 결과

Vercel 단일 프로젝트에서 `main` Production, `dev` Preview로 운영하기 위한 저장소 측 배포 기반을 구현하고 독립 검증했다. Fresh Claude 최종 판정은 **PASS — Blocking 0 / Major 0 / Minor 2(기록성)** 다.

## 구현

- `npm run build:vercel`: `ROGOLIKE_GAME_CONFIG_JSON`을 fail-closed 검증하고 실제 게임 상태 부팅까지 확인한 뒤 `dist/runtime-config.js`를 생성한다.
- 런타임 설정은 source/public이 아니라 build 결과물인 `dist`에만 생성하며 앱보다 먼저 로드된다.
- Preview에는 `개발 플레이테스트 구성 · 승인된 제품 수치가 아닙니다` 라벨을 노출하고 Production에는 노출하지 않는다.
- `vercel.json`은 `main`·`dev`만 배포 대상으로 허용하고, build/output/install 명령을 고정한다.
- `npm run check:vercel-preview`로 380×844 실브라우저, runtime-config HTTP 200, 지도 진입, 가로 overflow 없음, 콘솔·페이지·요청 오류 0을 검증한다.
- Dashboard 실행서는 `docs/04_prototype/04_Vercel_배포.md`에 기록했다.

## 검증

- 테스트: 45 files / 237 tests passed
- TypeScript: passed
- 일반 build: passed; runtime config 미주입 계약 유지
- Vercel preview build/browser: passed
- Runtime audit: passed
- AI benchmark: passed
- Fresh Claude: PASS, Blocking 0 / Major 0 / Minor 2
- 구현·검증 source snapshot: `e66f4f8e91f3e48ac25dedd139b259904bbf6df5`
- 검증 전후 `main`, `origin/main`, `dev`, `origin/dev` ref 불변 확인

## 남은 실제 운영 작업

- H-1: Vercel 로그인·GitHub Import·프로젝트 생성
- H-2: Preview 범위에 미승인 개발 플레이테스트 `ROGOLIKE_GAME_CONFIG_JSON` 등록
- H-3: 현재 구형 `main` Production을 노출할지 차단할지 결정
- H-4: 실제 Preview URL의 380px 실기기 확인
- H-5: 검증된 dev를 추후 main에 병합할 시점과 승인

실제 Vercel 배포 완료는 H-1~H-3을 수행한 뒤 URL을 검증해야 선언할 수 있다.
