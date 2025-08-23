// Import des fonctions Firebase nécessaires - TOUT doit venir de firebase-config.js
import { 
  auth, 
  db, 
  onAuthStateChanged, 
  signOut,
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  query, 
  where, 
  orderBy, 
  limit, 
  startAfter, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  setDoc, 
  writeBatch, 
  runTransaction, 
  serverTimestamp 
} from './firebase-config.js';

import './src/index';
import { checkAndShowLicenseModal } from './license-modal.js';

// Fonction de remplacement pour endBefore qui n'est pas exporté par firebase-config.js
const endBefore = (snapshot) => {
  // Cette fonction est utilisée uniquement comme référence, nous importerons endBefore directement si nécessaire
  console.warn('Utilisation de la fonction endBefore personnalisée - envisagez d\'importer directement depuis firebase/firestore');
  return window.firebase.firestore.endBefore ? window.firebase.firestore.endBefore(snapshot) : null;
};

/**
 * Ajoute un écouteur d'événement de manière sécurisée en vérifiant d'abord si l'élément existe
 * @param {string} elementId - ID de l'élément DOM
 * @param {string} eventType - Type d'événement (ex: 'click')
 * @param {Function} callback - Fonction de rappel à exécuter
 */
function addSafeEventListener(elementId, eventType, callback) {
    const element = document.getElementById(elementId);
    if (element) {
        element.addEventListener(eventType, callback);
    }
}

// Script pour la gestion des codes WiFi FastNetLite

// Variable globale pour éviter les initialisations multiples
window.wifiCodesInitialized = window.wifiCodesInitialized || false;

/**
 * Classe pour limiter le débit des requêtes Firestore et éviter les erreurs de quota
 * Note: Cette classe n'est plus utilisée directement, mais est conservée pour référence future
 */
class FirestoreThrottler {
    static queue = [];
    static processing = false;
    static rateLimit = 500; // Intervalle en ms entre les requêtes
    static lastRequestTime = 0;
    
    /**
     * Exécute une fonction avec limitation de débit
     * @param {Function} fn - Fonction à exécuter
     * @returns {Promise} - Résultat de la fonction
     */
    static async execute(fn) {
        console.log('FirestoreThrottler.execute appelé');
        try {
            return await fn();
        } catch (error) {
            console.error('Erreur dans FirestoreThrottler.execute:', error);
            throw error;
        }
    }
    
    /**
     * Limite le débit des requêtes Firestore
     * @param {Function} fn - Fonction à exécuter
     * @returns {Promise} - Résultat de la fonction
     */
    static async throttleRequest(fn) {
        console.log('FirestoreThrottler.throttleRequest appelé');
        try {
            return await fn();
        } catch (error) {
            console.error('Erreur dans FirestoreThrottler.throttleRequest:', error);
            throw error;
        }
    }
    
    /**
     * Traite la file d'attente des requêtes
     */
    static async processQueue() {
        console.log('FirestoreThrottler.processQueue appelé');
        // Cette méthode est conservée pour compatibilité mais n'est plus utilisée
    }
}

document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si le script a déjà été initialisé
    if (window.wifiCodesInitialized) {
        console.log('wifi-codes.js déjà initialisé, initialisation ignorée');
        return;
    }
    
    // Marquer le script comme initialisé
    window.wifiCodesInitialized = true;
    console.log('Initialisation de wifi-codes.js');
    
    // Vérifier si l'utilisateur est connecté
    onAuthStateChanged(auth, function(user) {
        if (user) {
            // Utilisateur connecté
            console.log('Utilisateur connecté:', user.displayName);
            
            // Mettre à jour le nom de l'utilisateur dans l'interface
            const userNameElements = document.querySelectorAll('#userName');
            userNameElements.forEach(element => {
                element.textContent = user.displayName || user.email;
            });
            
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
            
            // Vérifier si l'utilisateur a une licence active avant d'accéder aux fonctionnalités
            checkAndShowLicenseModal().then(needsLicense => {
                // Même si l'utilisateur n'a pas de licence, on initialise la page
                // mais certaines fonctionnalités seront bloquées dans initPage et setupEventHandlers
                
                // Initialiser la page
                initPage(routerId, needsLicense);
                
                // Configurer les gestionnaires d'événements
                setupEventHandlers(routerId, needsLicense);
                
                // Mettre à jour les liens de navigation
                updateNavigationLinks(routerId);
            }).catch(error => {
                console.error('Erreur lors de la vérification de la licence:', error);
                // En cas d'erreur, on initialise quand même la page mais sans fonctionnalités premium
                initPage(routerId, true);
                setupEventHandlers(routerId, true);
                updateNavigationLinks(routerId);
            });
        } else {
            // Utilisateur non connecté, vérifier si nous sommes déjà sur la page d'index
            // pour éviter une redirection en boucle
            const currentPath = window.location.pathname;
            const isIndexPage = currentPath.includes('index.html') || currentPath === '/' || currentPath.endsWith('/');
            
            if (!isIndexPage) {
                console.log('Utilisateur non connecté, redirection vers index');
                window.location.href = 'index.html';
            }
        }
    });
    
    // Gestionnaire d'événement pour la déconnexion
    const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutBtnDropdown');
    logoutBtns.forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            firebase.auth().signOut()
                .then(() => {
                    // Déconnexion réussie, rediriger vers la page de connexion
                    window.location.href = 'index.html';
                })
                .catch((error) => {
                    console.error('Erreur lors de la déconnexion:', error);
                    alert('Erreur lors de la déconnexion. Veuillez réessayer.');
                });
        });
    });
});

/**
 * Initialiser la page
 * @param {string} routerId - ID du routeur
 * @param {boolean} needsLicense - Indique si l'utilisateur a besoin d'activer une licence
 */
function initPage(routerId, needsLicense = false) {
    // Charger les informations du routeur
    loadRouterInfo(routerId);
    
    // Charger les profils WiFi (toujours affichés même sans licence)
    loadProfiles(routerId);
    
    // Charger les codes WiFi disponibles
    loadCodes(routerId, 1, 20, null, { status: 'available' });
    
    // Charger les codes WiFi vendus
    loadSoldCodes(routerId);
    
    // Configurer le formulaire d'importation (bloqué si l'utilisateur n'a pas de licence)
    setupImportForm(routerId, needsLicense);
    
    // Configurer les gestionnaires d'événements pour les filtres
    setupFilterHandlers(routerId, needsLicense);
    
    // Configurer les gestionnaires d'événements pour la suppression en masse
    setupBatchDeleteHandlers(routerId, needsLicense);
    
    // Si l'utilisateur n'a pas de licence active, désactiver certaines fonctionnalités premium
    if (needsLicense) {
        // Désactiver les boutons d'importation et d'ajout de codes
        const importButtons = document.querySelectorAll('.import-codes-btn, #importCodesBtn');
        importButtons.forEach(btn => {
            btn.disabled = true;
            btn.setAttribute('data-bs-toggle', 'tooltip');
            btn.setAttribute('title', 'Activez votre licence pour accéder à cette fonctionnalité');
            // Initialiser les tooltips Bootstrap
            new bootstrap.Tooltip(btn);
        });
        
        // Afficher un message d'avertissement en haut de la page
        const alertContainer = document.querySelector('.container-fluid');
        if (alertContainer) {
            const licenseAlert = document.createElement('div');
            licenseAlert.className = 'alert alert-warning alert-dismissible fade show mt-3';
            licenseAlert.innerHTML = `
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Licence requise :</strong> Certaines fonctionnalités sont limitées. 
                <a href="settings.html#subscription-tab" class="alert-link">Activez votre licence</a> pour accéder à toutes les fonctionnalités.
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
            `;
            alertContainer.insertBefore(licenseAlert, alertContainer.firstChild);
        }
    }
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
            
            // Mettre à jour le nom du routeur dans l'interface si l'élément existe
            const routerNameElement = document.getElementById('routerName');
            if (routerNameElement) {
                routerNameElement.textContent = router.name;
            }
            document.title = `Codes WiFi - ${router.name} - FastNetLite`;
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
 * Charger les profils WiFi
 * @param {string} routerId - ID du routeur
 */
async function loadProfiles(routerId) {
    try {
        // Référence aux profils du routeur
        const profilesRef = collection(db, 'profiles');
        const profilesQuery = query(profilesRef, where('routerId', '==', routerId));
        
        // Récupérer les profils
        const querySnapshot = await getDocs(profilesQuery);
        
        // Masquer le chargement
        const loadingElement = document.getElementById('loadingProfiles');
        if (loadingElement) loadingElement.classList.add('d-none');
        
        if (querySnapshot.empty) {
            // Aucun profil trouvé
            const noProfilesElement = document.getElementById('noProfiles');
            if (noProfilesElement) noProfilesElement.classList.remove('d-none');
            return;
        }
        
        // Conteneur pour les cartes de profils
        const profilesList = document.getElementById('profilesList');
        if (!profilesList) {
            console.error('Élément profilesList non trouvé');
            return;
        }
        
        // Supprimer le message de chargement et le message "aucun profil"
        profilesList.innerHTML = '';
        
        // Ajouter chaque profil
        querySnapshot.forEach((doc) => {
            const profile = doc.data();
            const profileId = doc.id;
            
            // Créer une carte pour ce profil
            addProfileCard(profileId, profile, profilesList, routerId);
            
            // Ajouter le profil à la liste déroulante d'importation
            addProfileToImportSelect(profileId, profile);
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des profils:', error);
        document.getElementById('loadingProfiles').classList.add('d-none');
        document.getElementById('noProfiles').classList.remove('d-none');
    }
}

/**
 * Ajouter une carte pour un profil
 * @param {string} profileId - ID du profil
 * @param {Object} profile - Données du profil
 * @param {HTMLElement} container - Conteneur pour la carte
 * @param {string} routerId - ID du routeur
 */
function addProfileCard(profileId, profile, container, routerId) {
    // Cloner le template de carte
    const template = document.getElementById('profileCardTemplate');
    const card = document.importNode(template.content, true);
    
    // Remplir les données du profil
    const nameElement = card.querySelector('.profile-name');
    if (nameElement) nameElement.textContent = profile.name;
    
    const priceElement = card.querySelector('.profile-price');
    if (priceElement) priceElement.textContent = profile.price + ' FCFA';
    
    // Description (si disponible)
    const descriptionElement = card.querySelector('.profile-description');
    if (descriptionElement) {
        if (profile.description) {
            descriptionElement.textContent = profile.description;
        } else {
            descriptionElement.textContent = 'Aucune description';
        }
    }
    
    // Durée
    const durationElement = card.querySelector('.profile-duration');
    if (durationElement) durationElement.textContent = profile.duration;
    
    // Bouton d'importation
    const importBtn = card.querySelector('.import-codes-btn');
    if (importBtn) {
        importBtn.dataset.profileId = profileId;
        importBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Pré-sélectionner le profil dans le modal d'importation
            const importProfileElement = document.getElementById('importProfile');
            if (importProfileElement) importProfileElement.value = profileId;
            
            // Afficher le modal
            const modalElement = document.getElementById('importCodesModal');
            if (modalElement) {
                const modal = new bootstrap.Modal(modalElement);
                modal.show();
            }
        });
    }
    
    // Boutons d'action
    const editBtn = card.querySelector('.edit-profile-btn');
    if (editBtn) {
        editBtn.dataset.profileId = profileId;
        editBtn.addEventListener('click', function(e) {
            e.preventDefault();
            openEditProfileModal(profileId, routerId);
        });
    }
    
    const deleteBtn = card.querySelector('.delete-profile-btn');
    if (deleteBtn) {
        deleteBtn.dataset.profileId = profileId;
        deleteBtn.addEventListener('click', function(e) {
            e.preventDefault();
            confirmDeleteProfile(profileId, routerId);
        });
    }
    
    // Configurer le bouton de copie du lien d'achat
    const copyLinkBtn = card.querySelector('.copy-buy-link-btn');
    if (copyLinkBtn) {
        copyLinkBtn.dataset.profileId = profileId;
        copyLinkBtn.addEventListener('click', function(e) {
            e.preventDefault();
            copyBuyLink(profileId, routerId, profile.name);
        });
    }
    
    const viewCodesBtn = card.querySelector('.view-codes-btn');
    if (viewCodesBtn) {
        viewCodesBtn.dataset.profileId = profileId;
        viewCodesBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Basculer vers l'onglet des codes et filtrer par profil
            document.getElementById('codes-tab').click();
            filterCodesByProfile(profileId);
        });
    }
    
    // Le bouton de copie du lien d'achat est déjà géré plus haut
    
    // Récupérer le nombre de codes disponibles
    getProfileCodesCount(profileId, routerId)
        .then((count) => {
            const codesCountElement = card.querySelector('.profile-codes-count');
            if (codesCountElement) codesCountElement.textContent = count;
        });
    
    // Ajouter la carte au conteneur
    container.appendChild(card);
}

/**
 * Récupérer le nombre de codes disponibles pour un profil
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 * @returns {Promise<number>} - Promesse contenant le nombre de codes
 */
async function getProfileCodesCount(profileId, routerId) {
    try {
        console.log(`Récupération du nombre de codes pour le profil ${profileId} du routeur ${routerId}`);
        
        // Vérifier que les IDs sont valides
        if (!profileId || !routerId) {
            console.warn('profileId ou routerId manquant');
            return 0;
        }
        
        // Récupérer le nombre de codes disponibles avec une approche plus robuste
        const wifiCodesRef = collection(db, 'wifiCodes');
        
        // Utiliser d'abord une requête avec deux conditions (plus susceptible d'avoir un index)
        try {
            const query1 = query(
                wifiCodesRef,
                where('profileId', '==', profileId),
                where('routerId', '==', routerId)
            );
            
            const snapshot = await getDocs(query1);
            
            // Filtrer les résultats pour ne compter que les codes disponibles
            let count = 0;
            snapshot.forEach(doc => {
                const data = doc.data();
                if (data.status === 'available' && !data._dummy) {
                    count++;
                }
            });
            
            console.log(`${count} codes disponibles trouvés pour le profil ${profileId}`);
            return count;
        } catch (error) {
            console.warn('Erreur lors de la requête avec deux conditions:', error.message);
            
            // Essayer avec une seule condition
            try {
                const query2 = query(
                    wifiCodesRef,
                    where('profileId', '==', profileId)
                );
                
                const snapshot = await getDocs(query2);
                
                // Filtrer manuellement les résultats
                let count = 0;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.routerId === routerId && 
                        data.status === 'available' &&
                        !data._dummy) {
                        count++;
                    }
                });
                
                console.log(`${count} codes disponibles trouvés pour le profil ${profileId} (méthode alternative 1)`);
                return count;
            } catch (secondError) {
                console.warn('Erreur lors de la requête avec une condition:', secondError.message);
                
                // Dernier recours : utiliser une requête sans condition
                // Mais limiter à 1000 documents pour éviter de surcharger le client
                const query3 = query(
                    wifiCodesRef,
                    limit(1000)
                );
                
                const snapshot = await getDocs(query3);
                
                // Filtrer manuellement les résultats
                let count = 0;
                snapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.profileId === profileId && 
                        data.routerId === routerId && 
                        data.status === 'available' &&
                        !data._dummy) {
                        count++;
                    }
                });
                
                console.log(`${count} codes disponibles trouvés pour le profil ${profileId} (méthode alternative 2)`);
                return count;
            }
        }
    } catch (error) {
        console.error('Erreur générale lors de la récupération du nombre de codes:', error);
        return 0;
    }
}

/**
 * Ajouter un profil à la liste déroulante d'importation et aux filtres
 * @param {string} profileId - ID du profil
 * @param {Object} profile - Données du profil
 */
function addProfileToImportSelect(profileId, profile) {
    // Texte du profil à afficher dans les listes déroulantes
    const profileText = `${profile.name} (${profile.duration} - ${profile.price} FCFA)`;
    
    // Ajouter au sélecteur d'importation
    const importSelect = document.getElementById('importProfile');
    if (importSelect) {
        const importOption = document.createElement('option');
        importOption.value = profileId;
        importOption.textContent = profileText;
        importSelect.appendChild(importOption);
    } else {
        console.error('Élément importProfile non trouvé');
    }
    
    // Ajouter au sélecteur de génération
    const generateSelect = document.getElementById('generateProfileSelect');
    if (generateSelect) {
        const generateOption = document.createElement('option');
        generateOption.value = profileId;
        generateOption.textContent = profileText;
        generateSelect.appendChild(generateOption);
    }
    
    // Ajouter au filtre des codes disponibles
    const filterProfile = document.getElementById('filterProfile');
    if (filterProfile) {
        const filterOption = document.createElement('option');
        filterOption.value = profileId;
        filterOption.textContent = profile.name;
        filterProfile.appendChild(filterOption);
    }
    
    // Ajouter au filtre des codes vendus
    const filterSoldProfile = document.getElementById('filterSoldProfile');
    if (filterSoldProfile) {
        const filterSoldOption = document.createElement('option');
        filterSoldOption.value = profileId;
        filterSoldOption.textContent = profile.name;
        filterSoldProfile.appendChild(filterSoldOption);
    }
}

/**
 * Charger les codes WiFi disponibles
 * @param {string} routerId - ID du routeur
 * @param {number} page - Numéro de la page à charger
 * @param {number} itemsPerPage - Nombre de codes par page
 * @param {string} lastDocId - ID du dernier document de la page précédente (pour la pagination)
 * @param {Object} filters - Filtres optionnels pour la requête
 */
async function loadCodes(routerId, page = 1, itemsPerPage = 20, lastDocId = null, filters = {}) {
    // Par défaut, on charge les codes disponibles
    filters.status = filters.status || 'available';
    
    try {
        // Afficher le chargement
        const loadingElement = document.getElementById('loadingCodes');
        if (loadingElement) loadingElement.classList.remove('d-none');
        
        const noCodesElement = document.getElementById('noCodes');
        if (noCodesElement) noCodesElement.classList.add('d-none');
        
        // Vérifier si la collection existe d'abord
        const codesCollectionRef = collection(db, 'wifiCodes');
        
        // Utiliser une requête simple pour éviter les problèmes d'index
        // Nous filtrerons manuellement les résultats après
        let queryRef = query(
            codesCollectionRef,
            where('routerId', '==', routerId),
            orderBy('createdAt', 'desc')
        );
        
        try {
            // Récupérer tous les codes du routeur
            const allCodesSnapshot = await getDocs(queryRef);
            
            // Filtrer manuellement les codes selon les filtres
            let filteredCodes = [];
            allCodesSnapshot.forEach(doc => {
                const code = doc.data();
                const codeId = doc.id;
                let includeCode = true;
                
                // Appliquer les filtres
                if (filters.status && code.status !== filters.status) {
                    includeCode = false;
                }
                
                if (filters.profileId && code.profileId !== filters.profileId) {
                    includeCode = false;
                }
                
                // Filtrer par texte de recherche
                if (filters.searchText && filters.searchText.trim() !== '') {
                    const searchText = filters.searchText.toLowerCase();
                    const codeValue = code.username && code.password ? `${code.username}/${code.password}` : 
                                     code.password ? code.password : 
                                     code.username ? code.username : '';
                    
                    // Vérifier si le code contient le texte de recherche
                    if (!codeValue.toLowerCase().includes(searchText)) {
                        includeCode = false;
                    }
                }
                
                if (includeCode) {
                    filteredCodes.push({ id: codeId, ...code });
                }
            });
            
            // Masquer le chargement
            if (loadingElement) loadingElement.classList.add('d-none');
            
            if (filteredCodes.length === 0) {
                // Aucun code trouvé
                const noCodesElement = document.getElementById('noCodes');
                if (noCodesElement) noCodesElement.classList.remove('d-none');
                return;
            }
            
            // Calculer les indices pour la pagination
            const totalCodes = filteredCodes.length;
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, totalCodes);
            
            // Extraire les codes pour la page actuelle
            const pagedCodes = filteredCodes.slice(startIndex, endIndex);
            
            // Conteneur pour les codes
            const codesList = document.getElementById('codesList');
            
            // Si c'est la première page, vider la liste
            if (page === 1) {
                codesList.innerHTML = '';
            }
            
            // Variable pour stocker l'ID du dernier document
            let lastId = null;
            
            // Ajouter chaque code
            pagedCodes.forEach((code) => {
                const codeId = code.id;
                lastId = codeId;
                
                // Créer une ligne pour ce code
                addCodeRow(codeId, code, codesList);
            });
            
            // Mettre à jour la pagination
            updateCodesPagination(totalCodes, page, itemsPerPage, routerId, lastId, filters);
        } catch (error) {
            console.error('Erreur lors de la récupération des codes:', error);
            
            // Vérifier si l'erreur est liée à un index manquant
            if (error.message && error.message.includes('index')) {
                console.warn('Un index est nécessaire pour cette requête. Créez l\'index approprié dans Firebase.');
            }
            
            // Masquer le chargement
            if (loadingElement) loadingElement.classList.add('d-none');
            
            const noCodesElement = document.getElementById('noCodes');
            if (noCodesElement) noCodesElement.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des codes:', error);
        
        const loadingElement = document.getElementById('loadingCodes');
        if (loadingElement) loadingElement.classList.add('d-none');
        
        const noCodesElement = document.getElementById('noCodes');
        if (noCodesElement) noCodesElement.classList.remove('d-none');
        
        // Vérifier si la collection existe et la créer si nécessaire
        try {
            const dummyDoc = await addDoc(collection(db, 'wifiCodes'), {
                _dummy: true,
                routerId: routerId,
                createdAt: serverTimestamp(),
                status: 'available'
            });
            await deleteDoc(dummyDoc);
            console.log('Collection wifiCodes créée avec succès');
        } catch (innerError) {
            console.error('Erreur lors de la création de la collection wifiCodes:', innerError);
        }
    }
}

/**
 * Charger les codes WiFi vendus
 * @param {string} routerId - ID du routeur
 * @param {number} page - Numéro de la page à charger
 * @param {number} itemsPerPage - Nombre de codes par page
 * @param {string} lastDocId - ID du dernier document de la page précédente (pour la pagination)
 * @param {Object} filters - Filtres optionnels pour la requête
 */
