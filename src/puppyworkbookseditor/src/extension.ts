// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as path from 'path';
import * as vscode from 'vscode';
import { LanguageClient, LanguageClientOptions, ServerOptions, TransportKind } from 'vscode-languageclient/node';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
class PowerFxXmlExtension {
	private client: LanguageClient | undefined;

	public activate(context: vscode.ExtensionContext): void {
		const serverModule = context.asAbsolutePath(path.join('server', 'server.js'));
		const serverOptions: ServerOptions = {
			run: { module: serverModule, transport: TransportKind.ipc },
			debug: { module: serverModule, transport: TransportKind.ipc }
		};
		const clientOptions: LanguageClientOptions = {
			documentSelector: [{ language: 'xml' }]
		};

		this.client = new LanguageClient('powerfxXmlServer', 'PowerFx XML Server', serverOptions, clientOptions);
		context.subscriptions.push(this.client);
		void this.client.start();

		context.subscriptions.push(
			vscode.languages.registerCompletionItemProvider(
				{ language: 'xml' },
				{
					provideCompletionItems: (): vscode.CompletionItem[] => [
						new vscode.CompletionItem('Worksheet', vscode.CompletionItemKind.Class),
						new vscode.CompletionItem('Cell', vscode.CompletionItemKind.Field),
						new vscode.CompletionItem('Name', vscode.CompletionItemKind.Field),
						new vscode.CompletionItem('Formula', vscode.CompletionItemKind.Field),
						new vscode.CompletionItem('Comments', vscode.CompletionItemKind.Field)
					]
				},
				'<'
			)
		);
	}

	public deactivate(): Thenable<void> | undefined {
		return this.client?.stop();
	}
}

let extension: PowerFxXmlExtension | undefined;

export function activate(context: vscode.ExtensionContext): void {
	extension = new PowerFxXmlExtension();
	extension.activate(context);
}

export function deactivate(): Thenable<void> | undefined {
	return extension?.deactivate();
}
