import type { Config, Plugin } from "@docusaurus/types";
import type {
  Options as ClassicPresetOptions,
  ThemeConfig as ClassicThemeConfig
} from "@docusaurus/preset-classic";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { themes as prismThemes } from "prism-react-renderer";

const docsDir = path.dirname(fileURLToPath(import.meta.url));

const config: Config = {
  title: "Agent Runtime Inspector",
  tagline: "Local permission and audit for AI agents",
  url: "https://ari.umoren.xyz",
  baseUrl: "/",
  organizationName: "Umoren",
  projectName: "agent-runtime-inspector",
  trailingSlash: false,
  onBrokenLinks: "throw",
  favicon: "img/favicon.svg",
  markdown: {
    hooks: {
      onBrokenMarkdownLinks: "warn"
    }
  },

  i18n: {
    defaultLocale: "en",
    locales: ["en"]
  },

  presets: [
    [
      "classic",
      {
        docs: {
          sidebarPath: "./sidebars.ts",
          routeBasePath: "docs",
          editUrl: "https://github.com/Umoren/agent-runtime-inspector/edit/main/apps/docs/"
        },
        blog: false,
        theme: {
          customCss: "./src/css/custom.css"
        }
      } satisfies ClassicPresetOptions
    ]
  ],
  plugins: [weakResolveServerBundlePatch],

  themeConfig: {
    image: "img/ari-social-card.png",
    navbar: {
      title: "ARI",
      items: [
        {
          type: "docSidebar",
          sidebarId: "docsSidebar",
          position: "left",
          label: "Docs"
        },
        {
          to: "/docs/getting-started/install-ari",
          label: "Getting Started",
          position: "left"
        },
        {
          to: "/docs/articles",
          label: "Articles",
          position: "left"
        },
        {
          to: "/docs/getting-started/open-dashboard",
          label: "Dashboard",
          position: "left"
        },
        {
          href: "https://github.com/Umoren/agent-runtime-inspector",
          label: "GitHub",
          position: "right"
        }
      ]
    },
    footer: {
      style: "dark",
      links: [
        {
          title: "Docs",
          items: [
            {
              label: "What is ARI?",
              to: "/docs/overview/what-is-ari"
            },
            {
              label: "Getting Started",
              to: "/docs/getting-started/install-ari"
            },
            {
              label: "Trace Model",
              to: "/docs/how-it-works/trace-event-model"
            }
          ]
        },
        {
          title: "Project",
          items: [
            {
              label: "Articles",
              to: "/docs/articles"
            },
            {
              label: "GitHub",
              href: "https://github.com/Umoren/agent-runtime-inspector"
            }
          ]
        }
      ],
      copyright: `Copyright (c) ${new Date().getFullYear()} Agent Runtime Inspector.`
    },
    prism: {
      theme: prismThemes.github,
      darkTheme: prismThemes.dracula,
      additionalLanguages: ["bash", "json", "toml"]
    }
  } satisfies ClassicThemeConfig
};

function weakResolveServerBundlePatch(): Plugin {
  return {
    name: "ari-weak-resolve-server-bundle-patch",
    configureWebpack(_config, isServer, { currentBundler }) {
      const config = {
        module: {
          rules: [
            {
              test: /[\\/]\.docusaurus[\\/](client-modules|registry)\.js$/,
              type: "javascript/auto"
            }
          ]
        },
        plugins: []
      } satisfies NonNullable<ReturnType<NonNullable<Plugin["configureWebpack"]>>>;

      if (!isServer) {
        return config;
      }

      const emptyClientModulesPath = path.join(docsDir, "src/server/emptyClientModules.ts");

      config.plugins = [
        new currentBundler.instance.NormalModuleReplacementPlugin(
          /^@generated\/client-modules$/,
          emptyClientModulesPath
        ),
        new currentBundler.instance.BannerPlugin({
          raw: true,
          entryOnly: false,
          banner:
            "if (typeof require !== 'undefined' && typeof require.resolveWeak !== 'function') { require.resolveWeak = (id) => id; }"
        })
      ];

      return config;
    }
  };
}

export default config;
