export type JsonObject = { [key: string]: JsonValue };
export type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];

function processValue(value: JsonValue, transform: (key: string) => string): JsonValue {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map((v) => processValue(v, transform));
  }
  const obj: JsonObject = value;
  return transformKeys(obj, transform);
}

function transformKeys(obj: JsonObject, transform: (key: string) => string): JsonObject {
  const entries = Object.entries(obj).flatMap(([key, value]) => {
    if (value === undefined) return [];
    return [[transform(key), processValue(value, transform)] as const];
  });
  return Object.fromEntries(entries);
}

export function keysToSnakeCase(obj: JsonObject): JsonObject {
  return transformKeys(obj, camelToSnakeCase);
}

export function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter: string) => `_${letter.toLowerCase()}`);
}

export function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_match: string, letter: string) => letter.toUpperCase());
}

export function deepMerge(target: JsonObject, source: JsonObject): JsonObject {
  const result = { ...target };
  for (const [key, sourceValue] of Object.entries(source)) {
    const targetValue = result[key];
    if (
      targetValue !== undefined &&
      targetValue !== null &&
      typeof targetValue === "object" &&
      !Array.isArray(targetValue) &&
      sourceValue !== null &&
      typeof sourceValue === "object" &&
      !Array.isArray(sourceValue)
    ) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }
  return result;
}
