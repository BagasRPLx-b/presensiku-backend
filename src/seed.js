// ============================================================
// PRESENSI KU — Seed Script
// Jalankan: npm run seed
// Membuat data awal admin dan siswa dengan password ter-hash
// ============================================================

require('dotenv').config();
const bcrypt = require('bcrypt');
const db     = require('./config/database');

const SALT_ROUNDS = 10;

async function seed() {
  try {
    console.log('Memulai seeding data...\n');

    // --- Seed Admin ---
    const adminPassword = 'admin123';
    const adminHash     = await bcrypt.hash(adminPassword, SALT_ROUNDS);

    await db.query(
      'INSERT IGNORE INTO admins (username, password) VALUES (?, ?)',
      ['admin', adminHash]
    );
    console.log('Admin  : username=admin, password=admin123');

    // --- Seed Siswa ---
    const students = [
      { nisn: '1234567890', password: 'siswa123', nama: 'Ahmad Rizky',     kelas: 'XII-IPA-1' },
      { nisn: '1234567891', password: 'siswa123', nama: 'Siti Nurhaliza',  kelas: 'XII-IPA-1' },
      { nisn: '1234567892', password: 'siswa123', nama: 'Budi Santoso',    kelas: 'XII-IPA-2' },
      { nisn: '1234567893', password: 'siswa123', nama: 'Dewi Lestari',    kelas: 'XII-IPS-1' },
      { nisn: '1234567894', password: 'siswa123', nama: 'Eko Prasetyo',    kelas: 'XII-IPS-1' },
    ];

    for (const s of students) {
      const hash = await bcrypt.hash(s.password, SALT_ROUNDS);
      await db.query(
        'INSERT IGNORE INTO students (nisn, password, nama_lengkap, kelas) VALUES (?, ?, ?, ?)',
        [s.nisn, hash, s.nama, s.kelas]
      );
      console.log(`Siswa  : nisn=${s.nisn}, nama=${s.nama}, password=${s.password}`);
    }

    console.log('\nSeeding selesai!');
    process.exit(0);
  } catch (error) {
    console.error('Seeding gagal:', error.message);
    process.exit(1);
  }
}

seed();
