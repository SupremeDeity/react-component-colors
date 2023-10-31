import { JSXIdentifier } from "@babel/types";
import * as vscode from "vscode";
import {
  enabledLanguages,
  clientDecorationType,
  serverDecorationType,
} from "./config";
import * as babelParser from "@babel/parser";
import traverse, { NodePath } from "@babel/traverse";

// ! This may need to be changed to local variable
let clientComponents: vscode.DecorationOptions[] = [];
let serverComponents: vscode.DecorationOptions[] = [];

export async function colorize() {
  type ImportList = {
    specifier: string;
    location: vscode.Position;
  };

  serverComponents = [];
  clientComponents = [];
  const editor = vscode.window.activeTextEditor;
  // No editor instance or not allowed language -> bail out
  if (!editor || !enabledLanguages.includes(editor.document.languageId)) {
    return;
  }

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

/*
 * [uri]: current file we are traversing
 * [sourceLocation]: The position of the source in the file, the part after from in import/export.
 */
async function recursive(
  uri: vscode.Uri,
  sourceLocation: vscode.Position,
  plugins: babelParser.ParserPlugin[],
  decoration: any,
  componentName: string,
  document: vscode.TextDocument
) {
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
        return;
      }

      let loc: vscode.Position | undefined;
      let compName = componentName;
      traverse(componentAst, {
        ExportNamedDeclaration: function (path) {
          if (loc) {
            return;
          }
          let speciferName: string;
          for (const specifier of path.node.specifiers) {
            // Check if the "exported" name is same as the component name we are searching for.
            if (specifier.exported.type === "Identifier") {
              speciferName = specifier.exported.name;
            } else {
              speciferName = specifier.exported.value;
            }

            if (componentName === speciferName) {
              //  We found our export
              //  In case the component is being aliased with "as" we change the name we are searching for.
              if (specifier && specifier.type === "ExportSpecifier") {
                compName = specifier.local.name;
              }
              break;
            }
          }

          // now time to check if a source exist
          if (path.node.source) {
            // We were also able to find a source, forward to that file
            loc = new vscode.Position(
              path.node.source.loc!.start.line - 1,
              path.node.source.loc!.start.column
            );
          } else {
            // Source couldn't be found with the export, meaning its being imported as well.
            traverse(componentAst, {
              ImportDeclaration: function (path) {
                if (loc) {
                  return;
                }
                // Find a import declaration with the name
                let imp = path.node.specifiers.find(
                  (specifier) => specifier.local.name === compName
                );
                // We found the import we are looking for
                if (imp) {
                  //  In case the component is being aliased with "as" we change the name we are searching for.
                  if (imp.type === "ImportSpecifier") {
                    if (imp.imported.type === "Identifier") {
                      compName = imp.imported.name;
                    } else {
                      compName = imp.imported.value;
                    }
                  }

                  loc = new vscode.Position(
                    path.node.source.loc!.start.line - 1,
                    path.node.source.loc!.start.column
                  );
                }
              },
            });
          }
          return;
        },
      });

      // We will keep recursively checking files until we can find no more.
      // If we end up finding a client component, it will be marked at the top of this function
      // If we cant find one and reach the else part, that means its probably a server component.
      if (loc) {
        await recursive(
          result[0].targetUri,
          loc,
          plugins,
          decoration,
          compName,
          document
        );
        return;
      } else {
        serverComponents.push(decoration);
        return;
      }
    }
  }
}
