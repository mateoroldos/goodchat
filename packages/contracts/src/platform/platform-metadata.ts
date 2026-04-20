import { CHAT_PLATFORMS } from "../config/models";
import type { Platform } from "../config/types";

export interface PlatformEnvVariableMetadata {
  description: string;
  docsUrl: string;
  key: string;
  required: boolean;
  requiredMessage: string;
}

export interface PlatformMetadata {
  canVerifyConnection: boolean;
  color: string;
  envVariables: readonly PlatformEnvVariableMetadata[];
  label: string;
  webhookPath: string | null;
}

export const PLATFORM_METADATA: Record<Platform, PlatformMetadata> = {
  local: {
    label: "Local",
    color: "#71717a",
    webhookPath: null,
    canVerifyConnection: false,
    envVariables: [],
  },
  slack: {
    label: "Slack",
    color: "#611f69",
    webhookPath: "/api/webhook/slack",
    canVerifyConnection: true,
    envVariables: [
      {
        key: "SLACK_BOT_TOKEN",
        description: "Bot user OAuth token (starts with xoxb-)",
        docsUrl: "https://api.slack.com/apps",
        required: true,
        requiredMessage: "SLACK_BOT_TOKEN is required",
      },
      {
        key: "SLACK_SIGNING_SECRET",
        description: "App signing secret for webhook verification",
        docsUrl: "https://api.slack.com/apps",
        required: true,
        requiredMessage: "SLACK_SIGNING_SECRET is required",
      },
      {
        key: "SLACK_CLIENT_ID",
        description: "OAuth client ID for multi-workspace deployments",
        docsUrl: "https://api.slack.com/apps",
        required: false,
        requiredMessage: "",
      },
      {
        key: "SLACK_CLIENT_SECRET",
        description: "OAuth client secret for multi-workspace deployments",
        docsUrl: "https://api.slack.com/apps",
        required: false,
        requiredMessage: "",
      },
      {
        key: "SLACK_ENCRYPTION_KEY",
        description: "AES-256-GCM encryption key for stored tokens",
        docsUrl: "https://api.slack.com/apps",
        required: false,
        requiredMessage: "",
      },
    ],
  },
  discord: {
    label: "Discord",
    color: "#5865f2",
    webhookPath: "/api/webhook/discord",
    canVerifyConnection: true,
    envVariables: [
      {
        key: "DISCORD_BOT_TOKEN",
        description: "Bot token from Developer Portal > Bot",
        docsUrl: "https://discord.com/developers/applications",
        required: true,
        requiredMessage: "DISCORD_BOT_TOKEN is required",
      },
      {
        key: "DISCORD_PUBLIC_KEY",
        description: "Public key from General Information",
        docsUrl: "https://discord.com/developers/applications",
        required: true,
        requiredMessage: "DISCORD_PUBLIC_KEY is required",
      },
      {
        key: "DISCORD_APPLICATION_ID",
        description: "Application ID from General Information",
        docsUrl: "https://discord.com/developers/applications",
        required: true,
        requiredMessage: "DISCORD_APPLICATION_ID is required",
      },
      {
        key: "DISCORD_MENTION_ROLE_IDS",
        description: "Comma-separated role IDs that trigger mention handlers",
        docsUrl: "https://discord.com/developers/applications",
        required: false,
        requiredMessage: "",
      },
    ],
  },
  teams: {
    label: "Microsoft Teams",
    color: "#6264a7",
    webhookPath: "/api/webhook/teams",
    canVerifyConnection: false,
    envVariables: [
      {
        key: "TEAMS_APP_ID",
        description: "Azure Bot App ID",
        docsUrl:
          "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps",
        required: true,
        requiredMessage: "TEAMS_APP_ID is required",
      },
      {
        key: "TEAMS_APP_PASSWORD",
        description: "Azure Bot app secret",
        docsUrl:
          "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps",
        required: true,
        requiredMessage: "TEAMS_APP_PASSWORD is required",
      },
      {
        key: "TEAMS_APP_TENANT_ID",
        description: "Azure AD Tenant ID (required for SingleTenant apps)",
        docsUrl:
          "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/Properties",
        required: false,
        requiredMessage: "",
      },
    ],
  },
  gchat: {
    label: "Google Chat",
    color: "#00ac47",
    webhookPath: "/api/webhook/gchat",
    canVerifyConnection: false,
    envVariables: [
      {
        key: "GOOGLE_CHAT_CREDENTIALS",
        description: "Service account JSON key (base64 encoded)",
        docsUrl: "https://developers.google.com/workspace/chat",
        required: true,
        requiredMessage: "GOOGLE_CHAT_CREDENTIALS is required",
      },
      {
        key: "GOOGLE_CHAT_USE_ADC",
        description: "Set to true to use Application Default Credentials",
        docsUrl: "https://cloud.google.com/docs/authentication/production",
        required: false,
        requiredMessage: "",
      },
      {
        key: "GOOGLE_CHAT_PUBSUB_TOPIC",
        description: "Pub/Sub topic for Google Chat events",
        docsUrl: "https://cloud.google.com/pubsub/docs",
        required: false,
        requiredMessage: "",
      },
      {
        key: "GOOGLE_CHAT_IMPERSONATE_USER",
        description: "Admin email for domain-wide delegation",
        docsUrl: "https://developers.google.com/workspace/chat",
        required: false,
        requiredMessage: "",
      },
    ],
  },
  linear: {
    label: "Linear",
    color: "#f11a7b",
    webhookPath: "/api/webhook/linear",
    canVerifyConnection: true,
    envVariables: [
      {
        key: "LINEAR_WEBHOOK_SECRET",
        description: "Webhook secret for verifying Linear events",
        docsUrl: "https://linear.app/settings/webhooks",
        required: true,
        requiredMessage: "LINEAR_WEBHOOK_SECRET is required",
      },
      {
        key: "LINEAR_API_KEY",
        description: "Linear personal API key (starts with lin_api_)",
        docsUrl: "https://linear.app/settings/security",
        required: true,
        requiredMessage: "LINEAR_API_KEY is required",
      },
      {
        key: "LINEAR_ACCESS_TOKEN",
        description: "Pre-obtained OAuth access token (alternative to API key)",
        docsUrl: "https://developers.linear.app/docs/oauth/authentication",
        required: false,
        requiredMessage: "",
      },
      {
        key: "LINEAR_MODE",
        description: "Interaction mode: comments (default) or agent-sessions",
        docsUrl: "https://chat-sdk.dev/docs/providers/linear",
        required: false,
        requiredMessage: "",
      },
    ],
  },
  github: {
    label: "GitHub",
    color: "#24292f",
    webhookPath: "/api/webhook/github",
    canVerifyConnection: true,
    envVariables: [
      {
        key: "GITHUB_WEBHOOK_SECRET",
        description: "Webhook secret for verifying GitHub events",
        docsUrl:
          "https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks",
        required: true,
        requiredMessage: "GITHUB_WEBHOOK_SECRET is required",
      },
      {
        key: "GITHUB_TOKEN",
        description: "Personal Access Token with repo scope (starts with ghp_)",
        docsUrl: "https://github.com/settings/tokens",
        required: false,
        requiredMessage: "",
      },
      {
        key: "GITHUB_APP_ID",
        description: "GitHub App ID (alternative to PAT)",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps",
        required: false,
        requiredMessage: "",
      },
      {
        key: "GITHUB_PRIVATE_KEY",
        description: "GitHub App RSA private key in PEM format",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/managing-private-keys-for-github-apps",
        required: false,
        requiredMessage: "",
      },
      {
        key: "GITHUB_INSTALLATION_ID",
        description: "GitHub App installation ID (for single-tenant apps)",
        docsUrl:
          "https://docs.github.com/en/apps/creating-github-apps/about-creating-github-apps/about-creating-github-apps",
        required: false,
        requiredMessage: "",
      },
    ],
  },
};

export const PLATFORM_OPTIONS = CHAT_PLATFORMS.map((platform) => ({
  label: PLATFORM_METADATA[platform].label,
  value: platform,
}));

export const PLATFORM_REQUIRED_ENV_KEYS: Record<Platform, readonly string[]> =
  CHAT_PLATFORMS.reduce<Record<Platform, readonly string[]>>(
    (result, platform) => {
      result[platform] = PLATFORM_METADATA[platform].envVariables
        .filter((v) => v.required)
        .map((v) => v.key);
      return result;
    },
    {} as Record<Platform, readonly string[]>
  );
