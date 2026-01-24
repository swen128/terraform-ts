# tfts Design Document

## Overview

tfts is a **full-featured re-implementation** of CDKTF in TypeScript. The goal is to pass all E2E integration tests from the original terraform-cdk repository.

tfts is structured in three layers:

1. **Core Layer** - Pure functional implementation with immutable data structures
2. **Facade Layer** - CDK-compatible API that translates to the core (full CDKTF API surface)
3. **CLI Layer** - Command-line interface using the facade

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Code (main.ts)                       │
│  new App() → new MyStack() → new GoogleProvider() → ...         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Facade Layer (Classes)                        │
│  Constructs build ConstructNode tree via core functions          │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                  Core Layer (ConstructNode Tree)                 │
│  Immutable tree with all infrastructure definitions              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                 synthesizeStack(stackNode)                       │
│  Pure function transforms tree → TerraformJson                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Terraform JSON Output                          │
│  cdktf.out/stacks/my-stack/cdk.tf.json                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 1. Facade Layer (User-Facing API)

Users write TypeScript code using CDK-compatible classes. The facade internally builds immutable core data structures.

### 1.1 Example User Code

```typescript
// main.ts
import { App, TerraformStack, TerraformOutput } from "tfts";
import { GoogleProvider } from "./.gen/providers/google/provider";
import { GoogleComputeInstance } from "./.gen/providers/google/compute-instance";
import { GoogleComputeNetwork } from "./.gen/providers/google/compute-network";

class MyStack extends TerraformStack {
  constructor(scope: App, id: string) {
    super(scope, id);

    new GoogleProvider(this, "google", {
      project: "my-project",
      region: "us-central1",
    });

    const network = new GoogleComputeNetwork(this, "network", {
      name: "my-network",
      autoCreateSubnetworks: true,
    });

    const instance = new GoogleComputeInstance(this, "vm", {
      name: "my-instance",
      machineType: "e2-micro",
      zone: "us-central1-a",
      bootDisk: {
        initializeParams: {
          image: "debian-cloud/debian-11",
        },
      },
      networkInterface: [
        {
          network: network.id,  // Token reference
        },
      ],
    });

    new TerraformOutput(this, "instance_ip", {
      value: instance.networkInterface.get(0).networkIp,
      description: "The internal IP of the instance",
    });
  }
}

const app = new App();
new MyStack(app, "my-stack");
app.synth();
```

### 1.2 Facade Classes

Each facade class wraps core data structures:

```typescript
abstract class Construct {
  readonly node: ConstructNode;
  constructor(scope: Construct | undefined, id: string);
  get path(): string;
}

class App extends Construct {
  constructor(options?: AppOptions);
  synth(): void;
  static of(construct: Construct): App;
}

interface AppOptions {
  readonly outdir?: string;
  readonly skipValidation?: boolean;
}

class TerraformStack extends Construct {
  constructor(scope: App, id: string);
  addDependency(stack: TerraformStack): void;
  toTerraform(): TerraformJson;
}

class TerraformResource extends Construct {
  constructor(scope: Construct, id: string);
  dependsOn?: ITerraformDependable[];
  count?: number | TerraformCount;
  forEach?: ITerraformIterator;
  provider?: TerraformProvider;
  lifecycle?: TerraformResourceLifecycle;
  addOverride(path: string, value: unknown): void;
  interpolationForAttribute(attribute: string): string;
  protected synthesizeAttributes(): Record<string, unknown>;
}

class TerraformProvider extends Construct {
  constructor(scope: Construct, id: string, config: TerraformProviderConfig);
  readonly terraformProviderSource: string;
  readonly alias?: string;
}

class TerraformDataSource extends Construct {
  constructor(scope: Construct, id: string);
  interpolationForAttribute(attribute: string): string;
  protected synthesizeAttributes(): Record<string, unknown>;
}

class TerraformVariable extends Construct {
  constructor(scope: Construct, id: string, config: TerraformVariableConfig);
  get value(): unknown;
  get stringValue(): string;
  get numberValue(): number;
  get booleanValue(): boolean;
  get listValue(): unknown[];
}

class TerraformOutput extends Construct {
  constructor(scope: Construct, id: string, config: TerraformOutputConfig);
}

class TerraformLocal extends Construct {
  constructor(scope: Construct, id: string, expression: unknown);
  get expression(): unknown;
}
```

### 1.3 Backend Classes

```typescript
abstract class TerraformBackend extends Construct {
  constructor(scope: Construct, id: string);
  abstract toTerraform(): Record<string, unknown>;
}

class LocalBackend extends TerraformBackend {
  constructor(scope: Construct, config?: LocalBackendConfig);
}

class S3Backend extends TerraformBackend {
  constructor(scope: Construct, config: S3BackendConfig);
}

class GcsBackend extends TerraformBackend {
  constructor(scope: Construct, config: GcsBackendConfig);
}

class RemoteBackend extends TerraformBackend {
  constructor(scope: Construct, config: RemoteBackendConfig);
}
```

### 1.4 Internal State Management

The App class holds the root tree. State is isolated at the App boundary:

```typescript
type AppState = {
  tree: ConstructNode;
  nextId: number;
};

const appStates = new WeakMap<App, AppState>();
```

---

## 2. Core Layer (Pure Functions + Immutable Data)

The facade translates user code into immutable core data structures. The core consists of pure functions operating on these structures.

### 2.1 Core Data Types

