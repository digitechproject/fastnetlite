// Import des fonctions Firebase
import { 
    getAuth, 
    onAuthStateChanged, 
    updateProfile, 
    updateEmail, 
    updatePassword, 
    reauthenticateWithCredential, 
    EmailAuthProvider 
} from 'firebase/auth';

import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc, 
    updateDoc, 
    collection, 
    addDoc, 
    query, 
    where,
    orderBy, 
    getDocs,
    serverTimestamp
} from 'firebase/firestore';

// Import des fonctions de gestion de licence
import { activateLicense, checkActiveLicense } from './license-utils';
import { formatLicenseKey } from './license-modal.js';

// Import du module d'intégration de widget
import { initWidgetIntegration } from './widget-integration.js';

// Import direct des instances Firebase déjà initialisées
import { auth, db } from './firebase-config';

// Clé API FedaPay (sera récupérée depuis la base de données)
let fedapayApiKey = ''; // Initialisée vide, sera remplie lors du chargement

// Variables globales
let currentUser = null;
let userDocRef = null;
let userProfileData = null;
let subscriptionData = null;
let licenseData = null;

// Éléments DOM pour le profil
const profileNameInput = document.getElementById('profileName');
const profileEmailInput = document.getElementById('profileEmail');
const profilePhoneInput = document.getElementById('profilePhone');
const profileCompanyInput = document.getElementById('profileCompany');
const profileForm = document.getElementById('profileForm');
const passwordForm = document.getElementById('passwordForm');
const currentPasswordInput = document.getElementById('currentPassword');
const newPasswordInput = document.getElementById('newPassword');
const confirmPasswordInput = document.getElementById('confirmPassword');
const saveProfileBtn = document.getElementById('saveProfileBtn');
const changePasswordBtn = document.getElementById('changePasswordBtn');
const userNameDisplay = document.getElementById('userName');

// Éléments DOM pour la facturation
const billingInfoForm = document.getElementById('billingInfoForm');
const logoutBtn = document.getElementById('logoutBtn');
const logoutBtnDropdown = document.getElementById('logoutBtnDropdown');

// Éléments DOM pour l'abonnement
const subscriptionStatus = document.getElementById('subscriptionStatus');
const currentPlanDisplay = document.getElementById('currentPlan');
const nextBillingDateDisplay = document.getElementById('nextBillingDate');
const cancelSubscriptionBtn = document.getElementById('cancelSubscriptionBtn');
const upgradeSubscriptionBtn = document.getElementById('upgradeSubscriptionBtn');
const confirmCancelSubscriptionBtn = document.getElementById('confirmCancelSubscription');
const selectPlanBtns = document.querySelectorAll('.select-plan-btn');

// Note: Les éléments DOM pour la licence sont déclarés localement dans les fonctions qui les utilisent
// pour éviter les erreurs de redéclaration

// Éléments DOM pour la facturation
const billingForm = document.getElementById('billingForm');
const billingNameInput = document.getElementById('billingName');
const billingPhoneInput = document.getElementById('billingPhone');
const billingAddressInput = document.getElementById('billingAddress');
const billingCityInput = document.getElementById('billingCity');
const billingCountryInput = document.getElementById('billingCountry');
const saveBillingBtn = document.getElementById('saveBillingBtn');
const paymentHistoryTable = document.getElementById('paymentHistory');
const noPaymentsMessage = document.getElementById('noPaymentsMessage');

// Élément DOM pour l'intégration du widget
const widgetIntegrationContainer = document.getElementById('widgetIntegrationContainer');

// Fonction d'initialisation
document.addEventListener('DOMContentLoaded', () => {
    // Vérifier l'état de l'authentification
    onAuthStateChanged(auth, (user) => {
        if (user) {
            currentUser = user;
            userDocRef = doc(db, 'users', user.uid);
            
            // Charger les données de l'utilisateur
            loadUserProfile();
            loadSubscriptionData();
            loadBillingInfo();
            loadPaymentHistory();
            
            // Afficher le nom d'utilisateur dans la barre de navigation
            userNameDisplay.textContent = user.displayName || user.email;
        } else {
            // Rediriger vers la page de connexion si l'utilisateur n'est pas connecté
            window.location.href = 'index.html';
        }
    });
    
    // Initialiser les gestionnaires d'événements
    initEventListeners();
});

// Fonction pour charger les données du profil utilisateur
async function loadUserProfile() {
    try {
        const userDoc = await getDoc(userDocRef);
        
        if (userDoc.exists()) {
            userProfileData = userDoc.data();
            
            // Remplir les champs du formulaire avec les données existantes
            profileNameInput.value = userProfileData.name || '';
            profileEmailInput.value = currentUser.email || '';
            profilePhoneInput.value = userProfileData.phone || '';
            profileCompanyInput.value = userProfileData.company || '';
            
            // Mettre à jour l'affichage du nom d'utilisateur
            userNameDisplay.textContent = userProfileData.name || currentUser.email;
        } else {
            // Créer un nouveau document utilisateur s'il n'existe pas
            userProfileData = {
                name: currentUser.displayName || '',
                email: currentUser.email,
                createdAt: new Date()
            };
            
            await setDoc(userDocRef, userProfileData);
            
            profileNameInput.value = userProfileData.name;
            profileEmailInput.value = userProfileData.email;
        }
    } catch (error) {
        console.error('Erreur lors du chargement du profil utilisateur:', error);
        showAlert('Erreur lors du chargement de votre profil. Veuillez réessayer.', 'danger');
    }
}

