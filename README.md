# Toko Rosyidah — starter project

Website toko/kasir online dengan Next.js, TypeScript, dan Supabase.

## 1. Kebutuhan
- Node.js versi LTS
- Akun Supabase
- VS Code

## 2. Jalankan proyek
Di terminal, masuk ke folder proyek lalu jalankan:

```bash
npm install
cp .env.local.example .env.local
npm run dev
```

Buka http://localhost:3000.

Di Windows PowerShell, jika `cp` tidak tersedia, gunakan:
`Copy-Item .env.local.example .env.local`

## 3. Siapkan Supabase
1. Buat project baru di Supabase.
2. Buka SQL Editor.
3. Salin isi `supabase/schema.sql`, lalu jalankan.
4. Buka Project Settings → API, salin Project URL dan publishable/anon key.
5. Isi nilai tersebut di `.env.local`.
6. Restart server development setelah mengubah `.env.local`.

## 4. Status starter ini
- Halaman dashboard dan navigasi adalah tampilan awal.
- Menu selain dashboard masih berupa kerangka/placeholder.
- Database schema dasar disertakan, tetapi kebijakan akses RLS, login, RPC transaksi atomik, penyimpanan kulakan, persetujuan harga, dan checkout kasir belum diaktifkan.
- Jangan gunakan untuk transaksi toko sungguhan sebelum autentikasi, kebijakan akses, dan fungsi transaksi server-side selesai dibuat dan diuji.
- Jangan menaruh `service_role` key di kode browser atau mengirimkannya kepada siapa pun.

## 5. Aturan bisnis yang sudah dirancang
- Nama struk: TOKO ROSYIDAH
- Alamat struk: Sebaung
- Persentase keuntungan ditetapkan per produk dan dihitung sebagai markup dari harga kulakan.
- Penginput kulakan tidak menentukan persentase keuntungan/harga jual.
- Perubahan harga berlaku untuk transaksi baru; transaksi lama menyimpan snapshot harga jual, harga pokok, dan keuntungan.
