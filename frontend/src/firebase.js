// frontend/src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

let app;
let auth;

// Async function to initialize Firebase
async function initializeFirebase() {
  try {
    const response = await fetch('/api/config/firebase');
    if (!response.ok) {
      throw new Error('Failed to fetch Firebase config');
    }
    
    const firebaseConfig = await response.json();
    console.log("Firebase Config:", firebaseConfig);
    
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    
    return { app, auth };
  } catch (error) {
    console.error("Error initializing Firebase:", error);
    throw error;
  }
}

// Create a promise that resolves when Firebase is initialized
const firebasePromise = initializeFirebase();

// Export the auth promise and functions
export const authReady = firebasePromise.then(({ auth }) => auth);

export async function getAuthInstance() {
  const { auth } = await firebasePromise;
  return auth;
}

// Wrapper functions that wait for auth to be ready
export async function secureCreateUserWithEmailAndPassword(email, password) {
  const auth = await getAuthInstance();
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function secureSignInWithEmailAndPassword(email, password) {
  const auth = await getAuthInstance();
  return signInWithEmailAndPassword(auth, email, password);
}