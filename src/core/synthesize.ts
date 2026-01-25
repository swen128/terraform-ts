import { createHash } from "node:crypto";

export function generateLogicalId(path: readonly string[]): string {
  if (path.length === 0) {
    return "";
  }

  if (path.length === 1) {
    return sanitizeLogicalId(path[0] ?? "");
  }

  const stackIndex = 1;
  const components = path.slice(stackIndex + 1);

  if (components.length === 0) {
    return sanitizeLogicalId(path[stackIndex] ?? "");
  }

  return makeUniqueId(components);
}

function sanitizeLogicalId(id: string): string {
  return id.replace(/[^A-Za-z0-9_-]/g, "");
}

const HIDDEN_ID = "Default";
const HIDDEN_FROM_HUMAN_ID = "Resource";
const HASH_LEN = 8;
const MAX_HUMAN_LEN = 240;
const MAX_ID_LEN = 255;

function makeUniqueId(components: readonly string[]): string {
  const filtered = components.filter((x) => x !== HIDDEN_ID);
  if (filtered.length === 0) return "";

  if (filtered.length === 1) {
    const candidate = sanitizeLogicalId(filtered[0] ?? "");
    if (candidate.length <= MAX_ID_LEN) return candidate;
  }

  const hash = md5Hash(filtered.join("/")).slice(0, HASH_LEN).toUpperCase();

  const deduped: string[] = [];
  for (const c of filtered) {
    const lastItem = deduped[deduped.length - 1];
    if (deduped.length === 0 || lastItem === undefined || !lastItem.endsWith(c)) {
      deduped.push(c);
    }
  }

  const human = deduped
    .filter((x) => x !== HIDDEN_FROM_HUMAN_ID)
    .map(sanitizeLogicalId)
    .join("_")
    .slice(0, MAX_HUMAN_LEN);

  return `${human}_${hash}`;
}

function md5Hash(str: string): string {
  return createHash("md5").update(str).digest("hex");
}
