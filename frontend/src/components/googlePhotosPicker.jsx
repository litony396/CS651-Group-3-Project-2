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
                const errorText = await sessionRes.text();
                throw new Error(`HTTP ${sessionRes.status} - ${errorText}`);
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
            setStatusText('Click to Cancel');

            // start polling every 2.5 seconds for data to be sent from the picker
            pollIntervalRef.current = setInterval(() => {
                checkSessionStatus(sessionData.id);
            }, 2500);

        } catch (error) {
            console.error("Picker Error:", error);
            setIsPicking(false);
            setStatusText('Upload From Google Photos');
        }
    };

    const checkSessionStatus = async (sessionId) => {
        try {
            // ask the picker api for the status of the input session
            const checkRes = await fetch(`https://photospicker.googleapis.com/v1/sessions/${sessionId}`, {
                headers: {
                    'Authorization': `Bearer ${photoToken}`
                }
            });

            // if this poll fails, then warn the console and wait for the next call
            if (!checkRes.ok) {
                console.warn("Polling check failed.")
                return;
            }

            const sessionData = await checkRes.json();

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

    const downloadImages = async (sessionId) => {
        try {
            // fetch the images the user requested
            const itemsRes = await fetch(`https://photospicker.googleapis.com/v1/mediaItems?sessionId=${sessionId}`, {
                headers: { 'Authorization': `Bearer ${photoToken}` }
            });
            const itemsData = await itemsRes.json();
            const mediaItems = itemsData.mediaItems || [];

            // download the images as File objects to pass back to imageSelector.jsx
            // asked Gemini to write this part since we were unsure how to do this with mediaItems
            const filePromises = mediaItems.map(async (item, index) => {
                // fetch image and compress down to have 1024 width to save space (Gemini does not need a 4k image)
                const imageResponse = await fetch(`${item.mediaFile.baseUrl}=w1024`, {
                    headers: { 'Authorization': `Bearer ${photoToken}` }
                });
                const blob = await imageResponse.blob();

                // get the file type
                const mimeType = item.mediaFile.mimeType;
                const extension = mimeType.split('/')[1];

                // create new File, use Date.now() to make the photo name unique in database
                // use ${index} just in case there is a collision within the same upload and the granularity of Date.now() is not sufficient
                return new File([blob], `google_photo_${Date.now()}_${index}.${extension}`, { type: mimeType });
            });

            const fileObjects = await Promise.all(filePromises);

            // give images to imageSelector
            onPhotosImported(fileObjects);

        } catch (err) {
            console.error("Download error:", err);
            alert("Failed to download selected photos.");
        } finally {
            setIsPicking(false);
            setStatusText('Upload From Google Photos');
        }
    };

    // before had code that checked if the popup was closed, but it was running into Cross-Origin Opener Policy
    // to solve this, just switched to the user manually pressing close on the button
    const handleButtonClick = () => {
        if (isPicking) {
            // cancel the Picker request
            clearInterval(pollIntervalRef.current);
            setIsPicking(false);
            setStatusText('Upload From Google Photos');
        } else {
            startPicker();
        }
    }

    // used Gemini to generate how the button would look
    return (
        <button
            type="button"
            className={`uploadButton ${disabled ? 'disabled' : ''}`}
            onClick={handleButtonClick}
            disabled={disabled}
            style={{
                background: disabled || isPicking ? '#ccc' : '#4285F4', // Google Blue
                color: disabled || isPicking ? '#666' : 'white'
            }}
        >
            {statusText}
        </button>
    );
}