# RackUp

Aplikasi simpel buat nyatet skor main billiard bareng teman: tanggal, siapa lawan siapa, dan skornya (misal 6–8). Bisa juga dipakai sebagai shot clock saat main.

Dibuat dengan React + Vite + [Material UI](https://mui.com/material-ui/) (`@mui/material`) dan [MUI X Date Pickers](https://mui.com/x/react-date-pickers/) untuk pilih tanggal.

## Jalankan

```bash
bun install
cp .env.example .env.local   # isi VITE_API_URL (alamat rackUp-api)
bun dev        # buka http://localhost:5173
bun run build  # hasil build ada di folder dist/
```

Butuh backend [rackUp-api](../rackUp-api) yang jalan, dan origin frontend harus ada di `CORS_ORIGINS` backend.

## Login

Semua halaman butuh login. Pengunjung yang belum login hanya melihat halaman 404. Halaman login **tidak ditautkan di mana pun**: kirim link `/login-secret` ke teman yang boleh masuk (bisa diganti lewat `VITE_LOGIN_PATH`). Tidak ada pendaftaran; akun dibuat admin lewat CLI backend dan **otomatis kedaluwarsa setelah 30 hari**. Keluar lewat menu `⋯` → *Keluar*.

Detail alur login, sesi, kedaluwarsa, env var, endpoint, dan cara tes koneksi API: [docs/AUTH.md](docs/AUTH.md).

## Fitur

- **Mulai sesi (shot clock)**: pilih 2 pemain, lalu atur durasi shot clock dan extension (default 30 + 30 detik).
  - Ketuk jam untuk mulai/jeda. *Pukulan baru* mengulang jam untuk pemain yang sama, *Ganti giliran* memindahkan giliran ke lawan. Keduanya langsung menjalankan jam.
  - Bunyi di 10 detik terakhir dan tiap detik di 5 detik terakhir (bisa dimatikan); HP juga bergetar saat waktu habis.
  - **Extension**: 1× per pemain tiap rack, otomatis tersedia lagi di rack berikutnya.
  - **Rack selesai**: pilih pemenang rack, skor rack bertambah (bisa dibatalkan lewat notifikasi).
  - Layar tidak mati selama sesi berjalan. Kalau halaman ter-refresh, sesi tetap jalan.
  - Saat sesi diakhiri, skor rack bisa langsung disimpan ke Riwayat.
- **Sesi bersama (beberapa HP)**: sesi disimpan di server, jadi bisa diikuti dari HP lain.
  - HP lain melihat kartu *Sesi sedang berjalan* di halaman utama → **Gabung**. Jam, giliran, dan skor sama di semua HP (jeda ±1 detik). Semua HP boleh menekan tombol apa saja.
  - Nama pemain yang sama dengan nama akun (atau username) otomatis terhubung ke akun itu (terlihat di bawah kolom nama saat mulai sesi). Saat giliran pindah ke pemain itu, HP-nya bergetar dan menampilkan **Giliran kamu!**
  - Tombol sama ditekan di dua HP bersamaan (misal *Rack selesai*) tetap dihitung sekali.
  - Sinyal hilang: HP tetap jalan dan menampilkan *Offline*; ketukan dikirim saat sinyal kembali.
  - *Akhiri sesi* menutup sesi di semua HP (skor disimpan sekali). *Tutup di HP ini* hanya menutup di HP itu; sesi tetap jalan di HP lain.
  - Jam memakai waktu server, jadi tetap sama walau jam di tiap HP beda.
- **Catat skor manual**: tanggal (date picker), nama 2 pemain (ada saran nama dari catatan sebelumnya), skor dengan tombol +/−, dan catatan opsional.
- **Riwayat**: dikelompokkan per bulan, dengan menu edit/hapus (hapus bisa dibatalkan lewat notifikasi).
- **Statistik**: klasemen pemain (main, menang, kalah, rack, win rate, 5 hasil terakhir) dan rekap head to head.
- **Backup**: menu `⋯` di kanan atas → *Unduh backup* / *Impor dari file* (JSON). Impor menggabungkan data, tidak menimpa.

Data disimpan di server (rackUp-api) dan **dipakai bersama oleh semua akun**: semua akun melihat, mengedit, dan menghapus riwayat yang sama. Daftar otomatis diperbarui saat aplikasi dibuka lagi dan tiap 30 detik. Data lama yang masih tersimpan di browser (versi sebelum ada login) bisa dipindahkan lewat menu `⋯` → *Unggah data di perangkat ini*.

## Install sebagai aplikasi (PWA)

- Bisa di-install ke layar utama HP: Chrome Android → menu → *Instal aplikasi*; Safari iOS → *Bagikan* → *Tambah ke Layar Utama*.
- Setelah dibuka sekali, tampilan aplikasi dan shot clock (termasuk bunyinya) jalan **offline**. Menyimpan dan memuat catatan butuh koneksi ke server.
- Kalau ada versi baru, muncul notifikasi *Versi baru tersedia* → *Muat ulang*. Tidak reload otomatis, jadi sesi yang sedang jalan tidak terganggu.
- PWA cuma aktif di hasil build (`bun run build` lalu `bun run preview`), tidak di `bun dev`. Butuh HTTPS saat di-deploy (localhost boleh tanpa HTTPS).
- Ikon dibuat dari `public/favicon.svg`. Kalau favicon diganti, jalankan `bun run icons` (pengaturan di [`pwa-assets.config.ts`](pwa-assets.config.ts)).

## Ganti tema

- Warna untuk CSS sendiri ada di [`src/styles/theme.css`](src/styles/theme.css), warna komponen MUI ada di [`src/theme.ts`](src/theme.ts). Kalau ganti warna, ubah di kedua file.
- Default: tema gelap "meja hijau". Mode terang otomatis mengikuti setting perangkat.
- Paksa satu tema: tambahkan `defaultMode="dark"` atau `defaultMode="light"` pada `<ThemeProvider>` di [`src/main.tsx`](src/main.tsx).

Style tambahan (kartu, hero, shot clock, dll.) ada di [`src/styles/app.css`](src/styles/app.css).

## Struktur

```
src/
  App.tsx                  halaman utama, menu, tabs, dialog hapus
  main.tsx                 provider MUI (tema, date picker, notifikasi) + AuthProvider/AuthGate
  theme.ts                 tema MUI + teks date picker bahasa Indonesia
  components/
    SessionSetupDialog.tsx form mulai sesi (pemain, durasi)
    SessionScreen.tsx      layar shot clock, rack, extension, tanda "Giliran kamu"
    LiveSessionsBanner.tsx kartu "Sesi sedang berjalan" + tombol Gabung
    MatchDialog.tsx        form catat/edit skor
    SheetDialog.tsx        dialog yang jadi bottom sheet di HP
    PlayerInput.tsx        input nama pemain dengan saran
    HistoryList.tsx        daftar riwayat
    MoreMenu.tsx           menu "⋯"
    StatsView.tsx          klasemen & head to head
    Toaster.tsx            notifikasi (Snackbar)
    PwaUpdater.tsx         daftarin service worker + notifikasi versi baru
    PlayerBall.tsx         avatar bola biliar per pemain
    AuthProvider.tsx       sesi login: pulihkan, cek ke server, auto logout
    AuthGate.tsx           penjaga rute: belum login → halaman login
    LoginPage.tsx          halaman login tersembunyi
  lib/
    session.ts             aturan shot clock/rack/extension (reducer)
    liveSession.ts         sinkron sesi antar HP: antrean ketukan, polling, offline
    serverClock.ts         perkiraan jam server, supaya semua HP menghitung sama
    accounts.ts            daftar akun + cocokkan nama pemain ke akun
    sound.ts               bunyi beep & getar
    useWakeLock.ts         jaga layar tetap nyala
    toast.ts               hook useToast
    matches.ts             tipe data + hook useMatches (ambil/simpan lewat API)
    api/                   client.ts (fetch + token + error), auth.ts, matches.ts, liveSessions.ts, users.ts
    auth.ts                AuthContext + useAuth + simpan sesi
    router.ts              router mini (useLocation, navigate)
    config.ts              baca VITE_API_URL, VITE_LOGIN_PATH
    stats.ts               hitung statistik
    format.ts              format tanggal & durasi (id-ID)
  styles/
    theme.css              token warna & font
    app.css                style komponen
```
