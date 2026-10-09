import { notFound } from "next/navigation";
import WorkspaceApp from "@/components/workspace";
export default async function Page({
  params,
}: {
  params: Promise<{ view: string }>;
}) {
  const { view } = await params;
  if (
    ![
      "dashboard",
      "subjects",
      "terms",
      "settings",
      "onboarding",
      "planner",
      "study",
      "performance",
      "community",
      "career",
      "assistant",
      "institutions",
    ].includes(view)
  )
    notFound();
  return (
    <WorkspaceApp view={view} userId="demo" email="student@example.com" demo />
  );
}
