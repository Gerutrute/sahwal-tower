# 07 — Codex 구현 결과

## 결과

**READY_FOR_FRESH_VERIFICATION**. 동결 계획과 정정 부록에 따른 Vercel fail-closed 빌드, dist-only runtime injection, preview 메타/배너, 한 프로젝트 브랜치 화이트리스트, Dashboard runbook, `check:vercel-preview`, required command 등록을 구현했다. 구현 snapshot은 `e66f4f8e91f3e48ac25dedd139b259904bbf6df5`이며 commit/push는 하지 않았다.

## 핵심 검증 결과

- 세 신규 테스트 파일은 지정된 첫 테스트 이름으로 assertion RED와 최소 GREEN을 각각 보존했다.
- 최종 `npm.cmd test`: 45 files / 237 tests passed.
- typecheck, 일반 build, runtime audit, AI benchmark, mobile check, Vercel preview check 모두 최신 receipt exit 0.
- fail-closed 입력은 누락/공백/invalid JSON/schema invalid/boot failed가 각각 정해진 코드와 exit 1을 냈다.
- Preview/Production 런타임 메타, loader 1개와 첫 module script 이전 순서, 일반 build 무주입을 확인했다.
- 380×844 Vercel preview report는 문서/runtime-config 200, 타이틀·배너·지도 전환, scrollWidth 380, console/page/request/response 오류 0, `passed:true`다.
- 최종 sentinel은 Git/log/build log에 0건이고 검사 종료 후 runtime-config 생성물은 정리됐다.
- `vercel.json`은 `git.deploymentEnabled`에 `"**": false`, `main: true`, `dev: true`를 모두 포함한다.

## 완료 전 남은 게이트

coordinator 소유의 fresh Claude read-only 검증, verify-before/verify-after tree 불변성, post-verify gate, finalize, checksum 검증이 남았다. 그 전에는 전체 작업 성공이나 배포 완료로 보고할 수 없으며, commit/push도 coordinator 지시에 따라 보류한다.

## 열린 인간 판단

- H-1: Vercel 로그인, GitHub Import, 프로젝트 생성. 이 단계 전에는 실배포가 없다.
- H-2: `ROGOLIKE_GAME_CONFIG_JSON`을 Production/Preview 범위로 나누어 등록. 승인 Production 수치가 등록되기 전 fail closed는 정상이다.
- H-3: 현재 구형 `main`을 Production에 노출할지, Project Build Command override로 차단할지 선택.
- H-4: 실제 Preview URL을 380px 실기기에서 확인.
- H-5: 추후 `main` 병합 시점과 승인. 이번 작업은 main을 건드리지 않았다.
