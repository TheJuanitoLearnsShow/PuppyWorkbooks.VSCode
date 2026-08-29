import * as assert from 'assert';

// You can import and use all API from the 'vscode' module
// as well as import your extension to test it
import * as vscode from 'vscode';
import { formatCliJson, getAllowedChildren, isInsideFormula, validateXmlNodes } from '../extension';
import { getWorksheetPreviewData } from '../worksheetPreview';

suite('Extension Test Suite', () => {
	vscode.window.showInformationMessage('Start all tests.');

	test('Sample test', () => {
		assert.strictEqual(-1, [1, 2, 3].indexOf(5));
		assert.strictEqual(-1, [1, 2, 3].indexOf(0));
	});

	test('offers only children valid for the current workbook node', () => {
		const xml = '<Integration><Steps><';
		assert.deepStrictEqual(getAllowedChildren(xml, xml.length), ['IOInput', 'Map', 'Filter', 'Reduce', 'IOOutput', 'Switch']);
	});

	test('recognizes Formula content', () => {
		const xml = '<WorkSheet><Cells><WorkCell><Formula>Value(InputRecord.Amount)</Formula></WorkCell></Cells></WorkSheet>';
		assert.strictEqual(isInsideFormula(xml, xml.indexOf('Value')), true);
		assert.strictEqual(isInsideFormula(xml, xml.indexOf('<Formula>')), false);
	});

	test('reports unknown and invalid child elements', () => {
		const issues = validateXmlNodes('<Integration><Name>Invalid</Name><Steps><Unknown /></Steps></Integration>');
		assert.strictEqual(issues.length, 2);
		assert.match(issues[0].message, /not allowed/);
		assert.match(issues[1].message, /Unknown/);
	});

	test('formats JSON emitted by the worksheet CLI', () => {
		assert.strictEqual(formatCliJson('{"total":3,"names":["Ada"]}'), '{\n  "total": 3,\n  "names": [\n    "Ada"\n  ]\n}');
		assert.strictEqual(formatCliJson('not json'), undefined);
	});

	test('extracts cells from the first result item for worksheet preview', () => {
		const parsed = {
			results: [
				{
					name: 'Map',
					cells: [
						{ cellName: 'AgeMultier', cellId: 0, output: '3' },
						{ cellName: 'Name', cellId: 1, output: 'Sample' }
					]
				}
			]
		};
		assert.deepStrictEqual(getWorksheetPreviewData(parsed), [
			{ cellName: 'AgeMultier', cellId: 0, output: '3' },
			{ cellName: 'Name', cellId: 1, output: 'Sample' }
		]);
	});

	test('returns original parsed data if results or cells are not present', () => {
		const parsed = { total: 3 };
		assert.deepStrictEqual(getWorksheetPreviewData(parsed), { total: 3 });
		assert.deepStrictEqual(getWorksheetPreviewData(null), null);
		assert.deepStrictEqual(getWorksheetPreviewData({ results: [] }), { results: [] });
	});
});
