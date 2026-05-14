// ============================================================
// Routes: Absensi & Logika Daily QR Code
// ============================================================

const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const db      = require('../config/database');

// ----------------------------------------------------------
// Helper: Generate token QR harian
// Format: PRESENSI-YYYY-MM-DD-<HMAC_HASH>
//
// Token di-generate dari tanggal hari ini + secret key.
// Karena inputnya deterministik (tanggal + secret), maka
// token yang sama akan dihasilkan setiap kali dipanggil
// pada hari yang sama — tanpa perlu menyimpan di database.
// ----------------------------------------------------------
function generateDailyToken() {
  const today     = new Date();
  const dateStr   = today.toISOString().slice(0, 10); // YYYY-MM-DD
  const secretKey = process.env.QR_SECRET_KEY || 'DEFAULT_SECRET';

  // Buat HMAC-SHA256 dari tanggal + secret agar tidak bisa ditebak
  const hmac = crypto
    .createHmac('sha256', secretKey)
    .update(dateStr)
    .digest('hex')
    .substring(0, 16)   // ambil 16 karakter pertama agar tidak terlalu panjang
    .toUpperCase();

  return `PRESENSI-${dateStr}-${hmac}`;
}

// ----------------------------------------------------------
// Helper: Ambil tanggal hari ini dalam format YYYY-MM-DD
// ----------------------------------------------------------
function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

// ----------------------------------------------------------
// Helper: Ambil jam saat ini dalam format HH:MM:SS
// ----------------------------------------------------------
function getCurrentTime() {
  return new Date().toTimeString().slice(0, 8);
}

// ----------------------------------------------------------
// Helper: Hitung status waktu berdasarkan jam masuk
//  - sebelum 06:45 => Tepat Waktu
//  - 06:45 sampai 07:00 => Hampir Terlambat
//  - setelah 07:00 => Terlambat
// ----------------------------------------------------------
function determineTimeStatus(time) {
  if (!time) return null;
  if (time <= '06:45:00') return 'Tepat Waktu';
  if (time <= '07:00:00') return 'Hampir Terlambat';
  return 'Terlambat';
}

// ----------------------------------------------------------
// GET /api/attendance/qr-today
// Endpoint untuk Web Admin
// Mengembalikan string token QR unik khusus hari ini.
// Admin menampilkan ini sebagai QR Code di layar/proyektor.
// ----------------------------------------------------------
router.get('/qr-today', async (req, res) => {
  try {
    const token = generateDailyToken();
    const today = getTodayDate();

    res.json({
      success: true,
      message: 'QR Token hari ini berhasil dibuat',
      data: {
        qr_token: token,
        tanggal:  today,
        // Catatan: token ini hanya berlaku untuk hari ini
        keterangan: 'Token ini berganti setiap hari secara otomatis',
      },
    });
  } catch (error) {
    console.error('Error generate QR token:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
});

// ----------------------------------------------------------
// POST /api/attendance/scan
// Endpoint untuk Android
// Body: { student_id, qr_token, lokasi? }
//
// Alur validasi:
// 1. Cek apakah qr_token yang dikirim SAMA dengan token hari ini
// 2. Cek apakah siswa sudah absen hari ini (prevent duplikat)
// 3. Jika valid & belum absen → catat ke tabel attendances
// ----------------------------------------------------------
router.post('/scan', async (req, res) => {
  try {
    const { student_id, qr_token, lokasi } = req.body;

    // Validasi input
    if (!student_id || !qr_token) {
      return res.status(400).json({
        success: false,
        message: 'student_id dan qr_token wajib diisi',
      });
    }

    // ---- LANGKAH 1: Validasi QR Token ----
    const validToken = generateDailyToken();

    if (qr_token !== validToken) {
      return res.status(401).json({
        success: false,
        message: 'QR Code Tidak Valid/Kedaluwarsa',
      });
    }

    // ---- LANGKAH 2: Cek apakah siswa ada di database ----
    const [studentRows] = await db.query(
      'SELECT id, nama_lengkap FROM students WHERE id = ?',
      [student_id]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Siswa tidak ditemukan',
      });
    }

    // ---- LANGKAH 3: Cek apakah sudah absen hari ini ----
    const today = getTodayDate();

    const [existingAttendance] = await db.query(
      'SELECT id FROM attendances WHERE student_id = ? AND tanggal = ?',
      [student_id, today]
    );

    if (existingAttendance.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'Anda sudah melakukan absensi hari ini',
      });
    }

    // ---- LANGKAH 4: Catat absensi ----
    const jamMasuk = getCurrentTime();
    const statusWaktu = determineTimeStatus(jamMasuk);

    const [result] = await db.query(
      'INSERT INTO attendances (student_id, tanggal, jam_masuk, status, lokasi, status_waktu, status_pulang) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [student_id, today, jamMasuk, 'hadir', lokasi || null, statusWaktu, 'Masih di Sekolah']
    );

    res.status(201).json({
      success: true,
      message: 'Absensi berhasil dicatat',
      data: {
        id:             result.insertId,
        student_id:     parseInt(student_id, 10),
        nama_lengkap:   studentRows[0].nama_lengkap,
        tanggal:        today,
        jam_masuk:      jamMasuk,
        status:         'hadir',
        lokasi:         lokasi || null,
        status_waktu:   statusWaktu,
        status_pulang:  'Masih di Sekolah',
      },
    });
  } catch (error) {
    console.error('Error scan attendance:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
});

