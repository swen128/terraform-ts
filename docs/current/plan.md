# tfts Implementation Plan

## Overview

This plan prioritizes types first, then identifies work that can be delegated to multiple agents running in parallel.

**Agent Strategy:**
- Sequential phases must complete before the next phase starts
- Within a phase, multiple agents can work on independent streams simultaneously
- Each agent receives a specific task and works autonomously

---

## Phase 0: Project Setup (Single Agent)

Set up tooling and configuration before writing any code.

**Agent Assignment:** 1 agent configures the project.

### 0.1 Package Configuration (`package.json`)

```
[ ] name, version, type: "module"
[ ] bin entry for CLI
[ ] scripts: typecheck, lint, format, format:check, knip, check, test
[ ] devDependencies: typescript, @biomejs/biome, eslint, knip, bun-types
[ ] dependencies: (add as needed)
```

### 0.2 TypeScript Configuration (`tsconfig.json`)

```
[ ] ESNext target and module
[ ] Strict mode enabled
[ ] Bun types
[ ] Output to dist/
[ ] Declaration and source maps
[ ] noUnusedLocals, noUnusedParameters enabled
```

### 0.3 Biome Configuration (`biome.json`)

```
[ ] Formatter enabled, linter disabled
[ ] 100-char line width, 2-space indent, LF line endings
[ ] Double quotes, trailing commas, semicolons
```

### 0.4 ESLint Configuration (`eslint.config.js`)

```
[ ] TypeScript parser with project reference
[ ] No any types, no type assertions
[ ] No throw statements (use Result types)
[ ] Exhaustive switch checks
[ ] No console (except CLI)
[ ] Strict boolean expressions
[ ] Explicit function return types
```

### 0.5 Knip Configuration (`knip.json`)

```
[ ] Entry point: bin/tfts.ts
[ ] Project: src/**/*.ts
[ ] Ignore test files
```

### 0.6 Other Files

```
[ ] .gitignore (node_modules, dist, .env, etc.)
[ ] bunfig.toml (test root)
```

---

## Phase 1: Core Types (Single Agent)

All type definitions must be completed first as they are dependencies for everything else.

**Agent Assignment:** 1 agent writes all types in a single pass.

### 1.1 Core Data Types (`src/core/types.ts`)

```
[ ] ConstructNode
[ ] ConstructMetadata (discriminated union)
[ ] ResourceDef
[ ] ProviderDef
[ ] DataSourceDef
[ ] VariableDef
[ ] OutputDef
[ ] BackendDef
[ ] LocalDef
[ ] LifecycleDef
[ ] ConditionDef
[ ] ProvisionerDef
[ ] ValidationDef
```

### 1.2 Token Types (`src/core/tokens.ts`)

```
[ ] Token (discriminated union: ref | fn | raw)
[ ] TokenResolver
[ ] TokenContext
```

### 1.3 Terraform JSON Types (`src/core/synthesize.ts`)

```
[ ] TerraformJson
[ ] TerraformBlock
[ ] RequiredProvider
[ ] VariableBlock
[ ] OutputBlock
```

### 1.4 Error Types (`src/core/errors.ts`)

```
[ ] TftsError (discriminated union)
[ ] ValidationError
```

### 1.5 Config Types (`src/cli/config.ts`)

```
[ ] CdktfConfig
[ ] ProviderConstraint
```

### 1.6 Schema Types (`src/codegen/schema.ts`)

```
[ ] ProviderSchema
[ ] ResourceSchema
[ ] SchemaBlock
[ ] AttributeSchema
[ ] BlockTypeSchema
[ ] SchemaType
```

---

## Phase 2: Core Functions (3 Agents in Parallel)

After types are done, spawn 3 agents simultaneously:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Agent A       │  │   Agent B       │  │   Agent C       │
│   Tree Ops      │  │   Tokens        │  │   Validation    │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Wait for all 3 agents to complete before Phase 3.**

### Agent A: Tree Operations (`src/core/tree.ts`)

```
[ ] addChild(tree, parentPath, child) → ConstructNode
[ ] findNode(tree, path) → ConstructNode | undefined
[ ] walkTree(tree, visitor) → T[]
[ ] getChildren(node, kind) → ConstructNode[]
```

### Agent B: Token System (`src/core/tokens.ts`)

```
[ ] ref(fqn, attribute) → Token
[ ] fn(name, ...args) → Token
[ ] raw(expression) → Token
[ ] tokenToString(token) → string
[ ] isToken(value) → boolean
[ ] containsTokens(value) → boolean
[ ] resolveTokens(value, resolver) → unknown
```

### Agent C: Validation (`src/core/validate.ts`)

```
[ ] validateTree(tree) → ValidationError[]
[ ] validateNode(node) → ValidationError[]
[ ] detectCircularDependencies(tree) → string[][] | null
[ ] validateResourceConfig(node) → ValidationError[]
```

---

## Phase 3: Synthesis (Single Agent)

Depends on: Phase 2 (all agents must complete first).

**Agent Assignment:** 1 agent implements all synthesis functions.

### 3.1 ID Generation (`src/core/synthesize.ts`)

```
[ ] generateLogicalId(path) → string
[ ] generateFqn(resourceType, logicalId) → string
```

### 3.2 Element Synthesis (`src/core/synthesize.ts`)

