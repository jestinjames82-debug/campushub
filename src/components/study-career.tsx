"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import {
  BookOpen,
  FileText,
  Briefcase,
  CheckCircle2,
  Download,
  Plus,
  Search,
  Link as LinkIcon,
  Pencil,
  Trash2,
} from "lucide-react";
import { useRecords, type FeatureProps } from "@/lib/records";
import { browserClient } from "@/lib/supabase/client";
import {
  deadlineState,
  localDate,
  resourceUrl,
  safeFileName,
  validateResourceContent,
} from "@/lib/resources";
import PortfolioSharing from "@/components/portfolio-sharing";

type Note = { title: string; body: string; subject_id: string; tags: string[] };
type Resource = {
  title: string;
  subject_id: string;
  description: string;
  url: string;
  file_path: string;
  file_name: string;
  file_type: string;
  data_url: string;
};
type Revision = {
  title: string;
  subject_id: string;
  due_on: string;
  completed: boolean;
};
type Application = {
  title: string;
  company: string;
  url: string;
  deadline: string;
  status: string;
  interview_on: string;
  notes: string;
};
type Portfolio = {
  name: string;
  headline: string;
  email: string;
  phone: string;
  summary: string;
  skills: string;
  education: string;
  projects: string;
  links: string;
};
type PrepTask = { title: string; completed: boolean };
type Saved<T> = T & { id: string };
const NOTE_SEED: Note[] = [
  {
    title: "A clearer way to think about normalisation",
    body: "Normalisation organises a relational database to reduce duplicated data.\n\n1NF: each cell holds an atomic value.\n2NF: remove partial dependencies on a composite key.\n3NF: remove transitive dependencies.\n\nRevision prompt: sketch a students-and-courses example, then explain why the enrolments table is separate.",
    subject_id: "b0000000-0000-4000-8000-000000000001",
    tags: ["databases", "revision"],
  },
];
const REVISION_SEED: Revision[] = [
  {
    title: "Review database normalisation with two worked examples",
    subject_id: "b0000000-0000-4000-8000-000000000001",
    due_on: "2026-10-12",
    completed: false,
  },
];
const PREP_SEED: PrepTask[] = [
  {
    title: "Write a one-page resume with two project outcomes",
    completed: false,
  },
  { title: "Practise explaining a project in two minutes", completed: false },
  {
    title: "Complete a mock interview and record the feedback",
    completed: false,
  },
];

