const express = require('express');
const multer = require('multer');
const router = express.Router();

const { uploadFile } = require('../services/storageService.js');
const { generatePlantID, saveNewDiagnosis, getPlantHistory } = require('../services/databaseService.js');
const { generateDiagnosis } = require('../services/geminiService.js');

// use multer to store files in memory instead of saving to hard drive of the system
const upload = multer({ storage: multer.memoryStorage() });

// https://expressjs.com/en/resources/middleware/multer.html
// used this to figure out how to use upload.fields
// allow one audio file and 6 image files
router.post('/', upload.fields([{ name: 'audio', maxCount: 1 }, { name: 'image', maxCount: 6 }]), async (req, res) => {
    try {
        // extract userID and plantID from the request
        // plantID should be mutable since if it doesn't exist, we have to generate a new one
        const { userID } = req.body;
        let { plantID } = req.body;

        // extract audio files and image files from request
        // give safe defaults for if the audioFile or imageFiles do not exist
        const audioFile = req.files['audio'] ? req.files['audio'] : null;
        const imageFiles = req.files['image'] || [];
        if (!audioFile && imageFiles.length === 0) {
            return res.status(400).json({error: 'Must upload at least one image or audio file.'})
        }

        if (!userID) {
            return res.status(400).json({error: 'Missing required userID field.'})
        }

        // generate a plantID if this is a new plant
        if (!plantID) {
            plantID = generatePlantID(userID);
        }

        // upload audio file
        let audioURL = null
        if (audioFile) {
            audioURL = await uploadFile(audioFile.buffer, audioFile.originalname, userID, audioFile.mimetype);
        }

        // upload image files
        // TODO: need to implement only doing this with local uploads, can keep Google Photo urls the same
        // https://stackoverflow.com/questions/40140149/use-async-await-with-array-map
        // have to use Promise.all if doing a map with an async function
        const imageURLs = await Promise.all(imageFiles.map(img =>
            uploadFile(img.buffer, img.originalname, userID, img.mimetype)
        ));

        // get plant history in reverse chronological order
        const plantHistory = await getPlantHistory(userID, plantID);

        // reverse because diagnosis for Gemini is easier if its in chronological order instead of reverse chronological error
        const reversePlantHistory = plantHistory.reverse();

        const diagnosisText = generateDiagnosis(imageURLs, audioURL, reversePlantHistory);

        const newRecord = await saveNewDiagnosis(userID, plantID, diagnosisText, audioURL, imageURLs);

        res.status(201).json({
            plantID: plantID,
            diagnosisRecord: newRecord
        })

    } catch (error) {
        console.error("Error when trying to use /api/diagnose", error);
        res.status(500).json({error: "An error occurred while trying to create your diagnosis. Please try again."})
    }
});

module.exports = router;