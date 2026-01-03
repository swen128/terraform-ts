# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

tfts is a TypeScript-first infrastructure-as-code framework that generates Terraform JSON. It's a lightweight, type-safe alternative to CDKTF with no JSII dependency.

Key differentiator: Computed attributes return `TokenString` instead of `string`, preventing invalid operations like `.toUpperCase()` at compile time.

## Commands

```bash
bun test                    # Run all tests
bun test src/core           # Run tests in a specific directory
bun test --watch            # Run tests in watch mode

bun run build               # Compile TypeScript to dist/
bun run typecheck           # Type check without emitting
bun run lint                # Run ESLint
bun run format              # Format with Biome
bun run knip                # Find unused exports/files
bun run check               # Run all checks (format, typecheck, test, lint, knip)
```

**CLI (after build):**
```bash
bunx tfts get               # Generate provider bindings from cdktf.json
bunx tfts synth             # Synthesize Terraform JSON
bunx tfts diff              # Run terraform plan on stacks
```

## Architecture

```
src/
├── core/       # Functional, data-oriented types and pure functions
├── facade/     # User-facing OOP classes that delegate to core
├── codegen/    # Generates TypeScript from Terraform provider schemas
└── cli/        # CLI commands (synth, get)
```

### Core vs Facade Pattern

**Core layer** (`src/core/`): Purely functional with no methods on data types. Handles synthesis, validation, and tree traversal.

**Facade layer** (`src/facade/`): OOP-style classes extending `Construct` with fluent interfaces. Internally converts to core types for processing.

### Token System

The type-safe interpolation system in `src/core/tokens.ts`:

- `Token` (abstract) → `RefToken`, `FnToken`, `RawToken`
- `TokenString` - Opaque wrapper that only allows `.toString()` and `.toToken()`
- Union types for config properties:
  - `TfString = string | TokenString`
  - `TfNumber = number | TokenString`
  - `TfBoolean = boolean | TokenString`

Resources expose computed attributes as `TokenString`, ensuring compile-time safety.

### Construct Tree

- `App` (root) → `TerraformStack` (branch) → Resources/Providers/Variables (leaves)
- Each node has immutable metadata and a tree path
- Tree is validated for circular dependencies before synthesis
- `src/core/synthesize.ts` converts the tree to Terraform JSON

### Code Generation

`src/codegen/generator.ts` generates provider bindings:
1. Fetches Terraform provider schemas via `terraform providers schema -json`
2. Generates TypeScript classes for providers, resources, and data sources
3. Handles snake_case → camelCase conversion for config properties

## Code Style

ESLint enforces strict functional patterns:
- No `any` types or type assertions
- No throwing exceptions (use `neverthrow` Result types)
- Explicit return types on all functions
- No non-null assertions

Use `bun run check` before committing.
