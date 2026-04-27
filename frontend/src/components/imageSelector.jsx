import React, { useState, useEffect } from 'react';
import "./imageSelector.css"

const MAX_IMAGES = 6;


export default function ImageSelector({ setDashboardImages }) {
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
        const files = Array.from(upload.target.files);
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
    };

    const removeImage = (indexToRemove) => {
        // remove the image at the index provided
        setImages(currentImages => currentImages.filter((_, index) => index !== indexToRemove));
    };

    return (
        <div className="imageSelector">
            <input
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageUpload}
                disabled={images.length >= 6}
            />

            <div className="thumbnailGallery">
                {images.map((img, index) => (
                    <div key={index} className="thumbnailItem">
                        <img src={img.thumbnail} alt={`Thumbnail ${index}`} />
                        <button type="button" onClick={() => removeImage(index)}>X</button>
                    </div>
                ))}
            </div>

            {/* TODO: ADD GOOGLE PHOTOS INTEGRATION */}
        </div>
    );
}