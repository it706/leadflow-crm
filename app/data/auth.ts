import { createHash } from "crypto";
import { type NextRequest } from "next/server";

export const authCookieName = "leadflow_admin_session";

function getAdminPassword() {
  return process.env.CRM_ADMIN_PASSWORD?.trim();
}

export function isAdminAuthEnabled() {
  return Boolean(getAdminPassword());
}

export function createAdminSessionToken() {
  const password = getAdminPassword();

  if (!password) return "local-dev";

  return createHash("sha256").update(`leadflow:${password}`).digest("hex");
}

export function isAdminPasswordValid(password: string) {
  const adminPassword = getAdminPassword();

  if (!adminPassword) return true;

  return password === adminPassword;
}

export function isAdminRequest(request: NextRequest) {
  if (!isAdminAuthEnabled()) return true;

  return request.cookies.get(authCookieName)?.value === createAdminSessionToken();
}
