// ============================================================
// PRESENSI KU — Main Server Entry Point
// ============================================================

require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app  = express();
// Railway biasanya akan otomatis memberikan PORT, jadi kita tangkap di sini
const PORT = process.env.PORT || 8080;

// === MIDDLEWARE ===
app.use(express.json());
app.use(cors({ origin: '*', methods: ['GET','POST','PUT','DELETE','PATCH'] }));

// Request logger
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  next();
});

// === ROUTES ===
const authRoutes       = require('./routes/authRoutes');
const studentRoutes    = require('./routes/studentRoutes');
const attendanceRoutes = require('./routes/attendanceRoutes');
const reportRoutes     = require('./routes/reportRoutes');
const statRoutes       = require('./routes/statRoutes');
const announcementRoutes = require('./routes/announcementRoutes');
const leaveRoutes      = require('./routes/leaveRoutes');

app.use('/api/auth',       authRoutes);
app.use('/api/students',   studentRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/attendances',attendanceRoutes);
app.use('/api/reports',    reportRoutes);
app.use('/api/stats',      statRoutes);
app.use('/api/announcements', announcementRoutes);
app.use('/api/leaves',     leaveRoutes);

// Health check
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Presensi Ku API running', version: '1.0.0' });
});

// 404
app.use((req, res) => {
  res.status(404).json({ success: false, message: `${req.method} ${req.url} not found` });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ success: false, message: 'Internal Server Error' });
});

// Start Server - Menggunakan "0.0.0.0" agar sukses jalan di Railway
app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Presensi Ku API running at port ${PORT}`);
});