// Fonction pour enregistrer les modifications du profil
async function saveProfile(event) {
    event.preventDefault();
    
    try {
        const updatedProfile = {
            name: profileNameInput.value.trim(),
            phone: profilePhoneInput.value.trim(),
            company: profileCompanyInput.value.trim(),
            updatedAt: new Date()
        };
        
        await updateDoc(userDocRef, updatedProfile);
        
        // Mettre à jour les données locales
        userProfileData = { ...userProfileData, ...updatedProfile };
        
        // Mettre à jour l'affichage du nom d'utilisateur
        userNameDisplay.textContent = updatedProfile.name || currentUser.email;
        
        showAlert('Profil mis à jour avec succès!', 'success');
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        showAlert('Erreur lors de la mise à jour du profil. Veuillez réessayer.', 'danger');
    }
}

// Fonction pour changer le mot de passe
async function changePassword(event) {
    event.preventDefault();
    
    const currentPassword = currentPasswordInput.value;
    const newPassword = newPasswordInput.value;
    const confirmPassword = confirmPasswordInput.value;
    
    // Vérifier que les mots de passe correspondent
    if (newPassword !== confirmPassword) {
        showAlert('Les nouveaux mots de passe ne correspondent pas.', 'danger');
        return;
    }
    
    // Vérifier la complexité du mot de passe
    if (newPassword.length < 8) {
        showAlert('Le nouveau mot de passe doit contenir au moins 8 caractères.', 'danger');
        return;
    }
    
    try {
        // Réauthentifier l'utilisateur avant de changer le mot de passe
        const credential = EmailAuthProvider.credential(
            currentUser.email,
            currentPassword
        );
        
        await reauthenticateWithCredential(currentUser, credential);
        await updatePassword(currentUser, newPassword);
        
        // Réinitialiser le formulaire
        passwordForm.reset();
        
        showAlert('Mot de passe changé avec succès!', 'success');
    } catch (error) {
        console.error('Erreur lors du changement de mot de passe:', error);
        
        if (error.code === 'auth/wrong-password') {
            showAlert('Le mot de passe actuel est incorrect.', 'danger');
        } else {
            showAlert('Erreur lors du changement de mot de passe. Veuillez réessayer.', 'danger');
        }
    }
}

// Fonction pour charger les données d'abonnement
async function loadSubscriptionData() {
    try {
        // Vérifier si l'utilisateur a une souscription
        const subscriptionRef = doc(db, 'users', currentUser.uid, 'subscription', 'current');
        const subscriptionDoc = await getDoc(subscriptionRef);
        
        if (subscriptionDoc.exists()) {
            subscriptionData = subscriptionDoc.data();
            
            // Si la souscription contient une licenseKeyId, récupérer les informations de la licence
            if (subscriptionData.licenseKeyId) {
                const licenseRef = doc(db, 'licenses', subscriptionData.licenseKeyId);
                const licenseDoc = await getDoc(licenseRef);
                
                if (licenseDoc.exists()) {
                    const licenseData = licenseDoc.data();
                    
                    // Fusionner les données de licence avec les données d'abonnement
                    subscriptionData = {
                        ...subscriptionData,
                        licenseKey: licenseData.licenseKey,
                        plan: licenseData.plan,
                        duration: licenseData.duration
                    };
                }
            }
            
            // Mettre à jour l'interface utilisateur
            updateLicenseUI(subscriptionData);
        } else {
            // Pas de licence active
            updateLicenseUI(null);
            
            // Créer une structure d'abonnement par défaut
            subscriptionData = {
                status: 'inactive',
                createdAt: new Date(),
                plan: null,
                nextBillingDate: null
            };
        }
    } catch (error) {
        console.error('Erreur lors du chargement des données d\'abonnement:', error);
        showAlert('Erreur lors du chargement des données d\'abonnement. Veuillez réessayer.', 'danger');
    }
}

// Fonction pour mettre à jour l'interface utilisateur avec les données de licence
function updateLicenseUI(data) {
    // Récupérer les éléments DOM nécessaires
    const licenseStatus = document.getElementById('licenseStatus');
    const licenseInfoContainer = document.getElementById('licenseInfoContainer');
    const currentLicensePlan = document.getElementById('currentLicensePlan');
    const licenseExpirationDate = document.getElementById('licenseExpirationDate');
    const licenseKeyContainer = document.getElementById('licenseKeyContainer');
    const displayLicenseKey = document.getElementById('displayLicenseKey');
    const activateLicenseContainer = document.getElementById('activateLicenseContainer');
    
    // Vérifier que tous les éléments nécessaires existent
    if (!licenseStatus) {
        console.error('L\'\u00e9lément licenseStatus est introuvable.');
        return;
    }
    
    // Mettre à jour le statut de la licence
    if (data && data.status === 'active') {
        licenseStatus.innerHTML = `
            <i class="fas fa-check-circle me-2"></i>
            Votre licence est active jusqu'au ${formatDate(data.expirationDate)}
        `;
        licenseStatus.className = 'alert alert-success';
        
        if (licenseInfoContainer) licenseInfoContainer.classList.remove('d-none');
        if (licenseKeyContainer) licenseKeyContainer.classList.remove('d-none');
        if (activateLicenseContainer) activateLicenseContainer.classList.add('d-none');
        
        // Afficher la clé de licence
        if (data.licenseKey && displayLicenseKey) {
            displayLicenseKey.value = data.licenseKey;
        }
    } else if (data && data.status === 'expired') {
        licenseStatus.innerHTML = `
            <i class="fas fa-exclamation-circle me-2"></i>
            Votre licence a expiré le ${formatDate(data.expirationDate)}. Veuillez acheter une nouvelle licence.
        `;
        licenseStatus.className = 'alert alert-danger';
        
        if (licenseInfoContainer) licenseInfoContainer.classList.remove('d-none');
        if (licenseKeyContainer) licenseKeyContainer.classList.remove('d-none');
        if (activateLicenseContainer) activateLicenseContainer.classList.remove('d-none');
        
        // Afficher la clé de licence expirée
        if (data.licenseKey && displayLicenseKey) {
            displayLicenseKey.value = data.licenseKey;
        }
    } else {
        licenseStatus.innerHTML = `
            <i class="fas fa-info-circle me-2"></i>
            Vous n'avez pas de licence active. Veuillez activer une licence ou en acheter une nouvelle.
        `;
        licenseStatus.className = 'alert alert-warning';
        
        if (licenseInfoContainer) licenseInfoContainer.classList.add('d-none');
        if (licenseKeyContainer) licenseKeyContainer.classList.add('d-none');
        if (activateLicenseContainer) activateLicenseContainer.classList.remove('d-none');
    }
    
    // Mettre à jour l'affichage du plan actuel
    if (data && data.plan && currentLicensePlan) {
        const planNames = {
            'basic': 'Basique',
            'standard': 'Standard',
            'premium': 'Premium'
        };
        currentLicensePlan.textContent = planNames[data.plan] || data.plan;
    } else if (currentLicensePlan) {
        currentLicensePlan.textContent = 'Aucun';
    }
    
    // Mettre à jour la date d'expiration
    if (data && data.expirationDate && licenseExpirationDate) {
        licenseExpirationDate.textContent = formatDate(data.expirationDate);
    } else if (licenseExpirationDate) {
        licenseExpirationDate.textContent = '-';
    }
}

