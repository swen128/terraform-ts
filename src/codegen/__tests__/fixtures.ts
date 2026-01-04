import type { RawProviderSchema } from "../raw-schema.js";

export const simpleProvider: RawProviderSchema = {
  format_version: "1.0",
  provider_schemas: {
    "registry.terraform.io/hashicorp/simple": {
      provider: {
        version: 0,
        block: {
          attributes: {
            api_key: { type: "string", required: true },
            region: { type: "string", optional: true },
          },
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
              // Computed attributes of different types for getter tests
              computed_bool: { type: "bool", computed: true },
              computed_number: { type: "number", computed: true },
              computed_list: { type: ["list", "string"], computed: true },
              computed_number_list: { type: ["list", "number"], computed: true },
              computed_map: { type: ["map", "string"], computed: true },
              computed_list_of_maps: { type: ["list", ["map", "string"]], computed: true },
              computed_number_map: { type: ["map", "number"], computed: true },
              computed_list_of_lists: { type: ["list", ["list", "string"]], computed: true },
              computed_bool_set: { type: ["set", "bool"], computed: true },
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

export const multiwordProvider: RawProviderSchema = {
  format_version: "1.0",
  provider_schemas: {
    "registry.terraform.io/hashicorp/google": {
      provider: { version: 0, block: { attributes: {} } },
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

export const nestingModesProvider: RawProviderSchema = {
  format_version: "1.0",
  provider_schemas: {
    "registry.terraform.io/test/test": {
      provider: { version: 0, block: { attributes: {} } },
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

// Fixture for computed list/object attributes (like google_cloud_run_service.status)
export const computedListProvider: RawProviderSchema = {
  format_version: "1.0",
  provider_schemas: {
    "registry.terraform.io/hashicorp/google": {
      provider: { version: 0, block: { attributes: {} } },
      resource_schemas: {
        google_cloud_run_service: {
          version: 0,
          block: {
            attributes: {
              id: { type: "string", computed: true },
              name: { type: "string", required: true },
            },
            block_types: {
              status: {
                nesting_mode: "list",
                block: {
                  attributes: {
                    url: { type: "string", computed: true },
                    latest_ready_revision_name: { type: "string", computed: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
};

// Fixture for computed list/object ATTRIBUTES (type: ["list", ["object", {...}]])
// This is different from block_types - it's an attribute with object type
export const computedListAttrProvider: RawProviderSchema = {
  format_version: "1.0",
  provider_schemas: {
    "registry.terraform.io/hashicorp/google": {
      provider: { version: 0, block: { attributes: {} } },
      resource_schemas: {
        google_cloud_run_service: {
          version: 0,
          block: {
            attributes: {
              id: { type: "string", computed: true },
              name: { type: "string", required: true },
              status: {
                type: ["list", ["object", { url: "string", latest_ready_revision_name: "string" }]],
                computed: true,
              },
            },
          },
        },
      },
    },
  },
};
