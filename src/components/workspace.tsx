"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  GraduationCap,
  Layers3,
  LayoutDashboard,
  LogOut,
  Plus,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
  Pencil,
} from "lucide-react";
import { browserClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import WorkspacePreferences from "./workspace-preferences";
import { cleanupDemoSubjects } from "@/lib/records";
import ThemeToggle from "./theme-toggle";
const AcademicTools = dynamic(() => import("./academic-tools"), {
  loading: () => <p className="loading">Opening academic tools…</p>,
});
const StudyCareer = dynamic(() => import("./study-career"), {
  loading: () => <p className="loading">Opening workspace…</p>,
});
const Community = dynamic(() => import("./community"), {
  loading: () => <p className="loading">Opening community…</p>,
});
const StudyAssistant = dynamic(() => import("./study-assistant"), {
  loading: () => <p className="loading">Opening study assistant…</p>,
});
import {
  demoWorkspace,
  emptyWorkspace,
  profileSchema,
  subjectSchema,
  termSchema,
  type Profile,
  type Subject,
  type Term,
  type Workspace,
} from "@/lib/models";

type Props = { view: string; userId: string; email: string; demo: boolean };
type Editor =
  { kind: "subject"; item?: Subject } | { kind: "term"; item?: Term } | null;
const nav = [
  { slug: "dashboard", label: "Overview", icon: LayoutDashboard },
  { slug: "subjects", label: "My subjects", icon: BookOpen },
  { slug: "terms", label: "Academic terms", icon: CalendarDays },
  { slug: "planner", label: "Planner", icon: CalendarDays },
  { slug: "attendance", label: "Attendance", icon: ClipboardCheck },
  { slug: "study", label: "Study workspace", icon: BookOpen },
  { slug: "performance", label: "Performance", icon: Layers3 },
  { slug: "community", label: "Community", icon: GraduationCap },
  { slug: "career", label: "Career", icon: GraduationCap },
  { slug: "assistant", label: "Study assistant", icon: Sparkles },
  { slug: "institutions", label: "Institutions", icon: ShieldCheck },
  { slug: "settings", label: "Settings", icon: Settings },
];
const hindiLabels: Record<string, string> = {
  dashboard: "अवलोकन",
  subjects: "मेरे विषय",
  terms: "शैक्षणिक सत्र",
  planner: "योजनाकार",
  attendance: "उपस्थिति",
  study: "अध्ययन",
  performance: "प्रदर्शन",
  community: "समुदाय",
  career: "करियर",
  assistant: "अध्ययन सहायक",
  institutions: "संस्थान",
  settings: "सेटिंग्स",
};
const demoKey = "campushub-demo-v1";
export default function WorkspaceApp({ view, userId, email, demo }: Props) {
  const [language, setLanguage] = useState("en");
  useEffect(() => {
    setLanguage(localStorage.getItem("campushub-language") || "en");
  }, []);
  const router = useRouter(),
    base = demo ? "/demo" : "/app";
  const [data, setData] = useState<Workspace>(emptyWorkspace),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [notice, setNotice] = useState(""),
    [busy, setBusy] = useState(false),
    [selected, setSelected] = useState(""),
    [query, setQuery] = useState(""),
    [editor, setEditor] = useState<Editor>(null),
    [deleting, setDeleting] = useState<Subject | Term | null>(null);
  const dialog = useRef<HTMLDialogElement>(null),
    deleteDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    let active = true;
    async function load() {
      try {
        let result: Workspace;
        if (demo) {
          const saved = localStorage.getItem(demoKey);
          try {
            result = saved ? JSON.parse(saved) : structuredClone(demoWorkspace);
          } catch {
            result = structuredClone(demoWorkspace);
          }
        } else {
          const client = browserClient();
          const [p, t, s] = await Promise.all([
            client.from("profiles").select("*").eq("id", userId).maybeSingle(),
            client
              .from("academic_terms")
              .select("*")
              .order("starts_on", { ascending: false }),
            client.from("subjects").select("*").order("name"),
          ]);
          if (p.error || t.error || s.error)
            throw p.error || t.error || s.error;
          result = {
            profile: p.data,
            terms: t.data || [],
            subjects: s.data || [],
          };
        }
        if (active) {
          setData(result);
          const today = new Date().toISOString().slice(0, 10);
          const storedSelection = localStorage.getItem(
            `campushub-selected-term-${demo ? "demo" : userId}`,
          );
          setSelected(
            (storedSelection &&
              result.terms.some((term) => term.id === storedSelection) &&
              storedSelection) ||
              (
                result.terms.find(
                  (t) => t.starts_on <= today && t.ends_on >= today,
                ) || result.terms[0]
              )?.id ||
              "",
          );
          if (!result.profile && view !== "onboarding")
            router.replace(`${base}/onboarding`);
        }
      } catch (e) {
        if (active)
          setError(
            e instanceof Error
              ? e.message
              : "Unable to load your workspace. Please refresh to retry.",
          );
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [demo, userId, base, router, view]);
  useEffect(() => {
    if (selected)
      localStorage.setItem(
        `campushub-selected-term-${demo ? "demo" : userId}`,
        selected,
      );
  }, [demo, selected, userId]);
  useEffect(() => {
    if (editor) dialog.current?.showModal();
    else dialog.current?.close();
  }, [editor]);
  useEffect(() => {
    if (deleting) deleteDialog.current?.showModal();
    else deleteDialog.current?.close();
  }, [deleting]);
  function commit(next: Workspace) {
    if (demo) localStorage.setItem(demoKey, JSON.stringify(next));
    setData(next);
  }
  async function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const parsed = profileSchema.safeParse(
        Object.fromEntries(new FormData(event.currentTarget)),
      );
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      if (!demo) {
        const { error } = await browserClient()
          .from("profiles")
          .upsert({ id: userId, ...parsed.data });
        if (error) throw new Error(error.message);
      }
      commit({ ...data, profile: parsed.data });
      setNotice("Your profile has been saved.");
      if (view === "onboarding") router.push(`${base}/dashboard`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  }
  async function saveItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editor) return;
    setBusy(true);
    setError("");
    try {
      const raw = Object.fromEntries(new FormData(event.currentTarget));
      const parsed =
        editor.kind === "subject"
          ? subjectSchema.safeParse(raw)
          : termSchema.safeParse(raw);
      if (!parsed.success) throw new Error(parsed.error.issues[0].message);
      const item = {
        ...parsed.data,
        id: editor.item?.id || crypto.randomUUID(),
        user_id: userId,
      };
      if (!demo) {
        const table = editor.kind === "subject" ? "subjects" : "academic_terms";
        const result = editor.item
          ? await browserClient()
              .from(table)
              .update(parsed.data)
              .eq("id", item.id)
              .select()
              .single()
          : await browserClient()
              .from(table)
              .insert(item as Record<string, unknown>)
              .select()
              .single();
        if (result.error) throw new Error(result.error.message);
      }
      if (editor.kind === "subject")
        commit({
          ...data,
          subjects: [
            ...data.subjects.filter((s) => s.id !== item.id),
            item as Subject,
          ],
        });
      else {
        commit({
          ...data,
          terms: [...data.terms.filter((t) => t.id !== item.id), item as Term],
        });
        setSelected(item.id);
      }
      setNotice(`${editor.kind === "subject" ? "Subject" : "Term"} saved.`);
      setEditor(null);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Could not save. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function remove() {
    if (!deleting) return;
    setBusy(true);
    setError("");
    try {
      const isSubject = "term_id" in deleting;
      if (demo)
        cleanupDemoSubjects(
          isSubject
            ? [deleting.id]
            : data.subjects
                .filter((subject) => subject.term_id === deleting.id)
                .map((subject) => subject.id),
        );
      if (!demo) {
        const { error } = await browserClient()
          .from(isSubject ? "subjects" : "academic_terms")
          .delete()
          .eq("id", deleting.id)
          .select()
          .single();
        if (error) throw new Error(error.message);
      }
      commit(
        isSubject
          ? {
              ...data,
              subjects: data.subjects.filter((s) => s.id !== deleting.id),
            }
          : {
              ...data,
              terms: data.terms.filter((t) => t.id !== deleting.id),
              subjects: data.subjects.filter((s) => s.term_id !== deleting.id),
            },
      );
      if (!isSubject && selected === deleting.id)
        setSelected(data.terms.find((t) => t.id !== deleting.id)?.id || "");
      setDeleting(null);
      setNotice(
        isSubject ? "Subject removed." : "Term and its subjects removed.",
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not delete.");
    } finally {
      setBusy(false);
    }
  }
  async function signOut() {
    setBusy(true);
    try {
      if (!demo) {
        const { error } = await browserClient().auth.signOut();
        if (error) throw error;
      }
      router.replace("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not sign out.");
      setBusy(false);
    }
  }
  const current = data.terms.find((t) => t.id === selected),
    subjects = data.subjects.filter((s) => s.term_id === selected),
    filtered = subjects.filter((s) =>
      `${s.name} ${s.code} ${s.instructor}`
        .toLowerCase()
        .includes(query.toLowerCase()),
    );
  const credits = subjects.reduce((total, s) => total + s.credits, 0),
    name = data.profile?.full_name.split(" ")[0] || "there";
  const heading =
    nav.find(
      (n) =>
        n.slug === view &&
        [
          "planner",
          "study",
          "performance",
          "community",
          "career",
          "assistant",
          "institutions",
        ].includes(view),
    )?.label ||
    (view === "subjects"
      ? "My subjects"
      : view === "terms"
        ? "Academic terms"
        : view === "settings"
          ? "Your settings"
          : view === "onboarding"
            ? "Make this space yours."
            : `Hey ${name}, let’s make it count.`);
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <aside className="sidebar">
        <Link className="brand" href={`${base}/dashboard`}>
          <span className="logo">
            <GraduationCap />
          </span>
          CampusHub<span className="brand-dot">.</span>
        </Link>
        <div className="workspace-label">YOUR WORKSPACE</div>
        <nav aria-label="Main navigation">
          {nav.map(({ slug, label, icon: Icon }) => (
            <Link
              key={slug}
              className={view === slug ? "active" : ""}
              aria-current={view === slug ? "page" : undefined}
              href={`${base}/${slug}`}
            >
              <Icon size={19} />
              <span lang={language === "hi" ? "hi" : "en"}>
                {language === "hi" ? hindiLabels[slug] : label}
              </span>
              {view === slug && <span className="nav-dot" />}
            </Link>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-card">
            <span className="mini-icon">
              <Sparkles size={18} />
            </span>
            <h4>A little progress, every day.</h4>
            <p>
              You don’t need to have it all figured out. Start with one subject.
            </p>
          </div>
          <div className="account">
            <span className="avatar">{name.slice(0, 1).toUpperCase()}</span>
            <div>
              <strong>{data.profile?.full_name || "Your workspace"}</strong>
              <small>{demo ? "Demo student" : email}</small>
            </div>
            <button
              className="icon-button"
              aria-label={demo ? "Exit demo" : "Sign out"}
              onClick={signOut}
              disabled={busy}
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
      <div className="main-wrap">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={14} />
            <strong>
              {nav.find((n) => n.slug === view)?.label || "Welcome"}
            </strong>
          </div>
          <div className="topbar-right">
            <label className="language-picker">
              <span className="sr-only">Navigation language</span>
              <select
                aria-label="Navigation language"
                value={language}
                onChange={(e) => {
                  setLanguage(e.target.value);
                  localStorage.setItem("campushub-language", e.target.value);
                }}
              >
                <option value="en">English</option>
                <option value="hi">हिन्दी</option>
              </select>
            </label>
            <span className="private-label">
              <ShieldCheck size={15} /> Personal workspace
            </span>
            <ThemeToggle compact />
            <span className="avatar small">
              {name.slice(0, 1).toUpperCase()}
            </span>
          </div>
        </header>
        {demo && (
          <div className="demo-banner">
            <span>
              <strong>Demo workspace</strong> · Sample data, saved only in this
              browser.
            </span>
            <Link href="/auth?mode=signup">
              Make it yours <ArrowRight size={14} />
            </Link>
          </div>
        )}
        <main id="main">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                {view === "dashboard"
                  ? "A LITTLE CLARITY FOR YOUR DAY"
                  : "YOUR ACADEMIC SPACE"}
              </span>
              <h1>{heading}</h1>
              <p>
                {view === "dashboard"
                  ? "Your academic life, all in one place. You’ve got this."
                  : view === "subjects"
                    ? "Big ideas start with the subjects you love."
                    : view === "terms"
                      ? "Every chapter of your college journey, organised."
                      : view === "onboarding"
                        ? "Tell us a little about your academic journey."
                        : view === "attendance"
                          ? "Record every class, see your percentage, and know what you need next."
                        : "A workspace that works the way you do."}
              </p>
            </div>
            {(view === "dashboard" || view === "subjects") && (
              <div className="heading-actions">
                <button
                  type="button"
                  className="secondary scroll-to-semester"
                  onClick={() =>
                    document
                      .getElementById("semester-selection")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" })
                  }
                >
                  <ChevronDown size={16} /> Choose semester
                </button>
                <button
                  onClick={() => setEditor({ kind: "subject" })}
                  disabled={!data.terms.length || loading}
                >
                  <Plus size={17} /> Add subject
                </button>
              </div>
            )}
            {view === "terms" && (
              <button onClick={() => setEditor({ kind: "term" })}>
                <Plus size={17} /> New term
              </button>
            )}
          </div>
          {error && !editor && !deleting && (
            <div role="alert" className="notice error">
              {error}
            </div>
          )}
          {notice && (
            <div role="status" className="notice success">
              {notice}
              <button
                className="icon-button"
                aria-label="Dismiss notification"
                onClick={() => setNotice("")}
              >
                <X size={16} />
              </button>
            </div>
          )}
          {loading ? (
            <div className="loading">Opening your workspace…</div>
          ) : (
            <>
              {(view === "dashboard" || view === "subjects") && (
                <>
                  <section
                    id="semester-selection"
                    className="semester-banner"
                    tabIndex={-1}
                  >
                    <div className="semester-icon">
                      <Layers3 size={27} />
                    </div>
                    <div>
                      <span className="eyebrow">YOUR SELECTED TERM</span>
                      <h2>{current?.name || "A fresh start awaits"}</h2>
                      <p>
                        {data.profile?.programme}
                        {data.profile?.branch
                          ? ` · ${data.profile.branch}`
                          : ""}
                      </p>
                    </div>
                    {data.terms.length ? (
                      <label className="term-picker">
                        <span className="sr-only">Selected term</span>
                        <select
                          aria-label="Selected term"
                          value={selected}
                          onChange={(e) => setSelected(e.target.value)}
                        >
                          {data.terms.map((t) => (
                            <option key={t.id} value={t.id}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <button
                        className="secondary"
                        onClick={() => setEditor({ kind: "term" })}
                      >
                        Create your first term <ArrowRight size={16} />
                      </button>
                    )}
                    <div className="banner-orbit" aria-hidden="true" />
                  </section>
                  {view === "dashboard" && (
                    <div className="stat-grid">
                      <Stat
                        icon={<BookOpen />}
                        value={String(subjects.length).padStart(2, "0")}
                        label="Subjects this term"
                        detail="A place for every interest"
                      />
                      <Stat
                        icon={<Layers3 />}
                        value={String(credits).padStart(2, "0")}
                        label="Total credits"
                        detail="Your current academic load"
                      />
                      <Stat
                        icon={<CalendarDays />}
                        value={String(data.terms.length).padStart(2, "0")}
                        label="Academic terms"
                        detail="Every chapter, in one place"
                      />
                    </div>
                  )}
                  <div className="dashboard-grid">
                    <section>
                      <div className="section-heading">
                        <div>
                          <h2>
                            {view === "dashboard"
                              ? "Your subjects"
                              : "Subject library"}{" "}
                            <span className="count">{subjects.length}</span>
                          </h2>
                          <p>
                            {current
                              ? "A small step today. A stronger foundation tomorrow."
                              : "Create a term to start organising your subjects."}
                          </p>
                        </div>
                        {view === "dashboard" && (
                          <Link href={`${base}/subjects`}>
                            View all <ArrowRight size={15} />
                          </Link>
                        )}
                      </div>
                      {view === "subjects" && (
                        <label className="search">
                          <Search size={18} />
                          <input
                            aria-label="Search subjects"
                            placeholder="Search by subject, code or instructor…"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                          />
                        </label>
                      )}
                      <div className="subject-grid">
                        {(view === "dashboard"
                          ? subjects.slice(0, 4)
                          : filtered
                        ).map((subject) => (
                          <article
                            className={`subject-card ${subject.color}`}
                            key={subject.id}
                          >
                            <div className="card-top">
                              <span className="subject-icon">
                                <BookOpen size={21} />
                              </span>
                              <span className="code">{subject.code}</span>
                            </div>
                            <h3>{subject.name}</h3>
                            <p>
                              {subject.instructor || "Instructor not added"}
                            </p>
                            <div className="card-footer">
                              <span>{subject.credits} credits</span>
                              <div>
                                <button
                                  className="icon-button"
                                  aria-label={`Edit ${subject.name}`}
                                  onClick={() =>
                                    setEditor({
                                      kind: "subject",
                                      item: subject,
                                    })
                                  }
                                >
                                  <Pencil size={15} />
                                </button>
                                <button
                                  className="icon-button"
                                  aria-label={`Delete ${subject.name}`}
                                  onClick={() => setDeleting(subject)}
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          </article>
                        ))}
                      </div>
                      {!(view === "dashboard" ? subjects : filtered).length && (
                        <div className="empty">
                          <BookOpen size={30} />
                          <h3>
                            {query
                              ? "No subjects match your search."
                              : "Your next chapter starts here."}
                          </h3>
                          <p>
                            {query
                              ? "Try another name or subject code."
                              : "Add your first subject and give your academic life a home."}
                          </p>
                          {!query && (
                            <button
                              className="secondary"
                              disabled={!data.terms.length}
                              onClick={() => setEditor({ kind: "subject" })}
                            >
                              Add a subject
                            </button>
                          )}
                        </div>
                      )}
                    </section>
                    {view === "dashboard" && (
                      <aside className="right-column">
                        <div className="profile-card">
                          <span className="eyebrow">THE BIGGER PICTURE</span>
                          <div className="college-art" aria-hidden="true">
                            <GraduationCap size={58} />
                            <span aria-hidden="true">•</span>
                          </div>
                          <h3>{data.profile?.college || "Your college"}</h3>
                          <p>
                            {data.profile?.programme} · Batch of{" "}
                            {data.profile?.admission_year}
                          </p>
                          <div className="divider" />
                          <Link href={`${base}/settings`}>
                            Your academic profile <ArrowRight size={16} />
                          </Link>
                        </div>
                        <div className="note-card">
                          <span className="eyebrow">A GENTLE REMINDER</span>
                          <p>
                            “You don’t have to see the whole staircase. Just
                            take the first step.”
                          </p>
                          <small>
                            One subject. One chapter. One day at a time.
                          </small>
                        </div>
                      </aside>
                    )}
                  </div>
                </>
              )}
              {view === "terms" && (
                <section className="terms-list">
                  {data.terms.map((t) => (
                    <article className="term-row" key={t.id}>
                      <span className="subject-icon">
                        <CalendarDays />
                      </span>
                      <div>
                        <h3>{t.name}</h3>
                        <p>
                          {formatDate(t.starts_on)} — {formatDate(t.ends_on)}
                        </p>
                        <small>
                          {
                            data.subjects.filter((s) => s.term_id === t.id)
                              .length
                          }{" "}
                          subjects
                        </small>
                      </div>
                      <button
                        className="icon-button"
                        aria-label={`Edit ${t.name}`}
                        onClick={() => setEditor({ kind: "term", item: t })}
                      >
                        <Pencil size={18} />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={`Delete ${t.name}`}
                        onClick={() => setDeleting(t)}
                      >
                        <Trash2 size={18} />
                      </button>
                    </article>
                  ))}
                  {!data.terms.length && (
                    <div className="empty">
                      <CalendarDays />
                      <h3>Give your journey a starting point.</h3>
                      <p>Add a semester, trimester, or annual term.</p>
                      <button onClick={() => setEditor({ kind: "term" })}>
                        Create a term
                      </button>
                    </div>
                  )}
                </section>
              )}
              {(view === "settings" || view === "onboarding") && (
                <div className="settings-grid">
                  <section className="form-panel">
                    <h2>Academic profile</h2>
                    <p>Any college. Any programme. Your own path.</p>
                    <ProfileForm
                      profile={data.profile}
                      save={saveProfile}
                      busy={busy}
                    />
                  </section>
                  <aside className="profile-help">
                    <ShieldCheck size={28} />
                    <h3>Your space is personal.</h3>
                    <p>
                      Your profile, terms and subjects are visible only to your
                      account.
                    </p>
                    <p>
                      Use your college’s full name and the programme you’re
                      enrolled in. No college email address required.
                    </p>
                    {view === "settings" && (
                      <button
                        className="secondary"
                        disabled={busy}
                        onClick={signOut}
                      >
                        {demo ? "Exit demo" : "Sign out"}
                      </button>
                    )}
                  </aside>
                </div>
              )}
              {view === "attendance" && (
                <section
                  id="semester-selection"
                  className="semester-banner attendance-term-banner"
                  tabIndex={-1}
                >
                  <div className="semester-icon">
                    <Layers3 size={23} />
                  </div>
                  <div>
                    <span className="eyebrow">TRACKING TERM</span>
                    <h2>{current?.name || "Choose a semester"}</h2>
                    <p>Attendance is recorded separately for each semester.</p>
                  </div>
                  {data.terms.length ? (
                    <label className="term-picker">
                      <span className="sr-only">Attendance semester</span>
                      <select
                        aria-label="Attendance semester"
                        value={selected}
                        onChange={(event) => setSelected(event.target.value)}
                      >
                        {data.terms.map((term) => (
                          <option key={term.id} value={term.id}>
                            {term.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : (
                    <Link className="button secondary" href={base + "/terms"}>
                      Create a semester <ArrowRight size={16} />
                    </Link>
                  )}
                </section>
              )}
              {["planner", "attendance", "performance"].includes(view) && (
                <AcademicTools
                  view={view as "planner" | "attendance" | "performance"}
                  demo={demo}
                  userId={userId}
                  profile={data.profile}
                  subjects={
                    view === "attendance" && selected
                      ? data.subjects.filter(
                          (subject) => subject.term_id === selected,
                        )
                      : data.subjects
                  }
                  terms={data.terms}
                />
              )}
              {["study", "career"].includes(view) && (
                <StudyCareer
                  view={view as "study" | "career"}
                  demo={demo}
                  userId={userId}
                  profile={data.profile}
                  subjects={data.subjects}
                  terms={data.terms}
                />
              )}
              {["community", "institutions"].includes(view) && (
                <Community
                  view={view as "community" | "institutions"}
                  demo={demo}
                  userId={userId}
                  profile={data.profile}
                  subjects={data.subjects}
                  terms={data.terms}
                />
              )}
              {view === "assistant" && (
                <StudyAssistant
                  demo={demo}
                  userId={userId}
                  profile={data.profile}
                  subjects={data.subjects}
                  terms={data.terms}
                />
              )}
              {view === "settings" && (
                <WorkspacePreferences
                  demo={demo}
                  userId={userId}
                  profile={data.profile}
                  subjects={data.subjects}
                  terms={data.terms}
                />
              )}
            </>
          )}
          <footer className="app-footer">
            <span>Made for your next chapter.</span>
            <span>
              CampusHub <span className="brand-dot">.</span>
            </span>
          </footer>
        </main>
      </div>
      <dialog
        ref={dialog}
        onCancel={() => setEditor(null)}
        onClose={() => setEditor(null)}
        aria-labelledby="editor-title"
      >
        <div className="modal-heading">
          <h2 id="editor-title">
            {editor?.item ? "Edit" : "Add"}{" "}
            {editor?.kind === "subject" ? "subject" : "academic term"}
          </h2>
          <button
            className="icon-button"
            aria-label="Close form"
            onClick={() => setEditor(null)}
          >
            <X />
          </button>
        </div>
        {editor && (
          <form key={editor.item?.id || editor.kind} onSubmit={saveItem}>
            {editor.kind === "subject" ? (
              <>
                <label>
                  Subject name
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={editor.item?.name}
                    autoFocus
                    placeholder="e.g. Applied Mathematics"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Subject code
                    <input
                      name="code"
                      required
                      maxLength={20}
                      defaultValue={editor.item?.code}
                      placeholder="e.g. MA101"
                    />
                  </label>
                  <label>
                    Credits
                    <input
                      name="credits"
                      type="number"
                      min="0"
                      max="30"
                      step="0.5"
                      required
                      defaultValue={editor.item?.credits ?? 3}
                    />
                  </label>
                </div>
                <label>
                  Academic term
                  <select
                    name="term_id"
                    defaultValue={editor.item?.term_id || selected}
                  >
                    {data.terms.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Instructor <span className="muted">(optional)</span>
                  <input
                    name="instructor"
                    maxLength={100}
                    defaultValue={editor.item?.instructor}
                  />
                </label>
                <label>
                  Colour
                  <select
                    name="color"
                    defaultValue={editor.item?.color || "violet"}
                  >
                    <option value="violet">Lavender</option>
                    <option value="blue">Sky blue</option>
                    <option value="orange">Apricot</option>
                    <option value="green">Sage green</option>
                  </select>
                </label>
              </>
            ) : (
              <>
                <label>
                  Term name
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={80}
                    defaultValue={editor.item?.name}
                    autoFocus
                    placeholder="e.g. Semester 1 / Year 1"
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Start date
                    <input
                      name="starts_on"
                      type="date"
                      required
                      defaultValue={editor.item?.starts_on}
                    />
                  </label>
                  <label>
                    End date
                    <input
                      name="ends_on"
                      type="date"
                      required
                      defaultValue={editor.item?.ends_on}
                    />
                  </label>
                </div>
              </>
            )}
            {error && (
              <p role="alert" className="notice error">
                {error}
              </p>
            )}
            <div className="modal-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => setEditor(null)}
                disabled={busy}
              >
                Cancel
              </button>
              <button disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
                <Check size={16} />
              </button>
            </div>
          </form>
        )}
      </dialog>
      <dialog
        ref={deleteDialog}
        onCancel={() => setDeleting(null)}
        onClose={() => setDeleting(null)}
        aria-labelledby="delete-title"
      >
        <h2 id="delete-title">Delete {deleting?.name}?</h2>
        <p>
          {deleting && "term_id" in deleting
            ? "This subject, its timetable, attendance and assessments will be permanently removed. Notes, resources, tasks and goals will move to General."
            : "This term, its subjects, timetable, attendance and assessments will be permanently removed. Notes, resources, tasks and goals will move to General."}
        </p>
        {error && (
          <p role="alert" className="notice error">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button
            className="secondary"
            disabled={busy}
            onClick={() => setDeleting(null)}
          >
            Keep it
          </button>
          <button className="danger" disabled={busy} onClick={remove}>
            {busy ? "Deleting…" : "Delete permanently"}
          </button>
        </div>
      </dialog>
    </div>
  );
}
function Stat({
  icon,
  value,
  label,
  detail,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
  detail: string;
}) {
  return (
    <article className="stat">
      <div>
        <span className="stat-icon">{icon}</span>
        <span className="stat-value">{value}</span>
      </div>
      <h3>{label}</h3>
      <p>{detail}</p>
    </article>
  );
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}
function ProfileForm({
  profile,
  save,
  busy,
}: {
  profile: Profile | null;
  save: (event: React.FormEvent<HTMLFormElement>) => void;
  busy: boolean;
}) {
  return (
    <form onSubmit={save}>
      <label>
        Full name
        <input
          name="full_name"
          required
          minLength={2}
          maxLength={80}
          defaultValue={profile?.full_name}
          autoComplete="name"
          placeholder="Your name"
        />
      </label>
      <label>
        College / university
        <input
          name="college"
          required
          minLength={2}
          maxLength={160}
          defaultValue={profile?.college}
          placeholder="Full name of your institution"
        />
      </label>
      <div className="form-grid">
        <label>
          Programme
          <input
            name="programme"
            required
            minLength={2}
            maxLength={100}
            defaultValue={profile?.programme}
            placeholder="e.g. B.A., B.Tech, MBBS"
          />
        </label>
        <label>
          Branch / specialisation
          <input
            name="branch"
            maxLength={100}
            defaultValue={profile?.branch}
            placeholder="Optional"
          />
        </label>
      </div>
      <div className="form-grid">
        <label>
          Admission year
          <input
            name="admission_year"
            type="number"
            min="1980"
            max="2100"
            required
            defaultValue={profile?.admission_year || new Date().getFullYear()}
          />
        </label>
        <label>
          Academic system
          <select
            name="term_system"
            defaultValue={profile?.term_system || "Semester"}
          >
            <option>Semester</option>
            <option>Trimester</option>
            <option>Annual</option>
          </select>
        </label>
      </div>
      <button disabled={busy}>
        {busy ? "Saving…" : profile ? "Save profile" : "Create my workspace"}
        <ArrowRight size={17} />
      </button>
    </form>
  );
}
