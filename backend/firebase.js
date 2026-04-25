const admin = require('firebase-admin');
// import service account credentials
// TODO: Have to change later for when this is actually deployed -> won't use local file for authentication
const serviceAccount = require('./serviceAccountKey.json');

// initialize admin using imported credentials
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

// make database instance for other files to use
const db = admin.firestore();

console.log("Firestore successfully initialized.");

module.exports = { db, admin };