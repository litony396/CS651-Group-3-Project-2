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
    // name of the plant if it exists
    const [plantName, setPlantName] = useState("");
    // plant history for the selected plant
    const [history, setHistory] = useState([]);
    // used to display different stuff while plant history is being loaded in
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    // error state to tell user their plants didn't load
    const [plantsIsLoaded, setPlantsIsLoaded] = useState(true);

    // used to track whether the selected plant has a name
    // make it a const instead of basing it off of plantName because when you type your first letter into plantName, it'll disable the entry form
    const selectedPlant = userPlants.find((p) => p.id === selectedPlantID);
    const hasName = Boolean(selectedPlant?.name);

    useEffect(() => {
        // have to write separate function because useEffect cannot do fetch since it cannot be async
        const fetchPlants = async () => {
            try {
                // make a query for the user's plants
                const res = await fetch(`/api/plants/${user.uid}`)
                if (!res.ok) {
                    throw new Error(`/api/plants gave: ${res.status}`)
                }
                const data = await res.json()
                setUserPlants(data.plants || []);
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
            setPlantName("");
            return;
        }

        // set the plant name to the one we want
        const plant = userPlants.find(p => p.plantID === selectedPlantID);
        setPlantName(plant?.name || "");

        const fetchHistory = async () => {
            setIsLoadingHistory(true);
            try {
                const res = await fetch(`/api/plants/${user.uid}/history?plantID=${selectedPlantID}`);
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

    }, [selectedPlantID, user.uid, userPlants]);



    const handlePlantDiagnosis = async () => {
        setIsDiagnosing(true);
        try {
            // form data used to handle photo and audio uploads to the backend
            const formData = new FormData();

            // add user id and plant id to the request
            // plantID defaults to "" if no plant selected
            formData.append('userID', user.uid);
            formData.append('plantID', selectedPlantID);

            // if this is a plant without a name, then allow name change
            if (!hasName && plantName.trim() !== "") {
                formData.append('plantName', plantName.trim());
            }

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
            setPlantName("")

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
                                {plant?.name || `Plant ID: ${plant.id}`}
                            </option>
                        ))}
                    </select>
                ) : (
                    <span className="plantLoadError">
                        Error loading your plants. Try refreshing. You can still register a new one below.
                    </span>
                )}
            </div>

            {/* Plant Name Input */}
            <div style={{ marginTop: '15px' }}>
                <input
                    type="text"
                    className="plantNameInput"
                    placeholder={hasName ? "" : "Give this plant a name (Optional)"}
                    value={plantName}
                    onChange={(e) => setPlantName(e.target.value)}
                    disabled={hasName}
                />
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