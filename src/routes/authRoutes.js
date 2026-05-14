// ============================================================
// Routes: Autentikasi (Login Siswa & Admin)
// ============================================================

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const db      = require('../config/database');

// ----------------------------------------------------------
// POST /api/auth/student/login
// Validasi login siswa dari Android
// Body: { nisn, password }
// ----------------------------------------------------------
router.post('/student/login', async (req, res) => {
  try {
    const { nisn, password } = req.body;

    // Validasi input
    if (!nisn || !password) {
      return res.status(400).json({
        success: false,
        message: 'NISN dan password wajib diisi',
      });
    }

    // Cari siswa berdasarkan NISN
    const [rows] = await db.query(
      'SELECT * FROM students WHERE nisn = ?',
      [nisn]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'NISN tidak ditemukan',
      });
    }

    const student = rows[0];

    // Bandingkan password yang dikirim dengan hash di database
    const isMatch = await bcrypt.compare(password, student.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Password salah',
      });
    }

    // ---- VALIDASI DEVICE ID BINDING ----
    const { device_id } = req.body;
    if (device_id) {
      if (student.device_id && student.device_id !== device_id) {
        return res.status(403).json({
          success: false,
          message: 'Akun ini sudah terikat dengan perangkat lain',
        });
      }
      // Jika belum punya device_id, ikat sekarang
      if (!student.device_id) {
        await db.query('UPDATE students SET device_id = ? WHERE id = ?', [device_id, student.id]);
      }
    }

    // Login berhasil — kembalikan data siswa (tanpa password)
    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        id:           student.id,
        nisn:         student.nisn,
        nama_lengkap: student.nama_lengkap,
        kelas:        student.kelas,
      },
    });
  } catch (error) {
    console.error('Error student login:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
});

// ----------------------------------------------------------
// POST /api/auth/admin/login
// Validasi login admin dari Web React
// Body: { username, password }
// ----------------------------------------------------------
router.post('/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Validasi input
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi',
      });
    }

    // Cari admin berdasarkan username
    const [rows] = await db.query(
      'SELECT * FROM admins WHERE username = ?',
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Username tidak ditemukan',
      });
    }

    const admin = rows[0];

    // Bandingkan password
    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Password salah',
      });
    }

    // Login berhasil
    res.json({
      success: true,
      message: 'Login berhasil',
      data: {
        id:       admin.id,
        username: admin.username,
      },
    });
  } catch (error) {
    console.error('Error admin login:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
});

// ----------------------------------------------------------
// POST /api/auth/register-device
// Menyimpan device_id unik siswa
// Body: { student_id, device_id }
// ----------------------------------------------------------
router.post('/register-device', async (req, res) => {
  try {
    const { student_id, device_id } = req.body;

    if (!student_id || !device_id) {
      return res.status(400).json({
        success: false,
        message: 'student_id dan device_id wajib diisi'
      });
    }

    const [rows] = await db.query('SELECT device_id FROM students WHERE id = ?', [student_id]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Siswa tidak ditemukan' });
    }

    const currentDeviceId = rows[0].device_id;
    if (currentDeviceId && currentDeviceId !== device_id) {
      return res.status(403).json({
        success: false,
        message: 'Akun ini sudah terikat dengan perangkat lain'
      });
    }

    await db.query('UPDATE students SET device_id = ? WHERE id = ?', [device_id, student_id]);

    res.json({
      success: true,
      message: 'Device ID berhasil didaftarkan'
    });
  } catch (error) {
    console.error('Error register device:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server'
    });
  }
});

module.exports = router;
