import { App, TerraformStack, TerraformOutput } from "tfts";
import { GoogleProvider } from "./.gen/providers/google/provider/index.js";
import { ComputeNetwork } from "./.gen/providers/google/compute-network/index.js";
import { ComputeInstance } from "./.gen/providers/google/compute-instance/index.js";

const app = new App();
const stack = new TerraformStack(app, "gcp-example");

new GoogleProvider(stack, "google", {});

const network = new ComputeNetwork(stack, "main-network", {
  name: "main-vpc",
  autoCreateSubnetworks: false,
});

new ComputeInstance(stack, "web-server", {
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
