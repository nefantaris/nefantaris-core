const oppositeOperators = { "&&": "||", "||": "&&" };

const toggledEqualityOperators = {
    "===": "!==",
    "!==": "===",
    "==": "!=",
    "!=": "==",
};

const booleanComparisonOperators = new Set([
    "instanceof",
    "in",
    "===",
    "!==",
    "==",
    "!=",
    "<",
    ">",
    "<=",
    ">=",
]);

const booleanControlFlowTypes = new Set([
    "ConditionalExpression",
    "LogicalExpression",
    "UnaryExpression",
    "IfStatement",
    "WhileStatement",
    "DoWhileStatement",
    "ForStatement",
]);

const truthinessStatementTypes = new Set([
    "ExpressionStatement",
    "IfStatement",
    "WhileStatement",
    "DoWhileStatement",
    "ForStatement",
]);

const looseBindingTypes = new Set([
    "ArrowFunctionExpression",
    "AssignmentExpression",
    "ConditionalExpression",
    "SequenceExpression",
    "YieldExpression",
    "TSAsExpression",
    "TSSatisfiesExpression",
]);

const tightParentTypes = new Set([
    "AwaitExpression",
    "BinaryExpression",
    "TaggedTemplateExpression",
    "UnaryExpression",
    "TSAsExpression",
    "TSNonNullExpression",
    "TSSatisfiesExpression",
    "TSTypeAssertion",
]);