// Fonction pour charger les informations de facturation (désactivée - utilisation de FedaPay)
// Cette fonction est désactivée car nous utilisons FedaPay pour gérer les paiements
async function loadBillingInfo() {
    // Fonction désactivée - les formulaires de facturation ont été supprimés
    console.log('Fonction de facturation désactivée - utilisation de FedaPay pour les paiements');
    return;
}

// Fonction pour enregistrer les informations de facturation (désactivée - utilisation de FedaPay)
// Cette fonction est désactivée car nous utilisons FedaPay pour gérer les paiements
async function saveBillingInfo(event) {
    if (event) event.preventDefault();
    
    // Fonction désactivée - les formulaires de facturation ont été supprimés
    console.log('Fonction de sauvegarde de facturation désactivée - utilisation de FedaPay pour les paiements');
    return;
}

// Fonction pour charger l'historique des paiements
async function loadPaymentHistory() {
    try {
        // Vérifier si la collection paymentSubscriptions existe pour l'utilisateur
        const paymentsRef = collection(db, 'users', currentUser.uid, 'paymentSubscriptions');
        const q = query(paymentsRef, orderBy('date', 'desc'));
        const paymentsSnapshot = await getDocs(q);
        
        if (!paymentsSnapshot.empty) {
            // Afficher l'historique des paiements
            noPaymentsMessage.style.display = 'none';
            paymentHistoryTable.innerHTML = '';
            
            paymentsSnapshot.forEach(doc => {
                const payment = doc.data();
                const paymentRow = document.createElement('tr');
                
                paymentRow.innerHTML = `
                    <td>${formatDate(payment.date)}</td>
                    <td>${payment.description}</td>
                    <td>${formatCurrency(payment.amount)}</td>
                    <td>
                        <span class="badge ${getStatusBadgeClass(payment.status)}">
                            ${payment.status}
                        </span>
                    </td>
                    <td>
                        <button class="btn btn-sm btn-outline-secondary view-invoice-btn" data-id="${doc.id}">
                            <i class="fas fa-file-invoice"></i> Facture
                        </button>
                    </td>
                `;
                
                paymentHistoryTable.appendChild(paymentRow);
            });
            
            // Ajouter des écouteurs d'événements pour les boutons de facture
            document.querySelectorAll('.view-invoice-btn').forEach(btn => {
                btn.addEventListener('click', () => viewInvoice(btn.dataset.id));
            });
        } else {
            // Aucun paiement trouvé
            noPaymentsMessage.style.display = 'block';
        }
    } catch (error) {
        console.error('Erreur lors du chargement de l\'historique des paiements:', error);
        showAlert('Erreur lors du chargement de l\'historique des paiements. Veuillez réessayer.', 'danger');
    }
}

// Fonction pour activer une licence existante
async function handleLicenseActivation(event) {
    event.preventDefault();
    
    // Récupérer les éléments DOM nécessaires
    const activateLicenseKey = document.getElementById('activateLicenseKey');
    const activateLicenseFormBtn = document.getElementById('activateLicenseFormBtn');
    
    if (!activateLicenseKey || !activateLicenseFormBtn) {
        showAlert('Erreur: éléments du formulaire non trouvés.', 'danger');
        return;
    }
    
    try {
        // Vérifier si l'utilisateur est connecté
        if (!currentUser) {
            showAlert('Vous devez être connecté pour activer une licence.', 'danger');
            return;
        }
        
        // Récupérer la clé de licence
        const licenseKey = activateLicenseKey.value.trim();
        
        if (!licenseKey) {
            showAlert('Veuillez entrer une clé de licence valide.', 'warning');
            return;
        }
        
        // Désactiver le bouton pendant l'activation
        activateLicenseFormBtn.disabled = true;
        activateLicenseFormBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i> Activation...';
        
        // Activer la licence
        const result = await activateLicense(currentUser.uid, licenseKey);
        
        if (result.success) {
            showAlert(result.message, 'success');
            
            // Recharger les données de licence
            await loadSubscriptionData();
        } else {
            showAlert(result.message, 'danger');
        }
    } catch (error) {
        console.error('Erreur lors de l\'activation de la licence:', error);
        showAlert('Une erreur est survenue lors de l\'activation de la licence.', 'danger');
    } finally {
        // Réactiver le bouton si l'élément existe toujours
        if (activateLicenseFormBtn) {
            activateLicenseFormBtn.disabled = false;
            activateLicenseFormBtn.innerHTML = '<i class="fas fa-key me-1"></i> Activer';
        }
    }
}

