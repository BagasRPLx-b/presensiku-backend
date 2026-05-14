// ============================================================
// Konfigurasi Koneksi MySQL menggunakan mysql2 (promise-based)
// ============================================================

const mysql = require('mysql2/promise');
require('dotenv').config();

/**
 * Membuat connection pool ke MySQL.
 * Pool lebih efisien daripada single connection karena:
 * - Reuse koneksi yang sudah ada
 * - Otomatis handle koneksi yang terputus
 * - Mendukung concurrent queries
 */
const pool = mysql.createPool({
  host:     process.env.DB_HOST || 'localhost',
  port:     parseInt(process.env.DB_PORT, 10) || 3306,
  user:     process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'presensi_ku',

  // Pool settings
  waitForConnections: true,   // antri jika semua koneksi sedang dipakai
  connectionLimit:    10,     // max 10 koneksi bersamaan
  queueLimit:         0,      // unlimited antrian
});

// Test koneksi saat startup
(async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ MySQL terhubung — database:', process.env.DB_NAME);
    connection.release();
  } catch (err) {
    console.error('❌ Gagal terhubung ke MySQL:', err.message);
    process.exit(1);
  }
})();

module.exports = pool;
