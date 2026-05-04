import { DASHBOARD_CSS, DASHBOARD_HTML, DASHBOARD_JS } from "./dashboard/assets";
import { enforceOrigin } from "./lib/security";
import { signPayload } from "./lib/signing";
import { HttpError, getClientIp, isSafeVersion, isValidUuid, jsonResponse, nowSeconds, randomLicenseKey, readJsonBody } from "./lib/utils";
import type { VerifyLicenseBody } from "./types";

type LicenseRow = {
  id: number;
  license_key: string;
  status: string;
  expires_at: number;
  bound_device_id: string | null;
  note?: string | null;
};

function getPath(request: Request): string {
  return new URL(request.url).pathname;
}

function parseOptionalInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") {
    return null;
  }
  if (typeof value !== "number" || !Number.isInteger(value)) {
    throw new HttpError(400, "BAD_REQUEST", "invalid integer value");
  }
  return value;
}

function ensureStatus(status: string): "active" | "suspended" | "revoked" {
  if (status === "active" || status === "suspended" || status === "revoked") {
    return status;
  }
  throw new HttpError(400, "BAD_REQUEST", "invalid status");
}

async function getGlobalDurationDays(env: Env): Promise<number> {
  const row = await env.LICENSE_DB.prepare("SELECT value FROM settings WHERE key = 'global_duration_days'").first<{ value: string }>();
  return Number(row?.value || "30");
}

async function insertAudit(env: Env, actor: string, action: string, details: unknown, ip: string): Promise<void> {
  await env.LICENSE_DB.prepare(
    "INSERT INTO audit_logs (actor, action, details_json, ip, created_at) VALUES (?, ?, ?, ?, ?)"
  ).bind(actor, action, JSON.stringify(details), ip, nowSeconds()).run();
}

async function computeDurationDays(env: Env, explicitDays: number | null): Promise<number> {
  if (explicitDays !== null) {
    if (explicitDays < 1 || explicitDays > 3650) {
      throw new HttpError(400, "BAD_REQUEST", "durationDays out of range");
    }
    return explicitDays;
  }

  const globalDays = await getGlobalDurationDays(env);
  if (globalDays < 1) {
    throw new HttpError(500, "SERVER_MISCONFIG", "invalid global duration");
  }
  return globalDays;
}

async function cleanupOldNonces(env: Env): Promise<void> {
  if (Math.random() > 0.08) {
    return;
  }
  await env.LICENSE_DB.prepare("DELETE FROM used_nonces WHERE expires_at < ?").bind(nowSeconds()).run();
}

async function insertLicenseAuthEvent(
  env: Env,
  input: {
    licenseId: number | null;
    licenseKey: string | null;
    deviceId: string;
    appVersion: string;
    verdict: "ALLOW" | "DENY";
    reasonCode: string;
    ip: string;
  }
): Promise<void> {
  await env.LICENSE_DB.prepare(
    "INSERT INTO license_auth_events (license_id, license_key, device_id, app_version, verdict, reason_code, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  ).bind(
    input.licenseId,
    input.licenseKey,
    input.deviceId,
    input.appVersion,
    input.verdict,
    input.reasonCode,
    input.ip,
    nowSeconds()
  ).run();
}