```typescript
type ConstructNode = {
  readonly id: string;
  readonly path: readonly string[];
  readonly children: readonly ConstructNode[];
  readonly metadata: ConstructMetadata;
};

type ConstructMetadata =
  | { readonly kind: "app"; readonly outdir: string }
  | { readonly kind: "stack"; readonly stackName: string }
  | { readonly kind: "resource"; readonly resource: ResourceDef }
  | { readonly kind: "provider"; readonly provider: ProviderDef }
  | { readonly kind: "datasource"; readonly datasource: DataSourceDef }
  | { readonly kind: "variable"; readonly variable: VariableDef }
  | { readonly kind: "output"; readonly output: OutputDef }
  | { readonly kind: "backend"; readonly backend: BackendDef }
  | { readonly kind: "local"; readonly local: LocalDef };

type ResourceDef = {
  readonly terraformResourceType: string;
  readonly provider?: string;
  readonly dependsOn?: readonly string[];
  readonly count?: number | string;
  readonly forEach?: string;
  readonly lifecycle?: LifecycleDef;
  readonly provisioners?: readonly ProvisionerDef[];
  readonly config: Record<string, unknown>;
};

type ProviderDef = {
  readonly terraformProviderSource: string;
  readonly version?: string;
  readonly alias?: string;
  readonly config: Record<string, unknown>;
};

type DataSourceDef = {
  readonly terraformResourceType: string;
  readonly provider?: string;
  readonly dependsOn?: readonly string[];
  readonly config: Record<string, unknown>;
};

type VariableDef = {
  readonly type?: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly nullable?: boolean;
  readonly validation?: readonly ValidationDef[];
};

type OutputDef = {
  readonly value: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly dependsOn?: readonly string[];
};

type BackendDef = {
  readonly type: string;
  readonly config: Record<string, unknown>;
};

type LocalDef = {
  readonly expression: unknown;
};

type LifecycleDef = {
  readonly createBeforeDestroy?: boolean;
  readonly preventDestroy?: boolean;
  readonly ignoreChanges?: readonly string[] | "all";
  readonly replaceTriggeredBy?: readonly string[];
  readonly precondition?: readonly ConditionDef[];
  readonly postcondition?: readonly ConditionDef[];
};

type ConditionDef = {
  readonly condition: string;
  readonly errorMessage: string;
};

type ProvisionerDef = {
  readonly type: "local-exec" | "remote-exec" | "file";
  readonly config: Record<string, unknown>;
  readonly when?: "create" | "destroy";
  readonly onFailure?: "continue" | "fail";
};

type ValidationDef = {
  readonly condition: string;
  readonly errorMessage: string;
};
```

### 2.2 Facade → Core Translation

The user code from section 1.1 produces this ConstructNode tree:

```typescript
const tree: ConstructNode = {
  id: "app",
  path: [],
  metadata: { kind: "app", outdir: "cdktf.out" },
  children: [
    {
      id: "my-stack",
      path: ["my-stack"],
      metadata: { kind: "stack", stackName: "my-stack" },
      children: [
        {
          id: "google",
          path: ["my-stack", "google"],
          metadata: {
            kind: "provider",
            provider: {
              terraformProviderSource: "hashicorp/google",
              config: {
                project: "my-project",
                region: "us-central1",
              },
            },
          },
          children: [],
        },
        {
          id: "network",
          path: ["my-stack", "network"],
          metadata: {
            kind: "resource",
            resource: {
              terraformResourceType: "google_compute_network",
              config: {
                name: "my-network",
                auto_create_subnetworks: true,
              },
            },
          },
          children: [],
        },
        {
          id: "vm",
          path: ["my-stack", "vm"],
          metadata: {
            kind: "resource",
            resource: {
              terraformResourceType: "google_compute_instance",
              config: {
                name: "my-instance",
                machine_type: "e2-micro",
                zone: "us-central1-a",
                boot_disk: {
                  initialize_params: {
                    image: "debian-cloud/debian-11",
                  },
                },
                network_interface: [
                  {
                    network: "${google_compute_network.network.id}",
                  },
                ],
              },
            },
          },
          children: [],
        },
        {
          id: "instance_ip",
          path: ["my-stack", "instance_ip"],
          metadata: {
            kind: "output",
            output: {
              value: "${google_compute_instance.vm.network_interface[0].network_ip}",
              description: "The internal IP of the instance",
            },
          },
          children: [],
        },
      ],
    },
  ],
};
```

### 2.3 Tree Operations

Pure functions for tree manipulation:

```typescript
function addChild(
  tree: ConstructNode,
  parentPath: readonly string[],
  child: ConstructNode
): ConstructNode;

function findNode(
  tree: ConstructNode,
  path: readonly string[]
): ConstructNode | undefined;

function walkTree<T>(
  tree: ConstructNode,
  visitor: (node: ConstructNode, depth: number) => T
): readonly T[];
```

### 2.4 Token System

Tokens enable lazy evaluation and cross-resource references. When user writes `network.id`, it creates a Token object:

```typescript
type Token =
  | { readonly kind: "ref"; readonly fqn: string; readonly attribute: string }
  | { readonly kind: "fn"; readonly name: string; readonly args: readonly unknown[] }
  | { readonly kind: "raw"; readonly expression: string };

function ref(fqn: string, attribute: string): Token;
function fn(name: string, ...args: unknown[]): Token;
function tokenToString(token: Token): string;
function containsTokens(value: unknown): boolean;
function resolveTokens(value: unknown, resolver: TokenResolver): unknown;

type TokenResolver = (token: Token) => unknown;
```

**Token Resolution Example:**

```typescript
// User code:
networkInterface: [{ network: network.id }]

// Creates Token:
{ kind: "ref", fqn: "google_compute_network.network", attribute: "id" }

// After resolution:
networkInterface: [{ network: "${google_compute_network.network.id}" }]
```

