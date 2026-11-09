import { z } from "zod";

/** Minimal Zod → JSON Schema conversion for tool parameters (objects of primitives, arrays, enums, optionals). */
export function zodToJsonSchema(schema: z.ZodTypeAny): Record<string, unknown> {
  const def = schema._def as { typeName: string; description?: string };
  const withDesc = (s: Record<string, unknown>) => (def.description ? { ...s, description: def.description } : s);
  switch (def.typeName) {
    case "ZodObject": {
      const shape = (schema as z.ZodObject<z.ZodRawShape>).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape)) {
        properties[key] = zodToJsonSchema(value);
        if (!value.isOptional()) required.push(key);
      }
      return withDesc({ type: "object", properties, required, additionalProperties: false });
    }
    case "ZodString":
      return withDesc({ type: "string" });
    case "ZodNumber":
      return withDesc({ type: "number" });
    case "ZodBoolean":
      return withDesc({ type: "boolean" });
    case "ZodArray":
      return withDesc({ type: "array", items: zodToJsonSchema((schema as z.ZodArray<z.ZodTypeAny>).element) });
    case "ZodEnum":
      return withDesc({ type: "string", enum: (schema as z.ZodEnum<[string, ...string[]]>).options });
    case "ZodOptional":
    case "ZodDefault":
      return withDesc(zodToJsonSchema((def as unknown as { innerType: z.ZodTypeAny }).innerType));
    default:
      return withDesc({});
  }
}
