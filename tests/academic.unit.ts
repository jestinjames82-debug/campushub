import test from "node:test";
import assert from "node:assert/strict";
import {
  attendanceForecast,
  calculateGpa,
  classesConflict,
  classOccurs,
  gradeFor,
  indiaDeadline,
  localDate,
  mondayOf,
  shiftDate,
  taskUrgency,
  validDate,
  validateAssessment,
  validateClass,
  validateGradeScale,
  weightedMark,
  type Assessment,
  type ClassSlot,
} from "../src/lib/academic.ts";

const bands = [
  { minimum: 90, points: 10, label: "O" },
  { minimum: 80, points: 9, label: "A" },
  { minimum: 60, points: 7, label: "B" },
  { minimum: 40, points: 5, label: "P" },
  { minimum: 0, points: 0, label: "F" },
];
const assessment = (overrides: Partial<Assessment> = {}): Assessment => ({
  subject_id: "s1",
  name: "Final exam",
  score: 80,
  maxScore: 100,
  weight: 100,
  ...overrides,
});
const slot = (overrides: Partial<ClassSlot> = {}): ClassSlot => ({
  subject_id: "s1",
  weekday: 1,
  start: "09:00",
  end: "10:00",
  room: "101",
  startsOn: "2026-10-01",
  endsOn: "2026-10-31",
  cancelledDates: [],
  ...overrides,
});

test("weighted marks use each assessment's scale and weight", () => {
  const result = weightedMark([
    assessment({ score: 18, maxScore: 20, weight: 25 }),
    assessment({ score: 60, maxScore: 100, weight: 75 }),
  ]);
  assert.equal(result.percentage, 67.5);
  assert.equal(result.complete, true);
});

test("pending and missing assessment weights do not become a final grade", () => {
  const pending = weightedMark([
    assessment({ score: 20, maxScore: 25, weight: 40 }),
    assessment({ score: null, weight: 60 }),
  ]);
  assert.equal(pending.percentage, 80);
  assert.equal(pending.markedWeight, 40);
  assert.equal(pending.complete, false);
  assert.equal(weightedMark([assessment({ weight: 60 })]).complete, false);
  assert.equal(weightedMark([]).percentage, null);
  assert.equal(weightedMark([]).complete, false);
});

test("invalid scores, zero maximum and overweight plans are rejected", () => {
  assert.ok(validateAssessment(assessment({ score: 101 })));
  assert.ok(validateAssessment(assessment({ score: -1 })));
  assert.ok(validateAssessment(assessment({ maxScore: 0 })));
  assert.ok(validateAssessment(assessment({ weight: NaN })));
  assert.equal(validateAssessment(assessment({ score: 0 })), "");
  assert.equal(
    weightedMark([assessment({ weight: 75 }), assessment({ weight: 40 })])
      .valid,
    false,
  );
  assert.equal(
    weightedMark([assessment({ weight: 75 }), assessment({ weight: 40 })])
      .complete,
    false,
  );
});

test("custom grades have inclusive boundaries and complete coverage", () => {
  assert.equal(validateGradeScale(bands), "");
  assert.equal(gradeFor(80, bands)?.points, 9);
  assert.equal(gradeFor(79.99, bands)?.points, 7);
  assert.equal(gradeFor(0, bands)?.points, 0);
  assert.equal(gradeFor(100, bands)?.points, 10);
  assert.equal(gradeFor(101, bands), null);
  assert.ok(validateGradeScale([{ minimum: 40, points: 5, label: "P" }]));
  assert.ok(
    validateGradeScale([
      ...bands,
      { minimum: 80, points: 8, label: "Duplicate" },
    ]),
  );
  assert.ok(
    validateGradeScale([
      { minimum: 0, points: 10, label: "F" },
      { minimum: 80, points: 5, label: "A" },
    ]),
  );
});

test("CGPA weights actual credits and SGPA selects the requested term", () => {
  const subjects = [
    { id: "s1", term_id: "t1", credits: 4 },
    { id: "s2", term_id: "t2", credits: 2 },
    { id: "s3", term_id: "t1", credits: 0 },
  ];
  const results = [
    assessment({ score: 95 }),
    assessment({ subject_id: "s2", score: 65 }),
  ];
  const cumulative = calculateGpa(subjects, results, bands);
  assert.equal(cumulative.gpa, 9);
  assert.equal(cumulative.totalCredits, 6);
  assert.equal(cumulative.completedCredits, 6);
  assert.equal(cumulative.complete, true);
  assert.equal(calculateGpa(subjects, results, bands, "t1").gpa, 10);
  assert.equal(calculateGpa(subjects, results, bands, "t2").gpa, 7);
});

