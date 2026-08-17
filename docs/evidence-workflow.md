# 프롬프트 증적 워크플로

## 역할

- **Claude Code:** 요구 분석, 구현 계획, 수락 기준, 구현 후 독립 검증. 게임/도구 소스는 수정하지 않는다.
- **Hermes(Codex):** Orca coordinator이자 유일한 구현자. Claude 계획이 동결된 뒤 코드를 구현하고 결함을 수정한다.
- **사람:** 게임 디자인의 최종 결정권자.
- **Orca:** Claude 계획/검증 Task와 Dispatch, 질문, `worker_done`을 추적한다.

## 디렉터리

각 코딩 프롬프트는 `logs/YYYY-MM-DD/prompt-YYYYMMDD-HHMMSS-<uuid>-<slug>/`에 보존한다. `manifest.json`이 Git tree, 계획 hash, Orca IDs, 검증 라운드, 최종 판정을 연결한다.

## 상태

`STARTED → PLAN_FROZEN → IMPLEMENTATION_CAPTURED → VERIFIED|DEFECTS_FOUND → FINALIZED`

- `PLAN_FROZEN` 전 저장소 구현 변경 금지
- Claude verifier는 fresh dispatch에서 실행
- verifier 전후 source tree hash가 달라지면 검증 무효
- blocking/high 결함이 열려 있으면 완료 금지
- commit/push는 사용자 명시 승인 없이는 금지

## 보안

`.env`, 토큰, 쿠키, 인증 헤더 값은 로그에 기록하지 않는다. Hook 이벤트는 파일 본문 대신 도구명, 경로, 결과 상태를 중심으로 기록하고 민감 값은 `[REDACTED]`로 치환한다.

## 기본 명령

```bash
python scripts/evidence/evidence.py start --request-file request.md --slug feature
python scripts/evidence/evidence.py record --dir <prompt-dir> --kind claude-plan --source plan.md
python scripts/evidence/evidence.py gate --dir <prompt-dir> --name plan-frozen
python scripts/evidence/evidence.py snapshot --dir <prompt-dir> --stage implementation
python scripts/evidence/evidence.py capture-command --dir <prompt-dir> --role verifier --name tests -- python -m unittest discover -s tests
python scripts/evidence/evidence.py finalize --dir <prompt-dir> --outcome succeeded
python scripts/evidence/evidence.py verify-checksums --dir <prompt-dir>
```
