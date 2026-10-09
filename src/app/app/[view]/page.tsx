import { redirect, notFound } from "next/navigation";
import { serverClient } from "@/lib/supabase/server";
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
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    redirect("/auth?setup=required");
  const client = await serverClient();
  const {
    data: { user },
    error,
  } = await client.auth.getUser();
  if (error || !user) redirect("/auth");
  return (
    <WorkspaceApp
      view={view}
      userId={user.id}
      email={user.email || ""}
      demo={false}
    />
  );
}
