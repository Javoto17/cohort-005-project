import { afterEach, describe, expect, it, vi } from "vitest";
import { claudeAgent } from "./common";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("factory agent", () => {
  it("requires the Go secret even when an OpenAI key is present", () => {
    vi.stubEnv("OPENCODE_API_KEY", "");
    vi.stubEnv("OPENAI_API_KEY", "unused-openai-test-key");
    vi.spyOn(console, "error").mockImplementation(() => {});
    const exit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("Missing secret");
    });

    expect(() => claudeAgent()).toThrow("Missing secret");
    expect(exit).toHaveBeenCalledWith(1);
    expect(console.error).toHaveBeenCalledWith(
      "Missing required env var: OPENCODE_API_KEY"
    );
  });

  it("uses Luna through Go without putting the key in argv", () => {
    vi.stubEnv("OPENCODE_API_KEY", "test-only-key");
    const agent = claudeAgent();
    const { command } = agent.buildPrintCommand({
      prompt: "Read the ticket",
      dangerouslySkipPermissions: true,
    });

    expect(agent.name).toBe("opencode");
    expect(agent.env).toEqual({ OPENCODE_API_KEY: "test-only-key" });
    expect(command).toContain("opencode run --standalone --format json");
    expect(command).toContain("opencode-go/gpt-6-luna");
    expect(command).toContain("--dangerously-skip-permissions");
    expect(command).not.toContain("test-only-key");
  });

  it("retains session storage and standalone mode for extraction", () => {
    vi.stubEnv("OPENCODE_API_KEY", "test-only-key");
    const agent = claudeAgent();
    const { command } = agent.buildPrintCommand({
      prompt: "Emit the validated plan",
      dangerouslySkipPermissions: false,
      resumeSession: "session-for-extraction",
    });

    expect(agent.sessionStorage).toBeDefined();
    expect(command).toContain("--standalone");
    expect(command).toContain("--session 'session-for-extraction'");
    expect(command).not.toContain("--dangerously-skip-permissions");
    expect(
      agent.parseStreamLine(
        JSON.stringify({
          type: "step_start",
          sessionID: "session-for-extraction",
        })
      )
    ).toEqual([{ type: "session_id", sessionId: "session-for-extraction" }]);
    expect(
      agent.parseStreamLine(
        JSON.stringify({
          type: "text",
          part: { type: "text", text: '<plan>{"issues":[]}</plan>' },
        })
      )
    ).toContainEqual({
      type: "result",
      result: '<plan>{"issues":[]}</plan>',
    });
  });
});
