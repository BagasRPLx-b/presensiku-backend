// ============================================================
// PRESENSI KU — Main Server Entry Point
// ============================================================

require('dotenv').config();
const express = require('express');
const cors    = require('cors');

const app  = express();
const PORT = process.env.PORT || 8080;

// === MIDDLEWARE (WAJIB URUTAN INI) ===

// 1. Letakkan CORS di paling atas
app.use(cors({ 
  origin: '*', 
  methods: ['GET','POST','PUT','DELETE','PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Parser JSON setelah CORS
app.use(express.json());

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

app.listen(PORT, "0.0.0.0", () => {
  console.log(`✅ Presensi Ku API running at port ${PORT}`);
});