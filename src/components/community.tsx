"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { CalendarDays, ExternalLink, ShieldCheck, Users } from "lucide-react";
import { browserClient } from "@/lib/supabase/client";
import type { FeatureProps } from "@/lib/records";
import { loadAllRows } from "@/lib/pagination";

type Group = {
  id: string;
  name: string;
  description: string;
  kind: "club" | "study";
};
type Member = {
  group_id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "moderator" | "member";
};
type Post = {
  id: string;
  group_id: string;
  author_id: string;
  title: string;
  body: string;
  resource_url: string;
  hidden: boolean;
  created_at: string;
};
type Event = {
  id: string;
  group_id: string;
  creator_id: string;
  title: string;
  starts_at: string;
  location: string;
  details: string;
};
type Report = {
  id: string;
  group_id: string;
  post_id: string;
  reporter_id: string;
  reason: string;
  status: "open" | "removed" | "dismissed";
  created_at: string;
};
type Audit = {
  id: string;
  group_id: string;
  actor_id: string;
  action: string;
  target_id?: string;
  created_at: string;
};
type Institution = {
  id: string;
  name: string;
  domain: string;
  verified_at: string;
};
type InstitutionMember = {
  institution_id: string;
  user_id: string;
  display_name: string;
  role: "student" | "staff";
};
type Announcement = {
  id: string;
  institution_id: string;
  author_id: string;
  title: string;
  body: string;
  created_at: string;
};
type Graph = {
  version: 1;
  groups: Group[];
  members: Member[];
  posts: Post[];
  events: Event[];
  reports: Report[];
  audit: Audit[];
  blocks: { blocker_id: string; blocked_id: string }[];
  institutions: Institution[];
  institutionMembers: InstitutionMember[];
  announcements: Announcement[];
};

// Memberships have composite primary keys. Keep both columns in the cursor so
// a large group cannot hide its later members (including the current student).
async function loadTableRows<T>(
  table: string,
  primaryKey = "id",
  secondaryKey?: string,
): Promise<T[]> {
  const rows = await loadAllRows<{ id: string; row: T }>(async (cursor) => {
    let query = browserClient()
      .from(table)
      .select("*")
      .order(primaryKey)
      .limit(500);
    if (secondaryKey) {
      query = query.order(secondaryKey);
      if (cursor) {
        const [primary, secondary] = cursor.split(":");
        query = query.or(
          `${primaryKey}.gt.${primary},and(${primaryKey}.eq.${primary},${secondaryKey}.gt.${secondary})`,
        );
      }
    } else if (cursor) query = query.gt(primaryKey, cursor);
    const { data, error } = await query;
    if (error) throw error;
    return (data || []).map((row: Record<string, unknown>) => ({
      id: secondaryKey
        ? `${String(row[primaryKey])}:${String(row[secondaryKey])}`
        : String(row[primaryKey]),
      row: row as T,
    }));
  });
  return rows.map(({ row }) => row);
}

const demoKey = "campushub-community-demo-v1";
const now = () => new Date().toISOString();
const uid = () => crypto.randomUUID();
const dateLabel = (value: string) =>
  new Date(value).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
function seed(who: string, name: string): Graph {
  const date = now();
  return {
    version: 1,
    groups: [
      {
        id: "study-circle",
        name: "The Study Circle",
        description:
          "A welcoming space for revision, useful resources and working through difficult topics together.",
        kind: "study",
      },
      {
        id: "creators-club",
        name: "Campus Creators",
        description:
          "Photography, writing and weekend projects. All programmes welcome.",
        kind: "club",
      },
    ],
    members: [
      {
        group_id: "study-circle",
        user_id: who,
        display_name: name,
        role: "owner",
      },
      {
        group_id: "study-circle",
        user_id: "demo-peer",
        display_name: "Mira · demo member",
        role: "member",
      },
      {
        group_id: "creators-club",
        user_id: "demo-creator",
        display_name: "Rohan · demo member",
        role: "owner",
      },
    ],
    posts: [
      {
        id: "welcome-post",
        group_id: "study-circle",
        author_id: "demo-peer",
        title: "Make revision a shared habit",
        body: "Share a topic you want to practise this week. We can each explain one concept in our own words, then compare notes.",
        resource_url: "",
        hidden: false,
        created_at: date,
      },
    ],
    events: [
      {
        id: "welcome-event",
        group_id: "study-circle",
        creator_id: "demo-peer",
        title: "Weekly study room",
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        location: "Library · discussion room",
        details: "Bring one question and a notebook. This is a sample event.",
      },
    ],
    reports: [],
    audit: [],
    blocks: [],
    institutions: [
      {
        id: "demo-institution",
        name: "CampusHub Sample College",
        domain: "college.example",
        verified_at: date,
      },
    ],
    institutionMembers: [],
    announcements: [
      {
        id: "demo-announcement",
        institution_id: "demo-institution",
        author_id: "demo-staff",
        title: "Welcome to your campus workspace",
        body: "Sample announcement: library orientation is open to students of every programme. Only verified staff can publish in a connected institution workspace.",
        created_at: date,
      },
    ],
  };
}
function failure(error: unknown) {
  return error && typeof error === "object" && "message" in error
    ? String(error.message)
    : "Unable to complete that action. Please try again.";
}
function field(form: FormData, key: string) {
  return String(form.get(key) || "").trim();
}
function checkLength(value: string, min: number, max: number, label: string) {
  if (value.length < min || value.length > max)
    throw new Error(`${label} must contain ${min}–${max} characters.`);
}