async function verifyLicenseRequest(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type"
      }
    });
  }

  const body = await readJsonBody<VerifyLicenseBody>(request);
  const licenseInput = (body.license || body.licenseKey || "").trim();
  const clientIp = getClientIp(request);
  const nonceWindow = Number(env.NONCE_WINDOW_SECONDS || "300");
  if (!licenseInput || !body.deviceId || !body.appVersion || !body.nonce) {
    throw new HttpError(400, "BAD_REQUEST", "missing required fields");
  }
  if (!isValidUuid(body.deviceId)) {
    throw new HttpError(400, "BAD_REQUEST", "invalid deviceId");
  }
  if (!isSafeVersion(body.appVersion)) {
    throw new HttpError(400, "BAD_REQUEST", "invalid appVersion");
  }
  if (!Number.isInteger(body.timestamp)) {
    throw new HttpError(400, "BAD_REQUEST", "invalid timestamp");
  }
  if (!/^[0-9A-Za-z._-]{8,120}$/.test(body.nonce)) {
    throw new HttpError(400, "BAD_REQUEST", "invalid nonce");
  }

  const now = nowSeconds();
  if (Math.abs(now - body.timestamp) > nonceWindow) {
    await insertLicenseAuthEvent(env, {
      licenseId: null,
      licenseKey: licenseInput || null,
      deviceId: body.deviceId,
      appVersion: body.appVersion,
      verdict: "DENY",
      reasonCode: "TIMESTAMP_OUT_OF_WINDOW",
      ip: clientIp
    });
    const payload = {
      verdict: "DENY",
      reasonCode: "TIMESTAMP_OUT_OF_WINDOW",
      serverTime: now,
      license: null as unknown
    };
    return signedVerifyResponse(payload, env);
  }

  try {
    await env.LICENSE_DB.prepare("INSERT INTO used_nonces (nonce, expires_at) VALUES (?, ?)")
      .bind(body.nonce, now + nonceWindow)
      .run();
  } catch {
    await insertLicenseAuthEvent(env, {
      licenseId: null,
      licenseKey: licenseInput || null,
      deviceId: body.deviceId,
      appVersion: body.appVersion,
      verdict: "DENY",
      reasonCode: "REPLAY_DETECTED",
      ip: clientIp
    });
    const payload = {
      verdict: "DENY",
      reasonCode: "REPLAY_DETECTED",
      serverTime: now,
      license: null as unknown
    };
    return signedVerifyResponse(payload, env);
  }

  await cleanupOldNonces(env);

  const versionHit = await env.LICENSE_DB.prepare(
    "SELECT 1 AS ok FROM allowed_versions WHERE version = ? AND enabled = 1"
  ).bind(body.appVersion).first<{ ok: number }>();

  if (!versionHit) {
    await insertLicenseAuthEvent(env, {
      licenseId: null,
      licenseKey: licenseInput,
      deviceId: body.deviceId,
      appVersion: body.appVersion,
      verdict: "DENY",
      reasonCode: "VERSION_NOT_ALLOWED",
      ip: clientIp
    });
    const payload = {
      verdict: "DENY",
      reasonCode: "VERSION_NOT_ALLOWED",
      serverTime: now,
      license: null as unknown
    };
    return signedVerifyResponse(payload, env);
  }

  const license = await env.LICENSE_DB.prepare(
    "SELECT id, license_key, status, expires_at, bound_device_id FROM licenses WHERE license_key = ?"
  ).bind(licenseInput).first<LicenseRow>();

  if (!license) {
    await insertLicenseAuthEvent(env, {
      licenseId: null,
      licenseKey: licenseInput,
      deviceId: body.deviceId,
      appVersion: body.appVersion,
      verdict: "DENY",
      reasonCode: "INVALID_KEY",
      ip: clientIp
    });
    return signedVerifyResponse({
      verdict: "DENY",
      reasonCode: "INVALID_KEY",
      serverTime: now,
      license: null as unknown
    }, env);
  }

  if (license.status === "revoked") {
    await insertLicenseAuthEvent(env, {
      licenseId: license.id,
      licenseKey: license.license_key,
      deviceId: body.deviceId,
      appVersion: body.appVersion,
      verdict: "DENY",
      reasonCode: "REVOKED",
      ip: clientIp
    });
    return signedVerifyResponse({
      verdict: "DENY",
      reasonCode: "REVOKED",
      serverTime: now,
      license: buildLicenseSnapshot(license)
    }, env);
  }
  if (license.status === "suspended") {
    await insertLicenseAuthEvent(env, {
      licenseId: license.id,
      licenseKey: license.license_key,
      deviceId: body.deviceId,
      appVersion: body.appVersion,
      verdict: "DENY",
      reasonCode: "SUSPENDED",
      ip: clientIp
    });
    return signedVerifyResponse({
      verdict: "DENY",
      reasonCode: "SUSPENDED",
      serverTime: now,
      license: buildLicenseSnapshot(license)
    }, env);
  }
  if (license.expires_at < now) {
    await insertLicenseAuthEvent(env, {
      licenseId: license.id,
      licenseKey: license.license_key,
      deviceId: body.deviceId,
      appVersion: body.appVersion,
      verdict: "DENY",
      reasonCode: "EXPIRED",
      ip: clientIp
    });
    return signedVerifyResponse({
      verdict: "DENY",
      reasonCode: "EXPIRED",
      serverTime: now,
      license: buildLicenseSnapshot(license)
    }, env);
  }

  if (license.bound_device_id && license.bound_device_id !== body.deviceId) {
    await insertLicenseAuthEvent(env, {
      licenseId: license.id,
      licenseKey: license.license_key,
      deviceId: body.deviceId,
      appVersion: body.appVersion,
      verdict: "DENY",
      reasonCode: "DEVICE_MISMATCH",
      ip: clientIp
    });
    return signedVerifyResponse({
      verdict: "DENY",
      reasonCode: "DEVICE_MISMATCH",
      serverTime: now,
      license: buildLicenseSnapshot(license)
    }, env);
  }

  if (!license.bound_device_id) {
    await env.LICENSE_DB.prepare(
      "UPDATE licenses SET bound_device_id = ?, updated_at = ? WHERE id = ?"
    ).bind(body.deviceId, now, license.id).run();
    license.bound_device_id = body.deviceId;
  }

  await insertLicenseAuthEvent(env, {
    licenseId: license.id,
    licenseKey: license.license_key,
    deviceId: body.deviceId,
    appVersion: body.appVersion,
    verdict: "ALLOW",
    reasonCode: "OK",
    ip: clientIp
  });

  return signedVerifyResponse({
    verdict: "ALLOW",
    reasonCode: "OK",
    serverTime: now,
    license: buildLicenseSnapshot(license)
  }, env);
}

