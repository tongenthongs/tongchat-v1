const fs = require('fs');
const ts = require('typescript');

let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');
const sourceFile = ts.createSourceFile('Catalog.tsx', code, ts.ScriptTarget.Latest, true);

let deepestNode = null;
let maxDepth = -1;

function visit(node, depth) {
  // If this node ends exactly at the end of the file!
  if (node.end === sourceFile.end) {
    if (depth > maxDepth) {
        maxDepth = depth;
        deepestNode = node;
    }
  }
  ts.forEachChild(node, child => visit(child, depth + 1));
}

visit(sourceFile, 0);

if (deepestNode) {
    console.log("Deepest node reaching EOF is kind:", ts.SyntaxKind[deepestNode.kind]);
    let start = sourceFile.getLineAndCharacterOfPosition(deepestNode.getStart());
    console.log(`Starts at line ${start.line + 1}, character ${start.character + 1}`);
    const lines = code.split('\n');
    console.log("Snippet:", lines.slice(start.line, start.line + 3).join('\n'));
}
