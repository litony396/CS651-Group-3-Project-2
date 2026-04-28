import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider, signInWithPopup } from "firebase/auth";

// https://firebase.google.com/docs/auth/web/google-signin
// use firebase auth since it is really simple to use

const firebaseConfig = {
    apiKey: "AIzaSyCaGtd2RmAajfaPwPNR_zCt_09jMN6YLNE",
    authDomain: "plantcareai-f1498.firebaseapp.com",
    projectId: "plantcareai-f1498",
    storageBucket: "plantcareai-f1498.firebasestorage.app",
    messagingSenderId: "655658042217",
    appId: "1:655658042217:web:2287d5b1b5ccfa82fe73f8",
    measurementId: "G-JETJLRLH57"
};

// initialize firebase authorization
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Gemini said to write this line of code to allow permission to read user's Google Photos using photos picker API
provider.addScope('https://www.googleapis.com/auth/photospicker.mediaitems.readonly');

export { auth, provider, signInWithPopup };