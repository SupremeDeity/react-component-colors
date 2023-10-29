import * as vscode from "vscode";
import * as babelParser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import { JSXIdentifier } from "@babel/types";

// ! for some reason vscode cant find correct references in javascriptreact files
const enabledLanguages = ["typescriptreact"];
let workspaceConfig = vscode.workspace.getConfiguration();
const clientDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: workspaceConfig.get("reactColorComponents.clientBackground"),
  color: workspaceConfig.get("reactColorComponents.clientForeground"),
});
const serverDecorationType = vscode.window.createTextEditorDecorationType({
  backgroundColor: workspaceConfig.get("reactColorComponents.serverBackground"),
  color: workspaceConfig.get("reactColorComponents.serverForeground"),
});

export async function activate(context: vscode.ExtensionContext) {
  console.log('REACT SERVER COMPONENTS: Started "react-color-components"');

  // Colorize on extension start
  await colorize();

  // Colorize on changing the opened file.
  // TODO: IMPLEMENT Memoization
  let textEditorChange = vscode.window.onDidChangeActiveTextEditor(
    async (event) => {
      await colorize();
    }
  );

  // TODO: only run on tsx/jsx files
  let textDocumentChange = vscode.workspace.onDidChangeTextDocument(
    async (event) => {
      await colorize();
    }
  );

  context.subscriptions.push(textEditorChange);
  context.subscriptions.push(textDocumentChange);
}

async function colorize() {
  console.log("REACT-COLOR-COMPONENT: Colorizing..");
  const editor = vscode.window.activeTextEditor;
  // No editor instance or not allowed language -> bail out
  if (!editor || !enabledLanguages.includes(editor.document.languageId)) {
    return;
  }

  try {
    const plugins: babelParser.ParserPlugin[] = ["jsx", "typescript"];
    const ast = babelParser.parse(editor.document.getText(), {
      sourceType: "module",
      plugins: plugins,
    });
    const nodes: NodePath<JSXIdentifier>[] = [];
    const clientComponents: vscode.DecorationOptions[] = [];
    const serverComponents: vscode.DecorationOptions[] = [];

    traverse(ast, {
      JSXIdentifier: function (path) {
        if (path.parent.type === "JSXAttribute") {
          return;
        }
        nodes.push(path);
      },
    });

    for (const val of nodes) {
      const startPos = editor.document.positionAt(val.node.loc!.start.index);
      const endPos = editor.document.positionAt(val.node.loc!.end.index);

      const decoration = {
        range: new vscode.Range(startPos, endPos),
      };

      const result: vscode.LocationLink[] =
        await vscode.commands.executeCommand(
          "vscode.executeDefinitionProvider",
          editor.document.uri,
          startPos
        );
      console.log(val.node.name, result);
      if (result && result.length > 0) {
        if (!result[0].targetUri.path.endsWith(".d.ts")) {
          const mainDirective = ast.program.directives;
          if (
            mainDirective.length > 0 &&
            mainDirective[0].value.value === "use client"
          ) {
            clientComponents.push(decoration);
            continue;
          }

          let fileContent = await vscode.workspace.openTextDocument(
            result[0].targetUri
          );

          const componentAst = babelParser.parse(fileContent.getText(), {
            sourceType: "module",
            plugins: plugins,
          });
          const directives = componentAst.program.directives;

          if (
            directives.length > 0 &&
            directives[0].value.value === "use client"
          ) {
            clientComponents.push(decoration);
          } else {
            serverComponents.push(decoration);
          }
        }
      }
    }

    editor.setDecorations(clientDecorationType, clientComponents);
    editor.setDecorations(serverDecorationType, serverComponents);
  } catch (e) {
    editor.setDecorations(clientDecorationType, []);
    editor.setDecorations(serverDecorationType, []);
    console.log("REACT-COLOR-COMPONENT: error while parsing");
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
