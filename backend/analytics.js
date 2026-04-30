const axios = require('axios');

const MEASUREMENTID = 'G-4EX09RS1CW';
const GA4SECRET = process.env.GA4SECRET;

async function trackGA4Event(eventName, userID) {
    try {
        await axios.post(
            `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENTID}&api_secret=${GA4SECRET}`,
            {
                clientID: userID,
                events: [{name: eventName}]
            });
    } catch (error) {
        console.warn("GA4 Backend Tracking Error:", error);
    }
}

export { trackGA4Event }