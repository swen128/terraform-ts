# tfts Implementation Plan

## Overview

This plan prioritizes types first, then identifies work that can be delegated to multiple agents running in parallel.

**Goal:** Full CDKTF compatibility - must pass all E2E tests from the original terraform-cdk repository.

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
[ ] IResolvable interface
[ ] IResolveContext interface
[ ] IStringProducer, INumberProducer, IListProducer, IAnyProducer
[ ] Intrinsic token encoding
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

### 1.7 Module Types (`src/core/types.ts`)

```
[ ] ModuleDef
[ ] TerraformModuleConfig
[ ] TerraformModuleProvider
[ ] TerraformHclModuleConfig
```

### 1.8 Iterator Types (`src/core/types.ts`)

```
[ ] ITerraformIterator
[ ] ListType, MapType, ComplexListType
[ ] TerraformCountConfig
[ ] DynamicBlockConfig
```

### 1.9 Asset Types (`src/core/types.ts`)

```
[ ] AssetType enum (FILE, DIRECTORY, ARCHIVE)
[ ] TerraformAssetConfig
[ ] TerraformModuleAssetConfig
```

### 1.10 Remote State Types (`src/core/types.ts`)

```
[ ] DataTerraformRemoteStateConfig
[ ] RemoteStateBackendConfig (for each backend type)
```

### 1.11 Testing Types (`src/core/types.ts`)

```
[ ] MatcherResult
[ ] SynthOutput
```

### 1.12 Additional Interface Types

```
[ ] ITerraformDependable
[ ] ITerraformAddressable
[ ] IImportableResource
[ ] IAspect
[ ] ComplexObject types
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

## Phase 6: Advanced Features (4 Agents in Parallel)

Depends on: Phase 5 (both agents must complete first).

Spawn 4 agents simultaneously:

```
┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
│  Agent J     │ │  Agent K     │ │  Agent L     │ │  Agent M     │
│  Modules     │ │  Iterators   │ │  Assets &    │ │  Remote      │
│              │ │  & Count     │ │  Cross-Stack │ │  State       │
└──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘
```

**Wait for all 4 agents to complete before Phase 7.**

### Agent J: Modules

```
[ ] src/facade/module.ts
    [ ] TerraformModule base class
    [ ] interpolationForOutput(outputName)
    [ ] providers configuration
    [ ] forEach support for modules
    [ ] dependsOn support

[ ] src/facade/hcl-module.ts
    [ ] TerraformHclModule class
    [ ] variables configuration
    [ ] set() method

[ ] src/facade/module-asset.ts
    [ ] TerraformModuleAsset class
    [ ] getAssetPathForModule(source)
    [ ] Singleton pattern per scope
```

### Agent K: Iterators & Count

```
[ ] src/facade/iterator.ts
    [ ] TerraformIterator abstract class
    [ ] ListTerraformIterator
    [ ] MapTerraformIterator
    [ ] DynamicListTerraformIterator
    [ ] ResourceTerraformIterator
    [ ] Factory methods: fromList, fromMap, fromComplexList, fromResources, fromDataSources
    [ ] Typed accessors: getString, getNumber, getBoolean, getAny, getList, getNumberList, getMap
    [ ] dynamic() method for dynamic blocks
    [ ] pluckProperty() method
    [ ] key and value properties

[ ] src/facade/count.ts
    [ ] TerraformCount class
    [ ] of(count) factory method
    [ ] index property

[ ] src/facade/dynamic-block.ts
    [ ] TerraformDynamicBlock class

[ ] src/facade/dynamic-expression.ts
    [ ] TerraformDynamicExpression class
```

### Agent L: Assets & Cross-Stack References

```
[ ] src/facade/asset.ts
    [ ] TerraformAsset class
    [ ] AssetType enum
    [ ] path, fileName, assetHash properties
    [ ] File copy to output directory
    [ ] Archive creation for ARCHIVE type
    [ ] Hash computation

[ ] src/core/cross-stack.ts
    [ ] detectCrossStackReferences(stack)
    [ ] generateCrossStackOutputs(stack, references)
    [ ] generateRemoteStateDataSources(stack, references)
    [ ] resolveRemoteStateReferences(value, context)

[ ] Update src/core/synthesize.ts
    [ ] Handle cross-stack reference detection
    [ ] Generate outputs for producing stacks
    [ ] Generate remote state for consuming stacks
