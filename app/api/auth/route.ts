import { NextRequest, NextResponse } from "next/server";
import { authCookieName, createAdminSessionToken, isAdminAuthEnabled, isAdminPasswordValid, isAdminRequest } from "../../data/auth";

export async function GET(request: NextRequest) {
  return NextResponse.json({
    authEnabled: isAdminAuthEnabled(),
    authenticated: isAdminRequest(request),
  });
}

export async function POST(request: NextRequest) {
  const payload = (await request.json().catch(() => null)) as { password?: string } | null;

  if (!isAdminPasswordValid(payload?.password ?? "")) {
    return NextResponse.json({ message: "Неверный пароль" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });

  response.cookies.set(authCookieName, createAdminSessionToken(), {
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 14,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });

  response.cookies.set(authCookieName, "", {
    httpOnly: true,
    maxAge: 0,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });

  return response;
}
