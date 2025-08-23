// Import des fonctions Firebase nécessaires
import { onAuthStateChanged, signOut } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, deleteDoc, doc, updateDoc, writeBatch, runTransaction, serverTimestamp, orderBy, limit, startAfter, getDoc, setDoc } from "firebase/firestore";
import './src/index';
import { validateData, sanitizeData } from './src/validation.js';
import { initializeCollections, checkAndCreateCollection, handleFirebaseError, displayIndexError } from './src/db-utils.js';
import { checkAndShowLicenseModal } from './license-modal.js';

// Obtenir les instances des services Firebase
// Importer les instances Firebase déjà initialisées depuis firebase-config.js
import { auth, db } from './firebase-config.js';

// Variable pour éviter les appels multiples à loadRouters
let isLoadingRouters = false;

// Variable globale pour éviter les initialisations multiples
window.routersJsInitialized = window.routersJsInitialized || false;

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

/**
 * Configure les boutons "Ajouter un routeur" pour vérifier la licence avant d'afficher le modal
 * @param {string} userId - ID de l'utilisateur
 */
function setupAddRouterButtons(userId) {
    // Sélectionner tous les boutons qui ouvrent le modal d'ajout de routeur
    const addRouterButtons = document.querySelectorAll('[data-bs-toggle="modal"][data-bs-target="#addRouterModal"]');
    
    addRouterButtons.forEach(button => {
        // Supprimer les attributs qui déclenchent automatiquement le modal Bootstrap
        const modalTarget = button.getAttribute('data-bs-target');
        button.removeAttribute('data-bs-toggle');
        button.removeAttribute('data-bs-target');
        
        // Ajouter un gestionnaire d'événement personnalisé
        button.addEventListener('click', async function(e) {
            e.preventDefault();
            console.log('Clic sur le bouton d\'ajout de routeur');
            
            try {
                // Vérifier si l'utilisateur a besoin d'activer une licence
                const needsLicense = await import('./license-utils.js')
                    .then(module => module.needsLicenseActivation(userId));
                
                if (needsLicense) {
                    // L'utilisateur n'a pas de licence active, afficher le modal de licence
                    console.log('Licence requise pour ajouter un routeur');
                    await import('./license-modal.js')
                        .then(module => module.checkAndShowLicenseModal());
                } else {
                    // L'utilisateur a une licence active, afficher le modal d'ajout de routeur
                    console.log('Licence active, affichage du modal d\'ajout de routeur');
                    const addRouterModal = document.querySelector(modalTarget);
                    if (addRouterModal && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
                        const modal = new bootstrap.Modal(addRouterModal);
                        modal.show();
                    }
                }
            } catch (error) {
                console.error('Erreur lors de la vérification de la licence:', error);
                // En cas d'erreur, afficher le modal de licence par précaution
                await import('./license-modal.js')
                    .then(module => module.checkAndShowLicenseModal());
            }
        });
    });
}

