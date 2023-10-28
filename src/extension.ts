import * as vscode from "vscode";
import * as babelParser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import { JSXIdentifier } from "@babel/types";

// ! for some reason vscode cant find correct references in javascriptreact files
const enabledLanguages = ["typescriptreact"];

export async function activate(context: vscode.ExtensionContext) {
  console.log('REACT SERVER COMPONENTS: Started "react-color-components"');

  // Colorize on extension start
  await colorize();

  // Colorize on changing the opened file.
  // TODO: IMPLEMENT Memoization
  let textEditorChange = vscode.window.onDidChangeVisibleTextEditors(
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
  const editor = vscode.window.activeTextEditor;
  // No editor instance or not allowed language -> bail out
  if (!editor || !enabledLanguages.includes(editor.document.languageId)) {
    return;
  }

  const clientDecorationType = vscode.window.createTextEditorDecorationType({
    backgroundColor: "skyblue",
  });
  editor.setDecorations(clientDecorationType, []);

  try {
    const plugins: babelParser.ParserPlugin[] = ["jsx"];
    if (editor.document.languageId === "typescriptreact") {
      plugins.push("typescript");
    }
    const ast = babelParser.parse(editor.document.getText(), {
      sourceType: "module",
      plugins: plugins,
    });

    const nodes: NodePath<JSXIdentifier>[] = [];

    traverse(ast, {
      JSXIdentifier: function (path) {
        if (path.parent.type === "JSXAttribute") {
          return;
        }
        nodes.push(path);
      },
    });

    const clientComponents: vscode.DecorationOptions[] = [];
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
      if (result && result.length > 0) {
        if (!result[0].targetUri.path.endsWith(".d.ts")) {
          const mainDirective = ast.program.directives[0];
          if (mainDirective.value.value === "use client") {
            clientComponents.push(decoration);
            continue;
          }
          // ! >------<

          let fileContent = await vscode.workspace.openTextDocument(
            result[0].targetUri
          );

          const componentAst = babelParser.parse(fileContent.getText(), {
            sourceType: "module",
            errorRecovery: true,
            plugins: plugins,
          });
          const directives = componentAst.program.directives;

          if (directives[0].value.value === "use client") {
            clientComponents.push(decoration);
          }
        }
      }
    }

    editor.setDecorations(clientDecorationType, clientComponents);
  } catch (e) {
    console.log(e);
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}
