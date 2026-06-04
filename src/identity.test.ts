import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { loadBotIdentity, renderIdentityTemplate } from "./identity.js";

describe("loadBotIdentity", () => {
  it("loads structured identity JSON and env overrides", () => {
    const dir = mkdtempSync(join(tmpdir(), "bot-identity-"));
    const identityPath = join(dir, "identity.json");
    writeFileSync(
      identityPath,
      JSON.stringify({
        name: "Quilt",
        pronouns: "they/them",
        aliases: ["quiltbot"],
        project: "Quilt",
        background: "talking blanket",
        hobbies: ["ambient pads"],
      }),
    );

    const identity = loadBotIdentity({
      BOT_IDENTITY_PATH: identityPath,
      BOT_NAME: "Needle",
      BOT_HOBBIES: "stitching,breakbeats",
    });

    expect(identity).toEqual({
      name: "Needle",
      pronouns: "they/them",
      aliases: ["quiltbot"],
      project: "Quilt",
      background: "talking blanket",
      hobbies: ["stitching", "breakbeats"],
    });
  });
});

describe("renderIdentityTemplate", () => {
  it("renders identity placeholders", () => {
    expect(
      renderIdentityTemplate("{{identity.name}} likes {{identity.hobbies}}", {
        name: "Needle",
        pronouns: "they/them",
        aliases: ["needle", "n"],
        project: "Needle",
        background: "talking pincushion",
        hobbies: ["stitching", "breakbeats"],
      }),
    ).toBe("Needle likes stitching, breakbeats");
  });
});
