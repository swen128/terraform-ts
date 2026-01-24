export function keysToSnakeCase(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    const snakeKey = camelToSnakeCase(key);
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      result[snakeKey] = keysToSnakeCase(value as Record<string, unknown>);
    } else {
      result[snakeKey] = value;
    }
  }
  return result;
}

export function camelToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

export function snakeToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  source: Record<string, unknown>,
): T {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (
      value !== null &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      key in result &&
      typeof result[key] === "object" &&
      result[key] !== null
    ) {
      result[key as keyof T] = deepMerge(
        result[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      ) as T[keyof T];
    } else {
      result[key as keyof T] = value as T[keyof T];
    }
  }
  return result;
}