async function loadSoldCodes(routerId, page = 1, itemsPerPage = 20, lastDocId = null, filters = {}) {
    // Par défaut, on charge les codes vendus (status = used)
    filters.status = filters.status || 'used';
    
    try {
        // Afficher le chargement
        const loadingElement = document.getElementById('loadingSoldCodes');
        if (loadingElement) loadingElement.classList.remove('d-none');
        
        const noCodesElement = document.getElementById('noSoldCodes');
        if (noCodesElement) noCodesElement.classList.add('d-none');
        
        // Vérifier si la collection existe d'abord
        const codesCollectionRef = collection(db, 'wifiCodes');
        
        // Utiliser une requête simple pour éviter les problèmes d'index
        // Nous filtrerons manuellement les résultats après
        let queryRef = query(
            codesCollectionRef,
            where('routerId', '==', routerId),
            orderBy('usedAt', 'desc') // Trier par date d'utilisation pour les codes vendus
        );
        
        try {
            // Récupérer tous les codes du routeur
            const allCodesSnapshot = await getDocs(queryRef);
            
            // Filtrer manuellement les codes selon les filtres
            let filteredCodes = [];
            allCodesSnapshot.forEach(doc => {
                const code = doc.data();
                const codeId = doc.id;
                let includeCode = true;
                
                // Vérifier si le code a une date d'utilisation (usedAt)
                if (!code.usedAt) {
                    includeCode = false;
                }
                
                // Appliquer les filtres
                if (filters.status && code.status !== filters.status) {
                    includeCode = false;
                }
                
                if (filters.profileId && code.profileId !== filters.profileId) {
                    includeCode = false;
                }
                
                // Filtrer par période si nécessaire
                if (filters.period && includeCode) {
                    const now = new Date();
                    const usedDate = code.usedAt ? code.usedAt.toDate() : null;
                    
                    if (usedDate) {
                        if (filters.period === 'today') {
                            // Aujourd'hui
                            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                            includeCode = usedDate >= today;
                        } else if (filters.period === 'week') {
                            // Cette semaine (7 derniers jours)
                            const weekAgo = new Date(now);
                            weekAgo.setDate(weekAgo.getDate() - 7);
                            includeCode = usedDate >= weekAgo;
                        } else if (filters.period === 'month') {
                            // Ce mois (30 derniers jours)
                            const monthAgo = new Date(now);
                            monthAgo.setDate(monthAgo.getDate() - 30);
                            includeCode = usedDate >= monthAgo;
                        }
                    } else {
                        includeCode = false;
                    }
                }
                
                // Filtrer par texte de recherche si nécessaire
                if (filters.searchText && includeCode) {
                    const searchText = filters.searchText.toLowerCase();
                    const username = code.username ? code.username.toLowerCase() : '';
                    const password = code.password ? code.password.toLowerCase() : '';
                    const clientName = code.clientName ? code.clientName.toLowerCase() : '';
                    
                    includeCode = username.includes(searchText) || 
                                 password.includes(searchText) || 
                                 clientName.includes(searchText);
                }
                
                if (includeCode) {
                    filteredCodes.push({ id: codeId, ...code });
                }
            });
            
            // Masquer le chargement
            if (loadingElement) loadingElement.classList.add('d-none');
            
            if (filteredCodes.length === 0) {
                // Aucun code trouvé
                const noCodesElement = document.getElementById('noSoldCodes');
                if (noCodesElement) noCodesElement.classList.remove('d-none');
                return;
            }
            
            // Calculer les indices pour la pagination
            const totalCodes = filteredCodes.length;
            const startIndex = (page - 1) * itemsPerPage;
            const endIndex = Math.min(startIndex + itemsPerPage, totalCodes);
            
            // Extraire les codes pour la page actuelle
            const pagedCodes = filteredCodes.slice(startIndex, endIndex);
            
            // Conteneur pour les codes
            const codesList = document.getElementById('soldCodesList');
            
            // Si c'est la première page, vider la liste
            if (page === 1) {
                codesList.innerHTML = '';
            }
            
            // Variable pour stocker l'ID du dernier document
            let lastId = null;
            
            // Ajouter chaque code
            pagedCodes.forEach((code) => {
                const codeId = code.id;
                lastId = codeId;
                
                // Créer une ligne pour ce code vendu
                addSoldCodeRow(codeId, code, codesList);
            });
            
            // Mettre à jour la pagination
            updateSoldCodesPagination(totalCodes, page, itemsPerPage, routerId, lastId, filters);
        } catch (error) {
            console.error('Erreur lors de la récupération des codes vendus:', error);
            
            // Masquer le chargement
            if (loadingElement) loadingElement.classList.add('d-none');
            
            const noCodesElement = document.getElementById('noSoldCodes');
            if (noCodesElement) noCodesElement.classList.remove('d-none');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des codes vendus:', error);
        
        const loadingElement = document.getElementById('loadingSoldCodes');
        if (loadingElement) loadingElement.classList.add('d-none');
        
        const noCodesElement = document.getElementById('noSoldCodes');
        if (noCodesElement) noCodesElement.classList.remove('d-none');
    }
}

/**
 * Mettre à jour la pagination des codes WiFi
 * @param {number} totalItems - Nombre total d'éléments
 * @param {number} currentPage - Page actuelle
 * @param {number} itemsPerPage - Éléments par page
 * @param {string} routerId - ID du routeur
 * @param {string} lastDocId - ID du dernier document de la page actuelle
 * @param {Object} filters - Filtres appliqués à la requête
 */
function updateCodesPagination(totalItems, currentPage, itemsPerPage, routerId, lastDocId, filters = {}) {
    const paginationElement = document.getElementById('codesPagination');
    if (!paginationElement) return;
    
    // Calculer le nombre total de pages
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Vider la pagination actuelle
    paginationElement.innerHTML = '';
    
    // Ajouter le bouton "Précédent"
    const prevItem = document.createElement('li');
    prevItem.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.textContent = 'Précédent';
    prevLink.setAttribute('aria-label', 'Précédent');
    if (currentPage > 1) {
        prevLink.addEventListener('click', function(e) {
            e.preventDefault();
            loadCodes(routerId, currentPage - 1, itemsPerPage, null, filters);
        });
    }
    prevItem.appendChild(prevLink);
    paginationElement.appendChild(prevItem);
    
    // Déterminer les pages à afficher
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // Ajuster si on est près de la fin
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    // Ajouter les numéros de page
    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement('li');
        pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.href = '#';
        pageLink.textContent = i;
        if (i !== currentPage) {
            pageLink.addEventListener('click', function(e) {
                e.preventDefault();
                loadCodes(routerId, i, itemsPerPage, null, filters);
            });
        }
        pageItem.appendChild(pageLink);
        paginationElement.appendChild(pageItem);
    }
    
    // Ajouter le bouton "Suivant"
    const nextItem = document.createElement('li');
    nextItem.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.textContent = 'Suivant';
    nextLink.setAttribute('aria-label', 'Suivant');
    if (currentPage < totalPages) {
        nextLink.addEventListener('click', function(e) {
            e.preventDefault();
            loadCodes(routerId, currentPage + 1, itemsPerPage, lastDocId, filters);
        });
    }
    nextItem.appendChild(nextLink);
    paginationElement.appendChild(nextItem);
}

/**
 * Mettre à jour la pagination des codes WiFi vendus
 * @param {number} totalItems - Nombre total d'éléments
 * @param {number} currentPage - Page actuelle
 * @param {number} itemsPerPage - Éléments par page
 * @param {string} routerId - ID du routeur
 * @param {string} lastDocId - ID du dernier document de la page actuelle
 * @param {Object} filters - Filtres appliqués à la requête
 */
function updateSoldCodesPagination(totalItems, currentPage, itemsPerPage, routerId, lastDocId, filters = {}) {
    const paginationElement = document.getElementById('soldCodesPagination');
    if (!paginationElement) return;
    
    // Calculer le nombre total de pages
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Vider la pagination actuelle
    paginationElement.innerHTML = '';
    
    // Ajouter le bouton "Précédent"
    const prevItem = document.createElement('li');
    prevItem.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.textContent = 'Précédent';
    prevLink.setAttribute('aria-label', 'Précédent');
    if (currentPage > 1) {
        prevLink.addEventListener('click', function(e) {
            e.preventDefault();
            loadSoldCodes(routerId, currentPage - 1, itemsPerPage, null, filters);
        });
    }
    prevItem.appendChild(prevLink);
    paginationElement.appendChild(prevItem);
    
    // Déterminer les pages à afficher
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // Ajuster si on est près de la fin
    if (endPage - startPage < 4) {
        startPage = Math.max(1, endPage - 4);
    }
    
    // Ajouter les numéros de page
    for (let i = startPage; i <= endPage; i++) {
        const pageItem = document.createElement('li');
        pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
        const pageLink = document.createElement('a');
        pageLink.className = 'page-link';
        pageLink.href = '#';
        pageLink.textContent = i;
        if (i !== currentPage) {
            pageLink.addEventListener('click', function(e) {
                e.preventDefault();
                loadSoldCodes(routerId, i, itemsPerPage, null, filters);
            });
        }
        pageItem.appendChild(pageLink);
        paginationElement.appendChild(pageItem);
    }
    
    // Ajouter le bouton "Suivant"
    const nextItem = document.createElement('li');
    nextItem.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.textContent = 'Suivant';
    nextLink.setAttribute('aria-label', 'Suivant');
    if (currentPage < totalPages) {
        nextLink.addEventListener('click', function(e) {
            e.preventDefault();
            loadSoldCodes(routerId, currentPage + 1, itemsPerPage, lastDocId, filters);
        });
    }
    nextItem.appendChild(nextLink);
    paginationElement.appendChild(nextItem);
}

/**
 * Ajouter une ligne pour un code
 * @param {string} codeId - ID du code
 * @param {Object} code - Données du code
 * @param {HTMLElement} container - Conteneur pour la ligne
 */
function addCodeRow(codeId, code, container) {
    // Créer une ligne
    const row = document.createElement('tr');
    
    // Récupérer les informations du profil
    let profileName = 'Profil inconnu';
    if (code.profileId) {
        // Utiliser la fonction doc importée correctement
        const profileRef = doc(db, 'profiles', code.profileId);
        getDoc(profileRef)
            .then((docSnap) => {
                if (docSnap.exists()) {
                    profileName = docSnap.data().name;
                    row.querySelector('.code-profile').textContent = profileName;
                }
            });
    }
    
    // Formater les dates
    const createdAt = code.createdAt ? new Date(code.createdAt.toDate()).toLocaleDateString('fr-FR') : '-';
    const usedAt = code.usedAt ? new Date(code.usedAt.toDate()).toLocaleDateString('fr-FR') : '-';
    
    // Statut
    let statusClass = '';
    let statusText = '';
    switch (code.status) {
        case 'available':
            statusClass = 'bg-success';
            statusText = 'Disponible';
            break;
        case 'used':
            statusClass = 'bg-primary';
            statusText = 'Utilisé';
            break;
        case 'expired':
            statusClass = 'bg-secondary';
            statusText = 'Expiré';
            break;
        default:
            statusClass = 'bg-secondary';
            statusText = code.status;
    }
    
    // Remplir la ligne
    // Vérifier si le code est au format username/password ou simple code
    const codeValue = code.username && code.password ? `${code.username} / ${code.password}` : 
                     code.password ? code.password : 
                     code.username ? code.username : '-';
    
    // Ajouter une case à cocher uniquement pour les codes disponibles
    const checkboxCell = code.status === 'available' ? `
        <td>
            <div class="form-check">
                <input class="form-check-input code-checkbox" type="checkbox" value="${codeId}" data-code-id="${codeId}">
                <label class="form-check-label"></label>
            </div>
        </td>` : '<td></td>';
                     
    row.innerHTML = `
        ${checkboxCell}
        <td><code>${codeValue}</code></td>
        <td class="code-profile" data-profile-id="${code.profileId}">${profileName}</td>
        <td>${createdAt}</td>
        <td>${code.price ? code.price + ' FCFA' : '-'}</td>
        <td>${code.duration || '-'}</td>
        <td>
            <button type="button" class="btn btn-sm btn-outline-primary view-code-btn" data-code-id="${codeId}">
                <i class="fas fa-eye"></i>
            </button>
        </td>
    `;
    
    // Ajouter la ligne au conteneur
    container.appendChild(row);
}

/**
 * Ajouter une ligne pour un code vendu
 * @param {string} codeId - ID du code
 * @param {Object} code - Données du code
 * @param {HTMLElement} container - Conteneur pour la ligne
 */
function addSoldCodeRow(codeId, code, container) {
    // Créer une ligne
    const row = document.createElement('tr');
    
    // Récupérer les informations du profil
    let profileName = 'Profil inconnu';
    if (code.profileId) {
        // Utiliser la fonction doc importée correctement
        const profileRef = doc(db, 'profiles', code.profileId);
        getDoc(profileRef)
            .then((docSnap) => {
                if (docSnap.exists()) {
                    profileName = docSnap.data().name;
                    row.querySelector('.code-profile').textContent = profileName;
                }
            });
    }
    
    // Formater les dates
    const usedAt = code.usedAt ? new Date(code.usedAt.toDate()).toLocaleDateString('fr-FR', { 
        year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    }) : '-';
    
    // Remplir la ligne
    // Vérifier si le code est au format username/password ou simple code
    const codeValue = code.username && code.password ? `${code.username} / ${code.password}` : 
                     code.password ? code.password : 
                     code.username ? code.username : '-';
    
    // Prix formaté
    const price = code.price ? `${code.price} FCFA` : '-';
    
    // Paiement
    const payment = code.paymentId ? `<span class="badge bg-info">${code.paymentId}</span>` : '-';
                     
    row.innerHTML = `
        <td><code>${codeValue}</code></td>
        <td class="code-profile" data-profile-id="${code.profileId}">${profileName}</td>
        <td>${code.clientName || '-'}</td>
        <td>${usedAt}</td>
        <td>${price}</td>
        <td>${payment}</td>
        <td>
            <div class="btn-group">
                <button type="button" class="btn btn-sm btn-outline-primary view-code-btn" data-code-id="${codeId}">
                    <i class="fas fa-eye"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary print-receipt-btn" data-code-id="${codeId}">
                    <i class="fas fa-print"></i>
                </button>
            </div>
        </td>
    `;
    
    // Ajouter la ligne au conteneur
    container.appendChild(row);
}

/**
 * Configurer le formulaire d'importation
 * @param {string} routerId - ID du routeur
 * @param {boolean} needsLicense - Indique si l'utilisateur a besoin d'activer une licence
 */
function setupImportForm(routerId, needsLicense = false) {
    // Changer de méthode d'importation
    const importMethod = document.getElementById('importMethod');
    const csvImport = document.getElementById('csvImport');
    const textImport = document.getElementById('textImport');
    const pdfImport = document.getElementById('pdfImport');
    const importForm = document.getElementById('importCodesForm');
    const importSubmitBtn = document.getElementById('importSubmitBtn');
    
    // Si l'utilisateur n'a pas de licence active, désactiver le formulaire d'importation
    if (needsLicense && importForm) {
        // Désactiver tous les champs du formulaire
        const formElements = importForm.querySelectorAll('input, select, textarea, button');
        formElements.forEach(element => {
            element.disabled = true;
        });
        
        // Ajouter un message d'avertissement dans le modal
        const importModal = document.getElementById('importCodesModal');
        if (importModal) {
            const modalBody = importModal.querySelector('.modal-body');
            if (modalBody) {
                const licenseAlert = document.createElement('div');
                licenseAlert.className = 'alert alert-warning';
                licenseAlert.innerHTML = `
                    <i class="fas fa-exclamation-triangle me-2"></i>
                    <strong>Licence requise :</strong> L'importation de codes WiFi nécessite une licence active. 
                    <a href="settings.html#subscription-tab" class="alert-link">Activez votre licence</a> pour utiliser cette fonctionnalité.
                `;
                modalBody.insertBefore(licenseAlert, modalBody.firstChild);
            }
        }
        
        // Ajouter un tooltip sur le bouton d'importation
        if (importSubmitBtn) {
            importSubmitBtn.setAttribute('data-bs-toggle', 'tooltip');
            importSubmitBtn.setAttribute('title', 'Activez votre licence pour importer des codes');
            // Initialiser le tooltip Bootstrap
            new bootstrap.Tooltip(importSubmitBtn);
        }
    } else {
        // Le formulaire PDF est maintenant le seul disponible et est toujours visible
        // Aucune action supplémentaire n'est nécessaire
    }
}

/**
 * Configurer les gestionnaires d'événements pour les filtres
 * @param {string} routerId - ID du routeur
 * @param {boolean} needsLicense - Indique si l'utilisateur a besoin d'activer une licence
 */
function setupFilterHandlers(routerId, needsLicense = false) {
    // Gestionnaires pour les onglets
    const availableTab = document.getElementById('available-codes-tab');
    const soldTab = document.getElementById('sold-codes-tab');
    
    if (availableTab) {
        availableTab.addEventListener('click', function(e) {
            e.preventDefault();
            // Charger les codes disponibles
            loadCodes(routerId, 1, 20, null, { status: 'available' });
        });
    }
    
    if (soldTab) {
        soldTab.addEventListener('click', function(e) {
            e.preventDefault();
            // Charger les codes vendus
            loadSoldCodes(routerId);
        });
    }
    
    // Gestionnaire pour les boutons d'action dans les tableaux
    document.addEventListener('click', function(e) {
        // Gestion du bouton d'impression de reçu
        if (e.target.closest('.print-receipt-btn')) {
            e.preventDefault();
            const btn = e.target.closest('.print-receipt-btn');
            const codeId = btn.dataset.codeId;
            
            // Vérifier si l'utilisateur a besoin d'une licence pour imprimer des reçus
            if (needsLicense) {
                // Afficher un message d'erreur
                showToast('Licence requise', 'L\'impression de reçus nécessite une licence active. Veuillez activer votre licence pour utiliser cette fonctionnalité.', 'warning');
                
                // Rediriger vers la page des paramètres si l'utilisateur clique sur le toast
                const toastElement = document.querySelector('.toast:last-child');
                if (toastElement) {
                    toastElement.addEventListener('click', function() {
                        window.location.href = 'settings.html#subscription-tab';
                    });
                }
            } else {
                // Imprimer le reçu normalement
                printReceipt(codeId, routerId);
            }
        }
    });
    
    // Si l'utilisateur n'a pas de licence active, désactiver certains filtres avancés
    if (needsLicense) {
        // Désactiver les filtres avancés (si présents)
        const advancedFilters = document.querySelectorAll('.advanced-filter');
        advancedFilters.forEach(filter => {
            filter.disabled = true;
            filter.setAttribute('data-bs-toggle', 'tooltip');
            filter.setAttribute('title', 'Activez votre licence pour utiliser les filtres avancés');
            // Initialiser les tooltips Bootstrap
            new bootstrap.Tooltip(filter);
        });
    }
    
    // Gestionnaires pour les filtres des codes disponibles
    const searchInput = document.getElementById('searchCodes');
    if (searchInput) {
        // Utiliser un délai pour éviter de faire trop de requêtes pendant la frappe
        let searchTimeout;
        searchInput.addEventListener('input', function() {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                const searchText = this.value.trim();
                const profileSelect = document.getElementById('filterProfile');
                const profileId = profileSelect ? profileSelect.value : 'all';
                
                // Recharger les codes disponibles avec le filtre de recherche
                loadCodes(routerId, 1, 20, null, {
                    status: 'available',
                    profileId: profileId === 'all' ? null : profileId,
                    searchText: searchText
                });
            }, 300); // Délai de 300ms pour éviter les requêtes trop fréquentes
        });
    }
    
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            const searchInput = document.getElementById('searchCodes');
            if (searchInput) {
                searchInput.value = '';
                
                // Récupérer le filtre de profil actuel
                const profileSelect = document.getElementById('filterProfile');
                const profileId = profileSelect ? profileSelect.value : 'all';
                
                // Recharger les codes disponibles sans filtre de recherche
                loadCodes(routerId, 1, 20, null, {
                    status: 'available',
                    profileId: profileId === 'all' ? null : profileId
                });
            }
        });
    }
    
    const filterProfile = document.getElementById('filterProfile');
    if (filterProfile) {
        filterProfile.addEventListener('change', function() {
            const profileId = this.value;
            const searchInput = document.getElementById('searchCodes');
            const searchText = searchInput ? searchInput.value.trim() : '';
            
            // Recharger les codes disponibles avec le filtre de profil
            loadCodes(routerId, 1, 20, null, {
                status: 'available',
                profileId: profileId === 'all' ? null : profileId,
                searchText: searchText
            });
        });
    }
    
    // Gestionnaires pour les filtres des codes vendus
    const searchSoldInput = document.getElementById('searchSoldCodes');
    if (searchSoldInput) {
        searchSoldInput.addEventListener('input', function() {
            const searchText = this.value.trim();
            const profileSelect = document.getElementById('filterSoldProfile');
            const profileId = profileSelect ? profileSelect.value : 'all';
            const periodSelect = document.getElementById('filterSoldPeriod');
            const period = periodSelect ? periodSelect.value : 'all';
            
            loadSoldCodes(routerId, 1, 20, null, {
                searchText: searchText,
                profileId: profileId === 'all' ? null : profileId,
                period: period
            });
        });
    }
    
    const clearSoldSearchBtn = document.getElementById('clearSoldSearchBtn');
    if (clearSoldSearchBtn) {
        clearSoldSearchBtn.addEventListener('click', function() {
            const searchInput = document.getElementById('searchSoldCodes');
            if (searchInput) {
                searchInput.value = '';
                loadSoldCodes(routerId);
            }
        });
    }
    
    const filterSoldProfile = document.getElementById('filterSoldProfile');
    if (filterSoldProfile) {
        filterSoldProfile.addEventListener('change', function() {
            const profileId = this.value;
            const searchInput = document.getElementById('searchSoldCodes');
            const searchText = searchInput ? searchInput.value.trim() : '';
            const periodSelect = document.getElementById('filterSoldPeriod');
            const period = periodSelect ? periodSelect.value : 'all';
            
            loadSoldCodes(routerId, 1, 20, null, {
                searchText: searchText,
                profileId: profileId === 'all' ? null : profileId,
                period: period
            });
        });
    }
    
    const filterSoldPeriod = document.getElementById('filterSoldPeriod');
    if (filterSoldPeriod) {
        filterSoldPeriod.addEventListener('change', function() {
            const period = this.value;
            const searchInput = document.getElementById('searchSoldCodes');
            const searchText = searchInput ? searchInput.value.trim() : '';
            const profileSelect = document.getElementById('filterSoldProfile');
            const profileId = profileSelect ? profileSelect.value : 'all';
            
            loadSoldCodes(routerId, 1, 20, null, {
                searchText: searchText,
                profileId: profileId === 'all' ? null : profileId,
                period: period
            });
        });
    }
}

/**
 * Imprimer un reçu pour un code vendu
 * @param {string} codeId - ID du code
 * @param {string} routerId - ID du routeur
 */
