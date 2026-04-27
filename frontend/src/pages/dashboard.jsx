import React, { useState } from 'react';

export default function Dashboard() {
    // selectedImages and selectedAudio hold the uploaded images and audio files
    const [selectedImages, setSelectedImages] = useState([]);
    const [selectedAudio, setSelectedAudio] = useState(null);
    // diagnosis holds the diagnosis once it is returned
    const [diagnosis, setDiagnosis] = useState(null);
    // isDiagnosing boolean is used to display different stuff while the backend is diagnosing
    const [isDiagnosing, setIsDiagnosing] = useState(false);

    const handlePlantDiagnosis = async () => {
        setIsDiagnosing(true);
        try {
            // form data used to handle photo and audio uploads to the backend
            const formData = new FormData();

            selectedImages.forEach((image) => {
                formData.append('image', image);
            })

            if (selectedAudio) {
                formData.append('audio', selectedAudio);
            }


            const response = await fetch('/api/diagnose', {
                method: 'POST',
                body: formData
            })

            if (!response.ok) {
                throw new Error('Response from /api/diagnose was not ok');
            }

            const data = await response.json();
            setDiagnosis(data);
        } catch (error) {
            console.error("Diagnosis Failed: ", error);
            // https://developer.mozilla.org/en-US/docs/Web/API/Window/alert
            alert("Error Creating Diagnosis");
        } finally {
            // always want to switch away from diagnosing mode
            setIsDiagnosing(false);
        }
    }
}