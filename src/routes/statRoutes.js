const express = require('express');
const router = express.Router();
const db = require('../config/database');

router.get('/dashboard', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT 
        YEARWEEK(tanggal, 1) AS minggu,
        status,
        COUNT(*) AS total
      FROM attendances
      GROUP BY minggu, status
      ORDER BY minggu DESC
      LIMIT 50
    `);

    res.json({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil data statistik' });
  }
});

module.exports = router;
