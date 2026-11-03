import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDCDa3c0X8E6iXO2acHZA7eWR5LAqHEwEM",
  authDomain: "deep-education-5972f.firebaseapp.com",
  projectId: "deep-education-5972f",
  storageBucket: "deep-education-5972f.firebasestorage.app",
  messagingSenderId: "532958567123",
  appId: "1:532958567123:web:0e5b43c4905ed764fa9226",
  measurementId: "G-1G4869SHV4"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
// Auth and Storage are exported for the staged Firebase Authentication + encrypted-file migration.
export const auth = getAuth(app);
export const storage = getStorage(app);