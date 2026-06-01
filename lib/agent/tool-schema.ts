/** Groq/Llama often emit numeric tool args as strings — relax schema for validation. */
export function relaxSchemaForGroq(
  schema: Record<string, unknown>,
): Record<string, unknown> {
  if (!schema || typeof schema !== "object") return schema;

  if (schema.type === "number") {
    const desc = typeof schema.description === "string" ? schema.description : "";
    return {
      ...schema,
      type:        "string",
      description: desc ? `${desc} (numeric value)` : "Numeric value as string or number",
    };
  }

  if (schema.type === "boolean") {
    const desc = typeof schema.description === "string" ? schema.description : "";
    return {
      ...schema,
      type:        "string",
      description: desc ? `${desc} (true or false)` : "Boolean as true or false string",
    };
  }

  if (Array.isArray(schema.enum)) {
    const allowed = schema.enum.map(String).join(" | ");
    const desc = typeof schema.description === "string" ? schema.description : "";
    const { enum: _removed, ...rest } = schema;
    return {
      ...rest,
      type:        "string",
      description: desc ? `${desc} (${allowed})` : `One of: ${allowed}`,
    };
  }

  const out: Record<string, unknown> = { ...schema };

  if (out.type === "array" && out.items && typeof out.items === "object") {
    out.items = relaxSchemaForGroq(out.items as Record<string, unknown>);
  }

  if (out.properties && typeof out.properties === "object") {
    const props: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(out.properties as Record<string, unknown>)) {
      props[key] = relaxSchemaForGroq(value as Record<string, unknown>);
    }
    out.properties = props;
  }

  // Preserve permissive schemas for Groq (nested patch objects, extra flat fields).
  if (schema.additionalProperties === true) {
    out.additionalProperties = true;
  }

  return out;
}

/** @deprecated Use relaxSchemaForGroq */
export const relaxNumericTypesForGroq = relaxSchemaForGroq;
