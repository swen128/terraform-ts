# tfts - TypeScript-Only Terraform CDK

## Introduction

tfts is a re-implementation of the Terraform CDK targeting TypeScript exclusively. The project aims to provide a clean, functional programming (FP) style core with a facade layer that maintains **full API compatibility** with the original CDKTF interface. It runs on Bun and provides:

- `tfts synth` - Synthesize Terraform JSON configuration from TypeScript constructs
- `tfts get` - Generate TypeScript bindings from Terraform provider schemas

The project supports `cdktf.json` configuration files to enable drop-in replacement migration from existing CDKTF projects. **The goal is to pass all E2E tests from the original terraform-cdk repository.**

### Compatibility Target

tfts must support all features from the original `cdktf` package including:
- Core constructs (App, Stack, Resource, Provider, DataSource, Variable, Output, Local)
- Modules (TerraformModule, TerraformHclModule)
- Iterators (TerraformIterator, TerraformCount, dynamic blocks)
- Remote state (TerraformRemoteState with all backend types)
- Assets (TerraformAsset, TerraformModuleAsset)
- Aspects and Annotations
- Testing utilities and matchers
- All backend configurations
- Cross-stack references
- Token system with lazy evaluation
- Terraform functions (Fn class)
- Terraform operators (Op class)
- Import support

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

---

### 14. Terraform Modules

**User Story:** As a developer, I want to use Terraform modules (from the registry or local paths) in my TypeScript code, so that I can reuse existing module definitions.

**Acceptance Criteria:**

14.1. The system shall provide a `TerraformModule` base class for referencing Terraform modules.

14.2. When a module is defined, the system shall generate the corresponding Terraform `module` block in JSON output.

14.3. The system shall support modules from the Terraform Registry with version constraints.

14.4. The system shall support local modules with relative paths (e.g., `./modules/vpc`).

14.5. The system shall support module providers configuration for passing providers to modules.

14.6. The system shall support module `depends_on` for explicit dependencies.

14.7. The system shall support module `for_each` for creating multiple module instances.

14.8. The system shall provide `interpolationForOutput(outputName)` for referencing module outputs.

14.9. When the user executes `tfts get`, the system shall generate TypeScript bindings for modules specified in `cdktf.json`.

14.10. The system shall provide `TerraformHclModule` for modules that need HCL-specific handling.

---

### 15. Terraform Iterators

**User Story:** As a developer, I want to use iterators to dynamically create resources based on lists, maps, or other resources, so that I can avoid repetitive code.

**Acceptance Criteria:**

15.1. The system shall provide a `TerraformIterator` class with factory methods: `fromList()`, `fromMap()`, `fromComplexList()`, `fromResources()`, and `fromDataSources()`.

15.2. When using `TerraformIterator.fromList(list)`, the system shall enable `for_each` over list values.

15.3. When using `TerraformIterator.fromMap(map)`, the system shall enable `for_each` over map entries.

15.4. When using `TerraformIterator.fromComplexList(list, keyAttribute)`, the system shall convert a complex list to a map using the specified key attribute.

15.5. When using `TerraformIterator.fromResources(resource)`, the system shall iterate over resource instances created with `for_each`.

15.6. The iterator shall provide typed accessors: `getString()`, `getNumber()`, `getBoolean()`, `getAny()`, `getList()`, `getNumberList()`, `getMap()`.

15.7. The iterator shall provide `value` and `key` properties for accessing current iteration values.

15.8. The iterator shall provide a `dynamic(content)` method for creating dynamic blocks.

15.9. The iterator shall provide `pluckProperty(attribute)` for extracting values from all iterations.

15.10. The system shall provide `TerraformCount` class for count-based iteration with `count.index` access.

15.11. The system shall provide `TerraformDynamicBlock` for explicit dynamic block creation.

15.12. The system shall provide `TerraformDynamicExpression` for dynamic expressions in outputs.

---

### 16. Terraform Remote State

**User Story:** As a developer, I want to reference outputs from remote Terraform state, so that I can share data between separate Terraform configurations.

**Acceptance Criteria:**

16.1. The system shall provide a `TerraformRemoteState` base class for reading remote state data.

16.2. The system shall generate `data.terraform_remote_state` blocks in the JSON output.

