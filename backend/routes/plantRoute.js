const express = require('express');
const { getPlantHistory, getUserPlants } = require('../services/databaseService');

const router = express.Router();

// GET /api/plants/:userID
router.get('/:userID', async (req, res) => {
    try {
        const { userID } = req.params;

        // validate user id parameter
        if (!userID) {
            return res.status(400).json({ error: "Missing 'userID' path parameter." });
        }

        // fetch the user's plants from Firestore
        const plants = await getUserPlants(userID);

        // send it back matching the JSON structure expected by frontend
        res.status(200).json({ plants: plants });

    } catch (error) {
        console.error(`Error when trying to use api/plant/${req.params.userID}:`, error);
        res.status(500).json({ error: "Internal server error while fetching plants." });
    }
});

// GET /api/plants/:userID/history
// Expects 'plantID' to be passed as a URL query parameter
router.get('/:userID/history', async (req, res) => {
    try {
        const { userID } = req.params;
        const plantID = req.query.plantID;

        // validate the request parameters
        if (!userID) {
            return res.status(400).json({ error: "Missing 'uid' query parameter." });
        }
        if (!plantID) {
            return res.status(400).json({ error: "Missing 'plantID' path parameter." });
        }

        // fetch plant history for this plant
        const history = await getPlantHistory(userID, plantID);

        // send to react frontend
        res.status(200).json({ history: history });

    } catch (error) {
        console.error(`Error when trying to use api/plant/${req.params.userID}/history for plant ${req.query.plantID}:`, error);
        res.status(500).json({ error: "Internal server error while fetching plant history." });
    }
});



module.exports = router;