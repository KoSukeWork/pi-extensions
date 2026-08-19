# Certification allowlist

Upstream: https://github.com/narumiruna/pi-extensions  
Baseline: `df8b78055a203dbb3d571b5b15ad08b13ec12b68`

`pi install git:github.com/KoSukeWork/pi-extensions` loads only:

- `packages/pi-btw`
- `packages/pi-goal`
- `packages/pi-plan-mode`
- `packages/pi-sync`

`packages/pi-lsp` stays in the tree but is not loaded.

`@narumitw/pi-tui-kit` is a library used by several of the above. It is not a Pi extension.

Do not install `git:github.com/narumiruna/pi-extensions` — the upstream root manifest enables many unreviewed siblings.

Do not also install the matching `npm:@narumitw/...` copies of these five packages.