```

### Agent M: Remote State

```
[ ] src/facade/remote-state.ts
    [ ] TerraformRemoteState abstract class
    [ ] getString, getNumber, getBoolean, getList, get methods
    [ ] interpolationForAttribute

[ ] src/facade/remote-state/
    [ ] DataTerraformRemoteStateLocal
    [ ] DataTerraformRemoteStateS3
    [ ] DataTerraformRemoteStateGcs
    [ ] DataTerraformRemoteStateAzurerm
    [ ] DataTerraformRemoteStateRemote
    [ ] DataTerraformRemoteStateCloud
    [ ] DataTerraformRemoteStateConsul
    [ ] DataTerraformRemoteStateCos
    [ ] DataTerraformRemoteStateHttp
    [ ] DataTerraformRemoteStateOss
    [ ] DataTerraformRemoteStatePg
    [ ] DataTerraformRemoteStateSwift
```

---

## Phase 7: Aspects, Annotations & Testing (3 Agents in Parallel)

Depends on: Phase 6 (all agents must complete first).

Spawn 3 agents simultaneously:

```
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   Agent N       │  │   Agent O       │  │   Agent P       │
│   Aspects &     │  │   Testing       │  │   Functions &   │
│   Annotations   │  │   Utilities     │  │   Operators     │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

**Wait for all 3 agents to complete before Phase 8.**

### Agent N: Aspects & Annotations

```
[ ] src/facade/aspect.ts
    [ ] IAspect interface
    [ ] Aspects class
    [ ] of(scope) factory method
    [ ] add(aspect) method
    [ ] all getter
    [ ] Aspect invocation during synthesis

[ ] src/facade/annotations.ts
    [ ] Annotations class
    [ ] of(construct) factory method
    [ ] addInfo(message)
    [ ] addWarning(message)
    [ ] addError(message)
    [ ] Annotation collection and reporting

[ ] src/facade/upgrade-id-aspect.ts
    [ ] UpgradeIdAspect class
    [ ] Migration logic for old IDs
```

### Agent O: Testing Utilities

```
[ ] src/facade/testing/index.ts
    [ ] Testing class
    [ ] synth(stack) method
    [ ] synthScope(fn) method
    [ ] stubVersion(app) method
    [ ] fullSynth(stack) method

[ ] src/facade/testing/matchers.ts
    [ ] toHaveResource(synthed, resourceType)
    [ ] toHaveResourceWithProperties(synthed, resourceType, properties)
    [ ] toHaveDataSource(synthed, dataSourceType)
    [ ] toHaveDataSourceWithProperties(synthed, dataSourceType, properties)
    [ ] toHaveProvider(synthed, providerType)
    [ ] toHaveProviderWithProperties(synthed, providerType, properties)

[ ] src/facade/testing/adapters/jest.ts
    [ ] Jest matcher integration
    [ ] Custom matcher types
```

### Agent P: Functions & Operators

```
[ ] src/facade/functions.ts
    [ ] Fn class with all Terraform functions
    [ ] String functions (30+)
    [ ] Numeric functions (15+)
    [ ] Collection functions (40+)
    [ ] Encoding functions (15+)
    [ ] Filesystem functions (10+)
    [ ] Hash/Crypto functions (10+)
    [ ] Date/Time functions (5+)
    [ ] Type conversion functions (15+)
    [ ] conditional() function

[ ] src/facade/operators.ts
    [ ] Op class
    [ ] Arithmetic: add, sub, mul, div, mod, negate
    [ ] Comparison: eq, neq, lt, lte, gt, gte
    [ ] Logical: and, or, not

[ ] src/facade/expression.ts
    [ ] ref(expression) function
    [ ] propertyAccess(target, path) function
    [ ] dependable(resource) function
    [ ] forExpression(iterator, key, value) function
```

---

## Phase 8: Additional Backends & Complex Types (2 Agents in Parallel)

Depends on: Phase 7 (all agents must complete first).

Spawn 2 agents simultaneously:

```
┌─────────────────────────┐  ┌─────────────────────────┐
│       Agent Q           │  │       Agent R           │
│   Additional Backends   │  │   Complex Types &       │
│                         │  │   Misc Features         │
└─────────────────────────┘  └─────────────────────────┘
```

**Wait for both agents to complete before Phase 9.**

