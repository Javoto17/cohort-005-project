import ts from "typescript";
import { createHash } from "node:crypto";
import type {
  StandardRule,
  StandardViolation,
  StandardsBaseline,
} from "./standards.types";

function isIntent(node: ts.Node) {
  return (
    (ts.isIdentifier(node) && node.text === "intent") ||
    (ts.isPropertyAccessExpression(node) && node.name.text === "intent") ||
    (ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "get" &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0]) &&
      node.arguments[0].text === "intent")
  );
}

function containsJsx(node: ts.Node): boolean {
  if (
    ts.isJsxElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxFragment(node)
  ) {
    return true;
  }
  return ts.forEachChild(node, containsJsx) ?? false;
}

function isComponentInitializer(node: ts.Node): boolean {
  if (ts.isArrowFunction(node) || ts.isFunctionExpression(node))
    return containsJsx(node);
  if (ts.isParenthesizedExpression(node))
    return isComponentInitializer(node.expression);
  if (ts.isCallExpression(node))
    return node.arguments.some(isComponentInitializer);
  return false;
}

function fingerprint(node: ts.Node, source: ts.SourceFile) {
  const scanner = ts.createScanner(
    ts.ScriptTarget.Latest,
    true,
    ts.LanguageVariant.Standard,
    node.getText(source)
  );
  const tokens: string[] = [];
  while (scanner.scan() !== ts.SyntaxKind.EndOfFileToken) {
    tokens.push(scanner.getTokenText());
  }
  return createHash("sha256")
    .update(tokens.join("\n"))
    .digest("hex")
    .slice(0, 16);
}

