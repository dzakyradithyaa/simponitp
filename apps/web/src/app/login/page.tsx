"use client";

import { Eye, EyeOff } from "lucide-react";
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
      <section className="chevron-field relative hidden flex-col justify-between p-12 lg:flex">
        <Wordmark light />
        <div>
          <h1 className="max-w-md text-5xl font-bold leading-[1.05] text-khaki-100">
            Lahan terpetakan.<br />Tindakan terukur.
          </h1>
          <p className="mt-5 max-w-md text-lg text-army-200">
            Peta TIFF hasil UAV dibagi menjadi petak 1 hektare, lengkap dengan rekomendasi dan file KML/KMZ yang bisa diunduh untuk misi drone.
          </p>
        </div>
        <p className="text-sm text-army-300">Platform pertanian presisi berbasis UAV</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <form onSubmit={submit} className="w-full max-w-sm" aria-label="Form login">
          <div className="mb-8 lg:hidden"><Wordmark /></div>
          <h2 className="mb-1 text-3xl">Masuk</h2>
          <p className="mb-6 text-army-700">Gunakan akun yang diberikan oleh admin.</p>

          {expired && !error && <div className="mb-4"><Notice>Sesi Anda berakhir. Silakan masuk kembali.</Notice></div>}
          {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}

          <label className="field-label" htmlFor="username">Username</label>
          <input id="username" className="input mb-4" value={username} onChange={(e) => setUsername(e.target.value)}
                 autoComplete="username" autoCapitalize="none" required autoFocus />

          <label className="field-label" htmlFor="password">Password</label>
          <div className="relative mb-4">
            <input id="password" className="input pr-11" type={show ? "text" : "password"} value={password}
                   onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? "Sembunyikan password" : "Tampilkan password"}
                    className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-2 text-army-600 hover:text-army-900">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>

          <label className="mb-6 flex items-center gap-2 text-sm text-army-800">
            <input type="checkbox" className="h-4 w-4 accent-army-700" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
            Ingat saya di perangkat ini
          </label>

          <button className="btn-primary w-full py-2.5" disabled={busy}>{busy ? "Memeriksa..." : "Masuk"}</button>
          <p className="mt-4 text-xs text-army-600">Tanpa &ldquo;Ingat saya&rdquo;, sesi berakhir otomatis setelah 1 jam tanpa aktivitas.</p>
        </form>
      </section>
    </div>
  );
}
