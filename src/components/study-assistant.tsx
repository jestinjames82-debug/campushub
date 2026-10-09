"use client";
import { useState } from "react";
import { BookOpen, Sparkles } from "lucide-react";
import { useRecords, type FeatureProps } from "@/lib/records";
import { selectExcerpts, type StudySource } from "@/lib/ai-grounding";
type Note = { title: string; content?: string; body?: string };
export default function StudyAssistant({ demo, userId }: FeatureProps) {
  const notes = useRecords<Note>("note", demo, userId);
  const [selected, setSelected] = useState<string[]>([]),
    [question, setQuestion] = useState(""),
    [mode, setMode] = useState("explain"),
    [answer, setAnswer] = useState(""),
    [sources, setSources] = useState<StudySource[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [remaining, setRemaining] = useState<number | null>(null),
    [consent, setConsent] = useState(false);
  function review() {
    const chosen = notes.items
      .filter((n) => selected.includes(n.id))
      .map((n) => ({
        id: n.id,
        title: n.title,
        content: n.content || n.body || "",
      }));
    setSources(selectExcerpts(chosen, question));
    setAnswer("");
    setError("");
  }
  async function ask(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    setAnswer("");
    try {
      const response = await fetch("/api/study-assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, noteIds: selected, mode }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Unable to answer.");
      setAnswer(body.answer);
      setSources(body.sources);
      setRemaining(body.remaining);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unable to connect.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feature-grid">
      <article className="feature-card">
        <div className="feature-title">
          <Sparkles />
          <div>
            <h2>Study with your sources</h2>
            <p>Choose your notes. Ask a focused question.</p>
          </div>
        </div>
        <p className="notice">
          {demo
            ? "Demo: source review works locally. Generated AI answers require a connected account and AI provider."
            : "Only selected note excerpts are sent to the configured AI provider. Answers can contain mistakes; check each source."}
        </p>
        <form onSubmit={ask} className="feature-form">
          <fieldset>
            <legend>Notes to use (up to five)</legend>
            {notes.items.length ? (
              notes.items.map((note) => (
                <label className="check-row" key={note.id}>
                  <input
                    type="checkbox"
                    checked={selected.includes(note.id)}
                    disabled={
                      !selected.includes(note.id) && selected.length >= 5
                    }
                    onChange={(e) =>
                      setSelected(
                        e.target.checked
                          ? [...selected, note.id]
                          : selected.filter((id) => id !== note.id),
                      )
                    }
                  />
                  {note.title}
                </label>
              ))
            ) : (
              <p>Add a note in Study workspace to get started.</p>
            )}
          </fieldset>
          <label>
            What would you like to understand?
            <textarea
              required
              minLength={3}
              maxLength={2000}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="Explain the key ideas in these notes…"
            />
          </label>
          <label>
            Study mode
            <select value={mode} onChange={(e) => setMode(e.target.value)}>
              <option value="explain">Explain with sources</option>
              <option value="quiz">Practice quiz</option>
              <option value="plan">Revision suggestions</option>
            </select>
          </label>
          <label className="check-row">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
            />
            Send selected excerpts and my question to the AI provider for this
            request.
          </label>
          <div className="actions-row">
            <button
              type="button"
              className="secondary"
              disabled={!selected.length}
              onClick={review}
            >
              <BookOpen size={16} />
              Review sources
            </button>
            <button disabled={demo || busy || !selected.length || !consent}>
              {busy ? "Reading your sources…" : "Ask study assistant"}
            </button>
          </div>
        </form>
        {(error || notes.error) && (
          <p role="alert" className="notice error">
            {error || notes.error}
          </p>
        )}
        <small>
          Limit: 20 attempts per student per India calendar day; up to 1,000
          output tokens each.{" "}
          {remaining !== null ? `${remaining} attempts remaining.` : ""} AI
          responses are not saved by CampusHub.
        </small>
      </article>
      <article className="feature-card">
        <h2>{answer ? "Your study response" : "Source notebook"}</h2>
        {answer && (
          <div className="plain-text answer" role="status">
            {answer}
          </div>
        )}
        {sources.length ? (
          sources.map((source, i) => (
            <section className="source-excerpt" key={source.id}>
              <h3>
                [{i + 1}] {source.title}
              </h3>
              {source.content && <p className="plain-text">{source.content}</p>}
            </section>
          ))
        ) : (
          <div className="empty">
            <BookOpen />
            <h3>Keep the evidence in view.</h3>
            <p>
              Review matching excerpts or ask a question about your selected
              notes.
            </p>
          </div>
        )}
      </article>
    </section>
  );
}
