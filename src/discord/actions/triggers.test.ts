import { SlashCommandBuilder } from "discord.js";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";
import type { Action } from "../../actions/context.js";
import { createActionRegistry } from "../../actions/registry.js";
import { getDiscordTrigger, getDiscordTriggers } from "./triggers.js";

describe("Discord action triggers", () => {
  it("projects Discord triggers from the action registry", () => {
    const registry = createActionRegistry();
    const action: Action = {
      name: "test_action",
      description: "Test action.",
      inputSchema: Schema.Struct({}),
      triggers: [
        {
          kind: "slash_command",
          name: "test",
          description: "/test",
          usage: "/test",
          data: new SlashCommandBuilder()
            .setName("test")
            .setDescription("/test"),
          parse: () => ({}),
        },
      ],
      availability: () => ({ available: true }),
      execute: async () => ({ kind: "handled" }),
    };

    registry.registerAction(action);

    expect(
      getDiscordTriggers(registry).map(({ trigger }) => trigger.name),
    ).toEqual(["test"]);
    expect(getDiscordTrigger(registry, "test")?.action).toBe(action);
  });

  it("rejects duplicate Discord trigger names", () => {
    const registry = createActionRegistry();
    registry.registerAction(actionWithSlash("first", "same"));
    registry.registerAction(actionWithSlash("second", "same"));

    expect(() => getDiscordTriggers(registry)).toThrow(
      /Duplicate Discord trigger name/,
    );
  });
});

function actionWithSlash(actionName: string, triggerName: string): Action {
  return {
    name: actionName,
    description: "Test action.",
    inputSchema: Schema.Struct({}),
    triggers: [
      {
        kind: "slash_command",
        name: triggerName,
        description: `/${triggerName}`,
        usage: `/${triggerName}`,
        data: new SlashCommandBuilder()
          .setName(triggerName)
          .setDescription(`/${triggerName}`),
        parse: () => ({}),
      },
    ],
    availability: () => ({ available: true }),
    execute: async () => ({ kind: "handled" }),
  };
}
