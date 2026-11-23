const API = process.env.API_INTERNAL_URL || "http://localhost:8000";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mapId: string }> }
) {
  const { mapId } = await params;
  if (!/^\d+$/.test(mapId)) {
    return Response.json({ detail: "ID peta tidak valid." }, { status: 400 });
  }

  const headers = new Headers();
  for (const name of ["content-type", "content-length", "cookie", "origin"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }

  // Stream multipart data without the Next.js rewrite body buffer.
  const options: RequestInit & { duplex: "half" } = {
    method: "POST",
    headers,
    body: request.body,
    duplex: "half",
    signal: request.signal,
  };
  try {
    return await fetch(`${API}/api/maps/${mapId}/versions`, options);
  } catch {
    return Response.json(
      { detail: "Server unggah tidak dapat dihubungi. Cek daftar versi sebelum mencoba lagi." },
      { status: 502 }
    );
  }
}
