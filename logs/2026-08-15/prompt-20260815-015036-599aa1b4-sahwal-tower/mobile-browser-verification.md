# Mobile Browser Verification

- 실행일: 2026-08-15
- 브라우저: 로컬 Google Chrome headless(new), CDP 9223
- 앱: Vite dev server `http://127.0.0.1:5173/`
- viewport: 380×800, deviceScaleFactor 1, mobile=true

## 실측
- document title: `사활의 탑`
- `innerWidth`: 380
- `documentElement.scrollWidth`: 380
- `body.scrollWidth`: 380
- SVG viewBox: `0 0 340 340`
- 버튼 높이: 45.375px (한 수 쉼, 새로하기, 규칙)
- 빈 교차점 hit radius: 25
- `(0,0)` 터치 착수 후 흑돌: 2
- 800ms 후 백돌: 2
- AI 응답 후 상태: `당신의 차례다.`

## 판정
380px 가로 overflow 없음, 44px 터치 목표 충족, 터치 착수와 620ms 지연 AI 응답 정상.