document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si le script a déjà été initialisé
    if (window.routersJsInitialized) {
        console.log('routers.js déjà initialisé, initialisation ignorée');
        return;
    }
    
    // Marquer le script comme initialisé
    window.routersJsInitialized = true;
    console.log('Initialisation de routers.js');
    
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
            
            // Charger les routeurs de l'utilisateur (une seule fois)
            loadRouters(user.uid);
            
            // Configurer les boutons "Ajouter un routeur" pour vérifier la licence
            setupAddRouterButtons(user.uid);
            
            // Configurer les autres gestionnaires d'événements
            setupEventHandlers(user.uid);
            
            // Gestionnaire pour le formulaire d'ajout de routeur
            const addRouterForm = document.getElementById('addRouterForm');
            const saveRouterBtn = document.getElementById('saveRouterBtn');

            if (addRouterForm && saveRouterBtn) {
                console.log('Formulaire et bouton d\'ajout de routeur trouvés');

                // Utiliser une fonction nommée pour pouvoir la supprimer plus tard si nécessaire
                const handleAddRouterSubmit = async function(e) {
                    e.preventDefault();
                    console.log('Soumission du formulaire d\'ajout de routeur');
                    
                    // Vérifier si l'utilisateur a une licence active avant d'ajouter un routeur
                    const hasLicense = await checkAndShowLicenseModal();
                    if (hasLicense) {
                        // Si le modal de licence est affiché, arrêter l'exécution
                        return;
                    }
                    
                    // Récupérer les valeurs du formulaire
                    const name = document.getElementById('routerName').value.trim();
                    const description = document.getElementById('routerDescription').value.trim();
                    const fedapayApiKey = document.getElementById('fedapayApiKey').value.trim();
                    const testMode = document.getElementById('testMode').checked;
                    
                    // Validation basique
                    if (!name) {
                        const errorElement = document.getElementById('routerFormError');
                        errorElement.textContent = 'Le nom du WifiZone est obligatoire';
                        errorElement.classList.remove('d-none');
                        return;
                    }
                    
                    // Préparer les données du routeur
                    const routerData = {
                        name: name,
                        description: description,
                        fedapayApiKey: fedapayApiKey,
                        testMode: testMode,
                        userId: user.uid,
                        status: 'active',
                        createdAt: new Date().toISOString(),
                        updatedAt: new Date().toISOString()
                    };
                    
                    // Afficher le spinner
                    const spinner = document.getElementById('saveRouterSpinner');
                    if (spinner) {
                        spinner.classList.remove('d-none');
                    }
                    
                    // Désactiver le bouton
                    const saveRouterBtn = document.getElementById('saveRouterBtn');
                    if (saveRouterBtn) {
                        saveRouterBtn.disabled = true;
                    }
                    
                    try {
                        // Créer le routeur dans Firestore
                        const docRef = await addDoc(collection(db, 'routers'), routerData);
                        console.log('Routeur ajouté avec ID:', docRef.id);
                        
                        // Afficher un message de succès
                        showSuccess('Le routeur a été ajouté avec succès');
                        
                        // Fermer le modal
                        try {
                            const modalElement = document.getElementById('addRouterModal');
                            const modal = bootstrap.Modal.getInstance(modalElement);
                            if (modal) {
                                modal.hide();
                            } else {
                                // Si l'instance n'existe pas, créer une nouvelle instance et la fermer
                                const newModal = new bootstrap.Modal(modalElement);
                                newModal.hide();
                            }
                        } catch (modalError) {
                            console.error('Erreur lors de la fermeture du modal:', modalError);
                            // Fallback : fermer le modal en utilisant jQuery si disponible
                            if (typeof $ !== 'undefined') {
                                $('#addRouterModal').modal('hide');
                            }
                        }
                        
                        // Réinitialiser le formulaire
                        addRouterForm.reset();
                        document.getElementById('routerFormError').classList.add('d-none');
                        
                        // Ajouter le nouveau routeur à la liste sans recharger toute la page
                        addNewRouterToList(docRef.id, routerData);
                    } catch (error) {
                        console.error('Erreur lors de l\'ajout du routeur:', error);
                        
                        // Afficher l'erreur
                        const errorElement = document.getElementById('routerFormError');
                        errorElement.textContent = 'Erreur lors de l\'ajout du routeur: ' + error.message;
                        errorElement.classList.remove('d-none');
                    } finally {
                        // Masquer le spinner
                        const spinner = document.getElementById('saveRouterSpinner');
                        if (spinner) {
                            spinner.classList.add('d-none');
                        }
                        
                        // Réactiver le bouton
                        const saveRouterBtn = document.getElementById('saveRouterBtn');
                        if (saveRouterBtn) {
                            saveRouterBtn.disabled = false;
                        }
                    }
                };

                // Nettoyer les anciens écouteurs avant d'en ajouter de nouveaux
                // pour éviter les soumissions multiples.
                // On attache l'événement au formulaire, déclenché par le bouton.
                addRouterForm.removeEventListener('submit', window.handleAddRouterSubmit);
                window.handleAddRouterSubmit = handleAddRouterSubmit; // Stocker la référence globalement
                addRouterForm.addEventListener('submit', window.handleAddRouterSubmit);

                // Le bouton déclenche simplement la soumission du formulaire
                // (son type="submit" dans le HTML s'en charge). S'il est de type="button",
                // on ajoute un click listener.
                if (saveRouterBtn.type === 'button') {
                    saveRouterBtn.onclick = () => addRouterForm.requestSubmit();
                }
            }
        } else {
            // Utilisateur non connecté, rediriger vers la page de connexion
            window.location.href = 'index.html';
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
});