export function checkSource(file: string, text: string): StandardViolation[] {
  const source = ts.createSourceFile(
    file,
    text,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const violations: StandardViolation[] = [];
  function report(node: ts.Node, rule: StandardRule, message: string) {
    violations.push({
      file,
      line:
        source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
      rule,
      fingerprint: fingerprint(node, source),
      message,
    });
  }
  function visit(node: ts.Node) {
    if (
      (ts.isFunctionDeclaration(node) || ts.isClassDeclaration(node)) &&
      node.parent !== source &&
      node.name &&
      /^[A-Z]/.test(node.name.text) &&
      containsJsx(node)
    ) {
      report(
        node.name,
        "one-component-per-file",
        "Move this nested component to its own feature file."
      );
    }
    if (
      ts.isVariableDeclaration(node) &&
      node.parent.parent.parent !== source &&
      ts.isIdentifier(node.name) &&
      /^[A-Z]/.test(node.name.text) &&
      node.initializer &&
      isComponentInitializer(node.initializer)
    ) {
      report(
        node.name,
        "one-component-per-file",
        "Move this nested component to its own feature file."
      );
    }
    if (
      !/\.types\.tsx?$/.test(file) &&
      (ts.isTypeLiteralNode(node) || ts.isInterfaceDeclaration(node))
    ) {
      report(
        node,
        "inline-object-type",
        "Declare object types in the feature's *.types.ts file."
      );
    }
    if (ts.isSwitchStatement(node) && isIntent(node.expression)) {
      for (const clause of node.caseBlock.clauses) {
        if (
          ts.isCaseClause(clause) &&
          ts.isStringLiteralLike(clause.expression)
        ) {
          report(
            clause.expression,
            "intent-literal",
            "Use a shared intent constant in switch cases."
          );
        }
      }
    }
    if (
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === "intent" &&
      ts.isCallExpression(node.initializer) &&
      ts.isPropertyAccessExpression(node.initializer.expression) &&
      node.initializer.expression.name.text === "literal" &&
      node.initializer.arguments[0] &&
      ts.isStringLiteralLike(node.initializer.arguments[0])
    ) {
      report(
        node.initializer,
        "intent-literal",
        "Use a shared intent constant in schema literals."
      );
    }
    if (
      ts.isBinaryExpression(node) &&
      [
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
      ].includes(node.operatorToken.kind)
    ) {
      if (
        (isIntent(node.left) && ts.isStringLiteralLike(node.right)) ||
        (isIntent(node.right) && ts.isStringLiteralLike(node.left))
      ) {
        report(
          node,
          "intent-literal",
          "Use a shared intent constant in the action and form."
        );
      }
    }
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(source) === "value" &&
      node.initializer &&
      (ts.isStringLiteral(node.initializer) ||
        (ts.isJsxExpression(node.initializer) &&
          node.initializer.expression &&
          ts.isStringLiteralLike(node.initializer.expression)))
    ) {
      const attributes = node.parent.properties;
      if (
        attributes.some(
          (attribute) =>
            ts.isJsxAttribute(attribute) &&
            attribute.name.getText(source) === "name" &&
            attribute.initializer &&
            ts.isStringLiteral(attribute.initializer) &&
            attribute.initializer.text === "intent"
        )
      ) {
        report(
          node,
          "intent-literal",
          "Use the same shared intent constant as the action."
        );
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  let componentFound = false;
  const isRoute = file.startsWith("app/routes/") || file === "app/root.tsx";
  const componentLocation = /^app\/(?:features\/[^/]+\/|components\/)/.test(
    file
  );
  for (const statement of source.statements) {
    if (
      ts.isExportAssignment(statement) &&
      !statement.isExportEquals &&
      isComponentInitializer(statement.expression)
    ) {
      if (componentFound && !isRoute) {
        report(
          statement.expression,
          "one-component-per-file",
          "Move this component to its own file in the feature module."
        );
      }
      if (!isRoute && !componentLocation) {
        report(
          statement.expression,
          "component-location",
          "Keep feature components in app/features/<feature>/ and shared components in app/components/."
        );
      }
      componentFound = true;
      continue;
    }
    const candidates = ts.isVariableStatement(statement)
      ? statement.declarationList.declarations
      : [statement];
    for (const candidate of candidates) {
      if (
        !ts.isFunctionDeclaration(candidate) &&
        !ts.isVariableDeclaration(candidate) &&
        !ts.isClassDeclaration(candidate)
      )
        continue;
      const name = candidate.name?.getText(source) ?? "DefaultComponent";
      if (!/^[A-Z]/.test(name) || !containsJsx(candidate)) continue;
      if (
        ts.isVariableDeclaration(candidate) &&
        (!candidate.initializer ||
          !isComponentInitializer(candidate.initializer))
      )
        continue;
      const declaration = ts.isVariableDeclaration(candidate)
        ? candidate.parent.parent
        : candidate;
      const modifiers = ts.canHaveModifiers(declaration)
        ? ts.getModifiers(declaration)
        : undefined;
      const exported = modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      );
      if (
        isRoute &&
        exported &&
        ["ErrorBoundary", "HydrateFallback", "Layout"].includes(name)
      )
        continue;
      const defaultExport =
        modifiers?.some(
          (modifier) => modifier.kind === ts.SyntaxKind.DefaultKeyword
        ) ||
        source.statements.some(
          (statement) =>
            ts.isExportAssignment(statement) &&
            !statement.isExportEquals &&
            ts.isIdentifier(statement.expression) &&
            statement.expression.text === name
        );
      if (isRoute && !defaultExport) {
        report(
          candidate.name ?? candidate,
          "one-component-per-file",
          "Move this feature component out of the route and into its own feature file."
        );
      } else if (!isRoute && componentFound) {
        // Anchor to the name, not the body: existing exceptions cannot hide a
        // newly introduced component, but editing an old component is allowed.
        report(
          candidate.name ?? candidate,
          "one-component-per-file",
          "Move this component to its own file in the feature module."
        );
      }
      if (!isRoute && !componentLocation) {
        report(
          candidate.name ?? candidate,
          "component-location",
          "Keep feature components in app/features/<feature>/ and shared components in app/components/."
        );
      }
      componentFound = true;
    }
  }
  return violations;
}

export function violationKey(violation: StandardViolation) {
  return `${violation.file}|${violation.rule}|${violation.fingerprint}`;
}

export function findNewViolations(
  violations: StandardViolation[],
  baseline: StandardsBaseline
): StandardViolation[] {
  const remaining = { ...baseline };
  return violations.filter((violation) => {
    const key = violationKey(violation);
    if (remaining[key] > 0) {
      remaining[key]--;
      return false;
    }
    return true;
  });
}