function buildLicenseSnapshot(row: LicenseRow) {
  return {
    id: row.id,
    status: row.status,
    expiresAt: row.expires_at,
    boundDeviceId: row.bound_device_id
  };
}

async function signedVerifyResponse(payload: unknown, env: Env): Promise<Response> {
  const signature = await signPayload(payload, env);
  return jsonResponse(
    {
      apiVersion: env.API_VERSION,
      keyId: env.PUBLIC_KEY_ID,
      payload,
      signature,
      algorithm: "Ed25519"
    },
    {
      headers: {
        "access-control-allow-origin": "*"
      }
    }
  );
}

async function getSettings(env: Env): Promise<Response> {
  const globalDurationDays = await getGlobalDurationDays(env);
  return jsonResponse({ globalDurationDays });
}

async function putSettings(request: Request, env: Env): Promise<Response> {
  enforceOrigin(request, env);
  const body = await readJsonBody<{ globalDurationDays: number }>(request);
  if (!Number.isInteger(body.globalDurationDays) || body.globalDurationDays < 1 || body.globalDurationDays > 3650) {
    throw new HttpError(400, "BAD_REQUEST", "globalDurationDays out of range");
  }
  await env.LICENSE_DB.prepare(
    "INSERT INTO settings (key, value, updated_at) VALUES ('global_duration_days', ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at"
  ).bind(String(body.globalDurationDays), nowSeconds()).run();
  await insertAudit(env, "admin", "update_global_duration", body, getClientIp(request));
  return jsonResponse({ ok: true });
}

async function listVersions(env: Env): Promise<Response> {
  const { results } = await env.LICENSE_DB.prepare(
    "SELECT version, enabled, created_at FROM allowed_versions ORDER BY version ASC"
  ).all<{ version: string; enabled: number; created_at: number }>();
  return jsonResponse({
    items: (results || []).map((row: { version: string; enabled: number; created_at: number }) => ({
      version: row.version,
      enabled: Boolean(row.enabled),
      createdAt: row.created_at
    }))
  });
}

async function addVersion(request: Request, env: Env): Promise<Response> {
  enforceOrigin(request, env);
  const body = await readJsonBody<{ version: string }>(request);
  const version = body.version?.trim();
  if (!version || !isSafeVersion(version)) {
    throw new HttpError(400, "BAD_REQUEST", "invalid version");
  }
  await env.LICENSE_DB.prepare(
    "INSERT INTO allowed_versions (version, enabled, created_at) VALUES (?, 1, ?) ON CONFLICT(version) DO UPDATE SET enabled = 1"
  ).bind(version, nowSeconds()).run();
  await insertAudit(env, "admin", "add_version", { version }, getClientIp(request));
  return jsonResponse({ ok: true });
}

