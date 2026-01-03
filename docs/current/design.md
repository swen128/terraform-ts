# tfts Design Document

## Overview

tfts is structured in three layers:

1. **Core Layer** - Pure functional implementation with immutable data structures
2. **Facade Layer** - CDK-compatible API that translates to the core
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
// Base construct class
abstract class Construct {
  readonly node: ConstructNode;

  constructor(scope: Construct | undefined, id: string);

  get path(): string;
}

// App - root of the construct tree
class App extends Construct {
  constructor(options?: AppOptions);
  synth(): void;
  static of(construct: Construct): App;
}

interface AppOptions {
  readonly outdir?: string;
  readonly skipValidation?: boolean;
}

// TerraformStack
class TerraformStack extends Construct {
  constructor(scope: App, id: string);
  addDependency(stack: TerraformStack): void;
  toTerraform(): TerraformJson;
}

// TerraformResource
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

// TerraformProvider
class TerraformProvider extends Construct {
  constructor(scope: Construct, id: string, config: TerraformProviderConfig);
  readonly terraformProviderSource: string;
  readonly alias?: string;
}

// TerraformDataSource
class TerraformDataSource extends Construct {
  constructor(scope: Construct, id: string);
  interpolationForAttribute(attribute: string): string;
  protected synthesizeAttributes(): Record<string, unknown>;
}

// TerraformVariable
class TerraformVariable extends Construct {
  constructor(scope: Construct, id: string, config: TerraformVariableConfig);
  get value(): unknown;
  get stringValue(): string;
  get numberValue(): number;
  get booleanValue(): boolean;
  get listValue(): unknown[];
}

// TerraformOutput
class TerraformOutput extends Construct {
  constructor(scope: Construct, id: string, config: TerraformOutputConfig);
}

// TerraformLocal
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
// Construct tree node (immutable)
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
// Returns new tree with child added (doesn't mutate)
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

## 7. TokenString Design

### 7.1 Problem with CDKTF's Approach

CDKTF types computed attributes as primitive `string`:

```typescript
// CDKTF: ami.id has type string
get id(): string { return Token.asString(...); }
```

This allows invalid operations that compile but fail at runtime:

```typescript
ami.id.toUpperCase();  // Compiles ✓ but broken at runtime
ami.id.substring(0, 5);  // Compiles ✓ but broken at runtime
```

### 7.2 tfts Solution: TokenString + Union Types

tfts uses an opaque `TokenString` wrapper for computed attributes:

```typescript
// Opaque wrapper - no string methods exposed
class TokenString {
  private readonly _token: Token;

  toString(): string { /* for template literals */ }
  toToken(): Token { return this._token; }
}

// Union types for construct config arguments
type TfString = string | TokenString;
type TfNumber = number | TokenString;
type TfBoolean = boolean | TokenString;
type TfStringList = readonly string[] | TokenString;
type TfNumberList = readonly number[] | TokenString;
type TfStringMap = Readonly<Record<string, string>> | TokenString;
```

### 7.3 Generated Code

```typescript
// Config accepts both literals and token references
interface InstanceConfig extends TerraformResourceConfig {
  readonly ami: TfString;
  readonly instanceType: TfString;
  readonly port: TfNumber;
  readonly tags?: TfStringMap;
}

// Computed attributes return TokenString
class Instance extends TerraformResource {
  get id(): TokenString {
    return this.getStringAttribute("id");
  }
}
```

### 7.4 Usage

```typescript
// ✅ Literals work naturally
new Instance(this, "i", {
  ami: "ami-12345",
  instanceType: "t2.micro",
  port: 8080,
});

// ✅ Token references work
new Instance(this, "i", {
  ami: ami.id,              // TokenString
  instanceType: "t2.micro",
  port: config.port,        // TokenString
});

// ✅ Template literals work (via toString)
const name = `web-${ami.id}`;

// ❌ Compile error - TokenString has no .substring()
ami.id.substring(0, 5);

// ❌ Compile error - TokenString has no arithmetic
resource.port + 1;
```

### 7.5 Comparison

| Aspect                | CDKTF (string)                 | tfts (TfString)               |
|-----------------------|--------------------------------|-------------------------------|
| `ami.id.toUpperCase()`| Compiles ✓ (broken at runtime) | Compile error ✗               |
| `{ ami: "literal" }`  | Works ✓                        | Works ✓                       |
| `{ ami: ami.id }`     | Works ✓                        | Works ✓                       |
| `` `prefix-${ami.id}` ``| Works ✓                      | Works ✓                       |
| Pass to `fn(s: string)`| Works ✓                       | Compile error ✗ (intentional) |

The key insight: CDKTF lies to TypeScript ("this is a string" when it's actually a deferred reference). tfts tells the truth ("this is either a literal OR a deferred reference").