/**
 * Charger les routeurs de l'utilisateur avec pagination
 * @param {string} userId - ID de l'utilisateur connecté
 * @param {number} page - Numéro de page (commence à 1)
 * @param {number} limit - Nombre de routeurs par page
 * @param {string} lastDocId - ID du dernier document de la page précédente (pour la pagination)
 */
async function loadRouters(userId, page = 1, limit = 10, lastDocId = null) {
    // Éviter les appels multiples simultanés
    if (isLoadingRouters) {
        console.log('Chargement des routeurs déjà en cours, opération annulée');
        return;
    }
    
    // Marquer le début du chargement
    isLoadingRouters = true;
    
    console.log('Chargement des routeurs pour l\'utilisateur:', userId);
    
    try {
        // Afficher l'indicateur de chargement
        const loadingElement = document.getElementById('loadingRouters');
        if (loadingElement) {
            loadingElement.classList.remove('d-none');
        }
        
        // Masquer le message "aucun routeur"
        const noRoutersElement = document.getElementById('noRouters');
        if (noRoutersElement) {
            noRoutersElement.classList.add('d-none');
        }
        
        // Vérifier si l'utilisateur est défini
        if (!userId) {
            console.error('ID utilisateur non défini');
            if (noRoutersElement) {
                noRoutersElement.classList.remove('d-none');
            }
            if (loadingElement) {
                loadingElement.classList.add('d-none');
            }
            isLoadingRouters = false;
            return;
        }
        
        // Vérifier et créer la collection des routeurs si nécessaire
        console.log('Vérification et création des collections nécessaires...');
        await initializeCollections(userId);
        
        // Récupérer les routeurs de l'utilisateur
        const routersRef = collection(db, 'routers');
        let querySnapshot;
        
        try {
            // Essayer d'abord avec un tri par nom
            console.log('Tentative de récupération des routeurs avec tri...');
            const qWithOrder = query(
                routersRef,
                where('userId', '==', userId),
                orderBy('name', 'asc')
            );
            
            querySnapshot = await getDocs(qWithOrder);
            console.log('Routeurs récupérés avec tri par nom');
        } catch (indexError) {
            // Traiter l'erreur d'index avec notre utilitaire
            const errorInfo = handleFirebaseError(indexError);
            
            if (errorInfo.isIndexError) {
                console.warn('Erreur d\'index lors de la requête avec tri, utilisation d\'une requête simple');
                
                // Afficher un message d'erreur d'index dans le DOM
                const routersList = document.getElementById('routersList');
                if (routersList) {
                    // Ajouter un conteneur pour l'erreur s'il n'existe pas
                    let errorContainer = document.getElementById('routersIndexError');
                    if (!errorContainer) {
                        errorContainer = document.createElement('div');
                        errorContainer.id = 'routersIndexError';
                        routersList.parentNode.insertBefore(errorContainer, routersList);
                    }
                    
                    // Afficher le message d'erreur
                    displayIndexError('routersIndexError', errorInfo);
                }
                
                // Utiliser une requête plus simple sans tri
                console.log('Tentative de récupération des routeurs sans tri...');
                const qSimple = query(
                    routersRef,
                    where('userId', '==', userId)
                );
                
                querySnapshot = await getDocs(qSimple);
                console.log('Routeurs récupérés sans tri');
            } else {
                // Si ce n'est pas une erreur d'index, propager l'erreur
                console.error('Erreur lors de la récupération des routeurs:', indexError);
                throw indexError;
            }
        }
        
        console.log('Nombre de routeurs trouvés:', querySnapshot.size);
        
        // Mettre à jour l'interface
        updateRoutersList(querySnapshot);
        
        // Masquer l'indicateur de chargement
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        // Afficher le message "aucun routeur" si nécessaire
        if (querySnapshot.size === 0 && noRoutersElement) {
            noRoutersElement.classList.remove('d-none');
            
            // Ajouter un bouton pour créer un routeur par défaut
            if (!document.getElementById('createDefaultRouterBtn')) {
                const createDefaultBtn = document.createElement('button');
                createDefaultBtn.id = 'createDefaultRouterBtn';
                createDefaultBtn.className = 'btn btn-primary mt-3';
                createDefaultBtn.textContent = 'Créer un routeur par défaut';
                createDefaultBtn.onclick = async () => {
                    await createDefaultRouter(userId);
                    location.reload(); // Recharger la page après création
                };
                
                // Ajouter le bouton au message
                noRoutersElement.appendChild(createDefaultBtn);
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement des routeurs:', error);
        showError('Erreur lors de la récupération des routeurs. Veuillez réessayer.');
        
        // Masquer l'indicateur de chargement
        const loadingElement = document.getElementById('loadingRouters');
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        // Afficher un message d'erreur plus détaillé dans la console
        const errorInfo = handleFirebaseError(error);
        if (errorInfo.isIndexError) {
            console.warn('Erreur d\'index détectée. Vous pouvez créer l\'index nécessaire en suivant le lien dans la console.');
            
            // Afficher un message d'erreur d'index dans le DOM
            const routersList = document.getElementById('routersList');
            if (routersList) {
                // Ajouter un conteneur pour l'erreur s'il n'existe pas
                let errorContainer = document.getElementById('routersIndexError');
                if (!errorContainer) {
                    errorContainer = document.createElement('div');
                    errorContainer.id = 'routersIndexError';
                    routersList.parentNode.insertBefore(errorContainer, routersList);
                }
                
                // Afficher le message d'erreur
                displayIndexError('routersIndexError', errorInfo);
            }
        }
    } finally {
        // Marquer la fin du chargement
        isLoadingRouters = false;
    }
}

/**
 * Mettre à jour la pagination des routeurs
 * @param {number} totalItems - Nombre total de routeurs
 * @param {number} currentPage - Page actuelle
 * @param {number} itemsPerPage - Nombre de routeurs par page
 * @param {string} userId - ID de l'utilisateur connecté
 * @param {string} lastDocId - ID du dernier document de la page actuelle
 */
function updateRoutersPagination(totalItems, currentPage, itemsPerPage, userId, lastDocId) {
    const paginationElement = document.getElementById('routersPagination');
    if (!paginationElement) return;
    
    // Calculer le nombre total de pages
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    
    // Vider l'élément de pagination
    paginationElement.innerHTML = '';
    
    // Si pas de pages, ne rien afficher
    if (totalPages <= 1) {
        paginationElement.classList.add('d-none');
        return;
    }
    
    // Afficher l'élément de pagination
    paginationElement.classList.remove('d-none');
    
    // Créer la structure de pagination
    const paginationList = document.createElement('ul');
    paginationList.className = 'pagination justify-content-center';
    
    // Bouton précédent
    const prevItem = document.createElement('li');
    prevItem.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
    
    const prevLink = document.createElement('a');
    prevLink.className = 'page-link';
    prevLink.href = '#';
    prevLink.innerHTML = '&laquo;';
    prevLink.setAttribute('aria-label', 'Précédent');
    
    if (currentPage > 1) {
        prevLink.addEventListener('click', function(e) {
            e.preventDefault();
            loadRouters(userId, currentPage - 1, itemsPerPage);
        });
    }
    
    prevItem.appendChild(prevLink);
    paginationList.appendChild(prevItem);
    
    // Déterminer les pages à afficher
    let startPage = Math.max(1, currentPage - 2);
    let endPage = Math.min(totalPages, startPage + 4);
    
    // Ajuster si on est proche de la fin
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
                loadRouters(userId, i, itemsPerPage, i > currentPage ? lastDocId : null);
            });
        }
        
        pageItem.appendChild(pageLink);
        paginationList.appendChild(pageItem);
    }
    
    // Bouton suivant
    const nextItem = document.createElement('li');
    nextItem.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    
    const nextLink = document.createElement('a');
    nextLink.className = 'page-link';
    nextLink.href = '#';
    nextLink.innerHTML = '&raquo;';
    nextLink.setAttribute('aria-label', 'Suivant');
    
    if (currentPage < totalPages) {
        nextLink.addEventListener('click', function(e) {
            e.preventDefault();
            loadRouters(userId, currentPage + 1, itemsPerPage, lastDocId);
        });
    }
    
    nextItem.appendChild(nextLink);
    paginationList.appendChild(nextItem);
    
    // Ajouter la liste à l'élément de pagination
    paginationElement.appendChild(paginationList);
}

