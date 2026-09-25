---
"@narumitw/pi-btw": patch
"@narumitw/pi-plan-mode": patch
"@narumitw/pi-sync": patch
---

Forward commands and event handlers registered during startup replay or after deferred initialization, while preserving failed-factory isolation and import retries.

Plan mode also answers the neutral `pi:tool-selection-policy` event by setting `locked` while it owns the tool set, allowing tool selectors to respect custom Plan tool selections.
