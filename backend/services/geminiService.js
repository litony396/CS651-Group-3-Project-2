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

    if (!response.ok) {
        throw new Error(`Failed to fetch file from Firebase Storage: ${response.status} ${response.statusText}`);
    }

    const buffer = await response.arrayBuffer();

    // return in a way Gemini can read
    return {
        inlineData: {
            data: Buffer.from(buffer).toString('base64'),
            mimeType: response.headers.get('Content-Type') || 'application/octet-stream', // if header doesn't exist for some reason, just give generic mimeType
        }
    };

}

// helper function to sleep for a little bit
const sleep  = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// used to retry Gemini call multiple times after short delay
// this is because Gemini tends to say it is too busy and cancel the call, so just retry a few times in order to make it work
// if it doesn't work then error'
// written with Gemini
const generateWithRetry = async (requestConfig, maxRetries = 4) => {
    let attempt = 0;

    while (attempt < maxRetries) {
        try {
            // attempt to call API
            return await genAI.models.generateContent(requestConfig);
        } catch (error) {
            // if the error is a 503 (Busy) or 429 (Rate Limited), we retry
            if (error.status === 503 || error.status === 429) {
                attempt++;
                if (attempt >= maxRetries) {
                    console.error(`Gemini API failed after ${maxRetries} attempts.`);
                    throw error;
                }

                // exponential backoff: 1000ms, then 2000ms, then 4000ms
                const delay = Math.pow(2, attempt) * 1000;
                console.warn(`Gemini API busy. Retrying in ${delay}ms... (Attempt ${attempt} of ${maxRetries})`);
                await sleep(delay);
            } else {
                throw error;
            }
        }
    }
};

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
        // switched to explicitly giving response schema since it refused to work with zod
        const result = await generateWithRetry({
            model: "gemini-2.5-flash",
            contents: [prompt, ...newImageData, newAudioData].filter(item => item !== null), // do filter to filter out newAudioData if user didn't upload any audio
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        condition: { type: "STRING", description: "The name of the plant's condition." },
                        detailedExplanation: { type: "STRING", description: "A full explanation on what the plant's condition is as well as what caused the plant's condition." },
                        summary: { type: "STRING", description: "A sentence summarizing the detailed explanation." },
                        treatmentSteps: {
                            type: "ARRAY",
                            description: "A step-by-step guide on how to treat the plant's condition.",
                            items: { type: "STRING" }
                        },
                        preventionTips: {
                            type: "ARRAY",
                            description: "A list of individual tips to prevent the condition from happening to this plant in the future.",
                            items: { type: "STRING" }
                        }
                    },
                    required: ["condition", "detailedExplanation", "summary", "treatmentSteps", "preventionTips"]
                }
            }
        });

        // use zod schema to make sure that the final JSON returned is correct
        return diagnosisSchema.parse(JSON.parse(result.text));
    } catch (error) {
        console.error("Gemini API Error: ", error);
        throw new Error("Gemini Diagnosis Request Failed.");
    }
}

module.exports = { generateDiagnosis };