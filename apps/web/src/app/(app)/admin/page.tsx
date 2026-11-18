"use client";

import {
  ArrowRight,
  DownloadSimple,
  Polygon,
  SignIn,
  UploadSimple,
  UsersThree,
} from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AdminOnly } from "@/components/Shell";
import {
  Badge,
  BTN_GHOST,
  CARD,
  FOCUS,
  Notice,
  PageHeader,
  Spinner,
} from "@/components/ui";
import { api, fmtDate } from "@/lib/api";
import type { ActivityItem, AdminUserRow } from "@/lib/types";

const ACTION: Record<string, string> = {
  login: "Login",
  login_failed: "Login gagal",
  create_map: "Membuat peta",
  update_map: "Mengubah peta",
  update_boundary: "Mengganti batas lahan",
  delete_map: "Menghapus peta",
  upload_ndvi: "Upload NDVI",
  update_version: "Mengubah versi peta",
  delete_version: "Menghapus versi peta",
  create_polygon: "Membuat polygon",
  delete_polygon: "Menghapus polygon",
  export_cells: "Ekspor petak",
  export_polygon: "Ekspor polygon",
  create_user: "Membuat akun",
  update_user: "Mengubah akun",
  delete_user: "Menghapus akun",
  update_rule: "Mengubah aturan rekomendasi",
};
const PAGE = 30;

