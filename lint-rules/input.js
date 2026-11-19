const requestValue = (node) => {
  if (!node) return false;
  if (node.type === "MemberExpression") {
    return (
      (node.object.type === "Identifier" &&
        ["params", "formData", "searchParams"].includes(node.object.name)) ||
      requestValue(node.object)
    );
  }
  if (node.type === "CallExpression") return requestValue(node.callee);
  return false;
};

export default {
  meta: { name: "input" },
  rules: {
    "no-number-coercion": {
      meta: {
        type: "problem",
        messages: {
          input: "Parse request input with a Zod schema instead of Number().",
        },
      },
      create(context) {
        return {
          CallExpression(node) {
            if (
              node.callee.type === "Identifier" &&
              node.callee.name === "Number" &&
              requestValue(node.arguments[0])
            ) {
              context.report({ node, messageId: "input" });
            }
          },
        };
      },
    },
  },
};