/**
 * Mettre à jour la liste des routeurs dans l'interface
 * @param {Object} querySnapshot - Snapshot de la requête Firestore
 */
function updateRoutersList(querySnapshot) {
    // Conteneur pour les cartes de routeurs
    const routersList = document.getElementById('routersList');
    if (!routersList) {
        console.error('Conteneur routersList non trouvé');
        return;
    }
    
    // Supprimer le contenu existant
    routersList.innerHTML = '';
    
    // Ajouter chaque routeur
    querySnapshot.forEach((doc) => {
        const router = doc.data();
        const routerId = doc.id;
        
        // Créer une carte pour ce routeur
        addRouterCard(routerId, router, routersList);
    });
    
    // Masquer l'indicateur de chargement
    const loadingElement = document.getElementById('loadingRouters');
    if (loadingElement) {
        loadingElement.classList.add('d-none');
    }
}

/**
 * Ajouter une carte pour un routeur
 * @param {string} routerId - ID du routeur
 * @param {Object} router - Données du routeur
 * @param {HTMLElement} container - Conteneur pour la carte
 */
function addRouterCard(routerId, router, container) {
    // Vérifier si le template existe
    const template = document.getElementById('routerCardTemplate');
    if (!template) {
        console.error('Template de carte routeur non trouvé');
        return;
    }
    
    // Cloner le template de carte
    const card = document.importNode(template.content, true);
    
    // Remplir les données du routeur
    const nameElement = card.querySelector('.router-name');
    if (nameElement) {
        nameElement.textContent = router.name;
    }
    
    // Description (si disponible)
    const descriptionElement = card.querySelector('.router-description');
    if (descriptionElement) {
        if (router.description) {
            descriptionElement.textContent = router.description;
        } else {
            descriptionElement.textContent = 'Aucune description';
        }
    }
    
    // Statut
    const statusElement = card.querySelector('.router-status');
    if (statusElement) {
        if (router.status === 'inactive') {
            statusElement.textContent = 'Inactif';
            statusElement.classList.remove('bg-success');
            statusElement.classList.add('bg-secondary');
        }
    }
    
    // Liens
    const dashboardLink = card.querySelector('.router-dashboard-link');
    if (dashboardLink) dashboardLink.href = `router-dashboard.html?id=${routerId}`;
    
    const codesLink = card.querySelector('.router-codes-link');
    if (codesLink) codesLink.href = `wifi-codes.html?id=${routerId}`;
    
    const clientsLink = card.querySelector('.router-clients-link');
    if (clientsLink) clientsLink.href = `clients.html?id=${routerId}`;
    
    const paymentsLink = card.querySelector('.router-payments-link');
    if (paymentsLink) paymentsLink.href = `payments.html?id=${routerId}`;
    
    const settingsLink = card.querySelector('.router-settings-link');
    if (settingsLink) settingsLink.href = `router-settings.html?id=${routerId}`;
    
    // Bouton de suppression
    const deleteBtn = card.querySelector('.router-delete-btn');
    if (deleteBtn) {
        deleteBtn.dataset.routerId = routerId;
        deleteBtn.dataset.routerName = router.name;
    }
    
    // Récupérer les statistiques du routeur
    getRouterStats(routerId)
        .then((stats) => {
            const codesElement = card.querySelector('.router-codes');
            if (codesElement) codesElement.textContent = stats.availableCodes;
            
            const clientsElement = card.querySelector('.router-clients');
            if (clientsElement) clientsElement.textContent = stats.clients;
        });
    
    // Ajouter la carte au conteneur
    container.appendChild(card);
}