16.3. The system shall provide typed accessors: `getString()`, `getNumber()`, `getBoolean()`, `getList()`, `get()`.

16.4. The system shall support remote state for all backend types: local, s3, gcs, azurerm, remote, cloud, consul, cos, http, oss, pg, swift.

16.5. The system shall support `workspace` configuration for workspace-aware state.

16.6. The system shall support `defaults` configuration for fallback values.

---

### 17. Terraform Assets

**User Story:** As a developer, I want to include files and directories as assets in my infrastructure code, so that I can deploy configuration files, scripts, or archives.

**Acceptance Criteria:**

17.1. The system shall provide a `TerraformAsset` class for including files and directories.

17.2. The system shall support `AssetType.FILE` for single files.

17.3. The system shall support `AssetType.DIRECTORY` for directories.

17.4. The system shall support `AssetType.ARCHIVE` for automatically creating zip archives.

17.5. The system shall compute an `assetHash` for change detection.

17.6. The system shall support custom `assetHash` values for deterministic builds.

17.7. The system shall provide `path` and `fileName` properties for referencing assets.

17.8. The system shall copy assets to the synthesis output directory.

17.9. The system shall provide `TerraformModuleAsset` for handling local module assets for Terraform Cloud compatibility.

---

### 18. Aspects

**User Story:** As a developer, I want to apply cross-cutting concerns to my construct tree, so that I can implement validations, tagging, or modifications consistently.

**Acceptance Criteria:**

18.1. The system shall provide an `IAspect` interface with a `visit(node)` method.

18.2. The system shall provide an `Aspects` class with `of(scope)` factory method.

18.3. When `Aspects.of(scope).add(aspect)` is called, the aspect shall be registered for that scope.

18.4. During synthesis, the system shall invoke all registered aspects on each node in the tree.

18.5. Aspects shall be invoked in registration order.

18.6. The system shall provide `UpgradeIdAspect` for migrating from old to new ID generation.

---

### 19. Annotations

**User Story:** As a developer, I want to attach informational, warning, or error messages to constructs, so that synthesis can provide helpful feedback.

**Acceptance Criteria:**

19.1. The system shall provide an `Annotations` class with `of(construct)` factory method.

19.2. The system shall provide `addInfo(message)` for informational messages.

19.3. The system shall provide `addWarning(message)` for warning messages.

19.4. The system shall provide `addError(message)` for error messages.

19.5. When error annotations exist, synthesis shall fail with the error messages.

19.6. When warning annotations exist, synthesis shall display warnings but continue.

---

### 20. Testing Utilities

**User Story:** As a developer, I want testing utilities to validate my infrastructure code, so that I can write unit tests for my stacks.

**Acceptance Criteria:**

20.1. The system shall provide a `Testing` class with helper methods.

20.2. The system shall provide `Testing.synth(stack)` for synthesizing a single stack without writing files.

20.3. The system shall provide `Testing.synthScope(fn)` for synthesizing constructs in an isolated scope.

20.4. The system shall provide `Testing.stubVersion(app)` for stubbing version in tests.

20.5. The system shall provide `Testing.toHaveResource(synthed, resourceType)` matcher.

20.6. The system shall provide `Testing.toHaveResourceWithProperties(synthed, resourceType, properties)` matcher.

20.7. The system shall provide `Testing.toHaveDataSource(synthed, dataSourceType)` matcher.

20.8. The system shall provide `Testing.toHaveDataSourceWithProperties(synthed, dataSourceType, properties)` matcher.

20.9. The system shall provide `Testing.toHaveProvider(synthed, providerType)` matcher.

20.10. The system shall provide `Testing.toHaveProviderWithProperties(synthed, providerType, properties)` matcher.

20.11. The system shall provide Jest-compatible matchers in `testingMatchers` export.

---

### 21. All Backend Types

**User Story:** As a developer, I want to configure any supported Terraform backend, so that I can use my preferred state storage.

**Acceptance Criteria:**

21.1. The system shall provide `LocalBackend` for local file state.

21.2. The system shall provide `S3Backend` for AWS S3 state.

21.3. The system shall provide `GcsBackend` for Google Cloud Storage state.

21.4. The system shall provide `AzurermBackend` for Azure Blob Storage state.

21.5. The system shall provide `RemoteBackend` for Terraform Cloud/Enterprise.

