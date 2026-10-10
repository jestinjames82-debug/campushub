import { NextResponse, type NextRequest } from "next/server";
import { serverClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const failure = () =>
    NextResponse.redirect(new URL("/auth?error=confirmation", request.url));
  const code = request.nextUrl.searchParams.get("code");
  if (!code) return failure();
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    return failure();

  const client = await serverClient();
  const { error } = await client.auth.exchangeCodeForSession(code);
  if (error) return failure();
  return NextResponse.redirect(new URL("/app/dashboard", request.url));
}
