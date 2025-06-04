// Script pour la page d'achat de codes WiFi FastNetLite
// Partie 1: Initialisation et chargement des données

// Importations Firebase nécessaires
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, addDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

// Import des variables Firebase depuis le fichier de configuration
import { db, auth, storage } from './firebase-config.js';

// Log pour vérifier que db est correctement importé
console.log('Firebase DB importé:', db);

// Variable globale pour éviter les initialisations multiples
window.buyCodeJsInitialized = window.buyCodeJsInitialized || false;

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
    if (window.buyCodeJsInitialized) {
        console.log('buy-code.js déjà initialisé, initialisation ignorée');
        return;
    }
    
    // Marquer le script comme initialisé
    window.buyCodeJsInitialized = true;
    console.log('Initialisation de buy-code.js');
    // Récupérer l'ID du routeur depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    // Accepter à la fois 'id' et 'routerId' comme paramètres valides
    const routerId = urlParams.get('id') || urlParams.get('routerId');
    
    // Vérifier si l'ID du routeur est présent
    if (!routerId) {
        showError('ID du routeur manquant. Veuillez accéder à cette page depuis le lien fourni par votre fournisseur WiFi.');
        console.error('Paramètre id ou routerId manquant dans l\'URL');
        return;
    }
    
    console.log('ID du routeur récupéré:', routerId);
    
    // Initialiser la page
    initPage(routerId);
    
    // Configurer les gestionnaires d'événements
    setupEventHandlers(routerId);
});

/**
 * Initialiser la page
 * @param {string} routerId - ID du routeur
 */
