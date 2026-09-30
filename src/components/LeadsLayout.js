import Link from "next/link";
import { LogOut } from "lucide-react";

export default function LeadsLayout({ userName, children }) {
  const handleLogout = async () => {
    try {
      await fetch("/api/logout", { method: "POST" });
    } finally {
      window.location.href = "/login";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-30 bg-white/90 backdrop-blur border-b border-slate-200">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-6 lg:px-8 flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <img src="/JOGOLOGO.png" alt="Jogo" className="w-8 h-8 rounded-md object-contain border border-slate-200 bg-white flex-shrink-0" />
            <div className="min-w-0 leading-tight">
              <div className="text-sm font-semibold text-slate-900">Jogo</div>
              <div className="text-[11px] text-slate-500">Crew Leads</div>
            </div>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            {userName && (
              <div className="hidden sm:flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-slate-900 text-white text-xs font-semibold flex items-center justify-center">
                  {userName[0].toUpperCase()}
                </div>
                <span className="text-sm text-slate-600 max-w-[160px] truncate">{userName}</span>
              </div>
            )}
            <button onClick={handleLogout} title="Sign out" aria-label="Sign out"
              className="inline-flex items-center justify-center h-9 w-9 rounded-md text-slate-500 hover:text-red-600 hover:bg-red-50">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      <main className="min-w-0">{children}</main>
    </div>
  );
}
