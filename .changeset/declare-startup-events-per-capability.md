---
"@narumitw/pi-btw": patch
"@narumitw/pi-plan-mode": patch
"@narumitw/pi-sync": patch
---

Preserve deferred loading: startup events are declared per extension via installDeferred startupEvents (resources_discover only for extensions that actually serve resources), and factory on()/registerCommand() registrations commit only after the factory completes.
