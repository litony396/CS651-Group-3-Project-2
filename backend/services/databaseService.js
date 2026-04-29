const { db, admin } = require('../firebase.js');

// useful sources for the code here
// https://firebase.google.com/docs/firestore/manage-data/add-data
// https://firebase.google.com/docs/firestore/query-data/get-data#get_a_document
// https://firebase.google.com/docs/firestore/query-data/order-limit-data

const generatePlantID = (userID) => {
    // https://firebase.google.com/docs/firestore/manage-data/add-data
    // you can make firestore generate a unique id for a specific collection by asking for a document in that collection with no input
    // this will make a reference for a new document in that collection, generating an id for it
    // just use this for plantID
    const newPlantDoc = db.collection('Users')
        .doc(userID)
        .collection('Plants')
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

const getUserPlants = async (userID) => {
    try {
        // get the user's plant collection
        const plantsQueryResults = await db.collection('Users')
            .doc(userID)
            .collection('Plants')
            .get();

        if (plantsQueryResults.empty) {
            return [];
        }

        // map over the documents and attach the document ID so React can use it for the dropdown keys
        return plantsQueryResults.docs.map(doc => {
            return {
                id: doc.id,
                ...doc.data()
            };
        });

    } catch (error) {
        console.error(`Error getting plants for user ${userID}:`, error);
        throw new Error("Failed to retrieve user plants.");
    }
}

// collects 9 newest diagnoses to populate the community feed
const getCommunityFeed = async () => {
    try {
        // collectionGroup searches every subcollection named 'diagnoses'
        const latestDiagnosesQueryResult = await db.collectionGroup('Diagnoses')
            .orderBy('timestamp', 'desc')
            .limit(9)
            .get();

        if (latestDiagnosesQueryResult.empty) {
            return [];
        }

        return latestDiagnosesQueryResult.docs.map(doc => {
            const data = doc.data();

            // extract the user/plant IDs directly from the Firestore path
            // schema: Users/{userID}/Plants/{plantID}/Diagnoses/{diagnosisID}
            const plantID = doc.ref.parent.parent.id;
            const userID = doc.ref.parent.parent.parent.parent.id;

            return {
                id: doc.id,
                userID: userID,
                plantID: plantID,
                ...data,
                // Ensure the timestamp is readable for the React frontend
                timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString()
            };
        });
    } catch (error) {
        console.error("Error fetching community diagnoses: ", error);
        throw new Error("Failed to retrieve global feed.");
    }
}

const getPlantHistory = async (userID, plantID) => {
    try {
        // get the diagnoses of the plant we are looking for
        const diagnoses = db.collection('Users')
            .doc(userID)
            .collection('Plants')
            .doc(plantID)
            .collection('Diagnoses');

        // order by diagnosisNumber with the newest being ordered first
        // have the newest stuff first because those are more likely to be accessed than older results
        const orderQueryResults = await diagnoses
            .orderBy('diagnosisNumber', 'desc')
            .get();

        // if the query is empty then just return a blank array since there is no data to give
        if (orderQueryResults.empty) {
            return [];
        }

        // return this history after some formatting
        return orderQueryResults.docs.map(doc => {
            const data = doc.data();

            // timestamps on the database use the Google timestamps which aren't human-readable
            // change them to be readable so they can be displayed on the website
            const readableTimestamp = data.timestamp.toDate().toISOString();

            return {
                ...data, // use data as given
                timestamp: readableTimestamp // replace old timestamp with this readable one
            };
        })

    } catch (error) {
        console.error(`Error getting plant history for user ${userID} and plant ${plantID}`);
        throw new Error("Failed to retrieve plant history.")
    }
}

// make a new diagnosis record for given plant
const saveNewDiagnosis = async (userID, plantID, diagnosisText, audioURL, imageURLs) => {
    try {
        // get DiagnosisNumber for this diagnosis
        const nextDiagnosisNumber = await getNextDiagnosisNumber(userID, plantID);

        // explicitly creates the plant document so that getUserPlants can actually iterate through a user's plants to get the plantID
        // Firebase doesn't explicitly create the Plants collection unless it is told to
        // it will just save the record and pretend that it is stored in this path when it doesn't actually exist

        // information for plant doc
        const plantDocumentData = {
            id: plantID,
            lastActivity: admin.firestore.FieldValue.serverTimestamp()
        }

        await db.collection('Users')
            .doc(userID)
            .collection('Plants')
            .doc(plantID)
            .set(plantDocumentData , { merge: true })

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

        // overwrite timestamp with the current time instead since admin.firestore.FieldValue.serverTimestamp() doesn't set until it reaches the database
        // this will cause a bug on the date display on the dashboard for the latest entry
        return {
            newRecord,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        console.error("Database Save Error: ", error);
        throw new Error("Diagnosis Failed to Save to the Database");
    }
}

module.exports = {generatePlantID, getUserPlants, getCommunityFeed, getPlantHistory, saveNewDiagnosis };