// Import des fonctions Firebase v9
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { 
    getFirestore, 
    collection, 
    doc, 
    getDoc, 
    getDocs, 
    query, 
    where, 
    orderBy, 
    limit, 
    startAfter,
    endBefore,
    addDoc, 
    updateDoc, 
    deleteDoc, 
    setDoc,
    writeBatch,
    runTransaction,
    serverTimestamp
} from "firebase/firestore";
import './src/index';

// Obtenir les instances des services Firebase
const auth = getAuth();
const db = getFirestore();

// Variable globale pour éviter les initialisations multiples
window.routerSettingsJsInitialized = window.routerSettingsJsInitialized || false;

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

// Script pour les paramètres du routeur FastNetLite
// Partie 1: Initialisation et chargement des données

document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si le script a déjà été initialisé
    if (window.routerSettingsJsInitialized) {
        console.log('router-settings.js déjà initialisé, initialisation ignorée');
        return;
    }
    
    // Marquer le script comme initialisé
    window.routerSettingsJsInitialized = true;
    console.log('Initialisation de router-settings.js');
    // Récupérer l'ID du routeur depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const routerId = urlParams.get('id');
    
    // Vérifier si l'ID du routeur est présent
    if (!routerId) {
        // Vérifier si nous sommes dans un contexte de navigation
        const isNavigationEvent = sessionStorage.getItem('isRouterNavigation');
        
        // Si ce n'est pas un événement de navigation, rediriger vers la liste des routeurs
        if (!isNavigationEvent) {
            console.warn('ID du routeur non spécifié, redirection vers la liste des routeurs');
            window.location.href = 'routers.html';
            return;
        }
        
        // Réinitialiser le flag de navigation
        sessionStorage.removeItem('isRouterNavigation');
        return;
    }
    
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
    
    // Charger les paramètres généraux
    loadGeneralSettings(routerId);
    
    // Charger les paramètres de paiement
    loadPaymentSettings(routerId);
    
    // Mettre à jour les liens de navigation
    updateNavigationLinks(routerId);
}

/**
 * Charger les informations du routeur
 * @param {string} routerId - ID du routeur
 */
