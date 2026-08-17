# Claude 계획·검증 / Hermes(Codex) 구현 계획

**역할:** Claude Code는 읽기 전용 요구 분석·계획·수락 기준 작성과 구현 후 독립 검증을 맡는다. Hermes(Codex)는 계획 동결 후 모든 실제 코드·파일 구현과 결함 수정을 맡는다. Orca는 계획 및 검증 Task/Dispatch를 추적한다.

## 프롬프트 수명주기

1. Hermes가 `evidence.py start`로 `logs/YYYY-MM-DD/prompt-*`를 생성한다.
2. Claude plan dispatch가 `02~05` 계획 산출물을 작성하고 `worker_done`을 보낸다.
3. `gate plan-frozen`이 계획·수락 기준을 고정한다.
4. Hermes/Codex가 구현하고 명령·diff를 `06~07`, `codex/`, `diff/`에 기록한다.
5. fresh Claude verify dispatch가 실제 diff와 수락 기준을 읽고 테스트를 직접 실행한다. 소스 편집은 hook과 tree hash로 금지·검출한다.
6. 결함이 있으면 Codex가 수정하고 새 Claude verify dispatch가 재검증한다.
7. 필수 산출물·검증·checksum이 모두 유효할 때만 finalize한다.

## 핵심 수락 기준

- unborn HEAD와 한글·공백 Windows 경로를 지원한다.
- 사용자 Git index/history를 변경하지 않고 임시 index로 tree snapshot과 patch를 만든다.
- Claude planner/verifier의 소스 편집을 PreToolUse hook으로 차단한다.
- 시크릿을 redaction하고 manifest는 atomic write한다.
- plan hash 변경, 열린 blocking/high 결함, verifier tree 변경, 필수 검증 실패 시 finalize가 실패한다.
- 표준 라이브러리 `unittest`로 전체 기능을 검증한다.
