// ============================================================
// Routes: CRUD Data Siswa (untuk Web Admin)
// ============================================================

const express = require('express');
const router  = express.Router();
const bcrypt  = require('bcrypt');
const db      = require('../config/database');

const SALT_ROUNDS = 10; // jumlah round untuk bcrypt hashing

// ----------------------------------------------------------
// GET /api/students
// Mengambil semua data siswa (tanpa password)
// ----------------------------------------------------------
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(
      'SELECT id, nisn, nama_lengkap, kelas, created_at, updated_at FROM students ORDER BY nama_lengkap ASC'
    );

    res.json({
      success: true,
      message: 'Data siswa berhasil diambil',
      data: rows,
    });
  } catch (error) {
    console.error('Error get students:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
});

// ----------------------------------------------------------
// POST /api/students
// Menambahkan siswa baru
// Body: { nisn, password, nama_lengkap, kelas }
// ----------------------------------------------------------
router.post('/', async (req, res) => {
  try {
    const { nisn, password, nama_lengkap, kelas } = req.body;

    // Validasi input
    if (!nisn || !password || !nama_lengkap || !kelas) {
      return res.status(400).json({
        success: false,
        message: 'Semua field (nisn, password, nama_lengkap, kelas) wajib diisi',
      });
    }

    // Cek apakah NISN sudah terdaftar
    const [existing] = await db.query(
      'SELECT id FROM students WHERE nisn = ?',
      [nisn]
    );

    if (existing.length > 0) {
      return res.status(409).json({
        success: false,
        message: 'NISN sudah terdaftar',
      });
    }

    // Hash password menggunakan bcrypt
    // bcrypt.hash(plainText, saltRounds) menghasilkan hash yang aman
    const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

    // Simpan ke database
    const [result] = await db.query(
      'INSERT INTO students (nisn, password, nama_lengkap, kelas) VALUES (?, ?, ?, ?)',
      [nisn, hashedPassword, nama_lengkap, kelas]
    );

    res.status(201).json({
      success: true,
      message: 'Siswa berhasil ditambahkan',
      data: {
        id: result.insertId,
        nisn,
        nama_lengkap,
        kelas,
      },
    });
  } catch (error) {
    console.error('Error create student:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
});

// ----------------------------------------------------------
// PUT /api/students/:id
// Mengupdate data siswa
// Body: { nisn?, password?, nama_lengkap?, kelas? }
// Field bersifat opsional — hanya field yang dikirim yang diupdate
// ----------------------------------------------------------
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { nisn, password, nama_lengkap, kelas } = req.body;

    // Cek apakah siswa ada
    const [existing] = await db.query(
      'SELECT * FROM students WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Siswa tidak ditemukan',
      });
    }

    // Bangun query UPDATE secara dinamis berdasarkan field yang dikirim
    const updates = [];
    const values  = [];

    if (nisn) {
      updates.push('nisn = ?');
      values.push(nisn);
    }
    if (password) {
      // Hash password baru sebelum disimpan
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      updates.push('password = ?');
      values.push(hashedPassword);
    }
    if (nama_lengkap) {
      updates.push('nama_lengkap = ?');
      values.push(nama_lengkap);
    }
    if (kelas) {
      updates.push('kelas = ?');
      values.push(kelas);
    }

    // Jika tidak ada field yang dikirim
    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Minimal satu field harus diisi untuk update',
      });
    }

    values.push(id); // untuk WHERE clause

    await db.query(
      `UPDATE students SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    res.json({
      success: true,
      message: 'Data siswa berhasil diupdate',
    });
  } catch (error) {
    console.error('Error update student:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
});

// ----------------------------------------------------------
// DELETE /api/students/:id
// Menghapus data siswa
// ----------------------------------------------------------
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Cek apakah siswa ada
    const [existing] = await db.query(
      'SELECT id FROM students WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Siswa tidak ditemukan',
      });
    }

    // Hapus siswa (attendances terhapus otomatis via ON DELETE CASCADE)
    await db.query('DELETE FROM students WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Siswa berhasil dihapus',
    });
  } catch (error) {
    console.error('Error delete student:', error);
    res.status(500).json({
      success: false,
      message: 'Terjadi kesalahan server',
    });
  }
});

module.exports = router;
