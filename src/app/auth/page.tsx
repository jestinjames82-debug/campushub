import { Suspense } from "react";
import AuthForm from "@/components/auth-form";
export const dynamic = "force-dynamic";
export default function Page() {
  return (
    <Suspense fallback={<p className="loading">Opening your workspace…</p>}>
      <AuthForm />
    </Suspense>
  );
}
