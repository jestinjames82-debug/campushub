type Entry = Record<string, unknown>;
const escape = (value: unknown) =>
  String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
const dateOnly = (value: unknown) => String(value || "").replace(/-/g, "");
const stamp = (value: Date) =>
  value
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z/, "Z");
function fold(line: string) {
  let output = "",
    bytes = 0;
  for (const char of line) {
    const size = new TextEncoder().encode(char).length;
    if (bytes + size > 74) {
      output += "\r\n ";
      bytes = 1;
    }
    output += char;
    bytes += size;
  }
  return output;
}
export function exportCalendar(
  tasks: Entry[],
  classes: Entry[],
  subjects: { id: string; name: string }[] = [],
  createdAt = new Date(),
) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//CampusHub//Academic Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:CampusHub academic calendar",
    "X-WR-TIMEZONE:Asia/Kolkata",
    "BEGIN:VTIMEZONE",
    "TZID:Asia/Kolkata",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0530",
    "TZOFFSETTO:+0530",
    "TZNAME:IST",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];
  const subjectName = (entry: Entry) =>
    subjects.find(
      (subject) => subject.id === (entry.subject_id || entry.subjectId),
    )?.name || "Class";
  for (const task of tasks) {
    if (task.completed || !task.due) continue;
    const raw = String(task.due);
    const due = new Date(
      /(?:Z|[+-]\d{2}:\d{2})$/.test(raw) ? raw : `${raw}+05:30`,
    );
    if (!Number.isFinite(due.getTime())) continue;
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escape(task.id)}@campushub`,
      `DTSTAMP:${stamp(createdAt)}`,
      `DTSTART:${stamp(due)}`,
      `SUMMARY:${escape(task.title)}`,
      `DESCRIPTION:${escape(task.notes)}`,
      "END:VEVENT",
    );
  }
  for (const slot of classes) {
    const first = new Date(`${slot.startsOn}T12:00:00Z`),
      end = new Date(`${slot.endsOn}T23:59:59+05:30`);
    const weekday = Number(slot.weekday);
    if (
      !Number.isFinite(first.getTime()) ||
      !Number.isFinite(end.getTime()) ||
      weekday < 0 ||
      weekday > 6
    )
      continue;
    first.setUTCDate(
      first.getUTCDate() + ((weekday - first.getUTCDay() + 7) % 7),
    );
    const firstDate = first.toISOString().slice(0, 10);
    if (firstDate > String(slot.endsOn)) continue;
    const start = String(slot.start).replace(":", "") + "00",
      finish = String(slot.end).replace(":", "") + "00";
    lines.push(
      "BEGIN:VEVENT",
      `UID:${escape(slot.id)}@campushub`,
      `DTSTAMP:${stamp(createdAt)}`,
      `DTSTART;TZID=Asia/Kolkata:${dateOnly(firstDate)}T${start}`,
      `DTEND;TZID=Asia/Kolkata:${dateOnly(firstDate)}T${finish}`,
      `RRULE:FREQ=WEEKLY;UNTIL=${stamp(end)}`,
      `SUMMARY:${escape(subjectName(slot))}`,
      `LOCATION:${escape(slot.room)}`,
    );
    const cancelled = Array.isArray(slot.cancelledDates)
      ? slot.cancelledDates
      : [];
    if (cancelled.length)
      lines.push(
        `EXDATE;TZID=Asia/Kolkata:${cancelled.map((day) => `${dateOnly(day)}T${start}`).join(",")}`,
      );
    lines.push("END:VEVENT");
  }
  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}
