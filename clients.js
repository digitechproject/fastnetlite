// Import des fonctions Firebase v9
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
    serverTimestamp,
    Timestamp
} from "firebase/firestore";
import './src/index';

// Importer les fonctions depuis payments.js
import { setupEventHandlers, updateNavigationLinks } from "./payments.js";

// Obtenir les instances des services Firebase
const auth = getAuth();
const db = getFirestore();

// Script pour la gestion des clients FastNetLite

// Variable globale pour éviter les initialisations multiples
window.clientsJsInitialized = window.clientsJsInitialized || false;

document.addEventListener('DOMContentLoaded', function() {
    // Vérifier si le script a déjà été initialisé
    if (window.clientsJsInitialized) {
        console.log('clients.js déjà initialisé, initialisation ignorée');
        return;
    }
    
    // Marquer le script comme initialisé
    window.clientsJsInitialized = true;
    console.log('Initialisation de clients.js');
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
            
            // Initialiser la page
            initPage(routerId);
            
            // Configurer les gestionnaires d'événements
            setupEventHandlers(routerId);
            
            // Mettre à jour les liens de navigation
            updateNavigationLinks(routerId);
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
            signOut(auth)
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
 */
async function initPage(routerId) {
    // Vérifier si les collections nécessaires existent et les créer si besoin
    await checkAndCreateCollections(routerId);
    
    // Charger les informations du routeur
    loadRouterInfo(routerId);
    
    // Charger les statistiques des clients
    loadClientStatistics(routerId);
    
    // Charger la liste des clients
    loadClientsList(routerId);
    
    // Initialiser les gestionnaires d'événements et mettre à jour les liens de navigation
    // Cette fonction appellera updateNavigationLinks et configurera les gestionnaires spécifiques
    initClientEventHandlers(routerId);
}

/**
 * Vérifier et créer les collections nécessaires si elles n'existent pas
 * @param {string} routerId - ID du routeur
 */
async function checkAndCreateCollections(routerId) {
    try {
        console.log('Vérification et création des collections nécessaires...');
        
        // Vérifier/créer la collection clients
        try {
            const clientsCollection = collection(db, 'clients');
            const dummyClientDoc = await addDoc(clientsCollection, {
                _dummy: true,
                routerId: routerId,
                name: 'Dummy Client',
                createdAt: serverTimestamp()
            });
            await deleteDoc(dummyClientDoc);
            console.log('Collection clients créée ou vérifiée avec succès');
        } catch (error) {
            console.error('Erreur lors de la vérification/création de la collection clients:', error);
        }
        
        // Vérifier/créer la collection payments
        try {
            const paymentsCollection = collection(db, 'payments');
            const dummyPaymentDoc = await addDoc(paymentsCollection, {
                _dummy: true,
                routerId: routerId,
                amount: 0,
                createdAt: serverTimestamp()
            });
            await deleteDoc(dummyPaymentDoc);
            console.log('Collection payments créée ou vérifiée avec succès');
        } catch (error) {
            console.error('Erreur lors de la vérification/création de la collection payments:', error);
        }
        
        // Vérifier/créer la collection profiles pour le routeur
        try {
            const profilesCollection = collection(db, 'routers', routerId, 'profiles');
            const dummyProfileDoc = await addDoc(profilesCollection, {
                _dummy: true,
                name: 'Dummy Profile',
                createdAt: serverTimestamp()
            });
            await deleteDoc(dummyProfileDoc);
            console.log('Collection profiles créée ou vérifiée avec succès');
        } catch (error) {
            console.error('Erreur lors de la vérification/création de la collection profiles:', error);
        }
    } catch (error) {
        console.error('Erreur lors de la vérification des collections:', error);
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
            
            // Mettre à jour le fil d'Ariane
            document.getElementById('routerBreadcrumb').textContent = router.name;
            document.getElementById('routerBreadcrumb').href = `router-dashboard.html?id=${routerId}`;
            
            // Mettre à jour le titre de la page
            document.title = `Clients - ${router.name} - FastNetLite`;
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
 * Charger les statistiques des clients
 * @param {string} routerId - ID du routeur
 */
async function loadClientStatistics(routerId) {
    try {
        // Total des clients
        const clientsCollection = collection(db, 'clients');
        const clientsQuery = query(clientsCollection, where('routerId', '==', routerId));
        const snapshot = await getDocs(clientsQuery);
        
        const totalClients = snapshot.size;
        const totalClientsElement = document.getElementById('totalClients');
        if (totalClientsElement) totalClientsElement.textContent = totalClients;
        
        // Si aucun client, afficher le message
        const loadingClientsElement = document.getElementById('loadingClients');
        const noClientsMessageElement = document.getElementById('noClientsMessage');
        
        if (totalClients === 0) {
            if (loadingClientsElement) loadingClientsElement.classList.add('d-none');
            if (noClientsMessageElement) noClientsMessageElement.classList.remove('d-none');
        } else {
            if (loadingClientsElement) loadingClientsElement.classList.add('d-none');
            if (noClientsMessageElement) noClientsMessageElement.classList.add('d-none');
        }
        
        // Clients actifs (qui ont acheté un code dans les 30 derniers jours)
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        
        // Convertir en Timestamp Firestore
        const thirtyDaysAgoTimestamp = Timestamp.fromDate(thirtyDaysAgo);
        
        // Récupérer tous les paiements et filtrer manuellement
        // pour éviter les problèmes d'index
        const paymentsCollection = collection(db, 'payments');
        const paymentsQuery = query(paymentsCollection);
        
        const paymentsSnapshot = await getDocs(paymentsQuery);
        
        // Filtrer manuellement les paiements des 30 derniers jours
        // Extraire les IDs de clients uniques
        const activeClientIds = new Set();
        paymentsSnapshot.forEach(doc => {
            const payment = doc.data();
            if (payment.routerId === routerId && payment.clientId && payment.createdAt && 
                payment.createdAt.toDate() >= thirtyDaysAgo) {
                activeClientIds.add(payment.clientId);
            }
        });
        
        const activeClientsElement = document.getElementById('activeClients');
        if (activeClientsElement) activeClientsElement.textContent = activeClientIds.size;
        
        // Nouveaux clients (inscrits dans les 7 derniers jours)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        
        // Convertir en Timestamp Firestore
        const sevenDaysAgoTimestamp = Timestamp.fromDate(sevenDaysAgo);
        
        // Filtrer manuellement les clients inscrits dans les 7 derniers jours
        const newClientsCount = snapshot.docs.filter(doc => {
            const client = doc.data();
            return client.createdAt && client.createdAt.toDate() >= sevenDaysAgo;
        }).length;
        
        const newClientsElement = document.getElementById('newClients');
        if (newClientsElement) newClientsElement.textContent = newClientsCount;
        
        // Revenu moyen par client
        let totalRevenue = 0;
        paymentsSnapshot.forEach(doc => {
            const payment = doc.data();
            if (payment.routerId === routerId && payment.amount) {
                totalRevenue += payment.amount;
            }
        });
        
        const averageRevenue = totalClients > 0 ? Math.round(totalRevenue / totalClients) : 0;
        const averageRevenueElement = document.getElementById('averageRevenue');
        if (averageRevenueElement) averageRevenueElement.textContent = averageRevenue.toLocaleString('fr-FR') + ' FCFA';
        
    } catch (error) {
        console.error('Erreur lors du chargement des statistiques clients:', error);
        
        // Afficher des valeurs par défaut
        const elements = ['totalClients', 'activeClients', 'newClients', 'averageRevenue'];
        elements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = id === 'averageRevenue' ? '0 FCFA' : '0';
            }
        });
    }
}

/**
 * Charger la liste des clients
 * @param {string} routerId - ID du routeur
 * @param {number} page - Numéro de page (commence à 1)
 * @param {number} limit - Nombre de clients par page
 */
async function loadClientsList(routerId, page = 1, limit = 10) {
    try {
        console.log(`Chargement des clients pour le routeur ${routerId}, page ${page}, limite ${limit}`);
        
        // Vérifier les éléments DOM avant d'y accéder
        const loadingElement = document.getElementById('loadingClients');
        const noClientsElement = document.getElementById('noClientsMessage');
        
        if (loadingElement) {
            loadingElement.classList.remove('d-none');
        } else {
            console.warn("L'élément 'loadingClients' n'a pas été trouvé dans le DOM");
        }
        
        if (noClientsElement) {
            noClientsElement.classList.add('d-none');
        } else {
            console.warn("L'élément 'noClientsMessage' n'a pas été trouvé dans le DOM");
        }
        
        // Référence aux clients du routeur
        const clientsCollection = collection(db, 'clients');
        const clientsQuery = query(
            clientsCollection,
            where('routerId', '==', routerId),
            orderBy('createdAt', 'desc')
        );
        
        // Récupérer les clients
        const querySnapshot = await getDocs(clientsQuery);
        console.log(`${querySnapshot.size} clients trouvés pour le routeur ${routerId}`);
        
        // Récupérer les paiements pour calculer les codes achetés et le total dépensé
        const paymentsCollection = collection(db, 'payments');
        const paymentsQuery = query(
            paymentsCollection,
            where('routerId', '==', routerId),
            where('status', '==', 'completed')
        );
        
        const paymentsSnapshot = await getDocs(paymentsQuery);
        console.log(`${paymentsSnapshot.size} paiements trouvés pour le routeur ${routerId}`);
        
        // Créer un dictionnaire des paiements par client
        const clientPayments = {};
        
        paymentsSnapshot.forEach((paymentDoc) => {
            const payment = paymentDoc.data();
            const clientId = payment.clientId;
            
            if (clientId) {
                if (!clientPayments[clientId]) {
                    clientPayments[clientId] = {
                        purchasedCodes: 0,
                        totalSpent: 0
                    };
                }
                
                // Incrémenter le nombre de codes achetés
                clientPayments[clientId].purchasedCodes++;
                
                // Ajouter le montant dépensé
                const amount = parseFloat(payment.amount) || 0;
                clientPayments[clientId].totalSpent += amount;
            }
        });
        
        // Masquer le chargement
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        if (querySnapshot.empty) {
            // Aucun client trouvé
            if (noClientsElement) {
                noClientsElement.classList.remove('d-none');
            }
            return;
        }
        
        // Conteneur pour les clients
        const clientsList = document.getElementById('clientsList');
        if (!clientsList) {
            console.error("L'élément 'clientsList' n'a pas été trouvé dans le DOM");
            return;
        }
        
        // Supprimer le contenu existant
        clientsList.innerHTML = '';
        
        // Calculer l'offset pour la pagination
        const offset = (page - 1) * limit;
        let count = 0;
        
        // Afficher les clients réels avec pagination manuelle
        querySnapshot.forEach((doc) => {
            // Appliquer la pagination manuellement
            if (count >= offset && count < offset + limit) {
                const client = doc.data();
                client.id = doc.id;
                
                // Ajouter les informations de paiement au client
                if (clientPayments[client.id]) {
                    client.purchasedCodes = clientPayments[client.id].purchasedCodes;
                    client.totalSpent = clientPayments[client.id].totalSpent;
                } else {
                    client.purchasedCodes = 0;
                    client.totalSpent = 0;
                }
                
                addClientRow(client, clientsList, routerId);
            }
            count++;
        });
        
        // Mettre à jour la pagination
        updatePagination(querySnapshot.size, page, limit, routerId);
    } catch (error) {
        console.error('Erreur lors de la récupération des clients:', error);
        
        const loadingElement = document.getElementById('loadingClients');
        const noClientsElement = document.getElementById('noClientsMessage');
        
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        if (noClientsElement) {
            noClientsElement.classList.remove('d-none');
        }
    }
}

// La fonction addMockClients a été supprimée car nous utilisons maintenant des données réelles

/**
 * Ajouter une ligne pour un client
 * @param {Object} client - Données du client
 * @param {HTMLElement} container - Conteneur pour la ligne
 * @param {string} routerId - ID du routeur
 */
function addClientRow(client, container, routerId) {
    // Vérifier que le conteneur existe
    if (!container) {
        console.error("Le conteneur pour la ligne client est null ou undefined");
        return;
    }
    
    // Vérifier que le client est valide
    if (!client) {
        console.error("Les données du client sont null ou undefined");
        return;
    }
    
    try {
        // Créer une ligne
        const row = document.createElement('tr');
        
        // Formater les dates avec vérification pour éviter les erreurs
        let createdAt = 'N/A';
        let lastActivity = 'N/A';
        
        // Vérifier si createdAt est valide avant de formater
        if (client.createdAt) {
            try {
                // Si c'est un timestamp Firestore, le convertir en Date
                if (client.createdAt.toDate && typeof client.createdAt.toDate === 'function') {
                    createdAt = client.createdAt.toDate().toLocaleDateString('fr-FR');
                } 
                // Si c'est déjà un objet Date
                else if (client.createdAt instanceof Date) {
                    createdAt = client.createdAt.toLocaleDateString('fr-FR');
                }
                // Si c'est une chaîne de date ou un timestamp
                else if (typeof client.createdAt === 'string' || typeof client.createdAt === 'number') {
                    createdAt = new Date(client.createdAt).toLocaleDateString('fr-FR');
                }
            } catch (error) {
                console.warn('Erreur lors du formatage de la date de création:', error);
            }
        }
        
        // Vérifier si lastActivity est valide avant de formater
        if (client.lastActivity) {
            try {
                // Si c'est un timestamp Firestore, le convertir en Date
                if (client.lastActivity.toDate && typeof client.lastActivity.toDate === 'function') {
                    lastActivity = client.lastActivity.toDate().toLocaleDateString('fr-FR');
                } 
                // Si c'est déjà un objet Date
                else if (client.lastActivity instanceof Date) {
                    lastActivity = client.lastActivity.toLocaleDateString('fr-FR');
                }
                // Si c'est une chaîne de date ou un timestamp
                else if (typeof client.lastActivity === 'string' || typeof client.lastActivity === 'number') {
                    lastActivity = new Date(client.lastActivity).toLocaleDateString('fr-FR');
                }
            } catch (error) {
                console.warn('Erreur lors du formatage de la dernière activité:', error);
            }
        }
        
        // Vérifier si les propriétés existent pour éviter les erreurs
        const whatsappNumber = client.whatsapp ? client.whatsapp.replace(/\D/g, '') : '';
        const displayWhatsapp = client.whatsapp || 'N/A';
        const purchasedCodes = client.purchasedCodes || 0;
        const totalSpent = client.totalSpent || 0;
        const clientId = client.id || '';
        
        // Remplir la ligne
        row.innerHTML = `
            <td>${client.name || 'Sans nom'}</td>
            <td>${client.whatsapp ? `<a href="https://wa.me/${whatsappNumber}" target="_blank" class="text-decoration-none"><i class="fab fa-whatsapp text-success me-1"></i>${displayWhatsapp}</a>` : 'N/A'}</td>
            <td>${createdAt}</td>
            <td>${lastActivity}</td>
            <td>${purchasedCodes}</td>
            <td>${totalSpent} FCFA</td>
            <td>
                <div class="btn-group">
                    <button type="button" class="btn btn-sm btn-outline-primary view-client-btn" data-client-id="${clientId}">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-secondary edit-client-btn" data-client-id="${clientId}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button type="button" class="btn btn-sm btn-outline-danger delete-client-btn" data-client-id="${clientId}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        `;
        
        // Ajouter la ligne au conteneur
        container.appendChild(row);
        
        // Ajouter les gestionnaires d'événements pour les boutons avec vérification
        const viewBtn = row.querySelector('.view-client-btn');
        if (viewBtn) {
            viewBtn.addEventListener('click', function() {
                if (client && client.id) {
                    showClientDetails(client.id, routerId);
                } else {
                    console.error("ID client manquant pour l'affichage des détails");
                }
            });
        } else {
            console.warn("Bouton 'view-client-btn' non trouvé dans la ligne client");
        }
        
        const editBtn = row.querySelector('.edit-client-btn');
        if (editBtn) {
            editBtn.addEventListener('click', function() {
                if (client && client.id) {
                    editClient(client.id, routerId);
                } else {
                    console.error("ID client manquant pour la modification");
                }
            });
        } else {
            console.warn("Bouton 'edit-client-btn' non trouvé dans la ligne client");
        }
        
        const deleteBtn = row.querySelector('.delete-client-btn');
        if (deleteBtn) {
            deleteBtn.addEventListener('click', function() {
                if (client && client.id) {
                    deleteClient(client.id, routerId);
                } else {
                    console.error("ID client manquant pour la suppression");
                }
            });
        } else {
            console.warn("Bouton 'delete-client-btn' non trouvé dans la ligne client");
        }
    } catch (error) {
        console.error("Erreur lors de l'ajout de la ligne client:", error);
    }
}

/**
 * Mettre à jour la pagination
 * @param {number} totalItems - Nombre total d'éléments
 * @param {number} currentPage - Page actuelle
 * @param {number} itemsPerPage - Éléments par page
 */
function updatePagination(totalItems, currentPage, itemsPerPage, routerId) {
    try {
        // Calculer le nombre total de pages
        const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage));
        
        // Récupérer le conteneur de pagination
        const paginationContainer = document.getElementById('clientsPagination');
        
        // Vérifier si le conteneur existe
        if (!paginationContainer) {
            console.warn('Élément clientsPagination non trouvé dans le DOM');
            return;
        }
        
        // Vider le conteneur
        paginationContainer.innerHTML = '';
        
        // Bouton précédent
        const prevButton = document.createElement('li');
        prevButton.className = `page-item ${currentPage === 1 ? 'disabled' : ''}`;
        prevButton.innerHTML = `<a class="page-link" href="#" tabindex="-1" ${currentPage === 1 ? 'aria-disabled="true"' : ''}>Précédent</a>`;
        paginationContainer.appendChild(prevButton);
        
        // Pages
        for (let i = 1; i <= totalPages; i++) {
            const pageItem = document.createElement('li');
            pageItem.className = `page-item ${i === currentPage ? 'active' : ''}`;
            pageItem.innerHTML = `<a class="page-link" href="#">${i}</a>`;
            paginationContainer.appendChild(pageItem);
            
            // Gestionnaire d'événement pour changer de page
            if (typeof loadClientsList === 'function' && routerId) {
                pageItem.addEventListener('click', function(e) {
                    e.preventDefault();
                    loadClientsList(routerId, i, itemsPerPage);
                });
            } else {
                console.warn('Fonction loadClientsList non disponible ou routerId manquant');
            }
        }
        
        // Bouton suivant
        const nextButton = document.createElement('li');
        nextButton.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
        nextButton.innerHTML = `<a class="page-link" href="#" ${currentPage === totalPages ? 'aria-disabled="true"' : ''}>Suivant</a>`;
        paginationContainer.appendChild(nextButton);
        
        // Gestionnaires d'événements pour les boutons précédent/suivant
        if (currentPage > 1 && typeof loadClientsList === 'function' && routerId) {
            prevButton.addEventListener('click', function(e) {
                e.preventDefault();
                loadClientsList(routerId, currentPage - 1, itemsPerPage);
            });
        }
        
        if (currentPage < totalPages && typeof loadClientsList === 'function' && routerId) {
            nextButton.addEventListener('click', function(e) {
                e.preventDefault();
                loadClientsList(routerId, currentPage + 1, itemsPerPage);
            });
        }
    } catch (error) {
        console.error('Erreur lors de la mise à jour de la pagination:', error);
    }
}

