---
"@narumitw/pi-btw": patch
"@narumitw/pi-plan-mode": patch
"@narumitw/pi-sync": patch
---

Replay the latest session_start received while an asynchronous factory installs with replay handlers committed only after the pending event is drained, and commit deferred command handlers and completions only after the factory installs successfully (stale completions are removed on command replacement).
