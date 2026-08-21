# PowerFx XML Tools

PowerFx syntax highlighting and autocompletion **inside `<Formula>` elements** in workbook‑style XML files.

## Features

- PowerFx TextMate grammar
- PowerFx function name completion
- XML tag completion for Worksheet/Cell/Formula/etc.
- Completions only when cursor is inside `<Formula>` text

## Usage

1. Clone this repo.
2. Run `npm install`.
3. Press `F5` in VS Code to launch the Extension Development Host.
4. Open one of your `Integration` sample XML files.
5. Place the cursor inside a `<Formula>` value and start typing PowerFx.

## Packaging

```bash
npm install -g @vscode/vsce
vsce package
