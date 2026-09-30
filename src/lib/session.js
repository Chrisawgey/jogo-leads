// Signed session cookie for the shared team access code.
// Uses Web Crypto so the same code runs in middleware (edge) and API routes (node).
//
// The signing key mixes in LEADS_ACCESS_CODE, so changing the code
// invalidates every existing session — that's how you revoke access.

export const SESSION_COOKIE = "jogo_leads_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days, in seconds

const encoder = new TextEncoder();

const toB64Url = (bytes) =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const fromB64Url = (str) => {
  let s = str.replace(/-/g, "+").replace(/_/g, "/");
  while (s.length % 4) s += "=";
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
};

const signingKey = () => {
  const secret = process.env.LEADS_SESSION_SECRET;
  const code = process.env.LEADS_ACCESS_CODE;
  if (!secret || !code) throw new Error("LEADS_SESSION_SECRET and LEADS_ACCESS_CODE must be set");
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(`${secret}:${code}`),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
};

export async function createSession(name) {
  const payload = toB64Url(encoder.encode(JSON.stringify({
    n: name,
    exp: Date.now() + SESSION_MAX_AGE * 1000
  })));
  const signature = await crypto.subtle.sign("HMAC", await signingKey(), encoder.encode(payload));
  return `${payload}.${toB64Url(signature)}`;
}

// Returns { name } for a valid, unexpired token, otherwise null
export async function readSession(token) {
  if (!token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;

  try {
    const valid = await crypto.subtle.verify(
      "HMAC", await signingKey(), fromB64Url(signature), encoder.encode(payload)
    );
    if (!valid) return null;

    const data = JSON.parse(new TextDecoder().decode(fromB64Url(payload)));
    if (!data.exp || data.exp < Date.now()) return null;
    return { name: data.n };
  } catch {
    return null;
  }
}

export const sessionCookieHeader = (token) => [
  `${SESSION_COOKIE}=${token}`,
  "Path=/",
  "HttpOnly",
  "SameSite=Lax",
  `Max-Age=${token ? SESSION_MAX_AGE : 0}`,
  process.env.NODE_ENV === "production" ? "Secure" : null,
].filter(Boolean).join("; ");

// For API routes: returns the session or sends a 401 and returns null
export async function requireSession(req, res) {
  const session = await readSession(req.cookies?.[SESSION_COOKIE]);
  if (!session) {
    res.status(401).json({ error: "Unauthorized" });
    return null;
  }
  return session;
}
