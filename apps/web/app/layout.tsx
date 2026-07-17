import "./globals.css";
import { ArrowUpRight, BookOpen, Code2 } from "lucide-react";
import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Agent Runtime Inspector",
  description: "Inspect what happened during an AI agent run."
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <footer className="app-footer">
          <div className="app-footer-inner">
            <div className="footer-identity">
              <strong>ARI</strong>
              <span>Agent Runtime Inspector</span>
              <small>Built by <a href="https://umoren.xyz">Samuel Umoren</a></small>
            </div>
            <nav className="footer-links" aria-label="Project links">
              <span className="footer-runtime">Local runtime · SQLite</span>
              <a href="https://ari.umoren.xyz/docs/getting-started/install-ari">
                <BookOpen aria-hidden="true" size={15} />
                Docs
                <ArrowUpRight aria-hidden="true" size={13} />
              </a>
              <a href="https://github.com/Umoren/agent-runtime-inspector">
                <Code2 aria-hidden="true" size={15} />
                GitHub
                <ArrowUpRight aria-hidden="true" size={13} />
              </a>
            </nav>
          </div>
        </footer>
      </body>
    </html>
  );
}
