"use client";
import { useState } from "react";
import { Download, ShieldCheck, CalendarDays } from "lucide-react";
import { browserClient } from "@/lib/supabase/client";
import { recordKinds, type FeatureProps } from "@/lib/records";
import { exportCalendar } from "@/lib/calendar-export";
import { loadAllRows } from "@/lib/pagination";
type Row = { id: string; kind: string; data: Record<string, unknown> };
export default function WorkspacePreferences(props: FeatureProps) {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  async function allRecords(): Promise<Row[]> {
    if (props.demo)
      return recordKinds.flatMap((kind) => {
        const saved = localStorage.getItem(`campushub-demo-records-${kind}-v1`);
        return saved
          ? (JSON.parse(saved) as Record<string, unknown>[]).map(
              ({ id, ...data }) => ({ id: String(id), kind, data }),
            )
          : [];
      });
    return loadAllRows(async (cursor) => {
      let query = browserClient()
        .from("workspace_records")
        .select("id,kind,data")
        .order("id")
        .limit(500);
      if (cursor) query = query.gt("id", cursor);
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    });
  }
  function download(content: string, type: string, name: string) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function exportData(calendar = false) {
    setBusy(true);
    setMessage("");
    try {
      const records = await allRecords();
      if (calendar) {
        download(
          exportCalendar(
            records
              .filter((row) => row.kind === "task")
              .map((row) => ({ ...row.data, id: row.id })),
            records
              .filter((row) => row.kind === "class")
              .map((row) => ({ ...row.data, id: row.id })),
            props.subjects,
          ),
          "text/calendar;charset=utf-8",
          "campushub-calendar.ics",
        );
        setMessage(
          "Calendar exported in India Standard Time. Import the file into your calendar app; this is a one-time export, not a live subscription.",
        );
      } else {
        download(
          JSON.stringify(
            {
              version: 2,
              exported_at: new Date().toISOString(),
              profile: props.profile,
              terms: props.terms,
              subjects: props.subjects,
              records: records.map((row) => {
                if (row.kind !== "resource") return row;
                const data = { ...row.data };
                delete data.data_url;
                return { ...row, data };
              }),
            },
            null,
            2,
          ),
          "application/json",
          "campushub-personal-export.json",
        );
        setMessage(
          "Your personal records were exported. File attachments must be downloaded separately from Study workspace.",
        );
      }
    } catch {
      setMessage(
        "Unable to export. Please check your connection and try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="feature-card preferences-card">
      <div className="feature-title">
        <ShieldCheck />
        <div>
          <h2>Privacy & portability</h2>
          <p>
            Your academic data stays personal even when you join a community.
          </p>
        </div>
      </div>
      <div className="feature-grid">
        <div>
          <h3>Take your records with you</h3>
          <p>
            Export your profile, terms, subjects and personal tools as JSON.
            Keep this file private. Shared community content and file
            attachments are excluded.
          </p>
          <div className="actions-row">
            <button
              className="secondary"
              disabled={busy}
              onClick={() => exportData()}
            >
              <Download size={16} />
              {busy ? "Preparing…" : "Export personal data"}
            </button>
            <button
              className="secondary"
              disabled={busy}
              onClick={() => exportData(true)}
            >
              <CalendarDays size={16} />
              Export calendar
            </button>
          </div>
        </div>
        <div>
          <h3>Install & offline access</h3>
          <p>
            Use your browser’s install option to add CampusHub to your device.
            An offline screen works without a connection. Signed-in pages and
            private files are never stored in the offline cache.
          </p>
          <p>
            English and Hindi navigation are available from the language
            selector. Academic content stays in the language you enter.
          </p>
        </div>
      </div>
      {message && (
        <p role="status" className="notice">
          {message}
        </p>
      )}
    </section>
  );
}
