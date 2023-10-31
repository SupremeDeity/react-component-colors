import * as vscode from "vscode";
import { colorize } from "./colorize";

export async function activate(context: vscode.ExtensionContext) {
  console.log('REACT SERVER COMPONENTS: Started "react-color-components"');

  // Colorize on extension start
  await colorize();

  // Colorize on changing the opened file.
  // TODO: IMPLEMENT Memoization
  let textEditorChange = vscode.window.onDidChangeActiveTextEditor(
    async (_) => {
      await colorize();
    }
  );

  let textDocumentChange = vscode.workspace.onDidChangeTextDocument(
    async (_) => {
      await colorize();
    }
  );

  context.subscriptions.push(textEditorChange);
  context.subscriptions.push(textDocumentChange);
}

// This method is called when your extension is deactivated
export function deactivate() {}