/**
 * Récupérer les statistiques d'un routeur
 * @param {string} routerId - ID du routeur
 * @returns {Promise<Object>} - Promesse contenant les statistiques du routeur
 */
async function getRouterStats(routerId) {
    console.log('Récupération des statistiques pour le routeur ID:', routerId);
    
    // Initialiser les statistiques par défaut
    const stats = {
        codesCount: 0,
        availableCodesCount: 0,
        clientsCount: 0,
        salesCount: 0,
        revenue: 0
    };
    
    try {
        // Vérifier et créer les collections nécessaires
        await Promise.all([
            checkAndCreateCollection('wifiCodes'),
            checkAndCreateCollection('clients'),
            checkAndCreateCollection('payments')
        ]);
        
        // 1. Nombre total de codes WiFi
        try {
            const allCodesSnapshot = await getDocs(query(
                collection(db, 'wifiCodes'),
                where('routerId', '==', routerId)
            ));
            stats.codesCount = allCodesSnapshot.size;
            console.log(`Nombre total de codes pour le routeur ${routerId}: ${stats.codesCount}`);
        } catch (error) {
            console.error('Erreur lors de la récupération du nombre total de codes:', error.message);
        }
        
        // 2. Nombre de codes disponibles
        try {
            const availableCodesSnapshot = await getDocs(query(
                collection(db, 'wifiCodes'),
                where('routerId', '==', routerId),
                where('status', '==', 'available')
            ));
            stats.availableCodesCount = availableCodesSnapshot.size;
            console.log(`Nombre de codes disponibles pour le routeur ${routerId}: ${stats.availableCodesCount}`);
        } catch (error) {
            console.error('Erreur lors de la récupération du nombre de codes disponibles:', error.message);
        }
        
        // 3. Nombre de clients
        try {
            const clientsSnapshot = await getDocs(query(
                collection(db, 'clients'),
                where('routerId', '==', routerId)
            ));
            stats.clientsCount = clientsSnapshot.size;
            console.log(`Nombre de clients pour le routeur ${routerId}: ${stats.clientsCount}`);
        } catch (error) {
            console.error('Erreur lors de la récupération du nombre de clients:', error.message);
        }
        
        // 4. Nombre de ventes et revenus
        try {
            const paymentsSnapshot = await getDocs(query(
                collection(db, 'payments'),
                where('routerId', '==', routerId),
                where('status', '==', 'completed')
            ));
            
            stats.salesCount = paymentsSnapshot.size;
            
            // Calculer les revenus totaux
            let totalRevenue = 0;
            paymentsSnapshot.forEach(doc => {
                const payment = doc.data();
                totalRevenue += payment.amount || 0;
            });
            stats.revenue = totalRevenue;
            
            console.log(`Nombre de ventes pour le routeur ${routerId}: ${stats.salesCount}, Revenus: ${stats.revenue}`);
        } catch (error) {
            console.error('Erreur lors de la récupération des ventes et revenus:', error.message);
        }
        
        console.log('Statistiques récupérées pour le routeur ID:', routerId, stats);
        return stats;
    } catch (error) {
        console.error('Erreur générale lors de la récupération des statistiques:', error.message);
        return stats; // Retourner les statistiques par défaut en cas d'erreur
    }
}

