import React, { useState } from 'react';
import './dashboard.css';
import AudioRecorder from "../components/audioRecorder";
import ImageSelector from "../components/imageSelector";

export default function Dashboard({ user }) {
    // selectedImages and selectedAudio hold the uploaded images and audio files
    const [selectedImages, setSelectedImages] = useState([]);
    const [selectedAudio, setSelectedAudio] = useState(null);
    // diagnosis holds the diagnosis once it is returned
    const [diagnosis, setDiagnosis] = useState(null);
    // isDiagnosing boolean is used to display different stuff while the backend is diagnosing
    const [isDiagnosing, setIsDiagnosing] = useState(false);
    // stores currently selected plant
    const [selectedPlantID, setSelectedPlantID] = useState(null);

    const handlePlantDiagnosis = async () => {
        setIsDiagnosing(true);
        try {
            // form data used to handle photo and audio uploads to the backend
            const formData = new FormData();

            // add user id and plant id to the request
            formData.append('userID', user.id);
            formData.append('plantID', selectedPlantID || "");

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
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status} - ${errorText}`);
            }

            const data = await response.json();

            // if this is a new plant, then set the plantID to the new generated one
            if (!selectedPlantID) {
                setSelectedPlantID(data.plantID);
            }

            setDiagnosis(data.diagnosisRecord);
        } catch (error) {
            console.error("Diagnosis Failed: ", error);
            // https://developer.mozilla.org/en-US/docs/Web/API/Window/alert
            alert("Error Creating Diagnosis");
        } finally {
            // always want to switch away from diagnosing mode
            setIsDiagnosing(false);
        }
    }

    // this HTML was generated using Gemini by prompting it to follow the pictures of our mockup to make it look as desired
    return (
        <div className="dashboardContainer">
            <h1>Plant Health Dashboard</h1>

            {/* Handle Images and Audio */}
            <div className="inputSection">
                <div>
                    <h2>1. Select Plant Photos (max 9)</h2>
                    <ImageSelector setDashboardImages={setSelectedImages} photoToken={user.googlePhotosToken} />
                </div>

                <div>
                    <h2>2. Describe Symptoms, Environment, and Care Routine</h2>
                    <AudioRecorder setAudio={setSelectedAudio} />
                </div>
            </div>

            {/* Analyze Plant Health Button */}
            <div className="actionSection">
                <button
                    onClick={handlePlantDiagnosis}
                    disabled={isDiagnosing || (selectedImages.length === 0 && !selectedAudio)}
                >
                    {isDiagnosing ? 'Diagnosing...' : 'Analyze Plant Health'}
                </button>
            </div>

            {/* Displaying the Diagnosis */}
            {/* Only display when a diagnosis has been made */}
            {diagnosis && diagnosis.generatedDiagnosis && (
                <section className="resultsSection">

                    {/* Header indicating successful diagnosis */}
                    <div className="diagnosisHeader">
                        DIAGNOSIS COMPLETE: Record #{diagnosis.diagnosisNumber || '1'}
                    </div>

                    {/* Core Diagnosis Info */}
                    <div className="coreDiagnosis">
                        <h2>{diagnosis.generatedDiagnosis.condition || 'Unknown Issue'}</h2>
                        <p>
                            <strong>Summary:</strong> {diagnosis.generatedDiagnosis.summary || 'N/A'}
                        </p>
                    </div>

                    <hr className="divider" />

                    {/* Detailed Layout */}
                    <div className="diagnosisDetails">

                        {/* Actionable Steps */}
                        <div className="actionSteps">
                            <div className="treatmentBlock">
                                <h3>Treatment Steps</h3>
                                <ol className="treatmentList">
                                    {(diagnosis.generatedDiagnosis.treatmentSteps || []).map((step, index) => (
                                        <li key={index}>{step}</li>
                                    ))}
                                </ol>
                            </div>

                            <div className="preventionBlock">
                                <h3>Prevention Tips</h3>
                                <ul className="preventionList">
                                    {(diagnosis.generatedDiagnosis.preventionTips || []).map((tip, index) => (
                                        <li key={index}>{tip}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>

                        {/* Educational Info */}
                        <div className="explanationSection">
                            <h3>Detailed Explanation</h3>
                            <p className="explanationText">
                                {diagnosis.generatedDiagnosis.detailedExplanation || 'No detailed explanation provided.'}
                            </p>
                        </div>
                    </div>
                </section>
            )}
        </div>
    );
}