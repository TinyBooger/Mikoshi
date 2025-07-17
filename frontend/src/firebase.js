// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyB_RdbZ2ENV8FEcfpkImoMUARFe1jA1rtQ",
  authDomain: "mikoshi-135c9.firebaseapp.com",
  projectId: "mikoshi-135c9",
  storageBucket: "mikoshi-135c9.firebasestorage.app",
  messagingSenderId: "39316232518",
  appId: "1:39316232518:web:01ca7986f0a593b4e4ad47",
  measurementId: "G-STTN82Q0FG"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export default app;