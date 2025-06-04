// Script pour la page d'achat de forfait WiFi spécifique - FastNetLite

// Importations Firebase nécessaires
import { collection, doc, getDoc, getDocs, query, where, addDoc, updateDoc, serverTimestamp, limit } from 'firebase/firestore';

// Import des variables Firebase depuis le fichier de configuration
import { db, auth, storage } from './firebase-config.js';

// FedaPay est chargé via CDN dans le fichier HTML
// Pas besoin d'import car il est disponible globalement

// Variables globales pour éviter les initialisations multiples
window.profilBuyCodeJsInitialized = window.profilBuyCodeJsInitialized || false;
window.fedaPayInitialized = window.fedaPayInitialized || false;

/**
 * Initialise FedaPay avec la clé publique
 * Cette fonction doit être appelée une seule fois au chargement de la page
 * @param {string} publicKey - La clé publique FedaPay (doit commencer par pk_)
 */
function initializeFedaPay(publicKey) {
    if (window.fedaPayInitialized) {
        console.log('FedaPay déjà initialisé');
        return;
    }
    
    if (!publicKey || !publicKey.startsWith('pk_')) {
        console.error('Clé publique FedaPay invalide:', publicKey);
        throw new Error('Clé publique FedaPay invalide. La clé doit commencer par pk_');
    }
    
    try {
        // Assurons-nous que l'objet FedaPay est disponible
        if (typeof window.FedaPay === 'undefined') {
            console.error('L\'objet FedaPay n\'est pas défini. Vérifiez que le script FedaPay est bien chargé.');
            throw new Error('L\'objet FedaPay n\'est pas disponible. Vérifiez que le script FedaPay est bien chargé.');
        }
        
        console.log('Initialisation de FedaPay avec la clé publique:', publicKey.substring(0, 4) + '...' + publicKey.substring(publicKey.length - 4));
        
        // Selon la documentation officielle de FedaPay
        // https://docs.fedapay.com/api/?javascript#initialisation
        try {
            window.FedaPay.init({
                public_key: publicKey
            });
            window.fedaPayInitialized = true;
            console.log('FedaPay initialisé avec succès');
        } catch (initError) {
            console.error('Erreur spécifique lors de l\'initialisation de FedaPay:', initError);
            // Essayons une autre approche si la première échoue
            console.log('Tentative alternative d\'initialisation...');
            window.FedaPay.setApiKey(publicKey);
            window.fedaPayInitialized = true;
            console.log('FedaPay initialisé avec succès via setApiKey');
        }
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de FedaPay:', error);
        throw error;
    }
}

/**
 * Ajoute un écouteur d'événement de manière sécurisée en vérifiant d'abord si l'élément existe
 * et si un gestionnaire n'a pas déjà été attaché
 * @param {HTMLElement|string} element - Élément DOM ou ID de l'élément
 * @param {string} eventType - Type d'événement (ex: 'click')
 * @param {Function} callback - Fonction de rappel à exécuter
 */
function addSafeEventListener(element, eventType, callback) {
    if (typeof element === 'string') {
        element = document.getElementById(element);
    }
    if (element && !element.getAttribute(`data-${eventType}-handler-attached`)) {
        // Marquer l'élément pour éviter d'attacher plusieurs gestionnaires
        element.setAttribute(`data-${eventType}-handler-attached`, 'true');
        element.addEventListener(eventType, callback);
        console.log(`Gestionnaire ${eventType} attaché à ${element.id || 'un élément'}`);
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si le script a déjà été initialisé
    if (window.profilBuyCodeJsInitialized) {
        console.log('profilbuy-code.js déjà initialisé, initialisation ignorée');
        return;
    }
    
    // Vérifier si le script FedaPay est bien chargé
    if (typeof window.FedaPay === 'undefined') {
        console.error('Le script FedaPay n\'est pas chargé. Chargement dynamique...');
        
        // Charger dynamiquement le script FedaPay
        const fedaPayScript = document.createElement('script');
        fedaPayScript.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7';
        fedaPayScript.async = true;
        fedaPayScript.onload = function() {
            console.log('Script FedaPay chargé avec succès');
            initializeApp();
        };
        fedaPayScript.onerror = function() {
            console.error('Erreur lors du chargement du script FedaPay');
            showError('Erreur lors du chargement du module de paiement. Veuillez recharger la page ou contacter l\'administrateur.');
        };
        document.head.appendChild(fedaPayScript);
    } else {
        console.log('Script FedaPay déjà chargé');
        initializeApp();
    }
    
    // Fonction d'initialisation de l'application
    function initializeApp() {
        // Marquer le script comme initialisé
        window.profilBuyCodeJsInitialized = true;
        console.log('Initialisation de profilbuy-code.js');
        
        // Récupérer les paramètres depuis l'URL
        const urlParams = new URLSearchParams(window.location.search);
        const routerId = urlParams.get('routerId');
        const profileId = urlParams.get('profileId');
        
        // Vérifier si les paramètres nécessaires sont présents
        if (!routerId || !profileId) {
            showError('Paramètres manquants. Veuillez accéder à cette page depuis le lien fourni par votre fournisseur WiFi.');
            console.error('Paramètres routerId ou profileId manquants dans l\'URL');
            return;
        }
        
        console.log('ID du routeur récupéré:', routerId);
        console.log('ID du profil récupéré:', profileId);
        
        // Initialiser la page
        initPage(routerId, profileId);
        
        // Configurer les gestionnaires d'événements
        setupEventHandlers(routerId, profileId);
    }
});