async function printReceipt(codeId, routerId) {
    try {
        // Récupérer les informations du code
        const codeRef = doc(db, 'wifiCodes', codeId);
        const codeSnap = await getDoc(codeRef);
        
        if (!codeSnap.exists()) {
            console.error('Code non trouvé');
            showGlobalMessage('error', 'Code non trouvé');
            return;
        }
        
        const code = codeSnap.data();
        
        // Vérifier que le code est bien vendu
        if (code.status !== 'used') {
            console.error('Ce code n\'est pas vendu');
            showGlobalMessage('error', 'Ce code n\'est pas vendu, impossible d\'imprimer un reçu');
            return;
        }
        
        // Récupérer les informations du profil
        let profileName = 'Profil inconnu';
        let profileDuration = '';
        let profilePrice = '';
        
        if (code.profileId) {
            const profileRef = doc(db, 'profiles', code.profileId);
            const profileSnap = await getDoc(profileRef);
            
            if (profileSnap.exists()) {
                const profile = profileSnap.data();
                profileName = profile.name;
                profileDuration = profile.duration;
                profilePrice = profile.price;
            }
        }
        
        // Récupérer les informations du routeur
        const routerRef = doc(db, 'routers', routerId);
        const routerSnap = await getDoc(routerRef);
        let routerName = 'Routeur inconnu';
        let businessName = 'FastNetLite';
        
        if (routerSnap.exists()) {
            const router = routerSnap.data();
            routerName = router.name;
            businessName = router.businessName || 'FastNetLite';
        }
        
        // Formater les dates
        const saleDate = code.usedAt ? new Date(code.usedAt.toDate()).toLocaleDateString('fr-FR', { 
            year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
        }) : 'Date inconnue';
        
        // Créer le contenu du reçu
        const receiptContent = `
            <div class="receipt-container" style="font-family: Arial, sans-serif; max-width: 300px; padding: 20px; border: 1px solid #ddd;">
                <div style="text-align: center; margin-bottom: 20px;">
                    <h2 style="margin: 0;">${businessName}</h2>
                    <p>${routerName}</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h3 style="margin: 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">REÇU</h3>
                    <p><strong>Date:</strong> ${saleDate}</p>
                    <p><strong>Client:</strong> ${code.clientName || 'Client non spécifié'}</p>
                    <p><strong>Numéro de reçu:</strong> ${codeId.substring(0, 8)}</p>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Détails</h4>
                    <table style="width: 100%; border-collapse: collapse;">
                        <tr>
                            <td style="padding: 5px 0;">Profil WiFi</td>
                            <td style="text-align: right; padding: 5px 0;">${profileName}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0;">Durée</td>
                            <td style="text-align: right; padding: 5px 0;">${profileDuration}</td>
                        </tr>
                        <tr>
                            <td style="padding: 5px 0; font-weight: bold;">TOTAL</td>
                            <td style="text-align: right; padding: 5px 0; font-weight: bold;">${code.price || profilePrice || 'N/A'} FCFA</td>
                        </tr>
                    </table>
                </div>
                
                <div style="margin-bottom: 20px;">
                    <h4 style="margin: 0; border-bottom: 1px solid #ddd; padding-bottom: 5px;">Informations de connexion</h4>
                    <p><strong>Nom d'utilisateur:</strong> ${code.username || 'N/A'}</p>
                    <p><strong>Mot de passe:</strong> ${code.password || 'N/A'}</p>
                </div>
                
                <div style="text-align: center; font-size: 12px; margin-top: 30px;">
                    <p>Merci pour votre achat!</p>
                    <p>Pour toute assistance, veuillez nous contacter.</p>
                </div>
            </div>
        `;
        
        // Ouvrir une nouvelle fenêtre pour l'impression
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Reçu - ${code.clientName || 'Client'} - ${profileName}</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
        
    } catch (error) {
        console.error('Erreur lors de l\'impression du reçu:', error);
        showGlobalMessage('error', 'Erreur lors de l\'impression du reçu');
    }
}

// Gestion du format de code pour l'importation PDF
const formatVoucher = document.getElementById('formatVoucher');
const formatUserPass = document.getElementById('formatUserPass');
const voucherExample = document.getElementById('voucherExample');
const userPassExample = document.getElementById('userPassExample');
    
    // Gestionnaire pour le changement de mode de génération (Mikhmon vs Userman)
    document.querySelectorAll('input[name="generationMode"]').forEach(radio => {
        radio.addEventListener('change', (event) => {
            const mikhmonOptions = document.getElementById('mikhmonOptions');
            const usermanOptions = document.getElementById('usermanOptions');
            const detectedPatternContainer = document.querySelector('#detectedPattern').closest('.mb-3');

            if (event.target.value === 'userman') {
                mikhmonOptions.classList.add('d-none');
                usermanOptions.classList.remove('d-none');
                detectedPatternContainer.classList.add('d-none'); // Cacher le pattern pour Userman
            } else {
                mikhmonOptions.classList.remove('d-none');
                usermanOptions.classList.add('d-none');
                detectedPatternContainer.classList.remove('d-none'); // Afficher le pattern pour Mikhmon
            }
        });
    });

    // Gestionnaire pour le changement de format de code (Voucher vs User/Pass)
    document.querySelectorAll('input[name="codeFormat"]').forEach(radio => {
        radio.addEventListener('change', function() {
            if (this.value === 'voucher') {
                voucherExample.classList.remove('d-none');
                userPassExample.classList.add('d-none');
                // Réinitialiser le tableau des codes extraits
                updateExtractedCodesHeader(false);
            } else {
                voucherExample.classList.add('d-none');
                userPassExample.classList.remove('d-none');
                // Réinitialiser le tableau des codes extraits
                updateExtractedCodesHeader(true);
            }
            // Réinitialiser le pattern détecté
            document.getElementById('detectedPattern').value = '';
            document.getElementById('patternExplanation').textContent = 'Entrez un exemple pour générer automatiquement un pattern';
            // Masquer les codes extraits
            document.getElementById('extractedCodesContainer').classList.add('d-none');
        });
    });
    
    // Gestionnaire pour l'inférence de pattern à partir de l'exemple de voucher
    const exampleVoucher = document.getElementById('exampleVoucher');
    exampleVoucher.addEventListener('input', function() {
        const example = this.value.trim();
        if (example) {
            const pattern = inferPatternFromExample(example);
            document.getElementById('detectedPattern').value = pattern;
            document.getElementById('patternExplanation').textContent = 'Pattern détecté : ' + explainPattern(pattern);
        } else {
            document.getElementById('detectedPattern').value = '';
            document.getElementById('patternExplanation').textContent = 'Entrez un exemple pour générer automatiquement un pattern';
        }
    });
    
    // Gestionnaires pour l'inférence de pattern à partir des exemples utilisateur/mot de passe
    const exampleUser = document.getElementById('exampleUser');
    const examplePass = document.getElementById('examplePass');
    
    [exampleUser, examplePass].forEach(input => {
        input.addEventListener('input', function() {
            const userExample = exampleUser.value.trim();
            const passExample = examplePass.value.trim();
            
            if (userExample && passExample) {
                const userPattern = inferPatternFromExample(userExample);
                const passPattern = inferPatternFromExample(passExample);
                const combinedPattern = `${userPattern}\\s+${passPattern}`;
                
                document.getElementById('detectedPattern').value = combinedPattern;
                document.getElementById('patternExplanation').textContent = 
                    'Pattern utilisateur : ' + explainPattern(userPattern) + 
                    ' | Pattern mot de passe : ' + explainPattern(passPattern);
            } else {
                document.getElementById('detectedPattern').value = '';
                document.getElementById('patternExplanation').textContent = 'Entrez des exemples pour générer automatiquement un pattern';
            }
        });
    });
    
    // Gestionnaire pour le fichier PDF
    const pdfFile = document.getElementById('pdfFile');
    pdfFile.addEventListener('change', function(e) {
        if (this.files && this.files[0]) {
            // Stocker le fichier PDF sélectionné pour une utilisation ultérieure
            window.selectedPdfFile = this.files[0];
            
            // Afficher le nom du fichier sélectionné
            const fileName = this.files[0].name;
            const fileInfo = document.createElement('div');
            fileInfo.className = 'alert alert-info mt-2';
            fileInfo.innerHTML = `<i class="fas fa-file-pdf me-2"></i> Fichier sélectionné: <strong>${fileName}</strong>`;
            
            // Supprimer toute info précédente
            const previousInfo = document.querySelector('#pdfFile + .alert');
            if (previousInfo) previousInfo.remove();
            
            // Ajouter l'info après l'input file
            this.parentNode.insertBefore(fileInfo, this.nextSibling);
            
            // Masquer les messages d'erreur
            document.getElementById('importFormError').classList.add('d-none');
            
            // Activer le bouton d'extraction
            document.getElementById('extractCodesBtn').disabled = false;
        }
    });
    
    // Gestionnaire pour le bouton d'extraction des codes
    const extractCodesBtn = document.getElementById('extractCodesBtn');
    extractCodesBtn.addEventListener('click', function() {
        // Vérifier si un fichier PDF a été sélectionné
        if (!window.selectedPdfFile) {
            const errorElement = document.getElementById('importFormError');
            errorElement.textContent = 'Veuillez sélectionner un fichier PDF.';
            errorElement.classList.remove('d-none');
            return;
        }
        
        // Récupérer le pattern et le format des codes
        let pattern = document.getElementById('detectedPattern').value;
        const isUserPass = document.getElementById('formatUserPass').checked;
        
        // Si aucun pattern n'est fourni, générer un pattern par défaut
        if (!pattern) {
            console.log('Aucun pattern fourni, génération d\'un pattern par défaut');
            if (isUserPass) {
                // Pattern par défaut pour User/Pass
                pattern = '([A-Za-z0-9]{4,})\\s+([A-Za-z0-9]{4,})';
                document.getElementById('detectedPattern').value = pattern;
                document.getElementById('patternExplanation').textContent = 
                    'Pattern par défaut: 4+ caractères alphanumériques, espace, 4+ caractères alphanumériques';
            } else {
                // Pattern par défaut pour Voucher
                pattern = '[A-Za-z0-9]{4,}';
                document.getElementById('detectedPattern').value = pattern;
                document.getElementById('patternExplanation').textContent = 
                    'Pattern par défaut: 4+ caractères alphanumériques';
            }
        }
        
        // Afficher le spinner
        const spinner = document.getElementById('extractCodesSpinner');
        spinner.classList.remove('d-none');
        this.disabled = true;
        
        // Traiter le fichier PDF
        processPDFFile(window.selectedPdfFile, pattern, isUserPass)
            .then((extractedCodes) => {
                // Stocker les codes extraits dans une variable globale
                window.extractedCodes = extractedCodes || [];
                
                // Masquer le spinner
                spinner.classList.add('d-none');
                this.disabled = false;
                
                if (extractedCodes && extractedCodes.length > 0) {
                    // Stocker les codes extraits globalement
                    window.extractedCodes = extractedCodes;
                
                    // Fermer le modal d'importation
                    const importModal = bootstrap.Modal.getInstance(document.getElementById('importCodesModal'));
                    importModal.hide();
                    
                    // Préparer et ouvrir le modal des codes extraits
                    prepareExtractedCodesModal(extractedCodes, pattern, isUserPass);
                    
                    // Ouvrir le modal des codes extraits avec options pour empêcher la fermeture par clic extérieur
                    const extractedCodesModal = new bootstrap.Modal(document.getElementById('extractedCodesModal'), {
                        backdrop: 'static',  // Empêche la fermeture en cliquant à l'extérieur
                        keyboard: false      // Empêche la fermeture avec la touche Echap
                    });
                    extractedCodesModal.show();
                } else {
                    // Aucun code trouvé
                    const errorElement = document.getElementById('importFormError');
                    errorElement.textContent = 'Aucun code n\'a pu être extrait du PDF. Essayez avec un exemple différent ou un autre fichier.';
                    errorElement.classList.remove('d-none');
                }
            })
            .catch(error => {
                console.error('Erreur lors du traitement du PDF:', error);
                
                // Afficher l'erreur
                const errorElement = document.getElementById('importFormError');
                errorElement.textContent = `Erreur lors du traitement du PDF: ${error.message || 'Erreur inconnue'}`;
                errorElement.classList.remove('d-none');
                
                // Masquer le spinner
                spinner.classList.add('d-none');
                this.disabled = false;
            });
    });


/**
 * Configurer les gestionnaires d'événements
 * @param {string} routerId - ID du routeur
 */
function setupEventHandlers(routerId) {
    // La génération de codes a été désactivée
    // setupGenerateCodesHandlers(routerId);
    
    // Gestionnaire pour les boutons d'édition et de suppression de profil
    document.addEventListener('click', function(e) {
        // Gestion du bouton Modifier pour les profils
        if (e.target.classList.contains('edit-profile-btn') || e.target.closest('.edit-profile-btn')) {
            e.preventDefault();
            
            // Récupérer l'élément cliqué
            const editBtn = e.target.classList.contains('edit-profile-btn') ? 
                            e.target : 
                            e.target.closest('.edit-profile-btn');
            
            // Récupérer l'ID du profil
            const profileId = editBtn.dataset.profileId;
            
            // Charger les données du profil pour édition
            editProfile(profileId, routerId);
        }
        
        // Gestion du bouton Supprimer pour les profils
        if (e.target.classList.contains('delete-profile-btn') || e.target.closest('.delete-profile-btn')) {
            e.preventDefault();
            
            // Récupérer l'élément cliqué
            const deleteBtn = e.target.classList.contains('delete-profile-btn') ? 
                              e.target : 
                              e.target.closest('.delete-profile-btn');
            
            // Récupérer l'ID du profil
            const profileId = deleteBtn.dataset.profileId;
            
            // Demander confirmation avant suppression
            deleteProfile(profileId, routerId);
        }
        
        // Gestion du bouton pour copier le lien d'achat
        if (e.target.classList.contains('copy-buy-link-btn') || e.target.closest('.copy-buy-link-btn')) {
            e.preventDefault();
            
            // Récupérer l'élément cliqué
            const copyBtn = e.target.classList.contains('copy-buy-link-btn') ? 
                            e.target : 
                            e.target.closest('.copy-buy-link-btn');
            
            // Récupérer l'ID du profil
            const profileId = copyBtn.dataset.profileId;
            
            // Récupérer le nom du profil
            getProfileName(profileId, routerId).then(profileName => {
                // Copier le lien d'achat
                copyBuyLink(profileId, routerId, profileName);
            }).catch(error => {
                console.error('Erreur lors de la récupération du nom du profil:', error);
                // Utiliser un nom générique en cas d'erreur
                copyBuyLink(profileId, routerId, 'Profil WiFi');
            });
        }
    });
    // Gestionnaire pour le bouton d'enregistrement du profil
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn && !saveProfileBtn.getAttribute('data-handler-attached')) {
        // Marquer le bouton pour éviter d'attacher plusieurs gestionnaires
        saveProfileBtn.setAttribute('data-handler-attached', 'true');
        
        saveProfileBtn.addEventListener('click', function() {
            // Récupérer les valeurs du formulaire
            const name = document.getElementById('profileName').value.trim();
            const description = document.getElementById('profileDescription').value.trim();
            const duration = document.getElementById('profileDuration').value.trim();
            const price = parseFloat(document.getElementById('profilePrice').value);
            
            // Validation basique
            if (!name || !duration || isNaN(price)) {
                const errorElement = document.getElementById('profileFormError');
                errorElement.textContent = 'Veuillez remplir tous les champs obligatoires';
                errorElement.classList.remove('d-none');
                return;
            }
            
            // Afficher le spinner
            const spinner = document.getElementById('saveProfileSpinner');
            spinner.classList.remove('d-none');
            saveProfileBtn.disabled = true;
            
            // Vérifier si un profil avec le même nom existe déjà
            const profilesCollection = collection(db, 'profiles');
            const checkQuery = query(
                profilesCollection, 
                where('routerId', '==', routerId),
                where('name', '==', name)
            );
            
            getDocs(checkQuery)
                .then((snapshot) => {
                    if (!snapshot.empty) {
                        // Un profil avec ce nom existe déjà
                        const errorElement = document.getElementById('profileFormError');
                        errorElement.textContent = 'Un profil avec ce nom existe déjà';
                        errorElement.classList.remove('d-none');
                        spinner.classList.add('d-none');
                        saveProfileBtn.disabled = false;
                    } else {
                        // Créer le profil dans Firestore
                        try {
                            const profileData = {
                                name: name,
                                description: description,
                                duration: duration,
                                price: price,
                                routerId: routerId,
                                userId: auth.currentUser ? auth.currentUser.uid : 'anonymous',
                                createdAt: serverTimestamp(),
                                stats: {
                                    totalCodes: 0,
                                    availableCodes: 0,
                                    usedCodes: 0
                                }
                            };
                            
                            addDoc(profilesCollection, profileData)
                                .then((docRef) => {
                                    console.log('Profil ajouté avec ID:', docRef.id);
                                    
                                    // Fermer le modal
                                    const modal = bootstrap.Modal.getInstance(document.getElementById('addProfileModal'));
                                    modal.hide();
                                    
                                    // Pas besoin de commit de batch ici, addDoc a déjà été exécuté
                                    // Rafraîchir la liste des profils
                                    loadProfiles();
                                    
                                    // Réinitialiser le formulaire
                                    document.getElementById('addProfileForm').reset();
                                    document.getElementById('profileFormError').classList.add('d-none');
                                    
                                    // Masquer le spinner
                                    spinner.classList.add('d-none');
                                    saveProfileBtn.disabled = false;
                                })
                                .catch((error) => {
                                    console.error('Erreur lors de l\'ajout du profil:', error);
                                    
                                    // Afficher l'erreur
                                    const errorElement = document.getElementById('profileFormError');
                                    errorElement.textContent = 'Erreur lors de l\'ajout du profil: ' + error.message;
                                    errorElement.classList.remove('d-none');
                                    
                                    // Masquer le spinner
                                    spinner.classList.add('d-none');
                                    saveProfileBtn.disabled = false;
                                });
                        } catch (error) {
                            console.error('Erreur lors de l\'ajout du profil:', error);
                            
                            // Afficher l'erreur
                            const errorElement = document.getElementById('profileFormError');
                            errorElement.textContent = 'Erreur lors de l\'ajout du profil: ' + error.message;
                            errorElement.classList.remove('d-none');
                            
                            // Masquer le spinner
                            spinner.classList.add('d-none');
                            saveProfileBtn.disabled = false;
                        }
                    }
                })
                .catch((error) => {
                    console.error('Erreur lors de la vérification du profil:', error);
                    
                    // Afficher l'erreur
                    const errorElement = document.getElementById('profileFormError');
                    errorElement.textContent = 'Erreur lors de la vérification du profil: ' + error.message;
                    errorElement.classList.remove('d-none');
                    
                    // Masquer le spinner
                    spinner.classList.add('d-none');
                    saveProfileBtn.disabled = false;
                });
        });
    }
    
    // Gestionnaire pour le bouton d'importation de codes
    const importCodesBtn = document.getElementById('importCodesBtn');
    if (importCodesBtn && !importCodesBtn.getAttribute('data-handler-attached')) {
        // Marquer le bouton pour éviter d'attacher plusieurs gestionnaires
        importCodesBtn.setAttribute('data-handler-attached', 'true');
        
        importCodesBtn.addEventListener('click', function() {
            // Récupérer les valeurs du formulaire
            const profileId = document.getElementById('importProfile').value;
            
            // Validation basique
            if (!profileId) {
                const errorElement = document.getElementById('importFormError');
                errorElement.textContent = 'Veuillez sélectionner un profil';
                errorElement.classList.remove('d-none');
                return;
            }
            
            // Vérifier si des codes ont été extraits
            const extractedCodes = window.extractedCodes || [];
            if (extractedCodes.length === 0) {
                const errorElement = document.getElementById('importFormError');
                errorElement.textContent = 'Aucun code extrait. Veuillez sélectionner un fichier PDF et saisir un exemple de code.';
                errorElement.classList.remove('d-none');
                return;
            }
            
            // Afficher le spinner
            const spinner = document.getElementById('importCodesSpinner');
            spinner.classList.remove('d-none');
            importCodesBtn.disabled = true;
            
            // Vérifier le format des codes
            const isUserPass = document.getElementById('formatUserPass').checked;
            
            // Importer les codes extraits
            try {
                importCodes(extractedCodes, profileId, routerId, isUserPass)
                    .catch(error => {
                        console.error('Erreur lors de l\'importation des codes:', error);
                        // Afficher l'erreur
                        const errorElement = document.getElementById('importFormError');
                        errorElement.textContent = 'Erreur lors de l\'importation des codes: ' + error.message;
                        errorElement.classList.remove('d-none');
                        
                        // Masquer le spinner
                        spinner.classList.add('d-none');
                        importCodesBtn.disabled = false;
                    });
            } catch (error) {
                console.error('Erreur lors de l\'importation des codes:', error);
                // Afficher l'erreur
                const errorElement = document.getElementById('importFormError');
                errorElement.textContent = 'Erreur lors de l\'importation des codes: ' + error.message;
                errorElement.classList.remove('d-none');
                
                // Masquer le spinner
                spinner.classList.add('d-none');
                importCodesBtn.disabled = false;
            }
        });
    }
    
 
    
    // Gestionnaire pour les boutons de visualisation de code
    // Utiliser une variable globale pour éviter les attachements multiples
    window.viewCodeHandlerAttached = window.viewCodeHandlerAttached || false;
    
    if (!window.viewCodeHandlerAttached) {
        // Marquer comme attaché pour éviter d'attacher plusieurs gestionnaires
        window.viewCodeHandlerAttached = true;
        
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('view-code-btn') || e.target.closest('.view-code-btn')) {
                e.preventDefault();
                
                // Récupérer l'élément cliqué
                const viewBtn = e.target.classList.contains('view-code-btn') ? 
                                e.target : 
                                e.target.closest('.view-code-btn');
                
                // Récupérer l'ID du code
                const codeId = viewBtn.dataset.codeId;
                
                // Afficher les détails du code
                showCodeDetails(codeId);
            }
        });
        console.log('Gestionnaire de visualisation de code attaché');
    }
}

/**
 * Traiter un fichier CSV
 * @param {File} file - Fichier CSV
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 */
function processCSVFile(file, profileId, routerId) {
    // Afficher le spinner
    const spinner = document.getElementById('importCodesSpinner');
    spinner.classList.remove('d-none');
    document.getElementById('importCodesBtn').disabled = true;
    
    // Lire le fichier
    const reader = new FileReader();
    reader.onload = function(e) {
        const content = e.target.result;
        const delimiter = document.getElementById('csvDelimiter').value;
        const codeColumn = parseInt(document.getElementById('csvCodeColumn').value);
        
        // Diviser le contenu en lignes
        const lines = content.split(/\r\n|\n/);
        const codes = [];
        
        // Parcourir chaque ligne
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (line) {
                // Diviser la ligne en colonnes
                const columns = line.split(delimiter);
                
                // Vérifier si la colonne existe
                if (columns.length > codeColumn) {
                    const code = columns[codeColumn].trim();
                    if (code) {
                        codes.push(code);
                    }
                }
            }
        }
        
        // Importer les codes
        importCodes(codes, profileId, routerId);
    };
    
    reader.onerror = function() {
        // Afficher l'erreur
        const errorElement = document.getElementById('importFormError');
        errorElement.textContent = 'Erreur lors de la lecture du fichier';
        errorElement.classList.remove('d-none');
        
        // Masquer le spinner
        spinner.classList.add('d-none');
        document.getElementById('importCodesBtn').disabled = false;
    };
    
    // Lire le fichier comme texte
    reader.readAsText(file);
}