// Fonction pour acheter une nouvelle licence
async function buyLicense(plan, duration, price) {
    try {
        // Vérifier si l'utilisateur est connecté
        if (!currentUser) {
            showAlert('Vous devez être connecté pour acheter une licence.', 'danger');
            return;
        }
        
        // Afficher un message de préparation
        showAlert('Préparation de votre achat...', 'info');
        
        // Générer une clé de licence unique
        const licenseKey = generateLicenseKey();
        
        // Créer un document de licence temporaire avec statut 'pending'
        const licenseRef = collection(db, 'licenses');
        const newLicense = {
            licenseKey: licenseKey,
            duration: duration,
            plan: plan,
            price: price,
            status: 'pending', // En attente de paiement
            creationDate: new Date(),
            userId: currentUser.uid,
            activationDate: null,
            expirationDate: null,
            createdAt: serverTimestamp()
        };
        
        // Enregistrer la licence en attente dans Firestore
        const docRef = await addDoc(licenseRef, newLicense);
        const licenseId = docRef.id;
        
        // Variables pour stocker les informations de paiement (sans créer de document pour l'instant)
        let paymentId = null;
        const paymentData = {
            date: new Date(),
            description: `Licence ${plan} (${duration} jours)`,
            amount: price,
            status: 'pending',
            paymentMethod: 'FedaPay',
            type: 'license',
            licenseId: licenseId,
            licenseKey: licenseKey,
            createdAt: serverTimestamp()
        };
        
        // Récupérer les informations de l'utilisateur pour FedaPay
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userData = userDoc.data() || {};
        const userEmail = currentUser.email || userData.email || '';
        const userName = userData.displayName || currentUser.displayName || '';
        const userPhone = userData.phone || '';
        
        // Créer un bouton temporaire pour FedaPay
        const tempButtonId = `fedapay-btn-${Date.now()}`;
        const tempButton = document.createElement('button');
        tempButton.id = tempButtonId;
        tempButton.style.display = 'none';
        document.body.appendChild(tempButton);
        
        // Configuration de FedaPay
        const fedaPayConfig = {
            public_key: fedapayApiKey,
            transaction: {
                amount: price,
                description: `Licence FastNetLite ${plan} (${duration} jours)`,
                currency: {
                    iso: 'XOF'
                }
            },
            customer: {
                email: userEmail || 'client@fastnetlite.com',
                firstname: userName.split(' ')[0] || 'Client',
                lastname: userName.split(' ').slice(1).join(' ') || 'FastNetLite',
                phone_number: {
                    number: typeof userPhone === 'string' ? userPhone.replace(/\D/g, '') : '',
                    country: 'BJ' // Code pays par défaut (Benin)
                }
            },
            onComplete: async function(response) {
                // Traitement du callback onComplete de FedaPay (sans exposer la réponse complète)
                
                // Supprimer le bouton temporaire
                if (document.getElementById(tempButtonId)) {
                    document.getElementById(tempButtonId).remove();
                }
                
                // Vérifier si le paiement a été annulé ou refusé
                if (response && response.reason === 'DIALOG DISMISSED') {
                    // Paiement annulé par l'utilisateur
                    await updateDoc(doc(db, 'licenses', licenseId), {
                        status: 'cancelled',
                        updatedAt: serverTimestamp(),
                        note: 'Paiement annulé par l\'utilisateur'
                    });
                    
                    // Ne pas enregistrer le paiement annulé dans l'historique
                    
                    showAlert('Paiement annulé.', 'warning');
                    return;
                }
                
                // Vérifier que la réponse contient bien un ID de transaction et que le statut est approved
                if (response && response.transaction && response.transaction.id && 
                    response.transaction.status === 'approved') {
                    
                    // Transaction FedaPay validée
                    
                    // Mettre à jour le statut de la licence comme disponible
                    await updateDoc(doc(db, 'licenses', licenseId), {
                        status: 'available',
                        transactionId: response.transaction.id,
                        updatedAt: serverTimestamp()
                    });
                    
                    // Créer le document de paiement uniquement en cas de succès
                    const paymentRef = collection(db, 'users', currentUser.uid, 'paymentSubscriptions');
                    const paymentDataSuccess = {
                        ...paymentData,
                        status: 'completed',
                        transactionId: response.transaction.id,
                        updatedAt: serverTimestamp()
                    };
                    
                    const paymentDoc = await addDoc(paymentRef, paymentDataSuccess);
                    paymentId = paymentDoc.id;
                    
                    // Afficher un modal avec la clé de licence
                    showLicenseKeyModal(licenseKey, licenseId);
                    
                    // Recharger les données de licence
                    await loadSubscriptionData();
                    
                } else {
                    // Transaction FedaPay non approuvée ou invalide
                    
                    // Mettre à jour le statut de la licence en cas d'échec
                    let errorMessage = 'Transaction non approuvée';
                    
                    if (response && response.transaction) {
                        if (response.transaction.status) {
                            errorMessage = `Transaction avec statut: ${response.transaction.status}`;
                        }
                        if (response.transaction.last_error_code) {
                            errorMessage += ` (Code erreur: ${response.transaction.last_error_code})`;
                        }
                    }
                    
                    await updateDoc(doc(db, 'licenses', licenseId), {
                        status: 'failed',
                        updatedAt: serverTimestamp(),
                        errorMessage: errorMessage
                    });
                    
                    // Ne pas créer de document de paiement en cas d'échec
                    
                    showAlert('Le paiement n\'a pas été approuvé. Veuillez réessayer.', 'danger');
                }
            },
            onError: async function(error) {
                // Gestion des erreurs FedaPay (sans exposer les détails dans la console)
                
                // Mettre à jour le statut de la licence en cas d'erreur
                await updateDoc(doc(db, 'licenses', licenseId), {
                    status: 'failed',
                    updatedAt: serverTimestamp(),
                    errorMessage: error ? JSON.stringify(error) : 'Erreur inconnue'
                });
                
                // Ne pas créer de document de paiement en cas d'erreur
                
                showAlert('Une erreur est survenue lors du paiement. Veuillez réessayer plus tard.', 'danger');
                
                // Supprimer le bouton temporaire
                if (document.getElementById(tempButtonId)) {
                    document.getElementById(tempButtonId).remove();
                }
            },
            onClose: async function() {
                // Nettoyage lors de la fermeture du widget FedaPay
                
                // Supprimer le bouton temporaire
                if (document.getElementById(tempButtonId)) {
                    document.getElementById(tempButtonId).remove();
                }
            }
        };
        
        // Initialiser FedaPay avec le bouton temporaire (sans exposer la configuration dans la console)
        const widget = window.FedaPay.init('#' + tempButtonId, fedaPayConfig);
        
        // Déclencher le paiement
        tempButton.click();
        
    } catch (error) {
        console.error('Erreur lors de l\'achat de la licence:', error);
        showAlert('Une erreur est survenue lors de l\'achat de la licence.', 'danger');
    }
}

