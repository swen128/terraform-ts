import { App, TerraformStack, TerraformOutput } from "tfts";
import {
  GoogleProvider,
  GoogleComputeNetwork,
  GoogleComputeInstance,
} from "./.gen/providers/google/index.js";

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
      network: network.self_link,
      access_config: [{}],
    },
  ],
  tags: ["http-server", "https-server"],
});

new TerraformOutput(stack, "network_id", {
  value: network.id,
  description: "The network ID",
});

app.synth();
console.log(`Synthesized to ${app.outdir}`);
