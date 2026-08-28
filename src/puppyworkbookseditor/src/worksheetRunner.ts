import * as vscode from 'vscode';

interface CliResult {
	stdout: string;
	stderr: string;
}

interface WorksheetRunnerDependencies {
	cliDiagnostics: vscode.DiagnosticCollection;
	executeWorksheet(fileName: string): Promise<CliResult>;
	formatCliJson(stdout: string): string | undefined;
	getDiagnosticRange(document: vscode.TextDocument): vscode.Range;
	isWorksheetDocument(document: vscode.TextDocument): boolean;
	outputChannel: vscode.OutputChannel;
	toCliErrorMessage(error: unknown): string;
}

export function registerRunWorksheetCommand(dependencies: WorksheetRunnerDependencies): vscode.Disposable {
	return vscode.commands.registerCommand('puppyworkbookseditor.runWorksheet', async () => {
		const document = vscode.window.activeTextEditor?.document;
		const isWorksheet = document !== undefined && dependencies.isWorksheetDocument(document);
		if (!isWorksheet) {
			void vscode.window.showErrorMessage('Open a saved Worksheet or WorkSheet XML file before running it.');
			return;
		}
		if (document.isDirty && !await document.save()) {
			return;
		}

		try {
			const result = await dependencies.executeWorksheet(document.uri.fsPath);
			const formattedJson = dependencies.formatCliJson(result.stdout);
			if (formattedJson === undefined) {
				dependencies.cliDiagnostics.set(document.uri, [new vscode.Diagnostic(dependencies.getDiagnosticRange(document), 'PuppyWorkbooks.CLI.exe returned output that is not valid JSON.', vscode.DiagnosticSeverity.Warning)]);
			} else {
				dependencies.cliDiagnostics.delete(document.uri);
			}
			dependencies.outputChannel.clear();
			dependencies.outputChannel.appendLine(formattedJson ?? result.stdout);
			if (result.stderr) {
				dependencies.outputChannel.appendLine(result.stderr);
			}
			dependencies.outputChannel.show(true);
		} catch (error) {
			const message = dependencies.toCliErrorMessage(error);
			dependencies.cliDiagnostics.set(document.uri, [new vscode.Diagnostic(dependencies.getDiagnosticRange(document), `PuppyWorkbooks.CLI.exe failed: ${message}`, vscode.DiagnosticSeverity.Error)]);
			void vscode.window.showErrorMessage('Puppy Workbooks CLI failed. See Problems for details.');
		}
	});
}