21.6. The system shall provide `CloudBackend` for Terraform Cloud native integration.

21.7. The system shall provide `ConsulBackend` for Consul state.

21.8. The system shall provide `CosBackend` for Tencent Cloud COS state.

21.9. The system shall provide `HttpBackend` for HTTP backend.

21.10. The system shall provide `OssBackend` for Alibaba Cloud OSS state.

21.11. The system shall provide `PgBackend` for PostgreSQL state.

21.12. The system shall provide `SwiftBackend` for OpenStack Swift state.

---

### 22. Cross-Stack References

**User Story:** As a developer, I want to reference resources in one stack from another stack, so that I can compose multi-stack architectures.

**Acceptance Criteria:**

22.1. When a resource attribute from one stack is used in another stack, the system shall automatically create outputs and remote state data sources.

22.2. The system shall detect cross-stack references during synthesis.

22.3. The system shall generate `terraform_remote_state` data sources in consuming stacks.

22.4. The system shall generate outputs in producing stacks for referenced values.

22.5. The system shall establish correct stack dependencies based on cross-stack references.

---

### 23. Token System

**User Story:** As a developer, I want tokens to represent values that are resolved at synthesis or apply time, so that I can work with unknown values type-safely.

**Acceptance Criteria:**

23.1. The system shall provide `Token.asString(value)` for treating values as strings.

23.2. The system shall provide `Token.asNumber(value)` for treating values as numbers.

23.3. The system shall provide `Token.asList(value)` for treating values as string lists.

23.4. The system shall provide `Token.asNumberList(value)` for treating values as number lists.

23.5. The system shall provide `Token.asAny(value)` for untyped token values.

23.6. The system shall provide `Token.isUnresolved(value)` for checking if a value contains tokens.

23.7. The system shall provide `Token.nullValue()` for representing Terraform null.

23.8. The system shall provide `Lazy.stringValue(producer)` for deferred string evaluation.

23.9. The system shall provide `Lazy.numberValue(producer)` for deferred number evaluation.

23.10. The system shall provide `Lazy.listValue(producer)` for deferred list evaluation.

23.11. The system shall provide `Lazy.anyValue(producer)` for deferred any evaluation.

23.12. The system shall resolve all tokens during synthesis.

---

### 24. Terraform Functions

**User Story:** As a developer, I want to use Terraform's built-in functions in my TypeScript code, so that I can perform transformations on values.

**Acceptance Criteria:**

24.1. The system shall provide an `Fn` class with static methods for all Terraform functions.

24.2. The system shall support string functions: `join`, `split`, `replace`, `upper`, `lower`, `title`, `trim`, `trimprefix`, `trimsuffix`, `format`, `formatlist`, `indent`, `chomp`, `regex`, `regexall`, `substr`, etc.

24.3. The system shall support numeric functions: `abs`, `ceil`, `floor`, `log`, `max`, `min`, `pow`, `signum`, `parseint`, `sum`, etc.

24.4. The system shall support collection functions: `length`, `element`, `index`, `lookup`, `contains`, `distinct`, `flatten`, `keys`, `values`, `merge`, `reverse`, `sort`, `range`, `zipmap`, `chunklist`, `concat`, `coalescelist`, `compact`, `slice`, `setproduct`, `setunion`, `setintersection`, `setsubtract`, etc.

24.5. The system shall support encoding functions: `base64encode`, `base64decode`, `jsonencode`, `jsondecode`, `yamlencode`, `yamldecode`, `urlencode`, `csvdecode`, `textencodebase64`, `textdecodebase64`, etc.

24.6. The system shall support filesystem functions: `file`, `fileexists`, `fileset`, `filebase64`, `templatefile`, `abspath`, `dirname`, `pathexpand`, `basename`, etc.

24.7. The system shall support date/time functions: `timestamp`, `timeadd`, `timecmp`, `formatdate`, `plantimestamp`, etc.

24.8. The system shall support hash/crypto functions: `md5`, `sha1`, `sha256`, `sha512`, `bcrypt`, `rsadecrypt`, `base64sha256`, `base64sha512`, etc.

24.9. The system shall support IP network functions: `cidrhost`, `cidrnetmask`, `cidrsubnet`, `cidrsubnets`, etc.