---

## 3. Synthesis (Core → Terraform JSON)

Pure functions transform the ConstructNode tree into Terraform JSON.

### 3.1 Terraform JSON Types

```typescript
type TerraformJson = {
  readonly terraform?: TerraformBlock;
  readonly provider?: Record<string, readonly Record<string, unknown>[]>;
  readonly resource?: Record<string, Record<string, Record<string, unknown>>>;
  readonly data?: Record<string, Record<string, Record<string, unknown>>>;
  readonly variable?: Record<string, VariableBlock>;
  readonly output?: Record<string, OutputBlock>;
  readonly locals?: Record<string, unknown>;
};

type TerraformBlock = {
  readonly required_providers?: Record<string, RequiredProvider>;
  readonly backend?: Record<string, Record<string, unknown>>;
  readonly required_version?: string;
};

type RequiredProvider = {
  readonly source: string;
  readonly version?: string;
};

type VariableBlock = {
  readonly type?: string;
  readonly default?: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly nullable?: boolean;
  readonly validation?: readonly { condition: string; error_message: string }[];
};

type OutputBlock = {
  readonly value: unknown;
  readonly description?: string;
  readonly sensitive?: boolean;
  readonly depends_on?: readonly string[];
};
```

### 3.2 Synthesis Functions

```typescript
function synthesizeStack(stack: ConstructNode): TerraformJson;
function synthesizeResource(node: ConstructNode): Record<string, unknown>;
function synthesizeProvider(node: ConstructNode): Record<string, unknown>;
function synthesizeDataSource(node: ConstructNode): Record<string, unknown>;
function synthesizeVariable(node: ConstructNode): VariableBlock;
function synthesizeOutput(node: ConstructNode): OutputBlock;

function resolveTokens(value: unknown, context: TokenContext): unknown;

type TokenContext = {
  readonly stack: ConstructNode;
  readonly resources: Map<string, ConstructNode>;
};

function generateLogicalId(path: readonly string[]): string;
function generateFqn(resourceType: string, logicalId: string): string;
```

### 3.3 Core → JSON Translation

The ConstructNode tree from section 2.2 synthesizes to:

```json
{
  "terraform": {
    "required_providers": {
      "google": {
        "source": "hashicorp/google",
        "version": "~> 5.0"
      }
    }
  },
  "provider": {
    "google": [
      {
        "project": "my-project",
        "region": "us-central1"
      }
    ]
  },
  "resource": {
    "google_compute_network": {
      "network": {
        "name": "my-network",
        "auto_create_subnetworks": true
      }
    },
    "google_compute_instance": {
      "vm": {
        "name": "my-instance",
        "machine_type": "e2-micro",
        "zone": "us-central1-a",
        "boot_disk": {
          "initialize_params": {
            "image": "debian-cloud/debian-11"
          }
        },
        "network_interface": [
          {
            "network": "${google_compute_network.network.id}"
          }
        ]
      }
    }
  },
  "output": {
    "instance_ip": {
      "value": "${google_compute_instance.vm.network_interface[0].network_ip}",
      "description": "The internal IP of the instance"
    }
  }
}
```

### 3.4 Validation

```typescript
type ValidationError = {
  readonly path: readonly string[];
  readonly message: string;
};

function validateTree(tree: ConstructNode): readonly ValidationError[];
function detectCircularDependencies(tree: ConstructNode): readonly string[][] | null;
```

---

## 4. Provider Code Generation

Generates TypeScript classes from Terraform provider schemas.

### 4.1 Schema Types

```typescript
type ProviderSchema = {
  readonly provider_schemas: Record<string, {
    readonly provider: SchemaBlock;
    readonly resource_schemas: Record<string, ResourceSchema>;
    readonly data_source_schemas: Record<string, ResourceSchema>;
  }>;
};

type ResourceSchema = {
  readonly block: SchemaBlock;
  readonly version: number;
};

type SchemaBlock = {
  readonly attributes?: Record<string, AttributeSchema>;
  readonly block_types?: Record<string, BlockTypeSchema>;
};

type AttributeSchema = {
  readonly type: SchemaType;
  readonly description?: string;
  readonly required?: boolean;
  readonly optional?: boolean;
  readonly computed?: boolean;
  readonly sensitive?: boolean;
};

async function fetchProviderSchema(
  provider: string,
  version?: string
): Promise<ProviderSchema>;
```

### 4.2 Schema → TypeScript Translation

**Input: Provider Schema (from Terraform Registry)**

```json
{
  "provider_schemas": {
    "registry.terraform.io/hashicorp/google": {
      "resource_schemas": {
        "google_storage_bucket": {
          "block": {
            "attributes": {
              "name": {
                "type": "string",
                "required": true,
                "description": "The name of the bucket."
              },
              "location": {
                "type": "string",
                "required": true,
                "description": "The GCS location."
              },
              "force_destroy": {
                "type": "bool",
                "optional": true,
                "description": "When true, deleting a bucket will delete all objects."
              },
              "self_link": {
                "type": "string",
                "computed": true,
                "description": "The URI of the created resource."
              },
              "url": {
                "type": "string",
                "computed": true,
                "description": "The base URL of the bucket."
              }
            }
          }
        }
      }
    }
  }
}
```

**Output: Generated TypeScript**

