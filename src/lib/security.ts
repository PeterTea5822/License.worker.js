import { HttpError } from "./utils";

export function enforceOrigin(request: Request, env: Env): void {
  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }
  const origin = request.headers.get("origin");
  if (!origin) {
    throw new HttpError(403, "FORBIDDEN", "missing origin header");
  }
  const configured = (env.ORIGIN_ALLOWLIST || "").split(",").map((v) => v.trim()).filter(Boolean);
  if (configured.length === 0) {
    const url = new URL(request.url);
    const expected = `${url.protocol}//${url.host}`;
    if (origin !== expected) {
      throw new HttpError(403, "FORBIDDEN", "origin not allowed");
    }
    return;
  }
  if (!configured.includes(origin)) {
    throw new HttpError(403, "FORBIDDEN", "origin not allowed");
  }
}