24.10. The system shall support type conversion functions: `tostring`, `tonumber`, `tobool`, `tolist`, `toset`, `tomap`, `try`, `can`, `type`, `nonsensitive`, `sensitive`, etc.

24.11. The system shall support conditional expression: `conditional(condition, trueValue, falseValue)`.

---

### 25. Terraform Operators

**User Story:** As a developer, I want to use Terraform operators in expressions, so that I can perform comparisons and logical operations.

**Acceptance Criteria:**

25.1. The system shall provide an `Op` class with static methods for operators.

25.2. The system shall support arithmetic operators: `add`, `sub`, `mul`, `div`, `mod`, `negate`.

25.3. The system shall support comparison operators: `eq`, `neq`, `lt`, `lte`, `gt`, `gte`.

25.4. The system shall support logical operators: `and`, `or`, `not`.

---

### 26. Import Support

**User Story:** As a developer, I want to import existing infrastructure into my Terraform state, so that I can manage pre-existing resources.

**Acceptance Criteria:**

26.1. The system shall provide `importFrom` configuration on resources for importing.

26.2. The system shall generate `import` blocks in the Terraform configuration.

26.3. The system shall support `IImportableResource` interface for resources that can be imported.

---

### 27. terraform_data Resource

**User Story:** As a developer, I want to use the `terraform_data` managed resource for lifecycle management without external providers.

**Acceptance Criteria:**

27.1. The system shall provide `TerraformDataResource` class for `terraform_data` resources.

27.2. The system shall support `input` and `output` attributes.

27.3. The system shall support `triggers_replace` for replacement triggers.

---

### 28. Complex Computed Lists

**User Story:** As a developer, I want to work with complex computed attributes that are lists or maps of objects.

**Acceptance Criteria:**

28.1. The system shall provide `ComplexList` class for complex list attributes.

28.2. The system shall provide `ComplexMap` class for complex map attributes.

28.3. The system shall provide typed accessors like `get(index)` for list elements.

28.4. The system shall provide `allWithMapKey(keyAttribute)` for converting lists to iterators.

28.5. The system shall provide `StringMap`, `NumberMap`, `BooleanMap`, `AnyMap` types.

28.6. The system shall provide `StringMapList`, `NumberMapList`, `BooleanMapList`, `AnyMapList` types.

---

### 29. Lifecycle and Conditions

**User Story:** As a developer, I want to configure resource lifecycle rules and conditions, so that I can control resource behavior.

**Acceptance Criteria:**

29.1. The system shall support `lifecycle.createBeforeDestroy`.

29.2. The system shall support `lifecycle.preventDestroy`.

29.3. The system shall support `lifecycle.ignoreChanges` with specific attributes or `"all"`.

29.4. The system shall support `lifecycle.replaceTriggeredBy`.

29.5. The system shall provide `TerraformCondition` for preconditions and postconditions.

29.6. The system shall support `precondition` blocks with `condition` and `errorMessage`.

29.7. The system shall support `postcondition` blocks with `condition` and `errorMessage`.

---

### 30. Manifest and Output Structure

**User Story:** As a developer, I want the synthesized output to match CDKTF's structure, so that tooling is compatible.

**Acceptance Criteria:**

30.1. The system shall generate `manifest.json` in the output directory.

30.2. The manifest shall contain stack metadata including file paths and dependencies.

30.3. The system shall output stacks to `{outdir}/stacks/{stackName}/cdk.tf.json`.

30.4. The system shall copy assets to the appropriate stack output directories.

30.5. The system shall provide `Manifest` class for programmatic access.

---

### 31. Expression Utilities

**User Story:** As a developer, I want utilities for building Terraform expressions programmatically.

**Acceptance Criteria:**

31.1. The system shall provide `ref(expression)` for reference expressions.

31.2. The system shall provide `propertyAccess(target, path)` for property access.

31.3. The system shall provide `dependable(resource)` for converting to dependency string.

31.4. The system shall provide `forExpression(iterator, key, value)` for `for` expressions.

31.5. The system shall support conditional expressions.

---

### 32. Feature Flags

**User Story:** As a developer, I want to enable/disable certain behaviors via feature flags for compatibility.

**Acceptance Criteria:**

32.1. The system shall support feature flags via context or environment variables.

32.2. The system shall provide backward-compatible defaults.

32.3. Feature flags shall control behaviors like ID generation strategy.