/**
 * Initialiser la page
 * @param {string} routerId - ID du routeur
 * @param {string} profileId - ID du profil
 */
function initPage(routerId, profileId) {
    // Charger les informations du routeur
    loadRouterInfo(routerId);
    
    // Charger les informations du profil
    loadProfileInfo(profileId);
    
    // Charger les paramètres avancés
    loadAdvancedSettings(routerId);
    
    // Charger les styles personnalisés
    loadCustomStyles(routerId);
}

/**
 * Charger les informations du routeur
 * @param {string} routerId - ID du routeur
 */
function loadRouterInfo(routerId) {
    // Récupérer les informations du routeur
    const routerDocRef = doc(db, 'routers', routerId);
    getDoc(routerDocRef)
        .then((doc) => {
            if (doc.exists()) {
                const router = doc.data();
                
                // Mettre à jour le titre de la page
                document.title = `${router.buyPageTitle || router.name} - Achat de forfait WiFi`;
                
                // Mettre à jour l'en-tête
                document.getElementById('routerName').textContent = router.buyPageTitle || router.name;
                document.getElementById('routerDescription').textContent = router.buyPageDescription || router.description || 'Complétez vos informations pour acheter ce forfait';
                
                // Stocker les informations du routeur
                window.routerInfo = router;
                
                // Initialiser FedaPay avec la clé publique du routeur
                if (router.fedapayApiKey) {
                    try {
                        // Initialiser FedaPay une seule fois au chargement de la page
                        initializeFedaPay(router.fedapayApiKey);
                    } catch (error) {
                        console.error('Erreur lors de l\'initialisation de FedaPay:', error);
                        showError('Erreur de configuration du paiement. Veuillez contacter l\'administrateur.');
                    }
                } else {
                    console.error('Clé API FedaPay non configurée pour ce routeur:', routerId);
                }
            } else {
                console.error('Routeur non trouvé:', routerId);
                showError('Routeur non trouvé. Veuillez vérifier le lien et réessayer.');
            }
        })
        .catch((error) => {
            console.error('Erreur lors de la récupération des informations du routeur:', error);
            showError('Une erreur est survenue lors du chargement des informations. Veuillez réessayer plus tard.');
        });
}

/**
 * Charger les informations du profil
 * @param {string} profileId - ID du profil
 */
function loadProfileInfo(profileId) {
    // Récupérer les informations du profil
    const profileDocRef = doc(db, 'profiles', profileId);
    getDoc(profileDocRef)
        .then((doc) => {
            if (doc.exists()) {
                const profile = doc.data();
                
                // Vérifier si le profil est activé
                if (profile.enabled === false) {
                    console.error('Profil désactivé:', profileId);
                    showError('Ce forfait n\'est plus disponible. Veuillez en choisir un autre.');
                    return;
                }
                
                // Mettre à jour les informations du profil dans la page
                document.getElementById('profileName').textContent = profile.name || 'Forfait sans nom';
                document.getElementById('profilePrice').textContent = `${profile.price || 0} FCFA`;
                document.getElementById('profileDuration').textContent = profile.duration || 'Non spécifiée';
                document.getElementById('profileSpeed').textContent = profile.speed || 'Non spécifié';
                document.getElementById('profileDescription').textContent = profile.description || 'Aucune description disponible';
                
                // Stocker les informations du profil
                window.profileInfo = profile;
            } else {
                console.error('Profil non trouvé:', profileId);
                showError('Forfait non trouvé. Veuillez vérifier le lien et réessayer.');
            }
        })
        .catch((error) => {
            console.error('Erreur lors de la récupération des informations du profil:', error);
            showError('Une erreur est survenue lors du chargement des informations. Veuillez réessayer plus tard.');
        });
}

/**
 * Charger les styles personnalisés
 * @param {string} routerId - ID du routeur
 */
