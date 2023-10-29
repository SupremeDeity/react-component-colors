import * as vscode from "vscode";
import * as babelParser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";
import { JSXIdentifier } from "@babel/types";

type ImportList = {
  specifier: string;
  location: vscode.Position;
};

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

// ! This may need to be changed to local variable
let clientComponents: vscode.DecorationOptions[] = [];
let serverComponents: vscode.DecorationOptions[] = [];

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

  let textDocumentChange = vscode.workspace.onDidChangeTextDocument(
    async (event) => {
      await colorize();
    }
  );

  context.subscriptions.push(textEditorChange);
  context.subscriptions.push(textDocumentChange);
}

async function colorize() {
  serverComponents = [];
  clientComponents = [];
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
    const imports: ImportList[] = [];

    // Check if current file is a client component
    const currentFileDirectives = ast.program.directives;
    let isCurrentClient = false;
    if (
      currentFileDirectives.length > 0 &&
      currentFileDirectives[0].value.value === "use client"
    ) {
      isCurrentClient = true;
    }

    traverse(ast, {
      JSXIdentifier: function (path) {
        if (path.parent.type === "JSXAttribute") {
          return;
        }

        nodes.push(path);
      },
      ImportDeclaration: function (path) {
        const position = editor.document.positionAt(
          path.node.source.loc!.start.index
        );
        for (const specifier of path.node.specifiers) {
          imports.push({ specifier: specifier.local.name, location: position });
        }
      },
    });

    for (const val of nodes) {
      const startPos = editor.document.positionAt(val.node.loc!.start.index);
      const endPos = editor.document.positionAt(val.node.loc!.end.index);

      const decoration = {
        range: new vscode.Range(startPos, endPos),
      };

      // ! Temporary solution to check for intrinsic elements
      // ! If current file has directive -> Just set all custom elements to client
      if (
        isCurrentClient &&
        val.node.name[0] === val.node.name[0].toUpperCase()
      ) {
        clientComponents.push(decoration);
        continue;
      }

      const matchingImport = imports.find(
        (importItem) => importItem.specifier === val.node.name
      );
      if (matchingImport) {
        await recursive(
          editor.document.uri,
          matchingImport.location,
          plugins,
          decoration,
          matchingImport.specifier,
          editor.document
        );
      }
    }

    editor.setDecorations(clientDecorationType, clientComponents);
    editor.setDecorations(serverDecorationType, serverComponents);
  } catch (e) {
    editor.setDecorations(clientDecorationType, []);
    editor.setDecorations(serverDecorationType, []);
    console.log("REACT-COLOR-COMPONENT:", e);
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}

async function recursive(
  uri: vscode.Uri,
  sourceLocation: vscode.Position,
  plugins: babelParser.ParserPlugin[],
  decoration: any,
  componentName: string,
  document: vscode.TextDocument
) {
  console.log("Parsing for", componentName, uri.path);
  let isClient;
  const result: vscode.LocationLink[] = await vscode.commands.executeCommand(
    "vscode.executeDefinitionProvider",
    uri,
    sourceLocation
  );
  if (result && result.length > 0) {
    if (!result[0].targetUri.path.endsWith(".d.ts")) {
      let fileContent = await vscode.workspace.openTextDocument(
        result[0].targetUri
      );

      const componentAst = babelParser.parse(fileContent.getText(), {
        sourceType: "module",
        plugins: plugins,
      });
      const directives = componentAst.program.directives;

      if (directives.length > 0 && directives[0].value.value === "use client") {
        clientComponents.push(decoration);
        isClient = true;
        console.log("Marked", componentName, "as client");
        return;
      }

      let loc: vscode.Position | undefined;
      let compName = componentName;
      traverse(componentAst, {
        ImportDeclaration: function (path) {
          if (loc) {
            return;
          }
          console.log(
            "Doing import decl for",
            compName,
            result[0].targetUri.path
          );
          let imp = path.node.specifiers.find(
            (specifier) => specifier.local.name === compName
          );
          if (!path.node.source || !imp) {
            console.log(
              "IMPORt DECL: ",
              compName,
              uri.path,
              result[0].targetUri.path
            );
            console.log(!path.node.source, !imp);
            return;
          }

          // ! could be incorrect
          loc = new vscode.Position(
            path.node.source.loc!.start.line - 1,
            path.node.source.loc!.start.column
          );
          console.log(compName, uri.path, result[0].targetUri.path, loc);
          return;
        },

        ExportNamedDeclaration: function (path) {
          if (loc) {
            return;
          }
          console.log(
            "Doing export named decl for",
            compName,
            result[0].targetUri.path
          );
          let imp = path.node.specifiers.find((specifier) => {
            if (specifier.type === "ExportSpecifier") {
              if (specifier.exported.type === "Identifier") {
                return specifier.exported.name === compName;
              } else {
                return specifier.exported.value === compName;
              }
            }
          });

          if (!path.node.source || !imp || imp.type !== "ExportSpecifier") {
            console.log(
              "EXPORT DECL: ",
              compName,
              uri.path,
              result[0].targetUri.path,
              path.node
            );
            console.log(
              !path.node.source,
              !imp,
              imp?.type !== "ExportSpecifier"
            );
            return;
          }

          compName = imp.local.name;

          // ! could be incorrect
          loc = new vscode.Position(
            path.node.source.loc!.start.line - 1,
            path.node.source.loc!.start.column
          );
          console.log(compName, uri.path, result[0].targetUri.path, loc);
          return;
        },
      });
      if (!loc) {
        console.log("Undefined");
        if (!isClient) {
          console.log("Marked", compName, "as server");
          serverComponents.push(decoration);
        }
        return;
      }
      console.log(
        "Found location for",
        compName,
        uri,
        result[0].targetUri.path
      );
      await recursive(
        result[0].targetUri,
        loc,
        plugins,
        decoration,
        compName,
        document
      );
    }
  }
}
