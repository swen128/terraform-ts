# AGENTS.md - tfts (Terraform TypeScript)

A TypeScript SDK for generating Terraform configurations using Bun runtime.

## Build/Test/Lint Commands

```bash
bun install

# Run a single test file
bun test src/core/tokens.spec.ts

# Run ALL checks (format + typecheck + test + lint + knip)
bun run check
```

## Testing

```typescript
import { describe, expect, test } from "bun:test";

describe("tokens", () => {
  describe("ref", () => {
    test("creates ref token", () => {
      const token = ref("aws_instance.main", "id");

      expect(token.kind).toBe("ref");
      expect(token.fqn).toBe("aws_instance.main");
    });
  });
});
```

- Tests use `bun:test` (NOT jest/vitest)
- File naming: `*.spec.ts`
- Throwing is allowed in test files

## Project Structure

```
src/
  core/       # Core primitives (tokens, tree, validation)
  facade/     # High-level API (TerraformResource, App, Stack, etc.)
  codegen/    # Provider binding generator
  cli/        # CLI commands (throwing allowed here)
  testing/    # Test utilities
bin/          # Entry points
e2e-tests/    # End-to-end tests
```