function loadCustomStyles(routerId) {
    // Récupérer les paramètres d'apparence
    const appearanceDocRef = doc(db, 'routers', routerId, 'settings', 'appearance');
    getDoc(appearanceDocRef)
        .then((doc) => {
            // Vérifier si le document existe ET contient des données
            if (doc.exists() && doc.data()) {
                const appearance = doc.data();
                console.log('Paramètres d\'apparence chargés:', appearance);
                
                // Créer les styles personnalisés
                let customStyles = '';
                
                // Vérifier si primaryColor existe avant de l'utiliser
                if (appearance && appearance.primaryColor) {
                    customStyles += `
                        :root {
                            --primary-color: ${appearance.primaryColor};
                        }
                        .btn-primary {
                            background-color: ${appearance.primaryColor};
                            border-color: ${appearance.primaryColor};
                        }
                        .btn-outline-primary {
                            color: ${appearance.primaryColor};
                            border-color: ${appearance.primaryColor};
                        }
                        .btn-outline-primary:hover {
                            background-color: ${appearance.primaryColor};
                            border-color: ${appearance.primaryColor};
                        }
                        .profile-card-header {
                            background-color: ${appearance.primaryColor};
                        }
                    `;
                }
                // Utiliser une couleur par défaut si primaryColor n'est pas défini
                else {
                    customStyles += `
                        :root {
                            --primary-color: #007bff;
                        }
                    `;
                }
                
                if (appearance.secondaryColor) {
                    customStyles += `
                        :root {
                            --secondary-color: ${appearance.secondaryColor};
                        }
                        .text-secondary {
                            color: ${appearance.secondaryColor} !important;
                        }
                    `;
                }
                
                if (appearance.customCSS) {
                    customStyles += appearance.customCSS;
                }
                
                // Appliquer les styles personnalisés
                document.getElementById('dynamicStyles').textContent = customStyles;
            } else {
                console.log('Aucun paramètre d\'apparence trouvé, utilisation des styles par défaut');
            }
        })
        .catch((error) => {
            console.error('Erreur lors de la récupération des styles personnalisés:', error);
        });
}

/**
 * Charger les paramètres avancés
 * @param {string} routerId - ID du routeur
 */
function loadAdvancedSettings(routerId) {
    // Récupérer les paramètres avancés
    const advancedDocRef = doc(db, 'routers', routerId, 'settings', 'advanced');
    getDoc(advancedDocRef)
        .then((doc) => {
            // Vérifier si le document existe ET contient des données
            if (doc.exists() && doc.data()) {
                const advanced = doc.data();
                console.log('Paramètres avancés chargés:', advanced);
                
                // Stocker les paramètres avancés
                window.advancedSettings = advanced;
                
                // Configurer les champs de collecte de données
                setupDataCollectionFields(advanced);
            } else {
                // Utiliser des paramètres par défaut si le document n'existe pas
                console.log('Document de paramètres avancés non trouvé, utilisation des valeurs par défaut');
                const defaultAdvanced = {
                    collectClientName: true,
                    collectClientPhone: true,
                    requireClientPhone: true,
                    collectClientEmail: false,
                    requireClientEmail: false
                };
                window.advancedSettings = defaultAdvanced;
                setupDataCollectionFields(defaultAdvanced);
            }
        })
        .catch((error) => {
            console.error('Erreur lors de la récupération des paramètres avancés:', error);
            // En cas d'erreur, utiliser des paramètres par défaut
            const defaultAdvanced = {
                collectClientName: true,
                collectClientPhone: true,
                requireClientPhone: true,
                collectClientEmail: false,
                requireClientEmail: false
            };
            window.advancedSettings = defaultAdvanced;
            setupDataCollectionFields(defaultAdvanced);
        });
}

/**
 * Configurer les champs de collecte de données
 * @param {Object} advancedSettings - Paramètres avancés
 */
function setupDataCollectionFields(advancedSettings) {
    console.log('Configuration des champs de collecte avec les paramètres:', advancedSettings);
    
    // Vérifier si advancedSettings est défini
    if (!advancedSettings) {
        console.warn('advancedSettings est undefined, utilisation des valeurs par défaut');
        advancedSettings = {
            collectClientName: true,
            collectClientPhone: true,
            requireClientPhone: true,
            collectClientEmail: false,
            requireClientEmail: false
        };
    }
    
    // Champ de nom - par défaut visible sauf si explicitement désactivé
    const nameField = document.getElementById('nameFieldContainer');
    if (nameField) {
        if (advancedSettings.collectClientName === false) {
            nameField.classList.add('d-none');
        } else {
            nameField.classList.remove('d-none');
        }
    } else {
        console.warn('L\'élément nameFieldContainer n\'a pas été trouvé');
    }
    
    // Champ de téléphone - par défaut visible sauf si explicitement désactivé
    const phoneField = document.getElementById('phoneFieldContainer');
    const phoneInput = document.getElementById('clientPhone');
    
    if (phoneField && phoneInput) {
        if (advancedSettings.collectClientPhone === false) {
            phoneField.classList.add('d-none');
        } else {
            phoneField.classList.remove('d-none');
            if (advancedSettings.requireClientPhone === true) {
                phoneInput.required = true;
            } else {
                phoneInput.required = false;
            }
        }
    } else {
        console.warn('L\'élément phoneFieldContainer ou clientPhone n\'a pas été trouvé');
    }
    
    // Champ d'email - par défaut caché sauf si explicitement activé
    const emailField = document.getElementById('emailFieldContainer');
    const emailInput = document.getElementById('clientEmail');
    
    if (emailField && emailInput) {
        if (advancedSettings.collectClientEmail === true) {
            emailField.classList.remove('d-none');
            if (advancedSettings.requireClientEmail === true) {
                emailInput.required = true;
            } else {
                emailInput.required = false;
            }
        } else {
            emailField.classList.add('d-none');
        }
    } else {
        console.warn('L\'élément emailFieldContainer ou clientEmail n\'a pas été trouvé');
    }
}