```typescript
// .gen/providers/google/storage-bucket.ts

export interface GoogleStorageBucketConfig {
  /** The name of the bucket. */
  readonly name: string;
  /** The GCS location. */
  readonly location: string;
  /** When true, deleting a bucket will delete all objects. */
  readonly forceDestroy?: boolean;
}

export class GoogleStorageBucket extends TerraformResource {
  public static readonly tfResourceType = "google_storage_bucket";

  private _name: string;
  private _location: string;
  private _forceDestroy?: boolean;

  constructor(scope: Construct, id: string, config: GoogleStorageBucketConfig) {
    super(scope, id);
    this._name = config.name;
    this._location = config.location;
    this._forceDestroy = config.forceDestroy;
  }

  // Required attributes (read/write)
  public get name(): string { return this._name; }
  public set name(value: string) { this._name = value; }

  public get location(): string { return this._location; }
  public set location(value: string) { this._location = value; }

  // Optional attributes (read/write)
  public get forceDestroy(): boolean | undefined { return this._forceDestroy; }
  public set forceDestroy(value: boolean | undefined) { this._forceDestroy = value; }

  // Computed attributes (read-only, returns Token)
  public get selfLink(): string {
    return this.interpolationForAttribute("self_link");
  }

  public get url(): string {
    return this.interpolationForAttribute("url");
  }

  protected synthesizeAttributes(): Record<string, unknown> {
    return {
      name: this._name,
      location: this._location,
      force_destroy: this._forceDestroy,
    };
  }
}
```

### 4.3 Generated File Structure

```
.gen/
├── providers/
│   └── google/
│       ├── index.ts              # Barrel export
│       ├── provider.ts           # GoogleProvider class
│       ├── compute-instance.ts   # GoogleComputeInstance
│       ├── storage-bucket.ts     # GoogleStorageBucket
│       └── data/
│           ├── compute-instance.ts   # DataGoogleComputeInstance
│           └── ...
└── index.ts                      # Root barrel
```

---

## 5. Configuration (cdktf.json)

### 5.1 Supported Fields

```typescript
type CdktfConfig = {
  readonly app: string;                    // Required: command to run
  readonly language?: "typescript";        // Only TypeScript supported
  readonly output?: string;                // Default: "cdktf.out"
  readonly codeMakerOutput?: string;       // Default: ".gen"
  readonly terraformProviders?: string[];  // Provider constraints
  readonly terraformModules?: string[];    // Module constraints (future)
  readonly context?: Record<string, unknown>;
};
```

### 5.2 Config Parsing

**Input: cdktf.json**

```json
{
  "app": "bun run main.ts",
  "language": "typescript",
  "output": "cdktf.out",
  "codeMakerOutput": ".gen",
  "terraformProviders": [
    "hashicorp/google@~> 5.0",
    "hashicorp/google-beta@~> 5.0"
  ]
}
```

**Parsed Output:**

```typescript
const config: CdktfConfig = {
  app: "bun run main.ts",
  language: "typescript",
  output: "cdktf.out",
  codeMakerOutput: ".gen",
  terraformProviders: [
    { namespace: "hashicorp", name: "google", version: "~> 5.0" },
    { namespace: "hashicorp", name: "google-beta", version: "~> 5.0" },
  ],
};
```

### 5.3 Provider Constraint Parsing

```typescript
// Supported formats:
// "hashicorp/google@~> 5.0"
// "google@~> 5.0"
// "hashicorp/google"

type ProviderConstraint = {
  readonly namespace: string;  // e.g., "hashicorp"
  readonly name: string;       // e.g., "google"
  readonly version?: string;   // e.g., "~> 5.0"
};

function parseProviderConstraint(spec: string): ProviderConstraint;
```

---

## 6. CLI Layer

### 6.1 Command Structure

```
tfts <command> [options]

Commands:
  synth   Synthesize Terraform JSON from TypeScript code
  get     Generate TypeScript bindings from provider schemas

Global Options:
  --help, -h      Show help
  --version, -v   Show version
```

### 6.2 Synth Command

```
tfts synth [options]

Options:
  --app, -a       Command to run the app (overrides cdktf.json)
  --output, -o    Output directory (default: cdktf.out)
```

**Flow:**
1. Read `cdktf.json` configuration
2. Execute app command (e.g., `bun run main.ts`)
3. Collect synthesized output from stdout or output directory
4. Write Terraform JSON files to output directory
5. Generate manifest.json

### 6.3 Get Command

```
tfts get [options]

Options:
  --output, -o    Output directory for generated bindings (default: .gen)
  --force         Regenerate even if bindings exist
```

**Flow:**
1. Read `cdktf.json` configuration
2. Parse `terraformProviders` array
3. For each provider:
   a. Fetch schema from Terraform Registry
   b. Generate TypeScript classes
   c. Write to output directory
4. Generate index.ts barrel file

---

## 7. Directory Structure

```
tfts/
├── src/
│   ├── core/                    # Pure functional core
│   │   ├── types.ts             # Core data types
│   │   ├── tree.ts              # Tree operations
│   │   ├── synthesize.ts        # Synthesis functions
│   │   ├── tokens.ts            # Token system
│   │   └── validate.ts          # Validation functions
│   ├── facade/                  # CDK-compatible API
│   │   ├── construct.ts         # Base Construct class
│   │   ├── app.ts               # App class
│   │   ├── stack.ts             # TerraformStack
│   │   ├── resource.ts          # TerraformResource
│   │   ├── provider.ts          # TerraformProvider
│   │   ├── datasource.ts        # TerraformDataSource
│   │   ├── variable.ts          # TerraformVariable
│   │   ├── output.ts            # TerraformOutput
│   │   ├── local.ts             # TerraformLocal
│   │   └── backends/            # Backend implementations
│   │       ├── local.ts
│   │       ├── s3.ts
│   │       ├── gcs.ts
│   │       └── remote.ts
│   ├── codegen/                 # Provider code generation
│   │   ├── schema.ts            # Schema fetching
│   │   ├── generator.ts         # Code generation
│   │   └── templates.ts         # Code templates
│   ├── cli/                     # CLI implementation
│   │   ├── index.ts             # Entry point
│   │   ├── synth.ts             # Synth command
│   │   ├── get.ts               # Get command
│   │   └── config.ts            # Config parsing
│   └── index.ts                 # Public API exports
├── bin/
│   └── tfts.ts                  # CLI binary entry
├── docs/
│   └── current/
│       ├── spec.md
│       └── design.md
├── cdktf.json
├── package.json
└── tsconfig.json
```