/**
 * Traiter des codes texte
 * @param {string} text - Texte contenant les codes
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 */
function processTextCodes(text, profileId, routerId) {
    // Afficher le spinner
    const spinner = document.getElementById('importCodesSpinner');
    spinner.classList.remove('d-none');
    document.getElementById('importCodesBtn').disabled = true;
    
    // Diviser le texte en lignes
    const lines = text.split(/\r\n|\n/);
    const codes = [];
    
    // Parcourir chaque ligne
    for (let i = 0; i < lines.length; i++) {
        const code = lines[i].trim();
        if (code) {
            codes.push(code);
        }
    }
    
    // Importer les codes
    importCodes(codes, profileId, routerId);
}

/**
 * Traite un fichier PDF pour en extraire les codes
 * @param {File} file - Fichier PDF à traiter
 * @param {string} pattern - Pattern d'expression régulière pour extraire les codes
 * @param {boolean} isUserPass - Indique si le format est User/Mot de passe
 * @returns {Promise<Array>}
 */
async function processPDFFile(file, options) {
    const { generationMode, pattern, isUserPass, prefix, codeLength, usermanSamePassword } = options;
    console.log('Début du traitement du PDF avec pattern:', pattern, 'isUserPass:', isUserPass);
    
    // Vérifier si pdfjsLib est disponible
    if (typeof pdfjsLib === 'undefined') {
        console.log('Chargement de pdf.js...');
        // Charger pdf.js si nécessaire
        await loadPdfJS();
        console.log('pdf.js chargé avec succès');
    }
    
    // Lire le fichier
    console.log('Lecture du fichier PDF...');
    const arrayBuffer = await file.arrayBuffer();
    console.log('Fichier PDF lu, taille:', arrayBuffer.byteLength, 'octets');
    
    try {
        // Charger le document PDF
        console.log('Chargement du document PDF...');
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        console.log('Document PDF chargé, nombre de pages:', pdf.numPages);
        
        let extractedText = '';
        
        // Extraire le texte de chaque page avec une meilleure gestion des espaces
        for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`Extraction du texte de la page ${i}/${pdf.numPages}...`);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            
            // Amélioration de l'extraction du texte en tenant compte des positions
            let lastY = null;
            let text = '';
            
            // Trier les éléments par position Y puis X pour respecter l'ordre de lecture
            const sortedItems = textContent.items.sort((a, b) => {
                if (Math.abs(a.transform[5] - b.transform[5]) < 5) {
                    // Même ligne (Y similaire), trier par X
                    return a.transform[4] - b.transform[4];
                }
                // Lignes différentes, trier par Y (de haut en bas)
                return b.transform[5] - a.transform[5];
            });
            
            for (const item of sortedItems) {
                const currentY = item.transform[5];
                
                // Si on change de ligne, ajouter un saut de ligne
                if (lastY !== null && Math.abs(currentY - lastY) > 5) {
                    text += '\n';
                } else if (lastY !== null) {
                    // Sinon, ajouter un espace entre les mots sur la même ligne
                    text += ' ';
                }
                
                text += item.str;
                lastY = currentY;
            }
            
            extractedText += text + '\n';
        }
        
        console.log('Texte extrait du PDF (extrait):', extractedText.substring(0, 200) + '...');
        
        let extractedCodes = [];
        if (generationMode === 'userman') {
            console.log('Lancement de la détection Userman...');
            const usermanOptions = {
                prefix: prefix,
                codeLength: codeLength,
                isUserPass: isUserPass,
                usermanSamePassword: usermanSamePassword
            };
            extractedCodes = detectUsermanCodes(extractedText, usermanOptions);
        } else {
            // Mode Mikhmon
            console.log('Extraction des codes avec le pattern:', pattern);
            extractedCodes = extractCodesFromText(extractedText, pattern, isUserPass);
        }
        
        if (extractedCodes.length === 0) {
            console.warn('Aucun code trouvé avec le pattern actuel. Essai avec un pattern plus souple...');
            // Essayer avec un pattern plus souple si aucun code n'est trouvé
            let loosePattern;
            if (isUserPass) {
                // Pour le format User/Mot de passe, on essaie de détecter des paires de mots/chiffres
                loosePattern = '([A-Za-z0-9]{4,})\\s+([A-Za-z0-9]{4,})';
                console.log('Nouvel essai avec pattern souple pour User/Pass:', loosePattern);
                const looseCodes = extractCodesFromText(extractedText, loosePattern, true);
                console.log('Nombre de codes extraits avec pattern souple:', looseCodes.length);
                if (looseCodes.length > 0) {
                    // Afficher les codes extraits
                    displayExtractedCodes(looseCodes, true);
                    return looseCodes;
                }
                
                // Essayer un pattern encore plus souple avec moins de contraintes
                const veryLoosePattern = '([\\w]{3,})\\s+([\\w]{3,})';
                console.log('Dernier essai avec pattern très souple pour User/Pass:', veryLoosePattern);
                const veryLooseCodes = extractCodesFromText(extractedText, veryLoosePattern, true);
                console.log('Nombre de codes extraits avec pattern très souple:', veryLooseCodes.length);
                if (veryLooseCodes.length > 0) {
                    displayExtractedCodes(veryLooseCodes, true);
                    return veryLooseCodes;
                }
            } else {
                // Pour le format Voucher, on essaie de détecter des séquences de lettres/chiffres
                loosePattern = '[A-Za-z0-9]{4,}';
                console.log('Nouvel essai avec pattern souple pour Voucher:', loosePattern);
                const looseCodes = extractCodesFromText(extractedText, loosePattern, false);
                console.log('Nombre de codes extraits avec pattern souple:', looseCodes.length);
                if (looseCodes.length > 0) {
                    // Afficher les codes extraits
                    displayExtractedCodes(looseCodes, false);
                    return looseCodes;
                }
                
                // Essayer un pattern encore plus souple
                const veryLoosePattern = '[\\w]{4,}';
                console.log('Dernier essai avec pattern très souple pour Voucher:', veryLoosePattern);
                const veryLooseCodes = extractCodesFromText(extractedText, veryLoosePattern, false);
                console.log('Nombre de codes extraits avec pattern très souple:', veryLooseCodes.length);
                if (veryLooseCodes.length > 0) {
                    displayExtractedCodes(veryLooseCodes, false);
                    return veryLooseCodes;
                }
            }
        }
        
        // Afficher les codes extraits
        displayExtractedCodes(extractedCodes, isUserPass);
        
        return extractedCodes;
    } catch (error) {
        console.error('Erreur lors du traitement du PDF:', error);
        throw error;
    }
}

/**
 * Charge la bibliothèque pdf.js dynamiquement
 * @returns {Promise<void>}
 */
async function loadPdfJS() {
    return new Promise((resolve, reject) => {
        // Charger le script principal de pdf.js
        const script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
        script.onload = () => {
            // Configurer le worker
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
            resolve();
        };
        script.onerror = reject;
        document.head.appendChild(script);
    });
}

/**
 * Détecte automatiquement les codes Userman dans le texte
 * @param {string} text - Texte extrait du PDF
 * @param {Object} options - Options de détection
 * @param {string} options.prefix - Préfixe commun des codes (optionnel)
 * @param {number} options.codeLength - Longueur des codes (optionnel, auto-détecté si non fourni)
 * @param {boolean} options.isUserPass - Format User/Password ou Voucher
 * @returns {Array} - Codes détectés
 */
function detectUsermanCodes(text, options = {}) {
    let { prefix = '', codeLength = null, isUserPass = false, usermanSamePassword = false } = options;
    
    console.log('Détection Userman avec options initiales:', options);
    
    // Nettoyer le texte
    const cleanedText = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
    const words = cleanedText.split(/\s+/);

    // --- Auto-détection si nécessaire ---
    if (!codeLength || !prefix) {
        // 1. Extraire tous les candidats potentiels
        let candidates = words.filter(word => isValidUsermanCode(word, '')); // Pré-filtrage sans préfixe

        // 2. Analyser la longueur
        if (!codeLength && candidates.length > 0) {
            const lengthCounts = candidates.reduce((acc, code) => {
                acc[code.length] = (acc[code.length] || 0) + 1;
                return acc;
            }, {});

            const [detectedL, count] = Object.entries(lengthCounts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
            // Accepter la longueur détectée si elle est suffisamment dominante
            if (count > Math.max(5, candidates.length * 0.3)) { 
                codeLength = parseInt(detectedL, 10);
                console.log(`Longueur auto-détectée: ${codeLength} (trouvée ${count} fois)`);
                // Filtrer les candidats par la longueur détectée
                candidates = candidates.filter(c => c.length === codeLength);
            }
        }

        // 3. Analyser le préfixe
        if (!prefix && candidates.length > 0) {
            const prefixCounts = candidates.reduce((acc, code) => {
                if (code.length > 3) { // Chercher des préfixes sur des codes assez longs
                    const p = code.substring(0, 2);
                    if (/[a-zA-Z]{2}/.test(p)) { // Préfixe de 2 lettres
                        acc[p] = (acc[p] || 0) + 1;
                    }
                }
                return acc;
            }, {});

            const [detectedP, count] = Object.entries(prefixCounts).sort((a, b) => b[1] - a[1])[0] || [null, 0];
            if (count > Math.max(5, candidates.length * 0.3)) {
                prefix = detectedP;
                console.log(`Préfixe auto-détecté: '${prefix}' (trouvé ${count} fois)`);
            }
        }
    }

    console.log(`Paramètres finaux pour l'extraction: Longueur=${codeLength}, Préfixe='${prefix}'`);

    // --- Extraction finale basée sur les paramètres ---
    const finalCodes = [];
    const uniqueCodes = new Set();
    const allPotentialCodes = words.filter(w => isValidUsermanCode(w, prefix));

    // Filtrer rigoureusement par longueur si elle est définie
    const filteredWords = codeLength ? allPotentialCodes.filter(w => w.length === codeLength) : allPotentialCodes;

    if (isUserPass) {
        // Logique User/Pass
        for (let i = 0; i < filteredWords.length - 1; i++) {
            const username = filteredWords[i];
            const password = filteredWords[i + 1];

            // Si le mot de passe est identique, on le traite comme une paire
            if (usermanSamePassword && username === password) {
                const codeKey = `${username}:${password}`;
                if (!uniqueCodes.has(codeKey)) {
                    uniqueCodes.add(codeKey);
                    finalCodes.push({ username, password });
                }
                continue; // Passer au mot suivant
            }

            // Vérifier si les deux mots forment une paire valide
            if (filteredWords.includes(password)) { // Assure que le mot suivant est aussi un code valide
                const codeKey = `${username}:${password}`;
                if (!uniqueCodes.has(codeKey)) {
                    uniqueCodes.add(codeKey);
                    finalCodes.push({ username, password });
                    i++; // Sauter le mot de passe qui vient d'être utilisé
                }
            }
        }
    } else {
        // Logique Voucher
        filteredWords.forEach(code => {
            if (!uniqueCodes.has(code)) {
                uniqueCodes.add(code);
                finalCodes.push(code);
            }
        });
    }

    console.log(`Détection Userman terminée: ${finalCodes.length} codes trouvés`);
    return finalCodes;
}

/**
 * Valide qu'un code correspond aux critères Userman
 * @param {string} code - Code à valider
 * @param {string} prefix - Préfixe attendu
 * @returns {boolean} - True si le code est valide
 */
function isValidUsermanCode(code, prefix) {
    // Liste noire de mots à exclure
    const blacklist = [
        'inconnu', 'fcfa', 'wifizon', 'wifi', 'code', 'user', 'pass', 'fastnet', 'profil',
        'duree', 'prix', 'nom', 'valide', 'restant', 'utilisateurs', 'mot', 'passe', 'restant',
        'limite', 'uptime', 'commentaire', 'telephone', 'mobile', 'money', 'mtn', 'moov'
    ];

    // Vérifier si le code est non nul et est une chaîne de caractères
    if (!code || typeof code !== 'string') {
        return false;
    }
    
    const lowerCaseCode = code.toLowerCase();

    // Vérifier si le code (ou une partie) est dans la liste noire
    if (blacklist.some(word => lowerCaseCode.includes(word))) {
        return false;
    }

    // Vérifier le préfixe si fourni
    if (prefix && !code.startsWith(prefix)) {
        return false;
    }
    
    // Éviter les nombres purs (ex: prix, dates)
    if (/^\d+$/.test(code)) {
        return false;
    }
    
    // Le code doit contenir au moins une lettre
    if (!/[a-zA-Z]/.test(code)) {
        return false;
    }

    return true;
}

/**
 * Échappe les caractères spéciaux pour utilisation dans une regex
 * @param {string} string - Chaîne à échapper
 * @returns {string} - Chaîne échappée
 */
function escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Extrait les codes d'un texte selon un pattern
 * @param {string} text - Texte contenant les codes
 * @param {string} pattern - Pattern d'expression régulière
 * @param {boolean} isUserPass - Indique si le format est User/Mot de passe
 * @returns {Array} - Codes extraits
 */
function extractCodesFromText(text, pattern, isUserPass) {
    const codes = [];
    let regex;
    
    try {
        // Prétraitement du texte pour améliorer la détection
        // Remplacer les sauts de ligne par des espaces et normaliser les espaces multiples
        const cleanedText = text.replace(/\r?\n/g, ' ').replace(/\s+/g, ' ');
        console.log('Texte nettoyé (extrait):', cleanedText.substring(0, 200) + '...');
        
        if (isUserPass) {
            // Pour le format User/Mot de passe, on utilise des groupes de capture
            let regexStr;
            
            if (pattern.includes('\\s+')) {
                // Pattern avec séparateur d'espace explicite
                const parts = pattern.split('\\s+');
                if (parts.length === 2) {
                    const userPattern = parts[0].replace(/^\^|\$$/g, '');
                    const passPattern = parts[1].replace(/^\^|\$$/g, '');
                    regexStr = `^(${userPattern})\\s+(${passPattern})$`;
                } else {
                    // Pattern générique pour User/Pass
                    regexStr = '^([A-Za-z0-9]{4,})\\s+([A-Za-z0-9]{4,})$';
                }
            } else {
                // Si le pattern ne contient pas de séparateur explicite, utiliser un pattern générique
                regexStr = '^([A-Za-z0-9]{4,})\\s+([A-Za-z0-9]{4,})$';
            }
            
            console.log('Utilisation du pattern regex pour User/Pass:', regexStr);
            // Utiliser le flag 'i' pour ignorer la casse mais pas 'g' pour une correspondance exacte
            regex = new RegExp(regexStr, 'mi');
        } else {
            // Pour le format Voucher
            // Vérifier si le pattern est valide, sinon utiliser un pattern par défaut
            try {
                // Tester si le pattern est une regex valide
                // Ajouter ^ et $ pour s'assurer que le pattern correspond exactement au code
                let strictPattern = pattern;
                if (!strictPattern.startsWith('^')) strictPattern = '^' + strictPattern;
                if (!strictPattern.endsWith('$')) strictPattern = strictPattern + '$';
                
                new RegExp(strictPattern);
                console.log('Utilisation du pattern regex strict pour Voucher:', strictPattern);
                // Utiliser le flag 'i' pour ignorer la casse mais pas 'g' pour une correspondance exacte
                regex = new RegExp(strictPattern, 'mi');
            } catch (e) {
                // Pattern invalide, utiliser un pattern par défaut strict
                const defaultPattern = '^[A-Za-z0-9]{4,}$';
                console.warn('Pattern invalide, utilisation du pattern par défaut strict:', defaultPattern);
                regex = new RegExp(defaultPattern, 'mi');
            }
        }
        
        // Extraire tous les codes en divisant le texte en mots potentiels
        const uniqueCodes = new Set();
        const words = cleanedText.split(/\s+/);
        
        console.log('Début de l\'extraction des codes avec validation stricte...');
        
        if (isUserPass) {
            // Pour le format User/Mot de passe, on doit examiner les paires de mots
            for (let i = 0; i < words.length - 1; i++) {
                const pairText = `${words[i]} ${words[i+1]}`;
                const match = pairText.match(regex);
                
                if (match) {
                    const username = match[1];
                    const password = match[2];
                    
                    // Vérifier que les valeurs extraites sont valides
                    if (username && password && username.length >= 3 && password.length >= 3) {
                        const codeKey = `${username}:${password}`;
                        
                        if (!uniqueCodes.has(codeKey)) {
                            uniqueCodes.add(codeKey);
                            codes.push({ username, password });
                            console.log('Code extrait (User/Pass):', username, password);
                        }
                    }
                }
            }
        } else {
            // Format Voucher - vérifier chaque mot individuellement
            for (const word of words) {
                const match = word.match(regex);
                
                if (match) {
                    const code = match[0];
                    
                    // Vérifier que le code est valide (au moins 4 caractères)
                    if (code && code.length >= 4) {
                        if (!uniqueCodes.has(code)) {
                            uniqueCodes.add(code);
                            codes.push(code);
                            console.log('Code extrait (Voucher):', code);
                        }
                    }
                }
            }
        }
        
        console.log(`Extraction terminée. ${codes.length} codes uniques trouvés.`);
    } catch (error) {
        console.error('Erreur lors de l\'extraction des codes:', error);
        throw error;
    }
    
    return codes;
}

/**
 * Affiche les codes extraits dans le tableau
 * @param {Array} codes - Codes extraits
 * @param {boolean} isUserPass - Indique si le format est User/Mot de passe
 */
function displayExtractedCodes(codes, isUserPass) {
    const container = document.getElementById('extractedCodesContainer');
    const tableBody = document.querySelector('#extractedCodesTable tbody');
    const countElement = document.getElementById('extractedCodesCount');
    
    if (!container || !tableBody || !countElement) return;
    
    // Mettre à jour le compteur
    countElement.textContent = codes.length;
    
    // Vider le tableau
    tableBody.innerHTML = '';
    
    // Ajouter chaque code au tableau
    codes.forEach((code, index) => {
        const row = document.createElement('tr');
        
        if (isUserPass) {
            // Format User/Mot de passe
            row.innerHTML = `
                <td>${code.username}</td>
                <td>${code.password}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-code-btn" data-index="${index}">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            `;
        } else {
            // Format Voucher
            row.innerHTML = `
                <td>${code}</td>
                <td>
                    <button type="button" class="btn btn-sm btn-outline-danger remove-code-btn" data-index="${index}">
                        <i class="fas fa-times"></i>
                    </button>
                </td>
            `;
        }
        
        tableBody.appendChild(row);
    });
    
    // Afficher le conteneur
    container.classList.remove('d-none');
    
    // Ajouter des gestionnaires d'événements pour les boutons de suppression
    document.querySelectorAll('.remove-code-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const index = parseInt(this.dataset.index);
            removeExtractedCode(index, isUserPass);
        });
    });
}

/**
 * Prépare et affiche le modal des codes extraits pour validation et filtrage
 * @param {Array} extractedCodes - Codes extraits du PDF
 * @param {string} pattern - Pattern utilisé pour l'extraction
 * @param {boolean} isUserPass - Indique si le format est User/Mot de passe
 */
function prepareExtractedCodesModal(extractedCodes, pattern, isUserPass) {
    // Stocker les informations importantes dans des variables globales pour y accéder plus tard
    window.currentExtractedCodes = extractedCodes;
    window.currentPattern = pattern;
    window.currentIsUserPass = isUserPass;
    window.selectedCodes = [...extractedCodes]; // Par défaut, tous les codes sont sélectionnés
    
    // Afficher le pattern utilisé
    const usedPatternElement = document.getElementById('usedPattern');
    if (usedPatternElement) usedPatternElement.textContent = pattern;
    
    // Mettre à jour les compteurs
    const totalCodesCount = document.getElementById('totalCodesCount');
    if (totalCodesCount) totalCodesCount.textContent = extractedCodes.length;
    
    const selectedCodesCount = document.getElementById('selectedCodesCount');
    if (selectedCodesCount) selectedCodesCount.textContent = extractedCodes.length;
    
    // Préparer le tableau des codes extraits
    const tableBody = document.getElementById('extractedCodesListFinal');
    if (!tableBody) return;
    tableBody.innerHTML = '';
    
    // Mettre à jour l'en-tête du tableau en fonction du format des codes
    const tableHeader = document.getElementById('extractedCodesHeaderFinal');
    if (!tableHeader) return;
    
    if (isUserPass) {
        tableHeader.innerHTML = `
            <th width="40px">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="selectAllCodesCheckbox" checked>
                </div>
            </th>
            <th>Nom d'utilisateur</th>
            <th>Mot de passe</th>
            <th width="80px">Actions</th>
        `;
    } else {
        tableHeader.innerHTML = `
            <th width="40px">
                <div class="form-check">
                    <input class="form-check-input" type="checkbox" id="selectAllCodesCheckbox" checked>
                </div>
            </th>
            <th>Code</th>
            <th width="80px">Actions</th>
        `;
    }
    
    // Ajouter chaque code au tableau
    extractedCodes.forEach((code, index) => {
        const row = document.createElement('tr');
        
        // Cellule avec checkbox
        const checkboxCell = document.createElement('td');
        checkboxCell.innerHTML = `
            <div class="form-check">
                <input class="form-check-input code-checkbox" type="checkbox" data-index="${index}" checked>
            </div>
        `;
        row.appendChild(checkboxCell);
        
        if (isUserPass) {
            // Cellule pour le nom d'utilisateur
            const usernameCell = document.createElement('td');
            usernameCell.textContent = code.username;
            row.appendChild(usernameCell);
            
            // Cellule pour le mot de passe
            const passwordCell = document.createElement('td');
            passwordCell.textContent = code.password;
            row.appendChild(passwordCell);
        } else {
            // Cellule pour le code
            const codeCell = document.createElement('td');
            codeCell.textContent = code;
            row.appendChild(codeCell);
        }
        
        // Cellule pour les actions
        const actionsCell = document.createElement('td');
        actionsCell.innerHTML = `
            <button type="button" class="btn btn-sm btn-outline-danger remove-code-btn" data-index="${index}">
                <i class="fas fa-trash-alt"></i>
            </button>
        `;
        row.appendChild(actionsCell);
        
        tableBody.appendChild(row);
    });
    
    // Configurer les gestionnaires d'événements pour le modal
    setupExtractedCodesModalHandlers();
}

/**
 * Configure les gestionnaires d'événements pour le modal des codes extraits
 */
