export type DeploymentTarget = "docker" | "railway" | "vercel";

export const DEPLOYMENT_TARGET_OPTIONS: {
  description: string;
  label: string;
  value: DeploymentTarget;
}[] = [
  {
    label: "Docker",
    value: "docker",
    description: "Container baseline for any host",
  },
  {
    label: "Railway",
    value: "railway",
    description: "Managed process deployment",
  },
  {
    label: "Vercel",
    value: "vercel",
    description: "Serverless Bun function",
  },
];
