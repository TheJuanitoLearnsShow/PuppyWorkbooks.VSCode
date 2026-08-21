import * as vscode from 'vscode';

type ElementName = keyof typeof CHILDREN_BY_PARENT;

interface XmlTag {
	name: string;
	start: number;
	end: number;
	isClosing: boolean;
	isSelfClosing: boolean;
}

export interface XmlValidationIssue {
	message: string;
	start: number;
	length: number;
}

const WORKSHEET_CHILDREN = ['Name', 'Variables', 'Cells'] as const;

const CHILDREN_BY_PARENT = {
	Integration: ['Steps'],
	Steps: ['IOInput', 'Map', 'Filter', 'Reduce', 'IOOutput', 'Switch'],
	IOInput: [],
	IOOutput: [],
	Map: ['Worksheet', 'WorkSheet'],
	Filter: ['Worksheet', 'WorkSheet'],
	Reduce: ['InitialStateJson', 'Worksheet', 'WorkSheet'],
	Switch: ['Worksheet', 'WorkSheet', 'Branch'],
	Branch: ['Map'],
	Worksheet: WORKSHEET_CHILDREN,
	WorkSheet: WORKSHEET_CHILDREN,
	Variables: ['Variable'],
	Variable: ['Key', 'Value'],
	Cells: ['WorkCell'],
	WorkCell: ['Id', 'Name', 'Formula', 'Comments'],
	InitialStateJson: [],
	Name: [],
	Key: [],
	Value: [],
	Id: [],
	Formula: [],
	Comments: []
} as const;

const POWERFX_FUNCTIONS = [
	'Sum', 'Filter', 'LookUp', 'Patch', 'Collect', 'Clear', 'UpdateContext', 'Navigate',
	'Rand', 'Text', 'Value', 'CountRows', 'CountIf', 'Sort', 'SortByColumns', 'AddColumns',
	'DropColumns', 'RenameColumns', 'ShowColumns', 'Search', 'Concat', 'Split', 'Left',
	'Right', 'Mid', 'Upper', 'Lower', 'Trim', 'Len', 'IsBlank', 'IsError', 'Coalesce',
	'Sequence', 'Table', 'First', 'Last', 'Defaults'
];

function getXmlTags(xml: string): XmlTag[] {
	const tags: XmlTag[] = [];
	const tagPattern = /<\/?([A-Za-z_][\w.-]*)(?:\s+(?:"[^"]*"|'[^']*'|[^'">])*)?\s*\/?>/g;
	for (const match of xml.matchAll(tagPattern)) {
		const text = match[0];
		tags.push({
			name: match[1],
			start: match.index ?? 0,
			end: (match.index ?? 0) + text.length,
			isClosing: text.startsWith('</'),
			isSelfClosing: /\/\s*>$/.test(text)
		});
	}
	return tags;
}

function getOpenElements(xml: string, offset: number): string[] {
	const openElements: string[] = [];
	for (const tag of getXmlTags(xml)) {
		if (tag.end > offset) {
			break;
		}
		if (tag.isClosing) {
			const index = openElements.lastIndexOf(tag.name);
			if (index >= 0) {
				openElements.splice(index);
			}
		} else if (!tag.isSelfClosing) {
			openElements.push(tag.name);
		}
	}
	return openElements;
}

export function isInsideFormula(xml: string, offset: number): boolean {
	const formulaPattern = /<Formula>([\s\S]*?)<\/Formula>/g;
	for (const match of xml.matchAll(formulaPattern)) {
		const contentStart = (match.index ?? 0) + '<Formula>'.length;
		const contentEnd = contentStart + match[1].length;
		if (offset >= contentStart && offset <= contentEnd) {
			return true;
		}
	}
	return false;
}

export function getAllowedChildren(xml: string, offset: number): readonly string[] | undefined {
	const beforeCursor = xml.slice(0, offset);
	const incompleteTag = /<([A-Za-z_]?[\w.-]*)$/.exec(beforeCursor);
	if (!incompleteTag || beforeCursor.endsWith('</')) {
		return undefined;
	}
	const parent = getOpenElements(xml, incompleteTag.index).at(-1) as ElementName | undefined;
	return parent === undefined ? ['Integration', 'WorkSheet', 'Worksheet'] : CHILDREN_BY_PARENT[parent];
}

export function validateXmlNodes(xml: string): XmlValidationIssue[] {
	const issues: XmlValidationIssue[] = [];
	const openElements: XmlTag[] = [];
	for (const tag of getXmlTags(xml)) {
		if (tag.isClosing) {
			const index = openElements.map(element => element.name).lastIndexOf(tag.name);
			if (index >= 0) {
				openElements.splice(index);
			}
			continue;
		}

		const parent = openElements.at(-1)?.name as ElementName | undefined;
		if (!(tag.name in CHILDREN_BY_PARENT)) {
			issues.push({ message: `Unknown workbook XML element <${tag.name}>.`, start: tag.start + 1, length: tag.name.length });
		} else if (parent !== undefined && !(CHILDREN_BY_PARENT[parent] as readonly string[]).includes(tag.name)) {
			issues.push({ message: `<${tag.name}> is not allowed inside <${parent}>.`, start: tag.start + 1, length: tag.name.length });
		}

		if (!tag.isSelfClosing) {
			openElements.push(tag);
		}
	}
	return issues;
}

function createElementCompletion(name: string): vscode.CompletionItem {
	const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Class);
	item.insertText = new vscode.SnippetString(`${name}>$0</${name}>`);
	item.detail = 'Puppy workbook XML element';
	return item;
}

function createPowerFxCompletion(name: string): vscode.CompletionItem {
	const item = new vscode.CompletionItem(name, vscode.CompletionItemKind.Function);
	item.insertText = new vscode.SnippetString(`${name}($0)`);
	item.detail = 'Power Fx function';
	return item;
}

export function activate(context: vscode.ExtensionContext): void {
	const diagnostics = vscode.languages.createDiagnosticCollection('puppyWorkbookXml');
	context.subscriptions.push(diagnostics);

	const updateDiagnostics = (document: vscode.TextDocument): void => {
		if (document.languageId !== 'xml') {
			return;
		}
		const xml = document.getText();
		const documentDiagnostics = validateXmlNodes(xml).map(issue => new vscode.Diagnostic(
			new vscode.Range(document.positionAt(issue.start), document.positionAt(issue.start + issue.length)),
			issue.message,
			vscode.DiagnosticSeverity.Error
		));
		diagnostics.set(document.uri, documentDiagnostics);
	};

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument(updateDiagnostics),
		vscode.workspace.onDidChangeTextDocument(event => updateDiagnostics(event.document)),
		vscode.workspace.onDidCloseTextDocument(document => diagnostics.delete(document.uri)),
		vscode.languages.registerCompletionItemProvider(
			{ language: 'xml' },
			{
				provideCompletionItems(document, position): vscode.CompletionItem[] | undefined {
					const xml = document.getText();
					const offset = document.offsetAt(position);
					if (isInsideFormula(xml, offset)) {
						return POWERFX_FUNCTIONS.map(createPowerFxCompletion);
					}
					return getAllowedChildren(xml, offset)?.map(createElementCompletion);
				}
			},
			'<', '.', '('
		)
	);

	vscode.workspace.textDocuments.forEach(updateDiagnostics);
}

export function deactivate(): void {
}
