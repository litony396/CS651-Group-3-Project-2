const express = require('express');
const { getPlantHistory } = require('../services/databaseService');

const router = express.Router();

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
        console.error(`Error when trying to use api/plant/${req.params.userID} for plant ${req.query.plantID}:`, error);
        res.status(500).json({ error: "Internal server error while fetching plant history." });
    }
});

module.exports = router;