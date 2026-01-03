import { App, TerraformStack, TerraformOutput } from "terraform-ts";
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
  autoCreateSubnetworks: false,
});

new GoogleComputeInstance(stack, "web-server", {
  name: "web-server",
  machineType: "e2-micro",
  zone: "us-central1-a",
  bootDisk: [
    {
      initializeParams: [
        {
          image: "debian-cloud/debian-11",
        },
      ],
    },
  ],
  networkInterface: [
    {
      network: network.selfLink,
      accessConfig: [{}],
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