async function loadRouterInfo(routerId) {
    try {
        // Récupérer les informations du routeur
        const routerRef = doc(db, 'routers', routerId);
        const docSnap = await getDoc(routerRef);
        
        if (docSnap.exists()) {
            const router = docSnap.data();
            
            // Mettre à jour le fil d'Ariane
            document.getElementById('routerBreadcrumb').textContent = router.name;
            document.getElementById('routerBreadcrumb').href = `router-dashboard.html?id=${routerId}`;
            
            // Mettre à jour le titre de la page
            document.title = `Paramètres - ${router.name} - FastNetLite`;
        } else {
            console.error('Routeur non trouvé');
            alert('Routeur non trouvé');
            window.location.href = 'routers.html';
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des informations du routeur:', error);
    }
}

/**
 * Charger les paramètres généraux
 * @param {string} routerId - ID du routeur
 */
async function loadGeneralSettings(routerId) {
    try {
        // Récupérer les paramètres généraux
        const routerRef = doc(db, 'routers', routerId);
        const docSnap = await getDoc(routerRef);
        
        if (docSnap.exists()) {
            const router = docSnap.data();
            
            // Remplir le formulaire avec les données du routeur
            const routerNameElement = document.getElementById('routerName');
            if (routerNameElement) routerNameElement.value = router.name || '';
            
            const routerLocationElement = document.getElementById('routerLocation');
            if (routerLocationElement) routerLocationElement.value = router.location || '';
            
            const routerDescriptionElement = document.getElementById('routerDescription');
            if (routerDescriptionElement) routerDescriptionElement.value = router.description || '';
            
            const routerStatusElement = document.getElementById('routerStatus');
            if (routerStatusElement) routerStatusElement.value = router.status || 'active';
            
            // URL de connexion
            const routerConnectionUrlElement = document.getElementById('routerConnectionUrl');
            if (routerConnectionUrlElement) routerConnectionUrlElement.value = router.connectionUrl || '';
            
            // Paramètres de la page d'achat
            const buyPageTitleElement = document.getElementById('buyPageTitle');
            if (buyPageTitleElement) buyPageTitleElement.value = router.buyPageTitle || router.name || '';
            
            const buyPageSlugElement = document.getElementById('buyPageSlug');
            if (buyPageSlugElement) buyPageSlugElement.value = router.buyPageSlug || '';
            
            const buyPageDescriptionElement = document.getElementById('buyPageDescription');
            if (buyPageDescriptionElement) buyPageDescriptionElement.value = router.buyPageDescription || '';
            
            const enableBuyPageElement = document.getElementById('enableBuyPage');
            if (enableBuyPageElement) enableBuyPageElement.checked = router.enableBuyPage !== false;
            
            // Déterminer l'URL du serveur actuel
            const currentHost = window.location.protocol + '//' + window.location.host;
            console.log('Hôte actuel:', currentHost);
            
            // Mettre à jour le lien vers la page d'achat en utilisant l'URL du serveur actuel
            const buyPageLink = `${currentHost}/buy-code.html?id=${routerId}`;
            
            const buyPageLinkElement = document.getElementById('buyPageLink');
            if (buyPageLinkElement) buyPageLinkElement.value = buyPageLink;
            
            const viewBuyPageBtnElement = document.getElementById('viewBuyPageBtn');
            if (viewBuyPageBtnElement) viewBuyPageBtnElement.href = buyPageLink;
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des paramètres généraux:', error);
    }
}

// Fonction supprimée car les paramètres d'apparence ont été retirés

/**
 * Mettre à jour les liens de navigation
 * @param {string} routerId - ID du routeur
 */
function updateNavigationLinks(routerId) {
    // Liens de navigation du routeur
    document.getElementById('routerDashboardLink').href = `router-dashboard.html?id=${routerId}`;
    document.getElementById('routerWifiCodesLink').href = `wifi-codes.html?id=${routerId}`;
    document.getElementById('routerClientsLink').href = `clients.html?id=${routerId}`;
    document.getElementById('routerPaymentsLink').href = `payments.html?id=${routerId}`;
    document.getElementById('routerSettingsLink').href = `router-settings.html?id=${routerId}`;
}

/**
 * Charger les paramètres de paiement
 * @param {string} routerId - ID du routeur
 */
async function loadPaymentSettings(routerId) {
    try {
        // Récupérer les paramètres de paiement
        const settingsCollection = collection(db, 'routers', routerId, 'settings');
        const paymentRef = doc(settingsCollection, 'payment');
        const docSnap = await getDoc(paymentRef);
        
        if (docSnap.exists()) {
            const payment = docSnap.data();
            
            // Remplir le formulaire avec les données de paiement
            const fedapayApiKeyElement = document.getElementById('fedapayApiKey');
            if (fedapayApiKeyElement) fedapayApiKeyElement.value = payment.fedapayApiKey || '';
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des paramètres de paiement:', error);
    }
}

// Partie 3: Configuration des événements

/**
 * Configurer les gestionnaires d'événements
 * @param {string} routerId - ID du routeur
 */
function setupEventHandlers(routerId) {
    // Onglets de navigation
    const tabLinks = document.querySelectorAll('.nav-link');
    if (tabLinks && tabLinks.length > 0) {
        tabLinks.forEach(link => {
            if (link) {
                addSafeEventListener(link, 'click', function(e) {
                    e.preventDefault();
                    const tabId = this.getAttribute('href');
                    
                    // Vérifier si tabId est un sélecteur valide (commence par #)
                    if (!tabId || !tabId.startsWith('#')) {
                        // Si c'est une URL, naviguer vers cette URL
                        if (tabId && (tabId.includes('.html') || tabId.includes('/'))) {
                            window.location.href = tabId;
                            return;
                        }
                        return; // Ignorer les clics sur les liens invalides
                    }
                    
                    // Masquer tous les onglets
                    const tabPanes = document.querySelectorAll('.tab-pane');
                    if (tabPanes && tabPanes.length > 0) {
                        tabPanes.forEach(tab => {
                            if (tab) tab.classList.remove('show', 'active');
                        });
                    }
                    
                    // Désactiver tous les liens
                    if (tabLinks && tabLinks.length > 0) {
                        tabLinks.forEach(navLink => {
                            if (navLink) navLink.classList.remove('active');
                        });
                    }
                    
                    // Activer l'onglet sélectionné
                    const selectedTab = document.querySelector(tabId);
                    if (selectedTab) selectedTab.classList.add('show', 'active');
                    this.classList.add('active');
                    
                    // Mettre à jour l'URL
                    if (tabId) {
                        const url = new URL(window.location.href);
                        url.searchParams.set('tab', tabId.replace('#', ''));
                        window.history.pushState({}, '', url);
                    }
                });
            }
        });
    }
    
    // Activer l'onglet spécifié dans l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const tab = urlParams.get('tab');
    if (tab) {
        const tabLink = document.querySelector(`.nav-link[href="#${tab}"]`);
        if (tabLink) {
            tabLink.click();
        }
    }
    
    // Bouton principal pour enregistrer les modifications
    addSafeEventListener('saveSettingsBtn', 'click', function() {
        console.log('Bouton Enregistrer les modifications cliqué');
        // Déterminer quel onglet est actif et enregistrer les paramètres correspondants
        const activeTab = document.querySelector('.tab-pane.active');
        if (activeTab) {
            const tabId = activeTab.id;
            console.log('Onglet actif:', tabId);
            
            if (tabId === 'general') {
                saveGeneralSettings(routerId);
            } else if (tabId === 'payment') {
                savePaymentSettings(routerId);
            }
        }
    });
    
    // Formulaire des paramètres généraux
    addSafeEventListener('generalSettingsForm', 'submit', function(e) {
        e.preventDefault();
        saveGeneralSettings(routerId);
    });
    
    // Formulaire des paramètres de paiement
    addSafeEventListener('paymentSettingsForm', 'submit', function(e) {
        e.preventDefault();
        savePaymentSettings(routerId);
    });
    
    // Boutons de la zone dangereuse
    addSafeEventListener('deleteAllCodesBtn', 'click', function() {
        console.log('Bouton Supprimer tous les codes WiFi cliqué');
        // Afficher le modal de confirmation
        const confirmDeleteMessage = document.getElementById('confirmDeleteMessage');
        if (confirmDeleteMessage) {
            confirmDeleteMessage.textContent = 'Êtes-vous sûr de vouloir supprimer tous les codes WiFi de ce routeur ? Cette action est irréversible.';
        }
        
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.dataset.action = 'deleteAllCodes';
        }
        
        const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
        modal.show();
    });
    
    addSafeEventListener('deleteAllClientsBtn', 'click', function() {
        console.log('Bouton Supprimer tous les clients cliqué');
        // Afficher le modal de confirmation
        const confirmDeleteMessage = document.getElementById('confirmDeleteMessage');
        if (confirmDeleteMessage) {
            confirmDeleteMessage.textContent = 'Êtes-vous sûr de vouloir supprimer tous les clients de ce routeur ? Cette action est irréversible.';
        }
        
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.dataset.action = 'deleteAllClients';
        }
        
        const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
        modal.show();
    });
    
    addSafeEventListener('deleteRouterBtn', 'click', function() {
        console.log('Bouton Supprimer ce routeur cliqué');
        // Afficher le modal de confirmation
        const confirmDeleteMessage = document.getElementById('confirmDeleteMessage');
        if (confirmDeleteMessage) {
            confirmDeleteMessage.textContent = 'Êtes-vous sûr de vouloir supprimer ce routeur ? Toutes les données associées (codes WiFi, clients, paiements) seront définitivement supprimées. Cette action est irréversible.';
        }
        
        const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
        if (confirmDeleteBtn) {
            confirmDeleteBtn.dataset.action = 'deleteRouter';
        }
        
        const modal = new bootstrap.Modal(document.getElementById('confirmDeleteModal'));
        modal.show();
    });
    
    // Bouton de confirmation de suppression pour la zone dangereuse
    addSafeEventListener('confirmDeleteBtn', 'click', function() {
        const action = this.dataset.action;
        console.log('Action de confirmation:', action);
        
        // Exécuter l'action correspondante
        if (action === 'deleteAllCodes') {
            deleteAllCodes(routerId);
        } else if (action === 'deleteAllClients') {
            deleteAllClients(routerId);
        } else if (action === 'deleteRouter') {
            deleteRouter(routerId);
        }
        
        // Fermer le modal
        const modalElement = document.getElementById('confirmDeleteModal');
        if (modalElement) {
            const modal = bootstrap.Modal.getInstance(modalElement);
            if (modal) modal.hide();
        }
    });
    
    // Copier l'URL de callback FedaPay
    addSafeEventListener('copyCallbackUrlBtn', 'click', function() {
        const callbackUrl = document.getElementById('fedapayCallbackUrl');
        if (!callbackUrl) return;
        
        callbackUrl.select();
        document.execCommand('copy');
        
        // Afficher un message de confirmation
        this.innerHTML = '<i class="fas fa-check"></i> Copié';
        setTimeout(() => {
            this.innerHTML = '<i class="fas fa-copy"></i> Copier';
        }, 2000);
    });
}

// Partie 4: Fonctions de sauvegarde des paramètres et gestion des profils

/**
 * Sauvegarder les paramètres généraux
 * @param {string} routerId - ID du routeur
 */
function saveGeneralSettings(routerId) {
    // Afficher le spinner
    const saveSpinner = document.getElementById('generalSettingsSaveSpinner');
    const saveBtn = document.getElementById('saveSettingsBtn');
    
    if (saveSpinner) saveSpinner.classList.remove('d-none');
    if (saveBtn) saveBtn.disabled = true;
    
    // Récupérer les valeurs du formulaire
    const name = document.getElementById('routerName').value.trim();
    const location = document.getElementById('routerLocation').value.trim();
    const description = document.getElementById('routerDescription').value.trim();
    const status = document.getElementById('routerStatus').value;
    const connectionUrl = document.getElementById('routerConnectionUrl').value.trim();
    const buyPageTitle = document.getElementById('buyPageTitle').value.trim();
    const buyPageSlug = document.getElementById('buyPageSlug').value.trim();
    const buyPageDescription = document.getElementById('buyPageDescription').value.trim();
    const enableBuyPage = document.getElementById('enableBuyPage').checked;
    
    // Valider les données
    if (!name) {
        showError('generalSettingsError', 'Le nom du routeur est obligatoire');
        if (saveSpinner) saveSpinner.classList.add('d-none');
        if (saveBtn) saveBtn.disabled = false;
        return;
    }
    
    // Préparer les données à sauvegarder
    const data = {
        name,
        location,
        description,
        status,
        connectionUrl,
        buyPageTitle,
        buyPageSlug,
        buyPageDescription,
        enableBuyPage,
        updatedAt: serverTimestamp()
    };
    
    console.log('Sauvegarde des paramètres généraux:', data);
    
    // Sauvegarder les données
    const routerDocRef = doc(db, 'routers', routerId);
    updateDoc(routerDocRef, data)
        .then(() => {
            console.log('Paramètres généraux enregistrés avec succès');
            
            // Masquer le spinner
            if (saveSpinner) saveSpinner.classList.add('d-none');
            if (saveBtn) saveBtn.disabled = false;
            
            // Afficher un message de succès
            showSuccess('generalSettingsSuccess', 'Paramètres généraux enregistrés avec succès');
            
            // Mettre à jour le fil d'Ariane
            const routerBreadcrumb = document.getElementById('routerBreadcrumb');
            if (routerBreadcrumb) routerBreadcrumb.textContent = name;
            
            // Mettre à jour le titre de la page
            document.title = `Paramètres - ${name} - FastNetLite`;
            
            // Mettre à jour le lien vers la page d'achat
            const currentHost = window.location.protocol + '//' + window.location.host;
            const buyPageLink = `${currentHost}/buy-code.html?id=${routerId}`;
            
            const buyPageLinkElement = document.getElementById('buyPageLink');
            if (buyPageLinkElement) buyPageLinkElement.value = buyPageLink;
            
            const viewBuyPageBtnElement = document.getElementById('viewBuyPageBtn');
            if (viewBuyPageBtnElement) viewBuyPageBtnElement.href = buyPageLink;
        })
        .catch((error) => {
            console.error('Erreur lors de la sauvegarde des paramètres généraux:', error);
            
            // Masquer le spinner
            if (saveSpinner) saveSpinner.classList.add('d-none');
            if (saveBtn) saveBtn.disabled = false;
            
            // Afficher un message d'erreur
            showError('generalSettingsError', `Erreur lors de la sauvegarde des paramètres généraux: ${error.message}`);
        });
}

/**
 * Sauvegarder les paramètres de paiement
 * @param {string} routerId - ID du routeur
 */
function savePaymentSettings(routerId) {
    // Afficher le spinner
    const saveSpinner = document.getElementById('paymentSettingsSaveSpinner');
    const saveBtn = document.getElementById('saveSettingsBtn');
    
    if (saveSpinner) saveSpinner.classList.remove('d-none');
    if (saveBtn) saveBtn.disabled = true;
    
    // Récupérer les valeurs du formulaire
    const fedapayApiKey = document.getElementById('fedapayApiKey').value.trim();
    
    // Préparer les données à sauvegarder
    const data = {
        fedapayApiKey,
        updatedAt: serverTimestamp()
    };
    
    console.log('Sauvegarde des paramètres de paiement:', data);
    
    // Sauvegarder les données
    const paymentDocRef = doc(db, 'routers', routerId, 'settings', 'payment');
    setDoc(paymentDocRef, data, { merge: true })
        .then(() => {
            console.log('Paramètres de paiement enregistrés avec succès');
            
            // Masquer le spinner
            if (saveSpinner) saveSpinner.classList.add('d-none');
            if (saveBtn) saveBtn.disabled = false;
            
            // Afficher un message de succès
            showSuccess('paymentSettingsSuccess', 'Paramètres de paiement enregistrés avec succès');
            
            // Mettre à jour également la clé API dans le document principal du routeur pour faciliter l'accès
            const routerDocRef = doc(db, 'routers', routerId);
            updateDoc(routerDocRef, {
                fedapayApiKey,
                updatedAt: serverTimestamp()
            }).catch(err => {
                console.warn('Erreur lors de la mise à jour de la clé API dans le document principal:', err);
            });
        })
        .catch((error) => {
            console.error('Erreur lors de la sauvegarde des paramètres de paiement:', error);
            
            // Masquer le spinner
            if (saveSpinner) saveSpinner.classList.add('d-none');
            if (saveBtn) saveBtn.disabled = false;
            
            // Afficher un message d'erreur
            showError('paymentSettingsError', `Erreur lors de la sauvegarde des paramètres de paiement: ${error.message}`);
        });
}
/**
 * Afficher un message de succès
 * @param {string} elementId - ID de l'élément
 * @param {string} message - Message à afficher
 */
function showSuccess(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = message;
    element.classList.remove('d-none');
    
    // Masquer le message après 3 secondes
    setTimeout(() => {
        element.classList.add('d-none');
    }, 3000);
}

/**
 * Afficher un message d'erreur
 * @param {string} elementId - ID de l'élément
 * @param {string} message - Message à afficher
 */
function showError(elementId, message) {
    const element = document.getElementById(elementId);
    if (!element) return;
    
    element.textContent = message;
    element.classList.remove('d-none');
    
    // Masquer le message après 3 secondes
    setTimeout(() => {
        element.classList.add('d-none');
    }, 3000);
}

/**
 * Supprimer tous les codes WiFi d'un routeur
 * @param {string} routerId - ID du routeur
 */
async function deleteAllCodes(routerId) {
    try {
        console.log(`Suppression de tous les codes WiFi du routeur ${routerId}`);
        
        // Afficher un indicateur de chargement
        const dangerZoneCard = document.querySelector('#danger .card-body');
        if (dangerZoneCard) {
            const loadingElement = document.createElement('div');
            loadingElement.id = 'deleteCodesLoading';
            loadingElement.innerHTML = `
                <div class="d-flex justify-content-center align-items-center my-4">
                    <div class="spinner-border text-danger" role="status">
                        <span class="visually-hidden">Suppression en cours...</span>
                    </div>
                    <span class="ms-2">Suppression des codes WiFi en cours...</span>
                </div>
            `;
            dangerZoneCard.appendChild(loadingElement);
        }
        
        // Récupérer tous les codes WiFi du routeur
        const codesCollection = collection(db, 'wifiCodes');
        const q = query(codesCollection, where('routerId', '==', routerId));
        const querySnapshot = await getDocs(q);
        
        // Vérifier s'il y a des codes à supprimer
        if (querySnapshot.empty) {
            console.log('Aucun code WiFi trouvé pour ce routeur');
            alert('Aucun code WiFi trouvé pour ce routeur.');
            
            // Supprimer l'indicateur de chargement
            const loadingElement = document.getElementById('deleteCodesLoading');
            if (loadingElement) loadingElement.remove();
            
            return;
        }
        
        // Supprimer les codes par lots pour éviter de dépasser les limites de Firebase
        const batchSize = 500;
        let count = 0;
        let batch = writeBatch(db);
        
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            count++;
            
            // Si le lot atteint la taille maximale, le soumettre et en créer un nouveau
            if (count % batchSize === 0) {
                batch.commit();
                batch = writeBatch(db);
            }
        });
        
        // Soumettre le dernier lot s'il reste des documents
        if (count % batchSize !== 0) {
            await batch.commit();
        }
        
        console.log(`${count} codes WiFi supprimés avec succès`);
        
        // Supprimer l'indicateur de chargement
        const loadingElement = document.getElementById('deleteCodesLoading');
        if (loadingElement) loadingElement.remove();
        
        // Mettre à jour le compteur de codes dans le routeur
        const routerRef = doc(db, 'routers', routerId);
        await updateDoc(routerRef, {
            codesCount: 0,
            updatedAt: serverTimestamp()
        });
        
        alert(`${count} codes WiFi ont été supprimés avec succès.`);
    } catch (error) {
        console.error('Erreur lors de la suppression des codes WiFi:', error);
        alert(`Erreur lors de la suppression des codes WiFi: ${error.message}`);
        
        // Supprimer l'indicateur de chargement
        const loadingElement = document.getElementById('deleteCodesLoading');
        if (loadingElement) loadingElement.remove();
    }
}

