import { z } from "zod";
import { experimental_PaidMcpAgent as PaidMcpAgent } from "@stripe/agent-toolkit/cloudflare";
import { JscadRecipeSchema, buildGeometryFromRecipe } from "../jscad/recipe";
import { exportGeometryToFile } from "../jscad/export";

export function jscadTool(
  agent: PaidMcpAgent<Env, any, any>,
  env?: { OAUTH_KV: KVNamespace }
) {
  const server = agent.server;
  const kv = env?.OAUTH_KV;

  // @ts-ignore
  server.tool(
    "jscad_export",
    "Build a 3D model from a safe JSON 'shape recipe' and export it (STL/OBJ). Returns base64 file contents plus metadata.",
    {
      recipe: JscadRecipeSchema,
      format: z.enum(["stl", "obj"]).default("stl"),
    },
    async ({
      recipe,
      format,
    }: {
      recipe: z.infer<typeof JscadRecipeSchema>;
      format: "stl" | "obj";
    }) => {
      const { geometry, boundingBox, nodeCount } =
        buildGeometryFromRecipe(recipe);
      const file = exportGeometryToFile(geometry, format, recipe.name);
      const base64 = Buffer.from(file.bytes).toString("base64");

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(
              {
                ok: true,
                format,
                filename: file.filename,
                mime: file.mime,
                bytesBase64: base64,
                stats: { nodeCount, boundingBox },
              },
              null,
              2
            ),
          },
        ],
      };
    }
  );

  // Persist recipes per authenticated user (MVP)
  // @ts-ignore
  server.tool(
    "jscad_save_recipe",
    "Save a shape recipe for the current user. Returns an id that can be loaded later.",
    {
      recipe: JscadRecipeSchema,
    },
    async ({ recipe }: { recipe: z.infer<typeof JscadRecipeSchema> }) => {
      if (!kv) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  error:
                    "Server KV is not configured for persistence (missing OAUTH_KV binding).",
                },
                null,
                2
              ),
            },
          ],
        };
      }
      const userEmail = agent.props?.userEmail || agent.props?.email;
      if (!userEmail) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  error:
                    "No user identity available. Log in via OAuth so the agent has props.userEmail.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const now = new Date().toISOString();

      const itemKey = `jscad:recipe:${userEmail}:${id}`;
      const indexKey = `jscad:index:${userEmail}`;

      const entry = { id, name: recipe.name || "model", savedAt: now };

      const existingIndexRaw = await kv.get(indexKey);
      const existingIndex: Array<{
        id: string;
        name: string;
        savedAt: string;
      }> = existingIndexRaw ? JSON.parse(existingIndexRaw) : [];

      const nextIndex = [entry, ...existingIndex].slice(0, 25);

      await kv.put(
        itemKey,
        JSON.stringify({ id, savedAt: now, recipe }),
        { expirationTtl: 60 * 60 * 24 * 30 } // 30 days
      );
      await kv.put(indexKey, JSON.stringify(nextIndex), {
        expirationTtl: 60 * 60 * 24 * 30,
      });

      return {
        content: [
          { type: "text", text: JSON.stringify({ ok: true, id, entry }, null, 2) },
        ],
      };
    }
  );

  // @ts-ignore
  server.tool(
    "jscad_list_recipes",
    "List saved recipes for the current user.",
    {},
    async () => {
      if (!kv) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  error:
                    "Server KV is not configured for persistence (missing OAUTH_KV binding).",
                },
                null,
                2
              ),
            },
          ],
        };
      }
      const userEmail = agent.props?.userEmail || agent.props?.email;
      if (!userEmail) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  error:
                    "No user identity available. Log in via OAuth so the agent has props.userEmail.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const indexKey = `jscad:index:${userEmail}`;
      const existingIndexRaw = await kv.get(indexKey);
      const entries = existingIndexRaw ? JSON.parse(existingIndexRaw) : [];
      return {
        content: [
          { type: "text", text: JSON.stringify({ ok: true, entries }, null, 2) },
        ],
      };
    }
  );

  // @ts-ignore
  server.tool(
    "jscad_load_recipe",
    "Load a previously saved recipe by id for the current user.",
    { id: z.string().min(1) },
    async ({ id }: { id: string }) => {
      if (!kv) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  error:
                    "Server KV is not configured for persistence (missing OAUTH_KV binding).",
                },
                null,
                2
              ),
            },
          ],
        };
      }
      const userEmail = agent.props?.userEmail || agent.props?.email;
      if (!userEmail) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  ok: false,
                  error:
                    "No user identity available. Log in via OAuth so the agent has props.userEmail.",
                },
                null,
                2
              ),
            },
          ],
        };
      }

      const itemKey = `jscad:recipe:${userEmail}:${id}`;
      const value = await kv.get(itemKey);
      if (!value) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: false, error: "Not found" }, null, 2),
            },
          ],
        };
      }

      return {
        content: [{ type: "text", text: JSON.stringify({ ok: true, ...JSON.parse(value) }, null, 2) }],
      };
    }
  );
}

