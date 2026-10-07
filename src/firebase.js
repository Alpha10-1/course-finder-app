import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";

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
// Keep a local copy of Firestore data (IndexedDB) so marks, results and
// selections a learner has loaded once still show offline. Falls back to the
// default in-memory cache where that isn't possible (e.g. the build-time
// prerender, which runs in Node).
function createFirestore() {
  if (typeof window === "undefined") return getFirestore(app);
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });
  } catch (err) {
    console.warn("Offline cache unavailable, using in-memory Firestore cache:", err);
    return getFirestore(app);
  }
}

export const db = createFirestore();