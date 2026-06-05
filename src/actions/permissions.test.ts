import { PermissionsBitField } from "discord.js";
import { describe, expect, it } from "vitest";
import { canDeleteBotMessages } from "./permissions.js";

const config = { botOwnerUserIds: new Set(["owner"]) };

describe("canDeleteBotMessages", () => {
  it("allows the owner everywhere", () => {
    expect(
      canDeleteBotMessages(
        {
          userId: "owner",
          guildId: "guild",
          memberPermissions: new PermissionsBitField(),
        },
        config,
      ),
    ).toBe(true);
  });

  it("allows anyone in DMs", () => {
    expect(
      canDeleteBotMessages(
        {
          userId: "friend",
          guildId: null,
          memberPermissions: null,
        },
        config,
      ),
    ).toBe(true);
  });

  it("allows server users with Manage Messages", () => {
    expect(
      canDeleteBotMessages(
        {
          userId: "mod",
          guildId: "guild",
          memberPermissions: new PermissionsBitField([
            PermissionsBitField.Flags.ManageMessages,
          ]),
        },
        config,
      ),
    ).toBe(true);
  });

  it("rejects server users without Manage Messages", () => {
    expect(
      canDeleteBotMessages(
        {
          userId: "member",
          guildId: "guild",
          memberPermissions: new PermissionsBitField(),
        },
        config,
      ),
    ).toBe(false);
  });
});
