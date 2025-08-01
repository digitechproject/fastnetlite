// Configuration Firebase pour FastNetLite avec SDK moderne
// Ce fichier sert de point d'entrée unique pour toutes les fonctionnalités Firebase
// Il utilise l'instance Firebase initialisée par js/firebase-init.js

// Import des fonctions nécessaires depuis les SDK Firebase
import { 
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
  enableIndexedDbPersistence,
  deleteDoc,
  deleteField,
  addDoc,
  updateDoc,
  writeBatch,
  runTransaction,
  getFirestore
} from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Importer l'initialisation centralisée depuis firebase-init.js
import { initializeFirebase } from './js/firebase-init.js';

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

// Vérifier si Firebase est déjà initialisé via window
let app, db, auth, storage, analytics;

// Utiliser les instances globales si elles existent déjà
if (window.firebaseInitialized && window.app) {
  console.log('firebase-config: Utilisation des instances Firebase existantes depuis window');
  app = window.app;
  db = window.db;
  auth = window.auth;
  storage = window.storage;
  analytics = window.analytics;
} else {
  // Sinon, initialiser Firebase via firebase-init.js
  console.log('firebase-config: Initialisation de Firebase via firebase-init.js');
  const instances = initializeFirebase(firebaseConfig);
  app = instances.app;
  db = instances.db;
  auth = instances.auth;
  storage = instances.storage;
  analytics = instances.analytics;
}

// Note: Les instances Firebase sont exportées à la fin du fichier

// Note: La persistance des données est maintenant activée dans firebase-init.js

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
  app,
  db, 
  auth, 
  storage, 
  analytics,
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  getFirestore,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  serverTimestamp,
  enableIndexedDbPersistence,
  ref,
  uploadBytes,
  getDownloadURL,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  sendPasswordResetEmail,
  deleteObject,
  // Fonctions manquantes qui causent l'erreur
  deleteDoc,
  deleteField,
  addDoc,
  updateDoc,
  writeBatch,
  runTransaction,
};

// Pour la compatibilité avec le code existant, nous exposons également les services sur l'objet window
// Note: Cette approche est déconseillée pour les nouvelles applications, mais nécessaire pour la transition

console.log('Configuration Firebase chargée avec SDK moderne');