/**
 * Afficher les détails d'un client
 * @param {string} clientId - ID du client
 * @param {string} routerId - ID du routeur
 */
async function showClientDetails(clientId, routerId) {
    try {
        console.log(`Chargement des détails du client ${clientId} pour le routeur ${routerId}`);
        
        // Vérifier que les éléments DOM existent avant de les utiliser
        const modalElement = document.getElementById('clientDetailsModal');
        if (!modalElement) {
            console.error("Modal des détails client non trouvé dans le DOM");
            return;
        }
        
        // Récupérer les données réelles du client depuis Firestore
        const clientRef = doc(db, 'clients', clientId);
        const clientSnap = await getDoc(clientRef);
        
        if (!clientSnap.exists()) {
            console.error(`Client avec ID ${clientId} non trouvé dans Firestore`);
            return;
        }
        
        const client = { id: clientId, ...clientSnap.data() };
        console.log('Données client récupérées:', client);
        
        // Formater les dates
        let createdAt = 'N/A';
        if (client.createdAt) {
            try {
                if (client.createdAt.toDate && typeof client.createdAt.toDate === 'function') {
                    createdAt = client.createdAt.toDate().toLocaleDateString('fr-FR');
                } else if (client.createdAt instanceof Date) {
                    createdAt = client.createdAt.toLocaleDateString('fr-FR');
                } else if (typeof client.createdAt === 'string' || typeof client.createdAt === 'number') {
                    createdAt = new Date(client.createdAt).toLocaleDateString('fr-FR');
                }
            } catch (error) {
                console.warn('Erreur lors du formatage de la date de création:', error);
            }
        }
        
        let lastActivity = 'N/A';
        if (client.lastActivity) {
            try {
                if (client.lastActivity.toDate && typeof client.lastActivity.toDate === 'function') {
                    lastActivity = client.lastActivity.toDate().toLocaleDateString('fr-FR');
                } else if (client.lastActivity instanceof Date) {
                    lastActivity = client.lastActivity.toLocaleDateString('fr-FR');
                } else if (typeof client.lastActivity === 'string' || typeof client.lastActivity === 'number') {
                    lastActivity = new Date(client.lastActivity).toLocaleDateString('fr-FR');
                }
            } catch (error) {
                console.warn('Erreur lors du formatage de la dernière activité:', error);
            }
        }
        
        // Mettre à jour les détails du client dans le modal avec vérification des éléments DOM
        const elements = {
            'detailClientName': client.name || 'Sans nom',
            'detailClientWhatsapp': client.whatsapp || 'N/A',
            'detailClientCreatedAt': createdAt,
            'detailClientLastActivity': lastActivity,
            'detailClientTotalSpent': (client.totalSpent || 0) + ' FCFA',
            'detailClientNote': client.note || 'Aucune note'
        };
        
        for (const [id, value] of Object.entries(elements)) {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            } else {
                console.warn(`Élément ${id} non trouvé dans le DOM`);
            }
        }
        
        // Charger les achats du client
        loadClientPurchases(clientId, routerId);
        
        // Afficher le modal
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } catch (error) {
        console.error('Erreur lors de l\'affichage des détails du client:', error);
    }
}