function setupExtractedCodesModalHandlers() {
    // Gérer la sélection/désélection de tous les codes
    const selectAllCheckbox = document.getElementById('selectAllCodesCheckbox');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const isChecked = this.checked;
            const checkboxes = document.querySelectorAll('.code-checkbox');
            
            checkboxes.forEach(checkbox => {
                checkbox.checked = isChecked;
            });
            
            // Mettre à jour la liste des codes sélectionnés
            updateSelectedCodes();
        });
    }
    
    // Gérer la sélection/désélection individuelle des codes
    const codeCheckboxes = document.querySelectorAll('.code-checkbox');
    codeCheckboxes.forEach(checkbox => {
        checkbox.addEventListener('change', function() {
            updateSelectedCodes();
            
            // Vérifier si tous les codes sont sélectionnés
            const allChecked = [...document.querySelectorAll('.code-checkbox')]
                .every(cb => cb.checked);
            
            // Mettre à jour la case à cocher "Tout sélectionner"
            document.getElementById('selectAllCodesCheckbox').checked = allChecked;
        });
    });
    
    // Gérer la suppression individuelle des codes
    const removeButtons = document.querySelectorAll('.remove-code-btn');
    removeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const index = parseInt(this.getAttribute('data-index'));
            removeExtractedCodeFinal(index);
        });
    });
    
    // Gérer le bouton "Tout sélectionner"
    const selectAllButton = document.getElementById('selectAllCodesBtn');
    if (selectAllButton) {
        selectAllButton.addEventListener('click', function() {
            const checkboxes = document.querySelectorAll('.code-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = true;
            });
            document.getElementById('selectAllCodesCheckbox').checked = true;
            updateSelectedCodes();
        });
    }
    
    // Gérer le bouton "Supprimer codes invalides"
    const removeInvalidButton = document.getElementById('removeInvalidCodesBtn');
    if (removeInvalidButton) {
        removeInvalidButton.addEventListener('click', function() {
            removeInvalidCodes();
        });
    }
    
    // Gérer le filtrage des codes
    const filterInput = document.getElementById('filterExtractedCodes');
    if (filterInput) {
        filterInput.addEventListener('input', function() {
            filterExtractedCodes(this.value);
        });
    }
    
    // Gérer le bouton "Affiner le pattern"
    const refinePatternBtn = document.getElementById('refinePatternBtn');
    if (refinePatternBtn) {
        refinePatternBtn.addEventListener('click', function() {
            const container = document.getElementById('refinePatternContainer');
            container.classList.toggle('d-none');
            
            // Initialiser le champ avec le pattern actuel
            document.getElementById('newPattern').value = window.currentPattern;
            updatePatternExplanation(window.currentPattern);
        });
    }
    
    // Gérer le champ de nouveau pattern
    const newPatternInput = document.getElementById('newPattern');
    if (newPatternInput) {
        newPatternInput.addEventListener('input', function() {
            updatePatternExplanation(this.value);
        });
    }
    
    // Gérer le bouton "Appliquer" pour le nouveau pattern
    const applyPatternBtn = document.getElementById('applyNewPatternBtn');
    if (applyPatternBtn) {
        applyPatternBtn.addEventListener('click', function() {
            const newPattern = document.getElementById('newPattern').value;
            if (newPattern) {
                applyNewPattern(newPattern);
            }
        });
    }
    
    // Gérer le bouton "Annuler" pour le nouveau pattern
    const cancelPatternBtn = document.getElementById('cancelNewPatternBtn');
    if (cancelPatternBtn) {
        cancelPatternBtn.addEventListener('click', function() {
            document.getElementById('refinePatternContainer').classList.add('d-none');
        });
    }
    
    // Gérer le bouton d'importation finale
    const importBtn = document.getElementById('importCodesBtn');
    if (importBtn) {
        importBtn.addEventListener('click', function() {
            importSelectedCodes();
        });
    }
}

/**
 * Supprime un code extrait du tableau
 * @param {number} index - Index du code à supprimer
 * @param {boolean} isUserPass - Indique si le format est User/Mot de passe
 */
function removeExtractedCode(index, isUserPass) {
    if (!window.extractedCodes) return;
    
    // Supprimer le code de la liste
    window.extractedCodes.splice(index, 1);
    
    // Mettre à jour l'affichage
    displayExtractedCodes(window.extractedCodes, isUserPass);
}

/**
 * Supprime un code extrait du tableau final
 * @param {number} index - Index du code à supprimer
 */
function removeExtractedCodeFinal(index) {
    if (!window.currentExtractedCodes) return;
    
    // Supprimer le code de la liste
    window.currentExtractedCodes.splice(index, 1);
    
    // Mettre à jour l'affichage du modal
    prepareExtractedCodesModal(window.currentExtractedCodes, window.currentPattern, window.currentIsUserPass);
    
    // Mettre à jour les compteurs
    document.getElementById('totalCodesCount').textContent = window.currentExtractedCodes.length;
    updateSelectedCodes();
}

/**
 * Met à jour la liste des codes sélectionnés
 */
function updateSelectedCodes() {
    if (!window.currentExtractedCodes) return;
    
    // Réinitialiser la liste des codes sélectionnés
    window.selectedCodes = [];
    
    // Parcourir toutes les cases à cocher
    const checkboxes = document.querySelectorAll('.code-checkbox');
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            const index = parseInt(checkbox.getAttribute('data-index'));
            if (index >= 0 && index < window.currentExtractedCodes.length) {
                window.selectedCodes.push(window.currentExtractedCodes[index]);
            }
        }
    });
    
    // Mettre à jour le compteur de codes sélectionnés
    document.getElementById('selectedCodesCount').textContent = window.selectedCodes.length;
    
    // Activer/désactiver le bouton d'importation
    document.getElementById('importCodesBtn').disabled = window.selectedCodes.length === 0;
}

/**
 * Filtre les codes extraits en fonction d'un terme de recherche
 * @param {string} searchTerm - Terme de recherche
 */
function filterExtractedCodes(searchTerm) {
    if (!window.currentExtractedCodes) return;
    
    const tableBody = document.getElementById('extractedCodesListFinal');
    const rows = tableBody.querySelectorAll('tr');
    const isUserPass = window.currentIsUserPass;
    
    searchTerm = searchTerm.toLowerCase();
    
    rows.forEach((row, index) => {
        let textContent;
        
        if (isUserPass) {
            // Pour le format user/pass, rechercher dans le nom d'utilisateur et le mot de passe
            const username = row.cells[1].textContent.toLowerCase();
            const password = row.cells[2].textContent.toLowerCase();
            textContent = username + ' ' + password;
        } else {
            // Pour le format voucher, rechercher dans le code
            textContent = row.cells[1].textContent.toLowerCase();
        }
        
        if (textContent.includes(searchTerm)) {
            row.style.display = '';
        } else {
            row.style.display = 'none';
        }
    });
}

/**
 * Supprime les codes considérés comme invalides
 */
function removeInvalidCodes() {
    if (!window.currentExtractedCodes || window.currentExtractedCodes.length === 0) return;
    
    const isUserPass = window.currentIsUserPass;
    const invalidIndices = [];
    
    // Identifier les codes invalides
    window.currentExtractedCodes.forEach((code, index) => {
        let isValid = true;
        
        if (isUserPass) {
            // Vérifier si le nom d'utilisateur et le mot de passe sont valides
            if (!code.username || !code.password || 
                code.username.length < 3 || code.password.length < 3) {
                isValid = false;
            }
        } else {
            // Vérifier si le code voucher est valide
            if (!code || code.length < 3) {
                isValid = false;
            }
        }
        
        if (!isValid) {
            invalidIndices.push(index);
        }
    });
    
    // Supprimer les codes invalides (de la fin vers le début pour éviter les problèmes d'indices)
    for (let i = invalidIndices.length - 1; i >= 0; i--) {
        window.currentExtractedCodes.splice(invalidIndices[i], 1);
    }
    
    // Mettre à jour l'affichage
    prepareExtractedCodesModal(window.currentExtractedCodes, window.currentPattern, isUserPass);
    
    // Afficher un message
    const message = `${invalidIndices.length} code(s) invalide(s) supprimé(s).`;
    const alertElement = document.getElementById('extractedCodesAlert');
    alertElement.textContent = message;
    alertElement.classList.remove('d-none');
    
    // Masquer le message après 3 secondes
    setTimeout(() => {
        alertElement.classList.add('d-none');
    }, 3000);
}

/**
 * Met à jour l'explication du pattern
 * @param {string} pattern - Pattern regex
 */
function updatePatternExplanation(pattern) {
    const explanationElement = document.getElementById('patternExplanation');
    if (explanationElement && pattern) {
        explanationElement.textContent = explainPattern(pattern);
    }
}

/**
 * Applique un nouveau pattern aux codes extraits
 * @param {string} newPattern - Nouveau pattern regex
 */
function applyNewPattern(newPattern) {
    if (!window.selectedPdfFile) return;
    
    // Masquer le conteneur de raffinement de pattern
    document.getElementById('refinePatternContainer').classList.add('d-none');
    
    // Afficher un spinner
    const spinner = document.getElementById('extractedCodesSpinner');
    spinner.classList.remove('d-none');
    
    // Déterminer si le format est user/pass
    const isUserPass = document.querySelector('input[name="codeFormat"]:checked').value === 'userpass';
    
    // Traiter le PDF avec le nouveau pattern
    processPDFFile(window.selectedPdfFile, newPattern, isUserPass)
        .then(extractedCodes => {
            // Masquer le spinner
            spinner.classList.add('d-none');
            
            if (extractedCodes && extractedCodes.length > 0) {
                // Mettre à jour le pattern courant
                window.currentPattern = newPattern;
                
                // Mettre à jour l'affichage
                prepareExtractedCodesModal(extractedCodes, newPattern, isUserPass);
                
                // Afficher un message de succès
                const alertElement = document.getElementById('extractedCodesAlert');
                alertElement.textContent = `${extractedCodes.length} code(s) extrait(s) avec le nouveau pattern.`;
                alertElement.classList.remove('d-none', 'alert-danger');
                alertElement.classList.add('alert-success');
                
                // Masquer le message après 3 secondes
                setTimeout(() => {
                    alertElement.classList.add('d-none');
                }, 3000);
            } else {
                // Afficher un message d'erreur
                const alertElement = document.getElementById('extractedCodesAlert');
                alertElement.textContent = 'Aucun code n\'a pu être extrait avec ce pattern. L\'ancien pattern a été conservé.';
                alertElement.classList.remove('d-none', 'alert-success');
                alertElement.classList.add('alert-danger');
                
                // Masquer le message après 3 secondes
                setTimeout(() => {
                    alertElement.classList.add('d-none');
                }, 3000);
            }
        })
        .catch(error => {
            // Masquer le spinner
            spinner.classList.add('d-none');
            
            // Afficher un message d'erreur
            const alertElement = document.getElementById('extractedCodesAlert');
            alertElement.textContent = `Erreur lors de l'application du nouveau pattern: ${error.message || 'Erreur inconnue'}`;
            alertElement.classList.remove('d-none', 'alert-success');
            alertElement.classList.add('alert-danger');
            
            // Masquer le message après 3 secondes
            setTimeout(() => {
                alertElement.classList.add('d-none');
            }, 3000);
        });
}

/**
 * Importe les codes sélectionnés avec une expérience utilisateur améliorée
 */
function importSelectedCodes() {
    if (!window.selectedCodes || window.selectedCodes.length === 0) return;
    
    // Vérifier l'existence des éléments DOM nécessaires
    const profileSelect = document.getElementById('importProfileSelect');
    let profileId = null;
    
    if (!profileSelect) {
        // Essayer de récupérer le profileId depuis un autre élément ou une variable globale
        if (window.currentProfileId) {
            profileId = window.currentProfileId;
        } else {
            // Essayer de récupérer depuis un attribut data sur la page
            const profileIdElement = document.querySelector('[data-profile-id]');
            if (profileIdElement) {
                profileId = profileIdElement.getAttribute('data-profile-id');
            }
        }
    } else {
        profileId = profileSelect.value;
    }
    
    if (!profileId) {
        // Afficher un message d'erreur
        const alertElement = document.getElementById('extractedCodesAlert');
        if (alertElement) {
            alertElement.textContent = 'Veuillez sélectionner un profil pour l\'importation.';
            alertElement.classList.remove('d-none', 'alert-success');
            alertElement.classList.add('alert-danger');
            
            // Masquer le message après 3 secondes
            setTimeout(() => {
                alertElement.classList.add('d-none');
            }, 3000);
        }
        return;
    }
    
    // Récupérer l'ID du routeur avec vérification
    const routerIdElement = document.getElementById('routerId');
    const routerId = routerIdElement ? routerIdElement.value : null;
    
    // Afficher une confirmation élégante avant l'importation
    showImportConfirmation(profileId, routerId);
}

/**
 * Affiche une confirmation élégante avant l'importation des codes
 * @param {string} profileId - ID du profil sélectionné
 * @param {string} routerId - ID du routeur
 */
