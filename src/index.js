// Fichier d'entrée principal pour FastNetLite
// Import des fonctions nécessaires depuis les SDK Firebase
import { initializeApp } from "firebase/app";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, query, where, orderBy, limit, startAfter, serverTimestamp, enableIndexedDbPersistence, deleteDoc, deleteField, addDoc } from "firebase/firestore";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, sendPasswordResetEmail } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Nous n'importons pas auth.js ici pour éviter les problèmes d'initialisation Firebase

// Note: Nous n'importons plus les scripts existants directement
// car ils seront copiés par webpack et utilisés via les balises script dans les fichiers HTML

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

// Créer une couche de compatibilité complète pour le code existant
// Cela permet d'utiliser l'ancien style d'API Firebase dans le code existant
window.firebase = {
  auth: () => {
    return {
      signInWithEmailAndPassword: (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
      },
      createUserWithEmailAndPassword: (email, password) => {
        return createUserWithEmailAndPassword(auth, email, password);
      },
      signOut: () => {
        console.log('Déconnexion en cours...');
        return signOut(auth).then(() => {
          console.log('Déconnexion réussie');
          // Rediriger vers la page de connexion après la déconnexion
          window.location.href = 'index.html';
        }).catch(error => {
          console.error('Erreur lors de la déconnexion:', error);
          throw error;
        });
      },
      onAuthStateChanged: (callback) => {
        // Assurer que le callback reçoit toujours les informations de l'utilisateur actuel
        return onAuthStateChanged(auth, (user) => {
          console.log('Changement d\'état d\'authentification:', user ? user.email : 'aucun utilisateur');
          if (user) {
            // Mettre à jour la propriété currentUser pour qu'elle soit toujours à jour
            auth.currentUser = user;
          }
          callback(user);
        });
      },
      sendPasswordResetEmail: (email) => sendPasswordResetEmail(auth, email),
      // Créer une fonction getter pour currentUser qui retourne toujours la valeur actuelle
      get currentUser() {
        return auth.currentUser;
      }
    };
  },
  firestore: function() {
    // Ajouter la propriété FieldValue directement sur la fonction firestore
    if (!firebase.firestore.FieldValue) {
      firebase.firestore.FieldValue = {
        serverTimestamp: () => serverTimestamp(),
        delete: () => deleteField()
      };
    }
    
    return {
      collection: (path) => {
        const collectionRef = collection(db, path);
        return {
          doc: (docPath) => {
            const docRef = doc(db, path, docPath);
            return {
              get: () => getDoc(docRef),
              set: (data) => setDoc(docRef, data),
              update: (data) => setDoc(docRef, data, { merge: true }),
              delete: () => deleteDoc(docRef),
              id: docRef.id,
              path: docRef.path,
              onSnapshot: (callback) => {
                return onSnapshot(docRef, (doc) => {
                  callback({
                    exists: doc.exists(),
                    id: doc.id,
                    data: () => doc.data(),
                    ref: doc.ref
                  });
                });
              }
            };
          },
          add: (data) => {
            return addDoc(collectionRef, data);
          },
          get: () => getDocs(collectionRef),
          where: (field, operator, value) => {
            const q = query(collectionRef, where(field, operator, value));
            return {
              get: () => getDocs(q),
              onSnapshot: (callback) => {
                return onSnapshot(q, (snapshot) => {
                  callback({
                    docs: snapshot.docs.map(doc => ({
                      id: doc.id,
                      data: () => doc.data(),
                      ref: doc.ref,
                      exists: doc.exists()
                    })),
                    empty: snapshot.empty,
                    size: snapshot.size
                  });
                });
              },
              orderBy: (field, direction) => {
                const orderedQuery = query(q, orderBy(field, direction || 'asc'));
                return {
                  get: () => getDocs(orderedQuery),
                  limit: (limitValue) => {
                    const limitedQuery = query(orderedQuery, limit(limitValue));
                    return {
                      get: () => getDocs(limitedQuery),
                      limit: (limitValue2) => {
                        const nestedLimitedQuery = query(limitedQuery, limit(limitValue2));
                        return {
                          get: () => getDocs(nestedLimitedQuery)
                        };
                      }
                    };
                  }
                };
              },
              orderBy: (field2, direction2 = 'asc') => {
                const q2 = query(q, orderBy(field2, direction2));
                return {
                  get: () => getDocs(q2),
                  limit: (limitValue) => {
                    const q3 = query(q2, limit(limitValue));
                    return {
                      get: () => getDocs(q3)
                    };
                  }
                };
              },
              limit: (limitValue) => {
                const q2 = query(q, limit(limitValue));
                return {
                  get: () => getDocs(q2)
                };
              }
            };
          },
          orderBy: (field, direction = 'asc') => {
            const q = query(collectionRef, orderBy(field, direction));
            return {
              get: () => getDocs(q),
              limit: (limitValue) => {
                const q2 = query(q, limit(limitValue));
                return {
                  get: () => getDocs(q2)
                };
              }
            };
          },
          limit: (limitValue) => {
            const q = query(collectionRef, limit(limitValue));
            return {
              get: () => getDocs(q)
            };
          },
          add: (data) => {
            // Utiliser addDoc au lieu de setDoc pour générer automatiquement un ID
            return addDoc(collectionRef, data).then((docRef) => {
              // Retourner un objet qui imite la structure attendue par le code existant
              return {
                id: docRef.id,
                path: docRef.path,
                get: () => getDoc(docRef),
                set: (newData) => setDoc(docRef, newData),
                update: (newData) => setDoc(docRef, newData, { merge: true }),
                delete: () => deleteDoc(docRef)
              };
            }).catch(error => {
              console.error("Erreur lors de l'ajout du document:", error);
              throw error; // Propager l'erreur pour que le code appelant puisse la gérer
            });
          },
          get: () => getDocs(collectionRef)
        };
      },
      doc: (path) => {
        const segments = path.split('/');
        const collectionPath = segments.slice(0, segments.length - 1).join('/');
        const docId = segments[segments.length - 1];
        const docRef = doc(db, collectionPath, docId);
        return {
          get: () => getDoc(docRef),
          set: (data) => setDoc(docRef, data),
          update: (data) => setDoc(docRef, data, { merge: true }),
          delete: () => deleteDoc(docRef),
          id: docRef.id,
          path: docRef.path
        };
      },
      FieldValue: {
        serverTimestamp: () => serverTimestamp(),
        delete: () => deleteField()
      },
      Timestamp: {
        fromDate: (date) => {
          // Créer un timestamp Firebase à partir d'une date JavaScript
          const timestamp = new Date(date).getTime();
          return { seconds: Math.floor(timestamp / 1000), nanoseconds: 0 };
        },
        now: () => serverTimestamp()
      }
    };
  },
  storage: () => {
    return {
      ref: (path) => {
        const storageRef = ref(storage, path);
        return {
          put: (file) => uploadBytes(storageRef, file),
          getDownloadURL: () => getDownloadURL(storageRef),
          delete: () => deleteObject(storageRef)
        };
      }
    };
  }
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

// Créer une fonction pour initialiser correctement l'utilisateur
const initializeCurrentUser = () => {
  if (auth.currentUser) {
    console.log('Utilisateur déjà connecté:', auth.currentUser.email);
  } else {
    console.log('Aucun utilisateur connecté');
  }
};

// Appeler cette fonction au démarrage
initializeCurrentUser();

// Ajouter un écouteur d'événements pour l'authentification
onAuthStateChanged(auth, (user) => {
  if (user) {
    console.log('Utilisateur connecté:', user.email);
  } else {
    console.log('Utilisateur déconnecté');
  }
});

// Ajouter une propriété firestore globale pour la compatibilité avec le code existant
window.firebase.firestore = Object.assign({}, {
  collection: (path) => collection(db, path),
  doc: (path) => doc(db, path),
  setDoc: (docRef, data) => setDoc(docRef, data),
  getDoc: (docRef) => getDoc(docRef),
  getDocs: (query) => getDocs(query),
  query: (collectionRef, ...queryConstraints) => query(collectionRef, ...queryConstraints),
  where: (field, operator, value) => where(field, operator, value),
  orderBy: (field, direction) => orderBy(field, direction),
  limit: (limitValue) => limit(limitValue),
  startAfter: (snapshot) => startAfter(snapshot),
  serverTimestamp: () => serverTimestamp(),
  FieldValue: {
    serverTimestamp: () => serverTimestamp(),
    delete: () => deleteField()
  }
});
window.storageRef = ref;
window.uploadBytes = uploadBytes;
window.getDownloadURL = getDownloadURL;

// Exposer les fonctions d'authentification Firebase sur l'objet window
window.signInWithEmailAndPassword = signInWithEmailAndPassword;
window.createUserWithEmailAndPassword = createUserWithEmailAndPassword;
window.signOut = signOut;
window.onAuthStateChanged = onAuthStateChanged;
window.sendPasswordResetEmail = sendPasswordResetEmail;

// Fonction améliorée pour vérifier si l'utilisateur est connecté
// Évite les redirections en boucle en vérifiant l'URL actuelle
function checkAuth() {
  return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe();
      resolve(user);
    });
  });
}