/**
 * Afficher un message d'erreur
 * @param {string} message - Message d'erreur à afficher
 */
function showError(message) {
    // Vérifier si l'élément d'alerte existe
    let alertElement = document.getElementById('errorAlert');
    
    // Créer l'élément s'il n'existe pas
    if (!alertElement) {
        alertElement = document.createElement('div');
        alertElement.id = 'errorAlert';
        alertElement.className = 'alert alert-danger alert-dismissible fade show';
        alertElement.setAttribute('role', 'alert');
        
        // Ajouter le bouton de fermeture
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'btn-close';
        closeButton.setAttribute('data-bs-dismiss', 'alert');
        closeButton.setAttribute('aria-label', 'Fermer');
        
        // Ajouter le contenu et le bouton à l'alerte
        alertElement.appendChild(closeButton);
        
        // Ajouter l'alerte au début de la page
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.insertBefore(alertElement, mainContent.firstChild);
        } else {
            document.body.insertBefore(alertElement, document.body.firstChild);
        }
    }
    
    // Mettre à jour le message
    alertElement.textContent = message;
    
    // Afficher l'alerte
    alertElement.classList.remove('d-none');
    
    // Faire défiler jusqu'à l'alerte
    alertElement.scrollIntoView({ behavior: 'smooth' });
    
    // Masquer l'alerte après 5 secondes
    setTimeout(() => {
        alertElement.classList.add('d-none');
    }, 5000);
}

/**
 * Créer un routeur par défaut pour l'utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<string>} - ID du routeur créé
 */
