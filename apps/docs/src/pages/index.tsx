import Link from "@docusaurus/Link";
import Layout from "@theme/Layout";

const entryPoints = [
  {
    title: "Start locally",
    description: "Install ARI, start the collector and dashboard, then open the local inspection surface.",
    to: "/docs/getting-started/install-ari"
  },
  {
    title: "Connect an MCP agent",
    description: "Put ARI between an MCP-capable agent and an upstream server to enforce and record actions.",
    to: "/docs/guides/use-mcp-proxy-mode"
  },
  {
    title: "Understand the trace model",
    description: "See how context, authorization, action, model, and system events connect.",
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
      title="Local permission and audit for AI agents"
      description="Agent Runtime Inspector enforces context and action boundaries, then records the evidence locally."
    >
      <main>
        <section className="heroSurface">
          <div className="heroInner">
            <div className="heroKicker">Open source agent permission and audit</div>
            <h1 className="heroTitle">Agent Runtime Inspector</h1>
            <p className="heroCopy">
              ARI retrieves permitted context, checks proposed tool calls through policy, blocks denied
              actions, and records the decision path on your machine.
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
