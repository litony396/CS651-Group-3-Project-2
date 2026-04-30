import React, { useState, useRef } from 'react';
import './audioRecorder.css';
import ReactGA from "react-ga4";

export default function AudioRecorder({ setAudio }) {
    // used to store audio URL from recording
    const [audioURL, setAudioURL] = useState(null);
    // used to show different stuff to user when in the process of recording
    const [isRecording, setIsRecording] = useState(false);
    // holds the MediaRecorder
    const mediaRecorderRef = useRef(null);
    // used to store the audio output from the MediaRecorder
    const recordedAudioRef = useRef([]);

    const startRecording = async () => {
        // clear any old recording data
        recordedAudioRef.current = []

        try {
            // create a mediaRecorder that uses the audio stream from a microphone
            // https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorderRef.current = new MediaRecorder(stream);

            // when data is given to the mediaRecorder, add the audio to the recorded audio storage
            mediaRecorderRef.current.ondataavailable = (audio) => {
                if (audio.data.size > 0) {
                    recordedAudioRef.current.push(audio.data);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                // make a blob from the recorded audio and make a URL for it
                const audioBlob = new Blob(recordedAudioRef.current, { type: 'audio/webm' });
                const url = URL.createObjectURL(audioBlob);

                setAudioURL(url);

                // send the audio blob back to Dashboard.jsx
                setAudio(audioBlob);

                // close mic stream
                stream.getTracks().forEach(track => track.stop());
            }

            ReactGA.event({
                category: "User Action",
                action: "Audio Recording",
                label: "Uploaded audio for diagnosis"
            })

            // start the mediaRecorder
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (error) {
            console.error("Error accessing microphone:", error);
            alert("Could not access microphone.")
        }
    }

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }

    return (
        <div className="audioRecorder">
            {/* make buttons to start and stop recording */}
            {!isRecording ? (
                <button type="button" onClick={startRecording}>
                    Start Recording
                </button>
            ) : (
                <button type="button" onClick={stopRecording} className="recording">
                    Stop Recording
                </button>
            )}

            {/* give audio preview if url exists */}
            {audioURL && !isRecording && (
                <div className="audioPreview">
                    <p>Recorded Audio:</p>
                    <audio src={audioURL} controls />
                </div>
            )}
        </div>
    );
}