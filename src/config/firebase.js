const admin = require("firebase-admin");

let serviceAccount;

if (process.env.FIREBASE_CONFIG) {
  // Jika di Railway, baca dari tab Variables
  serviceAccount = JSON.parse(process.env.FIREBASE_CONFIG);
} else {
  // Jika di localhost, baca dari file
  serviceAccount = require("./firebaseServiceAccount.json");
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

module.exports = admin;