/**
 * Configurer les gestionnaires d'événements
 * @param {string} routerId - ID du routeur
 * @param {string} profileId - ID du profil
 */
function setupEventHandlers(routerId, profileId) {
    // Gestionnaire pour le bouton d'achat
    addSafeEventListener('buyButton', 'click', function() {
        handleBuyButtonClick(routerId, profileId);
    });
}

/**
 * Gérer le clic sur le bouton d'achat
 * @param {string} routerId - ID du routeur
 * @param {string} profileId - ID du profil
 */
async function handleBuyButtonClick(routerId, profileId) {
    console.log('Clic sur le bouton d\'achat');
    
    // Vérifier si les informations nécessaires sont disponibles
    if (!window.routerInfo || !window.profileInfo) {
        showError('Informations incomplètes. Veuillez rafraîchir la page et réessayer.');
        return;
    }
    
    // Récupérer les valeurs du formulaire
    const clientName = document.getElementById('clientName').value.trim();
    const clientPhone = document.getElementById('clientPhone').value.trim();
    const clientEmail = document.getElementById('clientEmail').value.trim();
    
    // Stocker les informations du client dans des variables globales pour les utiliser plus tard
    window.clientName = clientName;
    window.clientPhone = clientPhone;
    window.clientEmail = clientEmail;
    
    console.log('Informations client récupérées:', { clientName, clientPhone, clientEmail });
    
    // Valider les champs requis
    let isValid = true;
    let errorMessage = '';
    
    // Validation du nom si requis
    if (window.advancedSettings && window.advancedSettings.collectClientName !== false && clientName === '') {
        isValid = false;
        errorMessage = 'Veuillez entrer votre nom.';
    }
    
    // Validation du téléphone si requis
    if (window.advancedSettings && window.advancedSettings.collectClientPhone !== false) {
        if (clientPhone === '') {
            isValid = false;
            errorMessage = 'Veuillez entrer votre numéro WhatsApp.';
        } else if (!/^\d{8,15}$/.test(clientPhone.replace(/\D/g, ''))) {
            isValid = false;
            errorMessage = 'Veuillez entrer un numéro WhatsApp valide.';
        }
    }
    
    // Validation de l'email si requis
    if (window.advancedSettings && window.advancedSettings.collectClientEmail === true) {
        if (window.advancedSettings.requireClientEmail === true && clientEmail === '') {
            isValid = false;
            errorMessage = 'Veuillez entrer votre email.';
        } else if (clientEmail !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail)) {
            isValid = false;
            errorMessage = 'Veuillez entrer un email valide.';
        }
    }
    
    // Si le formulaire n'est pas valide, afficher l'erreur
    if (!isValid) {
        showError(errorMessage);
        return;
    }
    
    // Afficher le modal de chargement
    const loadingModal = new bootstrap.Modal(document.getElementById('loadingModal'));
    loadingModal.show();
    
    try {
        // Rechercher ou créer le client
        const clientId = await findOrCreateClient(routerId, clientName, clientPhone, clientEmail);
        console.log('Client ID:', clientId);
        
        // Créer un paiement en attente
        const paymentId = await createPendingPayment(routerId, profileId, clientId, clientName, clientPhone);
        console.log('Paiement ID:', paymentId);
        
        // Initialiser FedaPay et traiter le paiement
        await initiateFedaPayPayment(routerId, profileId, paymentId, clientName);
        
        // Fermer le modal de chargement (sera géré par FedaPay callback)
        loadingModal.hide();
    } catch (error) {
        console.error('Erreur lors du processus d\'achat:', error);
        
        // Fermer le modal de chargement
        loadingModal.hide();
        
        // Afficher l'erreur
        showError('Une erreur est survenue lors du traitement de votre achat. Veuillez réessayer plus tard.');
    }
}

/**
 * Rechercher un client existant par numéro WhatsApp ou en créer un nouveau
 * @param {string} routerId - ID du routeur
 * @param {string} clientName - Nom du client
 * @param {string} clientPhone - Numéro WhatsApp du client
 * @param {string} clientEmail - Email du client (optionnel)
 * @returns {Promise<string>} - ID du client
 */
