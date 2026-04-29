const { GoogleGenAI } = require('@google/genai')
const { z } = require('zod');
const { Logging } = require("@google-cloud/logging");

const logging = new Logging();
const log = logging.log("gemini-api-requests");

async function logRequest(requestData) {
    const metadata= { resource: { type: "global" }};
    const entry = log.entry(metadata, requestData);
    await log.write(entry)
}

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

                try {
                    await logRequest({
                        event: "Gemini API Retry Initiated",
                        attemptNumber: attempt,
                        reason: error.status === 503 ? "Service Unavailable (503)" : "Rate Limited (429)",
                        delayImposedMs: delay
                    });
                } catch (e) {
                    console.warn("Failed to write to log for Gemini Retry")
                }

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

        // payload that is built gradually and given to Gemini at the end
        const contentsPayload = [];

        // payload used for logging, has shorter descriptions
        const logPayload = [];

        contentsPayload.push(`
            You are an expert plant pathologist and entomologist.
            Your job is to analyze the provided information about the plant in order to diagnose any diseases or pest infestations present in the plant and how to fix them.
        `);

        logPayload.push("You are an expert plant pathologist...");


        // assumes plantHistory is chronological (oldest to newest), the last item is n-1
        // want to include the images/audio from this n-1 entry
        // only include the n-1 entry because don't want to give too much context as this eats up tokens + giving too much can make Gemini confused
        if (plantHistory && plantHistory.length > 0) {
            const nMinusOne = plantHistory[plantHistory.length - 1];

            // older text history (everything before n-1) to save tokens
            if (plantHistory.length > 1) {
                const olderHistory = plantHistory.slice(0, plantHistory.length - 1);
                contentsPayload.push(`
                    --- OLDER MEDICAL HISTORY ---
                    ${olderHistory.map(d => `Diagnosis ${d.diagnosisNumber} (${d.timestamp}): ${JSON.stringify(d.generatedDiagnosis)}`).join('\n')}
                `);

                logPayload.push(`--- OLDER MEDICAL HISTORY --- (Included ${olderHistory.length} previous text diagnoses)`)
            }

            // n-1 visual/audio context
            contentsPayload.push(`
                --- PREVIOUS CHECKUP (Diagnosis ${nMinusOne.diagnosisNumber}) ---
                Previous Diagnosis Result: ${JSON.stringify(nMinusOne.generatedDiagnosis)}
                Review these past images/audio (if any) to establish a baseline:
            `);
            logPayload.push(`--- PREVIOUS CHECKUP --- (Diagnosis ${nMinusOne.diagnosisNumber})`)

            // fetch and append n-1 Media
            if (nMinusOne.imageURLs && nMinusOne.imageURLs.length > 0) {
                const pastImages = await Promise.all(nMinusOne.imageURLs.map(urlToBytes));
                contentsPayload.push(...pastImages.filter(Boolean));
                logPayload.push(`[Included ${nMinusOne.imageURLs.length} past images]`)
            }
            if (nMinusOne.audioURL) {
                const pastAudio = await urlToBytes(nMinusOne.audioURL);
                if (pastAudio) contentsPayload.push(pastAudio);
                logPayload.push(`[Included past audio]`);
            }
        } else {
            contentsPayload.push('--- MEDICAL HISTORY ---\nThis is a new plant with no medical history. Establish a baseline.');
            logPayload.push('--- MEDICAL HISTORY ---\nNew plant, no history.');
        }

        // new data
        contentsPayload.push(`
            --- CURRENT CHECKUP ---
            Compare this data to the baseline above (if available), determine what has changed, and give next steps.
        `);
        logPayload.push('--- CURRENT CHECKUP ---');

        contentsPayload.push(...newImageData.filter(Boolean));
        logPayload.push(`[Attached ${imageURLs.length} new images for analysis]`);

        if (newAudioData)  {
            contentsPayload.push(newAudioData);
            logPayload.push(`[Attached new audio recording for analysis]`);
        }

        try {
            await logRequest({
                event: "Gemini API Request Started",
                modelUsed: "gemini-3-flash-preview",
                payloadSent: logPayload
            });
        } catch (error) {
            console.warn("Failed to write to log for Gemini Payload");
        }

        // send data and prompt to Gemini
        // switched to explicitly giving response schema since it refused to work with zod
        const result = await generateWithRetry({
            model: "gemini-3-flash-preview",
            contents: contentsPayload,
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

        try {
            await logRequest({
                event: "Gemini Diagnosis Successfully Generated",
            });
        } catch (error) {
            console.warn("Failed to write to log for Gemini Success");
        }

        // use zod schema to make sure that the final JSON returned is correct
        return diagnosisSchema.parse(JSON.parse(result.text));
    } catch (error) {
        try {
            await logRequest({
                event: "Gemini Diagnosis Failed",
                error: error.message
            });
        } catch (error) {
            console.warn("Failed to write to log for Gemini Failure");
        }

        console.error("Gemini API Error: ", error);
        throw new Error("Gemini Diagnosis Request Failed.");
    }
}

module.exports = { generateDiagnosis };