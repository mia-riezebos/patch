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
        interests: {
          music: {
            genres: ["ambient pads"],
            artists: ["oneohtrix point never"],
          },
          art: {
            styles: ["textile art"],
            artists: [],
          },
          media: {
            genres: ["surreal comedy"],
            actorsComedians: ["julia davis"],
          },
        },
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
      interests: {
        music: {
          genres: ["stitching", "breakbeats"],
        },
      },
      hobbies: ["stitching", "breakbeats"],
    });
  });
});

describe("renderIdentityTemplate", () => {
  it("renders identity placeholders", () => {
    expect(
      renderIdentityTemplate("{{identity.name}} likes {{identity.interests}}", {
        name: "Needle",
        pronouns: "they/them",
        aliases: ["needle", "n"],
        project: "Needle",
        background: "talking pincushion",
        interests: {
          music: {
            genres: ["breakbeats"],
            artists: ["arca"],
          },
          art: {
            styles: ["collage"],
            artists: [],
          },
          media: {
            genres: [],
            actorsComedians: ["julia davis"],
          },
        },
        hobbies: ["stitching", "breakbeats"],
      }),
    ).toBe(
      "Needle likes music genres: breakbeats; music artists: arca; art styles: collage; media actors comedians: julia davis",
    );
  });

  it("renders top-level interest arrays", () => {
    expect(
      renderIdentityTemplate("{{identity.interests}}", {
        name: "Needle",
        pronouns: "they/them",
        aliases: ["needle", "n"],
        project: "Needle",
        background: "talking pincushion",
        interests: ["breakcore", "Dropout TV", "Leonora Carrington"],
        hobbies: [],
      }),
    ).toBe("breakcore, Dropout TV, Leonora Carrington");
  });

  it("renders arbitrary nested interest groups", () => {
    expect(
      renderIdentityTemplate("{{identity.interests}}", {
        name: "Needle",
        pronouns: "they/them",
        aliases: ["needle", "n"],
        project: "Needle",
        background: "talking pincushion",
        interests: {
          auditory: {
            genres: ["future garage"],
            works: {
              albums: ["Untrue"],
              songs: ["Archangel"],
            },
          },
          literary: {
            authors: ["Leonora Carrington"],
          },
        },
        hobbies: [],
      }),
    ).toBe(
      "auditory genres: future garage; auditory works albums: Untrue; auditory works songs: Archangel; literary authors: Leonora Carrington",
    );
  });
});
