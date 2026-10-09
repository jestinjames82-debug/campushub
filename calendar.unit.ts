import { test } from "node:test";
import assert from "node:assert/strict";
import { exportCalendar } from "../src/lib/calendar-export.ts";
test("calendar export preserves India deadlines, weekly cancellation and escapes text", () => {
  const ics = exportCalendar(
    [
      {
        id: "task",
        title: "Revise, then practise",
        notes: "first\nsecond",
        due: "2026-10-09T10:00+05:30",
      },
      { id: "done", title: "Done", due: "2026-10-09T10:00", completed: true },
    ],
    [
      {
        id: "class",
        subject_id: "s1",
        weekday: 1,
        start: "09:00",
        end: "10:00",
        startsOn: "2026-10-01",
        endsOn: "2026-10-31",
        cancelledDates: ["2026-10-12"],
        room: "Room 1",
      },
    ],
    [{ id: "s1", name: "Databases" }],
    new Date("2026-10-09T00:00:00Z"),
  );
  assert.match(ics, /DTSTART:20261009T043000Z/);
  assert.match(ics, /DTSTART;TZID=Asia\/Kolkata:20261005T090000/);
  assert.match(ics, /EXDATE;TZID=Asia\/Kolkata:20261012T090000/);
  assert.match(ics, /SUMMARY:Revise\\, then practise/);
  assert.ok(!ics.includes("UID:done"));
  assert.match(ics, /RRULE:FREQ=WEEKLY;UNTIL=20261031T182959Z/);
});
test("calendar folds long Unicode lines on character boundaries", () => {
  const output = exportCalendar(
    [{ id: "task", title: "अध्ययन".repeat(80), due: "2026-10-09T10:00" }],
    [],
  );
  for (const line of output.split("\r\n"))
    assert.ok(new TextEncoder().encode(line).length <= 75);
});