/**
 * Supprimer tous les clients d'un routeur
 * @param {string} routerId - ID du routeur
 */
async function deleteAllClients(routerId) {
    try {
        console.log(`Suppression de tous les clients du routeur ${routerId}`);
        
        // Afficher un indicateur de chargement
        const dangerZoneCard = document.querySelector('#danger .card-body');
        if (dangerZoneCard) {
            const loadingElement = document.createElement('div');
            loadingElement.id = 'deleteClientsLoading';
            loadingElement.innerHTML = `
                <div class="d-flex justify-content-center align-items-center my-4">
                    <div class="spinner-border text-danger" role="status">
                        <span class="visually-hidden">Suppression en cours...</span>
                    </div>
                    <span class="ms-2">Suppression des clients en cours...</span>
                </div>
            `;
            dangerZoneCard.appendChild(loadingElement);
        }
        
        // Récupérer tous les clients du routeur
        const clientsCollection = collection(db, 'clients');
        const q = query(clientsCollection, where('routerId', '==', routerId));
        const querySnapshot = await getDocs(q);
        
        // Vérifier s'il y a des clients à supprimer
        if (querySnapshot.empty) {
            console.log('Aucun client trouvé pour ce routeur');
            alert('Aucun client trouvé pour ce routeur.');
            
            // Supprimer l'indicateur de chargement
            const loadingElement = document.getElementById('deleteClientsLoading');
            if (loadingElement) loadingElement.remove();
            
            return;
        }
        
        // Supprimer les clients par lots pour éviter de dépasser les limites de Firebase
        const batchSize = 500;
        let count = 0;
        let batch = writeBatch(db);
        
        querySnapshot.forEach((doc) => {
            batch.delete(doc.ref);
            count++;
            
            // Si le lot atteint la taille maximale, le soumettre et en créer un nouveau
            if (count % batchSize === 0) {
                batch.commit();
                batch = writeBatch(db);
            }
        });
        
        // Soumettre le dernier lot s'il reste des documents
        if (count % batchSize !== 0) {
            await batch.commit();
        }
        
        console.log(`${count} clients supprimés avec succès`);
        
        // Supprimer l'indicateur de chargement
        const loadingElement = document.getElementById('deleteClientsLoading');
        if (loadingElement) loadingElement.remove();
        
        // Mettre à jour le compteur de clients dans le routeur
        const routerRef = doc(db, 'routers', routerId);
        await updateDoc(routerRef, {
            clientsCount: 0,
            updatedAt: serverTimestamp()
        });
        
        alert(`${count} clients ont été supprimés avec succès.`);
    } catch (error) {
        console.error('Erreur lors de la suppression des clients:', error);
        alert(`Erreur lors de la suppression des clients: ${error.message}`);
        
        // Supprimer l'indicateur de chargement
        const loadingElement = document.getElementById('deleteClientsLoading');
        if (loadingElement) loadingElement.remove();
    }
}

