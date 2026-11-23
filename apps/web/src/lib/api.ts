export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

function messageFrom(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => (d.msg ?? "").replace(/^Value error, /, "")).filter(Boolean).join("; ") || fallback;
  }
  return fallback;
}

function onUnauthorized(path: string) {
  if (typeof window !== "undefined" && !path.startsWith("/auth/login") && !window.location.pathname.startsWith("/login")) {
    window.location.href = "/login?expired=1";
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;
  const res = await fetch(`/api${path}`, {
    method, credentials: "same-origin",
    headers: body !== undefined && !isForm ? { "Content-Type": "application/json" } : undefined,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401) onUnauthorized(path);
    throw new ApiError(res.status, messageFrom(data, `Permintaan gagal (${res.status}).`));
  }
  return data as T;
}

export const api = {
  get: <T,>(path: string) => request<T>("GET", path),
  post: <T,>(path: string, body?: unknown) => request<T>("POST", path, body),
  put: <T,>(path: string, body?: unknown) => request<T>("PUT", path, body),
  patch: <T,>(path: string, body?: unknown) => request<T>("PATCH", path, body),
  del: (path: string) => request<void>("DELETE", path),
  /** multipart upload with progress (fetch cannot report upload progress) */
  upload<T>(path: string, form: FormData, onProgress?: (pct: number) => void): Promise<T> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api${path}`);
      xhr.withCredentials = true;
      let timer: number;
      const watchProgress = () => {
        window.clearTimeout(timer);
        timer = window.setTimeout(() => {
          reject(new ApiError(0, "Tidak ada respons atau kemajuan unggah selama 5 menit. Cek daftar versi sebelum mencoba lagi."));
          xhr.abort();
        }, 300_000);
      };
      xhr.upload.onprogress = (e) => {
        watchProgress();
        if (e.lengthComputable) onProgress?.(e.loaded === e.total ? 100 : Math.min(99, Math.floor(100 * e.loaded / e.total)));
      };
      xhr.upload.onload = watchProgress;
      xhr.onloadend = () => window.clearTimeout(timer);
      xhr.onerror = () => reject(new ApiError(0, "Koneksi terputus saat mengunggah."));
      xhr.onload = () => {
        let data: unknown = null;
        try { data = JSON.parse(xhr.responseText); } catch { /* empty body */ }
        if (xhr.status >= 200 && xhr.status < 300) return resolve(data as T);
        if (xhr.status === 401) onUnauthorized(path);
        const fallback = xhr.status === 413
          ? "Ukuran unggahan melebihi batas server."
          : `Unggahan gagal (${xhr.status}).`;
        reject(new ApiError(xhr.status, messageFrom(data, fallback)));
      };
      watchProgress();
      xhr.send(form);
    });
  },
};

export const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleString("id-ID", { dateStyle: "medium", timeStyle: "short" }) : "-";
export const fmtHa = (n: number | null | undefined) =>
  n == null ? "-" : n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
export const fmtNdvi = (n: number | null | undefined) => (n == null ? "-" : n.toFixed(2).replace(".", ","));
