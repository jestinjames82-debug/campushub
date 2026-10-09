import { test, expect } from "@playwright/test";
test("landing, account setup state, and protected route", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /A little less chaos/ }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Sign in", exact: false }).click();
  await expect(
    page.getByRole("heading", { name: "Good to have you back." }),
  ).toBeVisible();
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    await expect(
      page.getByRole("button", { name: "Sign in", exact: true }),
    ).toBeDisabled();
    await page.goto("/app/dashboard");
    await expect(page).toHaveURL(/\/auth/);
  }
});
test("subject create, search, edit, persist and delete", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/demo/subjects");
  await expect(
    page.getByText("Database Management Systems", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Add subject", exact: true }).click();
  await page
    .getByLabel("Subject name", { exact: true })
    .fill("Applied Mathematics");
  await page.getByLabel("Subject code").fill("MA101");
  await page.getByLabel("Credits", { exact: true }).fill("3.5");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByText("Applied Mathematics", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Search subjects").fill("MA101");
  await expect(page.locator(".subject-card")).toHaveCount(1);
  await page
    .getByRole("button", { name: "Edit Applied Mathematics", exact: true })
    .click();
  await page
    .getByLabel("Subject name", { exact: true })
    .fill("Advanced Mathematics");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.reload();
  await expect(
    page.getByText("Advanced Mathematics", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Advanced Mathematics", exact: true })
    .click();
  await page.getByRole("button", { name: "Keep it" }).click();
  await expect(
    page.getByText("Advanced Mathematics", { exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete Advanced Mathematics", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(
    page.getByText("Advanced Mathematics", { exact: true }),
  ).toHaveCount(0);
  expect(errors).toEqual([]);
});
test("term validation, creation, edit and cascading deletion", async ({
  page,
}) => {
  await page.goto("/demo/terms");
  await page.getByRole("button", { name: "New term" }).click();
  await page.getByLabel("Term name").fill("Annual Year 2");
  await page.getByLabel("Start date").fill("2027-06-01");
  await page.getByLabel("End date").fill("2027-01-01");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("dialog").getByRole("alert")).toContainText(
    "End date",
  );
  await page.getByLabel("End date").fill("2028-04-01");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(
    page.getByRole("heading", { name: "Annual Year 2", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Edit Annual Year 2", exact: true })
    .click();
  await page.getByLabel("Term name").fill("Year Two");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page
    .getByRole("button", { name: "Delete Semester 5", exact: true })
    .click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await page.getByRole("link", { name: "My subjects", exact: true }).click();
  await expect(page.locator(".subject-card")).toHaveCount(0);
  await expect(
    page.getByRole("heading", { name: "Year Two", exact: true }),
  ).toBeVisible();
});
test("profile editing persists and dashboard stays responsive", async ({
  page,
}, testInfo) => {
  await page.goto("/demo/settings");
  await page.getByLabel("Full name").fill("Ananya Patel");
  await page.getByLabel("College / university").fill("Example Arts College");
  await page.getByLabel("Programme", { exact: true }).fill("B.A.");
  await page.getByLabel("Academic system").selectOption("Annual");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByRole("status")).toContainText("saved");
  await page.getByRole("link", { name: "Overview", exact: true }).click();
  await expect(page.getByRole("heading", { name: /Hey Ananya/ })).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Example Arts College" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `../../outputs/campushub-${testInfo.project.name}.png`,
    fullPage: true,
  });
});
test("empty workspace onboarding", async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() =>
    localStorage.setItem(
      "campushub-demo-v1",
      JSON.stringify({ profile: null, terms: [], subjects: [] }),
    ),
  );
  await page.goto("/demo/dashboard");
  await expect(page).toHaveURL(/onboarding/);
  await page.getByLabel("Full name").fill("Riya Singh");
  await page.getByLabel("College / university").fill("Any College in India");
  await page.getByLabel("Programme", { exact: true }).fill("MBBS");
  await page.getByRole("button", { name: "Create my workspace" }).click();
  await expect(page.getByRole("heading", { name: /Hey Riya/ })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Add subject", exact: true }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Create your first term" }),
  ).toBeVisible();
});