---

## 8. Error Handling Strategy

### 8.1 Error Types

```typescript
type TftsError =
  | { readonly kind: "config"; readonly message: string; readonly path?: string }
  | { readonly kind: "validation"; readonly errors: readonly ValidationError[] }
  | { readonly kind: "synthesis"; readonly message: string; readonly node?: string }
  | { readonly kind: "codegen"; readonly message: string; readonly provider?: string }
  | { readonly kind: "circular"; readonly cycle: readonly string[] };

class TftsConfigError extends Error {
  constructor(message: string, path?: string);
}

class TftsValidationError extends Error {
  constructor(errors: readonly ValidationError[]);
}

class TftsSynthesisError extends Error {
  constructor(message: string, node?: string);
}

class TftsCodegenError extends Error {
  constructor(message: string, provider?: string);
}
```

### 8.2 Error Messages

Errors include:
- Clear description of what went wrong
- Path to the affected construct (when applicable)
- Suggestion for how to fix (when possible)

---

## 9. Testing Strategy

### 9.1 Core Layer Tests

- Pure function tests with known inputs/outputs
- Property-based tests for tree operations
- Snapshot tests for synthesis output

### 9.2 Facade Layer Tests

- Integration tests verifying facade produces correct core structures
- API compatibility tests with CDKTF examples

### 9.3 CLI Tests

- Command execution tests
- Config parsing tests
- End-to-end synthesis tests

### 9.4 Codegen Tests

- Schema parsing tests
- Generated code compilation tests
- Generated code behavior tests

---

## 10. Implementation Phases

### Phase 1: Core Foundation
- Core data types
- Tree operations
- Basic synthesis (resources, providers)
- Token system basics

### Phase 2: Full Synthesis
- Variables, outputs, locals
- Backends
- Data sources
- Complete token resolution

### Phase 3: Facade Layer
- All facade classes
- API compatibility with CDKTF

### Phase 4: CLI
- Config parsing
- Synth command
- Output generation

### Phase 5: Code Generation
- Schema fetching
- TypeScript generation
- Google Cloud provider support

### Phase 6: Polish
- Error messages
- Documentation
- Performance optimization

---

## 11. Terraform Modules

### 11.1 Module Classes

```typescript
abstract class TerraformModule extends TerraformElement implements ITerraformDependable {
  readonly source: string;
  readonly version?: string;
  dependsOn?: string[];
  forEach?: ITerraformIterator;

  constructor(scope: Construct, id: string, options: TerraformModuleConfig);
  
  interpolationForOutput(moduleOutput: string): string;
  protected synthesizeAttributes(): Record<string, unknown>;
}

interface TerraformModuleConfig {
  readonly source: string;
  readonly version?: string;
  readonly providers?: (TerraformProvider | TerraformModuleProvider)[];
  readonly dependsOn?: ITerraformDependable[];
  readonly forEach?: ITerraformIterator;
  readonly skipAssetCreationFromLocalModules?: boolean;
}

interface TerraformModuleProvider {
  readonly provider: TerraformProvider;
  readonly moduleAlias: string;
}

class TerraformHclModule extends TerraformModule {
  readonly variables?: Record<string, unknown>;
  
  constructor(scope: Construct, id: string, options: TerraformHclModuleConfig);
  set(variable: string, value: unknown): void;
}
```

### 11.2 Module Output Example

```json
{
  "module": {
    "my_module": {
      "source": "terraform-aws-modules/vpc/aws",
      "version": "3.0.0",
      "name": "my-vpc",
      "cidr": "10.0.0.0/16",
      "providers": {
        "aws": "aws.us_east"
      }
    }
  }
}
```

---

## 12. Terraform Iterators

### 12.1 Iterator Classes

```typescript
interface ITerraformIterator {
  _getForEachExpression(): unknown;
}

abstract class TerraformIterator implements ITerraformIterator {
  // Factory methods
  static fromList(list: ListType): ListTerraformIterator;
  static fromMap(map: MapType): MapTerraformIterator;
  static fromComplexList(list: ComplexListType, mapKeyAttributeName: string): DynamicListTerraformIterator;
  static fromResources(resource: ITerraformResource): ResourceTerraformIterator;
  static fromDataSources(resource: ITerraformResource): ResourceTerraformIterator;

  // Value accessors
  get key(): string;
  get value(): unknown;
  
  // Typed accessors
  getString(attribute: string): string;
  getNumber(attribute: string): number;
  getBoolean(attribute: string): IResolvable;
  getAny(attribute: string): IResolvable;
  getList(attribute: string): string[];
  getNumberList(attribute: string): number[];
  getMap(attribute: string): Record<string, unknown>;

  // Dynamic block creation
  dynamic(content: Record<string, unknown>): IResolvable;
  
  // Utility
  pluckProperty(attribute: string): IResolvable;
}

class ListTerraformIterator extends TerraformIterator { ... }
class MapTerraformIterator extends TerraformIterator { ... }
class DynamicListTerraformIterator extends TerraformIterator { ... }
class ResourceTerraformIterator extends TerraformIterator { ... }
```