```
[ ] synthesizeResource(node) → Record<string, unknown>
[ ] synthesizeProvider(node) → Record<string, unknown>
[ ] synthesizeDataSource(node) → Record<string, unknown>
[ ] synthesizeVariable(node) → VariableBlock
[ ] synthesizeOutput(node) → OutputBlock
[ ] synthesizeBackend(node) → Record<string, unknown>
[ ] synthesizeLocal(node) → unknown
```

### 3.3 Stack Synthesis (`src/core/synthesize.ts`)

```
[ ] synthesizeStack(stack) → TerraformJson
[ ] collectProviders(stack) → ConstructNode[]
[ ] collectResources(stack) → ConstructNode[]
[ ] buildRequiredProviders(providers) → Record<string, RequiredProvider>
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
[ ] src/facade/construct.ts
    [ ] Construct base class
    [ ] node property
    [ ] path getter

[ ] src/facade/app.ts
    [ ] App class
    [ ] AppOptions interface
    [ ] synth() method
    [ ] static of(construct) method

[ ] src/facade/stack.ts
    [ ] TerraformStack class
    [ ] addDependency(stack)
    [ ] toTerraform()
```

### Agent E: Resources & Providers

```
[ ] src/facade/resource.ts
    [ ] TerraformResource class
    [ ] Meta-argument properties (dependsOn, count, forEach, provider, lifecycle)
    [ ] addOverride(path, value)
    [ ] interpolationForAttribute(attribute)
    [ ] synthesizeAttributes() abstract

[ ] src/facade/provider.ts
    [ ] TerraformProvider class
    [ ] terraformProviderSource property
    [ ] alias property

[ ] src/facade/datasource.ts
    [ ] TerraformDataSource class
    [ ] interpolationForAttribute(attribute)
    [ ] synthesizeAttributes() abstract
```

### Agent F: Variables, Outputs, Locals

```
[ ] src/facade/variable.ts
    [ ] TerraformVariable class
    [ ] TerraformVariableConfig interface
    [ ] value, stringValue, numberValue, booleanValue, listValue getters

[ ] src/facade/output.ts
    [ ] TerraformOutput class
    [ ] TerraformOutputConfig interface

[ ] src/facade/local.ts
    [ ] TerraformLocal class
    [ ] expression getter
```

### Agent G: Backends

```
[ ] src/facade/backends/backend.ts
    [ ] TerraformBackend abstract class

[ ] src/facade/backends/local.ts
    [ ] LocalBackend class
    [ ] LocalBackendConfig interface

[ ] src/facade/backends/s3.ts
    [ ] S3Backend class
    [ ] S3BackendConfig interface

[ ] src/facade/backends/gcs.ts
    [ ] GcsBackend class
    [ ] GcsBackendConfig interface

[ ] src/facade/backends/remote.ts
    [ ] RemoteBackend class
    [ ] RemoteBackendConfig interface
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
Phase 0: Project Setup (1 agent)
    │
    ▼
Phase 1: Types (1 agent)
    │
    ▼
Phase 2: Core Functions (3 agents in parallel)
    ├── Agent A: Tree Ops ─────────┐
    ├── Agent B: Tokens ───────────┼──► wait for all
    └── Agent C: Validation ───────┘
                                   │
                                   ▼
                    Phase 3: Synthesis (1 agent)
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

| Phase | Description | Agents | Parallel |
|-------|-------------|--------|----------|
| 0     | Project Setup | 1 | No |
| 1     | Core Types | 1 | No |
| 2     | Core Functions | 3 | Yes |
| 3     | Synthesis | 1 | No |
| 4     | Facade | 4 | Yes |
| 5     | CLI & Codegen | 2 | Yes |
| 6     | Integration | 1 | No |

**Total: 13 agent tasks, max 4 concurrent agents**

---

## Execution Order

### Phase 0: Project Setup (1 agent)

```
Agent: package.json
       tsconfig.json
       biome.json
       eslint.config.js
       knip.json
       .gitignore
       bunfig.toml
```

### Phase 1: Types (1 agent)

```
Agent: src/core/types.ts
       src/core/tokens.ts (types only)
       src/core/errors.ts
       src/cli/config.ts (types only)
       src/codegen/schema.ts (types only)
```

### Phase 2: Core Functions (3 agents in parallel)

```
Agent A: src/core/tree.ts
Agent B: src/core/tokens.ts (functions)
Agent C: src/core/validate.ts
```

### Phase 3: Synthesis (1 agent)

```
Agent: src/core/synthesize.ts
```

### Phase 4: Facade (4 agents in parallel)

```
Agent D: src/facade/construct.ts → src/facade/app.ts → src/facade/stack.ts
Agent E: src/facade/resource.ts, src/facade/provider.ts, src/facade/datasource.ts
Agent F: src/facade/variable.ts, src/facade/output.ts, src/facade/local.ts
Agent G: src/facade/backends/*.ts
```

### Phase 5: CLI & Codegen (2 agents in parallel)

```
Agent H: src/cli/config.ts → src/cli/synth.ts → src/cli/index.ts → bin/tfts.ts
Agent I: src/codegen/schema.ts → src/codegen/generator.ts → src/codegen/templates.ts → src/cli/get.ts
```

### Phase 6: Integration (1 agent)

```
Agent: src/index.ts, tests/
```

---

## Test Strategy Per Phase

| Phase | Test Type |
|-------|-----------|
| 1     | Type compilation only |
| 2     | Unit tests for pure functions |
| 3     | Snapshot tests for synthesis output |
| 4     | Integration tests (facade → core → JSON) |
| 5     | CLI tests, codegen output tests |
| 6     | End-to-end tests |