// Exposer la fonction checkAuth sur l'objet window
window.checkAuth = checkAuth;

console.log('Configuration Firebase chargée avec SDK moderne');

// Exporter la fonction checkAuth déjà définie plus haut
export { checkAuth };

// Fonction pour gérer les redirections d'authentification de manière sécurisée
export const handleAuthRedirect = (user, isLoginPage) => {
  const currentPath = window.location.pathname;
  const isIndexPage = currentPath.includes('index.html') || currentPath === '/' || currentPath.endsWith('/');
  
  if (user && isIndexPage) {
    // L'utilisateur est connecté et sur la page d'index, rediriger vers le dashboard
    console.log('Utilisateur connecté, redirection vers dashboard');
    window.location.href = 'dashboard.html';
  } else if (!user && !isIndexPage && !isLoginPage) {
    // L'utilisateur n'est pas connecté et n'est pas sur la page d'index, rediriger vers l'index
    console.log('Utilisateur non connecté, redirection vers index');
    window.location.href = 'index.html';
  }
};

// Variable globale pour éviter les initialisations multiples
window.indexJsInitialized = window.indexJsInitialized || false;

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', () => {
  // Vérifier si le script a déjà été initialisé
  if (window.indexJsInitialized) {
    console.log('src/index.js déjà initialisé, initialisation ignorée');
    return;
  }
  
  // Marquer le script comme initialisé
  window.indexJsInitialized = true;
  console.log('FastNetLite initialisé avec SDK Firebase moderne');
});

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
  onAuthStateChanged,
  sendPasswordResetEmail
};
