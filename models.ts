import { z } from "zod";
export const profileSchema = z.object({
  full_name: z.string().trim().min(2).max(80),
  college: z.string().trim().min(2).max(160),
  programme: z.string().trim().min(2).max(100),
  branch: z.string().trim().max(100),
  admission_year: z.coerce.number().int().min(1980).max(2100),
  term_system: z.enum(["Semester", "Trimester", "Annual"]),
});
export const termSchema = z
  .object({
    name: z.string().trim().min(2).max(80),
    starts_on: z.string().date(),
    ends_on: z.string().date(),
  })
  .refine((v) => v.ends_on >= v.starts_on, {
    message: "End date must be on or after the start date.",
    path: ["ends_on"],
  });
export const subjectSchema = z.object({
  term_id: z.string().uuid(),
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(1).max(20),
  credits: z.coerce.number().min(0).max(30),
  instructor: z.string().trim().max(100),
  color: z.enum(["violet", "blue", "orange", "green"]),
});
export type Profile = z.infer<typeof profileSchema>;
export type Term = z.infer<typeof termSchema> & { id: string; user_id: string };
export type Subject = z.infer<typeof subjectSchema> & {
  id: string;
  user_id: string;
};
export type Workspace = {
  profile: Profile | null;
  terms: Term[];
  subjects: Subject[];
};
export const emptyWorkspace: Workspace = {
  profile: null,
  terms: [],
  subjects: [],
};
export const demoWorkspace: Workspace = {
  profile: {
    full_name: "Aarav Sharma",
    college: "Your College",
    programme: "B.Tech",
    branch: "Computer Science",
    admission_year: 2024,
    term_system: "Semester",
  },
  terms: [
    {
      id: "a0000000-0000-4000-8000-000000000001",
      user_id: "demo",
      name: "Semester 5",
      starts_on: "2026-07-01",
      ends_on: "2026-12-20",
    },
  ],
  subjects: [
    {
      id: "b0000000-0000-4000-8000-000000000001",
      user_id: "demo",
      term_id: "a0000000-0000-4000-8000-000000000001",
      name: "Database Management Systems",
      code: "CS301",
      credits: 4,
      instructor: "Dr. Meera Rao",
      color: "violet",
    },
    {
      id: "b0000000-0000-4000-8000-000000000002",
      user_id: "demo",
      term_id: "a0000000-0000-4000-8000-000000000001",
      name: "Computer Networks",
      code: "CS302",
      credits: 4,
      instructor: "Prof. Arjun Menon",
      color: "blue",
    },
    {
      id: "b0000000-0000-4000-8000-000000000003",
      user_id: "demo",
      term_id: "a0000000-0000-4000-8000-000000000001",
      name: "Design & Analysis of Algorithms",
      code: "CS303",
      credits: 4,
      instructor: "Dr. Priya Nair",
      color: "orange",
    },
    {
      id: "b0000000-0000-4000-8000-000000000004",
      user_id: "demo",
      term_id: "a0000000-0000-4000-8000-000000000001",
      name: "Professional Communication",
      code: "HS301",
      credits: 2,
      instructor: "Prof. Kavya Shah",
      color: "green",
    },
  ],
};
