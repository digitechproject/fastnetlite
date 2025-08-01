/**
 * Initialisation centralisée de Firebase pour FastNetLite
 * Ce fichier doit être chargé avant tout autre script utilisant Firebase
 * pour éviter les initialisations multiples et les conflits
 */

// Import des fonctions nécessaires depuis les SDK Firebase pour l'utilisation en mode module ES6
import { initializeApp } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Vérifier si Firebase est déjà initialisé
if (typeof window.firebaseInitialized === 'undefined') {
    console.log('Initialisation centralisée de Firebase...');
    
    // Marquer comme initialisé pour éviter les initialisations multiples
    window.firebaseInitialized = true;
    
    // Configuration Firebase
    const firebaseConfig = {
        apiKey: "AIzaSyAzd4ZozdCWCy6bQK255uyVFdOrbsHoxfQ",
        authDomain: "fastnetlite.firebaseapp.com",
        projectId: "fastnetlite",
        storageBucket: "fastnetlite.firebasestorage.app",
        messagingSenderId: "539673548783",
        appId: "1:539673548783:web:a9f7da3299069f0abf081a",
        measurementId: "G-GSR54JNW8J"
    };
    
    // Fonction d'initialisation sécurisée
    function initializeFirebaseSafely() {
        try {
            // Vérifier si Firebase est déjà initialisé
            if (window.firebase && window.firebase.apps && window.firebase.apps.length > 0) {
                console.log('Firebase déjà initialisé, utilisation de l\'instance existante');
                return;
            }
            
            // Initialiser Firebase de manière sécurisée
            if (typeof firebase !== 'undefined' && typeof firebase.initializeApp === 'function') {
                firebase.initializeApp(firebaseConfig);
                console.log('Firebase initialisé avec succès (méthode classique)');
            } else if (typeof window.initializeApp === 'function') {
                window.app = window.initializeApp(firebaseConfig);
                console.log('Firebase initialisé avec succès (méthode moderne)');
            } else {
                console.error('Firebase SDK non disponible');
            }
            
            // Initialiser Analytics de manière conditionnelle
            initializeAnalyticsSafely();
            
        } catch (error) {
            if (error.code === 'app/duplicate-app') {
                console.log('Firebase déjà initialisé, utilisation de l\'instance existante');
            } else {
                console.error('Erreur lors de l\'initialisation de Firebase:', error);
            }
        }
    }
    
    // Fonction pour initialiser Analytics de manière sécurisée
    function initializeAnalyticsSafely() {
        try {
            // Ne pas initialiser Analytics sur mobile
            if (typeof window !== 'undefined' && window.navigator && 
                window.navigator.userAgent.match(/Mobile|Android|iPhone/i)) {
                console.log('Analytics non initialisé (environnement mobile détecté)');
                return;
            }
            
            // Initialiser Analytics si disponible
            if (typeof firebase !== 'undefined' && typeof firebase.analytics === 'function') {
                window.analytics = firebase.analytics();
                console.log('Analytics initialisé avec succès (méthode classique)');
            } else if (typeof window.getAnalytics === 'function' && window.app) {
                window.analytics = window.getAnalytics(window.app);
                console.log('Analytics initialisé avec succès (méthode moderne)');
            } else {
                console.log('Analytics non disponible');
            }
        } catch (error) {
            console.warn('Erreur lors de l\'initialisation d\'Analytics:', error);
        }
    }
    
    // Exécuter l'initialisation
    initializeFirebaseSafely();
    
    // Exposer une fonction pour vérifier si Firebase est correctement initialisé
    window.checkFirebaseInitialization = function() {
        if (typeof firebase === 'undefined') {
            console.error('Firebase n\'est pas disponible');
            return false;
        }
        
        if (!firebase.apps || firebase.apps.length === 0) {
            console.error('Firebase n\'est pas initialisé');
            return false;
        }
        
        console.log('Firebase est correctement initialisé');
        return true;
    };
} else {
    console.log('Firebase déjà initialisé, initialisation ignorée');
}

/**
 * Fonction d'initialisation de Firebase pour l'utilisation en mode ES6 module
 * Cette fonction est exportée pour être utilisée dans d'autres fichiers
 * @param {Object} config - Configuration Firebase
 * @returns {Object} Instances Firebase (app, db, auth, storage, analytics)
 */
export function initializeFirebase(config) {
    // Vérifier si Firebase est déjà initialisé via la variable globale
    if (window.firebaseInitialized && window.app) {
        console.log('initializeFirebase: Utilisation des instances Firebase existantes');
        return {
            app: window.app,
            db: window.db,
            auth: window.auth,
            storage: window.storage,
            analytics: window.analytics
        };
    }
    
    // Initialiser Firebase
    console.log('initializeFirebase: Initialisation de Firebase (mode ES6)');
    let app;
    
    try {
        // Vérifier si Firebase est déjà initialisé d'une autre manière
        if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
            console.log('Firebase déjà initialisé via SDK v8, utilisation de l\'instance existante');
            app = firebase.apps[0];
        } else {
            app = initializeApp(config);
            console.log('Firebase initialisé avec succès via SDK v9');
        }
    } catch (error) {
        if (error.code === 'app/duplicate-app') {
            console.log('Firebase déjà initialisé, utilisation de l\'instance existante');
            // Récupérer l'instance existante
            app = initializeApp();
        } else {
            console.error('Erreur lors de l\'initialisation de Firebase:', error);
            throw error;
        }
    }
    
    // Initialiser les services Firebase
    const db = getFirestore(app);
    const auth = getAuth(app);
    const storage = getStorage(app);
    
    // Activer la persistance des données pour le mode hors ligne
    // Nous le faisons ici pour être sûr que c'est fait une seule fois
    try {
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
    } catch (error) {
        console.warn('Erreur lors de l\'activation de la persistance:', error);
    }
    
    // Initialiser Analytics de manière conditionnelle (désactivé sur mobile)
    let analytics = null;
    try {
        if (typeof window !== 'undefined' && window.navigator && !window.navigator.userAgent.match(/Mobile|Android|iPhone/i)) {
            analytics = getAnalytics(app);
            console.log('Analytics initialisé avec succès (mode ES6)');
        } else {
            console.log('Analytics non initialisé (environnement mobile détecté)');
        }
    } catch (error) {
        console.warn('Erreur lors de l\'initialisation d\'Analytics:', error);
    }
    
    // Stocker les instances dans les variables globales pour la compatibilité
    window.app = app;
    window.db = db;
    window.auth = auth;
    window.storage = storage;
    window.analytics = analytics;
    window.firebaseInitialized = true;
    
    // Retourner les instances
    return { app, db, auth, storage, analytics };
}
