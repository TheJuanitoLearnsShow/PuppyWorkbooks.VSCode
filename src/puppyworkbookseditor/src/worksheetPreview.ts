import * as vscode from 'vscode';
import { readFile } from 'fs/promises';
import * as path from 'path';

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

async function createPreviewHtml(context: vscode.ExtensionContext): Promise<string> {
	return readFile(path.join(context.extensionPath, 'media', 'worksheetPreview.html'), 'utf8');
}

export function getWorksheetPreviewData(parsed: unknown): unknown {
	if (parsed !== null && typeof parsed === 'object') {
		const record = parsed as Record<string, unknown>;
		const results = record.results ?? record.Results;
		if (Array.isArray(results) && results.length > 0 && results[0] !== null && typeof results[0] === 'object') {
			const firstItem = results[0] as Record<string, unknown>;
			const cells = firstItem.cells ?? firstItem.Cells;
			if (cells !== undefined) {
				return cells;
			}
		}
	}
	return parsed;
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
		panel.webview.html = await createPreviewHtml(context);
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
