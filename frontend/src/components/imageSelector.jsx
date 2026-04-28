import React, { useState, useEffect } from 'react';
import GooglePhotosPicker from "./GooglePhotosPicker.jsx";
import "./imageSelector.css"

const MAX_IMAGES = 6;


export default function ImageSelector({ setDashboardImages, photoToken }) {
    // stores data on the uploaded images
    // consists of the actual file object that holds the data and a url in order to actually display the thumbnail in html
    const [images, setImages] = useState([]);

    // when images change (from addition or deletion), tell dashboard.jsx so that it can update accordingly
    // just send img.file since dashboard only cares about having the file to send to Gemini
    useEffect(() => {
        const fileObjects = images.map(img => img.file);
        setDashboardImages(fileObjects);
    }, [images, setDashboardImages]);

    const handleImageUpload = (upload) => {
        // turn uploaded files into an array so we can slice it in processImages
        const files = Array.from(upload.target.files);
        processImages(files);
    };

    const handleGooglePhotosUpload = (importedFiles) => {
        processImages(importedFiles);
    };

    // helper to add images to the images useState
    // separate function because handleImageUpload and handleGooglePhotosUpload both use the same code after preprocessing
    const processImages = (files) => {
        // enforce that there are no more than MAX_IMAGES
        const availableSlots = MAX_IMAGES - images.length;

        // create the files
        // only fill up available slots and then discard the rest
        const newFiles = files.slice(0, availableSlots).map(file => ({
            file,
            thumbnail: URL.createObjectURL(file)
        }));

        // set images to have the existing images and new images just uploaded
        setImages(existingImages => [...existingImages, ...newFiles]);
    }

    const removeImage = (indexToRemove) => {
        // remove the image at the index provided
        setImages(currentImages => currentImages.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="imageSelector">
            {/* Dynamically add a disabled tag in order to use css styles as needed (made by Gemini) */}
            <label className={`uploadButton ${images.length >= MAX_IMAGES ? 'disabled' : ''}`}>
                <input
                    type="file"
                    multiple
                    accept="image/*"
                    onChange={handleImageUpload}
                    disabled={images.length >= MAX_IMAGES}
                    style={{ display: 'none' }}
                />
                {images.length >= MAX_IMAGES ? "Limit Reached" : "Add Local Photos"}
            </label>

            {photoToken && (
                <GooglePhotosPicker
                    photoToken={photoToken}
                    onPhotosImported={handleGooglePhotosUpload}
                    disabled={images.length >= MAX_IMAGES}
                />
            )}

            <div className="thumbnailGallery">
                {images.map((img, index) => (
                    <div key={index} className="thumbnailItem">
                        <img src={img.thumbnail} alt={`Thumbnail ${index}`} />
                        <button type="button" onClick={() => removeImage(index)}>X</button>
                    </div>
                ))}
            </div>
        </div>
    );
}