### 12.2 TerraformCount

```typescript
class TerraformCount {
  static of(count: number | IResolvable): TerraformCount;
  
  get index(): number;
}
```

### 12.3 Iterator Usage Example

```typescript
// User code:
const iterator = TerraformIterator.fromList(["a", "b", "c"]);

new Resource(this, "example", {
  forEach: iterator,
  name: iterator.value,
});

// Generates:
{
  "resource": {
    "example": {
      "example": {
        "for_each": ["a", "b", "c"],
        "name": "${each.value}"
      }
    }
  }
}
```

### 12.4 Dynamic Blocks

```typescript
// User code:
new DataArchiveFile(this, "inline", {
  type: "zip",
  outputPath: "${path.module}/out.zip",
  source: iterator.dynamic({
    content: Fn.upper(iterator.value),
    filename: `${iterator.value}.txt`,
  }),
});

// Generates:
{
  "data": {
    "archive_file": {
      "inline": {
        "type": "zip",
        "output_path": "${path.module}/out.zip",
        "dynamic": {
          "source": {
            "for_each": "...",
            "content": {
              "content": "${upper(source.value)}",
              "filename": "${source.value}.txt"
            }
          }
        }
      }
    }
  }
}
```

---

## 13. Terraform Remote State

### 13.1 Remote State Classes

```typescript
interface DataTerraformRemoteStateConfig {
  readonly workspace?: string;
  readonly defaults?: Record<string, unknown>;
}

abstract class TerraformRemoteState extends TerraformElement implements ITerraformAddressable {
  constructor(
    scope: Construct,
    id: string,
    backend: string,
    config: DataTerraformRemoteStateConfig
  );

  getString(output: string): string;
  getNumber(output: string): number;
  getBoolean(output: string): IResolvable;
  getList(output: string): string[];
  get(output: string): IResolvable;
}

class DataTerraformRemoteStateLocal extends TerraformRemoteState { ... }
class DataTerraformRemoteStateS3 extends TerraformRemoteState { ... }
class DataTerraformRemoteStateGcs extends TerraformRemoteState { ... }
class DataTerraformRemoteStateAzurerm extends TerraformRemoteState { ... }
class DataTerraformRemoteStateRemote extends TerraformRemoteState { ... }
class DataTerraformRemoteStateCloud extends TerraformRemoteState { ... }
class DataTerraformRemoteStateConsul extends TerraformRemoteState { ... }
class DataTerraformRemoteStateCos extends TerraformRemoteState { ... }
class DataTerraformRemoteStateHttp extends TerraformRemoteState { ... }
class DataTerraformRemoteStateOss extends TerraformRemoteState { ... }
class DataTerraformRemoteStatePg extends TerraformRemoteState { ... }
class DataTerraformRemoteStateSwift extends TerraformRemoteState { ... }
```

### 13.2 Remote State Output

```json
{
  "data": {
    "terraform_remote_state": {
      "vpc": {
        "backend": "s3",
        "config": {
          "bucket": "my-terraform-state",
          "key": "vpc/terraform.tfstate",
          "region": "us-east-1"
        }
      }
    }
  }
}
```

---

## 14. Terraform Assets

### 14.1 Asset Classes

```typescript
enum AssetType {
  FILE = "FILE",
  DIRECTORY = "DIRECTORY",
  ARCHIVE = "ARCHIVE",
}

interface TerraformAssetConfig {
  readonly path: string;
  readonly type?: AssetType;
  readonly assetHash?: string;
}

class TerraformAsset extends Construct {
  readonly path: string;
  readonly fileName: string;
  readonly assetHash: string;
  readonly type: AssetType;

  constructor(scope: Construct, id: string, config: TerraformAssetConfig);
}

class TerraformModuleAsset {
  static of(scope: Construct): TerraformModuleAsset;
  getAssetPathForModule(source: string): string;
}
```

### 14.2 Asset Behavior

- Files are copied to `{outdir}/stacks/{stackName}/assets/`
- Directories can be included as-is or archived
- Asset hash is computed from file contents for change detection
- Custom asset hash can be provided for deterministic builds

---

## 15. Aspects

### 15.1 Aspect Classes

```typescript
interface IAspect {
  visit(node: IConstruct): void;
}

class Aspects {
  static of(scope: IConstruct): Aspects;
  
  add(aspect: IAspect): void;
  get all(): readonly IAspect[];
}
```

### 15.2 Aspect Invocation

Aspects are invoked during synthesis:

```typescript
// Internal synthesis flow
function synthesize(app: App): void {
  // 1. Invoke all aspects
  invokeAspects(app);
  
  // 2. Validate
  validate(app);
  
  // 3. Synthesize to JSON
  synthesizeStacks(app);
}

function invokeAspects(construct: IConstruct): void {
  for (const aspect of Aspects.of(construct).all) {
    aspect.visit(construct);
  }
  for (const child of construct.node.children) {
    invokeAspects(child);
  }
}
```

### 15.3 Built-in Aspects

```typescript
class UpgradeIdAspect implements IAspect {
  visit(node: IConstruct): void;
}
```

---

## 16. Annotations

### 16.1 Annotation Classes

```typescript
class Annotations {
  static of(construct: IConstruct): Annotations;
  
  addInfo(message: string): void;
  addWarning(message: string): void;
  addError(message: string): void;
}
```

### 16.2 Annotation Handling

- Info: Logged during synthesis
- Warning: Logged during synthesis, does not fail
- Error: Causes synthesis to fail with error message

---

## 17. Testing Utilities