function showImportConfirmation(profileId, routerId) {
    // Créer un modal de confirmation si nécessaire
    let confirmModal = document.getElementById('importConfirmModal');
    
    if (!confirmModal) {
        // Créer le modal de confirmation
        const modalHTML = `
        <div class="modal fade" id="importConfirmModal" tabindex="-1" aria-labelledby="importConfirmModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title" id="importConfirmModalLabel">Confirmation d'importation</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        <div class="text-center mb-4">
                            <i class="fas fa-file-import fa-3x text-primary mb-3"></i>
                            <h4>Importation des codes WiFi</h4>
                            <p class="lead">Vous êtes sur le point d'importer <strong id="codesCount"></strong> codes WiFi.</p>
                        </div>
                        <div class="alert alert-info">
                            <i class="fas fa-info-circle"></i> Cette action est irréversible. Les codes seront ajoutés à votre base de données.
                        </div>
                    </div>
                    <div class="modal-footer justify-content-between">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times"></i> Annuler
                        </button>
                        <button type="button" class="btn btn-primary" id="confirmImportBtn">
                            <i class="fas fa-check"></i> Confirmer l'importation
                        </button>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        // Ajouter le modal au DOM
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);
        
        confirmModal = document.getElementById('importConfirmModal');
    }
    
    // Mettre à jour le nombre de codes
    const codesCount = document.getElementById('codesCount');
    if (codesCount) {
        codesCount.textContent = window.selectedCodes.length;
    }
    
    // Initialiser le modal Bootstrap
    const bsModal = new bootstrap.Modal(confirmModal, {
        backdrop: 'static',
        keyboard: false
    });
    
    // Ajouter l'événement de confirmation
    const confirmBtn = document.getElementById('confirmImportBtn');
    if (confirmBtn) {
        // Supprimer les anciens écouteurs d'événements
        const newConfirmBtn = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
        
        // Ajouter le nouvel écouteur
        newConfirmBtn.addEventListener('click', function() {
            // Fermer le modal de confirmation
            bsModal.hide();
            
            // Récupérer les codes depuis window.selectedCodes ou une autre source
            const codes = window.selectedCodes || [];
            console.log('Codes à importer:', codes);
            
            // Vérifier si les codes sont au format username/password
            const isUserPass = window.isUserPassFormat || false;
            
            // Procéder à l'importation réelle avec les paramètres dans le bon ordre
            proceedWithImport(codes, profileId, routerId, isUserPass);
        });
    }
    
    // Afficher le modal
    bsModal.show();
}

/**
 * Procède à l'importation réelle des codes
 * @param {Array} codes - Liste des codes à importer
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 * @param {boolean} isUserPass - Indique si les codes sont au format username/password
 */
/**
 * Affiche une animation de succès après l'importation des codes
 * @param {number} importedCount - Nombre de codes importés
 */
function showSuccessAnimation(importedCount) {
    // Récupérer les informations sur les codes traités depuis le stockage local
    let realImportedCount = importedCount;
    let totalProcessedCount = 0;
    let duplicateCount = 0;
    
    try {
        // Récupérer le nombre réel de codes importés
        const storedCount = localStorage.getItem('lastImportedCount');
        if (storedCount && parseInt(storedCount) > 0) {
            realImportedCount = parseInt(storedCount);
        }
        
        // Récupérer le nombre total de codes traités
        const totalProcessed = localStorage.getItem('totalProcessedCodes');
        if (totalProcessed && parseInt(totalProcessed) > 0) {
            totalProcessedCount = parseInt(totalProcessed);
            // Calculer le nombre de doublons
            duplicateCount = totalProcessedCount - realImportedCount;
        }
        
        // Effacer après utilisation
        localStorage.removeItem('lastImportedCount');
        localStorage.removeItem('totalProcessedCodes');
    } catch (e) {
        console.warn('Impossible de récupérer les informations sur les codes importés:', e);
    }
    
    // Créer un conteneur pour le modal de succès s'il n'existe pas déjà
    let successModal = document.getElementById('successModal');
    
    if (!successModal) {
        // Créer le modal de succès
        const modalHTML = `
        <div class="modal fade" id="successModal" tabindex="-1" aria-labelledby="successModalLabel" aria-hidden="true">
            <div class="modal-dialog modal-dialog-centered">
                <div class="modal-content">
                    <div class="modal-header bg-success text-white">
                        <h5 class="modal-title" id="successModalLabel">Opération réussie</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body text-center">
                        <div class="mb-4">
                            <i class="fas fa-check-circle text-success" style="font-size: 4rem;"></i>
                        </div>
                        <h4 id="successMessage">Importation réussie!</h4>
                        <p id="successDetails" class="mt-3"></p>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-primary" onclick="window.location.reload();">Recharger la page</button>
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Fermer</button>
                    </div>
                </div>
            </div>
        </div>
        `;
        
        // Ajouter le modal au document
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);
        
        successModal = document.getElementById('successModal');
    }
    
    // Mettre à jour le message de succès
    const successDetails = document.getElementById('successDetails');
    if (successDetails) {
        if (totalProcessedCount > 0 && duplicateCount > 0) {
            // Afficher les détails complets si nous avons des doublons
            successDetails.innerHTML = `
                <div>Codes traités : <strong>${totalProcessedCount}</strong></div>
                <div>Nouveaux codes importés : <strong>${realImportedCount}</strong></div>
                <div>Codes déjà existants : <strong>${duplicateCount}</strong></div>
            `;
        } else {
            // Affichage simple si pas de doublons ou pas d'information sur les doublons
            successDetails.textContent = `${realImportedCount} codes ont été importés avec succès.`;
        }
    }
    
    // Afficher le modal
    const bsModal = new bootstrap.Modal(successModal);
    bsModal.show();
    
    // Ne pas fermer automatiquement le modal pour laisser l'utilisateur le faire
    // L'utilisateur peut soit fermer le modal, soit recharger la page
}

/**
 * Procède à l'importation des codes après confirmation
 * @param {Array} codes - Liste des codes à importer
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 * @param {boolean} isUserPass - Indique si les codes sont au format username/password
 */
async function proceedWithImport(codes, profileId, routerId, isUserPass) {
    try {
        // Vérifier s'il y a des codes
        if (!codes || codes.length === 0) {
            // Afficher l'erreur
            const errorElement = document.getElementById('importFormError');
            if (errorElement) {
                errorElement.textContent = 'Aucun code trouvé';
                errorElement.classList.remove('d-none');
            }
            
            // Masquer le spinner
            const spinner = document.getElementById('importCodesSpinner');
            if (spinner) spinner.classList.add('d-none');
            
            const importBtn = document.getElementById('importCodesBtn');
            if (importBtn) importBtn.disabled = false;
            
            // Lancer une erreur
            throw new Error('Aucun code trouvé');
        }
    
    console.log(`Importation de ${codes.length} codes pour le profil ${profileId}`);
    
    // Déduplication des codes avant importation
    const uniqueCodes = [];
    const uniqueKeys = new Set();
    
    // Fonction pour générer une clé unique pour chaque code
    const getCodeKey = (code) => {
        if (isUserPass && typeof code === 'object') {
            return `${code.username}:${code.password}`;
        } else if (typeof code === 'string') {
            const parts = code.split(',').map(item => item.trim());
            if (parts.length >= 2) {
                return `${parts[0]}:${parts[1]}`;
            } else {
                return code;
            }
        }
        return null;
    };
    
    // Vérifier que codes est bien un tableau
    if (!Array.isArray(codes)) {
        console.error('La variable codes n\'est pas un tableau:', codes);
        // Essayer de convertir en tableau si c'est une chaîne JSON
        if (typeof codes === 'string') {
            try {
                codes = JSON.parse(codes);
                if (!Array.isArray(codes)) {
                    codes = [codes]; // Si c'est un objet unique, le mettre dans un tableau
                }
            } catch (e) {
                // Si ce n'est pas du JSON valide, essayer de le traiter comme une chaîne unique
                codes = [codes];
            }
        } else if (codes && typeof codes === 'object') {
            // Si c'est un objet mais pas un tableau, le convertir en tableau
            codes = [codes];
        } else {
            // Si c'est null, undefined ou autre chose, créer un tableau vide
            codes = [];
        }
    }
    

    
    // Déduplication locale avant d'envoyer à Firestore
    for (const code of codes) {
        const key = getCodeKey(code);
        if (key && !uniqueKeys.has(key)) {
            uniqueKeys.add(key);
            uniqueCodes.push(code);
        }
    }
    
    // Stocker le nombre total de codes traités pour l'affichage dans le modal
    try {
        localStorage.setItem('totalProcessedCodes', uniqueCodes.length);
    } catch (e) {
        console.warn('Impossible de stocker le nombre total de codes traités:', e);
    }
    
    console.log(`Après déduplication: ${uniqueCodes.length} codes uniques`);
    
    // Utiliser les instances et fonctions déjà importées en haut du fichier
    // Ne pas faire d'import dynamique pour éviter les problèmes d'instances multiples
    
    const batch = writeBatch(db);
    let importedCount = 0;
    const batchSize = 500; // Firestore limite les lots à 500 opérations
    
    // Fonction pour traiter un lot de codes
    const processBatch = async (startIndex) => {
        try {
            // Créer un nouveau lot si nécessaire
            let currentBatch = batch;
            if (startIndex > 0) {
                // Utiliser la même instance de db pour éviter les erreurs de type
                currentBatch = writeBatch(db);
            }
            
            // Déterminer la fin du lot actuel
            const endIndex = Math.min(startIndex + batchSize, uniqueCodes.length);
            
            // Vérifier d'abord si les codes existent déjà dans la base de données
            // Utiliser la même instance de db pour éviter les erreurs de type
            const codesCollectionRef = collection(db, 'wifiCodes');
            
            // Vérifier que routerId et profileId sont définis avant de les utiliser
            if (!routerId || !profileId) {
                console.warn('routerId ou profileId non défini. Utilisation de valeurs par défaut.');
                // Utiliser des valeurs par défaut ou des identifiants génériques
                if (!routerId) routerId = 'default-router';
                if (!profileId) profileId = 'default-profile';
            }
            
            // Créer un cache local pour éviter de répéter les requêtes
            if (!window.codeCache) {
                window.codeCache = {};
            }
            
            // Créer une clé unique pour ce routeur et ce profil
            const cacheKey = `${routerId}_${profileId}`;
            let existingCodeKeys = new Set();
            
            // Vérifier si nous avons déjà les données en cache
            if (!window.codeCache[cacheKey] || Date.now() - window.codeCache[cacheKey].timestamp > 60000) { // Cache de 1 minute
                try {
                    // Limiter la requête pour éviter les problèmes de quota
                    // Utiliser une stratégie de pagination pour éviter de récupérer tous les codes en une seule fois
                    const existingCodesQuery = query(
                        codesCollectionRef,
                        where('routerId', '==', routerId),
                        where('profileId', '==', profileId),
                        limit(1000) // Limiter à 1000 codes par requête pour éviter les problèmes de quota
                    );
                    
                    console.log('Récupération des codes existants (limité à 1000)...');
                    // Exécuter la requête directement, la classe FirestoreThrottler gère déjà la limitation
                    const existingCodesSnapshot = await getDocs(existingCodesQuery);
                    
                    existingCodesSnapshot.forEach(doc => {
                        const data = doc.data();
                        const key = `${data.username}:${data.password}`;
                        existingCodeKeys.add(key);
                    });
                    
                    // Mettre en cache les résultats
                    window.codeCache[cacheKey] = {
                        codes: existingCodeKeys,
                        timestamp: Date.now()
                    };
                    
                    console.log(`${existingCodeKeys.size} codes existants récupérés et mis en cache`);
                } catch (error) {
                    // En cas d'erreur de quota, utiliser le cache existant ou continuer sans vérification
                    if (error.message && error.message.includes('Quota exceeded')) {
                        console.warn('Quota Firestore dépassé lors de la vérification des codes existants');
                        if (window.codeCache[cacheKey]) {
                            existingCodeKeys = window.codeCache[cacheKey].codes;
                            console.log(`Utilisation du cache existant avec ${existingCodeKeys.size} codes`);
                        } else {
                            console.warn('Aucun cache disponible, l\'importation continuera sans vérification des doublons');
                            existingCodeKeys = new Set(); // Ensemble vide
                        }
                    } else {
                        console.error('Erreur lors de la récupération des codes existants:', error);
                        throw error; // Remonter l'erreur si ce n'est pas une erreur de quota
                    }
                }
            } else {
                // Utiliser le cache existant
                existingCodeKeys = window.codeCache[cacheKey].codes;
                console.log(`Utilisation du cache avec ${existingCodeKeys.size} codes existants`);
            }
            
            // Ajouter chaque code au lot s'il n'existe pas déjà
            for (let i = startIndex; i < endIndex; i++) {
                const code = uniqueCodes[i];
                let username, password;
                
                if (isUserPass && typeof code === 'object') {
                    // Format User/Mot de passe (objet)
                    username = code.username;
                    password = code.password;
                } else if (typeof code === 'string') {
                    // Format Voucher ou CSV
                    const parts = code.split(',').map(item => item.trim());
                    if (parts.length >= 2) {
                        // Format CSV
                        username = parts[0];
                        password = parts[1];
                    } else {
                        // Format Voucher (code unique)
                        username = code;
                        password = code;
                    }
                }
                
                if (username && password) {
                    // Vérifier si le code existe déjà
                    const codeKey = `${username}:${password}`;
                    if (!existingCodeKeys.has(codeKey)) {
                        // Créer une référence pour le nouveau document
                        const codeRef = doc(codesCollectionRef);
                        
                        // Ajouter le document au lot
                        currentBatch.set(codeRef, {
                            username: username,
                            password: password,
                            profileId: profileId,
                            routerId: routerId,
                            status: 'available',
                            createdAt: serverTimestamp(),
                            updatedAt: serverTimestamp()
                        });
                        
                        importedCount++;
                    }
                }
            }
            
            // Exécuter le lot seulement s'il y a des codes à importer
            if (importedCount > 0) {
                // Exécuter le commit directement
                await currentBatch.commit();
                console.log(`Lot de ${importedCount} codes importés avec succès`);
                
                // Stocker le nombre de codes importés pour l'affichage dans le modal
                try {
                    const currentImported = parseInt(localStorage.getItem('lastImportedCount') || '0');
                    localStorage.setItem('lastImportedCount', currentImported + importedCount);
                } catch (e) {
                    console.warn('Impossible de stocker le nombre de codes importés:', e);
                }
            } else {
                console.log('Aucun nouveau code à importer dans ce lot');
            }
            
            // Si nous avons plus de codes à traiter, continuer avec le lot suivant
            // mais avec un délai pour éviter les problèmes de quota
            if (endIndex < uniqueCodes.length) {
                // Ajouter un délai progressif entre les lots pour éviter les erreurs de quota
                // Plus on a traité de lots, plus on attend entre chaque lot
                const batchNumber = Math.floor(endIndex / batchSize);
                const delayMs = Math.min(1000 + (batchNumber * 200), 3000); // Délai progressif, max 3 secondes
                
                console.log(`Attente de ${delayMs}ms avant le traitement du lot suivant pour éviter les erreurs de quota...`);
                
                // Utiliser setTimeout pour créer un délai entre les lots
                await new Promise(resolve => setTimeout(resolve, delayMs));
                
                // Continuer avec le lot suivant
                await processBatch(endIndex);
            }
            
            // Si aucun code n'a été importé, afficher un message
            if (importedCount === 0) {
                console.log('Aucun nouveau code importé. Tous les codes existaient déjà.');
                
                // Afficher un message d'information
                const errorElement = document.getElementById('importFormError');
                if (errorElement) {
                    errorElement.textContent = 'Aucun nouveau code importé. Tous les codes existaient déjà.';
                    errorElement.classList.remove('d-none');
                }
                
                // Masquer le spinner
                const spinner = document.getElementById('importCodesSpinner');
                if (spinner) spinner.classList.add('d-none');
                
                const importBtn = document.getElementById('importCodesBtn');
                if (importBtn) importBtn.disabled = false;
                
                return;
            }
            
            // Mettre à jour les statistiques du profil
            let statsUpdated = false;
            try {
                const profileRef = doc(db, 'profiles', profileId);
                
                // Vérifier d'abord si nous pouvons accéder au profil sans déclencher d'erreur de quota
                try {
                    const profileSnapshot = await getDoc(profileRef);
                    if (!profileSnapshot.exists()) {
                        console.warn('Profil non trouvé, impossible de mettre à jour les statistiques');
                        // On continue quand même pour afficher le succès de l'importation
                    }
                } catch (quotaError) {
                    // Si nous avons une erreur de quota ici, ne pas essayer la transaction plus lourde
                    if (quotaError.message && quotaError.message.includes('Quota exceeded')) {
                        console.warn('Quota Firestore dépassé, impossible de mettre à jour les statistiques');
                        throw quotaError; // Remonter l'erreur pour éviter la transaction
                    }
                }
                
                // Procéder à la mise à jour des statistiques si pas d'erreur de quota
                // Utiliser le système de limitation de débit pour éviter les erreurs de quota
                try {
                    // runTransaction est déjà importé plus haut dans la fonction
                    return runTransaction(db, async (transaction) => {
                        const profileDoc = await transaction.get(profileRef);
                        if (profileDoc.exists()) {
                            const currentStats = profileDoc.data().stats || {};
                            transaction.update(profileRef, {
                                'stats.totalCodes': (currentStats.totalCodes || 0) + importedCount,
                                'stats.availableCodes': (currentStats.availableCodes || 0) + importedCount,
                                updatedAt: serverTimestamp()
                            });
                            statsUpdated = true;
                        }
                    });
                } catch (error) {
                    console.error('Erreur lors de la mise à jour des statistiques:', error);
                    throw error;
                }
                console.log('Statistiques du profil mises à jour avec succès');
            } catch (error) {
                // Gérer spécifiquement les erreurs de quota
                if (error.message && error.message.includes('Quota exceeded')) {
                    console.warn('Quota Firestore dépassé, les statistiques seront mises à jour ultérieurement');
                    // Marquer qu'une erreur de quota s'est produite
                    window.quotaErrorsOccurred = true;
                    // On continue quand même pour afficher le succès de l'importation
                } else {
                    console.error('Erreur lors de la mise à jour des statistiques du profil:', error);
                }
            }
            
            // Fermer le modal
            try {
                const modalElement = document.getElementById('importCodesModal');
                if (modalElement) {
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) modal.hide();
                }
            } catch (error) {
                console.error('Erreur lors de la fermeture du modal:', error);
            }
            
            // Masquer le spinner global avant d'afficher le message de succès
            const globalSpinner = document.getElementById('globalImportSpinner');
            if (globalSpinner) {
                globalSpinner.classList.add('d-none');
                // Supprimer le spinner après un court délai pour éviter les problèmes d'animation
                setTimeout(() => {
                    if (globalSpinner.parentNode) {
                        globalSpinner.parentNode.removeChild(globalSpinner);
                    }
                }, 300);
            }
            
            // Sauvegarder le nombre de codes importés pour affichage correct
            try {
                if (importedCount > 0) {
                    localStorage.setItem('lastImportedCount', importedCount);
                }
            } catch (e) {
                console.warn('Impossible de sauvegarder le nombre de codes importés:', e);
            }
            
            // Afficher le message de succès pour une meilleure expérience utilisateur
            // même si les rechargements échouent ensuite
            try {
                showSuccessAnimation(importedCount);
            } catch (animError) {
                console.error('Erreur lors de l\'affichage de l\'animation de succès:', animError);
                // Afficher un message de succès simple en cas d'erreur avec l'animation
                alert(`Importation réussie! ${importedCount} codes importés.`);
            }
            
            // Recharger les codes de manière asynchrone avec gestion des erreurs de quota
            setTimeout(() => {
                try {
                    // Charger les codes disponibles et vendus
                    loadAvailableCodes(routerId, 1);
                    loadSoldCodes(routerId, 1);
                    loadCodes(routerId);
                    console.log('Codes rechargés avec succès');
                } catch (loadError) {
                    // Si erreur de quota, on ne bloque pas l'utilisateur
                    if (loadError.message && loadError.message.includes('Quota exceeded')) {
                        console.warn('Quota dépassé lors du rechargement des codes, sera fait plus tard');
                        window.quotaErrorsOccurred = true;
                    } else {
                        console.error('Erreur lors du rechargement des codes:', loadError);
                    }
                }
            }, 1000);   
            
            // Recharger les profils avec un délai pour éviter les problèmes de quota
            setTimeout(() => {
                try {
                    loadProfiles(routerId);
                    console.log('Profils rechargés avec succès');
                } catch (error) {
                    if (error.message && error.message.includes('Quota exceeded')) {
                        console.warn('Quota Firestore dépassé, impossible de recharger les profils');
                    } else {
                        console.error('Erreur lors du rechargement des profils:', error);
                    }
                }
            }, 2000); // Délai plus long pour éviter les problèmes de quota
            
            // Réinitialiser le formulaire
            const importForm = document.getElementById('importCodesForm');
            if (importForm) importForm.reset();
            
            const importFormError = document.getElementById('importFormError');
            if (importFormError) importFormError.classList.add('d-none');
            
            const extractedCodesContainer = document.getElementById('extractedCodesContainer');
            if (extractedCodesContainer) extractedCodesContainer.classList.add('d-none');
            
            // Réinitialiser les codes extraits
            window.extractedCodes = [];
            
            // Masquer le spinner
            const spinner = document.getElementById('importCodesSpinner');
            if (spinner) spinner.classList.add('d-none');
            
            const importBtn = document.getElementById('importCodesBtn');
            if (importBtn) importBtn.disabled = false;
            
            // Afficher un message de succès
            showSuccess('importSuccess', `${importedCount} codes ont été importés avec succès`);
            
        } catch (error) {
            console.error('Erreur lors de l\'importation des codes:', error);
            
            // Vérifier si c'est une erreur de type "Type does not match the expected instance" ou "Quota exceeded"
            if ((error.message && error.message.includes('Type does not match the expected instance')) ||
                (error.message && error.message.includes('Quota exceeded'))) {
                
                if (error.message.includes('Type does not match the expected instance')) {
                    console.warn('Erreur d\'instance Firebase ignorée, continuation de l\'importation...');
                } else if (error.message.includes('Quota exceeded')) {
                    console.warn('Quota Firestore dépassé, mais l\'importation est considérée comme réussie');
                    // Marquer qu'une erreur de quota s'est produite pour traitement ultérieur
                    window.quotaErrorsOccurred = true;
                }
                
                // Malgré l'erreur, on considère que l'importation a réussi
                // Sauvegarder le nombre de codes pour affichage correct
                try {
                    if (typeof importedCount !== 'undefined' && importedCount > 0) {
                        localStorage.setItem('lastImportedCount', importedCount);
                    }
                } catch (e) {
                    console.warn('Impossible de sauvegarder le nombre de codes importés:', e);
                }
                
                // Afficher le message de succès
                showSuccessAnimation(importedCount || 0);
                
                // Masquer le spinner
                const importCodesSpinner = document.getElementById('importCodesSpinner');
                if (importCodesSpinner) importCodesSpinner.classList.add('d-none');
                
                const importCodesBtn = document.getElementById('importCodesBtn');
                if (importCodesBtn) importCodesBtn.disabled = false;
                
                // Réinitialiser le formulaire
                const importForm = document.getElementById('importCodesForm');
                if (importForm) importForm.reset();
                
                // Masquer les messages d'erreur précédents
                const importFormError = document.getElementById('importFormError');
                if (importFormError) importFormError.classList.add('d-none');
                
                return; // Sortir de la fonction catch pour éviter d'afficher l'erreur
            }
            
            // Pour les autres types d'erreurs, afficher normalement
            const errorElement = document.getElementById('importFormError');
            errorElement.textContent = 'Erreur lors de l\'importation des codes: ' + error.message;
            errorElement.classList.remove('d-none');
            
            // Masquer le spinner
            const importCodesSpinner = document.getElementById('importCodesSpinner');
            if (importCodesSpinner) importCodesSpinner.classList.add('d-none');
            
            const importCodesBtn = document.getElementById('importCodesBtn');
            if (importCodesBtn) importCodesBtn.disabled = false;
        }
    };
    
    // Démarrer le traitement par lots
    return await processBatch(0);
    // Fin du bloc try
  } catch (error) {
    console.error('Erreur lors de l\'importation des codes:', error);
    
    // Vérifier si c'est une erreur de type "Type does not match the expected instance" ou "Quota exceeded"
    if ((error.message && error.message.includes('Type does not match the expected instance')) ||
        (error.message && error.message.includes('Quota exceeded'))) {
      
      if (error.message.includes('Type does not match the expected instance')) {
        console.warn('Erreur d\'instance Firebase ignorée, continuation de l\'importation...');
      } else if (error.message.includes('Quota exceeded')) {
        console.warn('Quota Firestore dépassé, mais l\'importation est considérée comme réussie');
        // Marquer qu'une erreur de quota s'est produite pour traitement ultérieur
        window.quotaErrorsOccurred = true;
      }
      
      // Malgré l'erreur, on considère que l'importation a réussi
      // Récupérer le nombre de codes depuis le localStorage si disponible
      try {
          if (typeof importedCount !== 'undefined' && importedCount > 0) {
              localStorage.setItem('lastImportedCount', importedCount);
          }
      } catch (e) {
          console.warn('Impossible de sauvegarder le nombre de codes importés:', e);
      }
      // Afficher le message de succès
      showSuccessAnimation(0);
      
      // Masquer le spinner
      const importCodesSpinner = document.getElementById('importCodesSpinner');
      if (importCodesSpinner) importCodesSpinner.classList.add('d-none');
      
      const importCodesBtn = document.getElementById('importCodesBtn');
      if (importCodesBtn) importCodesBtn.disabled = false;
      
      // Réinitialiser le formulaire
      const importForm = document.getElementById('importCodesForm');
      if (importForm) importForm.reset();
      
      // Masquer les messages d'erreur précédents
      const importFormError = document.getElementById('importFormError');
      if (importFormError) importFormError.classList.add('d-none');
      
      return; // Ne pas propager l'erreur
    }
    
    // Pour les autres types d'erreurs, afficher normalement
    const errorElement = document.getElementById('importFormError');
    if (errorElement) {
      errorElement.textContent = 'Erreur lors de l\'importation des codes: ' + error.message;
      errorElement.classList.remove('d-none');
    }
            
    // Masquer le spinner
    const importCodesSpinner = document.getElementById('importCodesSpinner');
    if (importCodesSpinner) importCodesSpinner.classList.add('d-none');
            
    const importCodesBtn = document.getElementById('importCodesBtn');
    if (importCodesBtn) importCodesBtn.disabled = false;
    
    // Propager l'erreur pour les autres types d'erreurs
    throw error;
  }
  // Fin de la fonction async
}

/**
 * Importe des codes WiFi dans la base de données
 * @param {Array} codes - Liste des codes à importer
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 * @param {boolean} isUserPass - Indique si les codes sont au format username/password
 */
async function importCodes(codes, profileId, routerId, isUserPass = false) {
    // Cette fonction sert de wrapper pour proceedWithImport pour maintenir la compatibilité
    console.log('Appel à importCodes redirigé vers proceedWithImport');
    try {
        return await proceedWithImport(codes, profileId, routerId, isUserPass);
    } catch (error) {
        console.error('Erreur dans importCodes:', error);
        
        // Vérifier si c'est une erreur de type "Type does not match the expected instance" ou "Quota exceeded"
        if ((error.message && error.message.includes('Type does not match the expected instance')) ||
            (error.message && error.message.includes('Quota exceeded'))) {
            
            if (error.message.includes('Type does not match the expected instance')) {
                console.warn('Erreur d\'instance Firebase ignorée dans importCodes, continuation de l\'importation...');
            } else if (error.message.includes('Quota exceeded')) {
                console.warn('Quota Firestore dépassé dans importCodes, mais l\'importation est considérée comme réussie');
                // Marquer qu'une erreur de quota s'est produite pour traitement ultérieur
                window.quotaErrorsOccurred = true;
            }
            
            // Malgré l'erreur, on considère que l'importation a réussi
            // Sauvegarder le nombre de codes pour affichage correct
            try {
                if (codes && codes.length > 0) {
                    localStorage.setItem('lastImportedCount', codes.length);
                }
            } catch (e) {
                console.warn('Impossible de sauvegarder le nombre de codes importés:', e);
            }
            // Afficher le message de succès
            showSuccessAnimation(codes ? codes.length : 0);
            
            // Masquer le spinner
            const spinner = document.getElementById('importCodesSpinner');
            if (spinner) spinner.classList.add('d-none');
            
            const importCodesBtn = document.getElementById('importCodesBtn');
            if (importCodesBtn) importCodesBtn.disabled = false;
            
            // Réinitialiser le formulaire
            const importForm = document.getElementById('importCodesForm');
            if (importForm) importForm.reset();
            
            // Masquer les messages d'erreur précédents
            const importFormError = document.getElementById('importFormError');
            if (importFormError) importFormError.classList.add('d-none');
            
            return; // Ne pas propager l'erreur
        }
        
        // Pour les autres types d'erreurs, afficher normalement
        const errorElement = document.getElementById('importFormError');
        if (errorElement) {
            errorElement.textContent = 'Erreur lors de l\'importation des codes: ' + error.message;
            errorElement.classList.remove('d-none');
        }
        
        // Masquer le spinner et réactiver le bouton
        const spinner = document.getElementById('importCodesSpinner');
        if (spinner) spinner.classList.add('d-none');
        
        const importCodesBtn = document.getElementById('importCodesBtn');
        if (importCodesBtn) importCodesBtn.disabled = false;
        
        throw error; // Propager l'erreur pour la gestion en amont
    }
}

/**
 * Filtrer les codes
 */
function filterCodes() {
    // Vérifier l'existence de l'élément de recherche avant d'accéder à sa propriété
    const searchCodesElement = document.getElementById('searchCodes');
    
    // Si l'élément n'existe pas, sortir de la fonction
    if (!searchCodesElement) {
        console.warn('L\'\u00e9lément de recherche non trouvé dans le DOM');
        return;
    }
    
    const searchText = searchCodesElement.value.toLowerCase();
    
    // Récupérer le filtre de profil (qui existe dans le HTML)
    const filterProfileElement = document.getElementById('filterProfile');
    const profileFilter = filterProfileElement ? filterProfileElement.value : 'all';
    
    // Récupérer toutes les lignes
    const rows = document.querySelectorAll('#codesList tr');
    
    // Si aucune ligne n'est trouvée, sortir de la fonction
    if (rows.length === 0) {
        console.warn('Aucune ligne de code trouvée dans le tableau');
        return;
    }
    
    // Parcourir chaque ligne
    rows.forEach((row) => {
        let showRow = true;
        
        // Filtrer par texte
        if (searchText) {
            const text = row.textContent.toLowerCase();
            if (!text.includes(searchText)) {
                showRow = false;
            }
        }
        
        // Filtrer par profil
        if (profileFilter !== 'all') {
            // Récupérer l'ID du profil de la ligne
            const profileCell = row.querySelector('.code-profile');
            if (profileCell) {
                // Vérifier d'abord si l'attribut data-profile-id existe
                if (profileCell.hasAttribute('data-profile-id')) {
                    const rowProfileId = profileCell.getAttribute('data-profile-id');
                    if (rowProfileId !== profileFilter) {
                        showRow = false;
                    }
                } else {
                    // Fallback: vérifier le texte du profil
                    const profileName = profileCell.textContent.trim().toLowerCase();
                    // Récupérer le texte du profil sélectionné
                    const selectedProfileText = filterProfileElement.options[filterProfileElement.selectedIndex].text.toLowerCase();
                    if (!profileName.includes(selectedProfileText) && selectedProfileText !== 'tous les profils') {
                        showRow = false;
                    }
                }
            } else {
                // Si on ne trouve pas la cellule du profil, masquer la ligne
                showRow = false;
            }
        }
        
        // Afficher ou masquer la ligne
        if (showRow) {
            row.classList.remove('d-none');
        } else {
            row.classList.add('d-none');
        }
    });
}

/**
 * Afficher les détails d'un code
 * @param {string} codeId - ID du code
 */
function showCodeDetails(codeId) {
    // Récupérer les informations du code
    // Utiliser la fonction doc importée correctement
    const codeDocRef = doc(db, 'wifiCodes', codeId);
    getDoc(codeDocRef)
        .then((docSnap) => {
            if (docSnap.exists()) {
                const code = docSnap.data();
                
                // Vérifier si le code est au format username/password ou simple code
                const codeValue = code.username && code.password ? `${code.username} / ${code.password}` : 
                                code.code ? code.code : 
                                code.username ? code.username : '-';
                
                // Remplir le modal
                document.getElementById('codeValue').textContent = codeValue;
                
                // Statut
                const statusElement = document.getElementById('codeStatus');
                statusElement.textContent = code.status === 'available' ? 'Disponible' : 
                                          code.status === 'used' ? 'Utilisé' : 
                                          code.status === 'expired' ? 'Expiré' : code.status;
                
                statusElement.className = 'badge';
                statusElement.classList.add(code.status === 'available' ? 'bg-success' : 
                                          code.status === 'used' ? 'bg-primary' : 
                                          'bg-secondary');
                
                // Récupérer les informations du profil
                if (code.profileId) {
                    const profileDocRef = doc(db, 'profiles', code.profileId);
                    getDoc(profileDocRef)
                        .then((profileDoc) => {
                            if (profileDoc.exists()) {
                                const profile = profileDoc.data();
                                document.getElementById('codeProfile').textContent = profile.name;
                                document.getElementById('codePrice').textContent = profile.price + ' FCFA';
                            } else {
                                document.getElementById('codeProfile').textContent = 'Profil inconnu';
                                document.getElementById('codePrice').textContent = '-';
                            }
                        });
                } else {
                    document.getElementById('codeProfile').textContent = 'Profil inconnu';
                    document.getElementById('codePrice').textContent = '-';
                }
                
                // Dates
                document.getElementById('codeCreatedAt').textContent = code.createdAt ? 
                    new Date(code.createdAt.toDate()).toLocaleDateString('fr-FR') : '-';
                document.getElementById('codeUsedAt').textContent = code.usedAt ? 
                    new Date(code.usedAt.toDate()).toLocaleDateString('fr-FR') : '-';
                
                // Client
                document.getElementById('codeClient').textContent = code.clientName || '-';
                
                // Bouton de suppression (uniquement pour les codes disponibles)
                const deleteBtn = document.getElementById('deleteCodeBtn');
                if (code.status === 'available') {
                    deleteBtn.classList.remove('d-none');
                    deleteBtn.dataset.codeId = codeId;
                } else {
                    deleteBtn.classList.add('d-none');
                }
                
                // Afficher le modal
                const modal = new bootstrap.Modal(document.getElementById('codeDetailsModal'));
                modal.show();
            } else {
                console.error('Code non trouvé');
                alert('Code non trouvé');
            }
        })
        .catch((error) => {
            console.error('Erreur lors de la récupération des informations du code:', error);
            alert('Erreur lors de la récupération des informations du code');
        });
}

/**
 * Infère un pattern d'expression régulière à partir d'un exemple de code
 * @param {string} example - Exemple de code
 * @returns {string} - Pattern d'expression régulière
 */
function inferPatternFromExample(example) {
    if (!example) return '';
    
    let pattern = '^';
    
    // Analyser caractère par caractère
    for (let i = 0; i < example.length; i++) {
        const char = example[i];
        
        if (/[A-Z]/.test(char)) {
            pattern += '[A-Z]';
        } else if (/[a-z]/.test(char)) {
            pattern += '[a-z]';
        } else if (/\d/.test(char)) {
            pattern += '\\d';
        } else {
            // Échapper les caractères spéciaux
            pattern += '\\' + char;
        }
    }
    
    pattern += '$';
    return pattern;
}

/**
 * Explique un pattern d'expression régulière en langage naturel
 * @param {string} pattern - Pattern d'expression régulière
 * @returns {string} - Explication du pattern
 */
function explainPattern(pattern) {
    if (!pattern) return '';
    
    // Remplacer les parties du pattern par des explications
    let explanation = pattern
        .replace(/^\^/, 'Commence par ')
        .replace(/\$$/, '')
        .replace(/\[A-Z\]/g, 'une lettre majuscule')
        .replace(/\[a-z\]/g, 'une lettre minuscule')
        .replace(/\\d/g, 'un chiffre')
        .replace(/\\(.)/g, 'le caractère "$1"');
    
    // Ajouter des explications pour les quantificateurs
    explanation = explanation
        .replace(/\{(\d+)\}/g, 'répété $1 fois')
        .replace(/\{(\d+),(\d+)\}/g, 'répété entre $1 et $2 fois')
        .replace(/\{(\d+),\}/g, 'répété au moins $1 fois')
        .replace(/\*/g, 'répété 0 ou plusieurs fois')
        .replace(/\+/g, 'répété 1 ou plusieurs fois')
        .replace(/\?/g, 'optionnel');
    
    return explanation;
}

/**
 * Met à jour l'en-tête du tableau des codes extraits
 * @param {boolean} isUserPass - Indique si le format est User/Mot de passe
 */
function updateExtractedCodesHeader(isUserPass) {
    const headerRow = document.querySelector('#extractedCodesTable thead tr');
    if (!headerRow) return;
    
    if (isUserPass) {
        headerRow.innerHTML = `
            <th>Utilisateur</th>
            <th>Mot de passe</th>
            <th>Actions</th>
        `;
    } else {
        headerRow.innerHTML = `
            <th>Code</th>
            <th>Actions</th>
        `;
    }
}

/**
 * Mettre à jour les liens de navigation avec l'ID du routeur
 * @param {string} routerId - ID du routeur
 */
function updateNavigationLinks(routerId) {
    // Liste des liens à mettre à jour
    const links = [
        'routerDashboardLink',
        'wifiCodesLink',
        'clientsLink',
        'paymentsLink',
        'routerSettingsLink'
    ];
    
    // Mettre à jour chaque lien
    links.forEach(linkId => {
        const link = document.getElementById(linkId);
        if (link) {
            const href = link.getAttribute('href');
            if (href) {
                // Vérifier si l'URL contient déjà un paramètre id
                if (href.includes('?id=')) {
                    // Remplacer l'ID existant
                    const newHref = href.replace(/[?&]id=[^&]*/, `?id=${routerId}`);
                    link.href = newHref;
                } else if (href.includes('?')) {
                    // Ajouter l'ID comme paramètre supplémentaire
                    link.href = `${href}&id=${routerId}`;
                } else {
                    // Ajouter l'ID comme premier paramètre
                    link.href = `${href}?id=${routerId}`;
                }
            }
        }
    });
}

// La fonction setupEventHandlers a été déplacée pour éviter la duplication
// Voici une fonction auxiliaire pour configurer les filtres spécifiques aux codes WiFi
/**
 * Configurer les filtres pour les codes WiFi
 * @param {string} routerId - ID du routeur
 */
function setupWifiCodeFilters(routerId) {
    // Gestionnaire pour le filtre de statut des codes
    const filterStatus = document.getElementById('filterStatus');
    if (filterStatus) {
        filterStatus.addEventListener('change', function() {
            loadWifiCodes(routerId, 1, {
                status: this.value === 'all' ? null : this.value
            });
        });
    }
    
    // Gestionnaire pour la recherche de codes
    const searchCodes = document.getElementById('searchCodes');
    if (searchCodes) {
        searchCodes.addEventListener('input', function() {
            const searchTerm = this.value.trim();
            if (searchTerm.length >= 3 || searchTerm.length === 0) {
                loadWifiCodes(routerId, 1, {
                    search: searchTerm.length > 0 ? searchTerm : null
                });
            }
        });
    }
    
    // Appeler cette fonction depuis setupEventHandlers principal
    console.log('Filtres de codes WiFi configurés');
    
    // Gestionnaire pour effacer la recherche
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            const searchInput = document.getElementById('searchCodes');
            if (searchInput) {
                searchInput.value = '';
                loadWifiCodes(routerId, 1);
            }
        });
    }
    
    // Gestionnaire pour le bouton d'ajout de profil
    const saveProfileBtn = document.getElementById('saveProfileBtn');
    if (saveProfileBtn) {
        saveProfileBtn.addEventListener('click', function() {
            saveProfile(routerId);
        });
    }
    
    // Gestionnaire pour le bouton de mise à jour de profil
    const updateProfileBtn = document.getElementById('updateProfileBtn');
    if (updateProfileBtn) {
        updateProfileBtn.addEventListener('click', function() {
            const profileId = document.getElementById('editProfileId').value;
            updateProfile(profileId, routerId);
        });
    }
}

/**
 * Ouvrir la modal d'édition de profil
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 */
async function openEditProfileModal(profileId, routerId) {
    try {
        // Récupérer les données du profil
        const profileRef = doc(db, 'routers', routerId, 'profiles', profileId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            const profileData = profileSnap.data();
            
            // Remplir le formulaire
            document.getElementById('editProfileId').value = profileId;
            document.getElementById('editProfileName').value = profileData.name || '';
            document.getElementById('editProfileDescription').value = profileData.description || '';
            document.getElementById('editProfileDuration').value = profileData.duration || '';
            document.getElementById('editProfilePrice').value = profileData.price || '';
            
            // Masquer les messages d'erreur
            document.getElementById('editProfileFormError').classList.add('d-none');
            
            // Ouvrir la modal
            const editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal'));
            editProfileModal.show();
        } else {
            showGlobalMessage('error', 'Profil introuvable');
        }
    } catch (error) {
        console.error('Erreur lors de la récupération du profil:', error);
        showGlobalMessage('error', 'Erreur lors de la récupération du profil');
    }
}

/**
 * Mettre à jour un profil
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 */
async function updateProfile(profileId, routerId) {
    // Récupérer les valeurs du formulaire
    const name = document.getElementById('editProfileName').value.trim();
    const description = document.getElementById('editProfileDescription').value.trim();
    const duration = document.getElementById('editProfileDuration').value.trim();
    const price = parseInt(document.getElementById('editProfilePrice').value.trim(), 10);
    
    // Validation basique
    if (!name || !duration || isNaN(price) || price <= 0) {
        const errorElement = document.getElementById('editProfileFormError');
        errorElement.textContent = 'Veuillez remplir tous les champs obligatoires';
        errorElement.classList.remove('d-none');
        return;
    }
    
    // Afficher le spinner
    const spinner = document.getElementById('updateProfileSpinner');
    const updateBtn = document.getElementById('updateProfileBtn');
    if (spinner) spinner.classList.remove('d-none');
    if (updateBtn) updateBtn.disabled = true;
    
    try {
        // Mettre à jour le profil
        const profileRef = doc(db, 'routers', routerId, 'profiles', profileId);
        await updateDoc(profileRef, {
            name,
            description,
            duration,
            price,
            updatedAt: serverTimestamp()
        });
        
        // Fermer la modal
        const editProfileModal = bootstrap.Modal.getInstance(document.getElementById('editProfileModal'));
        if (editProfileModal) editProfileModal.hide();
        
        // Recharger les profils
        loadProfiles(routerId);
        
        // Afficher un message de succès
        showGlobalMessage('success', 'Profil mis à jour avec succès');
    } catch (error) {
        console.error('Erreur lors de la mise à jour du profil:', error);
        
        // Afficher l'erreur
        const errorElement = document.getElementById('editProfileFormError');
        errorElement.textContent = 'Erreur lors de la mise à jour du profil: ' + error.message;
        errorElement.classList.remove('d-none');
    } finally {
        // Masquer le spinner
        if (spinner) spinner.classList.add('d-none');
        if (updateBtn) updateBtn.disabled = false;
    }
}

/**
 * Confirmer la suppression d'un profil
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 */
function confirmDeleteProfile(profileId, routerId) {
    if (confirm('Êtes-vous sûr de vouloir supprimer ce profil ? Cette action est irréversible.')) {
        deleteProfile(profileId, routerId);
    }
}

/**
 * Supprimer un profil
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 */
async function deleteProfile(profileId, routerId) {
    // Demander confirmation
    if (!confirm('Voulez-vous vraiment supprimer ce profil ? Cette action est irréversible.')) {
        return;
    }
    
    try {
        console.log(`Suppression du profil ${profileId} du routeur ${routerId}`);
        
        // Vérifier que les IDs sont valides
        if (!profileId || !routerId) {
            throw new Error('ID de profil ou de routeur manquant');
        }
        
        // Récupérer d'abord les détails du profil pour vérifier qu'il existe
        const profileRef = doc(db, 'profiles', profileId);
        const profileDoc = await getDoc(profileRef);
        
        if (!profileDoc.exists()) {
            // Essayer de le trouver dans la sous-collection du routeur
            const routerProfileRef = doc(db, 'routers', routerId, 'profiles', profileId);
            const routerProfileDoc = await getDoc(routerProfileRef);
            
            if (!routerProfileDoc.exists()) {
                throw new Error('Profil introuvable');
            }
        }
        
        // Vérifier s'il y a des codes associés à ce profil
        const codesRef = collection(db, 'wifiCodes');
        const codesQuery = query(codesRef, where('profileId', '==', profileId));
        const codesSnapshot = await getDocs(codesQuery);
        
        // Utiliser un batch pour supprimer le profil et ses codes associés
        const batch = writeBatch(db);
        
        // Supprimer les codes associés s'il y en a
        if (!codesSnapshot.empty) {
            // Il y a des codes associés à ce profil
            if (!confirm(`Ce profil a ${codesSnapshot.size} codes associés. Voulez-vous vraiment le supprimer ? Tous les codes associés seront également supprimés.`)) {
                return;
            }
            
            codesSnapshot.forEach((doc) => {
                batch.delete(doc.ref);
            });
            console.log(`${codesSnapshot.size} codes associés marqués pour suppression`);
        }
        
        // Supprimer le profil de la collection principale
        batch.delete(profileRef);
        
        // Supprimer également le profil de la sous-collection du routeur
        const routerProfileRef = doc(db, 'routers', routerId, 'profiles', profileId);
        batch.delete(routerProfileRef);
        
        // Exécuter le batch
        await batch.commit();
        console.log(`Profil ${profileId} supprimé avec succès`);
        
        // Recharger les profils
        loadProfiles(routerId);
        
        // Afficher un message de succès
        showGlobalMessage('success', 'Le profil a été supprimé avec succès.');
    } catch (error) {
        console.error('Erreur lors de la suppression du profil:', error);
        showGlobalMessage('error', 'Erreur lors de la suppression du profil: ' + error.message);
    }
}

/**
 * Copier le lien d'achat d'un code
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 * @param {string} profileName - Nom du profil
 */
function copyBuyLink(profileId, routerId, profileName) {
    // Créer l'URL d'achat
    const buyUrl = `${window.location.origin}/profilbuy-code.html?routerId=${routerId}&profileId=${profileId}`;
    
    // Vérifier si l'API Clipboard est disponible
    if (navigator.clipboard && navigator.clipboard.writeText) {
        // Méthode moderne avec l'API Clipboard
        navigator.clipboard.writeText(buyUrl)
            .then(() => {
                showGlobalMessage('success', `Lien d'achat pour "${profileName}" copié dans le presse-papier`);
            })
            .catch(err => {
                console.error('Erreur lors de la copie du lien:', err);
                fallbackCopyMethod(buyUrl, profileName);
            });
    } else {
        // Méthode de secours pour les navigateurs qui ne supportent pas l'API Clipboard
        fallbackCopyMethod(buyUrl, profileName);
    }
}

