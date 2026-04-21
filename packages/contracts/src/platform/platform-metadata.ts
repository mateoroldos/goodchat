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

export interface PlatformSetupLink {
  label: string;
  url: string;
}

export interface PlatformSetupStep {
  description: string;
  title: string;
  type?: "standard" | "webhook";
}

export interface PlatformSetupInstructions {
  checklist: readonly string[];
  intro: string;
  links: readonly PlatformSetupLink[];
  pitfalls: readonly string[];
  steps: readonly PlatformSetupStep[];
}

export const PLATFORM_METADATA: Record<Platform, PlatformMetadata> = {
  web: {
    label: "Web",
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

export const PLATFORM_SETUP_INSTRUCTIONS: Record<
  Platform,
  PlatformSetupInstructions
> = {
  web: {
    intro: "Run locally with no external platform setup.",
    steps: [
      {
        title: "Start the dev runtime",
        description: "Run goodchat in dev mode and keep the server running.",
      },
      {
        title: "Open the dashboard",
        description: "Use the web app to test prompts, tools, and context.",
      },
      {
        title: "Send a web test message",
        description:
          "Trigger one full request/response cycle and confirm logs appear.",
      },
    ],
    checklist: [
      "Server starts without env errors",
      "You can send and receive messages in the dashboard",
      "Logs show the request lifecycle",
    ],
    pitfalls: [
      "Forgetting to run both server and web app",
      "Assuming web mode validates external webhook flows",
    ],
    links: [
      { label: "Chat SDK docs", url: "https://chat-sdk.dev/docs" },
      { label: "SvelteKit docs", url: "https://svelte.dev/docs/kit" },
    ],
  },
  slack: {
    intro: "Create a Slack app, configure events, then add required secrets.",
    steps: [
      {
        title: "Create or select a Slack app",
        description: "Open Slack API apps and pick the workspace for testing.",
      },
      {
        title: "Enable bot features",
        description:
          "Enable Event Subscriptions and required bot scopes, then install the app.",
      },
      {
        title: "Register the Request URL",
        description:
          "Paste your webhook URL into Event Subscriptions and save changes.",
        type: "webhook",
      },
      {
        title: "Add env variables",
        description:
          "Set bot token and signing secret. Add OAuth values if using multi-workspace installs.",
      },
    ],
    checklist: [
      "Slack marks the Request URL as verified",
      "App is installed to your target workspace",
      "Mentions/messages reach your webhook logs",
    ],
    pitfalls: [
      "Missing bot scopes before reinstalling",
      "Using a signing secret from a different app",
    ],
    links: [
      {
        label: "Chat SDK Slack",
        url: "https://chat-sdk.dev/adapters/slack",
      },
      { label: "Slack API apps", url: "https://api.slack.com/apps" },
    ],
  },
  discord: {
    intro:
      "Use a Discord application with interactions enabled and bot credentials configured.",
    steps: [
      {
        title: "Create a Discord application",
        description:
          "Open the Discord Developer Portal and create/select your app.",
      },
      {
        title: "Collect app credentials",
        description:
          "Copy Application ID, Public Key, and Bot Token from portal settings.",
      },
      {
        title: "Register Interactions Endpoint URL",
        description:
          "Paste your webhook URL in General Information and save to validate.",
        type: "webhook",
      },
      {
        title: "Invite bot to your server",
        description:
          "Generate an OAuth2 URL with bot + application.commands scopes and invite it.",
      },
    ],
    checklist: [
      "Endpoint validates successfully in Developer Portal",
      "Bot appears online in your server",
      "Slash commands or mentions trigger responses",
    ],
    pitfalls: [
      "Not enabling Message Content intent when needed",
      "Rotating token without updating env",
    ],
    links: [
      {
        label: "Chat SDK Discord",
        url: "https://chat-sdk.dev/adapters/discord",
      },
      {
        label: "Discord Developer Portal",
        url: "https://discord.com/developers/applications",
      },
    ],
  },
  teams: {
    intro:
      "Register an Azure bot and connect Teams messaging endpoint settings.",
    steps: [
      {
        title: "Register your Azure bot app",
        description:
          "Create/select an app registration and capture App ID and secret.",
      },
      {
        title: "Configure Teams channel",
        description:
          "Enable Microsoft Teams channel for your bot in Azure Bot settings.",
      },
      {
        title: "Set messaging endpoint",
        description: "Set the bot messaging endpoint to your webhook URL.",
        type: "webhook",
      },
      {
        title: "Set env variables",
        description:
          "Add app ID/password and tenant ID when using a single-tenant setup.",
      },
    ],
    checklist: [
      "Bot endpoint is reachable from Azure",
      "Teams channel shows connected",
      "Direct message to bot returns a response",
    ],
    pitfalls: [
      "Using wrong tenant for SingleTenant config",
      "Forgetting to redeploy after endpoint changes",
    ],
    links: [
      {
        label: "Chat SDK Teams",
        url: "https://chat-sdk.dev/adapters/teams",
      },
      {
        label: "Azure portal",
        url: "https://portal.azure.com/#view/Microsoft_AAD_IAM/ActiveDirectoryMenuBlade/RegisteredApps",
      },
    ],
  },
  gchat: {
    intro:
      "Configure a Google Chat app and service-account based authentication.",
    steps: [
      {
        title: "Create a Google Chat app",
        description:
          "Use Google Cloud console to configure app details and interaction settings.",
      },
      {
        title: "Configure event delivery",
        description:
          "Set event endpoint settings for HTTP or Pub/Sub delivery as needed.",
      },
      {
        title: "Register endpoint URL",
        description:
          "Use your webhook URL for HTTP callbacks when endpoint mode is selected.",
        type: "webhook",
      },
      {
        title: "Add credentials env vars",
        description:
          "Provide GOOGLE_CHAT_CREDENTIALS or ADC setup, plus optional Pub/Sub settings.",
      },
    ],
    checklist: [
      "Google Chat app is published to intended users/spaces",
      "Incoming events arrive at your runtime",
      "Bot can send replies in threads",
    ],
    pitfalls: [
      "Invalid base64 JSON in GOOGLE_CHAT_CREDENTIALS",
      "Cloud IAM permissions missing for service account",
    ],
    links: [
      {
        label: "Chat SDK Google Chat",
        url: "https://chat-sdk.dev/adapters/google-chat",
      },
      {
        label: "Google Chat developer docs",
        url: "https://developers.google.com/workspace/chat",
      },
    ],
  },
  linear: {
    intro: "Create a Linear webhook and authorize API access for bot actions.",
    steps: [
      {
        title: "Open Linear webhook settings",
        description:
          "Create a webhook for your workspace and choose target events.",
      },
      {
        title: "Register webhook URL",
        description: "Set the webhook target URL to your runtime endpoint.",
        type: "webhook",
      },
      {
        title: "Copy webhook secret",
        description: "Save webhook secret and set LINEAR_WEBHOOK_SECRET.",
      },
      {
        title: "Add API auth",
        description:
          "Set LINEAR_API_KEY or LINEAR_ACCESS_TOKEN for follow-up API operations.",
      },
    ],
    checklist: [
      "Webhook delivery succeeds in Linear logs",
      "Bot can post comments or sessions based on LINEAR_MODE",
      "Workspace events map to expected automations",
    ],
    pitfalls: [
      "Using API key without required workspace permissions",
      "Forgetting to set LINEAR_MODE when expecting agent sessions",
    ],
    links: [
      {
        label: "Chat SDK Linear",
        url: "https://chat-sdk.dev/adapters/linear",
      },
      { label: "Linear webhooks", url: "https://linear.app/settings/webhooks" },
    ],
  },
  github: {
    intro:
      "Configure a GitHub webhook and choose PAT or GitHub App credentials.",
    steps: [
      {
        title: "Create webhook in repository or organization",
        description: "Choose event types your bot should react to.",
      },
      {
        title: "Set payload URL",
        description:
          "Paste your webhook URL and set the same webhook secret as env.",
        type: "webhook",
      },
      {
        title: "Choose authentication mode",
        description:
          "Use GITHUB_TOKEN (simple) or GitHub App credentials for production setups.",
      },
      {
        title: "Verify delivery",
        description:
          "Send a test ping and confirm signature verification passes.",
      },
    ],
    checklist: [
      "Webhook ping returns 2xx",
      "Expected issue/PR events appear in logs",
      "Bot actions succeed with configured auth mode",
    ],
    pitfalls: [
      "Secret mismatch between GitHub and .env",
      "Missing installation ID when using GitHub App mode",
    ],
    links: [
      {
        label: "Chat SDK GitHub",
        url: "https://chat-sdk.dev/adapters/github",
      },
      {
        label: "GitHub webhooks docs",
        url: "https://docs.github.com/en/webhooks/using-webhooks/creating-webhooks",
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
