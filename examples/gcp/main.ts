import { App, TerraformStack, TerraformOutput } from "tfts";
import { GoogleProvider, GoogleComputeNetwork, GoogleComputeInstance } from "./.gen/providers/google/index.js";

const app = new App();
const stack = new TerraformStack(app, "gcp-example");

new GoogleProvider(stack, "google", {});

const network = new GoogleComputeNetwork(stack, "main-network", {
  name: "main-vpc",
  auto_create_subnetworks: false,
});

new GoogleComputeInstance(stack, "web-server", {
  name: "web-server",
  machine_type: "e2-micro",
  zone: "us-central1-a",
  boot_disk: [
    {
      initialize_params: [
        {
          image: "debian-cloud/debian-11",
        },
      ],
    },
  ],
  network_interface: [
    {
      network: network.getStringAttribute("self_link"),
      access_config: [{}],
    },
  ],
  tags: ["http-server", "https-server"],
});

new TerraformOutput(stack, "network_id", {
  value: network.getStringAttribute("id"),
  description: "The network ID",
});

const result = app.synth();
if (result.isOk()) {
  for (const [stackName, json] of result.value) {
    console.log(`Stack: ${stackName}`);
    console.log(JSON.stringify(json, null, 2));
  }
} else {
  console.error("Synthesis failed:", result.error);
  process.exit(1);
}
