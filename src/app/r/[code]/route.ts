import { NextResponse, type NextRequest } from "next/server";

// Short invite link: /r/AB12CD34 → home page with the code, which the sign-up form passes on.
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const clean = code.replace(/[^A-Za-z0-9]/g, "").slice(0, 16);
  return NextResponse.redirect(new URL(clean ? `/?ref=${clean}` : "/", req.url), 307);
}
