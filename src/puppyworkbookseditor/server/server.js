const {
  createConnection,
  TextDocuments,
  CompletionItemKind
} = require("vscode-languageserver");

const { XMLParser } = require("fast-xml-parser");

const connection = createConnection();
const documents = new TextDocuments();

const POWERFX_FUNCTIONS = [
  "Sum","Filter","LookUp","Patch","Collect","Clear","UpdateContext","Navigate",
  "Rand","Text","Value","CountRows","CountIf","Sort","SortByColumns","AddColumns",
  "DropColumns","RenameColumns","ShowColumns","Search","Concat","Split","Left",
  "Right","Mid","Upper","Lower","Trim","Len","IsBlank","IsError","Coalesce",
  "Sequence","Table","First","Last","Defaults"
];

connection.onInitialize(() => ({
  capabilities: {
    textDocumentSync: 1,
    completionProvider: { resolveProvider: false }
  }
}));

function isInsideFormula(xmlText, positionOffset) {
  const parser = new XMLParser({ ignoreAttributes: false, preserveOrder: true });
  const nodes = parser.parse(xmlText);

  for (const node of nodes) {
    if (node.tagName === "Formula" && node.children?.length) {
      const textNode = node.children.find(c => c.type === "text");
      if (!textNode) continue;

      const start = textNode.startIndex;
      const end = textNode.endIndex;

      if (positionOffset >= start && positionOffset <= end) {
        return true;
      }
    }
  }
  return false;
}

connection.onCompletion(params => {
  const doc = documents.get(params.textDocument.uri);
  const xml = doc.getText();
  const offset = doc.offsetAt(params.position);

  if (!isInsideFormula(xml, offset)) return [];

  return POWERFX_FUNCTIONS.map(fn => ({
    label: fn,
    kind: CompletionItemKind.Function
  }));
});

documents.listen(connection);
connection.listen();