async function createDefaultRouter(userId) {
    console.log('Création d\'un routeur par défaut pour l\'utilisateur:', userId);
    
    try {
        // Vérifier que la collection routers existe
        await checkAndCreateCollection('routers');
        
        // Créer un document pour le routeur par défaut
        const routersRef = collection(db, 'routers');
        const newRouterRef = doc(routersRef); // Générer un ID automatiquement
        
        const routerData = {
            userId: userId,
            name: 'Mon Premier Routeur',
            description: 'Routeur créé automatiquement',
            status: 'active',
            address: '',
            fedapayApiKey: '',
            testMode: true,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        await setDoc(newRouterRef, routerData);
        console.log('Routeur par défaut créé avec succès, ID:', newRouterRef.id);
        
        // Initialiser les collections pour ce routeur
        await initializeCollections(userId, newRouterRef.id);
        
        // Afficher un message de succès
        showSuccess('Un routeur par défaut a été créé avec succès');
        
        return newRouterRef.id;
    } catch (error) {
        console.error('Erreur lors de la création du routeur par défaut:', error);
        showError('Erreur lors de la création du routeur par défaut: ' + error.message);
        throw error;
    }
}

/**
 * Ajouter un nouveau routeur à la liste sans recharger tous les routeurs
 * @param {string} routerId - ID du nouveau routeur
 * @param {Object} routerData - Données du nouveau routeur
 */
function addNewRouterToList(routerId, routerData) {
    // Masquer le message "aucun routeur" s'il est affiché
    const noRoutersElement = document.getElementById('noRouters');
    if (noRoutersElement) {
        noRoutersElement.classList.add('d-none');
    }
    
    // Conteneur pour les cartes de routeurs
    const routersList = document.getElementById('routersList');
    if (!routersList) {
        console.error('Conteneur routersList non trouvé');
        return;
    }
    
    // Ajouter la carte du nouveau routeur
    addRouterCard(routerId, routerData, routersList);
}

/**
 * Afficher un message de succès
 * @param {string} message - Message de succès à afficher
 */
function showSuccess(message) {
    // Vérifier si l'élément d'alerte existe
    let alertElement = document.getElementById('successAlert');
    
    // Créer l'élément s'il n'existe pas
    if (!alertElement) {
        alertElement = document.createElement('div');
        alertElement.id = 'successAlert';
        alertElement.className = 'alert alert-success alert-dismissible fade show';
        alertElement.setAttribute('role', 'alert');
        
        // Ajouter le bouton de fermeture
        const closeButton = document.createElement('button');
        closeButton.type = 'button';
        closeButton.className = 'btn-close';
        closeButton.setAttribute('data-bs-dismiss', 'alert');
        closeButton.setAttribute('aria-label', 'Fermer');
        
        // Ajouter le contenu et le bouton à l'alerte
        alertElement.appendChild(closeButton);
        
        // Ajouter l'alerte au début de la page
        const mainContent = document.querySelector('main');
        if (mainContent) {
            mainContent.insertBefore(alertElement, mainContent.firstChild);
        } else {
            document.body.insertBefore(alertElement, document.body.firstChild);
        }
    }
    
    // Mettre à jour le message
    alertElement.textContent = message;
    
    // Afficher l'alerte
    alertElement.classList.remove('d-none');
    
    // Faire défiler jusqu'à l'alerte
    alertElement.scrollIntoView({ behavior: 'smooth' });
    
    // Masquer l'alerte après 5 secondes
    setTimeout(() => {
        alertElement.classList.add('d-none');
    }, 5000);
}

/**
 * Supprimer un routeur et toutes ses données associées (profils, codes WiFi, clients, paiements)
 * @param {string} routerId - ID du routeur à supprimer
 * @returns {Promise} - Promesse résolue lorsque toutes les données sont supprimées
 */
async function deleteRouterWithRelatedData(routerId) {
    // Créer un nouveau lot d'écritures
    const batch = writeBatch(db);
    
    try {
        // 1. Récupérer tous les profils associés au routeur
        const profilesSnapshot = await getDocs(
            query(collection(db, 'profiles'), where('routerId', '==', routerId))
        );
        
        // 2. Récupérer tous les codes WiFi associés au routeur
        const codesSnapshot = await getDocs(
            query(collection(db, 'wifiCodes'), where('routerId', '==', routerId))
        );
        
        // 3. Récupérer tous les clients associés au routeur
        const clientsSnapshot = await getDocs(
            query(collection(db, 'clients'), where('routerId', '==', routerId))
        );
        
        // 4. Récupérer tous les paiements associés au routeur
        const paymentsSnapshot = await getDocs(
            query(collection(db, 'payments'), where('routerId', '==', routerId))
        );
        
        // 5. Supprimer les statistiques du routeur si elles existent
        const statsRef = doc(db, 'routerStats', routerId);
        batch.delete(statsRef);
        
        // 6. Ajouter toutes les suppressions au lot
        
        // Supprimer les profils
        profilesSnapshot.forEach(profileDoc => {
            batch.delete(profileDoc.ref);
        });
        
        // Supprimer les codes WiFi
        codesSnapshot.forEach(codeDoc => {
            batch.delete(codeDoc.ref);
        });
        
        // Supprimer les clients
        clientsSnapshot.forEach(clientDoc => {
            batch.delete(clientDoc.ref);
        });
        
        // Supprimer les paiements
        paymentsSnapshot.forEach(paymentDoc => {
            batch.delete(paymentDoc.ref);
        });
        
        // Supprimer le routeur lui-même
        const routerRef = doc(db, 'routers', routerId);
        batch.delete(routerRef);
        
        // 7. Exécuter le lot de suppressions
        await batch.commit();
        
        console.log(`Routeur ${routerId} et ${profilesSnapshot.size + codesSnapshot.size + clientsSnapshot.size + paymentsSnapshot.size} documents associés supprimés avec succès`);
        return true;
    } catch (error) {
        console.error('Erreur lors de la suppression du routeur et de ses données associées:', error);
        throw error;
    }
}

/**
 * Configurer les gestionnaires d'événements
 * @param {string} userId - ID de l'utilisateur connecté
 */
function setupEventHandlers(userId) {
    
    // Gestionnaire pour les boutons de suppression de routeur
    document.addEventListener('click', function(e) {
        if (e.target.classList.contains('router-delete-btn') || e.target.closest('.router-delete-btn')) {
            e.preventDefault();
            
            // Récupérer l'élément cliqué
            const deleteBtn = e.target.classList.contains('router-delete-btn') ? 
                              e.target : 
                              e.target.closest('.router-delete-btn');
            
            // Récupérer l'ID et le nom du routeur
            const routerId = deleteBtn.dataset.routerId;
            const routerName = deleteBtn.dataset.routerName;
            
            // Configurer le modal de confirmation
            const confirmBtn = document.getElementById('confirmDeleteRouterBtn');
            confirmBtn.dataset.routerId = routerId;
            
            // Afficher le modal de confirmation
            const deleteModal = new bootstrap.Modal(document.getElementById('deleteRouterModal'));
            deleteModal.show();
        }
    });
    
    // Gestionnaire pour le bouton de confirmation de suppression
    const confirmDeleteRouterBtn = document.getElementById('confirmDeleteRouterBtn');
    if (confirmDeleteRouterBtn) {
        confirmDeleteRouterBtn.addEventListener('click', function() {
            // Récupérer l'ID du routeur
            const routerId = this.dataset.routerId;
            
            // Afficher le spinner
            const spinner = document.getElementById('deleteRouterSpinner');
            spinner.classList.remove('d-none');
            confirmDeleteRouterBtn.disabled = true;
            
            // Supprimer le routeur et toutes ses données associées avec une transaction par lots
            deleteRouterWithRelatedData(routerId)
                .then(() => {
                    console.log('Routeur et données associées supprimés avec succès');
                    
                    // Fermer le modal
                    const modal = bootstrap.Modal.getInstance(document.getElementById('deleteRouterModal'));
                    modal.hide();
                    
                    // Recharger la liste des routeurs
                    loadRouters(userId);
                })
                .catch((error) => {
                    console.error('Erreur lors de la suppression du routeur:', error);
                    alert('Erreur lors de la suppression du routeur: ' + error.message);
                })
                .finally(() => {
                    // Masquer le spinner
                    spinner.classList.add('d-none');
                    confirmDeleteRouterBtn.disabled = false;
                });
        });
    }
    
    // Réinitialiser le formulaire lors de l'ouverture du modal
    const addRouterModal = document.getElementById('addRouterModal');
    if (addRouterModal) {
        addRouterModal.addEventListener('show.bs.modal', function() {
            document.getElementById('addRouterForm').reset();
            document.getElementById('routerFormError').classList.add('d-none');
        });
    }
}
