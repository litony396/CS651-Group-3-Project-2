const admin = require('firebase-admin');

try {
    // initialize admin using Application Default Credentials
    admin.initializeApp({
        storageBucket: 'plantcareai-f1498.firebasestorage.app'
    });

    console.log("Firestore successfully initialized.");
} catch (error) {
    console.error("Firebase Intitialization Error: ", error);
}


// make database instance for other files to use
const db = admin.firestore();
// load bucket instance for other files to use
const bucket = admin.storage().bucket();


module.exports = { db, admin, bucket };