### 17.1 Testing Class

```typescript
class Testing {
  static synth(stack: TerraformStack): string;
  static synthScope(fn: (scope: Construct) => void): string;
  static stubVersion(app: App): App;
  static fullSynth(stack: TerraformStack): string;
  
  static toHaveResource(received: string, resourceType: string): boolean;
  static toHaveResourceWithProperties(
    received: string,
    resourceType: string,
    properties: Record<string, unknown>
  ): boolean;
  static toHaveDataSource(received: string, dataSourceType: string): boolean;
  static toHaveDataSourceWithProperties(
    received: string,
    dataSourceType: string,
    properties: Record<string, unknown>
  ): boolean;
  static toHaveProvider(received: string, providerType: string): boolean;
  static toHaveProviderWithProperties(
    received: string,
    providerType: string,
    properties: Record<string, unknown>
  ): boolean;
}
```

### 17.2 Jest Matchers

```typescript
// Usage in tests:
expect(Testing.synth(stack)).toHaveResource("aws_instance");
expect(Testing.synth(stack)).toHaveResourceWithProperties("aws_instance", {
  ami: "ami-12345678",
  instance_type: "t2.micro",
});
```

---

## 18. Cross-Stack References

### 18.1 Reference Detection

When synthesizing, detect cross-stack references:

```typescript
function detectCrossStackReferences(stack: TerraformStack): CrossStackReference[] {
  // Walk the tree and find tokens that reference other stacks
  // Return list of references with source and target information
}
```

### 18.2 Reference Resolution

```typescript
// 1. In producing stack: Generate output
{
  "output": {
    "cross_stack_output_originstr": {
      "value": "${random_password.str.result}"
    }
  }
}

// 2. In consuming stack: Generate remote state reference
{
  "data": {
    "terraform_remote_state": {
      "origin": {
        "backend": "local",
        "config": {
          "path": "../origin/terraform.tfstate"
        }
      }
    }
  }
}

// 3. Replace token with remote state reference
"${data.terraform_remote_state.origin.outputs.cross_stack_output_originstr}"
```

---

## 19. Token System (Extended)

### 19.1 Token Classes

```typescript
class Token {
  static asString(value: unknown): string;
  static asNumber(value: unknown): number;
  static asList(value: unknown): string[];
  static asNumberList(value: unknown): number[];
  static asAny(value: unknown): IResolvable;
  static isUnresolved(value: unknown): boolean;
  static nullValue(): IResolvable;
}

class Lazy {
  static stringValue(producer: IStringProducer): string;
  static numberValue(producer: INumberProducer): number;
  static listValue(producer: IListProducer): string[];
  static anyValue(producer: IAnyProducer): IResolvable;
}

interface IResolvable {
  resolve(context: IResolveContext): unknown;
}
```

### 19.2 Token Encoding

Tokens use special encoding that survives JSON serialization:

```typescript
// Encoding examples:
// String: "${TfToken[...]}"
// Number: special double encoding
// List: ["#{TfToken[...]}"]
```

---

## 20. Terraform Functions (Fn Class)

### 20.1 Function Categories

```typescript
class Fn {
  // String functions
  static join(separator: string, list: string[]): string;
  static split(separator: string, value: string): string[];
  static upper(value: string): string;
  static lower(value: string): string;
  static format(format: string, ...args: unknown[]): string;
  // ... 20+ more string functions

  // Numeric functions
  static abs(num: number): number;
  static ceil(num: number): number;
  static floor(num: number): number;
  static max(...nums: number[]): number;
  static min(...nums: number[]): number;
  static sum(list: number[]): number;
  // ... more numeric functions

  // Collection functions
  static length(value: unknown): number;
  static element(list: unknown[], index: number): unknown;
  static lookup(map: Record<string, unknown>, key: string, defaultValue?: unknown): unknown;
  static keys(map: Record<string, unknown>): string[];
  static values(map: Record<string, unknown>): unknown[];
  static merge(...maps: Record<string, unknown>[]): Record<string, unknown>;
  static flatten(list: unknown[]): unknown[];
  static concat(...lists: unknown[][]): unknown[];
  // ... 30+ more collection functions

  // Encoding functions
  static base64encode(value: string): string;
  static base64decode(value: string): string;
  static jsonencode(value: unknown): string;
  static jsondecode(value: string): unknown;
  static yamlencode(value: unknown): string;
  static yamldecode(value: string): unknown;
  // ... more encoding functions

  // Filesystem functions
  static file(path: string): string;
  static fileexists(path: string): boolean;
  static templatefile(path: string, vars: Record<string, unknown>): string;
  // ... more filesystem functions

  // Hash/Crypto functions
  static md5(value: string): string;
  static sha256(value: string): string;
  static base64sha256(value: string): string;
  // ... more hash functions

  // Conditional
  static conditional(condition: unknown, trueValue: unknown, falseValue: unknown): unknown;
}
```

---

## 21. Terraform Operators (Op Class)

```typescript
class Op {
  // Arithmetic
  static add(a: number, b: number): number;
  static sub(a: number, b: number): number;
  static mul(a: number, b: number): number;
  static div(a: number, b: number): number;
  static mod(a: number, b: number): number;
  static negate(a: number): number;

  // Comparison
  static eq(a: unknown, b: unknown): boolean;
  static neq(a: unknown, b: unknown): boolean;
  static lt(a: number, b: number): boolean;
  static lte(a: number, b: number): boolean;
  static gt(a: number, b: number): boolean;
  static gte(a: number, b: number): boolean;

  // Logical
  static and(a: boolean, b: boolean): boolean;
  static or(a: boolean, b: boolean): boolean;
  static not(a: boolean): boolean;
}
```

