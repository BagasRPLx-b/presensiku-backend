const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let serviceAccount;

try {
  // 1. Cek apakah ada variabel FIREBASE_CONFIG (Ini untuk saat jalan di Railway)
  if (process.env.FIREBASE_CONFIG) {
    serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
  } 
  // 2. Jika tidak ada, coba baca dari file fisik (Ini untuk saat jalan di laptop)
  else {
    const serviceAccountPath = path.join(__dirname, 'firebaseServiceAccount.json');
    if (fs.existsSync(serviceAccountPath)) {
      serviceAccount = require(serviceAccountPath);
    } else {
      throw new Error('File tidak ada dan variabel FIREBASE_CONFIG kosong.');
    }
  }

  // Inisialisasi Firebase
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin SDK initialized');

} catch (error) {
  console.warn('⚠️ Firebase service account file not found or invalid.');
  console.warn('⚠️ Push notifications will not work. Error:', error.message);
}

module.exports = admin;