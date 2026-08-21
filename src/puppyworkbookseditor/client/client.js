const path = require("path");
const {
  workspace,
  languages,
  window
} = require("vscode");

const {
  LanguageClient,
  TransportKind
} = require("vscode-languageclient/node");

let client;

function activate(context) {
  const serverModule = context.asAbsolutePath(
    path.join("server", "server.js")
  );

  const serverOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: { module: serverModule, transport: TransportKind.ipc }
  };

  const clientOptions = {
    documentSelector: [{ language: "xml" }]
  };

  client = new LanguageClient(
    "powerfxXmlServer",
    "PowerFx XML Server",
    serverOptions,
    clientOptions
  );

  client.start();

  // XML tag autocompletion
  context.subscriptions.push(
    languages.registerCompletionItemProvider(
      { language: "xml" },
      {
        provideCompletionItems() {
          return [
            { label: "Worksheet", kind: 14 },
            { label: "Cell", kind: 14 },
            { label: "Name", kind: 14 },
            { label: "Formula", kind: 14 },
            { label: "Comments", kind: 14 }
          ];
        }
      },
      "<"
    )
  );
}

function deactivate() {
  if (!client) return;
  return client.stop();
}

module.exports = { activate, deactivate };