---

## 22. terraform_data Resource

```typescript
interface TerraformDataResourceConfig {
  readonly input?: unknown;
  readonly triggersReplace?: unknown;
}

class TerraformDataResource extends TerraformResource {
  static readonly tfResourceType = "terraform_data";
  
  constructor(scope: Construct, id: string, config?: TerraformDataResourceConfig);
  
  get output(): unknown;
}
```

---

## 23. Complex Computed Lists

```typescript
abstract class ComplexList {
  get(index: number): ComplexObject;
  allWithMapKey(mapKeyAttributeName: string): DynamicListTerraformIterator;
}

abstract class ComplexMap {
  get(key: string): ComplexObject;
}

class StringMap extends ComplexMap { ... }
class NumberMap extends ComplexMap { ... }
class BooleanMap extends ComplexMap { ... }
class AnyMap extends ComplexMap { ... }

class StringMapList extends ComplexList { ... }
class NumberMapList extends ComplexList { ... }
class BooleanMapList extends ComplexList { ... }
class AnyMapList extends ComplexList { ... }
```

---

## 24. Extended Directory Structure

```
tfts/
├── src/
│   ├── core/                    # Pure functional core
│   │   ├── types.ts             # Core data types
│   │   ├── tree.ts              # Tree operations
│   │   ├── synthesize/          # Synthesis
│   │   │   ├── index.ts
│   │   │   ├── synthesizer.ts
│   │   │   └── types.ts
│   │   ├── tokens/              # Token system
│   │   │   ├── index.ts
│   │   │   ├── token.ts
│   │   │   ├── lazy.ts
│   │   │   ├── resolvable.ts
│   │   │   ├── string-fragments.ts
│   │   │   └── private/
│   │   │       ├── encoding.ts
│   │   │       ├── intrinsic.ts
│   │   │       ├── resolve.ts
│   │   │       └── token-map.ts
│   │   ├── validate.ts          # Validation functions
│   │   └── errors.ts            # Error types
│   ├── facade/                  # CDK-compatible API
│   │   ├── construct.ts         # Base Construct class
│   │   ├── app.ts               # App class
│   │   ├── stack.ts             # TerraformStack
│   │   ├── element.ts           # TerraformElement
│   │   ├── resource.ts          # TerraformResource
│   │   ├── provider.ts          # TerraformProvider
│   │   ├── datasource.ts        # TerraformDataSource
│   │   ├── variable.ts          # TerraformVariable
│   │   ├── output.ts            # TerraformOutput
│   │   ├── local.ts             # TerraformLocal
│   │   ├── module.ts            # TerraformModule
│   │   ├── hcl-module.ts        # TerraformHclModule
│   │   ├── iterator.ts          # TerraformIterator
│   │   ├── count.ts             # TerraformCount
│   │   ├── dynamic-block.ts     # TerraformDynamicBlock
│   │   ├── dynamic-expression.ts # TerraformDynamicExpression
│   │   ├── asset.ts             # TerraformAsset
│   │   ├── module-asset.ts      # TerraformModuleAsset
│   │   ├── remote-state.ts      # TerraformRemoteState
│   │   ├── data-resource.ts     # TerraformDataResource
│   │   ├── conditions.ts        # TerraformCondition
│   │   ├── provisioner.ts       # TerraformProvisioner
│   │   ├── dependable.ts        # ITerraformDependable
│   │   ├── addressable.ts       # ITerraformAddressable
│   │   ├── importable.ts        # IImportableResource
│   │   ├── resource-targets.ts  # TerraformResourceTargets
│   │   ├── operators.ts         # Op class
│   │   ├── functions.ts         # Fn class
│   │   ├── expression.ts        # tfExpression utilities
│   │   ├── complex-computed-list.ts # ComplexList, ComplexMap
│   │   ├── aspect.ts            # Aspects
│   │   ├── annotations.ts       # Annotations
│   │   ├── manifest.ts          # Manifest handling
│   │   ├── features.ts          # Feature flags
│   │   ├── upgrade-id-aspect.ts # Migration aspect
│   │   ├── backends/            # Backend implementations
│   │   │   ├── index.ts
│   │   │   ├── local.ts
│   │   │   ├── s3.ts
│   │   │   ├── gcs.ts
│   │   │   ├── azurerm.ts
│   │   │   ├── remote.ts
│   │   │   ├── cloud.ts
│   │   │   ├── consul.ts
│   │   │   ├── cos.ts
│   │   │   ├── http.ts
│   │   │   ├── oss.ts
│   │   │   ├── pg.ts
│   │   │   └── swift.ts
│   │   └── testing/             # Testing utilities
│   │       ├── index.ts
│   │       ├── matchers.ts
│   │       └── adapters/
│   │           └── jest.ts
│   ├── codegen/                 # Provider code generation
│   │   ├── schema.ts            # Schema fetching
│   │   ├── generator.ts         # Code generation
│   │   └── templates.ts         # Code templates
│   ├── cli/                     # CLI implementation
│   │   ├── index.ts             # Entry point
│   │   ├── synth.ts             # Synth command
│   │   ├── get.ts               # Get command
│   │   └── config.ts            # Config parsing
│   └── index.ts                 # Public API exports
├── bin/
│   └── tfts.ts                  # CLI binary entry
└── tests/                       # Test suite matching CDKTF E2E tests
    ├── e2e/
    │   ├── synth-app/
    │   ├── cross-stack-references/
    │   ├── iterators/
    │   ├── modules/
    │   ├── asset/
    │   ├── edge/
    │   └── ...
    └── unit/
```
