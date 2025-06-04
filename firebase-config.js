// Configuration Firebase pour FastNetLite avec SDK moderne
// Import des fonctions nécessaires depuis les SDK Firebase
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, startAfter, serverTimestamp, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Configuration Firebase avec vos clés d'API
const firebaseConfig = {
  apiKey: "AIzaSyAzd4ZozdCWCy6bQK255uyVFdOrbsHoxfQ",
  authDomain: "fastnetlite.firebaseapp.com",
  projectId: "fastnetlite",
  storageBucket: "fastnetlite.firebasestorage.app",
  messagingSenderId: "539673548783",
  appId: "1:539673548783:web:a9f7da3299069f0abf081a",
  measurementId: "G-GSR54JNW8J"
};

// Initialiser Firebase
const app = initializeApp(firebaseConfig);

// Initialiser les services Firebase
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
const analytics = getAnalytics(app);

// Exporter les variables Firebase pour les utiliser dans d'autres fichiers
// export { app, auth, storage, analytics };

// Activer la persistance des données pour le mode hors ligne
enableIndexedDbPersistence(db)
  .catch((err) => {
    if (err.code === 'failed-precondition') {
      // Plusieurs onglets ouverts, la persistance ne peut être activée
      console.warn('La persistance des données ne peut pas être activée car plusieurs onglets sont ouverts');
    } else if (err.code === 'unimplemented') {
      // Le navigateur ne prend pas en charge la persistance
      console.warn('Le navigateur ne prend pas en charge la persistance des données hors ligne');
    }
  });

// Créer une couche de compatibilité pour le code existant
// Cela permet d'utiliser l'ancien style d'API Firebase dans le code existant
window.firebase = {
  auth: () => auth,
  firestore: () => ({
    collection: (path) => collection(db, path),
    doc: (path) => doc(db, path),
    FieldValue: {
      serverTimestamp: () => serverTimestamp()
    }
  }),
  storage: () => storage
};

// Exposer les fonctions Firebase modernes sur l'objet window pour la compatibilité avec le code existant
window.db = db;
window.auth = auth;
window.storage = storage;
window.firestore = {
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  serverTimestamp
};
window.storageRef = ref;
window.uploadBytes = uploadBytes;
window.getDownloadURL = getDownloadURL;

// Exporter les services Firebase pour une utilisation dans d'autres fichiers
export { 
  db, 
  auth, 
  storage, 
  analytics,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  ref,
  uploadBytes,
  getDownloadURL,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged
};

// Pour la compatibilité avec le code existant, nous exposons également les services sur l'objet window
// Note: Cette approche est déconseillée pour les nouvelles applications, mais nécessaire pour la transition

console.log('Configuration Firebase chargée avec SDK moderne');