import * as fs from "node:fs";
import * as path from "node:path";
import * as sandcastle from "@ai-hero/sandcastle";

export const outputDir = (): string => process.env.OUTPUT_DIR ?? "/tmp";

export const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
};

export const writeJson = (filename: string, value: unknown): void => {
  fs.mkdirSync(outputDir(), { recursive: true });
  fs.writeFileSync(
    path.join(outputDir(), filename),
    JSON.stringify(value, null, 2)
  );
};

// Keep the historical export name so the five workflow consumers stay unchanged.
// The Go provider routes through the subscription endpoint, not OpenAI directly.
// Extra Usage is controlled in Console; keep it off to avoid balance overages.
export const claudeAgent = () => {
  const agent = sandcastle.opencode("opencode-go/gpt-6-luna", {
    env: {
      OPENCODE_API_KEY: required("OPENCODE_API_KEY"),
    },
  });

  return {
    ...agent,
    buildPrintCommand(options: sandcastle.AgentCommandOptions) {
      const command = agent.buildPrintCommand(options);
      // A private server inherits this step's key, including on extraction runs.
      // Do not depend on credentials inherited by an existing shared service.
      return {
        ...command,
        command: command.command.replace(
          /^opencode run /,
          "opencode run --standalone "
        ),
      };
    },
  };
};