function Content() {
  const [users, setUsers] = useState<AdminUserRow[] | null>(null);
  const [filter, setFilter] = useState<number | null>(null);
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [total, setTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ users: AdminUserRow[] }>("/admin/overview")
      .then((r) => setUsers(r.users))
      .catch((e) => setError(e.message));
  }, []);

  const loadActivity = useCallback(
    async (offset: number) => {
      const q = new URLSearchParams({
        limit: String(PAGE),
        offset: String(offset),
      });
      if (filter != null) q.set("user_id", String(filter));
      const r = await api.get<{ total: number; items: ActivityItem[] }>(
        `/admin/activity?${q}`
      );
      setTotal(r.total);
      setItems((cur) => (offset === 0 ? r.items : [...cur, ...r.items]));
    },
    [filter]
  );
  useEffect(() => {
    loadActivity(0).catch((e) => setError(e.message));
  }, [loadActivity]);

  const sum = useMemo(
    () =>
      (users ?? []).reduce(
        (a, u) => ({
          logins: a.logins + u.logins,
          uploads: a.uploads + u.uploads,
          polygons: a.polygons + u.polygons,
          exports: a.exports + u.exports,
        }),
        { logins: 0, uploads: 0, polygons: 0, exports: 0 }
      ),
    [users]
  );

  if (!users)
    return error ? <Notice kind="error">{error}</Notice> : <Spinner />;
  const who = users.find((u) => u.id === filter);

  const stats = [
    { label: "Pengguna", v: users.length, Icon: UsersThree },
    { label: "Login", v: sum.logins, Icon: SignIn },
    { label: "Upload", v: sum.uploads, Icon: UploadSimple },
    { label: "Polygon", v: sum.polygons, Icon: Polygon },
    { label: "Ekspor", v: sum.exports, Icon: DownloadSimple },
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <PageHeader
        title="Administrasi"
        desc="Pantau aktivitas pengguna dan riwayat perubahan di platform."
      />
      {error && (
        <div className="mb-4">
          <Notice kind="error">{error}</Notice>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map(({ label, v, Icon }) => (
          <div key={label} className={`${CARD} p-3.5`}>
            <div className="flex items-center justify-between text-[#6b6b6b]">
              <span className="text-xs font-medium">{label}</span>
              <Icon className="h-4 w-4" aria-hidden="true" />
            </div>
            <p className="mt-2 text-2xl font-bold tabular-nums tracking-tight text-[#202020]">
              {v.toLocaleString("id-ID")}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <section aria-labelledby="per-user">
          <h2 id="per-user" className="mb-2 px-0.5">
            Aktivitas per pengguna
          </h2>
          <ul className="space-y-2">
            {users.map((u) => {
              const on = filter === u.id;
              return (
                <li key={u.id}>
                  <button
                    type="button"
                    aria-pressed={on}
                    onClick={() => setFilter(on ? null : u.id)}
                    className={`w-full rounded-xl border bg-white p-3 text-left transition ${FOCUS} ${
                      on
                        ? "border-[#D71920] bg-[#FDECEC]/50"
                        : "border-[#e6e6e6] hover:border-[#202020]"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#202020] text-xs font-semibold text-white">
                        {u.full_name.charAt(0).toUpperCase()}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-1.5">
                          <span className="truncate text-sm font-semibold">
                            {u.full_name}
                          </span>
                          {u.role === "admin" && (
                            <Badge tone="dark">Admin</Badge>
                          )}
                          {!u.is_active && <Badge tone="red">Nonaktif</Badge>}
                        </span>
                        <span className="block truncate text-xs text-[#6b6b6b]">
                          @{u.username} · {fmtDate(u.last_login_at)}
                        </span>
                      </span>
                    </div>
                    <dl className="mt-2.5 grid grid-cols-4 gap-1 text-center">
                      {(
                        [
                          ["Login", u.logins],
                          ["Upload", u.uploads],
                          ["Polygon", u.polygons],
                          ["Ekspor", u.exports],
                        ] as const
                      ).map(([k, n]) => (
                        <div key={k} className="rounded-lg bg-[#f6f6f6] py-1.5">
                          <dd className="text-sm font-bold tabular-nums">
                            {n}
                          </dd>
                          <dt className="text-[10px] text-[#6b6b6b]">{k}</dt>
                        </div>
                      ))}
                    </dl>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section aria-labelledby="log">
          <div className="mb-2 flex items-center justify-between gap-2 px-0.5">
            <h2 id="log" className="truncate">
              Log aktivitas{who ? ` · ${who.full_name}` : ""}
            </h2>
            {who && (
              <button
                type="button"
                className="shrink-0 text-xs font-semibold text-[#D71920] hover:underline"
                onClick={() => setFilter(null)}
              >
                Tampilkan semua
              </button>
            )}
          </div>
          <div className={`${CARD} p-4`}>
            {items.length === 0 ? (
              <p className="py-6 text-center text-sm text-[#6b6b6b]">
                Belum ada aktivitas.
              </p>
            ) : (
              <ol className="relative space-y-3.5 border-l border-[#e6e6e6] pl-4">
                {items.map((a) => (
                  <li key={a.id} className="relative">
                    <span
                      className={`absolute -left-[21px] top-1.5 h-2.5 w-2.5 rounded-full border-2 border-white ${
                        a.action === "login_failed" ||
                        a.action.startsWith("delete")
                          ? "bg-[#D71920]"
                          : "bg-[#202020]"
                      }`}
                    />
                    <p className="text-[13px] leading-5">
                      <strong className="font-semibold">{a.username}</strong>{" "}
                      <span className="text-[#4a4a4a]">
                        {ACTION[a.action] ?? a.action}
                      </span>
                      {a.detail && (
                        <span className="text-[#6b6b6b]"> — {a.detail}</span>
                      )}
                    </p>
                    <time
                      className="text-[11px] text-[#9a9a9a]"
                      dateTime={a.created_at}
                    >
                      {fmtDate(a.created_at)}
                    </time>
                  </li>
                ))}
              </ol>
            )}
            {items.length < total && (
              <button
                className={`${BTN_GHOST} mt-4 w-full`}
                onClick={() =>
                  loadActivity(items.length).catch((e) => setError(e.message))
                }
              >
                Muat lebih banyak <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function AdminPage() {
  return (
    <AdminOnly>
      <Content />
    </AdminOnly>
  );
}