async function removeVersion(versionRaw: string, request: Request, env: Env): Promise<Response> {
  enforceOrigin(request, env);
  const version = decodeURIComponent(versionRaw);
  await env.LICENSE_DB.prepare("DELETE FROM allowed_versions WHERE version = ?").bind(version).run();
  await insertAudit(env, "admin", "remove_version", { version }, getClientIp(request));
  return jsonResponse({ ok: true });
}

async function listLicenses(env: Env): Promise<Response> {
  const { results } = await env.LICENSE_DB.prepare(
    "SELECT id, license_key, status, expires_at, bound_device_id, note FROM licenses ORDER BY id DESC LIMIT 500"
  ).all<{ id: number; license_key: string; status: string; expires_at: number; bound_device_id: string | null; note: string | null }>();

  return jsonResponse({
    items: (results || []).map((row: { id: number; license_key: string; status: string; expires_at: number; bound_device_id: string | null; note: string | null }) => ({
      id: row.id,
      licenseKey: row.license_key,
      status: row.status,
      expiresAt: row.expires_at,
      boundDeviceId: row.bound_device_id,
      note: row.note
    }))
  });
}

async function createLicense(request: Request, env: Env): Promise<Response> {
  enforceOrigin(request, env);
  const body = await readJsonBody<{ durationDays?: number | null; licenseKey?: string | null; note?: string | null }>(request);
  const durationDays = parseOptionalInt(body.durationDays ?? null);
  const key = body.licenseKey?.trim() || randomLicenseKey();
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 500) : null;

  if (!/^[0-9A-Za-z-]{8,64}$/.test(key)) {
    throw new HttpError(400, "BAD_REQUEST", "invalid licenseKey");
  }

  const duration = await computeDurationDays(env, durationDays);
  const now = nowSeconds();
  const expiresAt = now + duration * 24 * 60 * 60;

  const result = await env.LICENSE_DB.prepare(
    "INSERT INTO licenses (license_key, user_id, status, expires_at, bound_device_id, note, created_at, updated_at) VALUES (?, NULL, 'active', ?, NULL, ?, ?, ?)"
  ).bind(key, expiresAt, note, now, now).run();

  await insertAudit(env, "admin", "create_license", { id: result.meta.last_row_id, key, expiresAt, note }, getClientIp(request));
  return jsonResponse({ ok: true, id: result.meta.last_row_id, licenseKey: key, expiresAt });
}

async function patchLicense(licenseIdRaw: string, request: Request, env: Env): Promise<Response> {
  enforceOrigin(request, env);
  const id = Number(licenseIdRaw);
  if (!Number.isInteger(id) || id < 1) {
    throw new HttpError(400, "BAD_REQUEST", "invalid license id");
  }
  const body = await readJsonBody<{ status?: string; clearDevice?: boolean; extendDays?: number; note?: string | null }>(request);

  const existing = await env.LICENSE_DB.prepare(
    "SELECT id, status, expires_at, note FROM licenses WHERE id = ?"
  ).bind(id).first<{ id: number; status: string; expires_at: number; note: string | null }>();
  if (!existing) {
    throw new HttpError(404, "NOT_FOUND", "license not found");
  }

  let status = existing.status;
  if (body.status !== undefined) {
    status = ensureStatus(body.status);
  }

  let expiresAt = existing.expires_at;
  if (body.extendDays !== undefined) {
    if (!Number.isInteger(body.extendDays) || body.extendDays < 1 || body.extendDays > 3650) {
      throw new HttpError(400, "BAD_REQUEST", "invalid extendDays");
    }
    expiresAt += body.extendDays * 24 * 60 * 60;
  }

  const clearDevice = Boolean(body.clearDevice);
  const nextNote = body.note === undefined ? existing.note : (body.note ? body.note.trim().slice(0, 500) : null);
  await env.LICENSE_DB.prepare(
    "UPDATE licenses SET status = ?, expires_at = ?, note = ?, bound_device_id = CASE WHEN ? = 1 THEN NULL ELSE bound_device_id END, updated_at = ? WHERE id = ?"
  ).bind(status, expiresAt, nextNote, clearDevice ? 1 : 0, nowSeconds(), id).run();

  await insertAudit(env, "admin", "patch_license", { id, status, expiresAt, clearDevice, note: nextNote }, getClientIp(request));
  return jsonResponse({ ok: true });
}

