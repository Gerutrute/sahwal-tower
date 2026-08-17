# Claude Defect Report

| ID | Severity | Finding | Codex resolution | Final status |
|---|---|---|---|---|
| CV-1 | Blocking | Relative hook path bricked session after cwd change | `$CLAUDE_PROJECT_DIR` based hook command + nested-cwd test | Fixed |
| CV-2 | High | cp949 stdin caused UTF-8 Korean hook payload to fail open | Explicit UTF-8 stdin/stdout + cp949 regression test | Fixed |
| CV-3 | Medium | Audit log exception could suppress deny | Deny emission separated from audit write | Fixed |
| CV-4 | Medium | Quoted/interleaved `git -C ... commit` bypass | Expanded destructive command recognition + regressions | Fixed |
| CV-5 | Medium | Corrupt active pointer failed open | Catch corrupt pointer and fall through to required-context deny | Fixed |