// Fonction pour générer une clé de licence unique
function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    
    // Format: XXXX-XXXX-XXXX-XXXX
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < 3) key += '-';
    }
    
    return key;
}

// Fonction pour afficher un modal avec la clé de licence après un paiement réussi
function showLicenseKeyModal(licenseKey, licenseId) {
    // Vérifier si un modal existe déjà, sinon le créer
    let licenseModal = document.getElementById('licenseKeyModal');
    
    if (!licenseModal) {
        // Créer le modal
        licenseModal = document.createElement('div');
        licenseModal.id = 'licenseKeyModal';
        licenseModal.className = 'modal fade';
        licenseModal.setAttribute('tabindex', '-1');
        licenseModal.setAttribute('aria-labelledby', 'licenseKeyModalLabel');
        licenseModal.setAttribute('aria-hidden', 'true');
        
        // Contenu du modal
        licenseModal.innerHTML = `
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title" id="licenseKeyModalLabel">Licence achetée avec succès</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Fermer"></button>
                    </div>
                    <div class="modal-body">
                        <div class="alert alert-success text-center">
                            <i class="fas fa-check-circle fa-3x mb-3"></i>
                            <p>Votre paiement a été traité avec succès.</p>
                        </div>
                        <p>Voici votre clé de licence :</p>
                        <div class="input-group mb-3">
                            <input type="text" class="form-control license-key-display" readonly>
                            <button class="btn btn-outline-secondary copy-license-btn" type="button">
                                <i class="fas fa-copy"></i> Copier
                            </button>
                        </div>
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle me-2"></i>
                            Conservez précieusement cette clé. Vous pouvez l'activer maintenant ou plus tard.
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
                        <button type="button" class="btn btn-primary activate-now-btn">Activer maintenant</button>
                    </div>
                </div>
            </div>
        `;
        
        // Ajouter le modal au document
        document.body.appendChild(licenseModal);
    }
    
    // Mettre à jour la clé de licence dans le modal
    const licenseKeyDisplay = licenseModal.querySelector('.license-key-display');
    if (licenseKeyDisplay) {
        licenseKeyDisplay.value = licenseKey;
    }
    
    // Configurer le bouton de copie
    const copyBtn = licenseModal.querySelector('.copy-license-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', function() {
            licenseKeyDisplay.select();
            document.execCommand('copy');
            showAlert('Clé de licence copiée dans le presse-papiers!', 'success');
        });
    }
    
    // Configurer le bouton d'activation
    const activateBtn = licenseModal.querySelector('.activate-now-btn');
    if (activateBtn) {
        activateBtn.addEventListener('click', async function() {
            try {
                // Fermer le modal
                const bsModal = bootstrap.Modal.getInstance(licenseModal);
                if (bsModal) {
                    bsModal.hide();
                }
                
                // Activer la licence
                const result = await activateLicense(currentUser.uid, licenseKey);
                
                if (result.success) {
                    showAlert(result.message, 'success');
                    
                    // Recharger les données de licence
                    await loadSubscriptionData();
                } else {
                    showAlert(result.message, 'danger');
                }
            } catch (error) {
                console.error('Erreur lors de l\'activation de la licence:', error);
                showAlert('Une erreur est survenue lors de l\'activation de la licence.', 'danger');
            }
        });
    }
    
    // Afficher le modal
    const bsModal = new bootstrap.Modal(licenseModal);
    bsModal.show();
}

// Fonction pour configurer les gestionnaires d'événements pour la licence
function setupLicenseEventHandlers() {
    // Gestionnaire pour le formulaire d'activation de licence
    const activateLicenseForm = document.getElementById('activateLicenseForm');
    if (activateLicenseForm) {
        activateLicenseForm.addEventListener('submit', handleLicenseActivation);
    }
    
    // Gestionnaire pour le bouton de copie de clé de licence
    const copyLicenseKeyBtn = document.getElementById('copyLicenseKeyBtn');
    const displayLicenseKey = document.getElementById('displayLicenseKey');
    if (copyLicenseKeyBtn && displayLicenseKey) {
        copyLicenseKeyBtn.addEventListener('click', () => {
            displayLicenseKey.select();
            document.execCommand('copy');
            showAlert('Clé de licence copiée dans le presse-papiers!', 'success');
        });
    }
    
    // Ajouter le formatage automatique au champ de saisie de la clé de licence
    const activateLicenseKey = document.getElementById('activateLicenseKey');
    if (activateLicenseKey) {
        activateLicenseKey.addEventListener('input', formatLicenseKey);
    }
    
    // Configurer les boutons d'achat de licence
    const buyLicenseBtns = document.querySelectorAll('.buy-license-btn');
    buyLicenseBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const plan = btn.getAttribute('data-plan');
            const duration = parseInt(btn.getAttribute('data-duration'));
            const price = parseInt(btn.getAttribute('data-price'));
            
            buyLicense(plan, duration, price);
        });
    });
}

