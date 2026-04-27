const { GoogleGenAI } = require('@google/genai')
const { z } = require('zod');
const { zodToJsonSchema }  = require('zod-to-json-schema');

// initialize with API key
const genAI = new GoogleGenAI({apiKey : process.env.GEMINI_API_KEY});

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
        // turn urls into data
        // https://stackoverflow.com/questions/40140149/use-async-await-with-array-map
        // have to use Promise.all if doing a map with an async function
        const newImageData = await Promise.all(imageURLs.map(url =>
            urlToBytes(url)
        ));
        const newAudioData = await urlToBytes(audioUrl);

        // https://ai.google.dev/gemini-api/docs/structured-output?example=recipe#javascript_2
        // want the output as a JSON, so define the schema we want
        const diagnosisSchema = z.object({
            condition: z.string().describe("The name of the plant's condition."),
            detailedExplanation: z.string().describe("A full explanation on what the plant's condition is as well as what caused the plant's condition."),
            summary: z.string().describe("A sentence summarizing the detailed explanation."),
            treatmentSteps: z.array(
                z.string().describe("A single treatment step, with the text under 20 words.")
            ).describe("A step-by-step guide on how to treat the plant's condition."),
            preventionTips: z.array(
                z.string().describe("A single prevention tip, with the text under 20 words and independent from the other tips.")
            ).describe("A list of individual tips to prevent the condition from happening to this plant in the future.")
        });

        // provide context from previous diagnoses
        const pastDiagnosisContext = plantHistory.length > 0
            ? `Past Diagnoses:\n ${plantHistory.map(d => `Diagnosis ${d.diagnosisNumber} (${d.timestamp}): ${JSON.stringify(d.generatedDiagnosis)}`).join('\n')}`
            : 'This is a new plant with no medical history.';

        const prompt = `
            You are an expert plant pathologist and entomologist.
            Your job is to analyze the provided information about the plant in order to diagnose any diseases or pest infestations present in the plant and how to fix them.
            You may be given images of the plant, audio describing the status of the plant and/or how it is cared for, and any past diagnoses you have produced for this plant.
            
            Here is the plant's past diagnoses in order to give you context:
            ${pastDiagnosisContext}
        `

        // send data and prompt to Gemini
        const result = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: [prompt, ...newImageData, newAudioData],
            config: {
                responseMimeType: "application/json",
                responseJsonSchema: zodToJsonSchema(diagnosisSchema)
            }
        });

        return diagnosisSchema.parse(JSON.parse(result.text));
    } catch (error) {
        console.error("Gemini API Error: ", error);
        throw new Error("Gemini Diagnosis Request Failed.");
    }
}

module.exports = { generateDiagnosis };