async function findOrCreateClient(routerId, clientName, clientPhone, clientEmail) {
    try {
        // Rechercher un client existant avec ce numéro WhatsApp
        const clientsCollection = collection(db, 'clients');
        const clientQuery = query(clientsCollection, where('whatsapp', '==', clientPhone), where('routerId', '==', routerId), limit(1));
        const querySnapshot = await getDocs(clientQuery);
        
        // Si un client existe déjà, retourner son ID
        if (!querySnapshot.empty) {
            const clientDoc = querySnapshot.docs[0];
            const clientData = clientDoc.data();
            console.log('Client existant trouvé:', clientData);
            
            // Mettre à jour la dernière activité du client
            await updateDoc(doc(db, 'clients', clientDoc.id), {
                lastActivity: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
            
            return clientDoc.id;
        }
        
        // Sinon, créer un nouveau client
        const newClientData = {
            name: clientName,
            whatsapp: clientPhone,
            email: clientEmail || '',
            routerId: routerId,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            lastActivity: serverTimestamp(),
            purchasedCodes: 0,
            totalSpent: 0,
            note: ''
        };
        
        const newClientRef = await addDoc(clientsCollection, newClientData);
        console.log('Nouveau client créé avec ID:', newClientRef.id);
        
        return newClientRef.id;
    } catch (error) {
        console.error('Erreur lors de la recherche/création du client:', error);
        throw error;
    }
}

/**
 * Créer un paiement en attente dans la collection payments
 * @param {string} routerId - ID du routeur
 * @param {string} profileId - ID du profil
 * @param {string} clientId - ID du client
 * @param {string} clientName - Nom du client
 * @param {string} clientPhone - Numéro WhatsApp du client
 * @returns {Promise<string>} - ID du paiement
 */
async function createPendingPayment(routerId, profileId, clientId, clientName, clientPhone) {
    try {
        // Préparer les données du paiement
        const paymentData = {
            amount: window.profileInfo.price,
            clientId: clientId,
            clientName: clientName || clientPhone,
            clientPhone: clientPhone, // Stocker le numéro de téléphone pour l'utiliser dans initiateFedaPayPayment
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
            method: 'fedapay',
            note: '',
            profileId: profileId,
            profileName: `${window.profileInfo.name} - ${window.profileInfo.price} FCFA`,
            routerId: routerId,
            status: 'pending'
        };
        
        // Créer le document de paiement
        const paymentsCollection = collection(db, 'payments');
        const paymentRef = await addDoc(paymentsCollection, paymentData);
        console.log('Paiement en attente créé avec ID:', paymentRef.id);
        
        return paymentRef.id;
    } catch (error) {
        console.error('Erreur lors de la création du paiement:', error);
        throw error;
    }
}

/**
 * Initialiser FedaPay et traiter le paiement
 * @param {string} routerId - ID du routeur
 * @param {string} profileId - ID du profil
 * @param {string} paymentId - ID du paiement
 * @param {string} clientName - Nom du client
 */
async function initiateFedaPayPayment(routerId, profileId, paymentId, clientName) {
    try {
        // Vérifier que FedaPay a bien été initialisé
        if (!window.fedaPayInitialized) {
            console.error('FedaPay n\'a pas été initialisé. Impossible de procéder au paiement.');
            throw new Error('Configuration de paiement non initialisée. Veuillez recharger la page et réessayer.');
        }
        
        // Récupérer les informations du paiement pour obtenir le numéro de téléphone du client
        const paymentDoc = await getDoc(doc(db, 'payments', paymentId));
        if (!paymentDoc.exists()) {
            throw new Error('Paiement non trouvé');
        }
        const paymentData = paymentDoc.data();
        const clientPhone = paymentData.clientPhone || '';
        
        console.log('Informations de paiement récupérées:', { paymentId, clientName, clientPhone });
        
        // Récupérer l'email du propriétaire du routeur
        const userId = window.routerInfo.userId;
        const userDoc = await getDoc(doc(db, 'users', userId));
        if (!userDoc.exists()) {
            throw new Error('Utilisateur non trouvé');
        }
        const userEmail = userDoc.data().email || 'contact@fastnetlite.com';
        
        // Selon la documentation officielle de FedaPay Checkout.js
        // (https://docs.fedapay.com/introduction/fr/checkoutjs-fr)
        // nous devons créer une transaction, puis utiliser l'ID de cette transaction
        // pour ouvrir la fenêtre de paiement.
        
        try {
            // Récupérer la clé API FedaPay du routeur
            const fedapayApiKey = window.routerInfo.fedapayApiKey;
            if (!fedapayApiKey) {
                throw new Error('Clé API FedaPay non configurée pour ce routeur');
            }
            
            console.log('Réinitialisation de FedaPay avec la clé publique:', fedapayApiKey.substring(0, 4) + '...' + fedapayApiKey.substring(fedapayApiKey.length - 4));
            
            // Mettre à jour le paiement pour indiquer que nous allons ouvrir la fenêtre de paiement
            await updateDoc(doc(db, 'payments', paymentId), {
                status: 'processing',
                updatedAt: serverTimestamp()
            });
            
            // Créer un bouton temporaire invisible pour déclencher FedaPay
            const tempButtonId = 'temp-fedapay-button-' + Date.now();
            const tempButton = document.createElement('button');
            tempButton.id = tempButtonId;
            tempButton.style.display = 'none';
            document.body.appendChild(tempButton);
            
            // Configuration des données de transaction
            const fedaPayConfig = {
                public_key: fedapayApiKey,
                transaction: {
                    amount: window.profileInfo.price,
                    description: window.profileInfo.description || `Achat de forfait ${window.profileInfo.name}`,
                    currency: {
                        iso: 'XOF'
                    }
                },
                customer: {
                    email: userEmail || 'client@fastnetlite.com',
                    firstname: clientName.split(' ')[0] || 'Client',
                    lastname: clientName.split(' ').slice(1).join(' ') || 'FastNetLite',
                    phone_number: {
                        number: typeof clientPhone === 'string' ? clientPhone.replace(/\D/g, '') : '',
                        country: 'BJ' // Code pays par défaut (Benin)
                    }
                },
                onComplete: function(response) {
                    console.log('Callback onComplete de FedaPay reçu:', response);
                    // Supprimer le bouton temporaire
                    if (document.getElementById(tempButtonId)) {
                        document.getElementById(tempButtonId).remove();
                    }
                    
                    // Vérifier si le paiement a été annulé ou refusé
                    if (response && response.reason === 'DIALOG DISMISSED') {
                        console.log('Paiement FedaPay annulé par l\'utilisateur');
                        updateDoc(doc(db, 'payments', paymentId), {
                            status: 'cancelled',
                            updatedAt: serverTimestamp(),
                            note: 'Paiement annulé par l\'utilisateur'
                        }).catch(err => {
                            console.error('Erreur lors de la mise à jour du statut du paiement:', err);
                        });
                        return;
                    }
                    
                    // Vérifier que la réponse contient bien un ID de transaction et que le statut est approved
                    if (response && response.transaction && response.transaction.id && 
                        response.transaction.status === 'approved') {
                        console.log('Transaction FedaPay validée avec ID:', response.transaction.id, 'et statut:', response.transaction.status);
                        
                        // Mettre à jour le statut du paiement comme complété
                        updateDoc(doc(db, 'payments', paymentId), {
                            status: 'completed',
                            transactionId: response.transaction.id,
                            updatedAt: serverTimestamp()
                        }).then(() => {
                            // Chercher un code WiFi disponible uniquement après confirmation du paiement
                            return getAvailableWifiCode(routerId, profileId);
                        }).then(wifiCode => {
                            if (wifiCode) {
                                console.log('Code WiFi trouvé:', wifiCode.id, 'avec username:', wifiCode.username);
                                // Mettre à jour le paiement avec le code WiFi
                                return updateDoc(doc(db, 'payments', paymentId), {
                                    code: wifiCode.id,
                                    updatedAt: serverTimestamp()
                                }).then(() => {
                                    // Marquer le code comme utilisé
                                    return updateDoc(doc(db, 'wifiCodes', wifiCode.id), {
                                        status: 'used',
                                        usedAt: serverTimestamp(),
                                        paymentId: paymentId,
                                        updatedAt: serverTimestamp()
                                    }).then(() => {
                                        // Afficher le code WiFi dans un modal
                                        displayWifiCode(wifiCode.username, wifiCode.password, wifiCode.validUntil);
                                    });
                                });
                            } else {
                                console.error('Aucun code WiFi disponible pour le profil:', profileId);
                                showError('Aucun code WiFi disponible pour ce profil. Veuillez contacter l\'administrateur.');
                            }
                        }).catch(error => {
                            console.error('Erreur lors du traitement du paiement réussi:', error);
                            showError('Une erreur est survenue lors de la finalisation de votre achat. Veuillez contacter l\'administrateur.');
                        });
                    } else {
                        console.error('Transaction FedaPay non approuvée ou invalide:', response);
                        
                        // Mettre à jour le statut du paiement en cas d'échec
                        let errorMessage = 'Transaction non approuvée';
                        let status = 'failed';
                        
                        if (response && response.transaction) {
                            if (response.transaction.status) {
                                errorMessage = `Transaction avec statut: ${response.transaction.status}`;
                            }
                            if (response.transaction.last_error_code) {
                                errorMessage += ` (Code erreur: ${response.transaction.last_error_code})`;
                            }
                        }
                        
                        updateDoc(doc(db, 'payments', paymentId), {
                            status: status,
                            updatedAt: serverTimestamp(),
                            errorMessage: errorMessage
                        }).catch(err => {
                            console.error('Erreur lors de la mise à jour du statut du paiement:', err);
                        });
                        
                        showError('Le paiement n\'a pas été approuvé. Veuillez réessayer ou contacter l\'administrateur.');
                    }
                },
                onError: function(error) {
                    console.error('Erreur FedaPay:', error);
                    
                    // Mettre à jour le statut du paiement en cas d'erreur
                    updateDoc(doc(db, 'payments', paymentId), {
                        status: 'failed',
                        updatedAt: serverTimestamp(),
                        errorMessage: error ? JSON.stringify(error) : 'Erreur inconnue'
                    }).catch(err => {
                        console.error('Erreur lors de la mise à jour du statut du paiement:', err);
                    });
                    
                    showError('Une erreur est survenue lors du paiement. Veuillez réessayer plus tard.');
                    
                    // Supprimer le bouton temporaire
                    if (document.getElementById(tempButtonId)) {
                        document.getElementById(tempButtonId).remove();
                    }
                },
                onClose: function() {
                    console.log('Paiement FedaPay fermé');
                    
                    // Mettre à jour le statut du paiement en cas de fermeture sans complétion
                    updateDoc(doc(db, 'payments', paymentId), {
                        status: 'cancelled',
                        updatedAt: serverTimestamp()
                    }).catch(err => {
                        console.error('Erreur lors de la mise à jour du statut du paiement:', err);
                    });
                    
                    // Supprimer le bouton temporaire
                    if (document.getElementById(tempButtonId)) {
                        document.getElementById(tempButtonId).remove();
                    }
                }
            };
            
            console.log('Initialisation de FedaPay avec la configuration:', JSON.stringify(fedaPayConfig, null, 2));
            
            // Initialiser FedaPay avec le bouton temporaire selon la documentation officielle
            const widget = window.FedaPay.init('#' + tempButtonId, fedaPayConfig);
            
            // Déclencher le clic sur le bouton temporaire
            console.log('Déclenchement du paiement FedaPay...');
            tempButton.click();
        } catch (error) {
            console.error('Erreur lors de la création de la transaction FedaPay:', error);
            throw new Error('Impossible de créer la transaction FedaPay. Veuillez réessayer plus tard.');
        }
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de FedaPay:', error);
        throw error;
    }
}

// La fonction handleSuccessfulPayment a été intégrée directement dans le callback onComplete de FedaPay

/**
 * Récupérer un code WiFi disponible pour un profil
 * @param {string} routerId - ID du routeur
 * @param {string} profileId - ID du profil
 * @returns {Promise<Object|null>} - Code WiFi disponible ou null
 */
async function getAvailableWifiCode(routerId, profileId) {
    try {
        console.log('Recherche d\'un code WiFi disponible pour routerId:', routerId, 'et profileId:', profileId);
        
        // Vérifier que les IDs sont valides
        if (!routerId || !profileId) {
            console.error('routerId ou profileId invalide:', { routerId, profileId });
            return null;
        }
        
        // Rechercher un code disponible
        const codesCollection = collection(db, 'wifiCodes');
        const codeQuery = query(
            codesCollection, 
            where('routerId', '==', routerId),
            where('profileId', '==', profileId),
            where('status', '==', 'available'),
            limit(1)
        );
        
        console.log('Exécution de la requête Firestore pour trouver un code disponible...');
        const querySnapshot = await getDocs(codeQuery);
        console.log('Nombre de codes trouvés:', querySnapshot.size);
        
        if (!querySnapshot.empty) {
            const codeDoc = querySnapshot.docs[0];
            const codeData = { id: codeDoc.id, ...codeDoc.data() };
            console.log('Code WiFi disponible trouvé:', codeData.id);
            return codeData;
        }
        
        // Si aucun code n'est trouvé, vérifions s'il y a des codes pour ce profil mais déjà utilisés
        const usedCodesQuery = query(
            codesCollection, 
            where('routerId', '==', routerId),
            where('profileId', '==', profileId),
            limit(1)
        );
        
        const usedCodesSnapshot = await getDocs(usedCodesQuery);
        if (!usedCodesSnapshot.empty) {
            console.log('Des codes existent pour ce profil mais sont déjà utilisés');
        } else {
            console.log('Aucun code n\'existe pour ce profil');
        }
        
        // Vérifions également si les IDs correspondent exactement aux valeurs stockées
        console.log('Vérification des codes avec des requêtes individuelles...');
        const allCodesSnapshot = await getDocs(collection(db, 'wifiCodes'));
        console.log('Nombre total de codes dans la base:', allCodesSnapshot.size);
        
        // Afficher les 5 premiers codes pour débogage
        const sampleCodes = [];
        let i = 0;
        allCodesSnapshot.forEach(doc => {
            if (i < 5) {
                const data = doc.data();
                sampleCodes.push({
                    id: doc.id,
                    routerId: data.routerId,
                    profileId: data.profileId,
                    status: data.status
                });
                i++;
            }
        });
        console.log('Exemple de codes dans la base:', sampleCodes);
        
        return null;
    } catch (error) {
        console.error('Erreur lors de la recherche d\'un code WiFi disponible:', error);
        throw error;
    }
}

/**
 * Afficher le code WiFi dans un modal
 * @param {string} username - Nom d'utilisateur du code WiFi
 * @param {string} password - Mot de passe du code WiFi
 * @param {string|Date} validUntil - Date de validité du code
 */
function displayWifiCode(username, password, validUntil) {
    // Créer le modal s'il n'existe pas déjà
    if (!document.getElementById('wifiCodeModal')) {
        const modalHTML = `
        <div class="modal fade" id="wifiCodeModal" data-bs-backdrop="static" data-bs-keyboard="false" tabindex="-1" aria-labelledby="wifiCodeModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-body text-center py-5">
                        <div class="mb-4">
                            <i class="fas fa-wifi fa-4x mb-3 text-black-50"></i>
                            <h4 class="mb-3" style="font-weight: 500;">Votre code WiFi</h4>
                            <p class="lead mb-4" style="font-weight: 300;">Voici vos informations de connexion</p>
                        </div>
                        <div class="card mb-4">
                            <div class="card-body p-4">
                                <div class="row mb-4">
                                    <div class="col-5 text-end text-muted">Nom d'utilisateur</div>
                                    <div class="col-7 text-start fw-bold" id="wifiUsername"></div>
                                </div>
                                <div class="row mb-4">
                                    <div class="col-5 text-end text-muted">Mot de passe</div>
                                    <div class="col-7 text-start fw-bold" id="wifiPassword"></div>
                                </div>
                                <div class="row">
                                    <div class="col-5 text-end text-muted">Valide jusqu'au</div>
                                    <div class="col-7 text-start" id="wifiValidUntil"></div>
                                </div>
                            </div>
                        </div>
                        <div class="alert alert-danger">
                            <i class="fas fa-exclamation-circle"></i> Veuillez noter ces informations, elles ne seront plus accessibles après la fermeture de cette fenêtre.
                        </div>
                        <div class="mt-4 d-flex justify-content-center gap-3">
                            <button type="button" class="btn btn-primary px-4" id="autoConnectBtn">
                                Connexion automatique
                            </button>
                            <button type="button" class="btn btn-outline-secondary px-4" id="closeCodeBtn">
                                Fermer
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        // Ajouter le modal au document
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);
        
        // Ajouter les gestionnaires d'événements
        document.getElementById('autoConnectBtn').addEventListener('click', function() {
            // Rediriger vers l'URL de connexion du routeur avec les paramètres de connexion
            if (window.routerInfo && window.routerInfo.connectionUrl) {
                // Récupérer les valeurs username et password affichées dans le modal
                const username = document.getElementById('wifiUsername').textContent;
                const password = document.getElementById('wifiPassword').textContent;
                
                // Créer l'URL de connexion avec les paramètres
                const loginUrl = `http://${window.routerInfo.connectionUrl}/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`;
                
                console.log('URL de connexion automatique:', loginUrl);
                window.open(loginUrl, '_blank');
            } else {
                alert('URL de connexion non disponible. Veuillez vous connecter manuellement au réseau WiFi.');
            }
        });
        
        document.getElementById('closeCodeBtn').addEventListener('click', function() {
            const wifiCodeModal = bootstrap.Modal.getInstance(document.getElementById('wifiCodeModal'));
            wifiCodeModal.hide();
            // Recharger la page actuelle au lieu de rediriger
            window.location.reload();
        });
    }
    
    // Formater la date de validité
    let formattedValidUntil = 'Non spécifiée';
    if (validUntil) {
        const validDate = validUntil instanceof Date ? validUntil : new Date(validUntil);
        if (!isNaN(validDate.getTime())) {
            formattedValidUntil = validDate.toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
        }
    }
    
    // Mettre à jour les informations du code
    document.getElementById('wifiUsername').textContent = username || 'Non spécifié';
    document.getElementById('wifiPassword').textContent = password || 'Non spécifié';
    document.getElementById('wifiValidUntil').textContent = formattedValidUntil;
    
    // Afficher le modal
    const wifiCodeModal = new bootstrap.Modal(document.getElementById('wifiCodeModal'));
    wifiCodeModal.show();
}

/**
 * Afficher un message d'erreur
 * @param {string} message - Message d'erreur
 */
function showError(message) {
    // Mettre à jour le message d'erreur
    document.getElementById('errorMessage').textContent = message;
    
    // Afficher le modal d'erreur
    const errorModal = new bootstrap.Modal(document.getElementById('errorModal'));
    errorModal.show();
}

/**
 * Afficher un message de succès
 * @param {string} message - Message de succès
 */
function showSuccess(message) {
    // Mettre à jour le message de succès
    document.getElementById('successMessage').textContent = message;
    
    // Afficher le modal de succès
    const successModal = new bootstrap.Modal(document.getElementById('successModal'));
    successModal.show();
}
