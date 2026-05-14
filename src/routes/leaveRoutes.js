const express = require('express');
const router = express.Router();
const db = require('../config/database');
const multer = require('multer');
const path = require('path');
const admin = require('../config/firebase');
const fs = require('fs');

// Create uploads dir if it doesn't exist
const uploadDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadDir)){
    fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir)
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// GET /api/leaves
// Ambil semua pengajuan izin yang berstatus Pending
router.get('/', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT l.*, s.nama_lengkap, s.nisn, s.kelas 
      FROM leaves l 
      JOIN students s ON l.student_id = s.id 
      WHERE l.status = 'Pending' 
      ORDER BY l.created_at DESC
    `);
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Fetch leaves error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data pengajuan' });
  }
});

// POST /api/leaves/apply
router.post('/apply', upload.single('file'), async (req, res) => {
  try {
    const { student_id, type, reason } = req.body;
    const file_path = req.file ? req.file.filename : null;

    if (!student_id || !type || !reason) {
      return res.status(400).json({ success: false, message: 'student_id, type, and reason are required' });
    }

    const [result] = await db.query(
      'INSERT INTO leaves (student_id, type, reason, file_path) VALUES (?, ?, ?, ?)',
      [student_id, type, reason, file_path]
    );

    res.status(201).json({
      success: true,
      message: 'Pengajuan izin berhasil',
      data: { id: result.insertId, student_id, type, reason, file_path, status: 'Pending' }
    });
  } catch (error) {
    console.error('Leave apply error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

// PATCH /api/leaves/approve/:id
router.patch('/approve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // Approved or Rejected

    if (!['Approved', 'Rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Status must be Approved or Rejected' });
    }

    const [updateResult] = await db.query(
      'UPDATE leaves SET status = ? WHERE id = ?',
      [status, id]
    );

    if (updateResult.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Pengajuan izin tidak ditemukan' });
    }

    // Get student info to notify
    const [rows] = await db.query(`
      SELECT l.*, s.device_id, s.nama_lengkap 
      FROM leaves l 
      JOIN students s ON l.student_id = s.id 
      WHERE l.id = ?
    `, [id]);

    const leave = rows[0];

    // Notify the specific student
    if (admin.apps && admin.apps.length > 0 && leave && leave.device_id) {
      const message = {
        notification: {
          title: `Status Pengajuan ${leave.type} Anda`,
          body: `Pengajuan ${leave.type} Anda telah ${status === 'Approved' ? 'Disetujui' : 'Ditolak'}.`
        },
        token: leave.device_id
      };
      try {
        await admin.messaging().send(message);
      } catch (fbError) {
        console.error('Error sending firebase message to device:', fbError);
      }
    }

    // Insert to attendances if Approved
    if (status === 'Approved') {
       const today = new Date().toISOString().split('T')[0];
       try {
         await db.query(
           'INSERT IGNORE INTO attendances (student_id, tanggal, jam_masuk, status) VALUES (?, ?, ?, ?)',
           [leave.student_id, today, new Date().toTimeString().split(' ')[0], leave.type.toLowerCase() === 'izin' ? 'izin' : 'sakit']
         );
       } catch (dbErr) {
         console.error('Failed to insert attendance for approved leave:', dbErr);
       }
    }

    res.json({ success: true, message: `Pengajuan berhasil di${status === 'Approved' ? 'setujui' : 'tolak'}` });
  } catch (error) {
    console.error('Leave approve error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

module.exports = router;
