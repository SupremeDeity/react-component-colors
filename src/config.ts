import * as vscode from "vscode";

// ! for some reason vscode cant find correct references in javascriptreact files
export const enabledLanguages = ["typescriptreact", "javascriptreact"];
let workspaceConfig = vscode.workspace.getConfiguration();
export const clientDecorationType =
  vscode.window.createTextEditorDecorationType({
    backgroundColor: workspaceConfig.get(
      "reactColorComponents.clientBackground"
    ),
    color: workspaceConfig.get("reactColorComponents.clientForeground"),
  });
export const serverDecorationType =
  vscode.window.createTextEditorDecorationType({
    backgroundColor: workspaceConfig.get(
      "reactColorComponents.serverBackground"
    ),
    color: workspaceConfig.get("reactColorComponents.serverForeground"),
  });