// Fonction pour afficher les plans de licence disponibles
function displayLicensePlans() {
    const licensePlansContainer = document.getElementById('licensePlansContainer');
    if (!licensePlansContainer) return;
    
    // Définir le plan unique disponible
    const plan = {
        id: 'premium',
        name: 'Licence FastNetLite Premium',
        duration: 365,
        price: 50000,
        features: [
            'Routeurs illimités',
            'Codes WiFi illimités',
            'Support technique 24/7',
            'Statistiques avancées',
            'Installation incluse',
            'Durée: 365 jours'
        ]
    };
    
    // Générer le HTML pour le plan unique
    const planHTML = `
    <div class="col-md-6 mx-auto mb-3">
        <div class="card h-100 border-primary">
            <div class="card-header bg-primary text-white">
                <h5 class="card-title mb-0">${plan.name}</h5>
            </div>
            <div class="card-body d-flex flex-column">
                <h3 class="card-title pricing-card-title">${formatCurrency(plan.price)} FCFA<small class="text-muted fw-light">/an</small></h3>
                <ul class="list-unstyled mt-3 mb-4">
                    ${plan.features.map(feature => `<li><i class="fas fa-check text-success me-2"></i>${feature}</li>`).join('')}
                </ul>
                <button type="button" class="btn btn-primary mt-auto buy-license-btn" data-plan="${plan.id}" data-duration="${plan.duration}" data-price="${plan.price}">
                    <i class="fas fa-shopping-cart me-1"></i> Acheter maintenant
                </button>
            </div>
        </div>
    </div>
    `;
    
    // Mettre à jour le conteneur
    licensePlansContainer.innerHTML = `
    <div class="row">
        ${planHTML}
    </div>
    `;
}

// Fonction pour annuler un abonnement
async function cancelSubscription() {
    try {
        // Vérifier si l'utilisateur a un abonnement actif
        if (!subscriptionData || subscriptionData.status !== 'active') {
            showAlert('Vous n\'avez pas d\'abonnement actif à annuler.', 'warning');
            return;
        }
        
        // Mettre à jour l'abonnement
        const updatedSubscription = {
            ...subscriptionData,
            status: 'canceled',
            canceledAt: new Date(),
            updatedAt: new Date()
        };
        
        // Enregistrer l'abonnement annulé
        const subscriptionRef = doc(db, 'users', currentUser.uid, 'subscription', 'current');
        await updateDoc(subscriptionRef, updatedSubscription);
        
        // Mettre à jour les données locales
        subscriptionData = updatedSubscription;
        
        // Mettre à jour l'interface utilisateur
        updateSubscriptionUI(subscriptionData);
        
        showAlert('Votre abonnement a été annulé. Il restera actif jusqu\'au ' + formatDate(subscriptionData.nextBillingDate), 'info');
        
        // Fermer le modal de confirmation
        const cancelModal = bootstrap.Modal.getInstance(document.getElementById('cancelSubscriptionModal'));
        cancelModal.hide();
    } catch (error) {
        console.error('Erreur lors de l\'annulation de l\'abonnement:', error);
        showAlert('Erreur lors de l\'annulation de l\'abonnement. Veuillez réessayer.', 'danger');
    }
}

// Fonction pour voir une facture
function viewInvoice(paymentId) {
    // Dans une version réelle, cette fonction pourrait générer une facture PDF ou ouvrir une page de facture
    alert(`Visualisation de la facture ${paymentId} - Fonctionnalité à implémenter`);
}

// Fonction pour initialiser les gestionnaires d'événements
function initEventListeners() {
    // Profil
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfile);
    }
    
    // Mot de passe
    if (passwordForm) {
        passwordForm.addEventListener('submit', changePassword);
    }
    
    // Facturation (désactivée - utilisation de FedaPay)
    if (billingForm) {
        billingForm.addEventListener('submit', saveBillingInfo);
    }
    
    // Intégration du widget
    if (widgetIntegrationContainer) {
        initWidgetIntegration(widgetIntegrationContainer);
    }
    
    // Déconnexion
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    if (logoutBtnDropdown) {
        logoutBtnDropdown.addEventListener('click', logout);
    }
    
    // Gestionnaires pour l'abonnement et la licence
    setupLicenseEventHandlers();
    
    // Gestionnaires pour la facturation
    if (billingForm) billingForm.addEventListener('submit', saveBillingInfo);
    
    // Gestionnaire pour l'intégration Mikrotik
    loadProfileBuyLinks();
}

/**
 * Charge et affiche les liens d'achat pour chaque profil dans l'onglet Mikrotik
 */
