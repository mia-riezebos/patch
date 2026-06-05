import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { Action } from "./context.js";
import { createActionRegistry } from "./registry.js";

const baseAction = (overrides: Partial<Action> = {}): Action => ({
  name: "test_action",
  description: "Test action.",
  inputSchema: Schema.Struct({}),
  triggers: [],
  availability: () => ({ available: true }),
  execute: async () => ({ kind: "handled" }),
  ...overrides,
});

describe("action registry", () => {
  it("registers actions", () => {
    const registry = createActionRegistry();
    const action = baseAction();

    registry.registerAction(action);

    expect(registry.getAction("test_action")).toBe(action);
    expect(registry.actions).toEqual([action]);
  });

  it("indexes tool-call triggers", () => {
    const registry = createActionRegistry();
    const action = baseAction({
      triggers: [
        {
          kind: "tool_call",
          name: "test_tool",
          description: "Run the test tool.",
          usage: '{"name":"test_tool","arguments":{}}',
          inputSchema: Schema.Struct({}),
        },
      ],
    });

    registry.registerAction(action);

    expect(registry.getToolCallTrigger("test_tool")?.action).toBe(action);
    expect(
      registry.toolCallTriggers.map(({ trigger }) => trigger.name),
    ).toEqual(["test_tool"]);
  });

  it("rejects duplicate action names", () => {
    const registry = createActionRegistry();
    registry.registerAction(baseAction());

    expect(() => registry.registerAction(baseAction())).toThrow(
      /Duplicate action name/,
    );
  });

  it("rejects duplicate tool-call trigger names", () => {
    const registry = createActionRegistry();
    registry.registerAction(
      baseAction({
        name: "first",
        triggers: [toolTrigger("shared_tool")],
      }),
    );

    expect(() =>
      registry.registerAction(
        baseAction({ name: "second", triggers: [toolTrigger("shared_tool")] }),
      ),
    ).toThrow(/Duplicate tool-call trigger name/);
  });

  it("rejects tool-call triggers on owner-only actions", () => {
    const registry = createActionRegistry();
    const action = baseAction({
      ownerOnly: true,
      triggers: [toolTrigger("admin_tool")],
    });

    expect(() => registry.registerAction(action)).toThrow(
      /Owner-only action cannot expose tool calls/,
    );
  });
});

function toolTrigger(name: string): Action["triggers"][number] {
  return {
    kind: "tool_call",
    name,
    description: "Run a tool.",
    usage: `{\"name\":\"${name}\",\"arguments\":{}}`,
    inputSchema: Schema.Struct({}),
  };
}
