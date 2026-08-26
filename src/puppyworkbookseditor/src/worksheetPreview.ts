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
pre { background: var(--vscode-textCodeBlock-background); border-radius: 4px; padding: 1rem; white-space: pre-wrap; }
.error { color: var(--vscode-errorForeground); }
</style>
</head>
<body>
<button id="refresh">Refresh</button>
<div id="status">Run the worksheet to view its JSON output.</div>
<pre id="output"></pre>
<script>
const vscode = acquireVsCodeApi();
document.getElementById('refresh').addEventListener('click', () => vscode.postMessage({ type: 'refresh' }));
window.addEventListener('message', event => {
	const message = event.data;
	const status = document.getElementById('status');
	const output = document.getElementById('output');
	status.textContent = message.status;
	status.className = message.isError ? 'error' : '';
	output.textContent = message.output || '';
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
