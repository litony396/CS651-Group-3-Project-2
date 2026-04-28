import React, { useState, useRef } from 'react';

// sets up Google Photos Picker API with this as a guide
// https://developers.google.com/photos/picker/guides/get-started-picker

export default function GooglePhotosPicker({ photoToken, onPhotosImported, disabled }) {
    // used to indicate when user is picking photos to cause a different render
    const [isPicking, setIsPicking] = useState(false);
    // used to show different status depending on the state of the picker
    const [statusText, setStatusText] = useState('Upload From Google Photos');
    // used to poll the Google Picker API for new data
    const pollIntervalRef = useRef(null);

    const startPicker = async () => {
        setIsPicking(true);
        setStatusText('Opening Picker...');

        try {
            // create a picker session
            // used Gemini to figure out how to pass the token in
            const sessionRes = await fetch('https://photospicker.googleapis.com/v1/sessions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${photoToken}`
                }
            });

            if (!sessionRes.ok) {
                throw new Error("Failed to create picker session.");
            }

            const sessionData = await sessionRes.json();

            // open popup with Google's picker UI
            const popup = window.open(sessionData.pickerUri, 'Google Photos Picker', 'width=800,height=700');

            if (!popup) {
                alert("Popup blocked! Please allow popups for this site.");
                setIsPicking(false);
                setStatusText('Upload From Google Photos');
                return;
            }

            // set the text to let user know they should use the popup
            setStatusText('Waiting for selection...');

            // start polling every 2.5 seconds for data to be sent from the picker
            pollIntervalRef.current = setInterval(() => {
                checkSessionStatus(sessionData.id, popup);
            }, 2500);

        } catch (error) {
            console.error("Picker Error:", error);
            setIsPicking(false);
            setStatusText('Upload From Google Photos');
        }
    };

    const checkSessionStatus = async (sessionId, popup) => {
        try {
            // ask the picker api for the status of the input session
            const checkRes = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${photoToken}`
                }
            });
            const sessionData = await checkRes.json();

            // if the user doesn't pick any photos and closes the popup, just reset everything
            if (popup.closed && !sessionData.mediaItemsSet) {
                clearInterval(pollIntervalRef.current);
                setIsPicking(false);
                setStatusText('Upload From Google Photos');
                return;
            }

            // if the user picked photos, then stop polling and download the images
            if (sessionData.mediaItemsSet) {
                clearInterval(pollIntervalRef.current);
                setStatusText('Downloading...');
                await downloadImages(sessionId);
            }
        } catch (err) {
            console.error("Polling error:", err);
        }
    };
