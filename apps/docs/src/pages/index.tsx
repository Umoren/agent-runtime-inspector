import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

const entryPoints = [
  {
    title: "Start locally",
    description: "Install the workspace, run the local collector and dashboard, then inspect a first run.",
    to: "/docs/getting-started/install-ari"
  },
  {
    title: "Connect an MCP agent",
    description: "Put ARI between an MCP-capable agent and Merge Agent Handler to record the action path.",
    to: "/docs/guides/use-mcp-proxy-mode"
  },
  {
    title: "Understand the trace model",
    description: "Read the event paths that organize context, action, model, and system evidence.",
    to: "/docs/how-it-works/trace-event-model"
  },
  {
    title: "Read architecture articles",
    description: "Use the long-form articles for the larger architecture behind provenance and retrieval.",
    to: "/docs/articles"
  }
];

export default function Home(): JSX.Element {
  return (
    <Layout
      title="Provenance for local agent runtimes"
      description="Agent Runtime Inspector records the context, tools, model calls, and system events around an agent run."
    >
      <main>
        <section className="heroSurface">
          <div className="heroInner">
            <div className="heroKicker">Open source agent provenance</div>
            <h1 className="heroTitle">Agent Runtime Inspector</h1>
            <p className="heroCopy">
              ARI is a local provenance layer for agent runs. It records what context entered the run,
              which actions were available, what tools executed, and what evidence the dashboard can inspect.
            </p>
            <div className="heroActions">
              <Link className="buttonLink primary" to="/docs/getting-started/install-ari">
                Start locally
              </Link>
              <Link className="buttonLink secondary" to="/docs/how-it-works/trace-event-model">
                Trace model
              </Link>
            </div>
          </div>
        </section>

        <section className="homeBand">
          <div className="homeGrid">
            {entryPoints.map((entry) => (
              <Link className="homeCard" key={entry.title} to={entry.to}>
                <h2>{entry.title}</h2>
                <p>{entry.description}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </Layout>
  );
}
