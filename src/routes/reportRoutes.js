const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const db = require('../config/database');

function todayDate() {
  return new Date().toISOString().slice(0, 10);
}

function thisWeekRange() {
  const today = new Date();
  const day = today.getDay();
  const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Monday-based week
  const monday = new Date(today.setDate(diff));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  const format = (date) => date.toISOString().slice(0, 10);
  return { start: format(monday), end: format(sunday) };
}

function thisMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

async function getRecapRows(start, end) {
  const [rows] = await db.query(
    `SELECT
       s.id,
       s.nama_lengkap,
       SUM(a.status = 'hadir') AS hadir,
       SUM(a.status = 'izin') AS izin,
       SUM(a.status = 'sakit') AS sakit,
       SUM(a.status = 'alpha') AS alpa,
       COUNT(a.id) AS total,
       ROUND(
         100 * SUM(a.status = 'hadir') / NULLIF(COUNT(a.id), 0),
         2
       ) AS kehadiran_pct
     FROM students s
     LEFT JOIN attendances a
       ON a.student_id = s.id
       AND a.tanggal BETWEEN ? AND ?
     GROUP BY s.id, s.nama_lengkap
     ORDER BY s.nama_lengkap ASC`,
    [start, end]
  );
  return rows;
}

function styleHeader(worksheet) {
  worksheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' },
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
    };
  });
}

function styleBorders(worksheet) {
  worksheet.eachRow((row) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
        right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      };
    });
  });
}

async function writeWorkbook(res, worksheet) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  await worksheet.workbook.xlsx.write(res);
  res.end();
}

router.get('/export/today', async (req, res) => {
  try {
    const today = todayDate();
    const [rows] = await db.query(
      `SELECT s.nama_lengkap, a.jam_masuk, a.status_waktu
         FROM attendances a
         JOIN students s ON a.student_id = s.id
         WHERE a.tanggal = ?
         ORDER BY a.jam_masuk ASC`,
      [today]
    );

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Absensi Hari ini');

    worksheet.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Nama Lengkap', key: 'nama_lengkap', width: 32 },
      { header: 'Jam Masuk', key: 'jam_masuk', width: 18 },
      { header: 'Status Waktu', key: 'status_waktu', width: 24 },
    ];

    styleHeader(worksheet);

    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        nama_lengkap: row.nama_lengkap,
        jam_masuk: row.jam_masuk,
        status_waktu: row.status_waktu || 'Tidak ditentukan',
      });
    });

    styleBorders(worksheet);
    await writeWorkbook(res, worksheet);
  } catch (error) {
    console.error('Export today error:', error);
    res.status(500).json({ success: false, message: 'Gagal export data hari ini' });
  }
});

router.get('/export/weekly', async (req, res) => {
  try {
    const { start, end } = thisWeekRange();
    const rows = await getRecapRows(start, end);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekap Mingguan');

    worksheet.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Nama Lengkap', key: 'nama_lengkap', width: 32 },
      { header: 'Hadir', key: 'hadir', width: 12 },
      { header: 'Izin', key: 'izin', width: 12 },
      { header: 'Sakit', key: 'sakit', width: 12 },
      { header: 'Alpa', key: 'alpa', width: 12 },
      { header: '% Kehadiran', key: 'kehadiran_pct', width: 16 },
    ];

    styleHeader(worksheet);

    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        nama_lengkap: row.nama_lengkap,
        hadir: row.hadir,
        izin: row.izin,
        sakit: row.sakit,
        alpa: row.alpa,
        kehadiran_pct: `${row.kehadiran_pct || 0}%`,
      });
    });

    styleBorders(worksheet);
    res.setHeader('Content-Disposition', 'attachment; filename=rekap_absensi_mingguan.xlsx');
    await writeWorkbook(res, worksheet);
  } catch (error) {
    console.error('Export weekly error:', error);
    res.status(500).json({ success: false, message: 'Gagal export data mingguan' });
  }
});

router.get('/export/monthly', async (req, res) => {
  try {
    const { start, end } = thisMonthRange();
    const rows = await getRecapRows(start, end);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekap Bulanan');

    worksheet.columns = [
      { header: 'No', key: 'no', width: 6 },
      { header: 'Nama Lengkap', key: 'nama_lengkap', width: 32 },
      { header: 'Hadir', key: 'hadir', width: 12 },
      { header: 'Izin', key: 'izin', width: 12 },
      { header: 'Sakit', key: 'sakit', width: 12 },
      { header: 'Alpa', key: 'alpa', width: 12 },
      { header: '% Kehadiran', key: 'kehadiran_pct', width: 16 },
    ];

    styleHeader(worksheet);

    rows.forEach((row, index) => {
      worksheet.addRow({
        no: index + 1,
        nama_lengkap: row.nama_lengkap,
        hadir: row.hadir,
        izin: row.izin,
        sakit: row.sakit,
        alpa: row.alpa,
        kehadiran_pct: `${row.kehadiran_pct || 0}%`,
      });
    });

    styleBorders(worksheet);
    res.setHeader('Content-Disposition', 'attachment; filename=rekap_absensi_bulanan.xlsx');
    await writeWorkbook(res, worksheet);
  } catch (error) {
    console.error('Export monthly error:', error);
    res.status(500).json({ success: false, message: 'Gagal export data bulanan' });
  }
});

router.get('/summary/weekly', async (req, res) => {
  try {
    const { start, end } = thisWeekRange();
    const rows = await getRecapRows(start, end);
    res.json({ success: true, data: { start, end, summary: rows } });
  } catch (error) {
    console.error('Summary weekly error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil rekap mingguan' });
  }
});

router.get('/summary/monthly', async (req, res) => {
  try {
    const { start, end } = thisMonthRange();
    const rows = await getRecapRows(start, end);
    res.json({ success: true, data: { start, end, summary: rows } });
  } catch (error) {
    console.error('Summary monthly error:', error);
    res.status(500).json({ success: false, message: 'Gagal mengambil rekap bulanan' });
  }
});

router.get('/export', async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT a.id, s.nisn, s.nama_lengkap, s.kelas, a.tanggal, a.jam_masuk, a.status 
      FROM attendances a
      JOIN students s ON a.student_id = s.id
      ORDER BY a.tanggal DESC
    `);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Rekap Absensi');

    worksheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: 'NISN', key: 'nisn', width: 20 },
      { header: 'Nama Lengkap', key: 'nama_lengkap', width: 30 },
      { header: 'Kelas', key: 'kelas', width: 15 },
      { header: 'Tanggal', key: 'tanggal', width: 15 },
      { header: 'Jam Masuk', key: 'jam_masuk', width: 15 },
      { header: 'Status', key: 'status', width: 15 },
    ];

    rows.forEach((row) => {
      worksheet.addRow({
        ...row,
        tanggal: new Date(row.tanggal).toISOString().split('T')[0]
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=' + 'rekap_absensi.xlsx');

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ success: false, message: 'Gagal export data' });
  }
});

module.exports = router;
