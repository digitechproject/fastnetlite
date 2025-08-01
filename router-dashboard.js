// Import des fonctions Firebase nécessaires
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, doc, getDoc, getDocs, query, where, orderBy, limit, startAfter, endBefore, addDoc, updateDoc, deleteDoc, setDoc, writeBatch, runTransaction, serverTimestamp, Timestamp } from "firebase/firestore";
import './src/index';

// Note: Les fonctions utilitaires pour la gestion des routeurs sont disponibles via window.routerUtils
// Assurez-vous que router-utils.js est chargé avant ce script

// Obtenir les instances des services Firebase
// Importer les instances Firebase déjà initialisées depuis firebase-config.js
import { auth, db } from './firebase-config.js';

// Variable globale pour éviter les initialisations multiples
window.routerDashboardInitialized = window.routerDashboardInitialized || false;

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
    if (window.routerDashboardInitialized) {
        console.log('router-dashboard.js déjà initialisé, initialisation ignorée');
        return;
    }
    
    // Marquer le script comme initialisé
    window.routerDashboardInitialized = true;
    console.log('Initialisation de router-dashboard.js');
    // Vérifier si l'utilisateur est connecté
    onAuthStateChanged(auth, function(user) {
        if (user) {
            // Utilisateur connecté
            console.log('Utilisateur connecté:', user.displayName);
            
            // Mettre à jour le nom de l'utilisateur dans l'interface
            const userNameElements = document.querySelectorAll('#userName');
            if (userNameElements && userNameElements.length > 0) {
                userNameElements.forEach(element => {
                    if (element) element.textContent = user.displayName || user.email;
                });
            }
            
            // Récupérer l'ID du routeur depuis l'URL en utilisant la fonction utilitaire
            const routerId = window.routerUtils.getRouterId();
            
            // Vérifier si l'ID du routeur est présent
            if (!routerId) {
                console.error('ID du routeur non spécifié');
                // Vérifier si nous sommes dans un contexte de navigation
                const isNavigationEvent = sessionStorage.getItem('isRouterNavigation');
                
                // Si ce n'est pas un événement de navigation, rediriger vers la liste des routeurs
                if (!isNavigationEvent) {
                    alert('ID du routeur non spécifié');
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
            
            // Utiliser la fonction utilitaire pour mettre à jour les liens de navigation du routeur
            if (window.routerUtils && typeof window.routerUtils.updateRouterNavigationLinks === 'function') {
                window.routerUtils.updateRouterNavigationLinks(routerId);
            } else {
                console.warn('La fonction updateRouterNavigationLinks n\'est pas disponible');
            }
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
        btn.addEventListener('click', async function(e) {
            e.preventDefault();
            try {
                await signOut(auth);
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Erreur lors de la déconnexion:', error);
                alert('Erreur lors de la déconnexion. Veuillez réessayer.');
            }
        });
    });
    
    // Les liens de navigation du routeur sont maintenant gérés dans la fonction onAuthStateChanged
});

/**
 * Initialiser la page
 * @param {string} routerId - ID du routeur
 */
async function initPage(routerId) {
    try {
        // Importer les fonctions utilitaires
        const { initializeCollections } = await import('./src/db-utils.js');
        
        // Vérifier et initialiser les collections nécessaires
        const userId = auth.currentUser ? auth.currentUser.uid : 'anonymous';
        await initializeCollections(userId, routerId);
        
        // Charger les informations du routeur
        loadRouterInfo(routerId);
        
        // Charger les statistiques
        loadStatistics(routerId);
        
        // Charger les profils WiFi
        loadProfiles(routerId);
        
        // Charger les ventes récentes
        loadRecentSales(routerId);
        
        // Charger l'activité récente
        loadRecentActivity(routerId);
        
        // Initialiser le graphique des ventes
        initSalesChart(routerId);
        
        // Mettre à jour les liens de navigation
        updateNavigationLinks(routerId);
    } catch (error) {
        console.error('Erreur lors de l\'initialisation de la page:', error);
        
        // Afficher un message d'erreur générique
        const errorContainer = document.createElement('div');
        errorContainer.className = 'alert alert-danger mt-3';
        errorContainer.innerHTML = `
            <h4 class="alert-heading">Erreur lors du chargement</h4>
            <p>Une erreur s'est produite lors du chargement de la page. Veuillez réessayer ou contacter l'administrateur.</p>
            <hr>
            <p class="mb-0">Détails techniques: ${error.message}</p>
        `;
        
        // Insérer le message d'erreur au début du contenu principal
        const mainContent = document.querySelector('.content');
        if (mainContent && mainContent.firstChild) {
            mainContent.insertBefore(errorContainer, mainContent.firstChild);
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
            const routerNameElement = document.getElementById('routerName');
            if (routerNameElement) routerNameElement.textContent = router.name;
            document.title = `${router.name} - Tableau de bord - FastNetLite`;
            
            // Mettre à jour le lien vers la page d'achat
            const buyPageLinkElement = document.getElementById('buyPageLink');
            if (buyPageLinkElement) buyPageLinkElement.href = `buy-code.html?id=${routerId}`;
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
 * Charger les statistiques
 * @param {string} routerId - ID du routeur
 */
async function loadStatistics(routerId) {
    try {
        // Afficher les indicateurs de chargement
        document.getElementById('availableCodesCount').innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
        document.getElementById('soldCodesCount').innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
        document.getElementById('clientsCount').innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
        document.getElementById('revenueAmount').innerHTML = '<span class="spinner-border spinner-border-sm" role="status"></span>';
        
        // Fonction pour charger les statistiques avec gestion des erreurs d'index
        async function loadCollectionStats(collectionName, filters, countElement, defaultValue = '0', formatFunc = null) {
            try {
                const collectionRef = collection(db, collectionName);
                let queryRef = collectionRef;
                
                // Appliquer les filtres
                if (filters && filters.length > 0) {
                    queryRef = query(collectionRef, ...filters);
                }
                
                // Exécuter la requête
                const snapshot = await getDocs(queryRef);
                
                // Calculer la valeur
                let value = snapshot.size;
                if (formatFunc) {
                    value = formatFunc(snapshot);
                }
                
                // Mettre à jour l'élément
                if (typeof countElement === 'string') {
                    countElement = document.getElementById(countElement);
                }
                if (countElement) {
                    countElement.textContent = value;
                }
                
                return snapshot;
            } catch (error) {
                console.error(`Erreur lors de la récupération des statistiques pour ${collectionName}:`, error);
                
                // Vérifier si c'est une erreur d'index Firebase
                if (error.message && error.message.includes('index')) {
                    console.warn(`Erreur d'index Firebase pour ${collectionName}:`, error.message);
                    // Afficher un message d'erreur avec un lien pour créer l'index
                    const indexUrl = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)?.[0];
                    if (indexUrl) {
                        // Créer un petit indicateur d'erreur à côté de la valeur
                        if (typeof countElement === 'string') {
                            countElement = document.getElementById(countElement);
                        }
                        if (countElement) {
                            countElement.innerHTML = `${defaultValue} <a href="${indexUrl}" target="_blank" title="Créer l'index manquant" class="text-danger"><i class="fas fa-exclamation-circle"></i></a>`;
                        }
                    } else {
                        // Afficher simplement la valeur par défaut
                        if (typeof countElement === 'string') {
                            countElement = document.getElementById(countElement);
                        }
                        if (countElement) {
                            countElement.textContent = defaultValue;
                        }
                    }
                } else {
                    // Autre erreur, afficher la valeur par défaut
                    if (typeof countElement === 'string') {
                        countElement = document.getElementById(countElement);
                    }
                    if (countElement) {
                        countElement.textContent = defaultValue;
                    }
                }
                
                return null;
            }
        }
        
        // Charger les codes disponibles
        await loadCollectionStats(
            'wifiCodes',
            [
                where('routerId', '==', routerId),
                where('status', '==', 'available')
            ],
            'availableCodesCount'
        );
        
        // Charger les codes vendus
        await loadCollectionStats(
            'wifiCodes',
            [
                where('routerId', '==', routerId),
                where('status', '==', 'used')
            ],
            'soldCodesCount'
        );
        
        // Charger les clients
        await loadCollectionStats(
            'clients',
            [where('routerId', '==', routerId)],
            'clientsCount'
        );
        
        // Charger les revenus
        await loadCollectionStats(
            'payments',
            [
                where('routerId', '==', routerId),
                where('status', '==', 'completed')
            ],
            'revenueAmount',
            '0 FCFA',
            (snapshot) => {
                let totalRevenue = 0;
                snapshot.forEach((doc) => {
                    const payment = doc.data();
                    totalRevenue += payment.amount || 0;
                });
                return totalRevenue + ' FCFA';
            }
        );
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques:', error);
        
        // En cas d'erreur générale, afficher des valeurs par défaut
        document.getElementById('availableCodesCount').textContent = '0';
        document.getElementById('soldCodesCount').textContent = '0';
        document.getElementById('clientsCount').textContent = '0';
        document.getElementById('revenueAmount').textContent = '0 FCFA';
    }
}

/**
 * Charger les profils WiFi
 * @param {string} routerId - ID du routeur
 */
async function loadProfiles(routerId) {
    try {
        // Masquer les messages d'erreur précédents
        const errorElement = document.getElementById('profilesLoadError');
        if (errorElement) errorElement.classList.add('d-none');
        
        // Afficher le chargement
        const loadingElement = document.getElementById('loadingProfiles');
        if (loadingElement) loadingElement.classList.remove('d-none');
        
        // Vérifier si la collection profiles existe
        try {
            // Référence aux profils du routeur
            const profilesRef = collection(db, 'profiles');
            const profilesQuery = query(profilesRef, where('routerId', '==', routerId));
            
            // Récupérer les profils
            const querySnapshot = await getDocs(profilesQuery);
            
            // Masquer le chargement
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
            
            // Masquer le message "aucun profil"
            const noProfilesElement = document.getElementById('noProfiles');
            if (noProfilesElement) noProfilesElement.classList.add('d-none');
            
            // Ajouter chaque profil
            querySnapshot.forEach((doc) => {
                const profile = doc.data();
                const profileId = doc.id;
                
                // Créer une carte pour ce profil
                addProfileCard(profileId, profile, profilesList, routerId);
                
                // Ajouter le profil à la liste déroulante d'importation
                addProfileToImportSelect(profileId, profile);
            });
        } catch (indexError) {
            console.error('Erreur d\'index Firebase lors de la récupération des profils:', indexError);
            
            // Vérifier si c'est une erreur d'index Firebase
            if (indexError.message && indexError.message.includes('index')) {
                // Créer un lien pour créer l'index manquant
                const errorMessage = `Erreur d'index Firebase: ${indexError.message}`;
                console.error(errorMessage);
                
                // Afficher un message d'erreur avec un lien pour créer l'index
                if (errorElement) {
                    errorElement.innerHTML = `
                        <div class="alert alert-warning">
                            <p><strong>Erreur d'index Firebase:</strong> Un index est nécessaire pour cette requête.</p>
                            <p>Cliquez sur le lien ci-dessous pour créer l'index manquant:</p>
                            <a href="${indexError.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)?.[0] || '#'}" 
                               target="_blank" class="btn btn-sm btn-primary">
                                Créer l'index manquant
                            </a>
                        </div>
                    `;
                    errorElement.classList.remove('d-none');
                }
            } else {
                throw indexError; // Relancer l'erreur si ce n'est pas une erreur d'index
            }
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des profils:', error);
        
        // Masquer le chargement
        const loadingElement = document.getElementById('loadingProfiles');
        if (loadingElement) loadingElement.classList.add('d-none');
        
        // Afficher le message "aucun profil"
        const noProfilesElement = document.getElementById('noProfiles');
        if (noProfilesElement) noProfilesElement.classList.remove('d-none');
        
        // Afficher un message d'erreur générique
        const errorElement = document.getElementById('profilesLoadError');
        if (errorElement) {
            errorElement.innerHTML = `
                <div class="alert alert-danger">
                    <p><strong>Erreur:</strong> Impossible de charger les profils.</p>
                    <p>Détails: ${error.message}</p>
                </div>
            `;
            errorElement.classList.remove('d-none');
        }
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
        importBtn.addEventListener('click', function() {
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
    if (editBtn) editBtn.dataset.profileId = profileId;
    
    const viewCodesBtn = card.querySelector('.view-codes-btn');
    if (viewCodesBtn) viewCodesBtn.href = `wifi-codes.html?id=${routerId}&profile=${profileId}`;
    
    const deleteBtn = card.querySelector('.delete-profile-btn');
    if (deleteBtn) deleteBtn.dataset.profileId = profileId;
    
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
        // Vérifier si la collection wifiCodes existe et la créer si nécessaire
        try {
            const wifiCodesRef = collection(db, 'wifiCodes');
            const dummyCodeDoc = await addDoc(wifiCodesRef, {
                _dummy: true,
                routerId: routerId,
                profileId: profileId,
                status: 'available',
                createdAt: serverTimestamp()
            });
            await deleteDoc(dummyCodeDoc);
            console.log('Collection wifiCodes créée ou vérifiée avec succès');
        } catch (error) {
            console.error('Erreur lors de la vérification/création de la collection wifiCodes:', error);
        }
        
        // Récupérer le nombre de codes disponibles
        const wifiCodesRef = collection(db, 'wifiCodes');
        
        // Utiliser une approche manuelle pour éviter les problèmes d'index
        const wifiCodesQuery = query(wifiCodesRef);
        const snapshot = await getDocs(wifiCodesQuery);
        
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
        
        return count;
    } catch (error) {
        console.error('Erreur lors de la récupération du nombre de codes:', error);
        return 0;
    }
}

/**
 * Ajouter un profil à la liste déroulante d'importation
 * @param {string} profileId - ID du profil
 * @param {Object} profile - Données du profil
 */
function addProfileToImportSelect(profileId, profile) {
    const select = document.getElementById('importProfile');
    const option = document.createElement('option');
    option.value = profileId;
    option.textContent = `${profile.name} (${profile.duration} - ${profile.price} FCFA)`;
    select.appendChild(option);
}

/**
 * Charger les ventes récentes
 * @param {string} routerId - ID du routeur
 */
async function loadRecentSales(routerId) {
    try {
        // Référence aux paiements du routeur
        const paymentsCollection = collection(db, 'payments');
        const paymentsQuery = query(
            paymentsCollection,
            where('routerId', '==', routerId),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
        
        // Récupérer les paiements
        const querySnapshot = await getDocs(paymentsQuery);
        
        // Masquer le chargement
        const loadingElement = document.getElementById('loadingSales');
        if (loadingElement) loadingElement.classList.add('d-none');
        
        if (querySnapshot.empty) {
            // Aucune vente trouvée
            const noSalesElement = document.getElementById('noSalesMessage');
            if (noSalesElement) noSalesElement.classList.remove('d-none');
            return;
        }
        
        // Conteneur pour les ventes
        const recentSales = document.getElementById('recentSales');
        if (!recentSales) return;
        
        // Supprimer le message de chargement
        recentSales.innerHTML = '';
        
        // Ajouter chaque vente
        querySnapshot.forEach((doc) => {
            const payment = doc.data();
            const paymentId = doc.id;
            
            // Créer une ligne pour cette vente
            addSaleRow(paymentId, payment, recentSales);
        });
    } catch (error) {
        console.error('Erreur lors de la récupération des ventes récentes:', error);
        const loadingElement = document.getElementById('loadingSales');
        if (loadingElement) loadingElement.classList.add('d-none');
        
        const noSalesElement = document.getElementById('noSalesMessage');
        if (noSalesElement) noSalesElement.classList.remove('d-none');
    }
}

/**
 * Ajouter une ligne pour une vente
 * @param {string} paymentId - ID du paiement
 * @param {Object} payment - Données du paiement
 * @param {HTMLElement} container - Conteneur pour la ligne
 */
function addSaleRow(paymentId, payment, container) {
    // Créer une ligne
    const row = document.createElement('tr');
    
    // Formater la date
    const date = payment.createdAt ? new Date(payment.createdAt.toDate()) : new Date();
    const formattedDate = date.toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
    
    // Statut
    let statusClass = '';
    let statusText = '';
    switch (payment.status) {
        case 'completed':
            statusClass = 'bg-success';
            statusText = 'Complété';
            break;
        case 'pending':
            statusClass = 'bg-warning';
            statusText = 'En attente';
            break;
        case 'failed':
            statusClass = 'bg-danger';
            statusText = 'Échoué';
            break;
        default:
            statusClass = 'bg-secondary';
            statusText = payment.status;
    }
    
    // Remplir la ligne
    row.innerHTML = `
        <td>${formattedDate}</td>
        <td>${payment.clientName || 'Client inconnu'}</td>
        <td>${payment.profileName || 'Profil inconnu'}</td>
        <td><code>${payment.code || '-'}</code></td>
        <td>${payment.amount} FCFA</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
    `;
    
    // Ajouter la ligne au conteneur
    container.appendChild(row);
}

/**
 * Charger l'activité récente
 * @param {string} routerId - ID du routeur
 */
async function loadRecentActivity(routerId) {
    try {
        // Masquer le conteneur d'activité et afficher le loader
        const activityLoader = document.getElementById('activityLoader');
        const noActivityMessage = document.getElementById('noActivityMessage');
        const recentActivity = document.getElementById('recentActivity');
        
        if (activityLoader) activityLoader.classList.remove('d-none');
        if (noActivityMessage) noActivityMessage.classList.add('d-none');
        
        // Conteneur pour l'activité
        if (recentActivity) recentActivity.innerHTML = '';
        
        // Charger les activités récentes depuis Firestore
        // Nous allons combiner plusieurs collections pour créer un flux d'activité
        
        // Paiements récents
        const paymentsCollection = collection(db, 'payments');
        const paymentsQuery = query(
            paymentsCollection,
            where('routerId', '==', routerId),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
        
        // Clients récents
        const clientsCollection = collection(db, 'clients');
        const clientsQuery = query(
            clientsCollection,
            where('routerId', '==', routerId),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
        
        // Codes WiFi récemment importés
        const codesCollection = collection(db, 'wifiCodes');
        const codesQuery = query(
            codesCollection,
            where('routerId', '==', routerId),
            orderBy('createdAt', 'desc'),
            limit(5)
        );
        
        // Exécuter les requêtes
        const [paymentsSnapshot, clientsSnapshot, codesSnapshot] = await Promise.all([
            getDocs(paymentsQuery),
            getDocs(clientsQuery),
            getDocs(codesQuery)
        ]);
        
        // Masquer le loader
        const activityLoaderElement = document.getElementById('activityLoader');
        if (activityLoaderElement) activityLoaderElement.classList.add('d-none');
        
        // Créer un tableau combiné d'activités
        const activities = [];
        
        // Ajouter les paiements
        paymentsSnapshot.forEach(doc => {
            const payment = doc.data();
            activities.push({
                type: 'payment',
                title: 'Paiement reçu',
                time: payment.createdAt ? new Date(payment.createdAt.toDate()) : new Date(),
                badgeClass: 'bg-success',
                badgeText: `${payment.amount} FCFA`
            });
        });
        
        // Ajouter les clients
        clientsSnapshot.forEach(doc => {
            const client = doc.data();
            activities.push({
                type: 'client',
                title: 'Nouveau client enregistré',
                time: client.createdAt ? new Date(client.createdAt.toDate()) : new Date(),
                badgeClass: 'bg-primary',
                badgeText: 'Nouveau'
            });
        });
        
        // Ajouter les codes WiFi
        codesSnapshot.forEach(doc => {
            const code = doc.data();
            activities.push({
                type: 'code',
                title: 'Code WiFi importé',
                time: code.createdAt ? new Date(code.createdAt.toDate()) : new Date(),
                badgeClass: 'bg-warning',
                badgeText: code.profileName || 'Code'
            });
        });
        
        // Trier les activités par date (les plus récentes d'abord)
        activities.sort((a, b) => b.time - a.time);
        
        // Limiter à 10 activités
        const limitedActivities = activities.slice(0, 10);
        
        // Si aucune activité, afficher le message
        if (limitedActivities.length === 0) {
            const noActivityElement = document.getElementById('noActivityMessage');
            if (noActivityElement) noActivityElement.classList.remove('d-none');
            return;
        }
        
        // Ajouter les activités au conteneur
        const recentActivityElement = document.getElementById('recentActivity');
        if (recentActivityElement) {
            limitedActivities.forEach(activity => {
                const timeAgo = formatTimeAgo(activity.time);
                addActivityItem(recentActivityElement, activity.title, timeAgo, activity.badgeClass, activity.badgeText);
            });
        }
    } catch (error) {
        console.error('Erreur lors de la récupération des activités récentes:', error);
        const activityLoaderElement = document.getElementById('activityLoader');
        if (activityLoaderElement) activityLoaderElement.classList.add('d-none');
        
        const noActivityElement = document.getElementById('noActivityMessage');
        if (noActivityElement) noActivityElement.classList.remove('d-none');
    }
}

/**
 * Formater une date en "il y a X temps"
 * @param {Date} date - Date à formater
 * @returns {string} - Texte formaté (ex: "il y a 5 minutes")
 */
function formatTimeAgo(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHour = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHour / 24);
    const diffMonth = Math.floor(diffDay / 30);
    
    if (diffMonth > 0) {
        return diffMonth === 1 ? 'il y a 1 mois' : `il y a ${diffMonth} mois`;
    } else if (diffDay > 0) {
        return diffDay === 1 ? 'il y a 1 jour' : `il y a ${diffDay} jours`;
    } else if (diffHour > 0) {
        return diffHour === 1 ? 'il y a 1 heure' : `il y a ${diffHour} heures`;
    } else if (diffMin > 0) {
        return diffMin === 1 ? 'il y a 1 minute' : `il y a ${diffMin} minutes`;
    } else {
        return 'il y a quelques secondes';
    }
}

/**
 * Mettre à jour les liens de navigation avec l'ID du routeur
 * @param {string} routerId - ID du routeur
 */
function updateNavigationLinks(routerId) {
    try {
        // Utiliser la fonction utilitaire pour mettre à jour les liens de navigation standard
        // Utiliser la fonction utilitaire pour mettre à jour les liens de navigation du routeur
        if (window.routerUtils && typeof window.routerUtils.updateRouterNavigationLinks === 'function') {
            window.routerUtils.updateRouterNavigationLinks(routerId);
        } else {
            console.warn('La fonction updateRouterNavigationLinks n\'est pas disponible');
        }
        
        // Mettre à jour les liens spécifiques à cette page
        const routerBuyPageLink = document.getElementById('routerBuyPageLink');
        if (routerBuyPageLink) {
            routerBuyPageLink.href = `buy-code.html?id=${routerId}`;
            console.log(`Lien routerBuyPageLink mis à jour: buy-code.html?id=${routerId}`);
        }
        
        // Mettre à jour les liens de navigation mobile (bottom bar)
        const mobileLinks = {
            'routerDashboardLinkMobile': 'router-dashboard.html',
            'routerWifiCodesLinkMobile': 'wifi-codes.html',
            'routerClientsLinkMobile': 'clients.html',
            'routerPaymentsLinkMobile': 'payments.html',
            'routerSettingsLinkMobile': 'router-settings.html'
        };
        
        // Pour chaque lien mobile, mettre à jour l'attribut href
        Object.entries(mobileLinks).forEach(([id, url]) => {
            const link = document.getElementById(id);
            if (link) {
                link.href = `${url}?id=${routerId}`;
                console.log(`Lien mobile mis à jour: ${id} -> ${url}?id=${routerId}`);
            }
        });
        
        // Activer le lien correspondant à la page courante
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        // Parcourir tous les liens de navigation
        document.querySelectorAll('.router-nav .nav-link').forEach(link => {
            const href = link.getAttribute('href');
            if (!href) return;
            
            const targetPage = href.split('?')[0];
            
            if (currentPage === targetPage) {
                link.classList.add('active');
                console.log('Lien activé:', link.id || link.textContent);
            } else {
                link.classList.remove('active');
            }
        });
    } catch (error) {
        console.error('Erreur lors de la mise à jour des liens de navigation:', error);
    }
}

/**
 * Ajouter un élément d'activité
 * @param {HTMLElement} container - Conteneur pour l'activité
 * @param {string} title - Titre de l'activité
 * @param {string} time - Temps écoulé
 * @param {string} badgeClass - Classe CSS pour le badge
 * @param {string} badgeText - Texte du badge
 */
function addActivityItem(container, title, time, badgeClass, badgeText) {
    // Cloner le template
    const template = document.getElementById('activityItemTemplate');
    const item = document.importNode(template.content, true);
    
    // Remplir les données
    item.querySelector('.activity-title').textContent = title;
    item.querySelector('.activity-time').textContent = time;
    
    const badge = item.querySelector('.activity-badge');
    badge.classList.add(badgeClass);
    badge.textContent = badgeText;
    
    // Ajouter l'élément au conteneur
    container.appendChild(item);
}

// Variable globale pour stocker l'instance du graphique des ventes
let salesChartInstance = null;

/**
 * Initialiser le graphique des ventes
 * @param {string} routerId - ID du routeur
 */
function initSalesChart(routerId) {
    const canvas = document.getElementById('salesChart');
    if (!canvas) return;
    
    // Détruire l'instance existante du graphique si elle existe
    if (salesChartInstance) {
        salesChartInstance.destroy();
        salesChartInstance = null;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Créer un graphique vide qui sera rempli avec des données réelles
    const data = {
        labels: [],
        datasets: [{
            label: 'Ventes (FCFA)',
            data: [],
            backgroundColor: 'rgba(13, 110, 253, 0.2)',
            borderColor: 'rgba(13, 110, 253, 1)',
            borderWidth: 2,
            tension: 0.4
        }]
    };
    
    const config = {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    };
    
    // Créer une nouvelle instance du graphique et la stocker dans la variable globale
    salesChartInstance = new Chart(ctx, config);
    
    // Gestionnaire d'événement pour les boutons de période
    const periodButtons = document.querySelectorAll('.btn-group button[data-period]');
    if (periodButtons && periodButtons.length > 0) {
        periodButtons.forEach(button => {
            if (button) {
                button.addEventListener('click', function() {
                    // Mettre à jour le bouton actif
                    const allButtons = document.querySelectorAll('.btn-group button[data-period]');
                    if (allButtons && allButtons.length > 0) {
                        allButtons.forEach(btn => {
                            if (btn) btn.classList.remove('active');
                        });
                    }
                    this.classList.add('active');
                    
                    // Récupérer la période
                    const period = this.dataset.period;
                    
                    // Mettre à jour les données du graphique
                    if (salesChartInstance) {
                        updateChartData(salesChartInstance, period, routerId);
                    }
                });
            }
        });
    }
}

/**
 * Mettre à jour les données du graphique
 * @param {Chart} chart - Instance du graphique Chart.js
 * @param {string} period - Période (week, month, year)
 * @param {string} routerId - ID du routeur
 */
async function updateChartData(chart, period, routerId) {
    // Afficher un indicateur de chargement
    const chartLoader = document.getElementById('chartLoader');
    if (chartLoader) {
        chartLoader.classList.remove('d-none');
    }
    
    try {
        // Vérifier si l'instance du graphique existe
        if (!chart) {
            console.error('Erreur: Instance du graphique non disponible');
            return;
        }
        
        // Déterminer la date de début en fonction de la période
        const now = new Date();
        let startDate;
        let format;
        
        if (period === 'week') {
            // 7 derniers jours
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6); // -6 pour avoir 7 jours au total
            format = 'day';
        } else if (period === 'month') {
            // 30 derniers jours
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 29); // -29 pour avoir 30 jours au total
            format = 'week';
        } else if (period === 'year') {
            // 12 derniers mois
            startDate = new Date(now);
            startDate.setMonth(now.getMonth() - 11); // -11 pour avoir 12 mois au total
            format = 'month';
        }
        
        // Convertir les dates en timestamp Firestore
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(now);
    
        // Récupérer les paiements pour la période
        const paymentsCollection = collection(db, 'payments');
        const paymentsQuery = query(
            paymentsCollection,
            where('routerId', '==', routerId),
            where('status', '==', 'completed'), // Seulement les paiements complétés
            where('createdAt', '>=', startTimestamp),
            where('createdAt', '<=', endTimestamp),
            orderBy('createdAt', 'asc')
        );
        
        const snapshot = await getDocs(paymentsQuery);
        
        // Préparer les données pour le graphique
        let labels = [];
        let data = [];
        
        // Générer les labels en fonction de la période
        if (format === 'day') {
            // Labels pour les 7 derniers jours
            const days = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
            labels = days;
            data = Array(7).fill(0); // Initialiser les données à 0
        } else if (format === 'week') {
            // Labels pour les 4 semaines
            labels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
            data = Array(4).fill(0); // Initialiser les données à 0
        } else if (format === 'month') {
            // Labels pour les 12 mois
            const months = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
            labels = months;
            data = Array(12).fill(0); // Initialiser les données à 0
        }
        
        // Traiter les paiements
        snapshot.forEach((doc) => {
            const payment = doc.data();
            const amount = payment.amount || 0;
            const date = payment.createdAt.toDate();
            
            let index = 0;
            
            if (format === 'day') {
                // Calculer l'index pour les jours de la semaine (0-6)
                index = date.getDay() - 1; // Lundi = 0, Dimanche = 6
                if (index < 0) index = 6; // Ajuster pour Dimanche
            } else if (format === 'week') {
                // Calculer l'index pour les semaines du mois (0-3)
                const diffTime = Math.abs(date - startDate);
                const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                index = Math.min(Math.floor(diffDays / 7), 3);
            } else if (format === 'month') {
                // Utiliser le mois comme index (0-11)
                index = date.getMonth();
            }
            
            // Ajouter le montant au bon index
            if (index >= 0 && index < data.length) {
                data[index] += amount;
            }
        });
        
        // Mettre à jour le graphique
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update();
        
    } catch (error) {
        console.error('Erreur lors de la récupération des données de vente:', error);
        if (chartLoader) {
            chartLoader.classList.add('d-none');
        }
        
        // Afficher un message d'erreur ou des données par défaut
        let labels, data;
        
        switch (period) {
            case 'week':
                labels = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
                data = Array(7).fill(0);
                break;
            case 'month':
                labels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
                data = Array(4).fill(0);
                break;
            case 'year':
                labels = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Juin', 'Juil', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
                data = Array(12).fill(0);
                break;
        }
        
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update();
    }
}

// Cette fonction a été fusionnée avec celle définie plus haut dans le fichier

/**
 * Configurer les gestionnaires d'événements
 * @param {string} routerId - ID du routeur
 */
function setupEventHandlers(routerId) {
    // Bouton d'actualisation des statistiques
    const refreshStatsBtn = document.getElementById('refreshStatsBtn');
    if (refreshStatsBtn) {
        refreshStatsBtn.addEventListener('click', function() {
            // Recharger les statistiques
            loadStatistics(routerId);
            
            // Recharger les profils
            loadProfiles(routerId);
            
            // Recharger les ventes récentes
            loadRecentSales(routerId);
            
            // Recharger l'activité récente
            loadRecentActivity(routerId);
        });
    }
    
    // Délégation d'événements pour les boutons d'édition et de suppression des profils
    document.addEventListener('click', function(e) {
        // Bouton d'édition de profil
        if (e.target.closest('.edit-profile-btn')) {
            e.preventDefault();
            const profileId = e.target.closest('.edit-profile-btn').dataset.profileId;
            if (profileId) {
                // Rediriger vers la page des codes WiFi avec le profil sélectionné
                window.location.href = `wifi-codes.html?id=${routerId}&action=edit&profile=${profileId}`;
            }
        }
        
        // Bouton de suppression de profil
        if (e.target.closest('.delete-profile-btn')) {
            e.preventDefault();
            const profileId = e.target.closest('.delete-profile-btn').dataset.profileId;
            if (profileId) {
                if (confirm('Êtes-vous sûr de vouloir supprimer ce profil ? Cette action est irréversible.')) {
                    deleteProfile(profileId, routerId);
                }
            }
        }
    });
    
    // Boutons d'ajout de profil
    const addProfileBtns = document.querySelectorAll('#addProfileBtn, #addProfileBtnCard, #addProfileBtnEmpty');
    addProfileBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Afficher le modal d'ajout de profil
            const modal = new bootstrap.Modal(document.getElementById('addProfileModal'));
            modal.show();
        });
    });
    
    // Bouton d'importation de codes
    const importCodesBtns = document.querySelectorAll('#importCodesBtn');
    importCodesBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            // Afficher le modal d'importation de codes
            const modal = new bootstrap.Modal(document.getElementById('importCodesModal'));
            modal.show();
        });
    });
    
    // Bouton d'enregistrement du profil
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
            
            // Créer le profil dans Firestore
            try {
                const profilesCollection = collection(db, 'profiles');
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
                console.error('Erreur lors de la création du profil:', error);
                
                // Afficher l'erreur
                const errorElement = document.getElementById('profileFormError');
                errorElement.textContent = 'Erreur lors de la création du profil: ' + error.message;
                errorElement.classList.remove('d-none');
                
                // Masquer le spinner
                spinner.classList.add('d-none');
                saveProfileBtn.disabled = false;
            }
        });
    }
    
    // Gestionnaire pour le bouton de déconnexion
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', function(e) {
            e.preventDefault();
            // Simuler la déconnexion
            console.log('Déconnexion');
            window.location.href = 'index.html';
        });
    }
}
