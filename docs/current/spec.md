# tfts - TypeScript-Only Terraform CDK

## Introduction

tfts is a re-implementation of the Terraform CDK targeting TypeScript exclusively. The project aims to provide a clean, functional programming (FP) style core with a facade layer that maintains API compatibility with the original CDK interface. It runs on Bun and provides:

- `tfts synth` - Synthesize Terraform JSON configuration from TypeScript constructs
- `tfts get` - Generate TypeScript bindings from Terraform provider schemas

The project supports `cdktf.json` configuration files to enable methodical migration from existing CDKTF projects. Google Cloud provider is the priority target for initial testing and compatibility.

---

## Requirements

### 1. Core Synthesis Command

**User Story:** As a developer, I want to run `tfts synth` to generate Terraform JSON configuration from my TypeScript code, so that I can use familiar TypeScript patterns to define infrastructure.

**Acceptance Criteria:**

1.1. When the user executes `tfts synth`, the system shall parse the current project and generate Terraform JSON output.

1.2. When the user executes `tfts synth` without a valid configuration file, the system shall display a clear error message indicating the missing or invalid configuration.

1.3. When the user executes `tfts synth` with the `--output` or `-o` flag, the system shall write the synthesized Terraform JSON to the specified directory.

1.4. If no output directory is specified, the system shall write the synthesized output to `cdktf.out/` by default.

1.5. When synthesis completes successfully, the system shall display a summary of the generated stacks and resources.

---

### 2. Construct Model

**User Story:** As a developer, I want to define infrastructure using TypeScript classes that follow the construct pattern, so that I can compose and reuse infrastructure components.

**Acceptance Criteria:**

2.1. The system shall provide a base `Construct` class that all infrastructure components extend.

2.2. The system shall provide an `App` construct as the root of the construct tree.

2.3. The system shall provide a `TerraformStack` construct for grouping related resources into a Terraform state.

2.4. Where a construct is instantiated with a parent, the system shall automatically register it in the parent's child list.

2.5. The system shall assign a unique logical ID to each construct based on its path in the construct tree.

---

### 3. Resource Definition

**User Story:** As a developer, I want to define Terraform resources using TypeScript classes, so that I can leverage type safety and IDE support.

**Acceptance Criteria:**

3.1. The system shall provide a `TerraformResource` base class for defining Terraform resources.

3.2. When a `TerraformResource` is synthesized, the system shall generate the corresponding Terraform JSON resource block.

3.3. The system shall support all standard Terraform resource attributes: `provider`, `depends_on`, `count`, `for_each`, `lifecycle`, and `provisioner`.

3.4. Where a resource references another resource's attribute, the system shall generate the appropriate Terraform interpolation syntax.

---

### 4. Provider Configuration

**User Story:** As a developer, I want to configure Terraform providers in TypeScript, so that I can manage provider settings alongside my infrastructure code.

**Acceptance Criteria:**

4.1. The system shall provide a `TerraformProvider` base class for defining provider configurations.

4.2. When a provider is defined, the system shall generate the corresponding Terraform `provider` block in JSON output.

4.3. The system shall support multiple provider configurations with aliases.

4.4. Where no explicit provider is specified for a resource, the system shall use the default provider of that type.

---

### 5. Backend Configuration

**User Story:** As a developer, I want to configure Terraform backends in TypeScript, so that I can manage remote state configuration programmatically.

**Acceptance Criteria:**

5.1. The system shall provide backend configuration classes for common backends (local, s3, gcs, azurerm, remote).

5.2. When a backend is configured, the system shall generate the corresponding Terraform `backend` block in the `terraform` configuration.