/**
 * Supprimer un routeur et toutes ses données associées
 * @param {string} routerId - ID du routeur
 */
async function deleteRouter(routerId) {
    try {
        console.log(`Suppression du routeur ${routerId} et de toutes ses données associées`);
        
        // Afficher un indicateur de chargement
        const dangerZoneCard = document.querySelector('#danger .card-body');
        if (dangerZoneCard) {
            const loadingElement = document.createElement('div');
            loadingElement.id = 'deleteRouterLoading';
            loadingElement.innerHTML = `
                <div class="d-flex justify-content-center align-items-center my-4">
                    <div class="spinner-border text-danger" role="status">
                        <span class="visually-hidden">Suppression en cours...</span>
                    </div>
                    <span class="ms-2">Suppression du routeur et de toutes ses données en cours...</span>
                </div>
            `;
            dangerZoneCard.appendChild(loadingElement);
        }
        
        // 1. Supprimer tous les codes WiFi
        const codesCollection = collection(db, 'wifiCodes');
        const codesQuery = query(codesCollection, where('routerId', '==', routerId));
        const codesSnapshot = await getDocs(codesQuery);
        
        let codesCount = 0;
        let codesBatch = writeBatch(db);
        
        codesSnapshot.forEach((doc) => {
            codesBatch.delete(doc.ref);
            codesCount++;
            
            // Si le lot atteint la taille maximale, le soumettre et en créer un nouveau
            if (codesCount % 500 === 0) {
                codesBatch.commit();
                codesBatch = writeBatch(db);
            }
        });
        
        // Soumettre le dernier lot s'il reste des documents
        if (codesCount % 500 !== 0) {
            await codesBatch.commit();
        }
        
        console.log(`${codesCount} codes WiFi supprimés`);
        
        // 2. Supprimer tous les clients
        const clientsCollection = collection(db, 'clients');
        const clientsQuery = query(clientsCollection, where('routerId', '==', routerId));
        const clientsSnapshot = await getDocs(clientsQuery);
        
        let clientsCount = 0;
        let clientsBatch = writeBatch(db);
        
        clientsSnapshot.forEach((doc) => {
            clientsBatch.delete(doc.ref);
            clientsCount++;
            
            // Si le lot atteint la taille maximale, le soumettre et en créer un nouveau
            if (clientsCount % 500 === 0) {
                clientsBatch.commit();
                clientsBatch = writeBatch(db);
            }
        });
        
        // Soumettre le dernier lot s'il reste des documents
        if (clientsCount % 500 !== 0) {
            await clientsBatch.commit();
        }
        
        console.log(`${clientsCount} clients supprimés`);
        
        // 3. Supprimer tous les paiements
        const paymentsCollection = collection(db, 'payments');
        const paymentsQuery = query(paymentsCollection, where('routerId', '==', routerId));
        const paymentsSnapshot = await getDocs(paymentsQuery);
        
        let paymentsCount = 0;
        let paymentsBatch = writeBatch(db);
        
        paymentsSnapshot.forEach((doc) => {
            paymentsBatch.delete(doc.ref);
            paymentsCount++;
            
            // Si le lot atteint la taille maximale, le soumettre et en créer un nouveau
            if (paymentsCount % 500 === 0) {
                paymentsBatch.commit();
                paymentsBatch = writeBatch(db);
            }
        });
        
        // Soumettre le dernier lot s'il reste des documents
        if (paymentsCount % 500 !== 0) {
            await paymentsBatch.commit();
        }
        
        console.log(`${paymentsCount} paiements supprimés`);
        
        // 4. Supprimer tous les paramètres du routeur
        const settingsCollection = collection(db, 'routers', routerId, 'settings');
        const settingsSnapshot = await getDocs(settingsCollection);
        
        let settingsCount = 0;
        let settingsBatch = writeBatch(db);
        
        settingsSnapshot.forEach((doc) => {
            settingsBatch.delete(doc.ref);
            settingsCount++;
        });
        
        // Soumettre le lot de paramètres
        if (settingsCount > 0) {
            await settingsBatch.commit();
        }
        
        console.log(`${settingsCount} paramètres supprimés`);
        
        // 5. Supprimer le routeur lui-même
        const routerRef = doc(db, 'routers', routerId);
        await deleteDoc(routerRef);
        
        console.log('Routeur supprimé avec succès');
        
        // Supprimer l'indicateur de chargement
        const loadingElement = document.getElementById('deleteRouterLoading');
        if (loadingElement) loadingElement.remove();
        
        alert('Le routeur et toutes ses données associées ont été supprimés avec succès. Vous allez être redirigé vers la liste des routeurs.');
        
        // Rediriger vers la liste des routeurs
        window.location.href = 'routers.html';
    } catch (error) {
        console.error('Erreur lors de la suppression du routeur:', error);
        alert(`Erreur lors de la suppression du routeur: ${error.message}`);
        
        // Supprimer l'indicateur de chargement
        const loadingElement = document.getElementById('deleteRouterLoading');
        if (loadingElement) loadingElement.remove();
    }
}
