# Keputusan yang masih terbuka

Diambil dari catatan meeting (bagian "Hal yang masih memerlukan keputusan") dan dipetakan ke asumsi yang dipakai
aplikasi saat ini. Semua asumsi mudah diganti.

| # | Keputusan | Asumsi di aplikasi saat ini | Cara mengubah |
|---|---|---|---|
| 1 | Definisi intensitas rendah/sedang/tinggi | Dari rata-rata NDVI per petak: < 0,35 tinggi, 0,35 sampai < 0,60 sedang, ≥ 0,60 rendah | `PUT /api/recommendations/rules/{intensitas}` |
| 2 | Dasar ilmiah aturan pupuk/penyemprotan | Teks draf tanpa dosis; ditampilkan dengan peringatan "draf" | Sama seperti #1 (`actions`) |
| 3 | Spesifikasi input GeoTIFF dan data sensor tanah | GeoTIFF NDVI satu band, nilai -1 sampai 1, CRS terdefinisi. Data sensor tanah belum diterima (Tahap 2) | `apps/api/app/services/raster.py`, `tiles.py` |
| 4 | Metode interpolasi/prediksi Tahap 2 | Belum ada | Modul `processing` (belum dibuat) |
| 5 | Jumlah dan kualitas titik sampel tanah | Belum ada | Tahap 2 |
| 6 | Integrasi ArcGIS Cloud / middleware | Belum ada; data masuk lewat halaman Upload | Tahap 2 |
| 7 | Standar KML/KMZ dan kompatibilitas perangkat lunak drone | KML 2.2, polygon berlawanan arah jarum jam, koordinat WGS84 lon,lat,0. **Belum diuji dengan TrueSprayer** | `apps/api/app/services/kml.py` |
| 8 | Jadwal final | Target demonstrasi November | - |
| 9 | Pembagian tugas, durasi, kompensasi | Di luar aplikasi | - |

## Uji kompatibilitas KML/KMZ (action item #6 di notulen)

Sebelum demonstrasi, uji satu file dari tiap jenis ekspor di perangkat lunak drone yang dipakai:

1. Satu petak, KML.
2. Satu petak, KMZ.
3. Beberapa petak dalam satu file.
4. "File terpisah per petak" (ZIP berisi satu file per petak).
5. Polygon custom, dan polygon custom yang dipecah per petak 1 ha.

Catat bila perangkat lunak meminta hal tertentu (misalnya hanya satu Placemark per file, ketinggian, atau nama file),
lalu sesuaikan `kml.py`.

## Asumsi lain yang dibuat saat membangun

- **Remember me** memperpanjang sesi menjadi 7 hari tanpa aktivitas (maksimal 30 hari). Tanpa centang, sesi
  berakhir setelah 1 jam tanpa aktivitas.
- **Admin panel** berisi ringkasan dan log aktivitas per pengguna. Pengelolaan akun ada di halaman terpisah.
- **Versi peta** = satu unggahan TIFF. Area (batas lahan) peta ditentukan oleh TIFF pertama dan dipakai untuk semua versi,
  sehingga petak tetap sama dan bisa dibandingkan antar-versi. Bila areanya berubah banyak, buat peta baru.
- **Peran user** bersifat baca-saja, kecuali membuat dan mengekspor polygon custom milik sendiri.
- Ukuran petak bawaan 100 m. Dapat diubah lewat `GRID_CELL_SIZE_M` (mengikuti kapasitas drone).
