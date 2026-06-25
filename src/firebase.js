import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDgSKlh9_3pBI9_IggS3C9aGh7I2edX484",
  authDomain: "course-finder-214e7.firebaseapp.com",
  databaseURL: "https://course-finder-214e7-default-rtdb.firebaseio.com",
  projectId: "course-finder-214e7",
  storageBucket: "course-finder-214e7.firebasestorage.app",
  messagingSenderId: "1088637117196",
  appId: "1:1088637117196:web:35018e3cbbffb2fcafdf29",
  measurementId: "G-ESWPT05N3Z"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);