const statementStartHazard =
    /^(?:[(+\-/[`{]|function(?![\w$])|class(?![\w$]))/u;

const isNot = (node) =>
    node?.type === "UnaryExpression" && node.operator === "!";

const isParenthesized = (sourceCode, node) =>
    sourceCode.getTokenBefore(node)?.value === "(" &&
    sourceCode.getTokenAfter(node)?.value === ")";

const hasMixedOperators = (sourceCode, expression, operator) =>
    [expression.left, expression.right].some(
        (operand) =>
            operand.type === "LogicalExpression" &&
            !isParenthesized(sourceCode, operand) &&
            (operand.operator !== operator ||
                hasMixedOperators(sourceCode, operand, operator))
    );

const withoutDoubleNegation = (node) =>
    isNot(node) && isNot(node.argument)
        ? withoutDoubleNegation(node.argument.argument)
        : node;

const hasNegationInside = (node) => {
    const expression = withoutDoubleNegation(node);
    return (
        isNot(expression) ||
        (expression.type === "LogicalExpression" &&
            (hasNegationInside(expression.left) ||
                hasNegationInside(expression.right)))
    );
};

const hasBooleanContext = ({ parent }) =>
    booleanControlFlowTypes.has(parent.type) ||
    (parent.type === "BinaryExpression" &&
        booleanComparisonOperators.has(parent.operator)) ||
    (parent.type === "CallExpression" &&
        parent.callee.type === "Identifier" &&
        parent.callee.name === "Boolean");

const isInTruthinessContext = (node) => {
    const { parent } = node;
    if (truthinessStatementTypes.has(parent.type)) {
        return true;
    }
    switch (parent.type) {
        case "ConditionalExpression":
            return parent.test === node || isInTruthinessContext(parent);
        case "SequenceExpression":
            return (
                parent.expressions.at(-1) !== node ||
                isInTruthinessContext(parent)
            );
        case "LogicalExpression":
            return parent.operator !== "??" && isInTruthinessContext(parent);
        default:
            return isNot(parent);
    }
};

const isInsideForInitializer = (node) => {
    const { parent } = node;
    if (parent?.type === "ForStatement") {
        return parent.init === node;
    }
    return (
        (parent?.type === "VariableDeclarator" ||
            parent?.type === "VariableDeclaration" ||
            parent?.type.endsWith("Expression") === true) &&
        isInsideForInitializer(parent)
    );
};

const needsParentParens = (node, targetOperator) => {
    const { parent } = node;
    if (isInsideForInitializer(node) || tightParentTypes.has(parent.type)) {
        return true;
    }
    switch (parent.type) {
        case "LogicalExpression":
            return (
                parent.operator === "??" ||
                (targetOperator === "||" && parent.operator === "&&")
            );
        case "MemberExpression":
            return parent.object === node;
        case "CallExpression":
        case "NewExpression":
            return parent.callee === node;
        default:
            return false;
    }
};

const toggleEquality = (sourceCode, node, text) => {
    const toggled = toggledEqualityOperators[node.operator];
    const operatorToken = sourceCode
        .getTokensBetween(node.left, node.right)
        .find((token) => token.value === node.operator);
    if (toggled === undefined || operatorToken === undefined) {
        return `!(${text})`;
    }
    const [start] = node.range;
    return (
        text.slice(0, operatorToken.range[0] - start) +
        toggled +
        text.slice(operatorToken.range[1] - start)
    );
};

const negate = (sourceCode, node, canStripNegation) => {
    const text = sourceCode.getText(node);
    if (node.type === "BinaryExpression") {
        return toggleEquality(sourceCode, node, text);
    }
    if (node.type === "Literal" && typeof node.value === "boolean") {
        return String(!node.value);
    }
    if (node.type === "LogicalExpression" || looseBindingTypes.has(node.type)) {
        return `!(${text})`;
    }
    if (isNot(node) && isNot(node.argument)) {
        return sourceCode.getText(node.argument);
    }
    if (isNot(node) && canStripNegation) {
        return text.slice(1).trimStart();
    }
    return `!${text}`;
};

const operandsOf = (node, operator) =>
    node.type === "LogicalExpression" && node.operator === operator
        ? [
              ...operandsOf(node.left, operator),
              ...operandsOf(node.right, operator),
          ]
        : [node];

const enclosingStatement = (node) =>
    node.type.endsWith("Statement") || node.type === "Program"
        ? node
        : enclosingStatement(node.parent);

const startsStatementUnsafely = (node, replacement) => {
    const statement = enclosingStatement(node);
    return (
        statement.type === "ExpressionStatement" &&
        statement.range[0] === node.range[0] &&
        statementStartHazard.test(replacement)
    );
};

const isReportable = (sourceCode, node, operator) =>
    isNot(node) &&
    !isNot(node.parent) &&
    node.argument.type === "LogicalExpression" &&
    node.argument.operator === operator &&
    !hasMixedOperators(sourceCode, node.argument, operator) &&
    (hasBooleanContext(node) || !hasNegationInside(node.argument));

const singleLine = (text) => text.replaceAll(/\s+/gu, " ");

const createRule = ({ operator, kind, messageId }) => {
    const targetOperator = oppositeOperators[operator];
    return {
        meta: {
            type: "suggestion",
            fixable: "code",
            docs: {
                description: `Transforms a negated ${kind} with De Morgan's law`,
            },
            messages: {
                [messageId]: `Replace negated ${kind} \`{{ original }}\` with \`{{ fixed }}\``,
            },
            schema: [],
        },
        create(context) {
            const { sourceCode } = context;
            return {
                UnaryExpression(node) {
                    if (!isReportable(sourceCode, node, operator)) {
                        return;
                    }
                    const canStripNegation = isInTruthinessContext(node);
                    const joined = operandsOf(node.argument, operator)
                        .map((operand) =>
                            negate(sourceCode, operand, canStripNegation)
                        )
                        .join(` ${targetOperator} `);
                    const replacement = needsParentParens(node, targetOperator)
                        ? `(${joined})`
                        : joined;
                    const isFixable =
                        sourceCode.getCommentsInside(node).length === 0 &&
                        !startsStatementUnsafely(node, replacement);
                    context.report({
                        node,
                        messageId,
                        data: {
                            original: singleLine(sourceCode.getText(node)),
                            fixed: singleLine(replacement),
                        },
                        fix: (fixer) =>
                            isFixable
                                ? fixer.replaceText(node, replacement)
                                : null,
                    });
                },
            };
        },
    };
};

export default {
    meta: {
        name: "de-morgan",
    },
    rules: {
        "no-negated-conjunction": createRule({
            operator: "&&",
            kind: "conjunction",
            messageId: "convertNegatedConjunction",
        }),
        "no-negated-disjunction": createRule({
            operator: "||",
            kind: "disjunction",
            messageId: "convertNegatedDisjunction",
        }),
    },
};
