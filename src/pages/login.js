import { useState, useEffect } from "react";
import Head from "next/head";
import { Lock } from "lucide-react";
import { readSession, SESSION_COOKIE } from "../lib/session";

const NAME_KEY = "jogo-leads-name";

export async function getServerSideProps({ req }) {
  // Already signed in → straight to the tracker
  if (await readSession(req.cookies[SESSION_COOKIE])) {
    return { redirect: { destination: "/", permanent: false } };
  }
  return { props: {} };
}

export default function Login() {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) || "");
    } catch {}
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, code })
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data.error || "Couldn't sign in");
        setSubmitting(false);
        return;
      }

      try { localStorage.setItem(NAME_KEY, name.trim()); } catch {}
      window.location.href = "/";
    } catch {
      setError("Network error — try again");
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 py-10">
      <Head><title>Sign in | Jogo Crew Leads</title></Head>

      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center text-center mb-6">
          <img src="/JOGOLOGO.png" alt="Jogo" className="w-12 h-12 rounded-lg border border-slate-200 bg-white object-contain mb-4" />
          <h1 className="text-xl font-semibold text-slate-900">Crew Leads</h1>
          <p className="text-sm text-slate-500 mt-1">Enter the team access code to continue.</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-4 shadow-sm">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-slate-700 mb-1.5">Your name</label>
            <input id="name" type="text" required autoComplete="name" value={name}
              onChange={(e) => setName(e.target.value)} maxLength={60}
              className={inputClass} placeholder="Shown on the updates you log" />
          </div>
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-slate-700 mb-1.5">Access code</label>
            <input id="code" type="password" required autoComplete="current-password" value={code}
              onChange={(e) => setCode(e.target.value)} autoFocus={Boolean(name)}
              className={inputClass} />
          </div>

          {error && (
            <p className="text-sm text-red-600" role="alert">{error}</p>
          )}

          <button type="submit" disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 h-10 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50">
            <Lock className="h-4 w-4" />
            {submitting ? "Checking…" : "Continue"}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-4">Internal Jogo tool. Ask the team for the code.</p>
      </div>
    </div>
  );
}

// text-base on mobile keeps iOS from zooming into inputs
const inputClass = "block w-full h-10 px-3 bg-white border border-slate-300 rounded-lg text-base sm:text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:outline-none focus:border-slate-900 focus:ring-1 focus:ring-slate-900";
