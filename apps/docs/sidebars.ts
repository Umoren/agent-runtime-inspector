import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  docsSidebar: [
    {
      type: "category",
      label: "Overview",
      collapsed: false,
      items: [
        "overview/what-is-ari",
        "overview/why-provenance-for-agents",
        "overview/status-roadmap"
      ]
    },
    {
      type: "category",
      label: "Getting Started",
      collapsed: false,
      items: [
        "getting-started/install-ari",
        "getting-started/record-context-scope",
        "getting-started/open-dashboard",
        "getting-started/capture-workspace-run"
      ]
    },
    {
      type: "category",
      label: "Guides",
      collapsed: false,
      items: [
        "guides/connect-merge-agent-handler",
        "guides/use-mcp-proxy-mode",
        "guides/connect-codex",
        "guides/vercel-ai-sdk-example"
      ]
    },
    {
      type: "category",
      label: "How It Works",
      collapsed: false,
      items: [
        "how-it-works/trace-event-model",
        "how-it-works/context-path",
        "how-it-works/action-path",
        "how-it-works/model-path",
        "how-it-works/system-path",
        "how-it-works/authorization-provenance"
      ]
    },
    {
      type: "category",
      label: "Reference",
      collapsed: false,
      items: [
        "reference/cli-commands",
        "reference/environment-variables",
        "reference/deployment",
        "reference/trace-event-types",
        "reference/package-architecture"
      ]
    },
    {
      type: "category",
      label: "Articles",
      collapsed: false,
      items: [
        "articles/index",
        "articles/ai-integration-layer-new-backend/index",
        "articles/permission-aware-retrieval-enterprise-ai-agents/index"
      ]
    }
  ]
};

export default sidebars;
