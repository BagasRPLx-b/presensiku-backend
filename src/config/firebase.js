const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = path.join(__dirname, 'firebaseServiceAccount.json');

if (fs.existsSync(serviceAccountPath)) {
  const serviceAccount = require(serviceAccountPath);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  console.log('✅ Firebase Admin SDK initialized');
} else {
  console.warn('⚠️ Firebase service account file not found. Push notifications will not work.');
  // Initialize without credentials for testing/dev purposes if needed, or leave uninitialized.
  // admin.initializeApp(); 
}

module.exports = admin;
