import React, { useState, useEffect } from 'react';
import './dashboard.css';
import AudioRecorder from "../components/audioRecorder";
import ImageSelector from "../components/imageSelector";
import PlantHistory from "../components/plantHistory";

export default function Dashboard({ user }) {
    // these variables are to do with uploading stuff to be diagnosed
    // selectedImages and selectedAudio hold the uploaded images and audio files
    const [selectedImages, setSelectedImages] = useState([]);
    const [selectedAudio, setSelectedAudio] = useState(null);
    // isDiagnosing boolean is used to display different stuff while the backend is diagnosing
    const [isDiagnosing, setIsDiagnosing] = useState(false);

    // these variables hold user-specific state
    // list of all the user's plants in the database
    const [userPlants, setUserPlants] = useState([]);
    // stores currently selected plant
    const [selectedPlantID, setSelectedPlantID] = useState("");
    // plant history for the selected plant
    const [history, setHistory] = useState([]);
    // used to display different stuff while plant history is being loaded in
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    // error state to tell user their plants didn't load
    const [plantsIsLoaded, setPlantsIsLoaded] = useState(true);

    useEffect(() => {
        // have to write separate
        const fetchPlants = async () => {
            try {
                // make a query for the user's plants
                const res = await fetch(`/api/plants?uid=${user.uid}`)
                if (!res.ok) {
                    throw new Error(`/api/plants gave: ${res.status}`)
                }
                const data = await res.json()
                setUserPlants(data.plantIDs || []);
                setPlantsIsLoaded(true);
            } catch (err) {
                console.error(`Failed to load plants for ${user.uid}$`, err);
                setPlantsIsLoaded(false);
            }
        };

        fetchPlants();

    }, [user.uid]);

    // fetch history when drop down selection changes
    useEffect(() => {
        // Check for empty string (New Plant) or missing UID
        if (!selectedPlantID) {
            setHistory([]);
            return;
        }

        const fetchHistory = async () => {
            setIsLoadingHistory(true);
            try {
                const res = await fetch(`/api/plants/${selectedPlantID}/history?uid=${user.uid}`);
                if (!res.ok) {
                    throw new Error(`Failed to fetch history: ${res.status}`);
                }
                const data = await res.json();
                setHistory(data.history || []);
            } catch (err) {
                console.error("History error", err);
                // don't need something to mark this error since if (selectedPlantID && !history) then it is naturally an error and will cause a different render
            } finally {
                setIsLoadingHistory(false);
            }
        };

        fetchHistory();

    }, [selectedPlantID, user.uid]);



    const handlePlantDiagnosis = async () => {
        setIsDiagnosing(true);
        try {
            // form data used to handle photo and audio uploads to the backend
            const formData = new FormData();

            // add user id and plant id to the request
            // plantID defaults to "" if no plant selected
            formData.append('userID', user.uid);
            formData.append('plantID', selectedPlantID);

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

            // add new record to timeline
            setHistory(prevHistory => [data.diagnosisRecord, ...prevHistory])

            // TODO: Figure out how to reset the upload fields late, need to be able to communicate with image and audio selector
        } catch (error) {
            console.error("Diagnosis Failed: ", error);
            // https://developer.mozilla.org/en-US/docs/Web/API/Window/alert
            alert("Error Creating Diagnosis. Please try again.");
        } finally {
            // always want to switch away from diagnosing mode
            setIsDiagnosing(false);
        }
    }

    // this HTML was generated using Gemini by prompting it to follow the pictures of our mockup to make it look as desired
    return (
        <div className="dashboardContainer">
            <h1>Plant Health Dashboard</h1>

            {/* Dropdown for PlantID */}
            <div className="plantSelectionContainer">
                <label htmlFor="plantSelect" className="plantLabel">
                    Select Plant:
                </label>
                {plantsIsLoaded ? (
                    <select
                        id="plantSelect"
                        value={selectedPlantID}
                        onChange={(e) => setSelectedPlantID(e.target.value)}
                        className="plantDropdown"
                    >
                        <option value="">Register a New Plant</option>
                        {userPlants.map(plant => (
                            <option key={plant.id} value={plant.id}>
                                {`Plant ID: ${plant.id}`}
                            </option>
                        ))}
                    </select>
                ) : (
                    <span className="plantLoadError">
                        Error loading your plants. Try refreshing. You can still register a new one below.
                    </span>
                )}
            </div>


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
            {/* plantHistory component handles this section internally */}
            <PlantHistory
                history={history}
                isLoadingHistory={isLoadingHistory}
                selectedPlantId={selectedPlantID}
            />
        </div>
    );
}