import { useEffect, useRef, useState } from "react";
import { ArrowRight, X } from "lucide-react";
import type { RichDocument } from "../types";

const templates = [
  { name: "Empty page", description: "Start from scratch", content: [paragraph("")] },
  { name: "Meeting notes", description: "Date, attendees, action items", content: [heading("Meeting notes"), heading("Attendees", 2), paragraph(""), heading("Notes", 2), paragraph("")] },
  { name: "Runbook", description: "Step-by-step procedure", content: [heading("Purpose", 2), paragraph(""), heading("Procedure", 2), paragraph("")] },
  { name: "Decision record", description: "ADR format with context", content: [heading("Context", 2), paragraph(""), heading("Decision", 2), paragraph("")] },
  { name: "API reference", description: "Endpoints and examples", content: [heading("Overview", 2), paragraph(""), heading("Endpoints", 2), paragraph("")] },
  { name: "Onboarding guide", description: "New hire checklist", content: [heading("Welcome", 2), paragraph(""), heading("First week", 2), paragraph("")] },
];

export function NewPage({ parentTitle, onCancel, onCreate }: { parentTitle?: string; onCancel: () => void; onCreate: (title: string, content: RichDocument) => Promise<void> }) {
  const [title, setTitle] = useState("");
  const [template, setTemplate] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => titleRef.current?.focus(), []);

  async function create() {
    if (!title.trim()) return;
    setPending(true);
    setError("");
    try {
      await onCreate(title.trim(), { type: "doc", content: templates[template].content });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not create page");
      setPending(false);
    }
  }

  return (
    <section className="page-surface new-page">
      <div className="page-actions">
        <button className="secondary" onClick={onCancel}><X size={13} />Cancel</button>
        <button className="primary" disabled={!title.trim() || pending} onClick={create}><ArrowRight size={13} />{pending ? "Creating…" : "Create page"}</button>
      </div>
      <div className="article-width">
        <input ref={titleRef} className="page-title-input" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Untitled" onKeyDown={(event) => { if (event.key === "Enter") void create(); }} />
        <p className="new-page-subtitle">{parentTitle ? `Creating inside ${parentTitle}` : "Start writing, or pick a template below"}</p>
        <p className="template-label">Templates</p>
        <div className="template-grid">
          {templates.map((item, index) => (
            <button key={item.name} className={template === index ? "active" : ""} onClick={() => setTemplate(index)}>
              <strong>{item.name}</strong><span>{item.description}</span>
            </button>
          ))}
        </div>
        {error && <p className="form-error" role="alert">{error}</p>}
      </div>
    </section>
  );
}

function paragraph(text: string) { return { type: "paragraph", content: text ? [{ type: "text", text }] : undefined }; }
function heading(text: string, level = 1) { return { type: "heading", attrs: { level }, content: [{ type: "text", text }] }; }
