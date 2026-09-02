const fs = require('fs');
const ts = require('typescript');

let code = fs.readFileSync('src/components/customer/Catalog.tsx', 'utf8');
const sourceFile = ts.createSourceFile('Catalog.tsx', code, ts.ScriptTarget.Latest, true);

let returnStmts = [];
function findReturn(node) {
    if (ts.isReturnStatement(node)) {
        returnStmts.push(node);
    }
    ts.forEachChild(node, findReturn);
}
findReturn(sourceFile);

const mainReturn = returnStmts.find(r => sourceFile.getLineAndCharacterOfPosition(r.getStart()).line + 1 === 212);
if (mainReturn) {
    console.log("Main return statement found!");
    let end = sourceFile.getLineAndCharacterOfPosition(mainReturn.getEnd());
    console.log(`Ends at line ${end.line + 1}`);
    
    // Check if it's returning a JSX element
    if (mainReturn.expression) {
        console.log("Expression kind:", ts.SyntaxKind[mainReturn.expression.kind]);
    }
} else {
    console.log("Could not find return at line 212.");
}
