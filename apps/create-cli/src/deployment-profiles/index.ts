import type { DatabaseDialect } from "@goodchat/contracts/config/types";
import type { DeploymentTarget } from "../deployment-targets";
import type { GeneratorConfig, ProjectFile } from "../scaffold-types";
import { dockerProfile } from "./docker";
import { railwayProfile } from "./railway";
import { vercelProfile } from "./vercel";

export type { ProjectFile } from "../scaffold-types";

export interface DeploymentProfile {
  allowedDialects: readonly DatabaseDialect[];
  configFiles: (config: GeneratorConfig) => ProjectFile[];
  isServerless: boolean;
  readme: (config: GeneratorConfig) => string;
  scripts: (dialect: DatabaseDialect) => Record<string, string>;
}

export const DEPLOYMENT_PROFILES = {
  vercel: vercelProfile,
  railway: railwayProfile,
  docker: dockerProfile,
} satisfies Record<DeploymentTarget, DeploymentProfile>;
