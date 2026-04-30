const { db, admin } = require('../firebase.js');
const { Logging } = require('@google-cloud/logging');
const logging = new Logging();
const log = logging.log("database-requests");

async function logRequest(requestData) {
    const metadata= { resource: { type: "global" }};
    const entry = log.entry(metadata, requestData);
    await log.write(entry)
}

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

        try {
            await logRequest({
                event: "Database Query: Get Next Diagnosis Number",
                userID: userID,
                plantID: plantID,
                operation: "get()",
                query: "orderBy(diagnosisNumber, desc).limit(1)"
            })
        } catch (error) {
            console.warn("Failed to write to log for database query", error);
        }

        // make a query for the current highest diagnosis number for this plant
        const numberQueryResults = await diagnoses
            .orderBy('diagnosisNumber', 'desc')
            .limit(1)
            .get();

        try {
            await logRequest({
                event: "Database Query Success"
            });
        } catch (error) {
            console.warn("Failed to write to log for database success", error);
        }

        // if the query resulted in nothing, then just return 1 because this is the first diagnosis for this plant
        // otherwise just increment the largest diagnosis number by 1
        return numberQueryResults.empty ? 1 : numberQueryResults.docs[0].data().diagnosisNumber + 1;

    } catch (error) {
        try {
            await logRequest({
                event: "Database Query Failure"
            });
        } catch (error) {
            console.warn("Failed to write to log for database failure", error);
        }
        console.error("Error getting next diagnosis number: ", error);
        throw new Error("Failed to retrieve next diagnosis number.");
    }
}

const getUserPlants = async (userID) => {
    try {
        try {
            await logRequest({
                event: "Database Query: Get User's Plants",
                userID: userID,
                operation: "get()"
            })
        } catch (error) {
            console.warn("Failed to write to log for database query", error);
        }


        // get the user's plant collection
        const plantsQueryResults = await db.collection('Users')
            .doc(userID)
            .collection('Plants')
            .get();

        try {
            await logRequest({
                event: "Database Query Success"
            });
        } catch (error) {
            console.warn("Failed to write to log for database success", error);
        }

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
        try {
            await logRequest({
                event: "Database Query Failure"
            });
        } catch (error) {
            console.warn("Failed to write to log for database failure", error);
        }
        console.error(`Error getting plants for user ${userID}:`, error);
        throw new Error("Failed to retrieve user plants.");
    }
}

// collects 18 newest diagnoses to populate the community feed
const getCommunityFeed = async () => {
    try {
        try {
            await logRequest({
                event: "Database Query: Get Community Feed",
                operation: "get()",
                query: "Diagnoses.orderBy(timestamp, desc).limit(18)"
            })
        } catch (error) {
            console.warn("Failed to write to log for database query", error);
        }


        // collectionGroup searches every subcollection named 'diagnoses'
        const latestDiagnosesQueryResult = await db.collectionGroup('Diagnoses')
            .orderBy('timestamp', 'desc')
            .limit(18)
            .get();

        try {
            await logRequest({
                event: "Database Query Success"
            });
        } catch (error) {
            console.warn("Failed to write to log for database success", error);
        }

        if (latestDiagnosesQueryResult.empty) {
            return [];
        }

        try {
            await logRequest({
                event: `Database Query: Get Plant Name for Community Feed for ${latestDiagnosesQueryResult.size} plants`,
                operation: "get()"
            })
        } catch (error) {
            console.warn("Failed to write to log for database query", error);
        }


        const feed = await Promise.all(latestDiagnosesQueryResult.docs.map(async doc => {
            const data = doc.data();

            // extract the user/plant IDs directly from the Firestore path
            // schema: Users/{userID}/Plants/{plantID}/Diagnoses/{diagnosisID}
            const plantRef = doc.ref.parent.parent;
            const userID = doc.ref.parent.parent.parent.parent.id;

            // ask the Plant document to get the name if it exists
            const plantQueryResult = await plantRef.get();
            const plantName = plantQueryResult.exists ? plantQueryResult.data().name : null;

            return {
                id: doc.id,
                userID: userID,
                plantID: plantRef.id,
                name: plantName,
                ...data,
                // Ensure the timestamp is readable for the React frontend
                timestamp: data.timestamp ? data.timestamp.toDate().toISOString() : new Date().toISOString()
            };
        }));

        try {
            await logRequest({
                event: "Database Query Success"
            });
        } catch (error) {
            console.warn("Failed to write to log for database success", error);
        }

        return feed
    } catch (error) {
        try {
            await logRequest({
                event: "Database Query Failure"
            });
        } catch (error) {
            console.warn("Failed to write to log for database failure", error);
        }
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

        try {
            await logRequest({
                event: "Database Query: Get Plant History",
                userID: userID,
                plantID: plantID,
                operation: "get()",
                query: "orderBy(diagnosisNumber, desc)"
            })
        } catch (error) {
            console.warn("Failed to write to log for database query", error);
        }

        // order by diagnosisNumber with the newest being ordered first
        // have the newest stuff first because those are more likely to be accessed than older results
        const orderQueryResults = await diagnoses
            .orderBy('diagnosisNumber', 'desc')
            .get();


        try {
            await logRequest({
                event: "Database Query Success"
            });
        } catch (error) {
            console.warn("Failed to write to log for database success", error);
        }

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
        try {
            await logRequest({
                event: "Gemini Database Query Failure"
            });
        } catch (error) {
            console.warn("Failed to write to log for database failure", error);
        }
        console.error(`Error getting plant history for user ${userID} and plant ${plantID}`);
        throw new Error("Failed to retrieve plant history.")
    }
}

