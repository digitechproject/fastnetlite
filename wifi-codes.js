// Import des fonctions Firebase nécessaires
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
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
import { checkAndShowLicenseModal } from './license-modal.js';

// Obtenir les instances des services Firebase
const auth = getAuth();
const db = getFirestore();

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
                // Rediriger vers la liste des routeurs si aucun ID n'est fourni
                window.location.href = 'routers.html';
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
            
            // Mettre à jour le nom du routeur dans l'interface
            document.getElementById('routerName').textContent = router.name;
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
 * Ajouter un profil à la liste déroulante d'importation
 * @param {string} profileId - ID du profil
 * @param {Object} profile - Données du profil
 */
function addProfileToImportSelect(profileId, profile) {
    // Ajouter au sélecteur d'importation
    const importSelect = document.getElementById('importProfile');
    if (!importSelect) {
        console.error('Élément importProfile non trouvé');
        return;
    }
    
    const importOption = document.createElement('option');
    importOption.value = profileId;
    importOption.textContent = `${profile.name} (${profile.duration} - ${profile.price} FCFA)`;
    importSelect.appendChild(importOption);
    
    // Ajouter au sélecteur de génération
    const generateSelect = document.getElementById('generateProfileSelect');
    if (generateSelect) {
        const generateOption = document.createElement('option');
        generateOption.value = profileId;
        generateOption.textContent = `${profile.name} (${profile.duration} - ${profile.price} FCFA)`;
        generateSelect.appendChild(generateOption);
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
                     
    row.innerHTML = `
        <td><code>${codeValue}</code></td>
        <td class="code-profile">${profileName}</td>
        <td>${code.clientName || '-'}</td>
        <td>${createdAt}</td>
        <td>${usedAt}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
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
        <td class="code-profile">${profileName}</td>
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
        // Configuration normale du formulaire d'importation
        if (importMethod) {
            importMethod.addEventListener('change', function() {
                if (this.value === 'csv') {
                    csvImport.classList.remove('d-none');
                    textImport.classList.add('d-none');
                    pdfImport.classList.add('d-none');
                } else if (this.value === 'text') {
                    csvImport.classList.add('d-none');
                    textImport.classList.remove('d-none');
                    pdfImport.classList.add('d-none');
                } else if (this.value === 'pdf') {
                    csvImport.classList.add('d-none');
                    textImport.classList.add('d-none');
                    pdfImport.classList.remove('d-none');
                }
            });
        }
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
        searchInput.addEventListener('input', function() {
            // Utiliser filterCodes pour filtrer les codes sans recharger toute la liste
            filterCodes();
        });
    }
    
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            const searchInput = document.getElementById('searchCodes');
            if (searchInput) {
                searchInput.value = '';
                // Utiliser filterCodes pour filtrer les codes sans recharger toute la liste
                filterCodes();
            }
        });
    }
    
    const filterProfile = document.getElementById('filterProfile');
    if (filterProfile) {
        filterProfile.addEventListener('change', function() {
            // Utiliser filterCodes pour filtrer les codes sans recharger toute la liste
            filterCodes();
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
    
    // Gestionnaire pour le changement de format de code
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
            const file = this.files[0];
            let pattern = document.getElementById('detectedPattern').value;
            
            // Masquer les messages d'erreur
            document.getElementById('importFormError').classList.add('d-none');
            
            // Afficher le spinner
            const spinner = document.getElementById('importCodesSpinner');
            spinner.classList.remove('d-none');
            document.getElementById('importCodesBtn').disabled = true;
            
            // Vérifier le format des codes
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
            
            // Traiter le fichier PDF
            processPDFFile(file, pattern, isUserPass)
                .then((extractedCodes) => {
                    // Stocker les codes extraits dans une variable globale
                    window.extractedCodes = extractedCodes || [];
                    
                    // Masquer le spinner
                    spinner.classList.add('d-none');
                    document.getElementById('importCodesBtn').disabled = false;
                    
                    if (extractedCodes && extractedCodes.length > 0) {
                        // Afficher un message de succès
                        const successElement = document.getElementById('importFormSuccess');
                        if (successElement) {
                            successElement.textContent = `${extractedCodes.length} codes extraits avec succès`;
                            successElement.classList.remove('d-none');
                            
                            // Masquer le message après 3 secondes
                            setTimeout(() => {
                                successElement.classList.add('d-none');
                            }, 3000);
                        }
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
                    errorElement.textContent = 'Erreur lors du traitement du PDF: ' + error.message;
                    errorElement.classList.remove('d-none');
                    
                    // Masquer le spinner
                    spinner.classList.add('d-none');
                    document.getElementById('importCodesBtn').disabled = false;
                });
        }
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
                                    
                                    // Recharger les profils
                                    loadProfiles(routerId);
                                    
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
            const importMethod = document.getElementById('importMethod').value;
            
            // Validation basique
            if (!profileId) {
                const errorElement = document.getElementById('importFormError');
                errorElement.textContent = 'Veuillez sélectionner un profil';
                errorElement.classList.remove('d-none');
                return;
            }
            
            // Récupérer les codes selon la méthode d'importation
            if (importMethod === 'csv') {
                const csvFile = document.getElementById('csvFile').files[0];
                if (!csvFile) {
                    const errorElement = document.getElementById('importFormError');
                    errorElement.textContent = 'Veuillez sélectionner un fichier CSV';
                    errorElement.classList.remove('d-none');
                    return;
                }
                
                // Traiter le fichier CSV
                processCSVFile(csvFile, profileId, routerId);
            } else if (importMethod === 'text') {
                const textCodes = document.getElementById('textCodes').value.trim();
                if (!textCodes) {
                    const errorElement = document.getElementById('importFormError');
                    errorElement.textContent = 'Veuillez entrer des codes';
                    errorElement.classList.remove('d-none');
                    return;
                }
                
                // Traiter les codes texte
                processTextCodes(textCodes, profileId, routerId);
            } else if (importMethod === 'pdf') {
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
                importCodes(extractedCodes, profileId, routerId, isUserPass);
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
 * Traiter un fichier PDF
 * @param {File} file - Fichier PDF
 * @param {string} pattern - Pattern d'expression régulière pour extraire les codes
 * @param {boolean} isUserPass - Indique si le format est User/Mot de passe
 * @returns {Promise<Array>}
 */
async function processPDFFile(file, pattern, isUserPass) {
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
        
        // Extraire le texte de chaque page
        for (let i = 1; i <= pdf.numPages; i++) {
            console.log(`Extraction du texte de la page ${i}/${pdf.numPages}...`);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            extractedText += pageText + '\n';
        }
        
        console.log('Texte extrait du PDF (extrait):', extractedText.substring(0, 200) + '...');
        
        // Extraire les codes selon le pattern
        console.log('Extraction des codes avec le pattern:', pattern);
        const extractedCodes = extractCodesFromText(extractedText, pattern, isUserPass);
        console.log('Nombre de codes extraits:', extractedCodes.length);
        
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
        // Remplacer les espaces multiples par un seul espace
        const cleanedText = text.replace(/\s+/g, ' ');
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
                    regexStr = `(${userPattern})\\s+(${passPattern})`;
                } else {
                    // Pattern générique pour User/Pass
                    regexStr = '([A-Za-z0-9]{4,})\\s+([A-Za-z0-9]{4,})';
                }
            } else {
                // Si le pattern ne contient pas de séparateur explicite, utiliser un pattern générique
                regexStr = '([A-Za-z0-9]{4,})\\s+([A-Za-z0-9]{4,})';
            }
            
            console.log('Utilisation du pattern regex pour User/Pass:', regexStr);
            regex = new RegExp(regexStr, 'gm');
        } else {
            // Pour le format Voucher
            // Vérifier si le pattern est valide, sinon utiliser un pattern par défaut
            try {
                // Tester si le pattern est une regex valide
                new RegExp(pattern);
                console.log('Utilisation du pattern regex pour Voucher:', pattern);
                regex = new RegExp(pattern, 'gm');
            } catch (e) {
                // Pattern invalide, utiliser un pattern par défaut
                const defaultPattern = '[A-Za-z0-9]{4,}';
                console.warn('Pattern invalide, utilisation du pattern par défaut:', defaultPattern);
                regex = new RegExp(defaultPattern, 'gm');
            }
        }
        
        // Extraire tous les codes
        let match;
        const uniqueCodes = new Set();
        
        console.log('Début de l\'extraction des codes...');
        while ((match = regex.exec(cleanedText)) !== null) {
            if (isUserPass) {
                // Format User/Mot de passe
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
            } else {
                // Format Voucher
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
 * Supprime un code extrait du tableau
 * @param {number} index - Index du code à supprimer
 * @param {boolean} isUserPass - Indique si le format est User/Mot de passe
 */
function removeExtractedCode(index, isUserPass) {
    // Récupérer les codes extraits
    const extractedCodes = window.extractedCodes || [];
    
    if (index >= 0 && index < extractedCodes.length) {
        // Supprimer le code
        extractedCodes.splice(index, 1);
        
        // Mettre à jour la variable globale
        window.extractedCodes = extractedCodes;
        
        // Mettre à jour l'affichage
        displayExtractedCodes(extractedCodes, isUserPass);
    }
}

/**
 * Importer des codes
 * @param {Array} codes - Liste des codes (string pour Voucher, {username, password} pour User/Pass)
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 * @param {boolean} isUserPass - Indique si le format est User/Mot de passe
 */
function importCodes(codes, profileId, routerId, isUserPass = false) {
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
        
        return;
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
    
    // Déduplication
    codes.forEach(code => {
        const key = getCodeKey(code);
        if (key && !uniqueKeys.has(key)) {
            uniqueKeys.add(key);
            uniqueCodes.push(code);
        }
    });
    
    console.log(`Après déduplication: ${uniqueCodes.length} codes uniques`);
    
    // Utiliser les fonctions modernes de Firebase pour éviter les erreurs
    const batch = writeBatch(db);
    let importedCount = 0;
    const batchSize = 500; // Firestore limite les lots à 500 opérations
    
    // Fonction pour traiter un lot de codes
    const processBatch = async (startIndex) => {
        try {
            // Créer un nouveau lot si nécessaire
            let currentBatch = batch;
            if (startIndex > 0) {
                currentBatch = writeBatch(db);
            }
            
            // Déterminer la fin du lot actuel
            const endIndex = Math.min(startIndex + batchSize, uniqueCodes.length);
            
            // Vérifier d'abord si les codes existent déjà dans la base de données
            const codesCollectionRef = collection(db, 'wifiCodes');
            const existingCodesQuery = query(
                codesCollectionRef,
                where('routerId', '==', routerId),
                where('profileId', '==', profileId)
            );
            
            const existingCodesSnapshot = await getDocs(existingCodesQuery);
            const existingCodeKeys = new Set();
            
            existingCodesSnapshot.forEach(doc => {
                const data = doc.data();
                const key = `${data.username}:${data.password}`;
                existingCodeKeys.add(key);
            });
            
            console.log(`${existingCodeKeys.size} codes existants déjà dans la base de données`);
            
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
                await currentBatch.commit();
                console.log(`Lot de ${importedCount} codes importés avec succès`);
            } else {
                console.log('Aucun nouveau code à importer dans ce lot');
            }
            
            // Si nous avons plus de codes à traiter, continuer avec le lot suivant
            if (endIndex < uniqueCodes.length) {
                return processBatch(endIndex);
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
            try {
                const profileRef = doc(db, 'profiles', profileId);
                await runTransaction(db, async (transaction) => {
                    const profileDoc = await transaction.get(profileRef);
                    if (profileDoc.exists()) {
                        const currentStats = profileDoc.data().stats || {};
                        transaction.update(profileRef, {
                            'stats.totalCodes': (currentStats.totalCodes || 0) + importedCount,
                            'stats.availableCodes': (currentStats.availableCodes || 0) + importedCount,
                            updatedAt: serverTimestamp()
                        });
                    }
                });
                console.log('Statistiques du profil mises à jour avec succès');
            } catch (error) {
                console.error('Erreur lors de la mise à jour des statistiques du profil:', error);
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
            
            // Recharger les codes
            try {
                loadCodes(routerId);
                console.log('Codes rechargés avec succès');
            } catch (error) {
                console.error('Erreur lors du rechargement des codes:', error);
            }
            
            // Recharger les profils (pour mettre à jour le nombre de codes)
            try {
                loadProfiles(routerId);
                console.log('Profils rechargés avec succès');
            } catch (error) {
                console.error('Erreur lors du rechargement des profils:', error);
            }
            
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
            
            // Afficher l'erreur
            const errorElement = document.getElementById('importFormError');
            errorElement.textContent = 'Erreur lors de l\'importation des codes: ' + error.message;
            errorElement.classList.remove('d-none');
            
            // Masquer le spinner
            document.getElementById('importCodesSpinner').classList.add('d-none');
            document.getElementById('importCodesBtn').disabled = false;
        }
    };
    
    // Démarrer le traitement par lots
    processBatch(0);
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
            const profileIdCell = row.querySelector('[data-profile-id]');
            if (profileIdCell) {
                const rowProfileId = profileIdCell.dataset.profileId;
                if (rowProfileId !== profileFilter) {
                    showRow = false;
                }
            } else {
                // Si on ne trouve pas l'ID du profil, on vérifie le texte
                const profileCell = row.querySelector('td:nth-child(2)');
                if (profileCell) {
                    const profileName = profileCell.textContent.trim().toLowerCase();
                    // Récupérer le texte du profil sélectionné
                    const selectedProfileText = filterProfileElement.options[filterProfileElement.selectedIndex].text.toLowerCase();
                    if (!profileName.includes(selectedProfileText) && selectedProfileText !== 'tous les profils') {
                        showRow = false;
                    }
                }
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

// La fonction deleteProfile a été déplacée plus haut dans le fichier pour éviter les doublons

// La fonction copyBuyLink a été déplacée plus haut dans le fichier pour éviter les doublons

// /**
//  * Afficher un message d'erreur
//  * @param {string} elementId - ID de l'élément d'erreur
//  * @param {string} message - Message d'erreur
//  */
// function showError(elementId, message) {
//     const errorElement = document.getElementById(elementId);
//     if (errorElement) {
//         errorElement.textContent = message;
//         errorElement.classList.remove('d-none');
        
//         // Masquer le message après 5 secondes
//         setTimeout(() => {
//             errorElement.classList.add('d-none');
//         }, 5000);
//     }
// }

// /**
//  * Afficher un message de succès
//  * @param {string} elementId - ID de l'élément de succès
//  * @param {string} message - Message de succès
//  */
// function showSuccess(elementId, message) {
//     const successElement = document.getElementById(elementId);
//     if (successElement) {
//         successElement.textContent = message;
//         successElement.classList.remove('d-none');
        
//         // Masquer le message après 5 secondes
//         setTimeout(() => {
//             successElement.classList.add('d-none');
//         }, 5000);
//     }
// }

/**
 * Éditer un profil
 * @param {string} profileId - ID du profil
 * @param {string} routerId - ID du routeur
 */
// async function saveGeneratedCodes(routerId, profileId, codes) {
//     try {
//         // Créer un lot de codes à enregistrer
//         const batch = writeBatch(db);
        
//         // Ajouter chaque code au lot
//         codes.forEach(code => {
//             const codesCollectionRef = collection(db, 'wifiCodes');
//             const codeRef = doc(codesCollectionRef);
//             batch.set(codeRef, {
//                 routerId,
//                 profileId,
//                 username: code.username,
//                 password: code.password,
//                 status: 'available',
//                 createdAt: serverTimestamp(),
//                 updatedAt: serverTimestamp()
//             });
//         });
        
//         // Enregistrer le lot
//         await batch.commit();
        
//         // Mettre à jour les statistiques du profil
//         const profileRef = doc(db, 'profiles', profileId);
//         await runTransaction(db, async (transaction) => {
//             const profileDoc = await transaction.get(profileRef);
//             if (profileDoc.exists()) {
//                 const currentStats = profileDoc.data().stats || {};
//                 transaction.update(profileRef, {
//                     'stats.totalCodes': (currentStats.totalCodes || 0) + codes.length,
//                     'stats.availableCodes': (currentStats.availableCodes || 0) + codes.length,
//                     updatedAt: serverTimestamp()
//                 });
//             }
//         });
        
//         // Masquer le spinner
//         document.getElementById('generateCodesSpinner').classList.add('d-none');
//         document.getElementById('generateCodesBtn').disabled = false;
        
//         // Masquer la barre de progression
//         document.getElementById('generateProgress').classList.add('d-none');
        
//         // Afficher un message de succès
//         showSuccess('generateCodesSuccess', `${codes.length} codes WiFi ont été générés avec succès.`);
        
//         // Recharger les codes
//         loadCodes(routerId);
        
//         // Recharger les profils pour mettre à jour le nombre de codes disponibles
//         loadProfiles(routerId);
//     } catch (error) {
//         console.error('Erreur lors de l\'enregistrement des codes:', error);
        
//         // Masquer le spinner
//         document.getElementById('generateCodesSpinner').classList.add('d-none');
//         document.getElementById('generateCodesBtn').disabled = false;
        
//         // Masquer la barre de progression
//         document.getElementById('generateProgress').classList.add('d-none');
        
//         // Afficher un message d'erreur
//         showError('generateCodesError', 'Une erreur est survenue lors de la génération des codes. Veuillez réessayer.');
//     }
// }

// Les fonctions deleteProfile et copyBuyLink ont été déplacées plus haut dans le fichier pour éviter les doublons
