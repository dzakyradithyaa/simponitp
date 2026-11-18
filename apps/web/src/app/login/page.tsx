"use client";

import { ArrowRight, Eye, EyeOff, KeyRound, LoaderCircle, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { Wordmark } from "@/components/Brand";
import { Notice } from "@/components/ui";
import { api } from "@/lib/api";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => { setExpired(new URLSearchParams(window.location.search).has("expired")); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api.post("/auth/login", { username, password, remember });
      window.location.href = "/dashboard";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login gagal.");
      setBusy(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="chevron-field relative hidden flex-col p-12 lg:flex">
        <Wordmark light />
        <div className="mt-24">
          <h1 className="max-w-md text-5xl font-bold leading-[1.05] text-khaki-100">
            Lahan terpetakan.<br />Tindakan terukur.
          </h1>
          <p className="mt-5 max-w-md text-lg text-army-200">
            Pemetaan lahan untuk pertanian presisi.
          </p>
        </div>
      </section>

      <section className="flex items-center justify-center bg-[#fafafa] px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-army-100 bg-white p-7 shadow-[0_18px_50px_rgba(32,48,32,0.08)]" aria-label="Form login">
          <div className="mb-8 lg:hidden"><Wordmark /></div>
          <div className="mb-7 flex items-start justify-between gap-4">
            <div>
              <h2 className="text-3xl">Masuk ke akun Anda</h2>
              <p className="mt-2 text-sm text-army-600">Kelola peta lahan Anda.</p>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gold-50 text-gold-600" aria-hidden="true">
              <KeyRound className="h-5 w-5" />
            </div>
          </div>

          {expired && !error && <div className="mb-4"><Notice>Sesi Anda berakhir. Silakan masuk kembali.</Notice></div>}
          {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}

          <label className="field-label" htmlFor="username">Username</label>
          <div className="group relative mb-4">
            <UserRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-army-400 transition-colors group-focus-within:text-gold-600" aria-hidden="true" />
            <input id="username" className="input pl-10 transition-shadow duration-200 focus:shadow-[0_0_0_4px_rgba(191,158,83,0.12)]" value={username} onChange={(e) => setUsername(e.target.value)}
                   autoComplete="username" autoCapitalize="none" required autoFocus />
          </div>

          <label className="field-label" htmlFor="password">Password</label>
          <div className="group relative mb-4">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-army-400 transition-colors group-focus-within:text-gold-600" aria-hidden="true" />
            <input id="password" className="input pl-10 pr-11 transition-shadow duration-200 focus:shadow-[0_0_0_4px_rgba(191,158,83,0.12)]" type={show ? "text" : "password"} value={password}
                   onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-2 text-army-600 hover:text-army-900">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <label className="flex items-center gap-2 text-sm text-army-800">
            <input type="checkbox" className="h-4 w-4 accent-army-700" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Ingat saya di perangkat ini
          </label>
          <p className="mb-6 mt-1 ml-6 text-xs text-army-600">Sesi standar berakhir setelah 1 jam tidak aktif.</p>

          <button className="btn-primary group w-full py-2.5 shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_18px_rgba(191,158,83,0.24)] active:translate-y-0" disabled={busy} aria-busy={busy}>
            {busy && <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />}
            {busy ? "Memeriksa..." : "Masuk"}
            {!busy && <ArrowRight className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true" />}
          </button>
        </form>
      </section>
    </div>
  );
}