async function listLicenseAuthEvents(env: Env): Promise<Response> {
  const { results } = await env.LICENSE_DB.prepare(
    "SELECT id, license_id, license_key, device_id, app_version, verdict, reason_code, ip, created_at FROM license_auth_events ORDER BY id DESC LIMIT 300"
  ).all<{
    id: number;
    license_id: number | null;
    license_key: string | null;
    device_id: string;
    app_version: string;
    verdict: string;
    reason_code: string;
    ip: string | null;
    created_at: number;
  }>();

  return jsonResponse({
    items: (results || []).map((row) => ({
      id: row.id,
      licenseId: row.license_id,
      licenseKey: row.license_key,
      deviceId: row.device_id,
      appVersion: row.app_version,
      verdict: row.verdict,
      reasonCode: row.reason_code,
      ip: row.ip,
      createdAt: row.created_at
    }))
  });
}

async function listAudits(env: Env): Promise<Response> {
  const { results } = await env.LICENSE_DB.prepare(
    "SELECT id, actor, action, details_json, ip, created_at FROM audit_logs ORDER BY id DESC LIMIT 100"
  ).all<{ id: number; actor: string; action: string; details_json: string; ip: string | null; created_at: number }>();

  return jsonResponse({
    items: (results || []).map((row: { id: number; actor: string; action: string; details_json: string; ip: string | null; created_at: number }) => ({
      id: row.id,
      actor: row.actor,
      action: row.action,
      details: safeJsonParse(row.details_json),
      ip: row.ip,
      createdAt: row.created_at
    }))
  });
}

function safeJsonParse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function handleAdminApi(request: Request, env: Env, path: string): Promise<Response> {
  if (path === "/admin/api/settings" && request.method === "GET") {
    return getSettings(env);
  }
  if (path === "/admin/api/settings" && request.method === "PUT") {
    return putSettings(request, env);
  }
  if (path === "/admin/api/versions" && request.method === "GET") {
    return listVersions(env);
  }
  if (path === "/admin/api/versions" && request.method === "POST") {
    return addVersion(request, env);
  }
  if (path.startsWith("/admin/api/versions/") && request.method === "DELETE") {
    return removeVersion(path.slice("/admin/api/versions/".length), request, env);
  }
  if (path === "/admin/api/licenses" && request.method === "GET") {
    return listLicenses(env);
  }
  if (path === "/admin/api/licenses" && request.method === "POST") {
    return createLicense(request, env);
  }
  if (path.startsWith("/admin/api/licenses/") && request.method === "PATCH") {
    return patchLicense(path.slice("/admin/api/licenses/".length), request, env);
  }
  if (path === "/admin/api/audits" && request.method === "GET") {
    return listAudits(env);
  }
  if (path === "/admin/api/license-events" && request.method === "GET") {
    return listLicenseAuthEvents(env);
  }

  throw new HttpError(404, "NOT_FOUND", "admin endpoint not found");
}

function textResponse(text: string, contentType: string): Response {
  return new Response(text, { headers: { "content-type": contentType } });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const path = getPath(request);
    try {
      if (path === "/") {
        throw new HttpError(404, "NOT_FOUND", "endpoint not found");
      }

      if (path === "/admin" || path === "/admin/") {
        return textResponse(DASHBOARD_HTML, "text/html; charset=utf-8");
      }
      if (path === "/admin/style.css") {
        return textResponse(DASHBOARD_CSS, "text/css; charset=utf-8");
      }
      if (path === "/admin/app.js") {
        return textResponse(DASHBOARD_JS, "application/javascript; charset=utf-8");
      }

      if (path === "/api/v1/license/verify" && (request.method === "POST" || request.method === "OPTIONS")) {
        return verifyLicenseRequest(request, env);
      }

      if (path.startsWith("/admin/api/")) {
        return handleAdminApi(request, env, path);
      }

      throw new HttpError(404, "NOT_FOUND", "endpoint not found");
    } catch (error) {
      if (error instanceof HttpError) {
        return jsonResponse({ code: error.code, message: error.message }, { status: error.status });
      }
      return jsonResponse({ code: "INTERNAL_ERROR", message: "internal server error" }, { status: 500 });
    }
  }
};
