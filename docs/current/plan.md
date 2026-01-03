# tfts Implementation Plan

## Overview

This plan prioritizes types first, then identifies work that can be delegated to multiple agents running in parallel.

**Agent Strategy:**
- Sequential phases must complete before the next phase starts
- Within a phase, multiple agents can work on independent streams simultaneously
- Each agent receives a specific task and works autonomously

---

## Phase 0: Project Setup (Single Agent) ✅ COMPLETED

Set up tooling and configuration before writing any code.

**Agent Assignment:** 1 agent configures the project.

### 0.1 Package Configuration (`package.json`)

```
[x] name, version, type: "module"
[x] bin entry for CLI
[x] scripts: typecheck, lint, format, format:check, knip, check, test
[x] devDependencies: typescript, @biomejs/biome, eslint, knip, bun-types
[x] dependencies: neverthrow
```

### 0.2 TypeScript Configuration (`tsconfig.json`)

```
[x] ESNext target and module
[x] Strict mode enabled
[x] Bun types
[x] Output to dist/
[x] Declaration and source maps
[x] noUnusedLocals, noUnusedParameters enabled
```

### 0.3 Biome Configuration (`biome.json`)

```
[x] Formatter enabled, linter disabled
[x] 100-char line width, 2-space indent, LF line endings
[x] Double quotes, trailing commas, semicolons
```

### 0.4 ESLint Configuration (`eslint.config.js`)

```
[x] TypeScript parser with project reference
[x] No any types, no type assertions
[x] No throw statements (use Result types)
[x] Exhaustive switch checks
[x] No console (except CLI)
[x] Strict boolean expressions
[x] Explicit function return types
```

### 0.5 Knip Configuration (`knip.json`)

```
[x] Entry point: bin/tfts.ts
[x] Project: src/**/*.ts
[x] Ignore test files
```

### 0.6 Other Files

```
[x] .gitignore (node_modules, dist, .env, etc.)
[x] bunfig.toml (test root)
```

---

## Phase 1: Core Types (Single Agent) ✅ COMPLETED

All type definitions must be completed first as they are dependencies for everything else.

**Agent Assignment:** 1 agent writes all types in a single pass.

### 1.1 Core Data Types (organized by feature)

```
[x] src/core/construct.ts - ConstructNode, ConstructMetadata
[x] src/core/resource.ts - ResourceDef, LifecycleDef, ConditionDef, ProvisionerDef
[x] src/core/provider.ts - ProviderDef
[x] src/core/datasource.ts - DataSourceDef
[x] src/core/variable.ts - VariableDef, ValidationDef
[x] src/core/output.ts - OutputDef
[x] src/core/backend.ts - BackendDef
[x] src/core/local.ts - LocalDef
```

### 1.2 Token Types (`src/core/tokens.ts`)

```
[x] Token (abstract class with RefToken, FnToken, RawToken subclasses)
[x] TerraformValue (union type for Terraform values)
[x] TokenResolver
```

### 1.3 Terraform JSON Types (`src/core/terraform-json.ts`)

```
[x] TerraformJson
[x] TerraformBlock
[x] RequiredProvider
[x] VariableBlock
[x] OutputBlock
```

### 1.4 Error Types (`src/core/errors.ts`)

```
[x] TftsError (discriminated union)
[x] ValidationError
[x] ValidationErrorCode
```

### 1.5 Config Types (`src/cli/config.ts`)

```
[x] CdktfConfig
[x] ProviderConstraint
[x] ModuleConstraint
```

### 1.6 Schema Types (`src/codegen/schema.ts`)

```
[x] ProviderSchema
[x] ProviderSchemaEntry
[x] ResourceSchema
[x] SchemaBlock
[x] AttributeSchema
[x] BlockTypeSchema
[x] SchemaType
```

---

## Phase 2: Core Functions (3 Agents in Parallel) ✅ COMPLETED

After types are done, spawn 3 agents simultaneously:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Agent A       │  │   Agent B       │  │   Agent C       │
│   Tree Ops      │  │   Tokens        │  │   Validation    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Wait for all 3 agents to complete before Phase 3.**

### Agent A: Tree Operations (`src/core/tree.ts`) ✅

```
[x] addChild(tree, parentPath, child) → ConstructNode
[x] findNode(tree, path) → ConstructNode | undefined
[x] walkTree(tree, visitor) → T[]
[x] getChildren(node, kind) → ConstructNode[]
```

### Agent B: Token System (`src/core/tokens.ts`) ✅

**Design Change:** Token is now a class hierarchy for `instanceof` checks.

```
[x] Token (abstract class)
[x] RefToken, FnToken, RawToken (concrete classes)
[x] ref(fqn, attribute) → RefToken
[x] fn(name, ...args) → FnToken
[x] raw(expression) → RawToken
[x] tokenToHcl(token) → string (renamed from tokenToString)
[x] containsTokens(value) → boolean
[x] resolveTokens(value, resolver) → TerraformValue
```