export default function Community({
  view,
  demo,
  userId,
  profile,
}: FeatureProps & { view: "community" | "institutions" }) {
  const who = demo ? "demo-student" : userId;
  const name = profile?.full_name || "Student";
  const [data, setData] = useState<Graph | null>(null);
  const [selected, setSelected] = useState("");
  const [tab, setTab] = useState<"feed" | "events" | "members" | "moderation">(
    "feed",
  );
  const [directory, setDirectory] = useState(false);
  const [creating, setCreating] = useState(false);
  const [consent, setConsent] = useState(false);
  const [displayName, setDisplayName] = useState(name);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reportTarget, setReportTarget] = useState("");
  const [deleteTarget, setDeleteTarget] = useState("");
  const load = useCallback(async () => {
    if (demo) {
      let next = seed(who, name);
      try {
        const saved = localStorage.getItem(demoKey);
        if (saved) {
          const parsed = JSON.parse(saved) as Graph;
          if (
            parsed.version === 1 &&
            Array.isArray(parsed.groups) &&
            Array.isArray(parsed.institutionMembers)
          )
            next = parsed;
        }
      } catch {
        /* A broken or blocked local store does not break the demo. */
      }
      setData(next);
      return;
    }
    const client = browserClient();
    async function directory<T>(functionName: string): Promise<T[]> {
      const { data, error } = await client.rpc(functionName);
      if (error) throw error;
      return (data || []) as T[];
    }
    const [
      groupDirectory,
      members,
      posts,
      events,
      reports,
      audit,
      blocks,
      institutionDirectory,
      institutionMembers,
      announcements,
      joinedGroups,
      joinedInstitutions,
    ] = await Promise.all([
      directory<Group>("community_directory"),
      loadTableRows<Member>("community_members", "group_id", "user_id"),
      loadTableRows<Post>("community_posts"),
      loadTableRows<Event>("community_events"),
      loadTableRows<Report>("community_reports"),
      loadTableRows<Audit>("community_audit"),
      loadTableRows<Graph["blocks"][number]>("community_blocks", "blocked_id"),
      directory<Institution>("institution_directory"),
      loadTableRows<InstitutionMember>(
        "institution_members",
        "institution_id",
        "user_id",
      ),
      loadTableRows<Announcement>("institution_announcements"),
      loadTableRows<Group>("community_groups"),
      loadTableRows<Institution>("institutions"),
    ]);
    // Preserve joined spaces even when they fall outside the bounded directory.
    const groups = Array.from(
      new Map<string, Group>(
        [...groupDirectory, ...joinedGroups].map((g) => [g.id, g]),
      ).values(),
    );
    const institutions = Array.from(
      new Map<string, Institution>(
        [...institutionDirectory, ...joinedInstitutions].map((i) => [i.id, i]),
      ).values(),
    );
    setData({
      version: 1,
      groups,
      members,
      posts: posts.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      events: events.sort((a, b) => a.starts_at.localeCompare(b.starts_at)),
      reports: reports.sort((a, b) => b.created_at.localeCompare(a.created_at)),
      audit: audit
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .slice(0, 100),
      blocks,
      institutions,
      institutionMembers,
      announcements: announcements.sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
    });
  }, [demo, who, name]);
  useEffect(() => {
    void load().catch((e) => setError(failure(e)));
  }, [load]);

  async function rpc(functionName: string, args: Record<string, unknown>) {
    const result = await browserClient().rpc(functionName, args);
    if (result.error) throw result.error;
  }
  async function operate(
    message: string,
    update: (old: Graph) => Graph,
    remote: () => Promise<void>,
  ) {
    if (!data || busy) return false;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      if (demo) {
        const next = update(structuredClone(data));
        localStorage.setItem(demoKey, JSON.stringify(next));
        setData(next);
      } else {
        await remote();
        await load();
      }
      setNotice(message);
      return true;
    } catch (e) {
      setError(failure(e));
      return false;
    } finally {
      setBusy(false);
    }
  }
  const myGroups =
    data?.groups.filter((group) =>
      data.members.some((m) => m.group_id === group.id && m.user_id === who),
    ) || [];
  const group = myGroups.find((g) => g.id === selected) || myGroups[0];
  const membership = data?.members.find(
    (m) => m.group_id === group?.id && m.user_id === who,
  );
  const moderator =
    membership?.role === "owner" || membership?.role === "moderator";
  const members = data?.members.filter((m) => m.group_id === group?.id) || [];
  const authorName = (id: string) =>
    members.find((m) => m.user_id === id)?.display_name || "Former member";
  const blocked = (id: string) =>
    data?.blocks.some((b) => b.blocker_id === who && b.blocked_id === id);
  const posts =
    data?.posts.filter(
      (p) =>
        p.group_id === group?.id &&
        (moderator || (!p.hidden && !blocked(p.author_id))),
    ) || [];
  const reports =
    data?.reports.filter(
      (r) => r.group_id === group?.id && r.status === "open",
    ) || [];

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const title = field(form, "name"),
      description = field(form, "description"),
      kind = field(form, "kind") as Group["kind"],
      display = field(form, "display_name");
    try {
      checkLength(title, 2, 100, "Group name");
      checkLength(display, 2, 80, "Display name");
      if (form.get("consent") !== "on")
        throw new Error("Please give consent before creating a group.");
    } catch (e) {
      setError(failure(e));
      return;
    }
    const id = uid();
    if (
      await operate(
        "Your group is ready. Share only information you want members to see.",
        (old) => ({
          ...old,
          groups: [{ id, name: title, description, kind }, ...old.groups],
          members: [
            ...old.members,
            {
              group_id: id,
              user_id: who,
              display_name: display,
              role: "owner",
            },
          ],
        }),
        async () => {
          const result = await browserClient().rpc("create_community_group", {
            p_name: title,
            p_description: description,
            p_kind: kind,
            p_display_name: display,
            p_consent: true,
          });
          if (result.error) throw result.error;
          setSelected(result.data as string);
        },
      )
    ) {
      if (demo) setSelected(id);
      setCreating(false);
      setDirectory(false);
    }
  }
  async function joinGroup(id: string) {
    try {
      checkLength(displayName.trim(), 2, 80, "Display name");
      if (!consent) throw new Error("Consent is required to join a group.");
    } catch (e) {
      setError(failure(e));
      return;
    }
    if (
      await operate(
        "You joined the group. Your private academic workspace stays private.",
        (old) => ({
          ...old,
          members: [
            ...old.members,
            {
              group_id: id,
              user_id: who,
              display_name: displayName.trim(),
              role: "member",
            },
          ],
        }),
        () =>
          rpc("join_community_group", {
            p_group: id,
            p_display_name: displayName.trim(),
            p_consent: true,
          }),
      )
    ) {
      setSelected(id);
      setDirectory(false);
      setConsent(false);
    }
  }
  async function sharePost(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!group) return;
    const element = event.currentTarget,
      form = new FormData(element);
    const title = field(form, "title"),
      body = field(form, "body"),
      resource_url = field(form, "resource_url");
    try {
      checkLength(title, 2, 160, "Title");
      checkLength(body, 1, 6000, "Post");
      if (
        resource_url &&
        (new URL(resource_url).protocol !== "https:" || /\s/.test(resource_url))
      )
        throw new Error("Resource links must use HTTPS.");
    } catch (e) {
      setError(failure(e));
      return;
    }
    const post: Post = {
      id: uid(),
      group_id: group.id,
      author_id: who,
      title,
      body,
      resource_url,
      hidden: false,
      created_at: now(),
    };
    if (
      await operate(
        "Post shared with your group.",
        (old) => ({ ...old, posts: [post, ...old.posts] }),
        async () => {
          const result = await browserClient()
            .from("community_posts")
            .insert(post);
          if (result.error) throw result.error;
        },
      )
    )
      element.reset();
  }
  async function createEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!group) return;
    const element = event.currentTarget,
      form = new FormData(element);
    const title = field(form, "title"),
      location = field(form, "location"),
      date = new Date(field(form, "starts_at"));
    try {
      checkLength(title, 2, 160, "Event title");
      checkLength(location, 2, 200, "Location");
      if (!Number.isFinite(date.getTime()))
        throw new Error("Choose a valid event date and time.");
    } catch (e) {
      setError(failure(e));
      return;
    }
    const entry: Event = {
      id: uid(),
      group_id: group.id,
      creator_id: who,
      title,
      starts_at: date.toISOString(),
      location,
      details: field(form, "details"),
    };
    if (
      await operate(
        "Event added to your group.",
        (old) => ({ ...old, events: [...old.events, entry] }),
        async () => {
          const result = await browserClient()
            .from("community_events")
            .insert(entry);
          if (result.error) throw result.error;
        },
      )
    )
      element.reset();
  }
  async function submitReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!group) return;
    const reason = field(new FormData(event.currentTarget), "reason");
    try {
      checkLength(reason, 5, 1000, "Reason");
      if (
        data?.reports.some(
          (r) => r.post_id === reportTarget && r.reporter_id === who,
        )
      )
        throw new Error("You have already reported this post.");
    } catch (e) {
      setError(failure(e));
      return;
    }
    if (
      await operate(
        "Report sent to this group's moderators. Other members cannot see it.",
        (old) => ({
          ...old,
          reports: [
            ...old.reports,
            {
              id: uid(),
              group_id: group.id,
              post_id: reportTarget,
              reporter_id: who,
              reason,
              status: "open",
              created_at: now(),
            },
          ],
        }),
        () =>
          rpc("report_community_post", {
            p_post: reportTarget,
            p_reason: reason,
          }),
      )
    )
      setReportTarget("");
  }
  async function resolveReport(report: Report, remove: boolean) {
    await operate(
      remove ? "Post removed and report resolved." : "Report dismissed.",
      (old) => ({
        ...old,
        reports: old.reports.map((r) =>
          r.id === report.id
            ? { ...r, status: remove ? "removed" : "dismissed" }
            : r,
        ),
        posts: old.posts.map((p) =>
          p.id === report.post_id && remove ? { ...p, hidden: true } : p,
        ),
        audit: [
          {
            id: uid(),
            group_id: report.group_id,
            actor_id: who,
            action: remove ? "report_removed" : "report_dismissed",
            target_id: report.post_id,
            created_at: now(),
          },
          ...old.audit,
        ],
      }),
      () =>
        rpc("resolve_community_report", {
          p_report: report.id,
          p_remove: remove,
        }),
    );
  }
  async function toggleBlock(member: Member) {
    const exists = blocked(member.user_id);
    await operate(
      exists
        ? "Member unblocked."
        : "Member blocked. Their posts are hidden from your regular feed; moderators can still review them.",
      (old) => ({
        ...old,
        blocks: exists
          ? old.blocks.filter(
              (b) => b.blocked_id !== member.user_id || b.blocker_id !== who,
            )
          : [...old.blocks, { blocker_id: who, blocked_id: member.user_id }],
      }),
      async () => {
        const client = browserClient();
        const result = exists
          ? await client
              .from("community_blocks")
              .delete()
              .eq("blocker_id", who)
              .eq("blocked_id", member.user_id)
          : await client
              .from("community_blocks")
              .insert({ blocker_id: who, blocked_id: member.user_id });
        if (result.error) throw result.error;
      },
    );
  }
  async function changeModerator(member: Member) {
    const enabled = member.role !== "moderator";
    await operate(
      enabled ? "Moderator assigned." : "Moderator access removed.",
      (old) => ({
        ...old,
        members: old.members.map((m) =>
          m.group_id === member.group_id && m.user_id === member.user_id
            ? { ...m, role: enabled ? "moderator" : "member" }
            : m,
        ),
        audit: [
          {
            id: uid(),
            group_id: member.group_id,
            actor_id: who,
            action: enabled ? "moderator_added" : "moderator_removed",
            target_id: member.user_id,
            created_at: now(),
          },
          ...old.audit,
        ],
      }),
      () =>
        rpc("set_community_moderator", {
          p_group: member.group_id,
          p_member: member.user_id,
          p_enabled: enabled,
        }),
    );
  }
  async function deleteGroup() {
    if (!group) return;
    const id = group.id;
    if (
      await operate(
        "Group and its shared content deleted.",
        (old) => ({
          ...old,
          groups: old.groups.filter((g) => g.id !== id),
          members: old.members.filter((m) => m.group_id !== id),
          posts: old.posts.filter((p) => p.group_id !== id),
          events: old.events.filter((e) => e.group_id !== id),
          reports: old.reports.filter((r) => r.group_id !== id),
          audit: old.audit.filter((a) => a.group_id !== id),
        }),
        () => rpc("delete_community_group", { p_group: id }),
      )
    ) {
      setDeleteTarget("");
      setSelected("");
    }
  }
  async function joinInstitution(id: string) {
    try {
      checkLength(displayName.trim(), 2, 80, "Display name");
      if (!consent)
        throw new Error(
          "Consent is required to join an institution workspace.",
        );
    } catch (e) {
      setError(failure(e));
      return;
    }
    if (
      await operate(
        "Institution workspace joined. Your academic records remain private.",
        (old) => ({
          ...old,
          institutionMembers: [
            ...old.institutionMembers,
            {
              institution_id: id,
              user_id: who,
              display_name: displayName.trim(),
              role: "student",
            },
          ],
        }),
        () =>
          rpc("join_institution", {
            p_institution: id,
            p_display_name: displayName.trim(),
            p_consent: true,
          }),
      )
    )
      setConsent(false);
  }
  async function publishAnnouncement(
    event: FormEvent<HTMLFormElement>,
    institutionId: string,
  ) {
    event.preventDefault();
    const element = event.currentTarget,
      form = new FormData(element),
      title = field(form, "title"),
      body = field(form, "body");
    try {
      checkLength(title, 2, 160, "Title");
      checkLength(body, 1, 6000, "Announcement");
    } catch (e) {
      setError(failure(e));
      return;
    }
    if (
      await operate(
        "Announcement published.",
        (old) => ({
          ...old,
          announcements: [
            {
              id: uid(),
              institution_id: institutionId,
              author_id: who,
              title,
              body,
              created_at: now(),
            },
            ...old.announcements,
          ],
        }),
        () =>
          rpc("publish_institution_announcement", {
            p_institution: institutionId,
            p_title: title,
            p_body: body,
          }),
      )
    )
      element.reset();
  }

  return (
    <section className="community-workspace">
      {view === "community" && (
        <div className="feature-tabs">
          <button
            aria-expanded={creating}
            onClick={() => {
              setCreating(!creating);
              setDirectory(false);
            }}
          >
            Create a group
          </button>
        </div>
      )}
      {demo && (
        <div className="notice">
          Demo community · sample members, verification and announcements are
          simulated. Changes stay in this browser.
        </div>
      )}
      {error && (
        <div className="notice error" role="alert">
          {error}{" "}
          {!data && (
            <button
              className="secondary"
              onClick={() => void load().catch((e) => setError(failure(e)))}
            >
              Retry
            </button>
          )}
        </div>
      )}
      {notice && (
        <div className="notice success" role="status">
          {notice}
        </div>
      )}
      {!data && !error && (
        <div className="feature-card" role="status">
          Loading your community…
        </div>
      )}
      {data && view === "institutions" && (
        <>
          <div className="feature-card">
            <ShieldCheck size={24} />
            <h2>You choose what to share</h2>
            <p>
              Joining shares your chosen display name with the institution. Your
              subjects, grades, notes, attendance and other academic records are
              never shared. Membership is voluntary and does not verify your
              enrolment. Only independently verified staff can publish official
              announcements.
            </p>
          </div>
          <div className="feature-card feature-form">
            <h2>Join a campus workspace</h2>
            <label>
              Display name
              <input
                maxLength={80}
                minLength={2}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </label>
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={consent}
                onChange={(e) => setConsent(e.target.checked)}
              />{" "}
              I agree to share my display name with the institution I join.
            </label>
          </div>
          <div className="feature-grid">
            {data.institutions.map((institution) => {
              const joined = data.institutionMembers.find(
                (m) => m.institution_id === institution.id && m.user_id === who,
              );
              const announcements = data.announcements.filter(
                (a) => a.institution_id === institution.id,
              );
              return (
                <article className="feature-card" key={institution.id}>
                  <span className="eyebrow">
                    <ShieldCheck size={15} />{" "}
                    {demo
                      ? "Sample verified institution"
                      : "Verified institution"}
                  </span>
                  <h2>{institution.name}</h2>
                  <p>{institution.domain}</p>
                  {!joined ? (
                    <button
                      disabled={busy || !consent}
                      onClick={() => void joinInstitution(institution.id)}
                    >
                      Join workspace
                    </button>
                  ) : (
                    <>
                      <div className="item-row">
                        <span>Joined as {joined.role}</span>
                        <button
                          className="secondary"
                          disabled={busy}
                          onClick={() =>
                            void operate(
                              "You left the institution workspace.",
                              (old) => ({
                                ...old,
                                institutionMembers:
                                  old.institutionMembers.filter(
                                    (m) =>
                                      m.institution_id !== institution.id ||
                                      m.user_id !== who,
                                  ),
                              }),
                              () =>
                                rpc("leave_institution", {
                                  p_institution: institution.id,
                                }),
                            )
                          }
                        >
                          Leave workspace
                        </button>
                      </div>
                      <h3>Official announcements</h3>
                      {announcements.length === 0 ? (
                        <p>No announcements yet.</p>
                      ) : (
                        <div className="item-list">
                          {announcements.map((a) => (
                            <article key={a.id}>
                              <h3>{a.title}</h3>
                              <p style={{ whiteSpace: "pre-wrap" }}>{a.body}</p>
                              <small>{dateLabel(a.created_at)}</small>
                            </article>
                          ))}
                        </div>
                      )}
                      {joined.role === "staff" && (
                        <form
                          className="feature-form"
                          onSubmit={(event) =>
                            void publishAnnouncement(event, institution.id)
                          }
                        >
                          <h3>Publish an announcement</h3>
                          <label>
                            Title
                            <input
                              name="title"
                              required
                              minLength={2}
                              maxLength={160}
                            />
                          </label>
                          <label>
                            Message
                            <textarea
                              name="body"
                              required
                              maxLength={6000}
                              rows={4}
                            />
                          </label>
                          <button disabled={busy}>Publish announcement</button>
                        </form>
                      )}
                    </>
                  )}
                </article>
              );
            })}
          </div>
          {data.institutions.length === 0 && (
            <div className="empty">
              <ShieldCheck />
              <h2>No verified institutions yet</h2>
              <p>
                CampusHub operators must verify and provision each institution
                and its staff before it appears here. Your personal workspace
                works for any college without joining an institution.
              </p>
            </div>
          )}
        </>
      )}
      {data && view === "community" && (
        <>
          {creating && (
            <form className="feature-card feature-form" onSubmit={createGroup}>
              <h2>Create a club or study group</h2>
              <label>
                Group name
                <input
                  name="name"
                  required
                  minLength={2}
                  maxLength={100}
                  placeholder="e.g. First-year maths circle"
                />
              </label>
              <label>
                Type
                <select name="kind">
                  <option value="study">Study group</option>
                  <option value="club">Campus club</option>
                </select>
              </label>
              <label>
                Description
                <textarea
                  name="description"
                  maxLength={1000}
                  rows={3}
                  placeholder="Who is this group for?"
                />
              </label>
              <label>
                Your display name
                <input
                  name="display_name"
                  defaultValue={name}
                  required
                  minLength={2}
                  maxLength={80}
                />
              </label>
              <label className="checkbox-label">
                <input name="consent" type="checkbox" required /> I agree to
                share my display name. The group name and description will
                appear in the directory; posts and events are for members.
              </label>
              <div className="feature-tabs">
                <button disabled={busy}>Create group</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setCreating(false)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
          <div className="feature-tabs">
            <button
              aria-pressed={!directory}
              className={!directory ? "" : "secondary"}
              onClick={() => setDirectory(false)}
            >
              My groups ({myGroups.length})
            </button>
            <button
              aria-pressed={directory}
              className={directory ? "" : "secondary"}
              onClick={() => setDirectory(true)}
            >
              Discover groups
            </button>
          </div>
          {directory ? (
            <>
              <div className="feature-card feature-form">
                <h2>Make yourself at home</h2>
                <p>
                  Directory names are visible to signed-in students. Group
                  posts, resources, events and member lists become visible only
                  after you join. Anything you post is shared with all group
                  members.
                </p>
                <label>
                  Display name
                  <input
                    value={displayName}
                    minLength={2}
                    maxLength={80}
                    onChange={(e) => setDisplayName(e.target.value)}
                  />
                </label>
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                  />{" "}
                  I agree to share my display name with members of the group I
                  join.
                </label>
              </div>
              <div className="feature-grid">
                {data.groups.map((g) => (
                  <article className="feature-card" key={g.id}>
                    <span className="eyebrow">
                      {g.kind === "study" ? "Study group" : "Campus club"}
                    </span>
                    <h2>{g.name}</h2>
                    <p>{g.description || "A new space to connect."}</p>
                    {myGroups.some((m) => m.id === g.id) ? (
                      <button
                        className="secondary"
                        onClick={() => {
                          setSelected(g.id);
                          setDirectory(false);
                        }}
                      >
                        Open group
                      </button>
                    ) : (
                      <button
                        disabled={busy || !consent}
                        onClick={() => void joinGroup(g.id)}
                      >
                        Join group
                      </button>
                    )}
                  </article>
                ))}
              </div>
              {data.groups.length === 0 && (
                <div className="empty">
                  <Users />
                  <h2>Start something together</h2>
                  <p>
                    Create the first study group or club and invite students to
                    find it in the directory.
                  </p>
                </div>
              )}
            </>
          ) : !group ? (
            <div className="empty">
              <Users />
              <h2>Find your people</h2>
              <p>Join a study group or create a campus club to get started.</p>
              <button onClick={() => setDirectory(true)}>
                Discover groups
              </button>
            </div>
          ) : (
            <>
              <div className="feature-card">
                <div className="item-row">
                  <div>
                    <label>
                      Choose your group
                      <select
                        value={group.id}
                        onChange={(e) => {
                          setSelected(e.target.value);
                          setTab("feed");
                          setReportTarget("");
                          setDeleteTarget("");
                        }}
                      >
                        {myGroups.map((g) => (
                          <option key={g.id} value={g.id}>
                            {g.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <p>{group.description}</p>
                    <small>
                      {members.length}{" "}
                      {members.length === 1 ? "member" : "members"} ·{" "}
                      {membership?.role}
                    </small>
                  </div>
                  {membership?.role === "owner" ? (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() => setDeleteTarget(group.id)}
                    >
                      Delete group
                    </button>
                  ) : (
                    <button
                      className="secondary"
                      disabled={busy}
                      onClick={() =>
                        void operate(
                          "You left the group. Your shared posts remain available to its members.",
                          (old) => ({
                            ...old,
                            members: old.members.filter(
                              (m) =>
                                m.group_id !== group.id || m.user_id !== who,
                            ),
                          }),
                          () =>
                            rpc("leave_community_group", { p_group: group.id }),
                        )
                      }
                    >
                      Leave group
                    </button>
                  )}
                </div>
                {deleteTarget === group.id && (
                  <div className="notice">
                    <p>
                      Delete “{group.name}” and all its shared posts, events and
                      reports? This cannot be undone.
                    </p>
                    <div className="feature-tabs">
                      <button
                        disabled={busy}
                        onClick={() => void deleteGroup()}
                      >
                        Confirm delete group
                      </button>
                      <button
                        className="secondary"
                        onClick={() => setDeleteTarget("")}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="feature-tabs" aria-label="Group sections">
                {(
                  [
                    ["feed", "Discussion"],
                    ["events", "Events"],
                    ["members", "Members"],
                    ...(moderator
                      ? [["moderation", `Moderation (${reports.length})`]]
                      : []),
                  ] as [typeof tab, string][]
                ).map(([value, label]) => (
                  <button
                    key={value}
                    aria-pressed={tab === value}
                    className={tab === value ? "" : "secondary"}
                    onClick={() => setTab(value)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {tab === "feed" && (
                <>
                  <form
                    className="feature-card feature-form"
                    onSubmit={sharePost}
                  >
                    <h2>Share with your group</h2>
                    <label>
                      Post title
                      <input
                        name="title"
                        required
                        minLength={2}
                        maxLength={160}
                        placeholder="A question, a resource, a small win…"
                      />
                    </label>
                    <label>
                      Message
                      <textarea
                        name="body"
                        required
                        maxLength={6000}
                        rows={3}
                        placeholder="Start a thoughtful conversation."
                      />
                    </label>
                    <label>
                      Resource link (optional)
                      <input
                        name="resource_url"
                        type="url"
                        pattern="https://.*"
                        maxLength={2000}
                        placeholder="https://…"
                      />
                    </label>
                    <small>
                      Share only resources you have permission to distribute.
                      Private notes are never posted automatically.
                    </small>
                    <button disabled={busy}>Share post</button>
                  </form>
                  <div className="item-list">
                    {posts.map((post) => (
                      <article className="feature-card" key={post.id}>
                        <div className="item-row">
                          <span className="eyebrow">
                            {authorName(post.author_id)}
                          </span>
                          <small>{dateLabel(post.created_at)}</small>
                        </div>
                        <h2>
                          {post.title} {post.hidden && <small>· Removed</small>}
                        </h2>
                        <p
                          style={{
                            whiteSpace: "pre-wrap",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {post.body}
                        </p>
                        {post.resource_url &&
                          /^https:\/\//.test(post.resource_url) && (
                            <p>
                              <a
                                href={post.resource_url}
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                Open shared resource <ExternalLink size={14} />
                              </a>
                            </p>
                          )}
                        <div className="feature-tabs">
                          {!post.hidden && (
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => setReportTarget(post.id)}
                            >
                              Report post
                            </button>
                          )}
                          {!post.hidden &&
                            (post.author_id === who || moderator) && (
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() =>
                                  void operate(
                                    "Post removed from the group feed.",
                                    (old) => ({
                                      ...old,
                                      posts: old.posts.map((p) =>
                                        p.id === post.id
                                          ? { ...p, hidden: true }
                                          : p,
                                      ),
                                      audit: [
                                        {
                                          id: uid(),
                                          group_id: group.id,
                                          actor_id: who,
                                          action: "post_removed",
                                          target_id: post.id,
                                          created_at: now(),
                                        },
                                        ...old.audit,
                                      ],
                                    }),
                                    () =>
                                      rpc("remove_community_post", {
                                        p_post: post.id,
                                      }),
                                  )
                                }
                              >
                                Remove post
                              </button>
                            )}
                        </div>
                        {reportTarget === post.id && (
                          <form
                            className="feature-form"
                            onSubmit={submitReport}
                          >
                            <label>
                              Reason for reporting
                              <textarea
                                name="reason"
                                required
                                minLength={5}
                                maxLength={1000}
                                rows={2}
                                placeholder="Tell the moderators what needs attention."
                              />
                            </label>
                            <div className="feature-tabs">
                              <button disabled={busy}>Submit report</button>
                              <button
                                className="secondary"
                                type="button"
                                onClick={() => setReportTarget("")}
                              >
                                Cancel
                              </button>
                            </div>
                          </form>
                        )}
                      </article>
                    ))}
                  </div>
                  {posts.length === 0 && (
                    <div className="feature-card">
                      <h2>Your next conversation starts here</h2>
                      <p>
                        Be the first to share a question or useful resource.
                      </p>
                    </div>
                  )}
                </>
              )}
              {tab === "events" && (
                <>
                  <form
                    className="feature-card feature-form"
                    onSubmit={createEvent}
                  >
                    <h2>Plan something together</h2>
                    <label>
                      Event title
                      <input
                        name="title"
                        required
                        minLength={2}
                        maxLength={160}
                      />
                    </label>
                    <label>
                      Date and time (your local time)
                      <input name="starts_at" type="datetime-local" required />
                    </label>
                    <label>
                      Location or meeting details
                      <input
                        name="location"
                        required
                        minLength={2}
                        maxLength={200}
                      />
                    </label>
                    <label>
                      Description
                      <textarea name="details" maxLength={2000} rows={3} />
                    </label>
                    <button disabled={busy}>Add group event</button>
                  </form>
                  <div className="feature-grid">
                    {data.events
                      .filter((e) => e.group_id === group.id)
                      .sort((a, b) => a.starts_at.localeCompare(b.starts_at))
                      .map((event) => (
                        <article className="feature-card" key={event.id}>
                          <CalendarDays size={24} />
                          <h2>{event.title}</h2>
                          <p>{dateLabel(event.starts_at)}</p>
                          <p>{event.location}</p>
                          <p>{event.details}</p>
                          {(moderator || event.creator_id === who) && (
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() =>
                                void operate(
                                  "Event removed.",
                                  (old) => ({
                                    ...old,
                                    events: old.events.filter(
                                      (e) => e.id !== event.id,
                                    ),
                                  }),
                                  async () => {
                                    const result = await browserClient()
                                      .from("community_events")
                                      .delete()
                                      .eq("id", event.id);
                                    if (result.error) throw result.error;
                                  },
                                )
                              }
                            >
                              Remove event
                            </button>
                          )}
                        </article>
                      ))}
                  </div>
                  {!data.events.some((e) => e.group_id === group.id) && (
                    <div className="feature-card">
                      No group events yet. Add a study session or club meetup.
                    </div>
                  )}
                </>
              )}
              {tab === "members" && (
                <div className="feature-card">
                  <h2>People in this group</h2>
                  <p>
                    Blocking hides a member’s posts in your regular feed.
                    Moderators retain access to reported content for review.
                  </p>
                  <div className="item-list">
                    {members.map((member) => (
                      <div className="item-row" key={member.user_id}>
                        <div>
                          <strong>
                            {member.display_name}
                            {member.user_id === who ? " (you)" : ""}
                          </strong>
                          <p>
                            {member.role}
                            {blocked(member.user_id) ? " · Blocked" : ""}
                          </p>
                        </div>
                        {member.user_id !== who && (
                          <div className="feature-tabs">
                            <button
                              className="secondary"
                              disabled={busy}
                              onClick={() => void toggleBlock(member)}
                            >
                              {blocked(member.user_id)
                                ? "Unblock member"
                                : "Block member"}
                            </button>
                            {membership?.role === "owner" && (
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() => void changeModerator(member)}
                              >
                                {member.role === "moderator"
                                  ? "Remove moderator"
                                  : "Make moderator"}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {tab === "moderation" && moderator && (
                <>
                  <div className="feature-card">
                    <h2>Moderation queue</h2>
                    <p>
                      Reports are visible only to the reporter and this group’s
                      moderators. Decisions are recorded in the audit log.
                    </p>
                    {reports.length === 0 ? (
                      <p>No open reports. You’re all caught up.</p>
                    ) : (
                      <div className="item-list">
                        {reports.map((report) => (
                          <article key={report.id}>
                            <h3>
                              {data.posts.find((p) => p.id === report.post_id)
                                ?.title || "Reported post"}
                            </h3>
                            <p>{report.reason}</p>
                            <small>{dateLabel(report.created_at)}</small>
                            <div className="feature-tabs">
                              <button
                                disabled={busy}
                                onClick={() => void resolveReport(report, true)}
                              >
                                Remove reported post
                              </button>
                              <button
                                className="secondary"
                                disabled={busy}
                                onClick={() =>
                                  void resolveReport(report, false)
                                }
                              >
                                Dismiss report
                              </button>
                            </div>
                          </article>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="feature-card">
                    <h2>Moderation audit</h2>
                    <div className="item-list">
                      {data.audit
                        .filter((a) => a.group_id === group.id)
                        .map((a) => (
                          <div className="item-row" key={a.id}>
                            <span>
                              {a.action.replaceAll("_", " ")} ·{" "}
                              {authorName(a.actor_id)}
                            </span>
                            <small>{dateLabel(a.created_at)}</small>
                          </div>
                        ))}
                    </div>
                    {!data.audit.some((a) => a.group_id === group.id) && (
                      <p>Moderator decisions will appear here.</p>
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </>
      )}
    </section>
  );
}