async function loadProfileBuyLinks() {
    const profileBuyLinksContainer = document.getElementById('profileBuyLinks');
    if (!profileBuyLinksContainer) return;
    
    try {
        // Récupérer tous les routeurs de l'utilisateur
        const routersRef = collection(db, 'routers');
        const routersQuery = query(routersRef, where('userId', '==', currentUser.uid));
        const routersSnapshot = await getDocs(routersQuery);
        
        if (routersSnapshot.empty) {
            profileBuyLinksContainer.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Aucun routeur trouvé. Ajoutez d'abord un routeur pour configurer les liens d'achat.
                </div>
            `;
            return;
        }
        
        // Conteneur pour stocker tous les profils de tous les routeurs
        let allProfiles = [];
        
        // Pour chaque routeur, récupérer ses profils
        for (const routerDoc of routersSnapshot.docs) {
            const routerId = routerDoc.id;
            const router = routerDoc.data();
            
            const profilesRef = collection(db, 'profiles');
            const profilesQuery = query(profilesRef, where('routerId', '==', routerId));
            const profilesSnapshot = await getDocs(profilesQuery);
            
            if (!profilesSnapshot.empty) {
                profilesSnapshot.forEach(profileDoc => {
                    allProfiles.push({
                        id: profileDoc.id,
                        routerId: routerId,
                        routerName: router.name,
                        ...profileDoc.data()
                    });
                });
            }
        }
        
        // Afficher les profils et leurs liens d'achat
        if (allProfiles.length === 0) {
            profileBuyLinksContainer.innerHTML = `
                <div class="alert alert-warning">
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    Aucun profil trouvé. Créez d'abord des profils dans la section "Codes WiFi" de vos routeurs.
                </div>
            `;
            return;
        }
        
        // Trier les profils par routeur puis par nom
        allProfiles.sort((a, b) => {
            // Vérifier si les noms de routeur existent
            const routerNameA = a.routerName || '';
            const routerNameB = b.routerName || '';
            
            if (routerNameA !== routerNameB) {
                return routerNameA.localeCompare(routerNameB);
            }
            
            // Vérifier si les noms de profil existent
            const profileNameA = a.name || '';
            const profileNameB = b.name || '';
            return profileNameA.localeCompare(profileNameB);
        });
        
        // Générer le HTML pour chaque profil
        let currentRouterId = null;
        let html = '';
        
        allProfiles.forEach(profile => {
            // Ajouter un séparateur pour chaque nouveau routeur
            if (profile.routerId !== currentRouterId) {
                currentRouterId = profile.routerId;
                html += `
                    <h6 class="mt-3 mb-2 text-muted">Routeur: ${profile.routerName}</h6>
                `;
            }
            
            // Générer l'URL d'achat pour ce profil
            const buyUrl = `${window.location.origin}/profilbuy-code.html?routerId=${profile.routerId}&profileId=${profile.id}`;
            
            // Créer un snippet de code avec bouton de copie pour ce profil
            html += `
                <div class="card mb-2">
                    <div class="card-header py-2">
                        <div class="d-flex justify-content-between align-items-center">
                            <span class="fw-bold">${profile.name}</span>
                            <span class="badge bg-primary">${profile.price} FCFA</span>
                        </div>
                    </div>
                    <div class="card-body py-2">
                        <div class="position-relative">
                            <pre class="bg-dark text-light p-2 rounded mb-0" style="font-size: 0.85rem;">${buyUrl}</pre>
                            <button class="btn btn-sm btn-primary position-absolute top-0 end-0 m-1 copy-link-btn" 
                                    data-profile-id="${profile.id}" 
                                    data-router-id="${profile.routerId}" 
                                    data-profile-name="${profile.name}">
                                <i class="fas fa-copy"></i>
                            </button>
                        </div>
                    </div>
                </div>
            `;
        });
        
        // Mettre à jour le conteneur
        profileBuyLinksContainer.innerHTML = html;
        
        // Ajouter les gestionnaires d'événements pour les boutons de copie
        document.querySelectorAll('.copy-link-btn').forEach(button => {
            button.addEventListener('click', function() {
                const profileId = this.getAttribute('data-profile-id');
                const routerId = this.getAttribute('data-router-id');
                const profileName = this.getAttribute('data-profile-name');
                
                copyProfileBuyLink(profileId, routerId, profileName, this);
            });
        });
        
    } catch (error) {
        console.error('Erreur lors du chargement des liens d\'achat des profils:', error);
        profileBuyLinksContainer.innerHTML = `
            <div class="alert alert-danger">
                <i class="fas fa-exclamation-circle me-2"></i>
                Erreur lors du chargement des profils. Veuillez réessayer.
            </div>
        `;
    }
}

/**
 * Copie le lien d'achat d'un profil dans le presse-papier
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 * @param {string} profileName - Nom du profil
 * @param {HTMLElement} button - Bouton de copie qui a été cliqué
 */
function copyProfileBuyLink(profileId, routerId, profileName, button) {
    // Créer l'URL d'achat
    const buyUrl = `${window.location.origin}/profilbuy-code.html?routerId=${routerId}&profileId=${profileId}`;
    
    // Vérifier si l'API Clipboard est disponible
    if (navigator.clipboard && navigator.clipboard.writeText) {
        // Méthode moderne avec l'API Clipboard
        navigator.clipboard.writeText(buyUrl)
            .then(() => {
                // Feedback visuel sur le bouton
                const originalHTML = button.innerHTML;
                button.innerHTML = '<i class="fas fa-check"></i>';
                button.classList.remove('btn-primary');
                button.classList.add('btn-success');
                
                // Message de succès
                const alertElement = document.createElement('div');
                alertElement.className = 'alert alert-success mt-2 mb-0 py-1 px-2 small';
                alertElement.innerHTML = `Lien copié pour "${profileName}"`;
                button.closest('.card-body').appendChild(alertElement);
                
                // Restaurer après 2 secondes
                setTimeout(() => {
                    button.innerHTML = originalHTML;
                    button.classList.remove('btn-success');
                    button.classList.add('btn-primary');
                    
                    // Supprimer le message après un délai
                    setTimeout(() => {
                        if (alertElement.parentNode) {
                            alertElement.parentNode.removeChild(alertElement);
                        }
                    }, 1000);
                }, 2000);
            })
            .catch(err => {
                console.error('Erreur lors de la copie du lien:', err);
                alert(`Erreur lors de la copie du lien pour "${profileName}". Veuillez réessayer.`);
            });
    } else {
        // Méthode de secours pour les navigateurs qui ne supportent pas l'API Clipboard
        try {
            const textArea = document.createElement('textarea');
            textArea.value = buyUrl;
            document.body.appendChild(textArea);
            textArea.select();
            document.execCommand('copy');
            document.body.removeChild(textArea);
            
            // Feedback visuel
            const originalHTML = button.innerHTML;
            button.innerHTML = '<i class="fas fa-check"></i>';
            button.classList.remove('btn-primary');
            button.classList.add('btn-success');
            
            // Restaurer après 2 secondes
            setTimeout(() => {
                button.innerHTML = originalHTML;
                button.classList.remove('btn-success');
                button.classList.add('btn-primary');
            }, 2000);
        } catch (err) {
            console.error('Erreur lors de la copie du lien (méthode de secours):', err);
            alert(`Erreur lors de la copie du lien pour "${profileName}". Veuillez réessayer.`);
        }
    }
}
    
    // Autres gestionnaires d'événements (conservation pour compatibilité)
    if (confirmCancelSubscriptionBtn) {
        confirmCancelSubscriptionBtn.addEventListener('click', cancelSubscription);
    }
    
    if (upgradeSubscriptionBtn) {
        upgradeSubscriptionBtn.addEventListener('click', () => {
            // Faire défiler jusqu'aux plans disponibles
            document.querySelector('.select-plan-btn').scrollIntoView({ behavior: 'smooth' });
        });
    }
    
    // Gestionnaires d'événements pour les boutons de sélection de plan
    if (selectPlanBtns) {
        selectPlanBtns.forEach(btn => {
            btn.addEventListener('click', () => selectPlan(btn.dataset.plan));
        });
    
    // Gestionnaires d'événements pour la facturation - désactivés
    // billingForm.addEventListener('submit', saveBillingInfo);
    
    // Gestionnaires d'événements pour la déconnexion
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    if (logoutBtnDropdown) {
        logoutBtnDropdown.addEventListener('click', logout);
    }
}

// Fonction de déconnexion
async function logout() {
    try {
        await auth.signOut();
        window.location.href = 'index.html';
    } catch (error) {
        console.error('Erreur lors de la déconnexion:', error);
        showAlert('Erreur lors de la déconnexion. Veuillez réessayer.', 'danger');
    }
}

// Fonctions utilitaires

// Formater une date
function formatDate(date) {
    if (!date) return '-';
    
    // Si la date est une timestamp Firestore
    if (date.toDate && typeof date.toDate === 'function') {
        date = date.toDate();
    }
    
    // Si la date est une chaîne ISO
    if (typeof date === 'string') {
        date = new Date(date);
    }
    
    return new Intl.DateTimeFormat('fr-FR', { 
        day: '2-digit', 
        month: '2-digit', 
        year: 'numeric' 
    }).format(date);
}

// Formater un montant en devise
function formatCurrency(amount) {
    return new Intl.NumberFormat('fr-FR', {
        style: 'currency',
        currency: 'XOF',
        minimumFractionDigits: 0
    }).format(amount);
}

// Obtenir la classe CSS pour un badge de statut
function getStatusBadgeClass(status) {
    switch(status.toLowerCase()) {
        case 'completed':
        case 'success':
        case 'active':
            return 'bg-success';
        case 'pending':
        case 'processing':
            return 'bg-warning';
        case 'failed':
        case 'canceled':
        case 'inactive':
            return 'bg-danger';
        default:
            return 'bg-secondary';
    }
}

// Afficher une alerte
function showAlert(message, type = 'info') {
    // Créer un élément d'alerte
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type} alert-dismissible fade show`;
    alertDiv.role = 'alert';
    alertDiv.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    
    // Ajouter l'alerte au début de la page
    const mainContent = document.querySelector('main');
    mainContent.insertBefore(alertDiv, mainContent.firstChild);
    
    // Supprimer automatiquement l'alerte après 5 secondes
    setTimeout(() => {
        alertDiv.classList.remove('show');
        setTimeout(() => alertDiv.remove(), 300);
    }, 5000);
}

// Fonction pour récupérer la clé API FedaPay depuis la base de données
async function loadFedaPayApiKey() {
    try {
        const adminInfosRef = doc(db, 'adminInfos', 'fernando');
        const adminInfosDoc = await getDoc(adminInfosRef);
        
        if (adminInfosDoc.exists()) {
            const adminData = adminInfosDoc.data();
            if (adminData.fedapayApikey) {
                fedapayApiKey = adminData.fedapayApikey;
                // Pas de log pour éviter d'exposer des informations sensibles
            } else {
                // Utiliser une clé par défaut en cas d'erreur
                fedapayApiKey = 'pk_sandbox_oSB6rOPprN1A5odAugnHLDCF';
            }
        } else {
            // Utiliser une clé par défaut en cas d'erreur
            fedapayApiKey = 'pk_sandbox_oSB6rOPprN1A5odAugnHLDCF';
        }
    } catch (error) {
        // Utiliser une clé par défaut en cas d'erreur sans exposer l'erreur dans la console
        fedapayApiKey = 'pk_sandbox_oSB6rOPprN1A5odAugnHLDCF';
    }
}

// La fonction setupMikrotikIntegration a été déplacée directement dans settings.html
// pour éviter les problèmes de chargement et simplifier la gestion de l'onglet Mikrotik

// Initialisation de l'application
document.addEventListener('DOMContentLoaded', async () => {
    // Configurer l'intégration Mikrotik dès le chargement de la page
    // setupMikrotikIntegration();
    
    // Vérifier si l'utilisateur est connecté
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = user;
            userDocRef = doc(db, 'users', user.uid);
            
            // Charger la clé API FedaPay
            await loadFedaPayApiKey();
            
            // Initialiser les gestionnaires d'événements
            initEventListeners();
            
            // Charger les données du profil utilisateur
            await loadUserProfile();
            
            // Charger les données de licence
            await loadSubscriptionData();
            
            // Charger les informations de facturation (désactivé - utilisation de FedaPay)
            // await loadBillingInfo();
            
            // Charger l'historique des paiements
            await loadPaymentHistory();
            
            // Configurer les gestionnaires d'événements pour la licence
            setupLicenseEventHandlers();
        } else {
            // Rediriger vers la page de connexion si l'utilisateur n'est pas connecté
            window.location.href = 'index.html';
        }
    });
});