### Agent C: Validation (`src/core/validate.ts`) ✅

**Design Change:** Removed field validation (enforced at construction). Graph-only validation.

```
[x] validateTree(tree) → ValidationError[] (duplicate IDs + circular deps)
[x] detectCircularDependencies(tree) → string[][] | null
```

---

## Phase 3: Synthesis (Single Agent) ✅ COMPLETED

Depends on: Phase 2 (all agents must complete first).

**Agent Assignment:** 1 agent implements all synthesis functions.

### 3.1 ID Generation (`src/core/synthesize.ts`)

```
[x] generateLogicalId(path) → string (with CDKTF-compatible hashing)
[x] generateFqn(resourceType, logicalId) → string
```

### 3.2 Element Synthesis (`src/core/synthesize.ts`)

```
[x] synthesizeResource(node, resource) → ResourceSynthResult
[x] synthesizeProvider(provider) → ProviderSynthResult
[x] synthesizeDataSource(node, datasource) → DataSourceSynthResult
[x] synthesizeVariable(node, variable) → { id, block }
[x] synthesizeOutput(node, output) → { id, block }
[x] synthesizeBackend(backend) → Record<string, Record<string, unknown>>
[x] synthesizeLocal(node, local) → { id, value }
```

### 3.3 Stack Synthesis (`src/core/synthesize.ts`)

```
[x] synthesizeStack(stack) → TerraformJson
[x] collectProviders(stack) → ProviderNode[]
[x] collectResources(stack) → ResourceNode[]
[x] collectDataSources, collectVariables, collectOutputs, collectLocals, collectBackends
[x] buildRequiredProviders(providers) → Record<string, RequiredProvider>
```

---

## Phase 4: Facade Layer (4 Agents in Parallel)

Depends on: Phase 3 must complete first.

Spawn 4 agents simultaneously:

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Agent D     │ │  Agent E     │ │  Agent F     │ │  Agent G     │
│  Construct   │ │  Resources   │ │  Variables   │ │  Backends    │
│  App, Stack  │ │  Provider    │ │  Output      │ │              │
│              │ │  DataSource  │ │  Local       │ │              │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Wait for all 4 agents to complete before Phase 5.**

### Agent D: Base Constructs

```
[x] src/facade/construct.ts
    [x] Construct base class
    [x] node property
    [x] path getter

[x] src/facade/app.ts
    [x] App class
    [x] AppOptions interface
    [x] synth() method
    [x] static of(construct) method

[x] src/facade/stack.ts
    [x] TerraformStack class
    [x] addDependency(stack)
    [x] toTerraform()
```

### Agent E: Resources & Providers

```
[x] src/facade/resource.ts
    [x] TerraformResource class
    [x] Meta-argument properties (dependsOn, count, forEach, provider, lifecycle)
    [x] addOverride(path, value)
    [x] interpolationForAttribute(attribute)
    [x] synthesizeAttributes() abstract

[x] src/facade/provider.ts
    [x] TerraformProvider class
    [x] terraformProviderSource property
    [x] alias property

[x] src/facade/datasource.ts
    [x] TerraformDataSource class
    [x] interpolationForAttribute(attribute)
    [x] synthesizeAttributes() abstract
```

### Agent F: Variables, Outputs, Locals

```
[x] src/facade/variable.ts
    [x] TerraformVariable class
    [x] TerraformVariableConfig interface
    [x] value, stringValue, numberValue, booleanValue, listValue getters

[x] src/facade/output.ts
    [x] TerraformOutput class
    [x] TerraformOutputConfig interface

[x] src/facade/local.ts
    [x] TerraformLocal class
    [x] expression getter
```

### Agent G: Backends

```
[x] src/facade/backends/backend.ts
    [x] TerraformBackend abstract class

[x] src/facade/backends/local.ts
    [x] LocalBackend class
    [x] LocalBackendConfig interface

[x] src/facade/backends/s3.ts
    [x] S3Backend class
    [x] S3BackendConfig interface

[x] src/facade/backends/gcs.ts
    [x] GcsBackend class
    [x] GcsBackendConfig interface

[x] src/facade/backends/remote.ts
    [x] RemoteBackend class
    [x] RemoteBackendConfig interface
```

---

## Phase 5: CLI & Codegen (2 Agents in Parallel)

Depends on: Phase 4 (all agents must complete first).

Spawn 2 agents simultaneously:

```
┌─────────────────────────┐  ┌─────────────────────────┐
│       Agent H           │  │       Agent I           │
│       CLI               │  │       Codegen           │
└─────────────────────────┘  └─────────────────────────┘
```

**Wait for both agents to complete before Phase 6.**

### Agent H: CLI