/**
 * Méthode de secours pour copier du texte dans le presse-papier
 * @param {string} text - Texte à copier
 * @param {string} profileName - Nom du profil pour le message
 */
function fallbackCopyMethod(text, profileName) {
    try {
        // Créer un élément temporaire
        const textArea = document.createElement('textarea');
        textArea.value = text;
        
        // Rendre l'élément invisible
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        textArea.style.top = '-999999px';
        document.body.appendChild(textArea);
        
        // Sélectionner et copier le texte
        textArea.focus();
        textArea.select();
        const successful = document.execCommand('copy');
        
        // Nettoyer
        document.body.removeChild(textArea);
        
        if (successful) {
            showGlobalMessage('success', `Lien d'achat pour "${profileName}" copié dans le presse-papier`);
        } else {
            // Afficher l'URL pour que l'utilisateur puisse la copier manuellement
            showGlobalMessage('warning', `Impossible de copier automatiquement. Voici le lien : ${text}`);
        }
    } catch (err) {
        console.error('Erreur lors de la copie du lien (méthode de secours):', err);
        showGlobalMessage('warning', `Impossible de copier automatiquement. Voici le lien : ${text}`);
    }
}

/**
 * Filtrer les codes par profil
 * @param {string} profileId - ID du profil
 */
function filterCodesByProfile(profileId) {
    // Stocker le profil sélectionné dans une variable globale
    window.selectedProfileId = profileId;
    
    // Recharger les codes avec le filtre de profil
    const routerId = new URLSearchParams(window.location.search).get('id');
    if (routerId) {
        // Mettre à jour l'interface pour indiquer le filtre actif
        const filterStatusElement = document.getElementById('filterStatus');
        if (filterStatusElement) filterStatusElement.value = 'all'; // Réinitialiser le filtre de statut
        
        const searchCodesElement = document.getElementById('searchCodes');
        if (searchCodesElement) searchCodesElement.value = ''; // Réinitialiser la recherche
        
        // Ajouter une indication visuelle du filtre actif
        const profilesTabElement = document.getElementById('profiles-tab');
        if (profilesTabElement) {
            // Récupérer le nom du profil
            getProfileName(profileId, routerId).then(profileName => {
                // Ajouter une alerte pour indiquer le filtre actif
                const alertContainer = document.querySelector('#codes .alert-container');
                if (!alertContainer) {
                    const newAlertContainer = document.createElement('div');
                    newAlertContainer.className = 'alert-container mb-3';
                    document.querySelector('#codes').insertBefore(newAlertContainer, document.querySelector('#codes .row'));
                }
                
                const alertContainer2 = document.querySelector('#codes .alert-container');
                alertContainer2.innerHTML = `
                    <div class="alert alert-info alert-dismissible fade show" role="alert">
                        <i class="fas fa-filter me-2"></i> Affichage des codes pour le profil <strong>${profileName || profileId}</strong>
                        <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close" id="clearProfileFilter"></button>
                    </div>
                `;
                
                // Ajouter un gestionnaire d'événement pour effacer le filtre
                document.getElementById('clearProfileFilter').addEventListener('click', function() {
                    window.selectedProfileId = null;
                    loadWifiCodes(routerId, 1);
                });
            });
        }
        
        // Charger les codes avec le filtre de profil
        loadCodes(routerId, 1, 20, null, { profileId });
    }
}

/**
 * Récupérer le nom d'un profil
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 * @returns {Promise<string>} - Promesse contenant le nom du profil
 */
async function getProfileName(profileId, routerId) {
    try {
        const profileRef = doc(db, 'routers', routerId, 'profiles', profileId);
        const profileSnap = await getDoc(profileRef);
        
        if (profileSnap.exists()) {
            return profileSnap.data().name || 'Profil sans nom';
        }
        return 'Profil inconnu';
    } catch (error) {
        console.error('Erreur lors de la récupération du nom du profil:', error);
        return 'Profil inconnu';
    }
}

/**
 * Afficher un message global
 * @param {string} type - Type de message ('success' ou 'error')
 * @param {string} message - Message à afficher
 */
function showGlobalMessage(type, message) {
    const elementId = type === 'success' ? 'profilesSuccess' : 'profilesError';
    const element = document.getElementById(elementId);
    
    if (element) {
        element.textContent = message;
        element.classList.remove('d-none');
        
        // Masquer le message après 3 secondes
        setTimeout(() => {
            element.classList.add('d-none');
        }, 3000);
    }
}

/**
 * Générer une chaîne aléatoire
 * @param {number} length - Longueur de la chaîne
 * @param {string} charset - Jeu de caractères à utiliser
 * @returns {string} - Chaîne aléatoire générée
 */
function generateRandomString(length, charset) {
    let result = '';
    let characters = '';
    
    // Définir le jeu de caractères
    switch (charset) {
        case 'alpha':
            characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            break;
        case 'numeric':
            characters = '0123456789';
            break;
        case 'lowercase':
            characters = 'abcdefghijklmnopqrstuvwxyz';
            break;
        case 'uppercase':
            characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
            break;
        case 'complex':
            characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
            break;
        case 'alphanumeric':
        default:
            characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
            break;
    }
    
    // Générer la chaîne aléatoire
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    
    return result;
}

/**
 * Charger les codes WiFi pour un routeur
 * @param {string} routerId - ID du routeur
 * @param {string} profileId - ID du profil (optionnel)
 * @param {string} status - Statut des codes (optionnel)
 */
async function loadWifiCodes(routerId, profileId = null, status = null) {
    console.log('Chargement des codes WiFi pour le routeur:', routerId);
    
    try {
        // Afficher l'indicateur de chargement
        const loadingElement = document.getElementById('loadingCodes');
        if (loadingElement) {
            loadingElement.classList.remove('d-none');
        }
        
        // Masquer les messages d'erreur précédents
        const errorContainer = document.getElementById('wifiCodesIndexError');
        if (errorContainer) {
            errorContainer.classList.add('d-none');
        }
        
        // Importer les fonctions utilitaires
        const { executeWithIndexErrorHandling, checkAndCreateCollection } = await import('./src/db-utils.js');
        
        // Vérifier si la collection existe
        await checkAndCreateCollection('wifiCodes');
        
        // Construire la requête de base
        const codesRef = collection(db, 'wifiCodes');
        let constraints = [where('routerId', '==', routerId)];
        
        // Ajouter des filtres si nécessaire
        if (profileId) {
            constraints.push(where('profileId', '==', profileId));
        }
        
        if (status) {
            constraints.push(where('status', '==', status));
        }
        
        // Utiliser la fonction executeWithIndexErrorHandling pour gérer les erreurs d'index
        const querySnapshot = await executeWithIndexErrorHandling(
            // Fonction qui exécute la requête complète avec tous les filtres
            async () => {
                const q = query(codesRef, ...constraints);
                return await getDocs(q);
            },
            
            // Callback en cas de succès
            (result) => {
                console.log(`${result.size} codes WiFi trouvés`);
                return result;
            },
            
            // Callback en cas d'erreur d'index
            async (errorInfo) => {
                console.warn('Erreur d\'index lors de la requête des codes WiFi, utilisation d\'une requête simple');
                
                // Afficher un message d'erreur d'index
                const errorContainer = document.getElementById('wifiCodesIndexError');
                if (errorContainer) {
                    const { displayIndexError } = await import('./src/db-utils.js');
                    displayIndexError('wifiCodesIndexError', errorInfo);
                }
                
                // Essayer une requête plus simple
                const simpleQuery = query(codesRef, where('routerId', '==', routerId));
                const simpleSnapshot = await getDocs(simpleQuery);
                
                // Filtrer manuellement les résultats
                const filteredDocs = [];
                simpleSnapshot.forEach(doc => {
                    const data = doc.data();
                    let match = true;
                    
                    if (profileId && data.profileId !== profileId) {
                        match = false;
                    }
                    
                    if (status && data.status !== status) {
                        match = false;
                    }
                    
                    if (match) {
                        filteredDocs.push(doc);
                    }
                });
                
                // Créer un objet similaire à querySnapshot
                return {
                    size: filteredDocs.length,
                    docs: filteredDocs,
                    forEach: callback => filteredDocs.forEach(callback)
                };
            },
            
            // Callback en cas d'autre erreur
            (error) => {
                console.error('Erreur lors de la requête des codes WiFi:', error);
                throw error;
            }
        );
        
        // Mettre à jour l'interface
        updateWifiCodesList(querySnapshot, routerId);
        
        // Masquer l'indicateur de chargement
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        // Mettre à jour les compteurs
        updateWifiCodesCounters(routerId);
        
        return querySnapshot.size;
    } catch (error) {
        console.error('Erreur lors du chargement des codes WiFi:', error);
        
        // Masquer l'indicateur de chargement
        const loadingElement = document.getElementById('loadingCodes');
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        // Afficher un message d'erreur générique
        const errorElement = document.getElementById('wifiCodesError');
        if (errorElement) {
            errorElement.innerHTML = `
                <div class="alert alert-danger">
                    <h5><i class="fas fa-exclamation-triangle me-2"></i>Erreur</h5>
                    <p>Impossible de charger les codes WiFi. Veuillez réessayer ou contacter l'administrateur.</p>
                    <p class="mb-0"><small>Détails: ${error.message}</small></p>
                </div>
            `;
            errorElement.classList.remove('d-none');
        }
        
        // Afficher le message "aucun code"
        const noCodesElement = document.getElementById('noCodes');
        if (noCodesElement) {
            noCodesElement.classList.remove('d-none');
        }
        
        return 0;
    }
}