### Agent Q: Additional Backends

```
[ ] src/facade/backends/azurerm.ts
    [ ] AzurermBackend class
    [ ] AzurermBackendConfig interface

[ ] src/facade/backends/cloud.ts
    [ ] CloudBackend class
    [ ] CloudBackendConfig interface

[ ] src/facade/backends/consul.ts
    [ ] ConsulBackend class
    [ ] ConsulBackendConfig interface

[ ] src/facade/backends/cos.ts
    [ ] CosBackend class
    [ ] CosBackendConfig interface

[ ] src/facade/backends/http.ts
    [ ] HttpBackend class
    [ ] HttpBackendConfig interface

[ ] src/facade/backends/oss.ts
    [ ] OssBackend class
    [ ] OssBackendConfig interface

[ ] src/facade/backends/pg.ts
    [ ] PgBackend class
    [ ] PgBackendConfig interface

[ ] src/facade/backends/swift.ts
    [ ] SwiftBackend class
    [ ] SwiftBackendConfig interface
```

### Agent R: Complex Types & Misc Features

```
[ ] src/facade/complex-computed-list.ts
    [ ] ComplexList abstract class
    [ ] ComplexMap abstract class
    [ ] StringMap, NumberMap, BooleanMap, AnyMap
    [ ] StringMapList, NumberMapList, BooleanMapList, AnyMapList
    [ ] get(index/key) methods
    [ ] allWithMapKey(attribute) method

[ ] src/facade/data-resource.ts
    [ ] TerraformDataResource class
    [ ] input, triggersReplace config
    [ ] output property

[ ] src/facade/conditions.ts
    [ ] TerraformCondition class
    [ ] Precondition support
    [ ] Postcondition support

[ ] src/facade/importable.ts
    [ ] IImportableResource interface
    [ ] importFrom configuration

[ ] src/facade/resource-targets.ts
    [ ] TerraformResourceTargets class

[ ] src/facade/manifest.ts
    [ ] Manifest class
    [ ] manifest.json generation

[ ] src/facade/features.ts
    [ ] Feature flags support
    [ ] Context-based feature toggles
```

---

## Phase 9: Integration & Polish (Single Agent)

Depends on: Phase 8 (both agents must complete first).

**Agent Assignment:** 1 agent handles final integration.

```
[ ] src/index.ts - Complete public API exports (matching CDKTF exactly)
[ ] Integration tests for all features
[ ] E2E tests matching terraform-cdk test suite:
    [ ] synth-app
    [ ] cross-stack-references
    [ ] iterators
    [ ] modules
    [ ] asset
    [ ] edge
    [ ] multiple-stacks
    [ ] variables
    [ ] testing-matchers
    [ ] terraform-cloud
    [ ] providers
[ ] Error message improvements
[ ] package.json setup (bin, exports)
[ ] Documentation updates
```

---

## Dependency Graph

```
Phase 0: Project Setup (1 agent)
    │
    ▼
Phase 1: Types (1 agent) - Extended with all new types
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
    └── Agent G: Backends (core 4) ────┘
                                       │
                                       ▼
                    Phase 5: CLI & Codegen (2 agents in parallel)
                    ┌── Agent H: CLI ──────────┐
                    └── Agent I: Codegen ──────┴──► wait for all
                                               │
                                               ▼
                    Phase 6: Advanced Features (4 agents in parallel)
    ┌── Agent J: Modules ──────────────┐
    ├── Agent K: Iterators & Count ────┼──► wait for all
    ├── Agent L: Assets & Cross-Stack ─┤
    └── Agent M: Remote State ─────────┘
                                       │
                                       ▼
                    Phase 7: Aspects, Annotations & Testing (3 agents in parallel)
    ┌── Agent N: Aspects & Annotations ──┐
    ├── Agent O: Testing Utilities ──────┼──► wait for all
    └── Agent P: Functions & Operators ──┘
                                         │
                                         ▼
                    Phase 8: Additional Backends & Complex Types (2 agents in parallel)
                    ┌── Agent Q: Additional Backends ──┐
                    └── Agent R: Complex Types & Misc ─┴──► wait for all
                                                       │
                                                       ▼
                              Phase 9: Integration & E2E Tests (1 agent)
```

---

## Agent Summary

