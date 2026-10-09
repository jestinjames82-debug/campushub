export type AcademicTask = {
  title: string;
  subject_id: string;
  kind: "assignment" | "exam" | "reminder";
  due: string;
  completed: boolean;
  notes: string;
};
export type ClassSlot = {
  subject_id: string;
  weekday: number;
  start: string;
  end: string;
  room: string;
  startsOn: string;
  endsOn: string;
  cancelledDates: string[];
};
export type AttendanceEntry = {
  subject_id: string;
  date: string;
  session: string;
  status: "present" | "absent" | "excused";
};
export type AcademicGoal = {
  type: "attendance" | "academic";
  subject_id: string;
  target: number;
  title: string;
  due: string;
  completed: boolean;
};
export type Assessment = {
  subject_id: string;
  name: string;
  score: number | null;
  maxScore: number;
  weight: number;
};
export type GradeBand = { minimum: number; points: number; label: string };
export type GradeScale = { name: string; bands: GradeBand[] };
export type CreditSubject = { id: string; term_id: string; credits: number };

export function localDate(date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}

export function shiftDate(value: string, days: number): string {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function mondayOf(value: string): string {
  const weekday = new Date(`${value}T12:00:00Z`).getUTCDay();
  return shiftDate(value, -(weekday === 0 ? 6 : weekday - 1));
}

export function validateClass(slot: ClassSlot): string {
  if (!slot.subject_id) return "Choose a subject for this class.";
  if (!Number.isInteger(slot.weekday) || slot.weekday < 0 || slot.weekday > 6)
    return "Choose a valid weekday.";
  if (
    ![slot.start, slot.end].every((time) =>
      /^([01]\d|2[0-3]):[0-5]\d$/.test(time),
    ) ||
    slot.start >= slot.end
  )
    return "Class end time must be after its start time.";
  if (
    !validDate(slot.startsOn) ||
    !validDate(slot.endsOn) ||
    slot.endsOn < slot.startsOn
  )
    return "Choose a valid date range for this class.";
  return "";
}

export function classOccurs(slot: ClassSlot, date: string): boolean {
  return (
    validDate(date) &&
    date >= slot.startsOn &&
    date <= slot.endsOn &&
    new Date(`${date}T12:00:00Z`).getUTCDay() === slot.weekday &&
    !slot.cancelledDates.includes(date)
  );
}

export function classesConflict(a: ClassSlot, b: ClassSlot): boolean {
  if (
    validateClass(a) ||
    validateClass(b) ||
    a.weekday !== b.weekday ||
    a.end <= b.start ||
    b.end <= a.start
  )
    return false;
  const first = a.startsOn > b.startsOn ? a.startsOn : b.startsOn;
  const last = a.endsOn < b.endsOn ? a.endsOn : b.endsOn;
  const weekday = new Date(`${first}T12:00:00Z`).getUTCDay();
  let date = shiftDate(first, (a.weekday - weekday + 7) % 7);
  while (date <= last) {
    if (classOccurs(a, date) && classOccurs(b, date)) return true;
    date = shiftDate(date, 7);
  }
  return false;
}

export function attendanceForecast(
  entries: Pick<AttendanceEntry, "status">[],
  target: number,
) {
  const present = entries.filter((entry) => entry.status === "present").length;
  const absent = entries.filter((entry) => entry.status === "absent").length;
  const excused = entries.filter((entry) => entry.status === "excused").length;
  const total = present + absent;
  const percentage = total > 0 ? (present / total) * 100 : null;
  if (!Number.isFinite(target) || target <= 0 || target > 100) {
    return {
      present,
      absent,
      excused,
      total,
      percentage,
      needed: null,
      canMiss: null,
      validTarget: false,
    };
  }
  const ratio = target / 100;
  const needed =
    total === 0 || present >= ratio * total
      ? 0
      : ratio === 1
        ? null
        : Math.max(
            0,
            Math.ceil((ratio * total - present) / (1 - ratio) - 1e-9),
          );
  const canMiss =
    total === 0 ? 0 : Math.max(0, Math.floor(present / ratio - total + 1e-9));
  return {
    present,
    absent,
    excused,
    total,
    percentage,
    needed,
    canMiss,
    validTarget: true,
  };
}

export function validateAssessment(assessment: Assessment): string {
  if (!assessment.subject_id || !assessment.name.trim())
    return "Choose a subject and enter an assessment name.";
  if (!Number.isFinite(assessment.maxScore) || assessment.maxScore <= 0)
    return "Maximum marks must be greater than zero.";
  if (
    !Number.isFinite(assessment.weight) ||
    assessment.weight <= 0 ||
    assessment.weight > 100
  )
    return "Assessment weight must be between 0 and 100%.";
  if (
    assessment.score !== null &&
    (!Number.isFinite(assessment.score) ||
      assessment.score < 0 ||
      assessment.score > assessment.maxScore)
  )
    return "Marks must be between zero and the maximum, or blank for pending.";
  return "";
}

export function weightedMark(assessments: Assessment[]) {
  const valid = assessments.every(
    (assessment) => !validateAssessment(assessment),
  );
  const totalWeight = assessments.reduce(
    (total, assessment) => total + assessment.weight,
    0,
  );
  const marked = assessments.filter((assessment) => assessment.score !== null);
  const markedWeight = marked.reduce(
    (total, assessment) => total + assessment.weight,
    0,
  );
  const weightedPoints = marked.reduce(
    (total, assessment) =>
      total + (assessment.score! / assessment.maxScore) * assessment.weight,
    0,
  );
  const percentage =
    valid && markedWeight > 0 ? (weightedPoints / markedWeight) * 100 : null;
  const complete =
    valid &&
    assessments.length > 0 &&
    marked.length === assessments.length &&
    Math.abs(totalWeight - 100) < 1e-6;
  return {
    percentage,
    totalWeight,
    markedWeight,
    complete,
    valid: valid && totalWeight <= 100 + 1e-6,
  };
}

export function validateGradeScale(bands: GradeBand[]): string {
  if (!bands.length)
    return "Add your institution's grading thresholds before calculating GPA.";
  const ordered = [...bands].sort((a, b) => a.minimum - b.minimum);
  if (ordered[0].minimum !== 0)
    return "Include a threshold starting at 0% so every mark has a grade.";
  for (let index = 0; index < ordered.length; index++) {
    const band = ordered[index];
    if (
      !Number.isFinite(band.minimum) ||
      band.minimum < 0 ||
      band.minimum > 100 ||
      !Number.isFinite(band.points) ||
      band.points < 0 ||
      band.points > 100 ||
      !band.label.trim()
    )
      return "Each threshold needs a percentage from 0–100, non-negative points up to 100, and a label.";
    if (
      index > 0 &&
      (band.minimum === ordered[index - 1].minimum ||
        band.points < ordered[index - 1].points)
    )
      return "Thresholds must be unique, and points must increase or stay equal as marks increase.";
  }
  return "";
}

export function gradeFor(
  percentage: number,
  bands: GradeBand[],
): GradeBand | null {
  if (
    !Number.isFinite(percentage) ||
    percentage < 0 ||
    percentage > 100 ||
    validateGradeScale(bands)
  )
    return null;
  return (
    [...bands]
      .sort((a, b) => b.minimum - a.minimum)
      .find((band) => percentage >= band.minimum) ?? null
  );
}

export function calculateGpa(
  subjects: CreditSubject[],
  assessments: Assessment[],
  bands: GradeBand[],
  termId?: string,
) {
  const included = subjects.filter(
    (subject) =>
      (!termId || subject.term_id === termId) &&
      Number.isFinite(subject.credits) &&
      subject.credits > 0,
  );
  let totalCredits = 0,
    completedCredits = 0,
    points = 0;
  const missingSubjects: string[] = [];
  for (const subject of included) {
    totalCredits += subject.credits;
    const marks = weightedMark(
      assessments.filter((assessment) => assessment.subject_id === subject.id),
    );
    const grade =
      marks.complete && marks.percentage !== null
        ? gradeFor(marks.percentage, bands)
        : null;
    if (grade) {
      completedCredits += subject.credits;
      points += grade.points * subject.credits;
    } else missingSubjects.push(subject.id);
  }
  const complete = included.length > 0 && missingSubjects.length === 0;
  const provisional = completedCredits > 0 ? points / completedCredits : null;
  return {
    gpa: complete ? provisional : null,
    provisional,
    complete,
    totalCredits,
    completedCredits,
    missingSubjects,
  };
}

export function taskUrgency(
  task: Pick<AcademicTask, "due" | "completed">,
  now = new Date(),
): "complete" | "overdue" | "soon" | "upcoming" {
  if (task.completed) return "complete";
  const distance = new Date(indiaDeadline(task.due)).getTime() - now.getTime();
  if (distance < 0) return "overdue";
  if (distance <= 48 * 60 * 60 * 1000) return "soon";
  return "upcoming";
}

export function indiaDeadline(input: string): string {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(input)
    ? `${input}+05:30`
    : input;
}
