import { useParams, Link, Navigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const DOCS = {
  report: { title: "Relatório Executivo FXKONTROL 2", file: "/docs/internal/report.html" },
  plg: { title: "Matriz PLG — Paywalls e Camadas", file: "/docs/internal/plg.html" },
  roadmap: { title: "Roadmap 12 Meses + KPIs", file: "/docs/internal/roadmap.html" },
  safety: { title: "Checklist Safety & Compliance", file: "/docs/internal/safety.html" },
} as const;

type Slug = keyof typeof DOCS;

export default function InternalDocs() {
  const { slug } = useParams<{ slug?: string }>();

  if (!slug) {
    return (
      <div className="container mx-auto p-6">
        <h1 className="text-ds-h2 mb-4">Documentação Interna</h1>
        <p className="text-sm text-muted-foreground mb-6">
          Documentos estratégicos consolidados (síntese executiva, paywalls,
          roadmap, safety). Atualize via repositório quando publicar nova
          versão.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {Object.entries(DOCS).map(([key, doc]) => (
            <Link
              key={key}
              to={`/docs/internal/${key}`}
              className="ds-interactive rounded-lg border border-border bg-card p-4 hover:bg-muted/40"
            >
              <div className="text-sm font-medium text-foreground">{doc.title}</div>
              <div className="mt-1 text-xs text-muted-foreground ds-mono uppercase">{key}.html</div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  const doc = DOCS[slug as Slug];
  if (!doc) return <Navigate to="/docs/internal" replace />;

  return (
    <div className="flex h-[calc(100dvh-3rem)] flex-col">
      <div className="flex items-center gap-2 border-b border-border bg-background px-4 py-2">
        <Link to="/docs/internal" className="ds-interactive inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" /> Docs
        </Link>
        <span className="text-xs text-muted-foreground">/</span>
        <span className="text-sm font-medium">{doc.title}</span>
      </div>
      <iframe
        src={doc.file}
        title={doc.title}
        sandbox="allow-same-origin allow-popups"
        className="h-full w-full flex-1 border-0 bg-white"
      />
    </div>
  );
}