```
[ ] src/cli/config.ts
    [ ] readConfig(path) → CdktfConfig
    [ ] parseProviderConstraint(spec) → ProviderConstraint
    [ ] validateConfig(config) → ValidationError[]

[ ] src/cli/synth.ts
    [ ] runSynth(options) → void
    [ ] executeApp(command) → void
    [ ] writeOutput(json, outdir) → void
    [ ] writeManifest(stacks, outdir) → void

[ ] src/cli/index.ts
    [ ] CLI entry point
    [ ] Command parsing (synth, get)
    [ ] --help, --version handling

[ ] bin/tfts.ts
    [ ] Shebang entry point
```

### Agent I: Code Generation

```
[ ] src/codegen/schema.ts
    [ ] fetchProviderSchema(provider, version) → ProviderSchema
    [ ] parseSchemaType(type) → TypeScriptType
    [ ] getProviderUrl(namespace, name, version) → string

[ ] src/codegen/generator.ts
    [ ] generateProvider(schema) → string
    [ ] generateResource(name, schema) → string
    [ ] generateDataSource(name, schema) → string
    [ ] generateConfig(name, schema) → string
    [ ] generateIndex(resources, dataSources) → string

[ ] src/codegen/templates.ts
    [ ] resourceTemplate
    [ ] providerTemplate
    [ ] dataSourceTemplate
    [ ] configInterfaceTemplate

[ ] src/cli/get.ts
    [ ] runGet(options) → void
    [ ] generateBindings(providers, outdir) → void
```

---

## Phase 6: Integration & Polish (Single Agent)

Depends on: Phase 5 (both agents must complete first).

**Agent Assignment:** 1 agent handles final integration.

```
[ ] src/index.ts - Public API exports
[ ] Integration tests
[ ] End-to-end tests with Google Cloud provider
[ ] Error message improvements
[ ] package.json setup (bin, exports)
```

---

## Dependency Graph

```
Phase 0: Project Setup (1 agent) ✅
    │
    ▼
Phase 1: Types (1 agent) ✅
    │
    ▼
Phase 2: Core Functions (3 agents in parallel) ✅
    ├── Agent A: Tree Ops ─────────┐
    ├── Agent B: Tokens ───────────┼──► wait for all
    └── Agent C: Validation ───────┘
                                   │
                                   ▼
                    Phase 3: Synthesis (1 agent) ✅
                                   │
                                   ▼
                    Phase 4: Facade (4 agents in parallel)
    ┌── Agent D: Construct/App/Stack ──┐
    ├── Agent E: Resource/Provider ────┼──► wait for all
    ├── Agent F: Variable/Output ──────┤
    └── Agent G: Backends ─────────────┘
                                       │
                                       ▼
                    Phase 5: CLI & Codegen (2 agents in parallel)
                    ┌── Agent H: CLI ──────────┐
                    └── Agent I: Codegen ──────┴──► wait for all
                                               │
                                               ▼
                              Phase 6: Integration (1 agent)
```

---

## Agent Summary

| Phase | Description | Agents | Parallel | Status |
|-------|-------------|--------|----------|--------|
| 0     | Project Setup | 1 | No | ✅ Done |
| 1     | Core Types | 1 | No | ✅ Done |
| 2     | Core Functions | 3 | Yes | ✅ Done |
| 3     | Synthesis | 1 | No | ✅ Done |
| 4     | Facade | 4 | Yes | 🔄 Next |
| 5     | CLI & Codegen | 2 | Yes | Pending |
| 6     | Integration | 1 | No | Pending |

**Total: 13 agent tasks, max 4 concurrent agents**

---

## Test Strategy Per Phase

| Phase | Test Type | Status |
|-------|-----------|--------|
| 1     | Type compilation only | ✅ |
| 2     | Unit tests for pure functions | ✅ (45 tests) |
| 3     | Unit tests for synthesis functions | ✅ (87 tests total) |
| 4     | Integration tests (facade → core → JSON) | Pending |
| 5     | CLI tests, codegen output tests | Pending |
| 6     | End-to-end tests | Pending |

---

## Design Decisions Made

### Logical ID Generation (CDKTF-compatible)
- Uses MD5 hash of path joined with `/` to ensure uniqueness
- Single-component paths return without hash suffix
- Multi-component paths get 8-char uppercase hex hash suffix
- Special characters removed from human-readable part but preserved in hash
- `Default` components are completely filtered
- `Resource` components are filtered from human part but included in hash

### Token as Class Hierarchy
- `Token` is an abstract class with `RefToken`, `FnToken`, `RawToken` subclasses
- Enables `instanceof Token` checks without type predicates or `in` operator
- Each subclass has `toHcl()` method

### Validation Simplified
- Removed field validation (empty strings, required fields) - enforced at construction
- Keep only graph-level validation: duplicate IDs, circular dependencies
- Trust the type system for field types

### TerraformValue Type
- Union of primitives, Token, arrays, and objects
- Used for function arguments and config values