| Phase | Description | Agents | Parallel |
|-------|-------------|--------|----------|
| 0     | Project Setup | 1 | No |
| 1     | Core Types (Extended) | 1 | No |
| 2     | Core Functions | 3 | Yes |
| 3     | Synthesis | 1 | No |
| 4     | Facade (Base) | 4 | Yes |
| 5     | CLI & Codegen | 2 | Yes |
| 6     | Advanced Features (Modules, Iterators, Assets, RemoteState) | 4 | Yes |
| 7     | Aspects, Annotations & Testing | 3 | Yes |
| 8     | Additional Backends & Complex Types | 2 | Yes |
| 9     | Integration & E2E Tests | 1 | No |

**Total: 22 agent tasks, max 4 concurrent agents**

### E2E Test Coverage Target

The implementation must pass the following E2E tests from terraform-cdk:

| Test | Description | Key Features Tested |
|------|-------------|---------------------|
| synth-app | Core synthesis | Resources, providers, outputs, overrides |
| cross-stack-references | Multi-stack | Cross-stack tokens, remote state generation |
| iterators | for_each/dynamic | TerraformIterator, dynamic blocks, complex lists |
| modules | Module support | Local modules, registry modules, module bindings |
| asset | Asset handling | TerraformAsset, file/dir/archive types, hashing |
| edge | Edge cases | Complex references, type coercion, null values |
| multiple-stacks | Multi-stack | Multiple stacks, dependencies |
| variables | Variables/Outputs | TerraformVariable, TerraformOutput, tfvars |
| testing-matchers | Testing utils | Testing class, matchers |
| terraform-cloud | Cloud backend | CloudBackend, remote execution |
| providers | Provider config | Multiple providers, aliases |

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

### Phase 6: Advanced Features (4 agents in parallel)

```
Agent J: src/facade/module.ts, src/facade/hcl-module.ts, src/facade/module-asset.ts
Agent K: src/facade/iterator.ts, src/facade/count.ts, src/facade/dynamic-block.ts, src/facade/dynamic-expression.ts
Agent L: src/facade/asset.ts, src/core/cross-stack.ts
Agent M: src/facade/remote-state.ts, src/facade/remote-state/*.ts
```

### Phase 7: Aspects, Annotations & Testing (3 agents in parallel)

```
Agent N: src/facade/aspect.ts, src/facade/annotations.ts, src/facade/upgrade-id-aspect.ts
Agent O: src/facade/testing/index.ts, src/facade/testing/matchers.ts, src/facade/testing/adapters/jest.ts
Agent P: src/facade/functions.ts, src/facade/operators.ts, src/facade/expression.ts
```

### Phase 8: Additional Backends & Complex Types (2 agents in parallel)

```
Agent Q: src/facade/backends/azurerm.ts, cloud.ts, consul.ts, cos.ts, http.ts, oss.ts, pg.ts, swift.ts
Agent R: src/facade/complex-computed-list.ts, data-resource.ts, conditions.ts, importable.ts, resource-targets.ts, manifest.ts, features.ts
```

### Phase 9: Integration & E2E Tests (1 agent)

```
Agent: src/index.ts (complete exports), tests/e2e/*
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
| 6     | Integration tests for modules, iterators, assets, remote state |
| 7     | Unit tests for aspects, annotations, testing utilities |
| 8     | Integration tests for backends, complex types |
| 9     | Full E2E tests matching terraform-cdk test suite |

## E2E Test Requirements

All tests from `/Users/yuto_ogino/libs/terraform-cdk/test/typescript/` must pass:

### Critical Path Tests (Must Pass)

1. **synth-app** - Basic synthesis with resources, providers, outputs
2. **cross-stack-references** - Cross-stack token resolution
3. **iterators** - TerraformIterator with for_each and dynamic blocks
4. **modules** - Local and registry module support
5. **asset** - TerraformAsset with file, directory, archive
6. **edge** - Edge cases: null values, complex references, type handling
7. **multiple-stacks** - Multiple stack synthesis
8. **variables** - TerraformVariable and TerraformOutput
9. **testing-matchers** - Testing utilities
10. **terraform-cloud** - CloudBackend integration
11. **providers** - Provider configuration and aliases

### Additional Tests

- init-from-tf
- init-remote-template
- init-repeatedly
- modules-relative-paths
- provider-add-command
- provider-list-command
- provider-upgrade
- renamed-providers
- synth-app-error
- synth-error-annotations
- watch