/**
 * Charger les achats d'un client
 * @param {string} clientId - ID du client
 * @param {string} routerId - ID du routeur
 */
async function loadClientPurchases(clientId, routerId) {
    try {
        console.log(`Chargement des achats du client ${clientId} pour le routeur ${routerId}`);
        
        // Vérifier que les éléments DOM existent avant de les utiliser
        const loadingElement = document.getElementById('loadingPurchases');
        const noMessageElement = document.getElementById('noPurchasesMessage');
        const purchasesList = document.getElementById('clientPurchasesList');
        
        if (!purchasesList) {
            console.error("Conteneur des achats client non trouvé dans le DOM");
            return;
        }
        
        // Afficher le chargement si l'élément existe
        if (loadingElement) {
            loadingElement.classList.remove('d-none');
        } else {
            console.warn("L'élément 'loadingPurchases' n'a pas été trouvé dans le DOM");
        }
        
        // Masquer le message "aucun achat" si l'élément existe
        if (noMessageElement) {
            noMessageElement.classList.add('d-none');
        } else {
            console.warn("L'élément 'noPurchasesMessage' n'a pas été trouvé dans le DOM");
        }
        
        // Supprimer le contenu existant
        purchasesList.innerHTML = '';
        
        // Récupérer les paiements réels du client depuis Firestore
        const paymentsCollection = collection(db, 'payments');
        const paymentsQuery = query(
            paymentsCollection,
            where('routerId', '==', routerId),
            where('clientId', '==', clientId),
            where('status', '==', 'completed'),
            orderBy('createdAt', 'desc')
        );
        
        const paymentsSnapshot = await getDocs(paymentsQuery);
        console.log(`${paymentsSnapshot.size} paiements trouvés pour le client ${clientId}`);
        
        // Masquer le chargement si l'élément existe
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        // Vérifier s'il y a des achats
        if (paymentsSnapshot.empty) {
            if (noMessageElement) {
                noMessageElement.classList.remove('d-none');
            }
            return;
        }
        
        // Ajouter chaque achat
        paymentsSnapshot.forEach(doc => {
            const purchase = { id: doc.id, ...doc.data() };
            addPurchaseRow(purchase, purchasesList);
        });
    } catch (error) {
        console.error('Erreur lors du chargement des achats du client:', error);
        
        // Gérer l'erreur en masquant le chargement si l'élément existe
        const loadingElement = document.getElementById('loadingPurchases');
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        // Afficher un message d'erreur
        const purchasesList = document.getElementById('clientPurchasesList');
        if (purchasesList) {
            purchasesList.innerHTML = `<tr><td colspan="5" class="text-center text-danger">Erreur lors du chargement des achats. Veuillez réessayer.</td></tr>`;
        }
    }
}

