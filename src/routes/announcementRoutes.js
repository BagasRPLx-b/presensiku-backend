const express = require('express');
const router = express.Router();
const db = require('../config/database');
const admin = require('../config/firebase');

router.post('/', async (req, res) => {
  try {
    const { title, content } = req.body;
    if (!title || !content) {
      return res.status(400).json({ success: false, message: 'Judul dan konten wajib diisi' });
    }

    const [result] = await db.query(
      'INSERT INTO announcements (title, content) VALUES (?, ?)',
      [title, content]
    );

    // Send push notification via Firebase Admin to "siswa" topic
    if (admin.apps && admin.apps.length > 0) {
      const message = {
        notification: {
          title: `Pengumuman Baru: ${title}`,
          body: content.length > 50 ? content.substring(0, 50) + '...' : content
        },
        topic: 'siswa'
      };
      
      try {
        await admin.messaging().send(message);
        console.log('Successfully sent message:', message);
      } catch (fbError) {
        console.error('Error sending firebase message:', fbError);
      }
    }

    res.status(201).json({
      success: true,
      message: 'Pengumuman berhasil dibuat',
      data: { id: result.insertId, title, content }
    });
  } catch (error) {
    console.error('Announcement error:', error);
    res.status(500).json({ success: false, message: 'Terjadi kesalahan server' });
  }
});

router.get('/latest', async (req, res) => {
  try {
    const [rows] = await db.query('SELECT * FROM announcements ORDER BY created_at DESC LIMIT 1');
    if (rows.length === 0) {
      return res.json({ success: true, message: 'Belum ada pengumuman hari ini.' });
    }
    // Return the content as message to match HomeFragment's expectations
    res.json({ 
      success: true, 
      message: rows[0].content,
      data: rows[0]
    });
  } catch (error) {
    console.error('Fetch latest announcement error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil pengumuman' });
  }
});

module.exports = router;