5.3. If no backend is explicitly configured, the system shall not include a backend block (using Terraform's default local backend).

---

### 6. Variables and Outputs

**User Story:** As a developer, I want to define Terraform variables and outputs in TypeScript, so that I can parameterize my infrastructure and expose values.

**Acceptance Criteria:**

6.1. The system shall provide a `TerraformVariable` class for defining input variables with type, default value, description, and validation.

6.2. The system shall provide a `TerraformOutput` class for defining stack outputs with value, description, and sensitive flag.

6.3. When variables and outputs are synthesized, the system shall generate the corresponding `variable` and `output` blocks in Terraform JSON.

6.4. The system shall provide typed accessors for variable values that generate correct Terraform interpolation.

---

### 7. Data Sources

**User Story:** As a developer, I want to define Terraform data sources in TypeScript, so that I can query existing infrastructure.

**Acceptance Criteria:**

7.1. The system shall provide a `TerraformDataSource` base class for defining data sources.

7.2. When a data source is synthesized, the system shall generate the corresponding Terraform `data` block in JSON output.

7.3. The system shall provide typed attribute accessors that generate correct Terraform data source interpolation syntax.

---

### 8. Functional Programming Core

**User Story:** As a maintainer, I want the core implementation to follow FP principles, so that the codebase is testable, composable, and maintainable.

**Acceptance Criteria:**

8.1. The system shall implement core synthesis logic as pure functions that transform construct trees into Terraform JSON.

8.2. The system shall separate data (construct tree) from behavior (synthesis functions).

8.3. The system shall use immutable data structures for representing the construct tree and synthesized output.

8.4. Where state is necessary, the system shall isolate it at the boundary (CLI entry point) and pass immutable snapshots to pure functions.

---

### 9. CDK-Compatible Facade

**User Story:** As a developer migrating from terraform-cdk, I want an API that matches the original CDK interface, so that I can minimize code changes during migration.

**Acceptance Criteria:**

9.1. The system shall provide a facade layer exposing classes and methods matching the terraform-cdk public API.

9.2. Where the original CDK uses class inheritance and mutation, the facade shall translate to the underlying FP core.

9.3. The system shall maintain compatible constructor signatures for `App`, `TerraformStack`, `TerraformResource`, `TerraformProvider`, `TerraformVariable`, `TerraformOutput`, and `TerraformDataSource`.

---

### 10. Bun Runtime Support

**User Story:** As a developer, I want tfts to run natively on Bun, so that I can benefit from faster execution and modern JavaScript features.

**Acceptance Criteria:**

10.1. The system shall be installable and executable using Bun.

10.2. The system shall use standard Node.js-compatible APIs (e.g., `node:fs`, `node:path`) rather than Bun-specific APIs to maintain portability.

10.3. The system shall not depend on Node.js-specific APIs that are unsupported in Bun.

10.4. When running `bunx tfts synth` or `bun run tfts synth`, the system shall execute correctly.

---

### 11. Error Handling

**User Story:** As a developer, I want clear and actionable error messages, so that I can quickly diagnose and fix issues.

**Acceptance Criteria:**

11.1. When a construct is instantiated with an invalid parent, the system shall throw an error with a descriptive message.

11.2. When synthesis fails due to circular dependencies, the system shall report the cycle path clearly.

11.3. When a required resource attribute is missing, the system shall report which resource and attribute are affected.

11.4. The system shall include file and line information in error messages where available.

---

### 12. Provider Code Generation

**User Story:** As a developer, I want to generate TypeScript bindings from Terraform provider schemas, so that I can use type-safe resource definitions without manual type definitions.

**Acceptance Criteria:**

12.1. When the user executes `tfts get`, the system shall read provider specifications from `cdktf.json` and generate TypeScript bindings.

12.2. The system shall fetch provider schemas from the Terraform Registry or local provider binaries.

12.3. For each provider resource, the system shall generate a TypeScript class extending `TerraformResource` with typed configuration properties.

12.4. For each provider data source, the system shall generate a TypeScript class extending `TerraformDataSource` with typed configuration and output properties.

12.5. The system shall generate a provider class extending `TerraformProvider` with typed configuration properties.

12.6. When the user executes `tfts get` with the `--output` or `-o` flag, the system shall write generated bindings to the specified directory.

12.7. If no output directory is specified, the system shall write generated bindings to `.gen/` by default.

12.8. The system shall prioritize Google Cloud provider (`google` and `google-beta`) for initial compatibility testing.

---

### 13. Configuration File Support

**User Story:** As a developer migrating from CDKTF, I want tfts to read `cdktf.json` configuration files, so that I can reuse my existing project configuration.

**Acceptance Criteria:**

13.1. The system shall read and parse `cdktf.json` from the project root directory.

13.2. The system shall support the `app` field specifying the entry point command (e.g., `"bun run main.ts"`).

13.3. The system shall support the `terraformProviders` field specifying provider packages to generate bindings for.

13.4. The system shall support the `output` field specifying the synthesis output directory.

13.5. The system shall support the `codeMakerOutput` field specifying the generated bindings output directory.

13.6. When `cdktf.json` is missing or invalid, the system shall display a clear error message with guidance on creating a valid configuration.

13.7. The system shall ignore unsupported CDKTF configuration fields with a warning rather than failing.
