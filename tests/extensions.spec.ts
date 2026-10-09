import { test, expect } from "@playwright/test";
test("health, manifest and offline fallback avoid caching personal pages", async ({
  page,
  context,
  request,
}) => {
  const health = await request.get("/api/health");
  expect(health.ok()).toBe(true);
  expect(await health.json()).toMatchObject({ status: "ok", version: "2.0.0" });
  const manifest = await request.get("/manifest.webmanifest");
  expect((await manifest.json()).name).toBe("CampusHub");
  const denied = await request.post("/api/study-assistant", {
    headers: { Origin: "https://untrusted.example" },
    data: {},
  });
  expect(denied.status()).toBe(403);
  await page.goto("/");
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await context.setOffline(true);
  await page.goto("/app/dashboard");
  await expect(
    page.getByRole("heading", { name: /A short pause/ }),
  ).toBeVisible();
  await context.setOffline(false);
});
test("planner saves deadlines, validates timetable conflicts and logs attendance", async ({
  page,
}) => {
  await page.goto("/demo/planner");
  await page.getByRole("button", { name: "Add deadline", exact: true }).click();
  await page
    .getByLabel("Title", { exact: true })
    .fill("Finish database assignment");
  await page.getByLabel("Due date & time").fill("2026-10-18T16:00");
  await page.getByRole("button", { name: "Save deadline" }).click();
  await expect(
    page.getByText("Finish database assignment", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByText("Finish database assignment", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Complete", exact: true }).click();
  await page.getByLabel("Show deadlines").selectOption("complete");
  await expect(
    page.getByText("Finish database assignment", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Timetable", exact: true }).click();
  await page.getByRole("button", { name: "Add weekly class" }).click();
  await page
    .getByRole("combobox", { name: "Subject", exact: true })
    .selectOption("b0000000-0000-4000-8000-000000000001");
  await page.getByLabel("Starts at").fill("09:00");
  await page.getByLabel("Ends at").fill("10:00");
  await page.getByRole("button", { name: "Save weekly class" }).click();
  await expect(page.getByRole("status")).toContainText("Weekly class saved");
  await page.getByRole("button", { name: "Add weekly class" }).click();
  await page
    .getByRole("combobox", { name: "Subject", exact: true })
    .selectOption("b0000000-0000-4000-8000-000000000001");
  await page.getByLabel("Starts at").fill("09:30");
  await page.getByLabel("Ends at").fill("10:30");
  await page.getByRole("button", { name: "Save weekly class" }).click();
  await expect(page.locator(".notice.error")).toContainText("overlaps");
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await page
    .getByRole("combobox", { name: "Subject", exact: true })
    .first()
    .selectOption("b0000000-0000-4000-8000-000000000001");
  await page.getByLabel("Session name / time").fill("Morning lecture");
  await page
    .getByRole("button", { name: "Log attendance", exact: true })
    .click();
  await expect(page.getByText(/Morning lecture/).first()).toBeVisible();
  await page.reload();
  await page.getByRole("button", { name: "Attendance", exact: true }).click();
  await expect(page.getByText(/Morning lecture/).first()).toBeVisible();
  await page.goto("/demo/settings");
  const calendarDownload = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export calendar", exact: true })
    .click();
  const calendar = await calendarDownload;
  expect(calendar.suggestedFilename()).toBe("campushub-calendar.ics");
});
test("notes, file resources, revision and source review persist", async ({
  page,
}) => {
  await page.goto("/demo/study");
  await page.getByRole("button", { name: "New note", exact: true }).click();
  await page.getByLabel("Note title").fill("Network revision");
  await page
    .getByLabel("Note content")
    .fill(
      "A router forwards packets between networks. Switches connect devices on a local network.",
    );
  await page.getByLabel("Tags, separated by commas").fill("network,exam");
  await page.getByRole("button", { name: "Save note", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Network revision", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Resource library", exact: true })
    .click();
  await page.getByRole("button", { name: "Add resource", exact: true }).click();
  await page.getByLabel("Resource title").fill("Network source");
  await page.getByLabel("Source URL").fill("https://example.edu/networks");
  await page
    .getByRole("button", { name: "Save resource", exact: true })
    .click();
  await expect(page.getByRole("link", { name: "Open source" })).toHaveAttribute(
    "href",
    "https://example.edu/networks",
  );
  await page.getByRole("button", { name: "Add resource", exact: true }).click();
  await page.getByLabel("Resource title").fill("My text notes");
  await page.getByLabel("Resource type").selectOption("file");
  await page.getByLabel("PDF or text file").setInputFiles({
    name: "notes.txt",
    mimeType: "text/plain",
    buffer: Buffer.from("Packets are sent through routers."),
  });
  await page
    .getByRole("button", { name: "Save resource", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "My text notes" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Revision plan", exact: true })
    .click();
  await page.getByRole("button", { name: "Add revision goal" }).click();
  await page
    .getByLabel("Revision goal", { exact: true })
    .fill("Revise routing");
  await page.getByRole("button", { name: "Save goal", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Revise routing" }),
  ).toBeVisible();
  await page.goto("/demo/assistant");
  await page.getByLabel("Network revision").check();
  await page
    .getByLabel("What would you like to understand?")
    .fill("How does a router forward packets?");
  await page.getByRole("button", { name: "Review sources" }).click();
  await expect(page.getByText(/A router forwards packets/)).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Ask study assistant" }),
  ).toBeDisabled();
  await page.goto("/demo/settings");
  const exported = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export personal data" }).click();
  expect((await exported).suggestedFilename()).toBe(
    "campushub-personal-export.json",
  );
});
test("grading scale and weighted assessment produce earned grade without fabricating complete GPA", async ({
  page,
}) => {
  await page.goto("/demo/performance");
  await page
    .getByRole("button", { name: "Grading scale", exact: true })
    .click();
  await page.getByLabel("Scale name").fill("Example 10 point scale");
  await page
    .getByLabel("Thresholds: minimum percentage, grade points, label")
    .fill("90, 10, O\n80, 9, A\n60, 7, B\n40, 5, C\n0, 0, F");
  await page.getByRole("button", { name: "Save grading scale" }).click();
  await page.getByRole("button", { name: "Marks & GPA", exact: true }).click();
  await page.getByRole("button", { name: "Add assessment" }).click();
  await page
    .getByRole("combobox", { name: "Subject", exact: true })
    .selectOption("b0000000-0000-4000-8000-000000000001");
  await page.getByLabel("Assessment name").fill("Final examination");
  await page.getByLabel("Marks obtained (blank = pending)").fill("85");
  await page.getByLabel("Maximum marks").fill("100");
  await page.getByLabel("Weight in final result (%)").fill("100");
  await page.getByRole("button", { name: "Save assessment" }).click();
  await expect(page.getByText("A / 9", { exact: true })).toBeVisible();
  await expect(page.getByText(/CGPA is incomplete/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("A / 9", { exact: true })).toBeVisible();
});
test("career application and resume save with safe source links", async ({
  page,
}) => {
  await page.goto("/demo/career");
  await page.getByRole("button", { name: "Add opportunity" }).click();
  await page.getByLabel("Role or opportunity").fill("Software internship");
  await page
    .getByLabel("Organisation", { exact: true })
    .fill("Example company");
  await page
    .getByLabel("Original source URL")
    .fill("https://example.com/careers");
  await page.getByLabel("Application status").selectOption("Applied");
  await page.getByRole("button", { name: "Save application" }).click();
  await expect(
    page.getByRole("heading", { name: "Software internship" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Portfolio & resume" }).click();
  await page
    .getByLabel("Professional headline")
    .fill("Student building useful software");
  await page.getByLabel("Skills", { exact: true }).fill("TypeScript, SQL");
  await page.getByRole("button", { name: "Save portfolio" }).click();
  await expect(page.locator("#resume-print")).toContainText(
    "Student building useful software",
  );
  await expect(
    page.getByRole("button", { name: "Print / save PDF" }),
  ).toBeEnabled();
});
test("community post moderation and institution consent work", async ({
  page,
}) => {
  await page.goto("/demo/community");
  await page.getByLabel("Post title").fill("Study session topic");
  await page
    .getByLabel("Message", { exact: true })
    .fill("Let us revise database normalisation.");
  await page.getByRole("button", { name: "Share post", exact: true }).click();
  const post = page.locator("article").filter({
    has: page.getByRole("heading", {
      name: "Study session topic",
      exact: true,
    }),
  });
  await expect(post).toBeVisible();
  await post.getByRole("button", { name: "Report post" }).click();
  await page
    .getByLabel("Reason for reporting")
    .fill("Please review this example post.");
  await page.getByRole("button", { name: "Submit report" }).click();
  await page.getByRole("button", { name: /^Moderation/ }).click();
  await page.getByRole("button", { name: "Remove reported post" }).click();
  await expect(
    page.getByText("No open reports. You’re all caught up."),
  ).toBeVisible();
  await page.goto("/demo/institutions");
  await expect(
    page.getByRole("button", { name: "Join workspace" }),
  ).toBeDisabled();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Join workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to your campus workspace" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Leave workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome to your campus workspace" }),
  ).toHaveCount(0);
});
test("extended routes fit viewport and data export downloads", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const [view, heading] of [
    ["planner", "Assignments & exams"],
    ["study", "Your ideas, organised."],
    ["performance", "Database Management Systems"],
    ["community", "Share with your group"],
    ["career", "Make your next move count."],
    ["assistant", "Study with your sources"],
    ["institutions", "You choose what to share"],
  ]) {
    await page.goto(`/demo/${view}`);
    await expect(
      page.getByRole("heading", { name: heading, exact: true }),
    ).toBeVisible();
    await expect(page.locator(".notice.error")).toHaveCount(0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
      view,
    ).toBe(true);
  }
  await page.goto("/demo/settings");
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export personal data" }).click();
  expect((await download).suggestedFilename()).toBe(
    "campushub-personal-export.json",
  );
  await page.getByLabel("Navigation language").selectOption("hi");
  await expect(
    page.getByRole("link", { name: "योजनाकार", exact: true }),
  ).toBeVisible();
  await page.goto("/demo/study");
  await expect(
    page.getByRole("heading", {
      name: "A clearer way to think about normalisation",
      exact: true,
    }),
  ).toBeVisible();
  await page.screenshot({
    path: `../../outputs/campushub-v2-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