function initPage(routerId) {
    // Charger les informations du routeur
    loadRouterInfo(routerId);
    
    // Charger les profils disponibles
    loadProfiles(routerId);
    
    // Charger les paramètres de paiement
    loadPaymentSettings(routerId);
    
    // Charger les paramètres avancés
    loadAdvancedSettings(routerId);
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
                document.title = `${router.buyPageTitle || router.name} - Achat de codes WiFi`;
                
                // Mettre à jour l'en-tête
                document.getElementById('routerName').textContent = router.buyPageTitle || router.name;
                document.getElementById('routerDescription').textContent = router.buyPageDescription || router.description || 'Achetez des codes WiFi pour vous connecter à Internet';
                
                // Charger les styles personnalisés
                loadCustomStyles(routerId);
            } else {
                showError('Routeur non trouvé. Veuillez vérifier le lien et réessayer.');
            }
        })
        .catch((error) => {
            console.error('Erreur lors de la récupération des informations du routeur:', error);
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
                    `;
                }
                
                // Ajouter les styles personnalisés du routeur
                if (appearance.customCss) {
                    customStyles += appearance.customCss;
                }
                
                // Appliquer les styles personnalisés
                document.getElementById('dynamicStyles').textContent = customStyles;
            }
        })
        .catch((error) => {
            console.error('Erreur lors de la récupération des styles personnalisés:', error);
        });
}

/**
 * Charger les profils disponibles
 * @param {string} routerId - ID du routeur
 */
function loadProfiles(routerId) {
    console.log('Début de loadProfiles avec routerId:', routerId);
    
    // Vérifier si les fonctions Firebase sont disponibles
    if (!collection || !query || !where || !getDocs) {
        console.error('Fonctions Firebase non disponibles:', { 
            collection: typeof collection, 
            query: typeof query, 
            where: typeof where, 
            getDocs: typeof getDocs 
        });
        showError('Erreur de configuration: les fonctions Firebase ne sont pas disponibles.');
        document.getElementById('loadingProfiles').classList.add('d-none');
        document.getElementById('noProfilesMessage').classList.remove('d-none');
        return;
    }
    
    try {
        // Référence aux profils du routeur
        console.log('Création de la référence à la collection profiles');
        const profilesCollection = collection(db, 'profiles');
        
        // Vérifier si routerId est valide
        if (!routerId) {
            console.error('routerId est invalide:', routerId);
            showError('ID du routeur invalide. Veuillez vérifier l\'URL.');
            document.getElementById('loadingProfiles').classList.add('d-none');
            document.getElementById('noProfilesMessage').classList.remove('d-none');
            return;
        }
        
        console.log('Création de la requête avec le filtre routerId uniquement');
        // Simplifier la requête pour commencer - juste filtrer par routerId
        const profilesQuery = query(
            profilesCollection,
            where('routerId', '==', routerId)
        );
        
        console.log('Exécution de la requête getDocs pour routerId:', routerId);
        // Récupérer les profils
        getDocs(profilesQuery)
            .then((querySnapshot) => {
                console.log('Résultat de la requête reçu, nombre de documents:', querySnapshot.size);
                
                // Masquer le chargement
                document.getElementById('loadingProfiles').classList.add('d-none');
                
                if (querySnapshot.empty) {
                    console.log('Aucun profil trouvé pour ce routeur');
                    // Aucun profil trouvé
                    document.getElementById('noProfilesMessage').classList.remove('d-none');
                    return;
                }
                
                // Conteneur pour les profils
                const profilesContainer = document.getElementById('profilesContainer');
                console.log('Conteneur des profils récupéré:', profilesContainer);
                
                // Filtrer et ajouter chaque profil
                let validProfilesCount = 0;
                
                querySnapshot.forEach((doc) => {
                    console.log('Traitement du profil avec ID:', doc.id);
                    const profile = doc.data();
                    const profileId = doc.id;
                    
                    console.log('Données du profil:', profile);
                    
                    // Vérifier si le profil est activé et visible sur la page d'achat
                    // Si ces propriétés ne sont pas définies, on considère par défaut que le profil est activé et visible
                    const isEnabled = profile.enabled !== false; // true par défaut si non défini
                    const isVisible = profile.visibleOnBuyPage !== false; // true par défaut si non défini
                    
                    console.log(`Profil ${profileId} - enabled: ${isEnabled}, visibleOnBuyPage: ${isVisible}`);
                    
                    if (isEnabled && isVisible) {
                        validProfilesCount++;
                        // Créer la carte de profil
                        const profileCard = createProfileCard(profileId, profile);
                        
                        // Ajouter la carte au conteneur
                        profilesContainer.appendChild(profileCard);
                        console.log('Carte de profil ajoutée au conteneur');
                    } else {
                        console.log(`Profil ${profileId} ignoré car non activé ou non visible`);
                    }
                });
                
                // Vérifier si des profils valides ont été trouvés
                if (validProfilesCount === 0) {
                    console.log('Aucun profil valide trouvé (activé et visible)');
                    document.getElementById('noProfilesMessage').classList.remove('d-none');
                } else {
                    console.log(`${validProfilesCount} profils valides affichés`);
                }
            })
            .catch((error) => {
                console.error('Erreur lors de la récupération des profils:', error);
                document.getElementById('loadingProfiles').classList.add('d-none');
                document.getElementById('noProfilesMessage').classList.remove('d-none');
                showError('Une erreur est survenue lors du chargement des forfaits. Veuillez réessayer plus tard.');
            });
    } catch (error) {
        console.error('Exception lors de la configuration de la requête:', error);
        document.getElementById('loadingProfiles').classList.add('d-none');
        document.getElementById('noProfilesMessage').classList.remove('d-none');
        showError('Une erreur est survenue lors de la configuration de la requête. Veuillez réessayer plus tard.');
    }
}

/**
 * Créer une carte de profil
 * @param {string} profileId - ID du profil
 * @param {Object} profile - Données du profil
 * @returns {HTMLElement} - Élément HTML de la carte de profil
 */
function createProfileCard(profileId, profile) {
    console.log('Création de la carte pour le profil:', profileId, profile);
    
    // Vérifier si le profil est valide
    if (!profile) {
        console.error('Profil invalide:', profile);
        return document.createElement('div'); // Retourner un div vide
    }
    
    // Extraire les données du profil avec valeurs par défaut
    const name = profile.name || 'Forfait sans nom';
    const price = profile.price || 0;
    const duration = profile.duration || 'Non spécifiée';
    const description = profile.description || 'Aucune description disponible';
    
    // Créer la colonne
    const col = document.createElement('div');
    col.className = 'col-md-4 mb-4'; // Ajout de margin-bottom
    
    // Créer la carte
    const card = document.createElement('div');
    card.className = 'profile-card-buy card h-100';
    card.dataset.profileId = profileId;
    
    // Créer l'en-tête de la carte
    const cardHeader = document.createElement('div');
    cardHeader.className = 'profile-card-header';
    cardHeader.innerHTML = `
        <h5 class="card-title">${name}</h5>
        <div class="profile-card-price">${price} FCFA</div>
    `;
    
    // Créer le corps de la carte
    const cardBody = document.createElement('div');
    cardBody.className = 'profile-card-body';
    
    // Récupérer l'ID du routeur depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const routerId = urlParams.get('id') || urlParams.get('routerId');
    
    cardBody.innerHTML = `
        <div class="profile-card-duration">Durée: ${duration}</div>
        <div class="profile-card-description">${description}</div>
        <div class="d-grid gap-2">
            <a href="profilbuy-code.html?routerId=${routerId}&profileId=${profileId}" class="btn btn-primary">Acheter directement</a>
        </div>
    `;
    
    // Assembler la carte
    card.appendChild(cardHeader);
    card.appendChild(cardBody);
    col.appendChild(card);
    
    // Ajouter le gestionnaire d'événements
    card.addEventListener('click', function() {
        selectProfile(profileId);
    });
    
    console.log('Carte créée avec succès pour le profil:', profileId);
    return col;
}

/**
 * Sélectionner un profil
 * @param {string} profileId - ID du profil
 */
function selectProfile(profileId) {
    // Désélectionner tous les profils
    const profileCards = document.querySelectorAll('.profile-card-buy');
    profileCards.forEach(card => {
        card.classList.remove('selected');
    });
    
    // Sélectionner le profil cliqué
    const selectedCard = document.querySelector(`.profile-card-buy[data-profile-id="${profileId}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    // Stocker l'ID du profil sélectionné
    window.selectedProfileId = profileId;
    
    // Activer le bouton suivant
    document.getElementById('nextStepBtn').disabled = false;
}

/**
 * Afficher un message d'erreur
 * @param {string} message - Message d'erreur
 */
function showError(message) {
    const errorAlert = document.getElementById('errorAlert');
    errorAlert.textContent = message;
    errorAlert.classList.remove('d-none');
    
    // Masquer le message après 10 secondes
    setTimeout(() => {
        errorAlert.classList.add('d-none');
    }, 10000);
}

// Partie 2: Chargement des paramètres de paiement et gestion des étapes

/**
 * Charger les paramètres de paiement
 * @param {string} routerId - ID du routeur
 */
function loadPaymentSettings(routerId) {
    // Récupérer les paramètres de paiement
    const paymentDocRef = doc(db, 'routers', routerId, 'settings', 'payment');
    getDoc(paymentDocRef)
        .then((doc) => {
            if (doc.exists) {
                const payment = doc.data();
                
                // Stocker les paramètres de paiement
                window.paymentSettings = payment;
                
                // Configurer les méthodes de paiement disponibles
                setupPaymentMethods(payment);
                
                // Configurer FedaPay si activé
                if (payment.enableFedapay && payment.fedapayPublicKey) {
                    loadFedapayScript(payment.fedapayPublicKey, payment.fedapayMode);
                }
            }
        })
        .catch((error) => {
            console.error('Erreur lors de la récupération des paramètres de paiement:', error);
        });
}

/**
 * Configurer les méthodes de paiement disponibles
 * @param {Object} paymentSettings - Paramètres de paiement
 */
function setupPaymentMethods(paymentSettings) {
    const container = document.getElementById('paymentMethodsContainer');
    container.innerHTML = '';
    
    // Méthode de paiement en espèces
    if (paymentSettings.acceptCash) {
        const cashMethod = createPaymentMethod(
            'cash',
            'fa-money-bill-wave',
            'Paiement en espèces',
            'Payez lors de la réception de votre code'
        );
        container.appendChild(cashMethod);
    }
    
    // Méthode de paiement Mobile Money
    if (paymentSettings.acceptMobileMoney) {
        const mobileMoneyMethod = createPaymentMethod(
            'mobile_money',
            'fa-mobile-alt',
            'Mobile Money',
            'Payez avec MTN Money, Orange Money, etc.'
        );
        container.appendChild(mobileMoneyMethod);
    }
    
    // Méthode de paiement FedaPay
    if (paymentSettings.acceptFedapay && paymentSettings.enableFedapay) {
        const fedapayMethod = createPaymentMethod(
            'fedapay',
            'fa-credit-card',
            'Carte bancaire / Mobile Money',
            'Payez en ligne via FedaPay (sécurisé)'
        );
        container.appendChild(fedapayMethod);
    }
    
    // Méthode de paiement par virement bancaire
    if (paymentSettings.acceptBankTransfer) {
        const bankTransferMethod = createPaymentMethod(
            'bank_transfer',
            'fa-university',
            'Virement bancaire',
            'Payez par virement bancaire'
        );
        container.appendChild(bankTransferMethod);
    }
    
    // Sélectionner la méthode de paiement par défaut
    if (paymentSettings.defaultPaymentMethod) {
        const defaultMethod = document.querySelector(`.payment-method[data-method="${paymentSettings.defaultPaymentMethod}"]`);
        if (defaultMethod) {
            selectPaymentMethod(paymentSettings.defaultPaymentMethod);
        }
    }
}

/**
 * Créer une méthode de paiement
 * @param {string} method - Identifiant de la méthode
 * @param {string} icon - Icône de la méthode
 * @param {string} title - Titre de la méthode
 * @param {string} description - Description de la méthode
 * @returns {HTMLElement} - Élément HTML de la méthode de paiement
 */
function createPaymentMethod(method, icon, title, description) {
    const div = document.createElement('div');
    div.className = 'payment-method';
    div.dataset.method = method;
    
    div.innerHTML = `
        <div class="payment-method-icon">
            <i class="fas ${icon}"></i>
        </div>
        <div class="payment-method-info">
            <div class="payment-method-title">${title}</div>
            <div class="payment-method-description">${description}</div>
        </div>
    `;
    
    div.addEventListener('click', function() {
        selectPaymentMethod(method);
    });
    
    return div;
}

/**
 * Sélectionner une méthode de paiement
 * @param {string} method - Identifiant de la méthode
 */
function selectPaymentMethod(method) {
    // Désélectionner toutes les méthodes
    const methods = document.querySelectorAll('.payment-method');
    methods.forEach(m => {
        m.classList.remove('selected');
    });
    
    // Sélectionner la méthode cliquée
    const selectedMethod = document.querySelector(`.payment-method[data-method="${method}"]`);
    if (selectedMethod) {
        selectedMethod.classList.add('selected');
    }
    
    // Stocker la méthode sélectionnée
    window.selectedPaymentMethod = method;
    
    // Masquer tous les conteneurs de paiement
    document.getElementById('fedapayContainer').classList.add('d-none');
    document.getElementById('cashPaymentContainer').classList.add('d-none');
    document.getElementById('mobileMoneyContainer').classList.add('d-none');
    
    // Afficher le conteneur correspondant à la méthode sélectionnée
    if (method === 'fedapay') {
        document.getElementById('fedapayContainer').classList.remove('d-none');
    } else if (method === 'cash') {
        document.getElementById('cashPaymentContainer').classList.remove('d-none');
    } else if (method === 'mobile_money') {
        document.getElementById('mobileMoneyContainer').classList.remove('d-none');
    }
}

/**
 * Charger le script FedaPay
 * @param {string} publicKey - Clé publique FedaPay
 * @param {string} mode - Mode FedaPay (test ou live)
 */
function loadFedapayScript(publicKey, mode) {
    const container = document.getElementById('fedapayScriptContainer');
    
    // Stocker la clé publique et le mode
    window.fedapayPublicKey = publicKey;
    window.fedapayMode = mode || 'test';
    
    // Créer le script
    const script = document.createElement('script');
    script.src = 'https://cdn.fedapay.com/checkout.js?v=1.1.7';
    script.async = true;
    
    // Ajouter le script au conteneur
    container.appendChild(script);
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
 */
function setupEventHandlers(routerId) {
    console.log('Configuration des gestionnaires d\'événements pour buy-code.js');
    
    // Bouton précédent
    addSafeEventListener('prevStepBtn', 'click', function() {
        navigateToPreviousStep();
    });
    
    // Bouton suivant
    addSafeEventListener('nextStepBtn', 'click', function() {
        navigateToNextStep(routerId);
    });
    
    // Boutons de copie
    document.querySelectorAll('.copy-btn').forEach(btn => {
        if (!btn.getAttribute('data-click-handler-attached')) {
            btn.setAttribute('data-click-handler-attached', 'true');
            btn.addEventListener('click', function() {
                const targetId = this.dataset.copyTarget;
                copyToClipboard(targetId);
            });
            console.log('Gestionnaire click attaché à un bouton de copie');
        }
    });
    
    // Bouton d'impression du reçu
    document.getElementById('printReceiptBtn').addEventListener('click', function() {
        printReceipt();
    });
    
    // Bouton d'envoi par SMS
    document.getElementById('sendBySmsBtn').addEventListener('click', function() {
        sendCodeBySms(routerId);
    });
}

// Partie 3: Navigation entre les étapes et processus d'achat

/**
 * Naviguer vers l'étape suivante
 * @param {string} routerId - ID du routeur
 */
function navigateToNextStep(routerId) {
    // Récupérer l'étape active
    const activeStep = document.querySelector('.step.active');
    const activeStepId = activeStep.id;
    const activeStepNumber = parseInt(activeStepId.replace('step', ''));
    
    // Vérifier si l'étape actuelle est valide
    if (!isCurrentStepValid(activeStepNumber)) {
        return;
    }
    
    // Calculer l'étape suivante
    const nextStepNumber = activeStepNumber + 1;
    
    // Vérifier si l'étape suivante existe
    const nextStep = document.getElementById(`step${nextStepNumber}`);
    if (!nextStep) {
        return;
    }
    
    // Si nous passons à l'étape 3 (paiement), mettre à jour le récapitulatif
    if (nextStepNumber === 3) {
        updateOrderSummary();
    }
    
    // Si nous passons à l'étape 4 (confirmation), traiter l'achat
    if (nextStepNumber === 4) {
        processPurchase(routerId);
    }
    
    // Naviguer vers l'étape suivante
    navigateToStep(nextStepNumber);
}

/**
 * Naviguer vers l'étape précédente
 */
function navigateToPreviousStep() {
    // Récupérer l'étape active
    const activeStep = document.querySelector('.step.active');
    const activeStepId = activeStep.id;
    const activeStepNumber = parseInt(activeStepId.replace('step', ''));
    
    // Calculer l'étape précédente
    const prevStepNumber = activeStepNumber - 1;
    
    // Vérifier si l'étape précédente existe
    const prevStep = document.getElementById(`step${prevStepNumber}`);
    if (!prevStep) {
        return;
    }
    
    // Naviguer vers l'étape précédente
    navigateToStep(prevStepNumber);
}

/**
 * Naviguer vers une étape spécifique
 * @param {number} stepNumber - Numéro de l'étape
 */
function navigateToStep(stepNumber) {
    // Masquer toutes les étapes
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Désactiver toutes les étapes
    document.querySelectorAll('.step').forEach(step => {
        step.classList.remove('active');
        step.classList.remove('completed');
    });
    
    // Activer l'étape sélectionnée
    document.getElementById(`step${stepNumber}`).classList.add('active');
    document.getElementById(`step${stepNumber}Content`).classList.add('active');
    
    // Marquer les étapes précédentes comme terminées
    for (let i = 1; i < stepNumber; i++) {
        document.getElementById(`step${i}`).classList.add('completed');
    }
    
    // Mettre à jour les boutons de navigation
    updateNavigationButtons(stepNumber);
}

/**
 * Mettre à jour les boutons de navigation
 * @param {number} stepNumber - Numéro de l'étape
 */
function updateNavigationButtons(stepNumber) {
    const prevBtn = document.getElementById('prevStepBtn');
    const nextBtn = document.getElementById('nextStepBtn');
    
    // Bouton précédent
    if (stepNumber === 1) {
        prevBtn.disabled = true;
    } else {
        prevBtn.disabled = false;
    }
    
    // Bouton suivant
    if (stepNumber === 1 && !window.selectedProfileId) {
        nextBtn.disabled = true;
    } else {
        nextBtn.disabled = false;
    }
    
    // Modifier le texte du bouton suivant selon l'étape
    if (stepNumber === 3) {
        nextBtn.innerHTML = 'Payer <i class="fas fa-credit-card ms-1"></i>';
    } else if (stepNumber === 4) {
        nextBtn.innerHTML = 'Terminer <i class="fas fa-check ms-1"></i>';
        nextBtn.disabled = true;
    } else {
        nextBtn.innerHTML = 'Suivant <i class="fas fa-arrow-right ms-1"></i>';
    }
}

/**
 * Vérifier si l'étape actuelle est valide
 * @param {number} stepNumber - Numéro de l'étape
 * @returns {boolean} - true si l'étape est valide, false sinon
 */
function isCurrentStepValid(stepNumber) {
    // Étape 1: Choix du forfait
    if (stepNumber === 1) {
        if (!window.selectedProfileId) {
            showError('Veuillez sélectionner un forfait pour continuer.');
            return false;
        }
        return true;
    }
    
    // Étape 2: Informations client
    if (stepNumber === 2) {
        const form = document.getElementById('clientInfoForm');
        
        // Vérifier si le formulaire est valide
        if (!form.checkValidity()) {
            form.reportValidity();
            return false;
        }
        
        // Vérifier si les conditions sont acceptées
        if (!document.getElementById('termsAccepted').checked) {
            showError('Vous devez accepter les conditions d\'utilisation pour continuer.');
            return false;
        }
        
        return true;
    }
    
    // Étape 3: Paiement
    if (stepNumber === 3) {
        if (!window.selectedPaymentMethod) {
            showError('Veuillez sélectionner une méthode de paiement pour continuer.');
            return false;
        }
        
        // Vérifier les informations spécifiques à la méthode de paiement
        if (window.selectedPaymentMethod === 'mobile_money') {
            const mobileMoneyNumber = document.getElementById('mobileMoneyNumber').value.trim();
            if (!mobileMoneyNumber) {
                showError('Veuillez entrer votre numéro Mobile Money pour continuer.');
                return false;
            }
        }
        
        return true;
    }
    
    return true;
}

/**
 * Mettre à jour le récapitulatif de la commande
 */
function updateOrderSummary() {
    // Récupérer les informations du profil sélectionné
    const profileDocRef = doc(db, 'profiles', window.selectedProfileId);
    getDoc(profileDocRef)
        .then((doc) => {
            if (doc.exists) {
                const profile = doc.data();
                
                // Mettre à jour le récapitulatif
                document.getElementById('summaryProfileName').textContent = profile.name;
                document.getElementById('summaryProfileDuration').textContent = profile.duration;
                document.getElementById('summaryTotal').textContent = `${profile.price} FCFA`;
                
                // Stocker les informations du profil
                window.selectedProfile = profile;
            }
        });
    
    // Récupérer les informations du client
    const clientName = document.getElementById('clientName').value;
    const clientPhone = document.getElementById('clientPhone').value;
    
    // Mettre à jour le récapitulatif
    document.getElementById('summaryClientName').textContent = clientName || '-';
    document.getElementById('summaryClientPhone').textContent = clientPhone || '-';
}

/**
 * Traiter l'achat
 * @param {string} routerId - ID du routeur
 */
function processPurchase(routerId) {
    // Afficher le chargement
    document.getElementById('nextStepBtn').disabled = true;
    document.getElementById('prevStepBtn').disabled = true;
    
    // Récupérer les informations du client
    const clientName = document.getElementById('clientName').value;
    const clientPhone = document.getElementById('clientPhone').value;
    const clientEmail = document.getElementById('clientEmail').value;
    
    // Récupérer la méthode de paiement
    const paymentMethod = window.selectedPaymentMethod;
    
    // Récupérer les informations du profil
    const profileId = window.selectedProfileId;
    const profile = window.selectedProfile;
    
    // Vérifier si un code WiFi est disponible pour ce profil
    checkAvailableCode(profileId, routerId)
        .then((codeDoc) => {
            if (!codeDoc) {
                // Aucun code disponible
                showError('Aucun code WiFi n\'est disponible pour ce forfait. Veuillez en choisir un autre ou contacter le support.');
                navigateToStep(1);
                return;
            }
            
            // Créer un nouveau client si nécessaire
            return createOrUpdateClient(routerId, clientName, clientPhone, clientEmail)
                .then((clientId) => {
                    // Créer un nouveau paiement
                    return createPayment(routerId, clientId, profileId, profile.price, paymentMethod)
                        .then((paymentId) => {
                            // Marquer le code comme utilisé
                            return assignCodeToClient(codeDoc.id, clientId, paymentId, routerId)
                                .then(() => {
                                    // Afficher le code WiFi
                                    displayWifiCode(codeDoc.data());
                                    
                                    // Envoyer le code par SMS si nécessaire
                                    if (clientPhone && window.paymentSettings.sendReceiptBySms) {
                                        sendCodeBySms(routerId, clientPhone, codeDoc.data());
                                    }
                                });
                        });
                });
        })
        .catch((error) => {
            console.error('Erreur lors du traitement de l\'achat:', error);
            showError('Une erreur est survenue lors du traitement de votre achat. Veuillez réessayer plus tard.');
            navigateToStep(3);
        });
}

// Partie 4: Fonctions utilitaires et opérations de base de données

/**
 * Vérifier si un code WiFi est disponible pour un profil
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 * @returns {Promise<Object>} - Promesse contenant le document du code WiFi
 */
function checkAvailableCode(profileId, routerId) {
    const codesCollection = collection(db, 'wifiCodes');
    const codeQuery = query(
        codesCollection,
        where('profileId', '==', profileId),
        where('routerId', '==', routerId),
        where('status', '==', 'available'),
        limit(1)
    );
    
    return getDocs(codeQuery)
        .then((snapshot) => {
            if (snapshot.empty) {
                return null;
            }
            return snapshot.docs[0];
        });
}

/**
 * Créer ou mettre à jour un client
 * @param {string} routerId - ID du routeur
 * @param {string} name - Nom du client
 * @param {string} phone - Téléphone du client
 * @param {string} email - Email du client
 * @returns {Promise<string>} - Promesse contenant l'ID du client
 */
function createOrUpdateClient(routerId, name, phone, email) {
    // Vérifier si le client existe déjà
    const clientsCollection = collection(db, 'clients');
    const clientQuery = query(
        clientsCollection,
        where('routerId', '==', routerId),
        where('phone', '==', phone),
        limit(1)
    );
    return getDocs(clientQuery)
        .then((snapshot) => {
            if (!snapshot.empty) {
                // Le client existe déjà, mettre à jour ses informations
                const clientId = snapshot.docs[0].id;
                const clientDocRef = doc(db, 'clients', clientId);
                return updateDoc(clientDocRef, {
                    name: name || snapshot.docs[0].data().name,
                    email: email || snapshot.docs[0].data().email,
                    updatedAt: serverTimestamp()
                }).then(() => clientId);
            } else {
                // Créer un nouveau client
                const clientsCollection = collection(db, 'clients');
                return addDoc(clientsCollection, {
                    routerId,
                    name,
                    phone,
                    email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
                    updatedAt: firebase.firestore.FieldValue.serverTimestamp()
                }).then((docRef) => docRef.id);
            }
        });
}

/**
 * Créer un nouveau paiement
 * @param {string} routerId - ID du routeur
 * @param {string} clientId - ID du client
 * @param {string} profileId - ID du profil
 * @param {number} amount - Montant du paiement
 * @param {string} method - Méthode de paiement
 * @returns {Promise<string>} - Promesse contenant l'ID du paiement
 */
function createPayment(routerId, clientId, profileId, amount, method) {
    const paymentsCollection = collection(db, 'payments');
    return addDoc(paymentsCollection, {
        routerId,
        clientId,
        profileId,
        amount,
        method,
        status: method === 'cash' ? 'pending' : 'completed',
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    }).then((docRef) => docRef.id);
}

/**
 * Assigner un code WiFi à un client
 * @param {string} codeId - ID du code WiFi
 * @param {string} clientId - ID du client
 * @param {string} paymentId - ID du paiement
 * @param {string} routerId - ID du routeur
 * @returns {Promise<void>} - Promesse vide
 */
function assignCodeToClient(codeId, clientId, paymentId, routerId) {
    const codeDocRef = doc(db, 'wifiCodes', codeId);
    return updateDoc(codeDocRef, {
        status: 'sold',
        clientId,
        paymentId,
        soldAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    });
}

/**
 * Afficher le code WiFi
 * @param {Object} code - Données du code WiFi
 */
function displayWifiCode(code) {
    // Afficher le code WiFi
    document.getElementById('wifiUsername').value = code.username;
    document.getElementById('wifiPassword').value = code.password;
    
    // Calculer la date d'expiration
    const expiryDate = new Date();
    // Ajouter la durée du profil (approximative)
    if (window.selectedProfile.duration.includes('jour')) {
        const days = parseInt(window.selectedProfile.duration);
        expiryDate.setDate(expiryDate.getDate() + days);
    } else if (window.selectedProfile.duration.includes('semaine')) {
        const weeks = parseInt(window.selectedProfile.duration);
        expiryDate.setDate(expiryDate.getDate() + (weeks * 7));
    } else if (window.selectedProfile.duration.includes('mois')) {
        const months = parseInt(window.selectedProfile.duration);
        expiryDate.setMonth(expiryDate.getMonth() + months);
    }
    
    // Formater la date d'expiration
    const formattedDate = expiryDate.toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
    
    // Afficher la date d'expiration
    document.getElementById('wifiExpiry').value = formattedDate;
}

/**
 * Copier un texte dans le presse-papier
 * @param {string} elementId - ID de l'élément à copier
 */
function copyToClipboard(elementId) {
    const element = document.getElementById(elementId);
    element.select();
    document.execCommand('copy');
    
    // Afficher un message de confirmation
    const button = document.querySelector(`[data-copy-target="${elementId}"]`);
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-check"></i>';
    
    setTimeout(() => {
        button.innerHTML = originalHTML;
    }, 2000);
}

/**
 * Imprimer le reçu
 */
function printReceipt() {
    // Créer le contenu du reçu
    const receiptContent = `
        <div style="font-family: Arial, sans-serif; max-width: 400px; margin: 0 auto; padding: 20px; border: 1px solid #ccc;">
            <div style="text-align: center; margin-bottom: 20px;">
                <h2 style="margin: 0;">${document.getElementById('routerName').textContent}</h2>
                <p>${document.getElementById('routerDescription').textContent}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0;">Reçu d'achat de code WiFi</h3>
                <p><strong>Date:</strong> ${new Date().toLocaleDateString('fr-FR')}</p>
                <p><strong>Client:</strong> ${document.getElementById('summaryClientName').textContent}</p>
                <p><strong>Téléphone:</strong> ${document.getElementById('summaryClientPhone').textContent}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0;">Détails de l'achat</h3>
                <p><strong>Forfait:</strong> ${document.getElementById('summaryProfileName').textContent}</p>
                <p><strong>Durée:</strong> ${document.getElementById('summaryProfileDuration').textContent}</p>
                <p><strong>Montant:</strong> ${document.getElementById('summaryTotal').textContent}</p>
            </div>
            
            <div style="margin-bottom: 20px;">
                <h3 style="margin: 0 0 10px 0;">Identifiants WiFi</h3>
                <p><strong>Nom d'utilisateur:</strong> ${document.getElementById('wifiUsername').value}</p>
                <p><strong>Mot de passe:</strong> ${document.getElementById('wifiPassword').value}</p>
                <p><strong>Valide jusqu'au:</strong> ${document.getElementById('wifiExpiry').value}</p>
            </div>
            
            <div style="text-align: center; font-size: 12px; margin-top: 30px;">
                <p>Merci pour votre achat!</p>
                ${window.paymentSettings && window.paymentSettings.receiptFooter ? `<p>${window.paymentSettings.receiptFooter}</p>` : ''}
            </div>
        </div>
    `;
    
    // Ouvrir une nouvelle fenêtre pour l'impression
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <html>
            <head>
                <title>Reçu - ${document.getElementById('routerName').textContent}</title>
            </head>
            <body>
                ${receiptContent}
                <script>
                    window.onload = function() {
                        window.print();
                        setTimeout(function() { window.close(); }, 500);
                    };
                </script>
            </body>
        </html>
    `);
    printWindow.document.close();
}

/**
 * Envoyer le code WiFi par SMS
 * @param {string} routerId - ID du routeur
 * @param {string} phone - Numéro de téléphone du client
 * @param {Object} code - Données du code WiFi
 */
function sendCodeBySms(routerId, phone, code) {
    // Cette fonction est un placeholder pour l'intégration d'un service SMS
    // Dans une implémentation réelle, vous devriez appeler une API pour envoyer un SMS
    
    console.log(`SMS envoyé au ${phone} avec le code WiFi: ${code.username} / ${code.password}`);
    
    // Afficher un message de confirmation
    const button = document.getElementById('sendBySmsBtn');
    const originalHTML = button.innerHTML;
    button.innerHTML = '<i class="fas fa-check me-1"></i> SMS envoyé';
    button.disabled = true;
    
    setTimeout(() => {
        button.innerHTML = originalHTML;
        button.disabled = false;
    }, 5000);
}
