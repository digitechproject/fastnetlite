// Import des fonctions Firebase nécessaires
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";

// Obtenir les instances des services Firebase
// Importer l'instance Auth déjà initialisée depuis firebase-config.js
import { auth } from '../firebase-config.js';
// Importer l'instance Firestore déjà initialisée depuis firebase-config.js
import { db } from '../firebase-config.js';

// Fonctions d'authentification pour FastNetLite
// Note: Les imports sont maintenant gérés par webpack dans src/index.js

// Variable globale pour éviter les initialisations multiples
window.authJsInitialized = window.authJsInitialized || false;

document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si le script a déjà été initialisé
    if (window.authJsInitialized) {
        console.log('auth.js déjà initialisé, initialisation ignorée');
        return;
    }
    
    // Marquer le script comme initialisé
    window.authJsInitialized = true;
    console.log('Initialisation de auth.js');
    // Références aux éléments du DOM
    const loginForm = document.getElementById('loginForm');
    const registerForm = document.getElementById('registerForm');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    
    const showRegisterFormBtn = document.getElementById('showRegisterFormBtn');
    const showLoginFormBtn = document.getElementById('showLoginFormBtn');
    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    
    const loginBtn = document.getElementById('loginBtn');
    const registerBtn = document.getElementById('registerBtn');
    const resetPasswordBtn = document.getElementById('resetPasswordBtn');
    const backToLoginBtn = document.getElementById('backToLoginBtn');
    
    const loginError = document.getElementById('loginError');
    const registerError = document.getElementById('registerError');
    const forgotPasswordError = document.getElementById('forgotPasswordError');
    const forgotPasswordSuccess = document.getElementById('forgotPasswordSuccess');

    // Fonction utilitaire pour ajouter un écouteur d'événement de façon sécurisée
    function addSafeEventListener(element, eventType, handler) {
        if (element && !element.getAttribute(`data-${eventType}-handler-attached`)) {
            element.setAttribute(`data-${eventType}-handler-attached`, 'true');
            element.addEventListener(eventType, handler);
            console.log(`Gestionnaire ${eventType} attaché à ${element.id || 'un élément'}`);
        }
    }
    
    // Gestionnaire pour afficher le formulaire d'inscription
    addSafeEventListener(showRegisterFormBtn, 'click', function() {
        loginForm.classList.add('d-none');
        registerForm.classList.remove('d-none');
    });

    // Gestionnaire pour revenir au formulaire de connexion
    addSafeEventListener(showLoginFormBtn, 'click', function() {
        registerForm.classList.add('d-none');
        loginForm.classList.remove('d-none');
    });

    // Afficher le formulaire de mot de passe oublié
    if (forgotPasswordLink) {
        addSafeEventListener(forgotPasswordLink, 'click', function(e) {
            e.preventDefault();
            loginForm.classList.add('d-none');
            forgotPasswordForm.classList.remove('d-none');
        });
    }

    // Retour au formulaire de connexion
    if (backToLoginBtn) {
        addSafeEventListener(backToLoginBtn, 'click', function() {
            forgotPasswordForm.classList.add('d-none');
            loginForm.classList.remove('d-none');
            // Réinitialiser les messages
            forgotPasswordError.classList.add('d-none');
            forgotPasswordSuccess.classList.add('d-none');
        });
    }

    // Gestionnaire pour le mot de passe oublié
    if (resetPasswordBtn) {
        addSafeEventListener(resetPasswordBtn, 'click', async function() {
            const email = document.getElementById('resetEmail').value;
            
            if (!email) {
                forgotPasswordError.textContent = 'Veuillez entrer votre email';
                forgotPasswordError.classList.remove('d-none');
                forgotPasswordSuccess.classList.add('d-none');
                return;
            }

            try {
                await sendPasswordResetEmail(auth, email);
                forgotPasswordSuccess.textContent = 'Un email de réinitialisation a été envoyé à ' + email;
                forgotPasswordSuccess.classList.remove('d-none');
                forgotPasswordError.classList.add('d-none');
                
                // Retour automatique au formulaire de connexion après 3 secondes
                setTimeout(() => {
                    forgotPasswordForm.classList.add('d-none');
                    loginForm.classList.remove('d-none');
                }, 3000);
            } catch (error) {
                forgotPasswordError.textContent = 'Erreur : ' + error.message;
                forgotPasswordError.classList.remove('d-none');
                forgotPasswordSuccess.classList.add('d-none');
            }
        });
    }

    // Gestion de l'inscription
    if (registerBtn) {
        addSafeEventListener(registerBtn, 'click', async function() {
            const name = document.getElementById('registerName').value;
            const email = document.getElementById('registerEmail').value;
            const password = document.getElementById('registerPassword').value;
            const confirmPassword = document.getElementById('confirmPassword').value;
            const termsCheck = document.getElementById('termsCheck').checked;
            
            // Validation
            if (!name || !email || !password || !confirmPassword) {
                registerError.textContent = 'Veuillez remplir tous les champs';
                registerError.classList.remove('d-none');
                return;
            }
            
            if (password !== confirmPassword) {
                registerError.textContent = 'Les mots de passe ne correspondent pas';
                registerError.classList.remove('d-none');
                return;
            }
            
            if (!termsCheck) {
                registerError.textContent = "Vous devez accepter les conditions d'utilisation";
                registerError.classList.remove('d-none');
                return;
            }

            try {
                // Création du compte utilisateur
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                
                // Ajouter les informations dans Firestore
                await setDoc(doc(db, 'users', user.uid), {
                    name: name,
                    email: email,
                    createdAt: serverTimestamp(),
                    status: 'active',
                    role: 'vendor'
                });

                // Redirection vers le tableau de bord
                window.location.href = 'dashboard.html';
            } catch (error) {
                registerError.textContent = "Erreur d'inscription: " + error.message;
                registerError.classList.remove('d-none');
            }
        });
    }

    // Connexion
    if (loginBtn) {
        addSafeEventListener(loginBtn, 'click', function() {
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const rememberMe = document.getElementById('rememberMe').checked;
            
            // Validation basique
            if (!email || !password) {
                loginError.textContent = 'Veuillez remplir tous les champs';
                loginError.classList.remove('d-none');
                return;
            }
            
            // Définir la persistance en fonction de "Se souvenir de moi"
            const persistence = rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION;
            
            firebase.auth().setPersistence(persistence)
                .then(() => {
                    // Connexion avec email/mot de passe
                    return firebase.auth().signInWithEmailAndPassword(email, password);
                })
                .then((userCredential) => {
                    // Connexion réussie, redirection vers le dashboard
                    window.location.href = 'dashboard.html';
                })
                .catch((error) => {
                    // Gestion des erreurs
                    let errorMessage;
                    switch (error.code) {
                        case 'auth/user-not-found':
                            errorMessage = 'Aucun compte ne correspond à cet email';
                            break;
                        case 'auth/wrong-password':
                            errorMessage = 'Mot de passe incorrect';
                            break;
                        case 'auth/invalid-email':
                            errorMessage = 'Format d\'email invalide';
                            break;
                        case 'auth/user-disabled':
                            errorMessage = 'Ce compte a été désactivé';
                            break;
                        default:
                            errorMessage = 'Erreur de connexion: ' + error.message;
                    }
                    loginError.textContent = errorMessage;
                    loginError.classList.remove('d-none');
                });
        });
    }
});
