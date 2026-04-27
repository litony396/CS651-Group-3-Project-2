const { GoogleGenerativeAI } = require('@google/generative-ai')

// initialize with API key
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// https://ai.google.dev/gemini-api/docs/image-understanding
// have to download image/audio from URL and then convert to bytes
const urlToBytes = async (url) => {
    if (!url) {
        return null;
    }

    // fetch data from the url
    const response = await fetch(url);
    const buffer = await response.arrayBuffer();

    // return in a way Gemini can read
    return {
        inlineData: {
            data: Buffer.from(buffer).toString('base64'),
            mimeType: response.headers.get('Content-Type') || 'application/octet-stream', // if header doesn't exist for some reason, just give generic mimeType
        }
    };

}

const generateDiagnosis = async (imageURLs, audioUrl, plantHistory) => {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" })

        // turn urls into data
        // https://stackoverflow.com/questions/40140149/use-async-await-with-array-map
        // have to use Promise.all if doing a map with an async function
        const newImageData = await Promise.all(imageURLs.map(url =>
            urlToBytes(url)
        ));
        const newAudioData = await urlToBytes(audioUrl);

        // provide context from previous diagnoses
        const pastDiagnosisContext = plantHistory.length > 0
            ? `Past Diagnoses:\n ${plantHistory.map(d => `Diagnosis ${d.diagnosisNumber} (${d.timestamp}): ${d.generatedDiagnosis}`).join('\n')}`
            : 'This is a new plant with no medical history.';

        // TODO: BUILD THE PROMPT
        const prompt = 'insert prompt later';

        // send data and prompt to Gemini
        const result = await model.generateContent([prompt, ...newImageData, newAudioData]);
        const response = await result.response;

        return response.text();
    } catch (error) {
        console.error("Gemini API Error: ", error);
        throw new Error("Gemini Diagnosis Request Failed.");
    }
}

module.exports = { generateDiagnosis };