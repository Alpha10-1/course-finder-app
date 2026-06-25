// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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


// ✅ Initialize app first
const app = initializeApp(firebaseConfig);

// ✅ Now you can use app to init services
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
export const db = getFirestore(app);