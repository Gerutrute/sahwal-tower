# Codex Fix Log

Hermes/Codex implemented all fixes identified by Claude verification rounds.

1. Replaced cwd-relative Claude hook paths with `$CLAUDE_PROJECT_DIR` paths.
2. Enforced UTF-8 hook stdin/stdout on Korean Windows.
3. Kept write denial active even when audit logging fails.
4. Extended destructive Git command detection to quoted paths and interleaved options.
5. Made corrupt active-pointer parsing fail closed when evidence is required.
6. Added regression tests for every defect; suite increased from 17 to 22 tests.
