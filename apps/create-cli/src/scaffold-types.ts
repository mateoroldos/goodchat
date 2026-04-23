import type { MCPServerConfig } from "@goodchat/contracts/capabilities/types";
import type {
  DatabaseDialect,
  Platform,
} from "@goodchat/contracts/config/types";
import type { ModelProvider } from "@goodchat/contracts/model/model-ref";
import type { DatabaseProfileId } from "./database-profiles";

export interface ProjectFile {
  content: string;
  path: string;
}

export interface SelectedModel {
  modelId: string;
  provider: ModelProvider;
}

export interface GeneratorConfig {
  authEnabled: boolean;
  databaseDialect: DatabaseDialect;
  databaseProfileId?: DatabaseProfileId;
  id?: string;
  mcp?: MCPServerConfig[];
  model?: SelectedModel;
  name: string;
  platforms: Platform[];
  plugins?: string[];
  prompt: string;
}

export type ScaffolderConfig = GeneratorConfig;
