
// load bucket used for image/audio storage from Firebase storage
const { bucket } = require('../firebase.js');

// function that uploads image or audio to Firebase bucket
const uploadFile = async (data, fileName, userID, fileType) => {
    try {
        // use a timestamp in order to make sure audio files are not rewritten
        // for example, a user may upload two files with the same filename at different times -> we don't want the second file to overwrite the first one
        // this fileName is where the file is stored on the Cloud Storage
        const timestamp = Date.now();

        // use fileType to determine what folder to store this file in
        const folder = fileType.startsWith('image/') ? 'images' : 'audio';

        // Should follow guidelines on cloud storage naming from Google: https://docs.cloud.google.com/storage/docs/objects
        // Used Gemini to generate this code to normalize the audio file name - replaces all weird characters with _
        const safeName = fileName.replace(/[^a-zA-Z0-9.]/g, '_')
        const storedFileName = `${folder}/${userID}/${timestamp}_${safeName}`;

        const file = bucket.file(storedFileName);

        // upload the audio to the database
        // also set the metadata so it is known that this is an audio file -> helps Gemini and if we need to playback audio
        await file.save(data,{
            metadata: {contentType: fileType}
        });

        // return URL to store in Firestore + give to Gemini to access
        return `https://storage.googleapis.com/${bucket.name}/${storedFileName}`
    } catch (error) {
        console.error("File Upload Error:", error);
        throw new Error(`Upload of ${fileName} to Firebase Bucket Failed.`)
    }
}

module.exports = { uploadFile };