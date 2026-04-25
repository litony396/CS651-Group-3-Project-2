const { db, admin } = require('../firebase.js');

const getNextDiagnosisNumber = async (userID, plantID) => {

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