function safeLink(url: string) {
  try {
    return resourceUrl(url);
  } catch {
    return undefined;
  }
}
function field(form: FormData, name: string) {
  return String(form.get(name) || "").trim();
}
function message(error: unknown) {
  return error instanceof Error
    ? error.message
    : typeof error === "object" && error && "message" in error
      ? String(error.message)
      : "Could not save this change. Please try again.";
}
function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="empty">
      <BookOpen size={25} />
      <p>{children}</p>
    </div>
  );
}
function Feedback({ error, notice }: { error: string; notice: string }) {
  return (
    <>
      {error && (
        <div className="notice error" role="alert">
          {error}
        </div>
      )}
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
    </>
  );
}
function useFeedback() {
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(success);
    } catch (error) {
      setError(message(error));
    } finally {
      setBusy(false);
    }
  }
  return { error, notice, busy, run };
}
function SubjectSelect({
  subjects,
  value = "",
}: {
  subjects: FeatureProps["subjects"];
  value?: string;
}) {
  return (
    <label>
      Subject folder
      <select name="subject_id" defaultValue={value}>
        <option value="">General</option>
        {subjects.map((subject) => (
          <option key={subject.id} value={subject.id}>
            {subject.name}
          </option>
        ))}
      </select>
    </label>
  );
}
function StudyWorkspace({ demo, userId, subjects }: FeatureProps) {
  const notes = useRecords<Note>("note", demo, userId, NOTE_SEED);
  const resources = useRecords<Resource>("resource", demo, userId);
  const revisions = useRecords<Revision>(
    "revision",
    demo,
    userId,
    REVISION_SEED,
  );
  const feedback = useFeedback();
  const [tab, setTab] = useState("notes");
  const [query, setQuery] = useState("");
  const [folder, setFolder] = useState("");
  const [noteEditor, setNoteEditor] = useState<Saved<Note> | "new" | null>(
    null,
  );
  const [resourceEditor, setResourceEditor] = useState<
    Saved<Resource> | "new" | null
  >(null);
  const [revisionEditor, setRevisionEditor] = useState<
    Saved<Revision> | "new" | null
  >(null);
  const [resourceKind, setResourceKind] = useState("link");
  const [download, setDownload] = useState<{
    id: string;
    url: string;
    expires: number;
  } | null>(null);
  const subjectName = (id: string) =>
    subjects.find((subject) => subject.id === id)?.name ||
    (id ? "Archived subject" : "General");
  const matches = (subject: string, text: string) =>
    (!folder || subject === folder) &&
    text.toLowerCase().includes(query.toLowerCase());
  const shownNotes = notes.items.filter((note) =>
    matches(
      note.subject_id,
      `${note.title} ${note.body} ${note.tags.join(" ")}`,
    ),
  );
  const shownResources = resources.items.filter((resource) =>
    matches(resource.subject_id, `${resource.title} ${resource.description}`),
  );
  const shownRevisions = revisions.items
    .filter((revision) => matches(revision.subject_id, revision.title))
    .toSorted(
      (a, b) =>
        Number(a.completed) - Number(b.completed) ||
        a.due_on.localeCompare(b.due_on),
    );
  const currentNote = typeof noteEditor === "object" ? noteEditor : null;
  const currentResource =
    typeof resourceEditor === "object" ? resourceEditor : null;
  const currentRevision =
    typeof revisionEditor === "object" ? revisionEditor : null;
  async function saveNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await feedback.run(async () => {
      await notes.save(
        {
          title: field(form, "title"),
          body: field(form, "body"),
          subject_id: field(form, "subject_id"),
          tags: [
            ...new Set(
              field(form, "tags")
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean),
            ),
          ].slice(0, 10),
        },
        currentNote?.id,
      );
      setNoteEditor(null);
    }, "Note saved to your study workspace.");
  }
  async function saveResource(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await feedback.run(async () => {
      const item: Resource = {
        title: field(form, "title"),
        subject_id: field(form, "subject_id"),
        description: field(form, "description"),
        url: "",
        file_path: currentResource?.file_path || "",
        file_name: currentResource?.file_name || "",
        file_type: currentResource?.file_type || "",
        data_url: currentResource?.data_url || "",
      };
      let uploadedPath = "";
      if (resourceKind === "link") item.url = resourceUrl(field(form, "url"));
      else if (!currentResource?.file_name) {
        const file = form.get("file");
        if (!(file instanceof File))
          throw new Error("Choose a PDF or plain text file.");
        item.file_type = await validateResourceContent(file, demo);
        item.file_name = safeFileName(file.name);
        if (demo) {
          item.data_url = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result));
            reader.onerror = () =>
              reject(new Error("Could not read this file."));
            reader.readAsDataURL(file);
          });
        } else {
          item.file_path = `${userId}/${crypto.randomUUID()}/${item.file_name}`;
          const result = await browserClient()
            .storage.from("study-resources")
            .upload(item.file_path, file, {
              contentType: item.file_type,
              upsert: false,
            });
          if (result.error) throw new Error(result.error.message);
          uploadedPath = item.file_path;
        }
      }
      try {
        await resources.save(item, currentResource?.id);
      } catch (error) {
        if (uploadedPath) {
          const cleanup = await browserClient()
            .storage.from("study-resources")
            .remove([uploadedPath]);
          if (cleanup.error)
            throw new Error(
              `${message(error)} The file uploaded but its record could not be saved or cleaned up. Retry later or remove ${uploadedPath} from your private storage.`,
            );
        }
        throw error;
      }
      setResourceEditor(null);
    }, "Resource saved to your private library.");
  }
  async function removeResource(resource: Saved<Resource>) {
    if (
      !window.confirm(
        `Delete “${resource.title}”${resource.file_name ? " and its uploaded file" : ""}?`,
      )
    )
      return;
    await feedback.run(async () => {
      if (resource.file_path && !demo) {
        const result = await browserClient()
          .storage.from("study-resources")
          .remove([resource.file_path]);
        if (result.error) throw new Error(result.error.message);
      }
      await resources.remove(resource.id);
      if (download?.id === resource.id) setDownload(null);
    }, "Resource deleted.");
  }
  async function downloadResource(resource: Saved<Resource>) {
    await feedback.run(
      async () => {
        if (demo) {
          if (
            !/^data:(text\/plain|application\/pdf)(;[^,]*)?,/.test(
              resource.data_url,
            )
          )
            throw new Error(
              "This demo file is unavailable. Please upload it again.",
            );
          const link = document.createElement("a");
          link.href = resource.data_url;
          link.download = resource.file_name;
          link.click();
        } else {
          const result = await browserClient()
            .storage.from("study-resources")
            .createSignedUrl(resource.file_path, 60, {
              download: resource.file_name,
            });
          if (result.error) throw new Error(result.error.message);
          setDownload({
            id: resource.id,
            url: result.data.signedUrl,
            expires: Date.now() + 60000,
          });
        }
      },
      demo
        ? "Your file is ready to save."
        : "Your private download link is ready below. It expires in one minute.",
    );
  }
  async function saveRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await feedback.run(async () => {
      await revisions.save(
        {
          title: field(form, "title"),
          subject_id: field(form, "subject_id"),
          due_on: field(form, "due_on"),
          completed: currentRevision?.completed || false,
        },
        currentRevision?.id,
      );
      setRevisionEditor(null);
    }, "Revision goal saved.");
  }
  if (notes.loading || resources.loading || revisions.loading)
    return <p role="status">Opening your study workspace…</p>;
  return (
    <>
      <Feedback
        error={
          feedback.error || notes.error || resources.error || revisions.error
        }
        notice={feedback.notice}
      />
      <div className="metric-grid">
        <div className="metric">
          <BookOpen size={19} />
          <strong>{notes.items.length}</strong>
          <span>Notes worth keeping</span>
        </div>
        <div className="metric">
          <FileText size={19} />
          <strong>{resources.items.length}</strong>
          <span>Saved resources</span>
        </div>
        <div className="metric">
          <CheckCircle2 size={19} />
          <strong>
            {revisions.items.filter((item) => item.completed).length}/
            {revisions.items.length}
          </strong>
          <span>Revision goals complete</span>
        </div>
      </div>
      <div className="feature-tabs" aria-label="Study sections">
        {[
          ["notes", "My notes"],
          ["resources", "Resource library"],
          ["revision", "Revision plan"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "active" : "secondary"}
            aria-pressed={tab === value}
            onClick={() => {
              setTab(value);
              setNoteEditor(null);
              setResourceEditor(null);
              setRevisionEditor(null);
            }}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="feature-form" style={{ marginBottom: 20 }}>
        <label>
          <span>
            <Search size={14} /> Search your study workspace
          </span>
          <input
            type="search"
            placeholder="Find a note, resource or tag"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label>
          Browse by subject
          <select
            value={folder}
            onChange={(event) => setFolder(event.target.value)}
          >
            <option value="">All subject folders</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {tab === "notes" && (
        <>
          <div className="actions">
            <h2>Your ideas, organised.</h2>
            <button onClick={() => setNoteEditor("new")}>
              <Plus size={16} /> New note
            </button>
          </div>
          {noteEditor && (
            <section className="feature-card">
              <h3>{currentNote ? "Edit note" : "Create a note"}</h3>
              <form
                className="feature-form"
                onSubmit={saveNote}
                key={currentNote?.id || "new-note"}
              >
                <label>
                  Note title
                  <input
                    name="title"
                    required
                    maxLength={120}
                    defaultValue={currentNote?.title}
                  />
                </label>
                <SubjectSelect
                  subjects={subjects}
                  value={currentNote?.subject_id || folder}
                />
                <label>
                  Tags, separated by commas
                  <input
                    name="tags"
                    maxLength={250}
                    placeholder="revision, important, chapter 2"
                    defaultValue={currentNote?.tags.join(", ")}
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  Note content
                  <textarea
                    name="body"
                    required
                    rows={9}
                    maxLength={12000}
                    defaultValue={currentNote?.body}
                  />
                </label>
                <div className="actions">
                  <button disabled={feedback.busy}>Save note</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setNoteEditor(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}
          <div className="feature-grid">
            {shownNotes.map((note) => (
              <article className="feature-card" key={note.id}>
                <span className="eyebrow">{subjectName(note.subject_id)}</span>
                <h3>{note.title}</h3>
                <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                  {note.body}
                </p>
                <p className="muted">
                  {note.tags.map((tag) => `#${tag}`).join("  ")}
                </p>
                <div className="actions">
                  <button
                    className="secondary"
                    aria-label={`Edit note ${note.title}`}
                    onClick={() => setNoteEditor(note)}
                  >
                    <Pencil size={14} /> Edit
                  </button>
                  <button
                    className="text-button"
                    disabled={feedback.busy}
                    aria-label={`Delete note ${note.title}`}
                    onClick={() => {
                      if (window.confirm(`Delete “${note.title}”?`))
                        void feedback.run(
                          () => notes.remove(note.id),
                          "Note deleted.",
                        );
                    }}
                  >
                    <Trash2 size={14} /> Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!shownNotes.length && (
            <Empty>
              {notes.items.length
                ? "No notes match this search."
                : "Save your first idea, lecture summary or revision note."}
            </Empty>
          )}
        </>
      )}
      {tab === "resources" && (
        <>
          <div className="actions">
            <h2>A home for useful material.</h2>
            <button
              onClick={() => {
                setResourceKind("link");
                setResourceEditor("new");
              }}
            >
              <Plus size={16} /> Add resource
            </button>
          </div>
          <p className="muted">
            Save a source link or a private PDF / text file.{" "}
            {demo
              ? "Demo uploads stay in this browser; maximum 1 MB per file."
              : "Uploads are private to your account; maximum 5 MB per file."}
          </p>
          {resourceEditor && (
            <section className="feature-card">
              <h3>{currentResource ? "Edit resource" : "Add a resource"}</h3>
              <form
                className="feature-form"
                key={currentResource?.id || "new-resource"}
                onSubmit={saveResource}
              >
                <label>
                  Resource title
                  <input
                    name="title"
                    required
                    maxLength={120}
                    defaultValue={currentResource?.title}
                  />
                </label>
                <SubjectSelect
                  subjects={subjects}
                  value={currentResource?.subject_id || folder}
                />
                <label>
                  Resource type
                  <select
                    value={resourceKind}
                    disabled={Boolean(currentResource)}
                    onChange={(event) => setResourceKind(event.target.value)}
                  >
                    <option value="link">Website link</option>
                    <option value="file">Upload a file</option>
                  </select>
                </label>
                {resourceKind === "link" ? (
                  <label>
                    Source URL
                    <input
                      name="url"
                      type="url"
                      required
                      maxLength={2048}
                      placeholder="https://example.edu/resource"
                      defaultValue={currentResource?.url}
                    />
                  </label>
                ) : currentResource?.file_name ? (
                  <p>Attached file: {currentResource.file_name}</p>
                ) : (
                  <label>
                    PDF or text file
                    <input
                      name="file"
                      type="file"
                      required
                      accept=".pdf,.txt,application/pdf,text/plain"
                    />
                  </label>
                )}
                <label style={{ gridColumn: "1 / -1" }}>
                  What is this useful for?
                  <textarea
                    name="description"
                    maxLength={1000}
                    rows={3}
                    defaultValue={currentResource?.description}
                  />
                </label>
                <div className="actions">
                  <button disabled={feedback.busy}>
                    {feedback.busy ? "Saving…" : "Save resource"}
                  </button>
                  <button
                    className="secondary"
                    type="button"
                    onClick={() => setResourceEditor(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}
          <div className="feature-grid">
            {shownResources.map((resource) => (
              <article className="feature-card" key={resource.id}>
                <span className="eyebrow">
                  {subjectName(resource.subject_id)}
                </span>
                <h3>{resource.title}</h3>
                <p>{resource.description}</p>
                {resource.file_name && (
                  <p className="muted">
                    <FileText size={14} /> {resource.file_name}
                  </p>
                )}
                <div className="actions">
                  {resource.url ? (
                    <a
                      className="button secondary"
                      href={safeLink(resource.url)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <LinkIcon size={14} /> Open source
                    </a>
                  ) : (
                    <button
                      className="secondary"
                      disabled={feedback.busy}
                      onClick={() => void downloadResource(resource)}
                    >
                      <Download size={14} />{" "}
                      {demo ? "Download file" : "Prepare download"}
                    </button>
                  )}
                  <button
                    className="text-button"
                    onClick={() => {
                      setResourceKind(resource.url ? "link" : "file");
                      setResourceEditor(resource);
                    }}
                  >
                    Edit
                  </button>
                  <button
                    className="text-button"
                    disabled={feedback.busy}
                    onClick={() => void removeResource(resource)}
                    aria-label={`Delete resource ${resource.title}`}
                  >
                    Delete
                  </button>
                </div>
                {download?.id === resource.id && (
                  <a
                    href={download.url}
                    rel="noopener noreferrer"
                    target="_blank"
                    onClick={(event) => {
                      if (Date.now() >= download.expires) {
                        event.preventDefault();
                        void downloadResource(resource);
                      }
                    }}
                  >
                    Download ready · link valid for 1 minute
                  </a>
                )}
              </article>
            ))}
          </div>
          {!shownResources.length && (
            <Empty>
              {resources.items.length
                ? "No resources match this search."
                : "Add a trusted source or upload your first study resource."}
            </Empty>
          )}
        </>
      )}
      {tab === "revision" && (
        <>
          <div className="actions">
            <h2>Little steps. Lasting understanding.</h2>
            <button onClick={() => setRevisionEditor("new")}>
              <Plus size={16} /> Add revision goal
            </button>
          </div>
          {revisionEditor && (
            <section className="feature-card">
              <h3>
                {currentRevision
                  ? "Edit revision goal"
                  : "Plan a revision goal"}
              </h3>
              <form
                className="feature-form"
                key={currentRevision?.id || "new-goal"}
                onSubmit={saveRevision}
              >
                <label>
                  Revision goal
                  <input
                    name="title"
                    required
                    maxLength={200}
                    defaultValue={currentRevision?.title}
                  />
                </label>
                <SubjectSelect
                  subjects={subjects}
                  value={currentRevision?.subject_id || folder}
                />
                <label>
                  Target date
                  <input
                    name="due_on"
                    type="date"
                    required
                    defaultValue={currentRevision?.due_on || localDate()}
                  />
                </label>
                <div className="actions">
                  <button disabled={feedback.busy}>Save goal</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setRevisionEditor(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}
          <div className="item-list">
            {shownRevisions.map((goal) => (
              <article className="item-row" key={goal.id}>
                <div>
                  <span className="eyebrow">
                    {subjectName(goal.subject_id)}
                  </span>
                  <h3
                    style={{
                      textDecoration: goal.completed
                        ? "line-through"
                        : undefined,
                    }}
                  >
                    {goal.title}
                  </h3>
                  <p className="muted">
                    Target: {goal.due_on}
                    {!goal.completed && goal.due_on < localDate()
                      ? " · Overdue"
                      : ""}
                  </p>
                </div>
                <div className="actions">
                  <button
                    className="secondary"
                    disabled={feedback.busy}
                    aria-pressed={goal.completed}
                    onClick={() =>
                      void feedback.run(
                        () =>
                          revisions.save(
                            { ...goal, completed: !goal.completed },
                            goal.id,
                          ),
                        goal.completed
                          ? "Goal reopened."
                          : "Revision goal completed. Keep going!",
                      )
                    }
                  >
                    {goal.completed ? "Reopen" : "Mark complete"}
                  </button>
                  <button
                    className="text-button"
                    onClick={() => setRevisionEditor(goal)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-button"
                    disabled={feedback.busy}
                    onClick={() => {
                      if (window.confirm(`Delete “${goal.title}”?`))
                        void feedback.run(
                          () => revisions.remove(goal.id),
                          "Revision goal deleted.",
                        );
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!shownRevisions.length && (
            <Empty>Add one manageable goal for your next study session.</Empty>
          )}
        </>
      )}
    </>
  );
}

const APP_STATUSES = [
  "Saved",
  "Applied",
  "Interview",
  "Offer",
  "Rejected",
  "Withdrawn",
];
function CareerWorkspace({ demo, userId, profile }: FeatureProps) {
  const applications = useRecords<Application>("application", demo, userId);
  const portfolios = useRecords<Portfolio>("portfolio", demo, userId);
  const tasks = useRecords<PrepTask>("career_task", demo, userId, PREP_SEED);
  const feedback = useFeedback();
  const [tab, setTab] = useState("applications");
  const [editor, setEditor] = useState<Saved<Application> | "new" | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const current = typeof editor === "object" ? editor : null;
  const portfolio = portfolios.items[0];
  const filtered = applications.items.filter(
    (item) =>
      (!status || item.status === status) &&
      `${item.company} ${item.title}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  async function saveApplication(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await feedback.run(async () => {
      const url = field(form, "url");
      await applications.save(
        {
          title: field(form, "title"),
          company: field(form, "company"),
          url: url ? resourceUrl(url) : "",
          deadline: field(form, "deadline"),
          status: field(form, "status"),
          interview_on: field(form, "interview_on"),
          notes: field(form, "notes"),
        },
        current?.id,
      );
      setEditor(null);
    }, "Application saved.");
  }
  async function savePortfolio(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await feedback.run(async () => {
      const links = field(form, "links")
        .split("\n")
        .map((link) => link.trim())
        .filter(Boolean)
        .map(resourceUrl)
        .join("\n");
      await portfolios.save(
        {
          name: field(form, "name"),
          headline: field(form, "headline"),
          email: field(form, "email"),
          phone: field(form, "phone"),
          summary: field(form, "summary"),
          skills: field(form, "skills"),
          education: field(form, "education"),
          projects: field(form, "projects"),
          links,
        },
        portfolio?.id,
      );
    }, "Portfolio saved. Your resume preview is ready to print or save as PDF.");
  }
  async function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const title = field(new FormData(element), "title");
    await feedback.run(async () => {
      await tasks.save({ title, completed: false });
      element.reset();
    }, "Preparation task added.");
  }
  if (applications.loading || portfolios.loading || tasks.loading)
    return <p role="status">Opening your career workspace…</p>;
  return (
    <>
      <Feedback
        error={
          feedback.error ||
          applications.error ||
          portfolios.error ||
          tasks.error
        }
        notice={feedback.notice}
      />
      <div className="metric-grid">
        <div className="metric">
          <Briefcase size={19} />
          <strong>
            {
              applications.items.filter((item) =>
                ["Applied", "Interview"].includes(item.status),
              ).length
            }
          </strong>
          <span>Applications in progress</span>
        </div>
        <div className="metric">
          <CheckCircle2 size={19} />
          <strong>
            {
              applications.items.filter((item) => item.status === "Offer")
                .length
            }
          </strong>
          <span>Offers received</span>
        </div>
        <div className="metric">
          <FileText size={19} />
          <strong>
            {tasks.items.filter((item) => item.completed).length}/
            {tasks.items.length}
          </strong>
          <span>Preparation tasks complete</span>
        </div>
      </div>
      <div className="feature-tabs" aria-label="Career sections">
        {[
          ["applications", "Applications"],
          ["portfolio", "Portfolio & resume"],
          ["preparation", "Preparation"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "active" : "secondary"}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "applications" && (
        <>
          <div className="actions">
            <h2>Make your next move count.</h2>
            <button onClick={() => setEditor("new")}>
              <Plus size={16} /> Add opportunity
            </button>
          </div>
          <p className="muted">
            Track internships and placements you find. Entries are saved by you;
            always check the original source for eligibility and current
            deadlines.
          </p>
          <div className="feature-form" style={{ marginBottom: 20 }}>
            <label>
              Search applications
              <input
                type="search"
                placeholder="Role or organisation"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <label>
              Filter status
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value)}
              >
                <option value="">All statuses</option>
                {APP_STATUSES.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
            </label>
          </div>
          {editor && (
            <section className="feature-card">
              <h3>{current ? "Edit application" : "Save an opportunity"}</h3>
              <form
                key={current?.id || "new-application"}
                className="feature-form"
                onSubmit={saveApplication}
              >
                <label>
                  Role or opportunity
                  <input
                    name="title"
                    required
                    maxLength={120}
                    defaultValue={current?.title}
                  />
                </label>
                <label>
                  Organisation
                  <input
                    name="company"
                    required
                    maxLength={120}
                    defaultValue={current?.company}
                  />
                </label>
                <label>
                  Original source URL
                  <input
                    name="url"
                    type="url"
                    maxLength={2048}
                    placeholder="https://company.com/careers"
                    defaultValue={current?.url}
                  />
                </label>
                <label>
                  Application deadline
                  <input
                    name="deadline"
                    type="date"
                    defaultValue={current?.deadline}
                  />
                </label>
                <label>
                  Application status
                  <select
                    name="status"
                    defaultValue={current?.status || "Saved"}
                  >
                    {APP_STATUSES.map((item) => (
                      <option key={item}>{item}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Interview date and time (your local time)
                  <input
                    name="interview_on"
                    type="datetime-local"
                    defaultValue={current?.interview_on}
                  />
                </label>
                <label style={{ gridColumn: "1 / -1" }}>
                  Interview notes and next steps
                  <textarea
                    name="notes"
                    rows={4}
                    maxLength={5000}
                    defaultValue={current?.notes}
                  />
                </label>
                <div className="actions">
                  <button disabled={feedback.busy}>Save application</button>
                  <button
                    type="button"
                    className="secondary"
                    onClick={() => setEditor(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </section>
          )}
          <div className="feature-grid">
            {filtered.map((item) => (
              <article className="feature-card" key={item.id}>
                <span className="eyebrow">
                  {item.status} · {item.company}
                </span>
                <h3>{item.title}</h3>
                <p className="muted">
                  {deadlineState(item.deadline, localDate())}
                  {item.deadline ? ` · ${item.deadline}` : ""}
                </p>
                {item.interview_on && (
                  <p>
                    Interview:{" "}
                    {new Date(item.interview_on).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                )}
                {item.notes && (
                  <p
                    style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}
                  >
                    {item.notes}
                  </p>
                )}
                <div className="actions">
                  {item.url && (
                    <a
                      className="button secondary"
                      href={safeLink(item.url)}
                      rel="noopener noreferrer"
                      target="_blank"
                    >
                      View original source
                    </a>
                  )}
                  <button
                    className="text-button"
                    aria-label={`Edit application ${item.title}`}
                    onClick={() => setEditor(item)}
                  >
                    Edit
                  </button>
                  <button
                    className="text-button"
                    disabled={feedback.busy}
                    aria-label={`Delete application ${item.title}`}
                    onClick={() => {
                      if (
                        window.confirm(`Delete the ${item.title} application?`)
                      )
                        void feedback.run(
                          () => applications.remove(item.id),
                          "Application deleted.",
                        );
                    }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
          {!filtered.length && (
            <Empty>
              {applications.items.length
                ? "No applications match this filter."
                : "Start with an opportunity you want to apply for. Your journey stays private."}
            </Empty>
          )}
        </>
      )}
      {tab === "preparation" && (
        <>
          <h2>Prepare a little, every week.</h2>
          <form className="feature-form feature-card" onSubmit={saveTask}>
            <label>
              New preparation task
              <input
                name="title"
                required
                maxLength={200}
                placeholder="Practise five SQL interview questions"
              />
            </label>
            <button disabled={feedback.busy}>
              <Plus size={16} /> Add task
            </button>
          </form>
          <div className="item-list">
            {tasks.items.map((task) => (
              <div className="item-row" key={task.id}>
                <label
                  style={{ display: "flex", alignItems: "center", gap: 12 }}
                >
                  <input
                    style={{ width: 18, height: 18 }}
                    type="checkbox"
                    checked={task.completed}
                    disabled={feedback.busy}
                    onChange={() =>
                      void feedback.run(
                        () =>
                          tasks.save(
                            { title: task.title, completed: !task.completed },
                            task.id,
                          ),
                        task.completed ? "Task reopened." : "Task completed.",
                      )
                    }
                  />
                  <span
                    style={{
                      textDecoration: task.completed
                        ? "line-through"
                        : undefined,
                    }}
                  >
                    {task.title}
                  </span>
                </label>
                <button
                  className="text-button"
                  disabled={feedback.busy}
                  aria-label={`Delete preparation task ${task.title}`}
                  onClick={() =>
                    void feedback.run(
                      () => tasks.remove(task.id),
                      "Preparation task removed.",
                    )
                  }
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
          {!tasks.items.length && (
            <Empty>
              Add a skill, interview exercise or project milestone to work
              towards.
            </Empty>
          )}
        </>
      )}
      {tab === "portfolio" && (
        <>
          <div className="actions">
            <div>
              <h2>A story only you can tell.</h2>
              <p className="muted">
                Build a private portfolio and export a clean resume. Save your
                changes before printing.
              </p>
            </div>
            <button
              className="secondary"
              disabled={!portfolio}
              onClick={() => window.print()}
            >
              <Download size={16} /> Print / save PDF
            </button>
          </div>
          <form
            className="feature-form feature-card no-print"
            key={portfolio?.id || "new-portfolio"}
            onSubmit={savePortfolio}
          >
            <label>
              Full name
              <input
                name="name"
                required
                maxLength={100}
                defaultValue={portfolio?.name || profile?.full_name}
              />
            </label>
            <label>
              Professional headline
              <input
                name="headline"
                required
                maxLength={180}
                placeholder="Computer science student · Web developer"
                defaultValue={portfolio?.headline}
              />
            </label>
            <label>
              Contact email
              <input
                name="email"
                type="email"
                maxLength={150}
                defaultValue={portfolio?.email}
              />
            </label>
            <label>
              Phone (optional)
              <input
                name="phone"
                type="tel"
                maxLength={30}
                defaultValue={portfolio?.phone}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              About you
              <textarea
                name="summary"
                rows={3}
                maxLength={1500}
                defaultValue={portfolio?.summary}
              />
            </label>
            <label>
              Skills
              <textarea
                name="skills"
                rows={4}
                maxLength={1500}
                placeholder="TypeScript, SQL, teamwork…"
                defaultValue={portfolio?.skills}
              />
            </label>
            <label>
              Education
              <textarea
                name="education"
                rows={4}
                maxLength={2000}
                defaultValue={
                  portfolio?.education ||
                  (profile
                    ? `${profile.programme}${profile.branch ? `, ${profile.branch}` : ""}\n${profile.college}\nAdmitted ${profile.admission_year}`
                    : "")
                }
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Projects and experience
              <textarea
                name="projects"
                rows={6}
                maxLength={6000}
                placeholder="Project name · Your role\nWhat you built, how it worked, and the outcome."
                defaultValue={portfolio?.projects}
              />
            </label>
            <label style={{ gridColumn: "1 / -1" }}>
              Portfolio / project links (one complete URL per line)
              <textarea
                name="links"
                rows={3}
                maxLength={2000}
                placeholder="https://github.com/yourname"
                defaultValue={portfolio?.links}
              />
            </label>
            <button disabled={feedback.busy}>Save portfolio</button>
          </form>
          {portfolio ? (
            <article
              id="resume-print"
              className="feature-card resume-preview"
              aria-label="Saved resume preview"
            >
              <header>
                <h2>{portfolio.name}</h2>
                <p>{portfolio.headline}</p>
                <p>
                  {[portfolio.email, portfolio.phone]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </header>
              {[
                ["Profile", portfolio.summary],
                ["Education", portfolio.education],
                ["Skills", portfolio.skills],
                ["Projects & experience", portfolio.projects],
              ]
                .filter(([, content]) => content)
                .map(([heading, content]) => (
                  <section key={heading}>
                    <h3>{heading}</h3>
                    <p
                      style={{
                        whiteSpace: "pre-wrap",
                        overflowWrap: "anywhere",
                      }}
                    >
                      {content}
                    </p>
                  </section>
                ))}
              {portfolio.links && (
                <section>
                  <h3>Links</h3>
                  {portfolio.links
                    .split("\n")
                    .filter(Boolean)
                    .map((link) => (
                      <p key={link}>
                        <a
                          href={safeLink(link)}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {link}
                        </a>
                      </p>
                    ))}
                </section>
              )}
            </article>
          ) : (
            <Empty>Save your portfolio to generate a resume preview.</Empty>
          )}
          {portfolio && (
            <PortfolioSharing
              demo={demo}
              userId={userId}
              portfolio={portfolio}
            />
          )}
          <style jsx global>{`
            @media print {
              body * {
                visibility: hidden !important;
              }
              #resume-print,
              #resume-print * {
                visibility: visible !important;
              }
              #resume-print {
                position: absolute !important;
                top: 0 !important;
                left: 0 !important;
                width: 100% !important;
                padding: 12mm !important;
                margin: 0 !important;
                border: none !important;
                box-shadow: none !important;
                background: white !important;
                color: black !important;
              }
              #resume-print header,
              #resume-print section {
                break-inside: avoid;
              }
              #resume-print h2 {
                font-size: 24pt;
              }
              #resume-print h3 {
                font-size: 13pt;
                margin-top: 18pt;
              }
              #resume-print p {
                font-size: 11pt;
                line-height: 1.5;
              }
              @page {
                size: A4;
                margin: 8mm;
              }
            }
          `}</style>
        </>
      )}
    </>
  );
}

export default function StudyCareer({
  view,
  ...props
}: FeatureProps & { view: "study" | "career" }) {
  return view === "study" ? (
    <StudyWorkspace {...props} />
  ) : (
    <CareerWorkspace {...props} />
  );
}
