"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminOnly } from "@/components/Shell";
import { Notice, PageHeader, Spinner } from "@/components/ui";
import { api, fmtDate } from "@/lib/api";
import type { ActivityItem, AdminUserRow } from "@/lib/types";

const ACTION: Record<string, string> = {
  login: "Login", login_failed: "Login gagal", create_map: "Membuat peta", update_map: "Mengubah peta",
  update_boundary: "Mengganti batas lahan", delete_map: "Menghapus peta", upload_ndvi: "Upload NDVI",
  update_version: "Mengubah versi peta", delete_version: "Menghapus versi peta", create_polygon: "Membuat polygon",
  delete_polygon: "Menghapus polygon", export_cells: "Ekspor petak", export_polygon: "Ekspor polygon",
  create_user: "Membuat akun", update_user: "Mengubah akun", delete_user: "Menghapus akun", update_rule: "Mengubah aturan rekomendasi",
};
const PAGE = 30;

function Content() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [filter, setFilter] = useState<number | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.get<{ users: AdminUserRow[] }>("/admin/overview").then((r) => setUsers(r.users)).catch((e) => setError(e.message)); }, []);

  const loadActivity = useCallback(async (offset: number) => {
    const q = new URLSearchParams({ limit: String(PAGE), offset: String(offset) });
    if (filter != null) q.set("user_id", String(filter));
    const r = await api.get<{ total: number; items: ActivityItem[] }>(`/admin/activity?${q}`);
    setTotal(r.total);
    setItems((cur) => (offset === 0 ? r.items : [...cur, ...r.items]));
  }, [filter]);
  useEffect(() => { loadActivity(0).catch((e) => setError(e.message)); }, [loadActivity]);

  if (!users) return error ? <Notice kind="error">{error}</Notice> : <Spinner />;
  const who = users.find((u) => u.id === filter);

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader title="Admin panel" />
      {error && <div className="mb-4"><Notice kind="error">{error}</Notice></div>}

      <section className="card mb-6 overflow-x-auto" aria-labelledby="per-user">
        <h2 id="per-user" className="px-4 pt-4">Aktivitas per pengguna</h2>
        <table className="mt-2 w-full text-sm">
          <thead className="border-b border-army-200"><tr><th className="th">Pengguna</th><th className="th">Login terakhir</th><th className="th text-right">Login</th><th className="th text-right">Upload</th><th className="th text-right">Polygon</th><th className="th text-right">Ekspor</th><th className="th"><span className="sr-only">Filter</span></th></tr></thead>
          <tbody className="divide-y divide-army-100">
            {users.map((u) => (
              <tr key={u.id} className={filter === u.id ? "bg-white" : ""}>
                <td className="td"><div className="font-medium">{u.full_name}{!u.is_active && <span className="ml-2 text-xs text-alert">nonaktif</span>}</div><div className="text-xs text-army-600">{u.username} · {u.role === "admin" ? "Admin" : "User"}</div></td>
                <td className="td">{fmtDate(u.last_login_at)}</td>
                <td className="td text-right tabular-nums">{u.logins}</td><td className="td text-right tabular-nums">{u.uploads}</td>
                <td className="td text-right tabular-nums">{u.polygons}</td><td className="td text-right tabular-nums">{u.exports}</td>
                <td className="td text-right"><button className="font-semibold text-army-700 underline" onClick={() => setFilter(filter === u.id ? null : u.id)}>{filter === u.id ? "Semua" : "Lihat log"}</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card p-4" aria-labelledby="log">
        <h2 id="log" className="mb-3">Log aktivitas{who ? `: ${who.full_name}` : ""}</h2>
        {items.length === 0 ? <p className="text-sm text-army-700">Belum ada aktivitas.</p> : (
          <ul className="divide-y divide-army-100 text-sm">
            {items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-baseline justify-between gap-x-4 py-2">
                <span><strong>{a.username}</strong> · {ACTION[a.action] ?? a.action}{a.detail && <span className="text-army-700"> — {a.detail}</span>}</span>
                <time className="text-xs text-army-600" dateTime={a.created_at}>{fmtDate(a.created_at)}</time>
              </li>
            ))}
          </ul>
        )}
        {items.length < total && <button className="btn-ghost mt-3" onClick={() => loadActivity(items.length).catch((e) => setError(e.message))}>Muat lebih banyak</button>}
      </section>
    </div>
  );
}

export default function AdminPage() { return <AdminOnly><Content /></AdminOnly>; }
