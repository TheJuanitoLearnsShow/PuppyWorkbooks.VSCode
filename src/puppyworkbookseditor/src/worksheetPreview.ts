import * as vscode from 'vscode';

interface CliResult {
	stdout: string;
	stderr: string;
}

interface WorksheetPreviewDependencies {
	cliDiagnostics: vscode.DiagnosticCollection;
	executeWorksheet(fileName: string): Promise<CliResult>;
	formatCliJson(stdout: string): string | undefined;
	getDiagnosticRange(document: vscode.TextDocument): vscode.Range;
	isWorksheetDocument(document: vscode.TextDocument): boolean;
	toCliErrorMessage(error: unknown): string;
}

function createPreviewHtml(): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<style>
body { color: var(--vscode-editor-foreground); font-family: var(--vscode-font-family); padding: 1rem; }
button { margin-bottom: 1rem; }
.json-table { border-collapse: collapse; margin-top: 1rem; width: 100%; }
.json-table th, .json-table td { border: 1px solid var(--vscode-panel-border, var(--vscode-editorWidget-border)); padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
.json-table th { background: var(--vscode-list-hoverBackground); font-weight: 600; }
.json-table tr:nth-child(even) { background: var(--vscode-list-inactiveSelectionBackground); }
.json-table .json-table { margin: 0; width: auto; min-width: 100%; }
.json-key, .json-index { color: var(--vscode-symbolIcon-keywordForeground); font-weight: 600; white-space: nowrap; }
.json-null { color: var(--vscode-descriptionForeground); font-style: italic; }
.json-boolean { color: var(--vscode-debugTokenExpression-boolean); }
.json-number { color: var(--vscode-debugTokenExpression-number); }
.json-string { color: var(--vscode-debugTokenExpression-string); white-space: pre-wrap; }
.json-empty { color: var(--vscode-descriptionForeground); font-style: italic; }
.error { color: var(--vscode-errorForeground); }
</style>
</head>
<body>
<button id="refresh">Refresh</button>
<div id="status">Run the worksheet to view its JSON output.</div>
<div id="output"></div>
<script>
const vscode = acquireVsCodeApi();
document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));

function createTable(headers) {
	const table = document.createElement('table');
	table.className = 'json-table';
	const headerRow = table.createTHead().insertRow();
	for (const header of headers) {
		const cell = document.createElement('th');
		cell.textContent = header;
		headerRow.appendChild(cell);
	}
	return table;
}

function renderValue(value) {
	if (Array.isArray(value)) {
		const table = createTable(['Index', 'Value']);
		const body = table.createTBody();
		if (value.length === 0) {
			const row = body.insertRow();
			const cell = row.insertCell();
			cell.colSpan = 2;
			cell.className = 'json-empty';
			cell.textContent = 'Empty array';
		} else {
			value.forEach((item, index) => {
				const row = body.insertRow();
				const indexCell = row.insertCell();
				indexCell.className = 'json-index';
				indexCell.textContent = index;
				row.insertCell().appendChild(renderValue(item));
			});
		}
		return table;
	}

	if (value !== null && typeof value === 'object') {
		const table = createTable(['Property', 'Value']);
		const body = table.createTBody();
		const entries = Object.entries(value);
		if (entries.length === 0) {
			const row = body.insertRow();
			const cell = row.insertCell();
			cell.colSpan = 2;
			cell.className = 'json-empty';
			cell.textContent = 'Empty record';
		} else {
			for (const [key, item] of entries) {
				const row = body.insertRow();
				const keyCell = row.insertCell();
				keyCell.className = 'json-key';
				keyCell.textContent = key;
				row.insertCell().appendChild(renderValue(item));
			}
		}
		return table;
	}

	const valueElement = document.createElement('span');
	if (value === null) {
		valueElement.className = 'json-null';
		valueElement.textContent = 'null';
	} else {
		valueElement.className = 'json-' + typeof value;
		valueElement.textContent = String(value);
	}
	return valueElement;
}

window.addEventListener('message', event => {
	const message = event.data;
	const status = document.getElementById('status');
	const output = document.getElementById('output');
	status.textContent = message.status;
	status.className = message.isError ? 'error' : '';
	output.replaceChildren();
	if (message.output) {
		if (message.isError) {
			output.textContent = message.output;
		} else {
			output.appendChild(renderValue(JSON.parse(message.output)));
		}
	}
});
</script>
</body>
</html>`;
}

export function registerWorksheetPreviewCommand(
	context: vscode.ExtensionContext,
	dependencies: WorksheetPreviewDependencies
): vscode.Disposable {
	return vscode.commands.registerCommand('puppyworkbookseditor.openWorksheetPreview', async () => {
		const document = vscode.window.activeTextEditor?.document;
		if (document === undefined || !dependencies.isWorksheetDocument(document)) {
			void vscode.window.showErrorMessage('Open a saved Worksheet or WorkSheet XML file to preview it.');
			return;
		}

		const panel = vscode.window.createWebviewPanel('puppyWorkbookPreview', 'Puppy Workbook Preview', vscode.ViewColumn.Beside, { enableScripts: true });
		panel.webview.html = createPreviewHtml();
		const refresh = async (): Promise<void> => {
			if (document.isDirty && !await document.save()) {
				return;
			}
			void panel.webview.postMessage({ status: 'Running PuppyWorkbooks.CLI.exe…', output: '', isError: false });
			try {
				const result = await dependencies.executeWorksheet(document.uri.fsPath);
				const formattedJson = dependencies.formatCliJson(result.stdout);
				if (formattedJson === undefined) {
					dependencies.cliDiagnostics.set(document.uri, [new vscode.Diagnostic(dependencies.getDiagnosticRange(document), 'PuppyWorkbooks.CLI.exe returned output that is not valid JSON.', vscode.DiagnosticSeverity.Warning)]);
					void panel.webview.postMessage({ status: 'CLI output was not valid JSON.', output: result.stdout, isError: true });
					return;
				}
				dependencies.cliDiagnostics.delete(document.uri);
				void panel.webview.postMessage({ status: result.stderr || 'Completed successfully.', output: formattedJson, isError: false });
			} catch (error) {
				const message = dependencies.toCliErrorMessage(error);
				dependencies.cliDiagnostics.set(document.uri, [new vscode.Diagnostic(dependencies.getDiagnosticRange(document), `PuppyWorkbooks.CLI.exe failed: ${message}`, vscode.DiagnosticSeverity.Error)]);
				void panel.webview.postMessage({ status: `CLI failed: ${message}`, output: '', isError: true });
			}
		};

		context.subscriptions.push(panel.webview.onDidReceiveMessage(message => {
			if (message.type === 'refresh') {
				void refresh();
			}
		}));
		await refresh();
	});
}
