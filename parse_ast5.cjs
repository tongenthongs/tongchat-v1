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

if (mainReturn && mainReturn.expression && ts.isParenthesizedExpression(mainReturn.expression)) {
    const expr = mainReturn.expression.expression;
    console.log("Inside parens:", ts.SyntaxKind[expr.kind]);
    let end = sourceFile.getLineAndCharacterOfPosition(expr.getEnd());
    console.log(`Ends at line ${end.line + 1}`);
    
    // If it's a JSX element, check its children.
    if (ts.isJsxElement(expr)) {
        const closing = expr.closingElement;
        let cEnd = sourceFile.getLineAndCharacterOfPosition(closing.getEnd());
        console.log(`Closing element: <${closing.tagName.getText()}> ends at line ${cEnd.line + 1}`);
    }
}
