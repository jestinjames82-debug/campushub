"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { useRecords, type FeatureProps } from "@/lib/records";
import {
  attendanceForecast,
  calculateGpa,
  classesConflict,
  classOccurs,
  gradeFor,
  localDate,
  mondayOf,
  shiftDate,
  taskUrgency,
  validateAssessment,
  indiaDeadline,
  validateClass,
  validateGradeScale,
  weightedMark,
  type AcademicGoal,
  type AcademicTask,
  type Assessment,
  type AttendanceEntry,
  type ClassSlot,
  type GradeScale,
} from "@/lib/academic";

type Saved<T> = T & { id: string };
const weekdays = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const dateLabel = (date: string) =>
  new Date(`${date}T12:00:00+05:30`).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    weekday: "short",
  });
const dueLabel = (date: string) =>
  new Date(indiaDeadline(date)).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
const text = (form: FormData, key: string) =>
  String(form.get(key) ?? "").trim();
const number = (form: FormData, key: string) => Number(text(form, key));
const round = (value: number | null, suffix = "") =>
  value === null ? "—" : `${value.toFixed(2)}${suffix}`;

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label>
      {label}
      {children}
    </label>
  );
}
function Empty({ children }: { children: ReactNode }) {
  return <p className="empty">{children}</p>;
}
function Metric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
function SubjectSelect({
  subjects,
  value = "",
  optional = false,
}: Pick<FeatureProps, "subjects"> & { value?: string; optional?: boolean }) {
  return (
    <select name="subject_id" defaultValue={value} required={!optional}>
      <option value="">
        {optional ? "General / no subject" : "Choose a subject"}
      </option>
      {subjects.map((subject) => (
        <option key={subject.id} value={subject.id}>
          {subject.code} · {subject.name}
        </option>
      ))}
    </select>
  );
}
function useOperation() {
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  async function run(action: () => Promise<void>, success: string) {
    if (busy) return;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      setMessage(success);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not save this change. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return { busy, message, error, run };
}

export default function AcademicTools(
  props: FeatureProps & { view: "planner" | "performance" },
) {
  return props.view === "planner" ? (
    <Planner {...props} />
  ) : (
    <Performance {...props} />
  );
}

function Planner({ demo, userId, subjects, terms }: FeatureProps) {
  const tasks = useRecords<AcademicTask>("task", demo, userId);
  const classes = useRecords<ClassSlot>("class", demo, userId);
  const attendance = useRecords<AttendanceEntry>("attendance", demo, userId);
  const goals = useRecords<AcademicGoal>("goal", demo, userId);
  const operation = useOperation();
  const [tab, setTab] = useState("deadlines");
  const [taskEditor, setTaskEditor] = useState<
    Saved<AcademicTask> | "new" | null
  >(null);
  const [classEditor, setClassEditor] = useState<
    Saved<ClassSlot> | "new" | null
  >(null);
  const [week, setWeek] = useState(() => mondayOf(localDate()));
  const [now, setNow] = useState(() => new Date());
  const [taskFilter, setTaskFilter] = useState("open");
  const [attendanceSubject, setAttendanceSubject] = useState("");
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const subjectName = (id: string) =>
    subjects.find((subject) => subject.id === id)?.name ??
    (id ? "Removed subject" : "General");
  const subjectExists = (id: string) =>
    subjects.some((subject) => subject.id === id);
  const openTasks = tasks.items.filter((task) => !task.completed);
  const reminders = openTasks
    .filter((task) => ["overdue", "soon"].includes(taskUrgency(task, now)))
    .sort((a, b) => a.due.localeCompare(b.due));
  const errors = [
    operation.error,
    tasks.error,
    classes.error,
    attendance.error,
    goals.error,
  ].filter(Boolean);
  const days = Array.from({ length: 7 }, (_, index) => shiftDate(week, index));
  const selectedTask = taskEditor && taskEditor !== "new" ? taskEditor : null;
  const selectedClass =
    classEditor && classEditor !== "new" ? classEditor : null;
  const filteredAttendance = attendance.items.filter(
    (entry) => !attendanceSubject || entry.subject_id === attendanceSubject,
  );
  const loading =
    tasks.loading || classes.loading || attendance.loading || goals.loading;

  function saveTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void operation.run(async () => {
      const data: AcademicTask = {
        title: text(form, "title"),
        subject_id: text(form, "subject_id"),
        kind: text(form, "kind") as AcademicTask["kind"],
        due: indiaDeadline(text(form, "due")),
        notes: text(form, "notes"),
        completed: selectedTask?.completed ?? false,
      };
      if (!data.title || !Number.isFinite(new Date(data.due).getTime()))
        throw new Error("Enter a title and valid deadline.");
      if (data.subject_id && !subjectExists(data.subject_id))
        throw new Error("Choose an existing subject.");
      await tasks.save(data, selectedTask?.id);
      setTaskEditor(null);
    }, "Deadline saved.");
  }
  function saveClass(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void operation.run(async () => {
      const data: ClassSlot = {
        subject_id: text(form, "subject_id"),
        weekday: number(form, "weekday"),
        start: text(form, "start"),
        end: text(form, "end"),
        room: text(form, "room"),
        startsOn: text(form, "startsOn"),
        endsOn: text(form, "endsOn"),
        cancelledDates: selectedClass?.cancelledDates ?? [],
      };
      const error = validateClass(data);
      if (error) throw new Error(error);
      if (!subjectExists(data.subject_id))
        throw new Error("Choose an existing subject.");
      const conflict = classes.items.find(
        (slot) => slot.id !== selectedClass?.id && classesConflict(data, slot),
      );
      if (conflict)
        throw new Error(
          `This overlaps with ${subjectName(conflict.subject_id)} at ${conflict.start}–${conflict.end}. Choose another time.`,
        );
      await classes.save(data, selectedClass?.id);
      setClassEditor(null);
    }, "Weekly class saved.");
  }
  function saveAttendance(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget;
    const form = new FormData(element);
    void operation.run(async () => {
      const entry: AttendanceEntry = {
        subject_id: text(form, "subject_id"),
        date: text(form, "date"),
        session: text(form, "session"),
        status: text(form, "status") as AttendanceEntry["status"],
      };
      if (!subjectExists(entry.subject_id))
        throw new Error("Choose an existing subject.");
      if (entry.date > localDate())
        throw new Error(
          "Attendance can only be logged for today or a past date.",
        );
      if (!entry.session)
        throw new Error("Enter a session name or time to identify this class.");
      if (
        attendance.items.some(
          (item) =>
            item.subject_id === entry.subject_id &&
            item.date === entry.date &&
            item.session.toLowerCase() === entry.session.toLowerCase(),
        )
      )
        throw new Error(
          "That session is already logged. Change its status in the log below.",
        );
      await attendance.save(entry);
      element.reset();
    }, "Attendance logged.");
  }
  function saveTarget(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void operation.run(async () => {
      const subject_id = text(form, "subject_id"),
        target = number(form, "target");
      if (!subjectExists(subject_id) || target <= 0 || target > 100)
        throw new Error("Choose a subject and a target above 0%, up to 100%.");
      const current = goals.items.find(
        (goal) => goal.type === "attendance" && goal.subject_id === subject_id,
      );
      await goals.save(
        {
          type: "attendance",
          subject_id,
          target,
          title: "Attendance target",
          due: "",
          completed: false,
        },
        current?.id,
      );
    }, "Attendance target saved.");
  }

  function restoreOccurrence(slot: Saved<ClassSlot>, date: string) {
    void operation.run(async () => {
      const restored = {
        ...slot,
        cancelledDates: slot.cancelledDates.filter((value) => value !== date),
      };
      const conflict = classes.items.find(
        (other) => other.id !== slot.id && classesConflict(restored, other),
      );
      if (conflict)
        throw new Error(
          `Restoring this class would overlap with ${subjectName(conflict.subject_id)}. Edit the conflicting class first.`,
        );
      await classes.save(restored, slot.id);
    }, "Class occurrence restored.");
  }

  return (
    <section aria-label="Academic organiser">
      {demo ? (
        <div className="notice">
          Demo workspace · Changes stay in this browser. Add your own planner
          entries to try the tools.
        </div>
      ) : null}
      {errors.length ? (
        <div className="notice error" role="alert">
          {errors.join(" ")}
        </div>
      ) : null}
      {operation.message ? (
        <div className="notice success" role="status">
          {operation.message}
        </div>
      ) : null}
      {loading ? <p role="status">Loading organiser…</p> : null}
      <div className="metric-grid">
        <Metric label="Open deadlines" value={openTasks.length} />
        <Metric
          label="Due within 48 hours / overdue"
          value={reminders.length}
        />
        <Metric label="Weekly class slots" value={classes.items.length} />
        <Metric label="Attendance entries" value={attendance.items.length} />
      </div>
      {reminders.length ? (
        <aside className="notice" aria-label="Due reminders">
          <strong>On your radar</strong>
          <ul>
            {reminders.slice(0, 5).map((task) => (
              <li key={task.id}>
                {taskUrgency(task, now) === "overdue" ? "Overdue" : "Due soon"}:{" "}
                {task.title} · {dueLabel(task.due)}
              </li>
            ))}
          </ul>
          <small>
            Reminders appear here while the app is open; no email or push
            notifications are sent.
          </small>
        </aside>
      ) : null}
      <div className="feature-tabs" aria-label="Organiser views">
        {[
          ["deadlines", "Deadlines"],
          ["timetable", "Timetable"],
          ["attendance", "Attendance"],
          ["calendar", "Calendar"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "button" : "secondary"}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "deadlines" ? (
        <section className="feature-card">
          <div className="page-heading">
            <div>
              <h2>Assignments & exams</h2>
              <p>All deadline times are India Standard Time (IST).</p>
            </div>
            <button
              disabled={loading || operation.busy}
              onClick={() => setTaskEditor("new")}
            >
              Add deadline
            </button>
          </div>
          {taskEditor ? (
            <form
              className="feature-form"
              key={selectedTask?.id ?? "new-task"}
              onSubmit={saveTask}
            >
              <h3>{selectedTask ? "Edit deadline" : "New deadline"}</h3>
              <div className="form-grid">
                <Field label="Title">
                  <input
                    name="title"
                    required
                    maxLength={160}
                    defaultValue={selectedTask?.title}
                    placeholder="Submit database assignment"
                  />
                </Field>
                <Field label="Type">
                  <select
                    name="kind"
                    defaultValue={selectedTask?.kind ?? "assignment"}
                  >
                    <option value="assignment">Assignment</option>
                    <option value="exam">Exam</option>
                    <option value="reminder">Reminder</option>
                  </select>
                </Field>
                <Field label="Subject">
                  <SubjectSelect
                    subjects={subjects}
                    optional
                    value={selectedTask?.subject_id}
                  />
                </Field>
                <Field label="Due date & time">
                  <input
                    name="due"
                    type="datetime-local"
                    required
                    defaultValue={selectedTask?.due.slice(0, 16)}
                  />
                </Field>
                <Field label="Notes">
                  <textarea
                    name="notes"
                    maxLength={3000}
                    defaultValue={selectedTask?.notes}
                    placeholder="What needs to get done?"
                  />
                </Field>
              </div>
              <div className="feature-tabs">
                <button disabled={operation.busy}>Save deadline</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setTaskEditor(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          <Field label="Show deadlines">
            <select
              value={taskFilter}
              onChange={(event) => setTaskFilter(event.target.value)}
            >
              <option value="open">Open</option>
              <option value="complete">Completed</option>
              <option value="all">All deadlines</option>
            </select>
          </Field>
          <ul className="item-list">
            {tasks.items
              .filter(
                (task) =>
                  taskFilter === "all" ||
                  task.completed === (taskFilter === "complete"),
              )
              .sort((a, b) => a.due.localeCompare(b.due))
              .map((task) => (
                <li className="item-row" key={task.id}>
                  <div>
                    <strong>{task.title}</strong>
                    <p>
                      {task.kind} · {subjectName(task.subject_id)} ·{" "}
                      {dueLabel(task.due)}
                    </p>
                    {task.notes ? <p>{task.notes}</p> : null}
                    <span className="badge">{taskUrgency(task, now)}</span>
                  </div>
                  <div className="feature-tabs">
                    <button
                      className="secondary"
                      disabled={operation.busy}
                      onClick={() =>
                        void operation.run(
                          () =>
                            tasks.save(
                              { ...task, completed: !task.completed },
                              task.id,
                            ),
                          task.completed
                            ? "Deadline reopened."
                            : "Marked complete.",
                        )
                      }
                    >
                      {task.completed ? "Reopen" : "Complete"}
                    </button>
                    <button
                      className="secondary"
                      disabled={operation.busy}
                      onClick={() => setTaskEditor(task)}
                    >
                      Edit
                    </button>
                    <button
                      className="secondary"
                      aria-label={`Delete ${task.title}`}
                      disabled={operation.busy}
                      onClick={() =>
                        void operation.run(
                          () => tasks.remove(task.id),
                          "Deadline deleted.",
                        )
                      }
                    >
                      Delete
                    </button>
                  </div>
                </li>
              ))}
          </ul>
          {!tasks.items.some(
            (task) =>
              taskFilter === "all" ||
              task.completed === (taskFilter === "complete"),
          ) ? (
            <Empty>
              No {taskFilter === "all" ? "" : taskFilter} deadlines here. Add an
              assignment, exam or reminder.
            </Empty>
          ) : null}
        </section>
      ) : null}

      {tab === "timetable" || tab === "calendar" ? (
        <>
          <div className="feature-tabs">
            <button
              className="secondary"
              onClick={() => setWeek(shiftDate(week, -7))}
            >
              Previous week
            </button>
            <Field label="Week containing">
              <input
                type="date"
                value={week}
                onChange={(event) => {
                  if (event.target.value) setWeek(mondayOf(event.target.value));
                }}
              />
            </Field>
            <button
              className="secondary"
              onClick={() => setWeek(mondayOf(localDate()))}
            >
              This week
            </button>
            <button
              className="secondary"
              onClick={() => setWeek(shiftDate(week, 7))}
            >
              Next week
            </button>
            {tab === "timetable" ? (
              <button
                disabled={!subjects.length || loading || operation.busy}
                onClick={() => setClassEditor("new")}
              >
                Add weekly class
              </button>
            ) : null}
          </div>
          {!subjects.length ? (
            <div className="notice">
              Add subjects first to build your timetable.
            </div>
          ) : null}
          {tab === "timetable" && classEditor ? (
            <form
              className="feature-form"
              key={selectedClass?.id ?? "new-class"}
              onSubmit={saveClass}
            >
              <h3>
                {selectedClass ? "Edit weekly class" : "New weekly class"}
              </h3>
              <div className="form-grid">
                <Field label="Subject">
                  <SubjectSelect
                    subjects={subjects}
                    value={selectedClass?.subject_id}
                  />
                </Field>
                <Field label="Weekday">
                  <select
                    name="weekday"
                    defaultValue={selectedClass?.weekday ?? 1}
                  >
                    {weekdays.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Starts at">
                  <input
                    name="start"
                    type="time"
                    required
                    defaultValue={selectedClass?.start}
                  />
                </Field>
                <Field label="Ends at">
                  <input
                    name="end"
                    type="time"
                    required
                    defaultValue={selectedClass?.end}
                  />
                </Field>
                <Field label="From date">
                  <input
                    name="startsOn"
                    type="date"
                    required
                    defaultValue={
                      selectedClass?.startsOn ??
                      terms[0]?.starts_on ??
                      localDate()
                    }
                  />
                </Field>
                <Field label="Until date">
                  <input
                    name="endsOn"
                    type="date"
                    required
                    defaultValue={selectedClass?.endsOn ?? terms[0]?.ends_on}
                  />
                </Field>
                <Field label="Room or meeting location">
                  <input
                    name="room"
                    maxLength={160}
                    defaultValue={selectedClass?.room}
                  />
                </Field>
              </div>
              <div className="feature-tabs">
                <button disabled={operation.busy}>Save weekly class</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setClassEditor(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          <div className="feature-grid">
            {days.map((day) => {
              const slots = classes.items
                .filter((slot) => classOccurs(slot, day))
                .sort((a, b) => a.start.localeCompare(b.start));
              const deadlines =
                tab === "calendar"
                  ? tasks.items
                      .filter((task) => task.due.slice(0, 10) === day)
                      .sort((a, b) => a.due.localeCompare(b.due))
                  : [];
              return (
                <section className="feature-card" key={day}>
                  <h3>
                    {dateLabel(day)}
                    {day === localDate() ? " · Today" : ""}
                  </h3>
                  <ul className="item-list">
                    {slots.map((slot) => (
                      <li className="item-row" key={slot.id}>
                        <div>
                          <strong>
                            {slot.start}–{slot.end}
                          </strong>
                          <p>{subjectName(slot.subject_id)}</p>
                          <small>{slot.room || "Location not set"}</small>
                        </div>
                        {tab === "timetable" ? (
                          <button
                            className="secondary"
                            disabled={operation.busy}
                            aria-label={`Cancel ${subjectName(slot.subject_id)} on ${day}`}
                            onClick={() =>
                              void operation.run(
                                () =>
                                  classes.save(
                                    {
                                      ...slot,
                                      cancelledDates: [
                                        ...slot.cancelledDates,
                                        day,
                                      ],
                                    },
                                    slot.id,
                                  ),
                                "This occurrence was cancelled. Other weeks are unchanged.",
                              )
                            }
                          >
                            Cancel this class
                          </button>
                        ) : null}
                      </li>
                    ))}
                    {deadlines.map((task) => (
                      <li className="item-row" key={task.id}>
                        <div>
                          <strong>
                            {task.kind}: {task.title}
                          </strong>
                          <p>
                            {dueLabel(task.due)} ·{" "}
                            {task.completed ? "Completed" : "Open"}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!slots.length && !deadlines.length ? (
                    <Empty>
                      No {tab === "calendar" ? "events" : "classes"}.
                    </Empty>
                  ) : null}
                </section>
              );
            })}
          </div>
          {tab === "timetable" ? (
            <section className="feature-card">
              <h2>Recurring class slots</h2>
              <ul className="item-list">
                {classes.items.map((slot) => (
                  <li className="item-row" key={slot.id}>
                    <div>
                      <strong>{subjectName(slot.subject_id)}</strong>
                      <p>
                        {weekdays[slot.weekday]} · {slot.start}–{slot.end} ·{" "}
                        {slot.startsOn} to {slot.endsOn}
                      </p>
                      {slot.cancelledDates.length ? (
                        <div>
                          <small>Cancelled dates</small>
                          <div className="feature-tabs">
                            {slot.cancelledDates.map((date) => (
                              <button
                                key={date}
                                className="secondary"
                                disabled={operation.busy}
                                onClick={() => restoreOccurrence(slot, date)}
                              >
                                Restore {date}
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                    <div className="feature-tabs">
                      <button
                        className="secondary"
                        disabled={operation.busy}
                        onClick={() => setClassEditor(slot)}
                      >
                        Edit
                      </button>
                      <button
                        className="secondary"
                        disabled={operation.busy}
                        aria-label={`Delete weekly ${subjectName(slot.subject_id)}`}
                        onClick={() =>
                          void operation.run(
                            () => classes.remove(slot.id),
                            "Weekly class deleted.",
                          )
                        }
                      >
                        Delete series
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {!classes.items.length ? (
                <Empty>
                  Your weekly schedule is empty. Add a class to get started.
                </Empty>
              ) : null}
            </section>
          ) : null}
        </>
      ) : null}

      {tab === "attendance" ? (
        <>
          <div className="notice">
            Attendance uses the sessions you log. Excused sessions are excluded
            from the denominator; choose this only when your college allows it.
            Set each subject&apos;s actual attendance requirement for a
            forecast.
          </div>
          <div className="feature-grid">
            <form className="feature-form" onSubmit={saveAttendance}>
              <h2>Log attendance</h2>
              <div className="form-grid">
                <Field label="Subject">
                  <SubjectSelect subjects={subjects} />
                </Field>
                <Field label="Session date">
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={localDate()}
                    max={localDate()}
                  />
                </Field>
                <Field label="Session name / time">
                  <input
                    name="session"
                    required
                    maxLength={80}
                    placeholder="09:00 lecture"
                  />
                </Field>
                <Field label="Status">
                  <select name="status">
                    <option value="present">Present</option>
                    <option value="absent">Absent</option>
                    <option value="excused">Excused</option>
                  </select>
                </Field>
              </div>
              <button disabled={operation.busy || loading || !subjects.length}>
                Log attendance
              </button>
            </form>
            <form className="feature-form" onSubmit={saveTarget}>
              <h2>Attendance requirement</h2>
              <Field label="Subject">
                <SubjectSelect subjects={subjects} />
              </Field>
              <Field label="Required attendance (%)">
                <input
                  name="target"
                  type="number"
                  min="0.01"
                  max="100"
                  step="0.01"
                  required
                  placeholder="Your institution’s requirement"
                />
              </Field>
              <button disabled={operation.busy || loading || !subjects.length}>
                Save target
              </button>
            </form>
          </div>
          <div className="feature-grid">
            {subjects.map((subject) => {
              const target = goals.items.find(
                (goal) =>
                  goal.type === "attendance" && goal.subject_id === subject.id,
              )?.target;
              const summary = attendanceForecast(
                attendance.items.filter(
                  (entry) => entry.subject_id === subject.id,
                ),
                target ?? NaN,
              );
              return (
                <section key={subject.id} className="feature-card">
                  <h3>{subject.name}</h3>
                  <strong>{round(summary.percentage, "%")}</strong>
                  <p>
                    {summary.present} present / {summary.total} counted ·{" "}
                    {summary.excused} excused
                  </p>
                  {target ? (
                    <p>
                      Target: {target}%.{" "}
                      {summary.total === 0
                        ? "Log your first session to see a forecast."
                        : summary.needed === null
                          ? "100% cannot be recovered after an absence."
                          : summary.needed > 0
                            ? `Attend the next ${summary.needed} sessions to reach your target.`
                            : `At target. You can miss ${summary.canMiss} additional session(s) while staying at or above it.`}
                    </p>
                  ) : (
                    <p>Set a target to see your attendance forecast.</p>
                  )}
                </section>
              );
            })}
          </div>
          <section className="feature-card">
            <h2>Attendance log</h2>
            <Field label="Filter subject">
              <select
                value={attendanceSubject}
                onChange={(event) => setAttendanceSubject(event.target.value)}
              >
                <option value="">All subjects</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </Field>
            <ul className="item-list">
              {[...filteredAttendance]
                .sort((a, b) => b.date.localeCompare(a.date))
                .map((entry) => (
                  <li className="item-row" key={entry.id}>
                    <div>
                      <strong>{subjectName(entry.subject_id)}</strong>
                      <p>
                        {dateLabel(entry.date)} · {entry.session}
                      </p>
                    </div>
                    <div className="feature-tabs">
                      <label>
                        Attendance status
                        <select
                          aria-label={`Status for ${subjectName(entry.subject_id)} ${entry.date} ${entry.session}`}
                          value={entry.status}
                          disabled={operation.busy}
                          onChange={(event) =>
                            void operation.run(
                              () =>
                                attendance.save(
                                  {
                                    ...entry,
                                    status: event.target
                                      .value as AttendanceEntry["status"],
                                  },
                                  entry.id,
                                ),
                              "Attendance updated.",
                            )
                          }
                        >
                          <option value="present">Present</option>
                          <option value="absent">Absent</option>
                          <option value="excused">Excused</option>
                        </select>
                      </label>
                      <button
                        className="secondary"
                        disabled={operation.busy}
                        aria-label={`Delete attendance ${entry.date} ${entry.session}`}
                        onClick={() =>
                          void operation.run(
                            () => attendance.remove(entry.id),
                            "Attendance entry removed.",
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
            </ul>
            {!filteredAttendance.length ? (
              <Empty>No attendance logged for this selection.</Empty>
            ) : null}
          </section>
        </>
      ) : null}
    </section>
  );
}

function Performance({ demo, userId, subjects, terms }: FeatureProps) {
  const assessments = useRecords<Assessment>("assessment", demo, userId);
  const scales = useRecords<GradeScale>("grade_scale", demo, userId);
  const goals = useRecords<AcademicGoal>("goal", demo, userId);
  const operation = useOperation();
  const [tab, setTab] = useState("marks"),
    [termId, setTermId] = useState("");
  const [editor, setEditor] = useState<Saved<Assessment> | "new" | null>(null);
  const current = editor && editor !== "new" ? editor : null;
  const scale = scales.items[0];
  const bands = scale?.bands ?? [];
  const cumulative = calculateGpa(subjects, assessments.items, bands);
  const term = termId
    ? calculateGpa(subjects, assessments.items, bands, termId)
    : null;
  const visibleSubjects = subjects.filter(
    (subject) => !termId || subject.term_id === termId,
  );
  const errors = [
    operation.error,
    assessments.error,
    scales.error,
    goals.error,
  ].filter(Boolean);
  const loading = assessments.loading || scales.loading || goals.loading;
  const academicGoals = goals.items.filter((goal) => goal.type === "academic");
  const subjectName = (id: string) =>
    subjects.find((subject) => subject.id === id)?.name ??
    (id ? "Removed subject" : "All subjects");

  function saveAssessment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void operation.run(async () => {
      const data: Assessment = {
        subject_id: text(form, "subject_id"),
        name: text(form, "name"),
        score: text(form, "score") === "" ? null : number(form, "score"),
        maxScore: number(form, "maxScore"),
        weight: number(form, "weight"),
      };
      const error = validateAssessment(data);
      if (error) throw new Error(error);
      if (!subjects.some((subject) => subject.id === data.subject_id))
        throw new Error("Choose an existing subject.");
      const otherWeight = assessments.items
        .filter(
          (item) =>
            item.subject_id === data.subject_id && item.id !== current?.id,
        )
        .reduce((sum, item) => sum + item.weight, 0);
      if (otherWeight + data.weight > 100 + 1e-6)
        throw new Error(
          `Assessment weights would exceed 100%. This subject has ${Math.max(0, 100 - otherWeight)}% available.`,
        );
      await assessments.save(data, current?.id);
      setEditor(null);
    }, "Assessment saved.");
  }
  function saveScale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    void operation.run(async () => {
      const name = text(form, "name");
      const parsed = text(form, "bands")
        .split(/\r?\n/)
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split(",").map((value) => value.trim());
          if (parts.length !== 3 || !parts[0] || !parts[1])
            throw new Error(
              "Use one threshold per line: minimum percentage, grade points, label.",
            );
          return {
            minimum: Number(parts[0]),
            points: Number(parts[1]),
            label: parts[2],
          };
        });
      const error = validateGradeScale(parsed);
      if (error) throw new Error(error);
      if (!name) throw new Error("Name your grading scale.");
      await scales.save(
        { name, bands: parsed.sort((a, b) => b.minimum - a.minimum) },
        scale?.id,
      );
    }, "Grading scale saved. Your GPA has been recalculated.");
  }
  function saveGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const element = event.currentTarget,
      form = new FormData(element);
    void operation.run(async () => {
      const subject_id = text(form, "subject_id"),
        target = number(form, "target");
      if (subject_id && !subjects.some((subject) => subject.id === subject_id))
        throw new Error("Choose an existing subject.");
      if (target < 0 || target > 100)
        throw new Error("Choose a target between 0 and 100%.");
      await goals.save({
        type: "academic",
        subject_id,
        target,
        title: text(form, "title"),
        due: text(form, "due"),
        completed: false,
      });
      element.reset();
    }, "Academic goal saved.");
  }

  return (
    <section aria-label="Academic performance">
      {errors.length ? (
        <div className="notice error" role="alert">
          {errors.join(" ")}
        </div>
      ) : null}
      {operation.message ? (
        <div className="notice success" role="status">
          {operation.message}
        </div>
      ) : null}
      {loading ? <p role="status">Loading performance…</p> : null}
      <div className="metric-grid">
        <Metric label="CGPA · all subjects" value={round(cumulative.gpa)} />
        <Metric
          label="Completed / total credits"
          value={`${cumulative.completedCredits} / ${cumulative.totalCredits}`}
        />
        <Metric label="Grading scale" value={scale?.name ?? "Not configured"} />
        <Metric
          label="Active goals"
          value={academicGoals.filter((goal) => !goal.completed).length}
        />
      </div>
      <div className="notice">
        GPA is an estimate from your recorded assessments and credit values. A
        subject is complete only when all marks are entered and weights total
        100%. Zero-credit subjects do not affect GPA. Use your
        institution&apos;s official rules for an official result.
      </div>
      {!scale ? (
        <p className="notice">
          Configure your institution&apos;s grade thresholds in Grading scale to
          calculate SGPA and CGPA.
        </p>
      ) : !cumulative.complete && cumulative.totalCredits > 0 ? (
        <p className="notice">
          CGPA is incomplete: {cumulative.missingSubjects.length} credit-bearing
          subject(s) need complete marks.{" "}
          {cumulative.provisional !== null
            ? `Completed-credit average: ${round(cumulative.provisional)}. This is provisional.`
            : "No completed graded credits yet."}
        </p>
      ) : null}
      <div className="feature-tabs" aria-label="Performance views">
        {[
          ["marks", "Marks & GPA"],
          ["scale", "Grading scale"],
          ["goals", "Academic goals"],
        ].map(([value, label]) => (
          <button
            key={value}
            className={tab === value ? "button" : "secondary"}
            aria-pressed={tab === value}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "marks" ? (
        <>
          <div className="feature-tabs">
            <Field label="Academic term">
              <select
                value={termId}
                onChange={(event) => setTermId(event.target.value)}
              >
                <option value="">All terms</option>
                {terms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </Field>
            <button
              disabled={!subjects.length || loading || operation.busy}
              onClick={() => setEditor("new")}
            >
              Add assessment
            </button>
          </div>
          {term ? (
            <div className="notice">
              <strong>SGPA: {round(term.gpa)}</strong> · {term.completedCredits}{" "}
              of {term.totalCredits} credits complete
              {!term.complete ? " · Waiting for complete marks" : ""}
            </div>
          ) : null}
          {editor ? (
            <form
              className="feature-form"
              key={current?.id ?? "new-assessment"}
              onSubmit={saveAssessment}
            >
              <h2>{current ? "Edit assessment" : "New assessment"}</h2>
              <div className="form-grid">
                <Field label="Subject">
                  <SubjectSelect
                    subjects={subjects}
                    value={current?.subject_id}
                  />
                </Field>
                <Field label="Assessment name">
                  <input
                    name="name"
                    required
                    maxLength={160}
                    placeholder="Internal assessment / final exam"
                    defaultValue={current?.name}
                  />
                </Field>
                <Field label="Marks obtained (blank = pending)">
                  <input
                    name="score"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={current?.score ?? ""}
                  />
                </Field>
                <Field label="Maximum marks">
                  <input
                    name="maxScore"
                    type="number"
                    required
                    min="0.01"
                    step="0.01"
                    defaultValue={current?.maxScore}
                  />
                </Field>
                <Field label="Weight in final result (%)">
                  <input
                    name="weight"
                    type="number"
                    required
                    min="0.01"
                    max="100"
                    step="0.01"
                    defaultValue={current?.weight}
                  />
                </Field>
              </div>
              <div className="feature-tabs">
                <button disabled={operation.busy}>Save assessment</button>
                <button
                  type="button"
                  className="secondary"
                  onClick={() => setEditor(null)}
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
          {!visibleSubjects.length ? (
            <Empty>
              Add subjects with their actual credits to track your performance.
            </Empty>
          ) : null}
          <div className="feature-grid">
            {visibleSubjects.map((subject) => {
              const entries = assessments.items.filter(
                (assessment) => assessment.subject_id === subject.id,
              );
              const marks = weightedMark(entries);
              const grade =
                marks.complete && marks.percentage !== null
                  ? gradeFor(marks.percentage, bands)
                  : null;
              return (
                <section className="feature-card" key={subject.id}>
                  <p className="eyebrow">
                    {subject.code} · {subject.credits} credits
                  </p>
                  <h2>{subject.name}</h2>
                  <div className="metric-grid">
                    <Metric
                      label={
                        marks.complete
                          ? "Final weighted marks"
                          : "Current marked average"
                      }
                      value={round(marks.percentage, "%")}
                    />
                    <Metric
                      label="Grade / points"
                      value={
                        grade ? `${grade.label} / ${grade.points}` : "Pending"
                      }
                    />
                  </div>
                  <p>
                    {marks.markedWeight}% marked / {marks.totalWeight}%
                    configured.{" "}
                    {marks.complete
                      ? "Complete."
                      : `${Math.max(0, 100 - marks.totalWeight)}% assessment weight still to configure.`}
                  </p>
                  <ul className="item-list">
                    {entries.map((entry) => (
                      <li className="item-row" key={entry.id}>
                        <div>
                          <strong>{entry.name}</strong>
                          <p>
                            {entry.score === null
                              ? "Pending marks"
                              : `${entry.score} / ${entry.maxScore}`}{" "}
                            · {entry.weight}% weight
                          </p>
                        </div>
                        <div className="feature-tabs">
                          <button
                            className="secondary"
                            disabled={operation.busy}
                            onClick={() => setEditor(entry)}
                          >
                            Edit
                          </button>
                          <button
                            className="secondary"
                            disabled={operation.busy}
                            aria-label={`Delete assessment ${entry.name}`}
                            onClick={() =>
                              void operation.run(
                                () => assessments.remove(entry.id),
                                "Assessment removed.",
                              )
                            }
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                  {!entries.length ? (
                    <Empty>No assessments recorded yet.</Empty>
                  ) : null}
                </section>
              );
            })}
          </div>
        </>
      ) : null}

      {tab === "scale" ? (
        <div className="feature-grid">
          <form
            key={
              scale ? `${scale.id}-${JSON.stringify(scale.bands)}` : "new-scale"
            }
            className="feature-form"
            onSubmit={saveScale}
          >
            <h2>Your institution&apos;s grading scale</h2>
            <Field label="Scale name">
              <input
                name="name"
                required
                maxLength={120}
                defaultValue={scale?.name}
                placeholder="College grading policy"
              />
            </Field>
            <Field label="Thresholds: minimum percentage, grade points, label">
              <textarea
                name="bands"
                required
                rows={9}
                defaultValue={scale?.bands
                  .map(
                    (band) => `${band.minimum}, ${band.points}, ${band.label}`,
                  )
                  .join("\n")}
                placeholder={
                  "90, 10, O\n80, 9, A+\n70, 8, A\n60, 7, B+\n50, 6, B\n40, 5, C\n0, 0, F"
                }
              />
            </Field>
            <p>
              Enter your college&apos;s thresholds; the example is illustrative.
              Include a 0% threshold. Bounds are inclusive: a mark of 80 matches
              the row starting at 80. Labels cannot contain commas.
            </p>
            <button disabled={operation.busy || loading}>
              Save grading scale
            </button>
          </form>
          <section className="feature-card">
            <h2>How your GPA is calculated</h2>
            <p>
              Each assessment contributes marks ÷ maximum marks × its weight.
              Completed subjects are mapped to your grade points, then weighted
              by their credit value.
            </p>
            <p>
              <strong>
                GPA = total (grade points × credits) ÷ total credits.
              </strong>
            </p>
            <p>
              SGPA uses the selected term. CGPA uses all saved credit-bearing
              subjects across terms. We keep incomplete results separate and
              never treat pending marks as zero.
            </p>
            {scale ? (
              <ul className="item-list">
                {[...scale.bands]
                  .sort((a, b) => b.minimum - a.minimum)
                  .map((band) => (
                    <li className="item-row" key={band.minimum}>
                      <span>
                        {band.minimum}% and above · {band.label}
                      </span>
                      <strong>{band.points} points</strong>
                    </li>
                  ))}
              </ul>
            ) : (
              <Empty>No scale saved yet.</Empty>
            )}
          </section>
        </div>
      ) : null}

      {tab === "goals" ? (
        <div className="feature-grid">
          <form className="feature-form" onSubmit={saveGoal}>
            <h2>Set an academic goal</h2>
            <Field label="Goal">
              <input
                name="title"
                required
                maxLength={160}
                placeholder="Improve my database result"
              />
            </Field>
            <Field label="Subject">
              <SubjectSelect subjects={subjects} optional />
            </Field>
            <Field label="Target mark (%)">
              <input
                name="target"
                type="number"
                min="0"
                max="100"
                step="0.01"
                required
              />
            </Field>
            <Field label="Target date">
              <input name="due" type="date" required />
            </Field>
            <button disabled={operation.busy || loading}>
              Save academic goal
            </button>
          </form>
          <section className="feature-card">
            <h2>Your goals</h2>
            <ul className="item-list">
              {academicGoals.map((goal) => {
                const marks = goal.subject_id
                  ? weightedMark(
                      assessments.items.filter(
                        (entry) => entry.subject_id === goal.subject_id,
                      ),
                    )
                  : null;
                return (
                  <li className="item-row" key={goal.id}>
                    <div>
                      <strong>{goal.title}</strong>
                      <p>
                        {subjectName(goal.subject_id)} · Target {goal.target}%
                        by {goal.due}
                      </p>
                      {marks ? (
                        <p>
                          Current marked average: {round(marks.percentage, "%")}
                          {marks.complete
                            ? " · Final marks recorded"
                            : " · In progress"}
                        </p>
                      ) : null}
                      <span>{goal.completed ? "Completed" : "Active"}</span>
                    </div>
                    <div className="feature-tabs">
                      <button
                        className="secondary"
                        disabled={operation.busy}
                        onClick={() =>
                          void operation.run(
                            () =>
                              goals.save(
                                { ...goal, completed: !goal.completed },
                                goal.id,
                              ),
                            "Goal updated.",
                          )
                        }
                      >
                        {goal.completed ? "Reopen" : "Complete"}
                      </button>
                      <button
                        className="secondary"
                        disabled={operation.busy}
                        aria-label={`Delete goal ${goal.title}`}
                        onClick={() =>
                          void operation.run(
                            () => goals.remove(goal.id),
                            "Goal removed.",
                          )
                        }
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
            {!academicGoals.length ? (
              <Empty>
                Set a goal to give your next study session a direction.
              </Empty>
            ) : null}
          </section>
        </div>
      ) : null}
    </section>
  );
}
