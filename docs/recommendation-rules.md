# Aturan rekomendasi

> **Status: DRAF.** Ambang NDVI, jenis tindakan, intensitas tindakan, dan interval di bawah ini adalah
> nilai awal agar sistem langsung berjalan. Semuanya **belum divalidasi** pihak yang kompeten di bidang
> pertanian. Jangan dipakai sebagai acuan dosis atau jadwal lapangan sebelum ditetapkan.

## Cara kerja

1. Setiap petak (default 100 × 100 m = 1 ha) dihitung rata-rata NDVI-nya dari versi peta yang dipilih
   (statistik zonal; petak dengan kurang dari 50% piksel valid dianggap tanpa data).
2. Rata-rata NDVI dicocokkan dengan rentang `[ndvi_min, ndvi_max)` tiap kategori untuk menentukan
   **intensitas**: rendah, sedang, atau tinggi.
3. Intensitas dipetakan ke daftar **tindakan**: jenis (pemupukan, penyemprotan, inspeksi, pemantauan),
   intensitas tindakan, dan interval pelaksanaan (harian, mingguan, dst.).

Asumsi arah: NDVI rendah berarti vegetasi tertekan, sehingga butuh penanganan lebih intensif
(**intensitas tinggi**). Bila definisi di lapangan berbeda, ubah rentangnya.

## Nilai bawaan

| Intensitas | Rentang NDVI | Tindakan bawaan | Interval |
|---|---|---|---|
| Rendah | ≥ 0,60 | Pemantauan rutin; pemupukan pemeliharaan | 2 minggu |
| Sedang | 0,35 sampai < 0,60 | Pemupukan korektif; penyemprotan | Mingguan |
| Tinggi | < 0,35 | Inspeksi lapangan; penyemprotan intensif; pemupukan intensif | Harian / mingguan |

Dosis sengaja tidak diisi angka. Teks tindakan menyebut "ditentukan agronom".

## Mengubah aturan

Admin dapat mengubah aturan lewat API (UI editor belum dibuat). Contoh, memindahkan batas sedang/tinggi ke 0,30:

```bash
# setelah login, cookie tersimpan di cookies.txt
curl -b cookies.txt -X PUT http://localhost:3000/api/recommendations/rules/tinggi \
  -H 'Content-Type: application/json' -d '{"ndvi_max": 0.30}'
curl -b cookies.txt -X PUT http://localhost:3000/api/recommendations/rules/sedang \
  -H 'Content-Type: application/json' -d '{"ndvi_min": 0.30}'
```

Mengganti daftar tindakan:

```bash
curl -b cookies.txt -X PUT http://localhost:3000/api/recommendations/rules/sedang \
  -H 'Content-Type: application/json' -d '{"actions":[
    {"type":"penyemprotan","title":"Penyemprotan","level":"sedang","interval_days":7,
     "interval_label":"Mingguan","detail":"Isi sesuai arahan agronom."}]}'
```

Aturan validasi: rentang antar kategori tidak boleh tumpang tindih; batas bawah harus lebih kecil dari batas atas.
Perubahan berlaku seketika untuk semua peta (intensitas dihitung saat diminta, bukan disimpan).
Gunakan `clear_min` / `clear_max` untuk membuat batas terbuka.

## Yang masih harus ditetapkan

Lihat `docs/open-decisions.md`, bagian 1 dan 2.
