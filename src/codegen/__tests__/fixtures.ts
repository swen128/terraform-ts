import type { ProviderSchema } from "../schema.js";

export const simpleProvider: ProviderSchema = {
  format_version: "1.0",
  provider_schemas: {
    "registry.terraform.io/hashicorp/simple": {
      provider: {
        attributes: {
          api_key: { type: "string", required: true },
          region: { type: "string", optional: true },
        },
      },
      resource_schemas: {
        simple_resource: {
          version: 0,
          block: {
            attributes: {
              id: { type: "string", computed: true },
              name: { type: "string", required: true },
              enabled: { type: "bool", optional: true },
              count: { type: "number", optional: true },
              tags: { type: ["map", "string"], optional: true },
            },
            block_types: {
              config: {
                nesting_mode: "single",
                block: {
                  attributes: {
                    key: { type: "string", required: true },
                    value: { type: "string", optional: true },
                  },
                },
              },
              items: {
                nesting_mode: "list",
                min_items: 1,
                block: {
                  attributes: {
                    name: { type: "string", required: true },
                  },
                },
              },
            },
          },
        },
      },
      data_source_schemas: {
        simple_data: {
          version: 0,
          block: {
            attributes: {
              id: { type: "string", required: true },
              name: { type: "string", computed: true },
            },
          },
        },
      },
    },
  },
};

export const multiwordProvider: ProviderSchema = {
  format_version: "1.0",
  provider_schemas: {
    "registry.terraform.io/hashicorp/google": {
      provider: { attributes: {} },
      resource_schemas: {
        google_alloydb_cluster: {
          version: 0,
          block: {
            attributes: {
              id: { type: "string", computed: true },
            },
          },
        },
        google_storage_bucket: {
          version: 0,
          block: {
            attributes: {
              name: { type: "string", required: true },
            },
          },
        },
      },
    },
  },
};

export const nestingModesProvider: ProviderSchema = {
  format_version: "1.0",
  provider_schemas: {
    "registry.terraform.io/test/test": {
      provider: { attributes: {} },
      resource_schemas: {
        test_resource: {
          version: 0,
          block: {
            attributes: {
              id: { type: "string", computed: true },
              name: { type: "string", required: true },
              secret_id: { type: "string", computed: true },
              location: { type: "string", computed: true },
            },
            block_types: {
              single_block: {
                nesting_mode: "single",
                block: {
                  attributes: { value: { type: "string", required: true } },
                },
              },
              list_block: {
                nesting_mode: "list",
                block: {
                  attributes: { value: { type: "string", required: true } },
                },
              },
              single_item_list: {
                nesting_mode: "list",
                max_items: 1,
                block: {
                  attributes: { value: { type: "string", required: true } },
                },
              },
              set_block: {
                nesting_mode: "set",
                block: {
                  attributes: { value: { type: "string", required: true } },
                },
              },
            },
          },
        },
      },
    },
  },
};