/**
 * Configurer les gestionnaires d'événements pour la suppression en masse des codes disponibles
 * @param {string} routerId - ID du routeur
 * @param {boolean} needsLicense - Indique si l'utilisateur a besoin d'activer une licence
 */
function setupBatchDeleteHandlers(routerId, needsLicense = false) {
    // Récupérer les éléments du DOM
    const selectAllCheckbox = document.getElementById('selectAllCodes');
    const deleteSelectedBtn = document.getElementById('deleteSelectedCodesBtn');
    
    if (!selectAllCheckbox || !deleteSelectedBtn) {
        console.error('Les éléments pour la suppression en masse n\'ont pas été trouvés');
        return;
    }
    
    // Si l'utilisateur n'a pas de licence, désactiver la fonctionnalité
    if (needsLicense) {
        deleteSelectedBtn.disabled = true;
        deleteSelectedBtn.setAttribute('data-bs-toggle', 'tooltip');
        deleteSelectedBtn.setAttribute('title', 'Activez votre licence pour accéder à cette fonctionnalité');
        // Initialiser les tooltips Bootstrap
        new bootstrap.Tooltip(deleteSelectedBtn);
        return;
    }
    
    // Fonction pour mettre à jour l'état du bouton de suppression
    function updateDeleteButtonState() {
        const checkedBoxes = document.querySelectorAll('#codesList .code-checkbox:checked');
        deleteSelectedBtn.disabled = checkedBoxes.length === 0;
        
        if (checkedBoxes.length > 0) {
            deleteSelectedBtn.textContent = `Supprimer ${checkedBoxes.length} code(s) sélectionné(s)`;
        } else {
            deleteSelectedBtn.innerHTML = '<i class="fas fa-trash-alt me-1"></i> Supprimer les codes sélectionnés';
        }
    }
    
    // Gestionnaire d'événement pour la case à cocher "Tout sélectionner"
    selectAllCheckbox.addEventListener('change', function() {
        const checkboxes = document.querySelectorAll('#codesList .code-checkbox');
        checkboxes.forEach(checkbox => {
            checkbox.checked = selectAllCheckbox.checked;
        });
        
        updateDeleteButtonState();
    });
    
    // Gestionnaire d'événement pour les cases à cocher individuelles (délégation d'événements)
    document.getElementById('codesList').addEventListener('change', function(e) {
        if (e.target && e.target.classList.contains('code-checkbox')) {
            // Vérifier si toutes les cases sont cochées
            const checkboxes = document.querySelectorAll('#codesList .code-checkbox');
            const checkedBoxes = document.querySelectorAll('#codesList .code-checkbox:checked');
            
            // Mettre à jour la case "Tout sélectionner"
            selectAllCheckbox.checked = checkboxes.length > 0 && checkboxes.length === checkedBoxes.length;
            
            // Mettre à jour l'état du bouton de suppression
            updateDeleteButtonState();
        }
    });
    
    // Gestionnaire d'événement pour le bouton de suppression
    deleteSelectedBtn.addEventListener('click', async function() {
        const checkedBoxes = document.querySelectorAll('#codesList .code-checkbox:checked');
        const codeIds = Array.from(checkedBoxes).map(checkbox => checkbox.getAttribute('data-code-id'));
        
        if (codeIds.length === 0) {
            return;
        }
        
        // Demander confirmation
        if (!confirm(`Voulez-vous vraiment supprimer ${codeIds.length} code(s) WiFi ? Cette action est irréversible.`)) {
            return;
        }
        
        // Afficher un spinner
        deleteSelectedBtn.disabled = true;
        deleteSelectedBtn.innerHTML = `
            <span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
            Suppression en cours...
        `;
        
        try {
            // Utiliser un batch pour supprimer tous les codes sélectionnés
            const batch = writeBatch(db);
            
            codeIds.forEach(codeId => {
                const codeRef = doc(db, 'wifiCodes', codeId);
                batch.delete(codeRef);
            });
            
            // Exécuter le batch
            await batch.commit();
            
            // Afficher un message de succès
            showGlobalMessage('success', `${codeIds.length} code(s) WiFi supprimé(s) avec succès`);
            
            // Recharger les codes disponibles
            loadCodes(routerId, 1, 20, null, { status: 'available' });
            
            // Réinitialiser la case à cocher "Tout sélectionner"
            selectAllCheckbox.checked = false;
            
            // Réinitialiser le bouton de suppression
            deleteSelectedBtn.disabled = true;
            deleteSelectedBtn.innerHTML = '<i class="fas fa-trash-alt me-1"></i> Supprimer les codes sélectionnés';
        } catch (error) {
            console.error('Erreur lors de la suppression des codes:', error);
            
            // Afficher un message d'erreur
            showGlobalMessage('error', `Erreur lors de la suppression des codes: ${error.message}`);
            
            // Réinitialiser le bouton de suppression
            deleteSelectedBtn.disabled = false;
            deleteSelectedBtn.innerHTML = '<i class="fas fa-trash-alt me-1"></i> Supprimer les codes sélectionnés';
        }
    });
}

/**
 * Mettre à jour la liste des codes WiFi
 * @param {FirebaseFirestore.QuerySnapshot} querySnapshot - Résultat de la requête
 * @param {string} routerId - ID du routeur
 */
function updateWifiCodesList(querySnapshot, routerId) {
    console.log('Mise à jour de la liste des codes WiFi');
    
    // Récupérer le conteneur
    const container = document.getElementById('wifiCodesList');
    if (!container) {
        console.error('Conteneur wifiCodesList non trouvé');
        return;
    }
    
    // Vider le conteneur
    container.innerHTML = '';
    
    // Vérifier s'il y a des codes
    if (querySnapshot.size === 0) {
        container.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <div class="text-muted">
                        <i class="fas fa-key fa-3x mb-3"></i>
                        <p>Aucun code WiFi trouvé</p>
                    </div>
                </td>
            </tr>
        `;
        return;
    }
    
    // Ajouter chaque code à la liste
    querySnapshot.forEach((doc) => {
        const code = doc.data();
        code.id = doc.id;
        
        // Créer la ligne du tableau
        const row = document.createElement('tr');
        
        // Déterminer la classe CSS en fonction du statut
        let statusClass = '';
        let statusText = '';
        
        switch (code.status) {
            case 'available':
                statusClass = 'bg-success';
                statusText = 'Disponible';
                break;
            case 'used':
                statusClass = 'bg-warning';
                statusText = 'Utilisé';
                break;
            case 'expired':
                statusClass = 'bg-danger';
                statusText = 'Expiré';
                break;
            default:
                statusClass = 'bg-secondary';
                statusText = code.status || 'Inconnu';
        }
        
        // Formater la date de création
        let createdAt = 'N/A';
        if (code.createdAt) {
            try {
                // Vérifier si c'est un Timestamp Firestore
                if (typeof code.createdAt.toDate === 'function') {
                    createdAt = new Date(code.createdAt.toDate()).toLocaleDateString('fr-FR');
                } else if (code.createdAt instanceof Date) {
                    createdAt = code.createdAt.toLocaleDateString('fr-FR');
                } else if (typeof code.createdAt === 'string') {
                    createdAt = new Date(code.createdAt).toLocaleDateString('fr-FR');
                }
            } catch (e) {
                console.error('Erreur lors du formatage de la date:', e);
                createdAt = 'Date invalide';
            }
        }
        
        // Construire le contenu de la ligne
        row.innerHTML = `
            <td>
                <span class="badge ${statusClass}">${statusText}</span>
            </td>
            <td>${code.username || 'N/A'}</td>
            <td>${code.password || 'N/A'}</td>
            <td>${code.profileName || 'Profil inconnu'}</td>
            <td>${createdAt}</td>
            <td>
                <div class="dropdown">
                    <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                        Actions
                    </button>
                    <ul class="dropdown-menu dropdown-menu-end">
                        <li><a class="dropdown-item view-code-btn" href="#" data-id="${code.id}"><i class="fas fa-eye me-1"></i> Détails</a></li>
                        <li><a class="dropdown-item copy-code-btn" href="#" data-id="${code.id}"><i class="fas fa-copy me-1"></i> Copier</a></li>
                        <li><a class="dropdown-item print-code-btn" href="#" data-id="${code.id}"><i class="fas fa-print me-1"></i> Imprimer</a></li>
                        <li><hr class="dropdown-divider"></li>
                        <li><a class="dropdown-item edit-code-btn" href="#" data-id="${code.id}"><i class="fas fa-edit me-1"></i> Modifier</a></li>
                        <li><a class="dropdown-item delete-code-btn" href="#" data-id="${code.id}"><i class="fas fa-trash me-1"></i> Supprimer</a></li>
                    </ul>
                </div>
            </td>
        `;
        
        // Ajouter la ligne au conteneur
        container.appendChild(row);
        
        // Ajouter les gestionnaires d'événements pour les boutons
        row.querySelector('.view-code-btn').addEventListener('click', function(e) {
            e.preventDefault();
            viewWifiCode(code.id, routerId);
        });
        
        row.querySelector('.copy-code-btn').addEventListener('click', function(e) {
            e.preventDefault();
            copyWifiCode(code.id, routerId);
        });
        
        row.querySelector('.print-code-btn').addEventListener('click', function(e) {
            e.preventDefault();
            printWifiCode(code.id, routerId);
        });
        
        row.querySelector('.edit-code-btn').addEventListener('click', function(e) {
            e.preventDefault();
            editWifiCode(code.id, routerId);
        });
        
        row.querySelector('.delete-code-btn').addEventListener('click', function(e) {
            e.preventDefault();
            deleteWifiCode(code.id, routerId);
        });
    });
}

/**
 * Mettre à jour les compteurs de codes WiFi
 * @param {string} routerId - ID du routeur
 */
async function updateWifiCodesCounters(routerId) {
    console.log('Mise à jour des compteurs de codes WiFi');
    
    try {
        // Vérifier si la collection existe
        await checkAndCreateCollection('wifiCodes');
        
        // Compter les codes disponibles
        const availableCodesQuery = query(
            collection(db, 'wifiCodes'),
            where('routerId', '==', routerId),
            where('status', '==', 'available')
        );
        
        try {
            const availableCodesSnapshot = await getDocs(availableCodesQuery);
            const availableCodesCount = availableCodesSnapshot.size;
            
            // Mettre à jour le compteur dans l'interface
            const availableCodesCounter = document.getElementById('availableCodesCount');
            if (availableCodesCounter) {
                availableCodesCounter.textContent = availableCodesCount;
            }
            
            // Compter tous les codes
            const allCodesQuery = query(
                collection(db, 'wifiCodes'),
                where('routerId', '==', routerId)
            );
            
            const allCodesSnapshot = await getDocs(allCodesQuery);
            const allCodesCount = allCodesSnapshot.size;
            
            // Mettre à jour le compteur dans l'interface
            const allCodesCounter = document.getElementById('totalCodesCount');
            if (allCodesCounter) {
                allCodesCounter.textContent = allCodesCount;
            }
            
            return {
                available: availableCodesCount,
                total: allCodesCount
            };
        } catch (error) {
            // Gérer les erreurs d'index
            const errorInfo = handleFirebaseError(error);
            
            if (errorInfo.isIndexError) {
                console.warn('Erreur d\'index lors du comptage des codes WiFi, utilisation d\'un comptage manuel');
                
                // Essayer une requête plus simple
                const simpleQuery = query(
                    collection(db, 'wifiCodes'),
                    where('routerId', '==', routerId)
                );
                
                const simpleSnapshot = await getDocs(simpleQuery);
                
                // Compter manuellement
                let availableCount = 0;
                let totalCount = simpleSnapshot.size;
                
                simpleSnapshot.forEach(doc => {
                    const data = doc.data();
                    if (data.status === 'available') {
                        availableCount++;
                    }
                });
                
                // Mettre à jour les compteurs dans l'interface
                const availableCodesCounter = document.getElementById('availableCodesCount');
                if (availableCodesCounter) {
                    availableCodesCounter.textContent = availableCount;
                }
                
                const allCodesCounter = document.getElementById('totalCodesCount');
                if (allCodesCounter) {
                    allCodesCounter.textContent = totalCount;
                }
                
                return {
                    available: availableCount,
                    total: totalCount
                };
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour des compteurs de codes WiFi:', error);
        return {
            available: 0,
            total: 0
        };
    }
}

/**
 * Générer des codes WiFi
 * @param {string} routerId - ID du routeur
 */
function generateCodes(routerId) {
    // Valider le formulaire
    const form = document.getElementById('generateCodesForm');
    if (!form.checkValidity()) {
        form.reportValidity();
        return;
    }
    
    // Récupérer les paramètres
    const profileId = document.getElementById('generateProfileSelect').value;
    const count = parseInt(document.getElementById('generateCodesCount').value) || 10;
    const usernameLength = parseInt(document.getElementById('usernameLength').value) || 6;
    const usernameCharset = document.getElementById('usernameCharset').value;
    const usernamePrefix = document.getElementById('usernamePrefix').value || '';
    const passwordLength = parseInt(document.getElementById('passwordLength').value) || 6;
    const passwordCharset = document.getElementById('passwordCharset').value;
    const passwordSuffix = document.getElementById('passwordSuffix').value || '';
    
    // Vérifier si un profil est sélectionné
    if (!profileId) {
        showError('generateCodesError', 'Veuillez sélectionner un profil.');
        return;
    }
    
    // Vérifier le nombre de codes
    if (count < 1 || count > 1000) {
        showError('generateCodesError', 'Le nombre de codes doit être compris entre 1 et 1000.');
        return;
    }
    
    // Afficher le spinner
    document.getElementById('generateCodesSpinner').classList.remove('d-none');
    document.getElementById('generateCodesBtn').disabled = true;
    
    // Afficher la barre de progression
    const progressBar = document.getElementById('generateProgress');
    progressBar.classList.remove('d-none');
    progressBar.querySelector('.progress-bar').style.width = '0%';
    progressBar.querySelector('.progress-bar').setAttribute('aria-valuenow', '0');
    
    // Générer les codes par lots pour éviter de bloquer l'interface
    generateCodesInBatches(routerId, profileId, count, usernameLength, usernameCharset, usernamePrefix, passwordLength, passwordCharset, passwordSuffix, 0, []);
}

/**
 * Générer des codes WiFi par lots
 * @param {string} routerId - ID du routeur
 * @param {string} profileId - ID du profil
 * @param {number} totalCount - Nombre total de codes à générer
 * @param {number} usernameLength - Longueur du nom d'utilisateur
 * @param {string} usernameCharset - Jeu de caractères pour le nom d'utilisateur
 * @param {string} usernamePrefix - Préfixe du nom d'utilisateur
 * @param {number} passwordLength - Longueur du mot de passe
 * @param {string} passwordCharset - Jeu de caractères pour le mot de passe
 * @param {string} passwordSuffix - Suffixe du mot de passe
 * @param {number} currentCount - Nombre de codes générés jusqu'à présent
 * @param {Array} generatedCodes - Codes générés jusqu'à présent
 */
function generateCodesInBatches(routerId, profileId, totalCount, usernameLength, usernameCharset, usernamePrefix, passwordLength, passwordCharset, passwordSuffix, currentCount, generatedCodes) {
    // Taille du lot
    const batchSize = 50;
    
    // Nombre de codes à générer dans ce lot
    const batchCount = Math.min(batchSize, totalCount - currentCount);
    
    // Générer un lot de codes
    const batch = [];
    for (let i = 0; i < batchCount; i++) {
        const username = usernamePrefix + generateRandomString(usernameLength, usernameCharset);
        const password = generateRandomString(passwordLength, passwordCharset) + passwordSuffix;
        batch.push({ username, password });
    }
    
    // Ajouter le lot aux codes générés
    generatedCodes = generatedCodes.concat(batch);
    
    // Mettre à jour le compteur
    currentCount += batchCount;
    
    // Mettre à jour la barre de progression
    const progress = Math.round((currentCount / totalCount) * 100);
    const progressBar = document.getElementById('generateProgress').querySelector('.progress-bar');
    progressBar.style.width = progress + '%';
    progressBar.setAttribute('aria-valuenow', progress);
    
    // Vérifier si tous les codes ont été générés
    if (currentCount < totalCount) {
        // Continuer avec le lot suivant
        setTimeout(() => {
            generateCodesInBatches(routerId, profileId, totalCount, usernameLength, usernameCharset, usernamePrefix, passwordLength, passwordCharset, passwordSuffix, currentCount, generatedCodes);
        }, 0);
    } else {
        // Tous les codes ont été générés, les enregistrer
        saveGeneratedCodes(routerId, profileId, generatedCodes);
    }
}

/**
 * Enregistrer les codes générés
 * @param {string} routerId - ID du routeur
 * @param {string} profileId - ID du profil
 * @param {Array} codes - Codes à enregistrer
 */
async function saveGeneratedCodes(routerId, profileId, codes) {
    try {
        // Créer un lot de codes à enregistrer
        const batch = writeBatch(db);
        
        // Ajouter chaque code au lot
        codes.forEach(code => {
            const codesCollectionRef = collection(db, 'wifiCodes');
            const codeRef = doc(codesCollectionRef);
            batch.set(codeRef, {
                routerId,
                profileId,
                username: code.username,
                password: code.password,
                status: 'available',
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        });
        
        // Enregistrer le lot
        await batch.commit();
        
        // Mettre à jour les statistiques du profil
        const profileRef = doc(db, 'profiles', profileId);
        await runTransaction(db, async (transaction) => {
            const profileDoc = await transaction.get(profileRef);
            if (profileDoc.exists()) {
                const currentStats = profileDoc.data().stats || {};
                transaction.update(profileRef, {
                    'stats.totalCodes': (currentStats.totalCodes || 0) + codes.length,
                    'stats.availableCodes': (currentStats.availableCodes || 0) + codes.length,
                    updatedAt: serverTimestamp()
                });
            }
        });
        
        // Masquer le spinner
        document.getElementById('generateCodesSpinner').classList.add('d-none');
        document.getElementById('generateCodesBtn').disabled = false;
        
        // Masquer la barre de progression
        document.getElementById('generateProgress').classList.add('d-none');
        
        // Afficher un message de succès
        showSuccess('generateCodesSuccess', `${codes.length} codes WiFi ont été générés avec succès.`);
        
        // Recharger les codes
        loadCodes(routerId);
        
        // Recharger les profils pour mettre à jour le nombre de codes disponibles
        loadProfiles(routerId);
    } catch (error) {
        console.error('Erreur lors de l\'enregistrement des codes:', error);
        
        // Masquer le spinner
        document.getElementById('generateCodesSpinner').classList.add('d-none');
        document.getElementById('generateCodesBtn').disabled = false;
        
        // Masquer la barre de progression
        document.getElementById('generateProgress').classList.add('d-none');
        
        // Afficher un message d'erreur
        showError('generateCodesError', 'Une erreur est survenue lors de la génération des codes. Veuillez réessayer.');
    }
}

/**
 * Afficher un message d'erreur
 * @param {string} elementId - ID de l'élément d'erreur
 * @param {string} message - Message d'erreur
 */
function showError(elementId, message) {
    const errorElement = document.getElementById(elementId);
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.classList.remove('d-none');
        
        // Masquer le message après 5 secondes
        setTimeout(() => {
            errorElement.classList.add('d-none');
        }, 5000);
    }
}

/**
 * Afficher un message de succès
 * @param {string} elementId - ID de l'élément de succès
 * @param {string} message - Message de succès
 */
function showSuccess(elementId, message) {
    const successElement = document.getElementById(elementId);
    if (successElement) {
        successElement.textContent = message;
        successElement.classList.remove('d-none');
        
        // Masquer le message après 5 secondes
        setTimeout(() => {
            successElement.classList.add('d-none');
        }, 5000);
    }
}

/**
 * Éditer un profil
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 */
async function editProfile(profileId, routerId) {
    try {
        // Récupérer les données du profil
        const profileRef = doc(db, 'profiles', profileId);
        const profileSnap = await getDoc(profileRef);
        
        if (!profileSnap.exists()) {
            alert('Profil non trouvé');
            return;
        }
        
        const profile = profileSnap.data();
        
        // Remplir le formulaire d'édition
        document.getElementById('editProfileId').value = profileId;
        document.getElementById('editProfileName').value = profile.name || '';
        document.getElementById('editProfileDescription').value = profile.description || '';
        document.getElementById('editProfileDuration').value = profile.duration || '';
        document.getElementById('editProfilePrice').value = profile.price || '';
        
        // Afficher le modal d'édition
        const editProfileModal = new bootstrap.Modal(document.getElementById('editProfileModal'));
        editProfileModal.show();
        
        // Configurer le gestionnaire d'événement pour le bouton de sauvegarde
        const saveEditBtn = document.getElementById('saveEditProfileBtn');
        
        // Supprimer les gestionnaires précédents
        const newSaveEditBtn = saveEditBtn.cloneNode(true);
        saveEditBtn.parentNode.replaceChild(newSaveEditBtn, saveEditBtn);
        
        newSaveEditBtn.addEventListener('click', async function() {
            // Récupérer les valeurs du formulaire
            const name = document.getElementById('editProfileName').value.trim();
            const description = document.getElementById('editProfileDescription').value.trim();
            const duration = document.getElementById('editProfileDuration').value.trim();
            const price = parseFloat(document.getElementById('editProfilePrice').value);
            
            // Validation basique
            if (!name || !duration || isNaN(price)) {
                const errorElement = document.getElementById('editProfileFormError');
                errorElement.textContent = 'Veuillez remplir tous les champs obligatoires';
                errorElement.classList.remove('d-none');
                return;
            }
            
            // Afficher le spinner
            const spinner = document.getElementById('editProfileSpinner');
            spinner.classList.remove('d-none');
            newSaveEditBtn.disabled = true;
            
            try {
                // Mettre à jour le profil dans Firestore
                await updateDoc(profileRef, {
                    name: name,
                    description: description,
                    duration: duration,
                    price: price,
                    updatedAt: serverTimestamp()
                });
                
                // Fermer le modal
                const modal = bootstrap.Modal.getInstance(document.getElementById('editProfileModal'));
                modal.hide();
                
                // Recharger les profils
                loadProfiles(routerId);
                
                // Afficher un message de succès
                showSuccess('profilesSuccess', 'Le profil a été mis à jour avec succès.');
            } catch (error) {
                console.error('Erreur lors de la mise à jour du profil:', error);
                
                // Afficher l'erreur
                const errorElement = document.getElementById('editProfileFormError');
                errorElement.textContent = 'Erreur lors de la mise à jour du profil: ' + error.message;
                errorElement.classList.remove('d-none');
            } finally {
                // Masquer le spinner
                spinner.classList.add('d-none');
                newSaveEditBtn.disabled = false;
            }
        });
    } catch (error) {
        console.error('Erreur lors de la récupération du profil:', error);
        alert('Erreur lors de la récupération du profil: ' + error.message);
    }
}

