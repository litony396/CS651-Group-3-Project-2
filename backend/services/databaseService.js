const { db, admin } = require('../firebase.js');

const generatePlantID = (userID) => {
    // https://firebase.google.com/docs/firestore/manage-data/add-data
    // you can make firestore generate a unique id for a specific collection by asking for a document in that collection with no input
    // this will make a reference for a new document in that collection, generating an id for it
    // just use this for plantID
    const newPlantDoc = db.collection('Users')
        .doc(userID)
        .collection('plants')
        .doc();

    return newPlantDoc.id;
}

const getNextDiagnosisNumber = async (userID, plantID) => {
    try {
        // get the diagnoses of the plant we are looking for
        const diagnoses = db.collection('Users')
            .doc(userID)
            .collection('Plants')
            .doc(plantID)
            .collection('Diagnoses');

        // make a query for the current highest diagnosis number for this plant
        const numberQueryResults = await diagnoses
            .orderBy('diagnosisNumber', 'desc')
            .limit(1)
            .get();

        // if the query resulted in nothing, then just return 1 because this is the first diagnosis for this plant
        // otherwise just increment the largest diagnosis number by 1
        return numberQueryResults.empty ? 1 : numberQueryResults.docs[0].data().diagnosisNumber + 1;

    } catch (error) {
        console.error("Error getting next diagnosis number: ", error);
        throw new Error("Failed to retrieve next diagnosis number.");
    }
}

// make a new diagnosis record for given plant
const saveNewDiagnosis = async (userID, plantID, diagnosisText, audioURL, imageURLs) => {
    try {
        // get DiagnosisNumber for this diagnosis
        const nextDiagnosisNumber = await getNextDiagnosisNumber(userID, plantID);

        // build the new record with input data
        const newRecord = {
            diagnosisNumber: Number(nextDiagnosisNumber), // force this to be a number, it is likely a number already but do this just in case
            generatedDiagnosis: diagnosisText,
            audioURL: audioURL,
            imageURLs: imageURLs,
            // use this for timestamping instead of Date.now() because it is more accurate
            // Date.now use for storageService.js was just to get a unique file name, but here we care more about accuracy
            // timestamp is useful for Gemini to understand how time relates to how the plant has healed/changed
            timestamp: admin.firestore.FieldValue.serverTimestamp()
        };

        // store this new record in the correct spot using our nested DB structure
        // stored at [userID][plantID][nextDiagnosisNumber]
        await db.collection('Users')
            .doc(userID)
            .collection('Plants')
            .doc(plantID)
            .collection('Diagnoses')
            .doc(String(nextDiagnosisNumber))
            .set(newRecord);

        return newRecord;
    } catch (error) {
        console.error("Database Save Error: ", error);
        throw new Error("Diagnosis Failed to Save to the Database");
    }
}