// make a new diagnosis record for given plant
const saveNewDiagnosis = async (userID, plantID, plantName, diagnosisText, audioURL, imageURLs) => {
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

        // only attach name if it exists, don't want to have a name field if we don't have to
        if (plantName) {
            plantDocumentData.name = plantName;
        }

        const { lastActivity, ...plantRecord } = plantDocumentData;

        try {
            await logRequest({
                event: "Database Write: Save Plant",
                userID: userID,
                plantID: plantID,
                operation: "set()",
                recordSummary: plantRecord
            })
        } catch (error) {
            console.warn("Failed to write to log for database query", error);
        }

        await db.collection('Users')
            .doc(userID)
            .collection('Plants')
            .doc(plantID)
            .set(plantDocumentData , { merge: true })

        try {
            await logRequest({
                event: "Database Write Success"
            });
        } catch (error) {
            console.warn("Failed to write to log for database success", error);
        }

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

        try {
            await logRequest({
                event: "Database Write: Save Diagnosis",
                userID: userID,
                plantID: plantID,
                operation: "set()",
                recordSummary: {
                    diagnosisNumber: Number(nextDiagnosisNumber),
                    imageCount: imageURLs ? imageURLs.length : 0,
                    hasAudio: Boolean(audioURL),
                    diagnosisTextLength: diagnosisText ? diagnosisText.length : 0
                }
            })
        } catch (error) {
            console.warn("Failed to write to log for database query", error);
        }

        // store this new record in the correct spot using our nested DB structure
        // stored at [userID][plantID][nextDiagnosisNumber]
        await db.collection('Users')
            .doc(userID)
            .collection('Plants')
            .doc(plantID)
            .collection('Diagnoses')
            .doc(String(nextDiagnosisNumber))
            .set(newRecord);

        try {
            await logRequest({
                event: "Database Query Success"
            });
        } catch (error) {
            console.warn("Failed to write to log for database success", error);
        }

        // overwrite timestamp with the current time instead since admin.firestore.FieldValue.serverTimestamp() doesn't set until it reaches the database
        // this will cause a bug on the date display on the dashboard for the latest entry
        return {
            newRecord,
            timestamp: new Date().toISOString()
        };
    } catch (error) {
        try {
            await logRequest({
                event: "Gemini Database Write Failure"
            });
        } catch (error) {
            console.warn("Failed to write to log for database failure", error);
        }
        console.error("Database Save Error: ", error);
        throw new Error("Diagnosis Failed to Save to the Database");
    }
}

module.exports = {generatePlantID, getUserPlants, getCommunityFeed, getPlantHistory, saveNewDiagnosis };