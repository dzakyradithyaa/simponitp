import type { Metadata } from "next";
import { FaqList, type FaqItem } from "@/components/FaqList";
import { PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "Panduan" };

const FAQ: FaqItem[] = [
  {
    q: "Apa itu SIMPONI TP?",
    a: "Platform pertanian presisi. Peta TIFF hasil survei UAV ditampilkan di atas peta OpenStreetMap, dibagi menjadi petak 1 hektare, diberi rekomendasi tindakan, lalu petaknya bisa diunduh sebagai KML/KMZ untuk perencanaan misi drone.",
  },
  {
    q: "Apa itu NDVI dan bagaimana membacanya?",
    a: "NDVI (Normalized Difference Vegetation Index) menunjukkan kerapatan dan kesehatan vegetasi, bernilai -1 sampai 1. Semakin tinggi, semakin sehat vegetasinya. Nilai rendah berarti vegetasi jarang, tertekan, atau lahan terbuka.",
  },
  {
    q: "Bagaimana petak 1 hektare dibuat?",
    a: "Batas lahan dibagi menjadi kotak 100 × 100 meter (1 ha) pada proyeksi UTM setempat. Kotak di tepi lahan dipotong mengikuti batas, sehingga luasnya bisa kurang dari 1 ha. Petak diberi ID, misalnya R02C05 (baris 2, kolom 5, dihitung dari barat laut).",
  },
  {
    q: "Bagaimana intensitas rendah, sedang, dan tinggi ditentukan?",
    a: "Dari rata-rata NDVI di dalam petak. NDVI rendah berarti vegetasi tertekan sehingga butuh penanganan lebih intensif. Batas nilai dan isi rekomendasi saat ini masih draf dan harus divalidasi pihak yang memahami pertanian.",
  },
  {
    q: "Bagaimana memakai analisis rekomendasi?",
    a: "Buka Peta Saya, mode Lihat petak, lalu pilih tingkat intensitas pada panel Analisis rekomendasi. Anda akan melihat jenis tindakan, intensitas tindakan, dan intervalnya, serta petak mana saja yang masuk kategori itu.",
  },
  {
    q: "Bagaimana mengunduh KML atau KMZ?",
    a: "KML/KMZ hanya untuk diunduh. Pilih satu atau beberapa petak 100 × 100 m di peta (klik petaknya), lalu tekan KML atau KMZ. Centang opsi file terpisah bila perangkat lunak drone Anda memerlukan satu file per petak. Untuk area buatan sendiri, buat polygon di mode Custom petak, simpan, lalu unduh dari daftar polygon.",
  },
  {
    q: "Apa beda KML dan KMZ?",
    a: "KMZ adalah KML yang dikompres. Isi spasialnya sama. Gunakan format yang diterima perangkat lunak misi drone Anda, dan uji satu file dulu sebelum dipakai di lapangan karena kompatibilitas tiap perangkat lunak bisa berbeda.",
  },
  {
    q: "Apa itu versi peta?",
    a: "Setiap unggahan NDVI membuat satu versi. Pilih versi pada Peta Saya untuk membandingkan kondisi dari survei yang berbeda. Admin menentukan versi mana yang aktif secara bawaan.",
  },
  {
    q: "Apa yang diunggah admin di Upload Peta?",
    a: "File TIFF: GeoTIFF NDVI satu band dengan nilai -1 sampai 1 dan sistem koordinat yang terdefinisi. TIFF diubah otomatis menjadi tile (PMTiles) untuk ditampilkan di Peta Saya. Area peta diambil dari TIFF pertama, jadi tidak perlu mengunggah batas lahan terpisah.",
  },
  {
    q: "Mengapa saya tiba-tiba keluar dari sistem?",
    a: "Sesi berakhir otomatis setelah 1 jam tanpa aktivitas. Login kembali untuk melanjutkan. Bila Anda mencentang Ingat saya saat login, sesi bertahan lebih lama di perangkat itu.",
  },
  {
    q: "Apa perbedaan akun User dan Admin?",
    a: "User dapat melihat dashboard, peta, dan rekomendasi, membuat polygon custom, dan mengekspor KML/KMZ. Admin juga dapat mengunggah peta (TIFF), mengelola versi, serta mengelola akun pengguna.",
  },
];

export default function FaqPage() {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title="Panduan"
        desc="Jawaban singkat untuk pertanyaan yang sering muncul."
      />
      <FaqList items={FAQ} />
    </div>
  );
}