/**
 * Ajouter une ligne pour un achat
 * @param {Object} purchase - Données de l'achat
 * @param {HTMLElement} container - Conteneur pour la ligne
 */
function addPurchaseRow(purchase, container) {
    try {
        // Vérifier que le conteneur existe
        if (!container) {
            console.error("Le conteneur pour la ligne d'achat est null ou undefined");
            return;
        }
        
        // Vérifier que l'achat est valide
        if (!purchase) {
            console.error("Les données de l'achat sont null ou undefined");
            return;
        }
        
        // Log pour débogage
        console.log('Ajout de la ligne d\'achat:', purchase);
        
        // Créer une ligne
        const row = document.createElement('tr');
        
        // Formater la date avec vérification pour éviter les erreurs
        let formattedDate = 'N/A';
        
        // Essayer d'abord avec createdAt (champ standard de Firestore)
        if (purchase.createdAt) {
            try {
                // Si c'est un timestamp Firestore, le convertir en Date
                if (purchase.createdAt.toDate && typeof purchase.createdAt.toDate === 'function') {
                    formattedDate = purchase.createdAt.toDate().toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } 
                // Si c'est déjà un objet Date
                else if (purchase.createdAt instanceof Date) {
                    formattedDate = purchase.createdAt.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
                // Si c'est une chaîne de date ou un timestamp
                else if (typeof purchase.createdAt === 'string' || typeof purchase.createdAt === 'number') {
                    formattedDate = new Date(purchase.createdAt).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            } catch (error) {
                console.warn('Erreur lors du formatage de la date de création:', error);
                // Essayer avec le champ date si createdAt échoue
                if (purchase.date) {
                    try {
                        if (purchase.date.toDate && typeof purchase.date.toDate === 'function') {
                            formattedDate = purchase.date.toDate().toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        } else if (purchase.date instanceof Date) {
                            formattedDate = purchase.date.toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        } else if (typeof purchase.date === 'string' || typeof purchase.date === 'number') {
                            formattedDate = new Date(purchase.date).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        }
                    } catch (error) {
                        console.warn('Erreur lors du formatage de la date d\'achat:', error);
                        formattedDate = 'N/A';
                    }
                }
            }
        } 
        // Si createdAt n'existe pas, essayer avec date
        else if (purchase.date) {
            try {
                // Si c'est un timestamp Firestore, le convertir en Date
                if (purchase.date.toDate && typeof purchase.date.toDate === 'function') {
                    formattedDate = purchase.date.toDate().toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } 
                // Si c'est déjà un objet Date
                else if (purchase.date instanceof Date) {
                    formattedDate = purchase.date.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
                // Si c'est une chaîne de date ou un timestamp
                else if (typeof purchase.date === 'string' || typeof purchase.date === 'number') {
                    formattedDate = new Date(purchase.date).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            } catch (error) {
                console.warn('Erreur lors du formatage de la date d\'achat:', error);
                formattedDate = 'N/A';
            }
        }
        
        // Récupérer les informations avec valeurs par défaut pour éviter les undefined
        const code = purchase.code || purchase.wifiCode || 'N/A';
        const profile = purchase.profileName || purchase.profile || 'N/A';
        const amount = (purchase.amount || purchase.total || 0) + ' FCFA';
        
        // Statut
        let statusBadge = '';
        const status = purchase.status || 'completed';
        
        switch (status.toLowerCase()) {
            case 'completed':
            case 'complete':
            case 'success':
                statusBadge = '<span class="badge bg-success">Complété</span>';
                break;
            case 'pending':
                statusBadge = '<span class="badge bg-warning text-dark">En attente</span>';
                break;
            case 'failed':
            case 'cancelled':
                statusBadge = '<span class="badge bg-danger">Échoué</span>';
                break;
            default:
                statusBadge = `<span class="badge bg-secondary">${status}</span>`;
        }

        // Définir le contenu de la ligne
        row.innerHTML = `
            <td>${formattedDate}</td>
            <td>${code}</td>
            <td>${profile}</td>
            <td>${amount}</td>
            <td>${statusBadge}</td>
        `;

        // Ajouter la ligne au conteneur
        container.appendChild(row);
    } catch (error) {
        console.error('Erreur lors de l\'ajout de la ligne d\'achat:', error);
        // Ajouter une ligne d'erreur si nécessaire
        if (container) {
            const errorRow = document.createElement('tr');
            errorRow.innerHTML = `<td colspan="5" class="text-danger">Erreur d'affichage pour un achat</td>`;
            container.appendChild(errorRow);
        }
    }
}

/**
 * Modifier un client
 * @param {string} clientId - ID du client
 * @param {string} routerId - ID du routeur
 */
async function editClient(clientId, routerId) {
    try {
        console.log(`Chargement des données du client ${clientId} pour modification`);
        
        // Vérifier que les éléments DOM existent
        const nameInput = document.getElementById('clientName');
        const whatsappInput = document.getElementById('clientWhatsapp');
        const noteInput = document.getElementById('clientNote');
        const modalLabel = document.getElementById('addClientModalLabel');
        const saveBtn = document.getElementById('saveClientBtn');
        
        if (!nameInput || !whatsappInput || !noteInput || !modalLabel || !saveBtn) {
            console.error("Un ou plusieurs éléments du formulaire client n'ont pas été trouvés dans le DOM");
            return;
        }
        
        // Afficher un indicateur de chargement dans le formulaire
        nameInput.disabled = true;
        whatsappInput.disabled = true;
        noteInput.disabled = true;
        nameInput.placeholder = 'Chargement...';
        whatsappInput.placeholder = 'Chargement...';
        noteInput.placeholder = 'Chargement...';
        
        // Récupérer les données réelles du client depuis Firestore
        const clientRef = doc(db, 'clients', clientId);
        const clientSnap = await getDoc(clientRef);
        
        // Réactiver les champs du formulaire
        nameInput.disabled = false;
        whatsappInput.disabled = false;
        noteInput.disabled = false;
        nameInput.placeholder = 'Nom du client';
        whatsappInput.placeholder = 'Numéro WhatsApp';
        noteInput.placeholder = 'Note (facultatif)';
        
        if (!clientSnap.exists()) {
            console.error(`Client avec ID ${clientId} non trouvé dans Firestore`);
            alert('Client non trouvé. Veuillez rafraîchir la page et réessayer.');
            return;
        }
        
        const client = { id: clientId, ...clientSnap.data() };
        console.log('Données client récupérées pour modification:', client);
        
        // Remplir le formulaire avec les données réelles
        nameInput.value = client.name || '';
        whatsappInput.value = client.whatsapp || '';
        noteInput.value = client.note || '';
        
        // Modifier le titre du modal
        modalLabel.textContent = 'Modifier le client';
        
        // Modifier le bouton de sauvegarde
        saveBtn.textContent = 'Mettre à jour';
        saveBtn.dataset.clientId = clientId;
        saveBtn.dataset.routerId = routerId; // Stocker l'ID du routeur pour la mise à jour
    
        // Afficher le modal
        const modal = new bootstrap.Modal(document.getElementById('addClientModal'));
        modal.show();
    } catch (error) {
        console.error('Erreur lors de la modification du client:', error);
        alert(`Erreur lors du chargement des données du client: ${error.message}`);
    }
}

/**
 * Supprimer un client
 * @param {string} clientId - ID du client
 * @param {string} routerId - ID du routeur
 */
async function deleteClient(clientId, routerId) {
    try {
        // Demander confirmation avant de supprimer
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce client ? Cette action est irréversible.')) {
            return;
        }
        
        console.log(`Suppression du client ${clientId} pour le routeur ${routerId}`);
        
        // Vérifier si le client existe avant de le supprimer
        const clientRef = doc(db, 'clients', clientId);
        const clientSnap = await getDoc(clientRef);
        
        if (!clientSnap.exists()) {
            console.error(`Client avec ID ${clientId} non trouvé dans Firestore`);
            alert('Client non trouvé. Veuillez rafraîchir la page et réessayer.');
            return;
        }
        
        // Vérifier si le client a des paiements associés
        const paymentsCollection = collection(db, 'payments');
        const paymentsQuery = query(
            paymentsCollection,
            where('routerId', '==', routerId),
            where('clientId', '==', clientId),
            limit(1)
        );
        
        const paymentsSnapshot = await getDocs(paymentsQuery);
        
        if (!paymentsSnapshot.empty) {
            // Demander une confirmation supplémentaire si le client a des paiements
            if (!confirm('Ce client a des paiements associés. La suppression n\'affectera pas ces paiements. Voulez-vous vraiment continuer ?')) {
                return;
            }
        }
        
        // Supprimer le client de Firestore
        await deleteDoc(clientRef);
        console.log(`Client ${clientId} supprimé avec succès`);
        
        // Afficher une notification de succès
        alert('Client supprimé avec succès');
        
        // Recharger la liste des clients
        await loadClientsList(routerId);
        
        // Mettre à jour les statistiques
        await loadClientStatistics(routerId);
    } catch (error) {
        console.error('Erreur lors de la suppression du client:', error);
        alert(`Erreur lors de la suppression du client: ${error.message}`);
    }
}

// Les fonctions updateNavigationLinks et setupEventHandlers sont importées depuis payments.js

/**
 * Configure les gestionnaires d'événements spécifiques aux clients
 * Cette fonction est appelée par setupEventHandlers importée de payments.js
 * @param {string} routerId - ID du routeur
 */
function configureClientEventHandlers(routerId) {
    console.log('Configuration des gestionnaires d\'événements pour clients.js');
    
    // Bouton de recherche
    const searchInput = document.getElementById('searchClient');
    if (searchInput && !searchInput.getAttribute('data-handler-attached')) {
        // Marquer l'élément pour éviter d'attacher plusieurs gestionnaires
        searchInput.setAttribute('data-handler-attached', 'true');
        
        searchInput.addEventListener('input', function() {
            // Filtrer les clients
            filterClients(this.value, routerId);
        });
        console.log('Gestionnaire de recherche client attaché');
    }
    
    // Bouton d'effacement de la recherche
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn && !clearSearchBtn.getAttribute('data-handler-attached')) {
        // Marquer l'élément pour éviter d'attacher plusieurs gestionnaires
        clearSearchBtn.setAttribute('data-handler-attached', 'true');
        
        clearSearchBtn.addEventListener('click', function() {
            // Effacer la recherche
            const searchInput = document.getElementById('searchClient');
            if (searchInput) searchInput.value = '';
            
            // Recharger la liste des clients
            loadClientsList(routerId);
        });
        console.log('Gestionnaire d\'effacement de recherche client attaché');
    }
    
    // Bouton d'ajout de client
    const saveClientBtn = document.getElementById('saveClientBtn');
    if (saveClientBtn && !saveClientBtn.getAttribute('data-handler-attached')) {
        // Marquer l'élément pour éviter d'attacher plusieurs gestionnaires
        saveClientBtn.setAttribute('data-handler-attached', 'true');
        
        saveClientBtn.addEventListener('click', function() {
            // Récupérer les valeurs du formulaire
            const name = document.getElementById('clientName').value.trim();
            const whatsapp = document.getElementById('clientWhatsapp').value.trim();
            const note = document.getElementById('clientNote').value.trim();
            
            // Validation basique
            if (!name || !whatsapp) {
                const errorElement = document.getElementById('clientFormError');
                if (errorElement) {
                    errorElement.textContent = 'Veuillez remplir tous les champs obligatoires';
                    errorElement.classList.remove('d-none');
                } else {
                    console.warn('Élément clientFormError non trouvé dans le DOM');
                }
                return;
            }
            
            // Afficher le spinner
            const spinner = document.getElementById('saveClientSpinner');
            if (spinner) {
                spinner.classList.remove('d-none');
            } else {
                console.warn('Élément saveClientSpinner non trouvé dans le DOM');
            }
            
            // Désactiver le bouton de sauvegarde
            if (saveClientBtn) {
                saveClientBtn.disabled = true;
            }
            
            // Vérifier s'il s'agit d'une modification ou d'un ajout
            let clientId = null;
            if (saveClientBtn && saveClientBtn.dataset) {
                clientId = saveClientBtn.dataset.clientId;
            } else {
                console.warn('saveClientBtn ou ses propriétés sont inaccessibles');
            }
            
            // Simuler l'enregistrement
            setTimeout(() => {
                try {
                    if (clientId) {
                        console.log('Client mis à jour:', { id: clientId, name, whatsapp, note });
                        
                        // Mettre à jour le client dans Firestore
                        const clientRef = doc(db, 'clients', clientId);
                        updateDoc(clientRef, {
                            name: name,
                            whatsapp: whatsapp,
                            note: note,
                            updatedAt: serverTimestamp()
                        }).then(() => {
                            console.log(`Client ${clientId} mis à jour avec succès`);
                        }).catch(error => {
                            console.error('Erreur lors de la mise à jour du client:', error);
                        });
                    } else {
                        console.log('Nouveau client:', { name, whatsapp, note });
                        
                        // Ajouter le client à Firestore
                        const clientsRef = collection(db, 'clients');
                        addDoc(clientsRef, {
                            name: name,
                            whatsapp: whatsapp,
                            note: note,
                            routerId: routerId,
                            createdAt: serverTimestamp(),
                            lastActivity: serverTimestamp(),
                            purchasedCodes: 0,
                            totalSpent: 0
                        }).then(() => {
                            console.log('Nouveau client ajouté avec succès');
                        }).catch(error => {
                            console.error('Erreur lors de l\'ajout du client:', error);
                        });
                    }
                    
                    // Fermer le modal
                    const modalElement = document.getElementById('addClientModal');
                    if (modalElement) {
                        try {
                            const modal = bootstrap.Modal.getInstance(modalElement);
                            if (modal) {
                                modal.hide();
                            } else {
                                console.warn('Instance de modal non trouvée pour addClientModal');
                            }
                        } catch (error) {
                            console.error('Erreur lors de la fermeture du modal:', error);
                        }
                    } else {
                        console.warn('Élément addClientModal non trouvé dans le DOM');
                    }
                    
                    // Recharger la liste des clients
                    if (typeof loadClientsList === 'function' && routerId) {
                        loadClientsList(routerId);
                    } else {
                        console.warn('Impossible de recharger la liste des clients: fonction ou routerId manquant');
                    }
                    
                    // Réinitialiser le formulaire
                    const addClientForm = document.getElementById('addClientForm');
                    if (addClientForm) {
                        addClientForm.reset();
                    } else {
                        console.warn('Élément addClientForm non trouvé dans le DOM');
                    }
                    
                    // Masquer le message d'erreur
                    const clientFormError = document.getElementById('clientFormError');
                    if (clientFormError) {
                        clientFormError.classList.add('d-none');
                    } else {
                        console.warn('Élément clientFormError non trouvé dans le DOM');
                    }
                    
                    // Masquer le spinner
                    if (spinner) {
                        spinner.classList.add('d-none');
                    } else {
                        console.warn('Variable spinner non définie ou null');
                    }
                    
                    // Réactiver le bouton de sauvegarde
                    if (saveClientBtn) {
                        saveClientBtn.disabled = false;
                    } else {
                        console.warn('Variable saveClientBtn non définie ou null');
                    }
                    
                    // Réinitialiser le titre du modal et le bouton
                    const addClientModalLabel = document.getElementById('addClientModalLabel');
                    if (addClientModalLabel) {
                        addClientModalLabel.textContent = 'Ajouter un client';
                    } else {
                        console.warn('Élément addClientModalLabel non trouvé dans le DOM');
                    }
                    
                    // Réinitialiser le bouton de sauvegarde
                    if (saveClientBtn) {
                        saveClientBtn.textContent = 'Enregistrer';
                        if (saveClientBtn.dataset) {
                            delete saveClientBtn.dataset.clientId;
                        } else {
                            console.warn('saveClientBtn.dataset n\'est pas accessible');
                        }
                    } else {
                        console.warn('Variable saveClientBtn non définie ou null');
                    }
                } catch (error) {
                    console.error('Erreur lors de l\'enregistrement du client:', error);
                    
                    // Masquer le spinner en cas d'erreur
                    if (spinner) {
                        try {
                            spinner.classList.add('d-none');
                        } catch (e) {
                            console.warn('Erreur lors de la manipulation du spinner:', e);
                        }
                    } else {
                        console.warn('Variable spinner non définie ou null');
                    }
                    
                    // Réactiver le bouton de sauvegarde
                    if (saveClientBtn) {
                        try {
                            saveClientBtn.disabled = false;
                        } catch (e) {
                            console.warn('Erreur lors de la réactivation du bouton de sauvegarde:', e);
                        }
                    } else {
                        console.warn('Variable saveClientBtn non définie ou null');
                    }
                    
                    // Afficher l'erreur
                    const errorElement = document.getElementById('clientFormError');
                    if (errorElement) {
                        try {
                            errorElement.textContent = 'Erreur: ' + (error.message || 'Erreur inconnue');
                            errorElement.classList.remove('d-none');
                        } catch (e) {
                            console.warn('Erreur lors de l\'affichage du message d\'erreur:', e);
                        }
                    } else {
                        console.warn('Élément clientFormError non trouvé dans le DOM');
                    }
                }
            }, 1000);
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

// Cette fonction sera appelée directement depuis initPage pour initialiser tous les gestionnaires d'événements
// Elle appelle d'abord setupEventHandlers importée puis configure les gestionnaires spécifiques aux clients
function initClientEventHandlers(routerId) {
    console.log('Initialisation des gestionnaires d\'\u00e9v\u00e9nements pour la page clients');
    try {
        // Appeler la fonction importée pour configurer les gestionnaires d'événements communs
        setupEventHandlers(routerId);
        // Configurer les gestionnaires d'événements spécifiques aux clients
        configureClientEventHandlers(routerId);
    } catch (error) {
        console.error('Erreur lors de l\'initialisation des gestionnaires d\'\u00e9v\u00e9nements:', error);
    }
}

/**
 * Filtrer les clients
 * @param {string} query - Requête de recherche
 * @param {string} routerId - ID du routeur
 */
function filterClients(query, routerId) {
    if (!query) {
        // Si la requête est vide, recharger tous les clients
        loadClientsList(routerId);
        return;
    }
    
    // Convertir la requête en minuscules pour une recherche insensible à la casse
    query = query.toLowerCase();
    
    // Simuler le filtrage
    console.log('Filtrage des clients:', query);
    
    // Recharger la liste des clients (pour le développement)
    loadClientsList(routerId);
}