test("incomplete credits retain only a clearly provisional average", () => {
  const subjects = [
    { id: "s1", term_id: "t1", credits: 4 },
    { id: "s2", term_id: "t1", credits: 2 },
  ];
  const result = calculateGpa(subjects, [assessment()], bands);
  assert.equal(result.gpa, null);
  assert.equal(result.provisional, 9);
  assert.equal(result.completedCredits, 4);
  assert.deepEqual(result.missingSubjects, ["s2"]);
  assert.equal(calculateGpa(subjects, [assessment()], []).provisional, null);
  assert.equal(
    calculateGpa([{ id: "audit", term_id: "t1", credits: 0 }], [], bands).gpa,
    null,
  );
  assert.equal(calculateGpa([], [], bands).gpa, null);
});

test("failed grades count as zero points rather than missing credits", () => {
  const result = calculateGpa(
    [{ id: "s1", term_id: "t1", credits: 4 }],
    [assessment({ score: 0 })],
    bands,
  );
  assert.equal(result.gpa, 0);
  assert.equal(result.completedCredits, 4);
  assert.equal(result.complete, true);
});

test("attendance forecasts the minimum future present sessions", () => {
  const entries = [
    ...Array.from({ length: 6 }, () => ({ status: "present" as const })),
    ...Array.from({ length: 4 }, () => ({ status: "absent" as const })),
    { status: "excused" as const },
  ];
  const result = attendanceForecast(entries, 75);
  assert.equal(result.percentage, 60);
  assert.equal(result.total, 10);
  assert.equal(result.excused, 1);
  assert.equal(result.needed, 6);
  assert.equal(result.canMiss, 0);
  assert.equal(attendanceForecast(entries, 100).needed, null);
});

test("attendance handles exact boundaries, missed-class allowance and empty history", () => {
  const allPresent = Array.from({ length: 9 }, () => ({
    status: "present" as const,
  }));
  assert.equal(attendanceForecast(allPresent, 75).canMiss, 3);
  assert.equal(
    attendanceForecast(
      [
        ...allPresent,
        { status: "absent" },
        { status: "absent" },
        { status: "absent" },
      ],
      75,
    ).needed,
    0,
  );
  assert.equal(attendanceForecast([], 75).percentage, null);
  assert.equal(
    attendanceForecast([{ status: "excused" }], 75).percentage,
    null,
  );
  assert.equal(attendanceForecast(allPresent, 0).validTarget, false);
  assert.equal(attendanceForecast(allPresent, NaN).validTarget, false);
});

test("timetable overlaps require an actual shared recurrence", () => {
  assert.equal(
    classesConflict(slot(), slot({ start: "09:30", end: "10:30" })),
    true,
  );
  assert.equal(
    classesConflict(slot(), slot({ start: "10:00", end: "11:00" })),
    false,
  );
  assert.equal(classesConflict(slot(), slot({ weekday: 2 })), false);
  assert.equal(
    classesConflict(
      slot(),
      slot({ startsOn: "2026-11-01", endsOn: "2026-11-30" }),
    ),
    false,
  );
  assert.equal(
    classesConflict(
      slot({ startsOn: "2026-10-06", endsOn: "2026-10-09" }),
      slot(),
    ),
    false,
  );
});

test("cancelled occurrences are excluded without cancelling the series", () => {
  const cancelled = slot({
    startsOn: "2026-10-05",
    endsOn: "2026-10-12",
    cancelledDates: ["2026-10-05"],
  });
  assert.equal(classOccurs(cancelled, "2026-10-05"), false);
  assert.equal(classOccurs(cancelled, "2026-10-12"), true);
  assert.equal(
    classesConflict(
      cancelled,
      slot({ startsOn: "2026-10-05", endsOn: "2026-10-05" }),
    ),
    false,
  );
  assert.equal(classesConflict(cancelled, slot()), true);
  assert.ok(validateClass(slot({ start: "11:00", end: "10:00" })));
  assert.ok(validateClass(slot({ startsOn: "2026-02-30" })));
});

test("calendar date arithmetic remains valid over month and year changes", () => {
  assert.equal(validDate("2026-02-30"), false);
  assert.equal(validDate("2028-02-29"), true);
  assert.equal(shiftDate("2026-12-31", 1), "2027-01-01");
  assert.equal(mondayOf("2026-10-11"), "2026-10-05");
  assert.equal(localDate(new Date("2026-10-08T20:00:00Z")), "2026-10-09");
});

test("deadline reminders use India time consistently across devices", () => {
  const now = new Date("2026-10-08T10:00:00Z");
  assert.equal(indiaDeadline("2026-10-08T15:30"), "2026-10-08T15:30+05:30");
  assert.equal(
    indiaDeadline("2026-10-08T15:30+05:30"),
    "2026-10-08T15:30+05:30",
  );
  assert.equal(
    taskUrgency({ due: "2026-10-08T15:29", completed: false }, now),
    "overdue",
  );
  assert.equal(
    taskUrgency({ due: "2026-10-10T15:30+05:30", completed: false }, now),
    "soon",
  );
  assert.equal(
    taskUrgency({ due: "2026-10-10T15:31+05:30", completed: false }, now),
    "upcoming",
  );
  assert.equal(
    taskUrgency({ due: "2026-01-01T10:00", completed: true }, now),
    "complete",
  );
});
