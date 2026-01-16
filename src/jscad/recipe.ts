import { z } from "zod";
import { booleans, measurements, primitives, transforms } from "@jscad/modeling";

const Vec3 = z.tuple([z.number(), z.number(), z.number()]);

const CuboidNode = z.object({
  type: z.literal("cuboid"),
  size: Vec3,
  center: Vec3.optional(),
});

const SphereNode = z.object({
  type: z.literal("sphere"),
  radius: z.number().positive(),
  center: Vec3.optional(),
  segments: z.number().int().positive().optional(),
});

const CylinderNode = z.object({
  type: z.literal("cylinder"),
  height: z.number().positive(),
  radius: z.number().positive(),
  center: Vec3.optional(),
  segments: z.number().int().positive().optional(),
});

type RecipeNode =
  | z.infer<typeof CuboidNode>
  | z.infer<typeof SphereNode>
  | z.infer<typeof CylinderNode>
  | {
      type: "union" | "subtract" | "intersect";
      children: RecipeNode[];
    }
  | { type: "translate"; offset: [number, number, number]; child: RecipeNode }
  | { type: "rotate"; angles: [number, number, number]; child: RecipeNode } // degrees
  | { type: "scale"; factors: [number, number, number]; child: RecipeNode };

const RecipeNodeSchema: z.ZodType<RecipeNode> = z.lazy(() =>
  z.discriminatedUnion("type", [
    CuboidNode,
    SphereNode,
    CylinderNode,
    z.object({
      type: z.enum(["union", "subtract", "intersect"]),
      children: z.array(RecipeNodeSchema).min(1),
    }),
    z.object({
      type: z.literal("translate"),
      offset: Vec3,
      child: RecipeNodeSchema,
    }),
    z.object({
      type: z.literal("rotate"),
      angles: Vec3,
      child: RecipeNodeSchema,
    }),
    z.object({
      type: z.literal("scale"),
      factors: Vec3,
      child: RecipeNodeSchema,
    }),
  ])
);

export const JscadRecipeSchema = z.object({
  version: z.literal(1),
  units: z.enum(["mm", "cm", "m"]).default("mm"),
  name: z.string().optional(),
  root: RecipeNodeSchema,
});

export type JscadRecipe = z.infer<typeof JscadRecipeSchema>;

export type BoundingBox = [[number, number, number], [number, number, number]];

const DEG_TO_RAD = Math.PI / 180;

function countNodes(node: RecipeNode): number {
  switch (node.type) {
    case "cuboid":
    case "sphere":
    case "cylinder":
      return 1;
    case "translate":
    case "rotate":
    case "scale":
      return 1 + countNodes(node.child);
    case "union":
    case "subtract":
    case "intersect":
      return 1 + node.children.reduce((sum, c) => sum + countNodes(c), 0);
    default: {
      // Exhaustive check
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _never: never = node;
      return 0;
    }
  }
}

export function buildGeometryFromRecipe(recipe: JscadRecipe): {
  geometry: any;
  boundingBox: BoundingBox;
  nodeCount: number;
} {
  const nodeCount = countNodes(recipe.root);
  if (nodeCount > 500) {
    throw new Error(
      `Recipe too complex: ${nodeCount} nodes (max 500 for MVP)`
    );
  }

  const geometry = buildNode(recipe.root);
  const boundingBox = measurements.measureBoundingBox(geometry) as BoundingBox;
  return { geometry, boundingBox, nodeCount };
}

function buildNode(node: RecipeNode): any {
  switch (node.type) {
    case "cuboid":
      return primitives.cuboid({
        size: node.size,
        center: node.center,
      });
    case "sphere":
      return primitives.sphere({
        radius: node.radius,
        center: node.center,
        segments: node.segments,
      });
    case "cylinder":
      return primitives.cylinder({
        height: node.height,
        radius: node.radius,
        center: node.center,
        segments: node.segments,
      });
    case "translate":
      return transforms.translate(node.offset, buildNode(node.child));
    case "rotate":
      return transforms.rotate(
        [
          node.angles[0] * DEG_TO_RAD,
          node.angles[1] * DEG_TO_RAD,
          node.angles[2] * DEG_TO_RAD,
        ],
        buildNode(node.child)
      );
    case "scale":
      return transforms.scale(node.factors, buildNode(node.child));
    case "union":
      return booleans.union(node.children.map(buildNode));
    case "subtract": {
      const [first, ...rest] = node.children.map(buildNode);
      return booleans.subtract(first, ...rest);
    }
    case "intersect":
      return booleans.intersect(node.children.map(buildNode));
    default: {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _never: never = node;
      throw new Error(`Unsupported node type`);
    }
  }
}

