# Arsitektur

```
Browser ──> Next.js (port 3000) ──/api/*──> FastAPI (port 8000, internal) ──> PostgreSQL + PostGIS
                                                  └──> storage/ (GeoTIFF, pratinjau PNG)
```

Browser hanya berbicara dengan Next.js. Permintaan `/api/*` diteruskan (rewrite) ke FastAPI sehingga cookie
sesi bersifat first-party dan CORS tidak diperlukan.

## Alur data NDVI

1. Admin membuka **Upload Peta**, memilih peta (atau membuat peta baru), lalu mengunggah TIFF. Tidak ada upload batas lahan
   terpisah: area peta diambil dari bentuk piksel bernilai pada TIFF pertama.
2. File disimpan ke `storage/ndvi/{id_peta}/`, lalu diproses di background: validasi (CRS, rentang NDVI -1..1),
   statistik ringkas, lalu konversi ke arsip **PMTiles** (tile PNG Web Mercator, zoom menyesuaikan resolusi TIFF).
   Browser membaca PMTiles lewat MapLibre (protokol `pmtiles://`) dengan HTTP Range, di atas peta dasar OpenStreetMap.
3. Saat petak diminta, batas lahan dibagi menjadi kotak 100 × 100 m pada UTM setempat dan dipotong mengikuti batas.
   Rata-rata NDVI tiap petak dihitung dari GeoTIFF (di-cache di tabel versi), lalu diklasifikasikan ke intensitas.
4. KML/KMZ dibuat saat diunduh dari geometri petak yang sama (atau dari polygon custom), sehingga isinya persis sama dengan
   yang terlihat di peta. KML/KMZ hanya untuk diunduh, tidak ada upload dalam format ini.

## Keamanan

- Sesi: token acak di cookie `HttpOnly`, `SameSite=Lax` (`Secure` bila `COOKIE_SECURE=true`). Server hanya menyimpan hash token.
  Timeout idle 1 jam (7 hari bila "ingat saya").
- Password: Argon2id. Pembatasan percobaan login: 5 kali gagal per username dan IP dalam 5 menit
  (di memori per proses; di belakang proxy, IP yang terlihat adalah IP web server).
- Pemeriksaan `Origin` pada request yang mengubah data, sebagai lapisan tambahan di atas `SameSite`.
- Peran ditegakkan di API, bukan hanya di UI.
- Hanya file TIFF yang diterima (diperiksa dari isi file, bukan hanya ekstensi). Nama file unggahan tidak dipakai sebagai path.
- File PMTiles hanya dapat diunduh setelah login.

## Menjalankan skala lebih besar

- Pembatasan login dan cache grid berada di memori satu proses. Bila API dijalankan lebih dari satu instance,
  pindahkan keduanya ke penyimpanan bersama (Redis).
- Pemrosesan TIFF dan pembuatan PMTiles berjalan sebagai background task di proses API. Untuk file sangat besar atau antrean banyak,
  pindahkan ke worker terpisah (modul `processing` di README).
