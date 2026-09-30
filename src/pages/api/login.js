import { createHash, timingSafeEqual } from "crypto";
import { createSession, sessionCookieHeader } from "../../lib/session";

const sha256 = (value) => createHash("sha256").update(String(value)).digest();
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const expected = process.env.LEADS_ACCESS_CODE;
  if (!expected || !process.env.LEADS_SESSION_SECRET) {
    console.error("LEADS_ACCESS_CODE / LEADS_SESSION_SECRET not configured");
    return res.status(500).json({ error: "Server is not configured" });
  }

  const name = typeof req.body?.name === "string" ? req.body.name.trim().slice(0, 60) : "";
  const code = typeof req.body?.code === "string" ? req.body.code.trim() : "";

  if (!name) {
    return res.status(400).json({ error: "Enter your name" });
  }

  // Hash both sides so the comparison is constant-time regardless of length
  if (!timingSafeEqual(sha256(code), sha256(expected))) {
    await sleep(800); // slow down guessing
    return res.status(401).json({ error: "Incorrect access code" });
  }

  res.setHeader("Set-Cookie", sessionCookieHeader(await createSession(name)));
  return res.status(200).json({ name });
}