// ----------------------------------------------------------
// PATCH /api/attendance/:id/pulang
// Tandai siswa sudah pulang dari sekolah
// ----------------------------------------------------------
router.patch('/:id/pulang', async (req, res) => {
  try {
    const attendanceId = req.params.id;

    const [existing] = await db.query(
      'SELECT id, status_pulang FROM attendances WHERE id = ?',
      [attendanceId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ success: false, message: 'Data absensi tidak ditemukan' });
    }

    if (existing[0].status_pulang === 'Sudah Pulang') {
      return res.status(400).json({ success: false, message: 'Siswa sudah ditandai pulang' });
    }

    await db.query(
      'UPDATE attendances SET status_pulang = ? WHERE id = ?',
      ['Sudah Pulang', attendanceId]
    );

    res.json({ success: true, message: 'Status pulang berhasil diperbarui' });
  } catch (error) {
    console.error('Error update status pulang:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// ----------------------------------------------------------
// GET /api/attendance/history/:student_id
// Mengambil riwayat absensi 1 siswa (untuk Android)
// ----------------------------------------------------------
router.get('/history/:student_id', async (req, res) => {
  try {
    const { student_id } = req.params;

    // Cek apakah siswa ada
    const [studentRows] = await db.query(
      'SELECT id, nisn, nama_lengkap, kelas FROM students WHERE id = ?',
      [student_id]
    );

    if (studentRows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Siswa tidak ditemukan',
      });
    }

    // Ambil riwayat absensi, urutkan dari yang terbaru
    const [attendances] = await db.query(
      'SELECT id, tanggal, jam_masuk, status, lokasi, created_at FROM attendances WHERE student_id = ? ORDER BY tanggal DESC',
      [student_id]
    );

    res.json({
      success: true,
      message: 'Riwayat absensi berhasil diambil',
      data: {
        siswa:     studentRows[0],
        riwayat:   attendances,
        total:     attendances.length,
      },
    });
  } catch (error) {
    console.error('Error get attendance history:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
});

// ----------------------------------------------------------
// GET /api/attendances
// Mengambil rekap absensi semua siswa HARI INI (untuk Web)
// ----------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const today = getTodayDate();

    // JOIN dengan tabel students untuk menampilkan nama & kelas
    const [rows] = await db.query(
      `SELECT 
         a.id,
         a.student_id,
         s.nisn,
         s.nama_lengkap,
         s.kelas,
         a.tanggal,
         a.jam_masuk,
         a.status,
         a.status_waktu,
         a.status_pulang
       FROM attendances a
       JOIN students s ON a.student_id = s.id
       WHERE a.tanggal = ?
       ORDER BY a.jam_masuk ASC`,
      [today]
    );

    res.json({
      success: true,
      message: `Rekap absensi tanggal ${today}`,
      data: {
        tanggal:      today,
        total_hadir:  rows.length,
        attendances:  rows,
      },
    });
  } catch (error) {
    console.error('Error get attendances today:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
});

module.exports = router;
