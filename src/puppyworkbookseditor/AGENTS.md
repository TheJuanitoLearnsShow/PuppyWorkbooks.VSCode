# AGENTS.md

## Project overview

This repository is a VS Code extension for editing workbook-style XML. It provides Power Fx syntax highlighting and completions within `<Formula>` elements.

## Layout

- `src/`: TypeScript extension source and tests.
- `syntaxes/`: TextMate grammars for XML and Power Fx.
- `client/` and `server/`: language-client/server support scripts.
- `sample/Integration/`: example workbook XML files for manual testing.
- `out/`: generated TypeScript output; do not edit it directly.

## Development commands

Run these from the repository root:

```powershell
npm run compile   # Type-check and emit JavaScript to out/
npm run lint      # Lint TypeScript sources
npm test          # Compile, lint, and run extension tests
```

Use `F5` in VS Code to start an Extension Development Host for manual testing.

## Contribution guidance

- Keep source changes in `src/`; let `npm run compile` update generated output as needed.
- Preserve strict TypeScript settings and the existing ESLint style (semicolons, braces, and strict equality).
- Scope Power Fx behavior to text inside XML `<Formula>` elements; avoid changing general XML behavior unless intentional.
- Add or update tests in `src/test/` when changing extension behavior.
- Do not commit `node_modules/` or manually edit generated files in `out/`.
