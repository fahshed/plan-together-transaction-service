const admin = require("firebase-admin");
require("dotenv").config();

// let serviceAccount;
// if (process.env.FIREBASE_SERVICE_ACCOUNT) {
//   serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
// } else {
//   serviceAccount = require("./serviceAccountKey.json");
// }

if (process.env.NODE_ENV !== "production") {
  const serviceAccount = require("./serviceAccountKey.json");
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.STORAGE_BUCKET,
  });
} else {
  admin.initializeApp({
    storageBucket: process.env.STORAGE_BUCKET,
  });
}

const db = admin.firestore();
const bucket = admin.storage().bucket();

module.exports = { db, bucket };
