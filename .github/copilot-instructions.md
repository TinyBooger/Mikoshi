# Workspace instructions

## Validation defaults

- Do not run `npm run build` after frontend changes unless the user explicitly requests it.
- Do not run terminal commands to check backend Python syntax unless the user explicitly requests it.
- Continue to run focused tests or other validation explicitly requested by the user.

## File deletion policy

- Never delete or rename files via terminal commands (`Remove-Item`, `rm`, `mv`, etc.).
- If a file needs to be deleted or renamed, tell the user which file and why, and let them handle it manually.
