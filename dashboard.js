// Import des fonctions Firebase nécessaires
import { getAuth, onAuthStateChanged, signOut } from "firebase/auth";
import { 
    getFirestore, 
    doc, 
    getDoc, 
    setDoc,
    collection, 
    query, 
    where, 
    getDocs, 
    orderBy, 
    limit, 
    Timestamp,
    serverTimestamp 
} from "firebase/firestore";
import Chart from 'chart.js/auto';
import './src/index';
import { initializeCollections, checkAndCreateCollection, handleFirebaseError, displayIndexError } from './src/db-utils.js';
import { checkAndShowLicenseModal } from './license-modal.js';

// Obtenir les instances des services Firebase
const auth = getAuth();
const db = getFirestore();

// Variable pour stocker l'instance du graphique
let salesChart = null;

// Variable globale pour éviter les initialisations multiples
window.dashboardJsInitialized = window.dashboardJsInitialized || false;

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
    if (window.dashboardJsInitialized) {
        console.log('dashboard.js déjà initialisé, initialisation ignorée');
        return;
    }
    
    // Marquer le script comme initialisé
    window.dashboardJsInitialized = true;
    console.log('Initialisation de dashboard.js');
    // Vérifier si l'utilisateur est connecté
    onAuthStateChanged(auth, async function(user) {
        if (user) {
            // Utilisateur connecté
            console.log('Utilisateur connecté:', user.displayName);
            
            // Mettre à jour le nom de l'utilisateur dans l'interface
            const userNameElements = document.querySelectorAll('#userName');
            userNameElements.forEach(element => {
                element.textContent = user.displayName || user.email;
            });
            
            try {
                // Vérifier si l'utilisateur a une licence active
                const needsLicense = await checkAndShowLicenseModal();
                
                // Charger les données du tableau de bord même si l'utilisateur n'a pas de licence
                // pour lui permettre de voir les informations de base
                await loadDashboardData(user.uid);
                // Initialiser le graphique des ventes
                await initSalesChart(user.uid);
            } catch (error) {
                console.error('Erreur lors du chargement des données:', error);
            }
        } else {
            // Utilisateur non connecté
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
});

/**
 * Charger les données du tableau de bord
 * @param {string} userId - ID de l'utilisateur connecté
 */
async function loadDashboardData(userId) {
    console.log('Chargement des données du tableau de bord pour l\'utilisateur:', userId);
    
    // Vérifier si l'ID de l'utilisateur est valide
    if (!userId) {
        console.error('ID utilisateur non valide');
        return;
    }
    
    try {
        // Initialiser les collections nécessaires
        console.log('Initialisation des collections pour le dashboard...');
        await initializeCollections(userId);
        
        // Référence à l'utilisateur dans Firestore
        const userRef = doc(db, 'users', userId);
        
        // Vérifier si le document utilisateur existe, sinon le créer
        const docSnap = await getDoc(userRef);
        
        if (docSnap.exists()) {
            const userData = docSnap.data();
            console.log('Données utilisateur trouvées:', userData);
            
            // Mettre à jour le nom de l'utilisateur dans l'interface si disponible
            if (userData.name) {
                const userNameElements = document.querySelectorAll('#userName');
                userNameElements.forEach(element => {
                    element.textContent = userData.name;
                });
            }
        } else {
            console.log('Aucune donnée trouvée pour cet utilisateur, création d\'un profil par défaut');
            // Créer un document utilisateur par défaut
            try {
                await setDoc(userRef, {
                    name: 'Utilisateur',
                    email: auth.currentUser ? auth.currentUser.email : 'utilisateur@exemple.com',
                    createdAt: serverTimestamp()
                });
                console.log('Profil utilisateur créé avec succès');
            } catch (err) {
                console.error('Erreur lors de la création du profil utilisateur:', err);
            }
        }
        
        // Charger les statistiques globales
        console.log('Chargement des statistiques globales...');
        await loadGlobalStats(userId);
        
        // Charger la liste des routeurs
        console.log('Chargement de la liste des routeurs...');
        await loadRouters(userId);
        
        // Charger l'activité récente
        console.log('Chargement de l\'activité récente...');
        await loadRecentActivity(userId);
        
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
    }
}

/**
 * Charger les routeurs de l'utilisateur
 * @param {string} userId - ID de l'utilisateur connecté
 */
async function loadRouters(userId) {
    console.log('Chargement des routeurs pour l\'utilisateur:', userId);
    
    // Vérifier si l'ID de l'utilisateur est valide
    if (!userId) {
        console.error('ID utilisateur non valide');
        return;
    }
    
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
    
    // Masquer les messages d'erreur précédents
    const errorContainer = document.getElementById('routersIndexError');
    if (errorContainer) {
        errorContainer.classList.add('d-none');
    }
    
    try {
        // Importer les fonctions utilitaires
        const { executeWithIndexErrorHandling, initializeCollections } = await import('./src/db-utils.js');
        
        // Vérifier et créer la collection des routeurs si nécessaire
        await initializeCollections(userId);
        
        // Référence à la collection des routeurs
        const routersRef = collection(db, 'routers');
        
        // Utiliser la fonction executeWithIndexErrorHandling pour gérer les erreurs d'index
        const querySnapshot = await executeWithIndexErrorHandling(
            // Fonction qui exécute la requête avec tri
            async () => {
                const routersQuery = query(
                    routersRef,
                    where('userId', '==', userId),
                    orderBy('name', 'asc')
                );
                return await getDocs(routersQuery);
            },
            
            // Callback en cas de succès
            (result) => {
                console.log(`Requête avec tri réussie, ${result.size} routeurs trouvés`);
                return result;
            },
            
            // Callback en cas d'erreur d'index
            async (errorInfo) => {
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
                    const { displayIndexError } = await import('./src/db-utils.js');
                    displayIndexError('routersIndexError', errorInfo);
                }
                
                // Exécuter une requête plus simple sans tri
                const simpleQuery = query(
                    routersRef,
                    where('userId', '==', userId)
                );
                return await getDocs(simpleQuery);
            },
            
            // Callback en cas d'autre erreur
            (error) => {
                console.error('Erreur lors de la requête des routeurs:', error);
                throw error; // Propager l'erreur pour qu'elle soit gérée plus haut
            }
        );
        
        // Nombre de routeurs trouvés
        const routersCount = querySnapshot.size;
        console.log(`${routersCount} routeurs trouvés`);
        
        // Mettre à jour le compteur de routeurs
        const routersCountElement = document.getElementById('routersCount');
        if (routersCountElement) {
            routersCountElement.textContent = routersCount;
        }
        
        // Masquer l'indicateur de chargement
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        // Si aucun routeur, proposer d'en créer un par défaut
        if (routersCount === 0) {
            if (noRoutersElement) {
                noRoutersElement.classList.remove('d-none');
                
                // Ajouter un bouton pour créer un routeur par défaut
                const createDefaultBtn = document.createElement('button');
                createDefaultBtn.className = 'btn btn-primary mt-3';
                createDefaultBtn.textContent = 'Créer un routeur par défaut';
                createDefaultBtn.onclick = async () => {
                    await createDefaultRouter(userId);
                    location.reload(); // Recharger la page après création
                };
                
                // Ajouter le bouton au message
                noRoutersElement.appendChild(createDefaultBtn);
            }
            return;
        }
        
        // Sinon, afficher la liste des routeurs
        const routersList = document.getElementById('routersList');
        if (!routersList) {
            console.error('Elément routersList non trouvé dans le DOM');
            return;
        }
        
        // Vider la liste des routeurs avant d'ajouter les nouveaux
        routersList.innerHTML = '';
        
        // Créer un tableau pour afficher les routeurs
        const table = document.createElement('table');
        table.className = 'table table-hover align-middle';
        
        // Créer l'en-tête du tableau
        const thead = document.createElement('thead');
        thead.innerHTML = `
            <tr>
                <th>Nom</th>
                <th>Statut</th>
                <th>Codes</th>
                <th>Clients</th>
                <th>Ventes</th>
                <th>Revenus</th>
                <th>Actions</th>
            </tr>
        `;
        table.appendChild(thead);
        
        // Créer le corps du tableau
        const tbody = document.createElement('tbody');
        table.appendChild(tbody);
        
        // Ajouter le tableau à la liste des routeurs
        routersList.appendChild(table);
        
        // Compteur pour suivre le nombre de routeurs traités
        let processedRouters = 0;
        
        // Préparer un tableau de promesses pour traiter tous les routeurs
        const routerPromises = [];
        
        // Pour chaque routeur
        querySnapshot.forEach((doc) => {
            const router = doc.data();
            const routerId = doc.id;
            
            // Vérifier si c'est un document factice
            if (router._dummy) {
                console.log('Document factice ignoré:', routerId);
                return;
            }
            
            console.log('Ajout du routeur à la file de traitement:', router.name, '(ID:', routerId, ')');
            
            // Ajouter une promesse pour traiter ce routeur
            const routerPromise = (async () => {
                try {
                    // Initialiser les collections pour ce routeur
                    await initializeCollections(userId, routerId);
                    
                    // Récupérer les statistiques du routeur
                    const stats = await getRouterStats(routerId);
                    
                    // Créer la ligne du tableau pour ce routeur
                    const row = document.createElement('tr');
                    row.innerHTML = `
                        <td>
                            <a href="router-dashboard.html?id=${routerId}" class="text-decoration-none">
                                <strong>${router.name || 'Routeur sans nom'}</strong>
                            </a>
                            <br>
                            <small class="text-muted">${router.description || 'Aucune description'}</small>
                        </td>
                        <td>
                            <span class="badge bg-${router.status === 'active' ? 'success' : 'danger'}">
                                ${router.status === 'active' ? 'Actif' : 'Inactif'}
                            </span>
                        </td>
                        <td>${stats.codesCount || 0}</td>
                        <td>${stats.clientsCount || 0}</td>
                        <td>${stats.salesCount || 0}</td>
                        <td>${(stats.revenue || 0).toLocaleString()} FCFA</td>
                        <td>
                            <div class="dropdown">
                                <button class="btn btn-sm btn-outline-secondary dropdown-toggle" type="button" data-bs-toggle="dropdown">
                                    Actions
                                </button>
                                <ul class="dropdown-menu dropdown-menu-end">
                                    <li><a class="dropdown-item" href="router-dashboard.html?id=${routerId}"><i class="fas fa-tachometer-alt me-1"></i> Tableau de bord</a></li>
                                    <li><a class="dropdown-item" href="wifi-codes.html?id=${routerId}"><i class="fas fa-key me-1"></i> Codes WiFi</a></li>
                                    <li><a class="dropdown-item" href="clients.html?id=${routerId}"><i class="fas fa-users me-1"></i> Clients</a></li>
                                    <li><a class="dropdown-item" href="payments.html?id=${routerId}"><i class="fas fa-money-bill-wave me-1"></i> Paiements</a></li>
                                    <li><hr class="dropdown-divider"></li>
                                    <li><a class="dropdown-item" href="router-settings.html?id=${routerId}"><i class="fas fa-cog me-1"></i> Paramètres</a></li>
                                </ul>
                            </div>
                        </td>
                    `;
                    tbody.appendChild(row);
                    
                    // Incrémenter le compteur de routeurs traités
                    processedRouters++;
                    console.log(`Routeur ${routerId} traité (${processedRouters}/${routersCount})`);
                    
                    return { success: true, routerId };
                } catch (statsError) {
                    console.error(`Erreur lors du chargement des statistiques pour le routeur ${routerId}:`, statsError);
                    
                    // Même en cas d'erreur, incrémenter le compteur
                    processedRouters++;
                    
                    return { success: false, routerId, error: statsError };
                }
            })();
            
            routerPromises.push(routerPromise);
        });
        
        // Attendre que tous les routeurs soient traités
        try {
            await Promise.all(routerPromises);
            console.log('Tous les routeurs ont été traités avec succès');
        } catch (error) {
            console.error('Erreur lors du traitement des routeurs:', error);
            
            // Afficher un message d'erreur
            const routersList = document.getElementById('routersList');
            if (routersList) {
                routersList.innerHTML += `
                    <div class="alert alert-danger">
                        <p><strong>Erreur lors du chargement des routeurs:</strong> ${error.message}</p>
                        <p class="mb-0">Si l'erreur mentionne un index manquant, suivez le lien fourni dans la console pour le créer.</p>
                    </div>
                    <button class="btn btn-outline-primary" onclick="location.reload();">Actualiser</button>
                `;
            }
        }
    } catch (error) {
        console.error('Erreur lors du chargement des routeurs:', error);
        
        // Masquer l'indicateur de chargement
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        // Traiter l'erreur avec notre utilitaire
        const errorInfo = handleFirebaseError(error);
        
        // Afficher un message d'erreur
        const routersList = document.getElementById('routersList');
        if (routersList) {
            if (errorInfo.isIndexError) {
                // C'est une erreur d'index, afficher un message spécifique
                let errorContainer = document.getElementById('routersIndexError');
                if (!errorContainer) {
                    errorContainer = document.createElement('div');
                    errorContainer.id = 'routersIndexError';
                    routersList.parentNode.insertBefore(errorContainer, routersList);
                }
                
                // Afficher le message d'erreur d'index
                displayIndexError('routersIndexError', errorInfo);
                
                // Ajouter un bouton pour actualiser
                routersList.innerHTML = `
                    <div class="mt-3">
                        <button class="btn btn-outline-primary" onclick="location.reload();">Actualiser</button>
                    </div>
                `;
            } else {
                // Autre type d'erreur
                routersList.innerHTML = `
                    <div class="alert alert-danger">
                        <p><strong>Erreur lors du chargement des routeurs:</strong> ${error.message}</p>
                        <p class="mb-0">Veuillez réessayer ou contacter le support si le problème persiste.</p>
                    </div>
                    <button class="btn btn-outline-primary" onclick="location.reload();">Actualiser</button>
                `;
            }
        }
        
        // Vérifier si la collection 'routers' existe, sinon la créer
        try {
            await checkAndCreateCollection('routers');
            console.log('Collection routers vérifiée/créée avec succès');
        } catch (collectionError) {
            console.error('Erreur lors de la vérification/création de la collection routers:', collectionError);
        }
    }
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
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        };
        
        await setDoc(newRouterRef, routerData);
        console.log('Routeur par défaut créé avec succès, ID:', newRouterRef.id);
        
        // Initialiser les collections pour ce routeur
        await initializeCollections(userId, newRouterRef.id);
        
        return newRouterRef.id;
    } catch (error) {
        console.error('Erreur lors de la création du routeur par défaut:', error);
        throw error;
    }
}

/**
 * Récupérer les statistiques d'un routeur
 * @param {string} routerId - ID du routeur
 * @returns {Promise<Object>} - Statistiques du routeur
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
            const errorInfo = handleFirebaseError(error);
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
            const errorInfo = handleFirebaseError(error);
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
            const errorInfo = handleFirebaseError(error);
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
            paymentsSnapshot.forEach((doc) => {
                const payment = doc.data();
                totalRevenue += payment.amount || 0;
            });
            stats.revenue = totalRevenue;
            
            console.log(`Nombre de ventes pour le routeur ${routerId}: ${stats.salesCount}, Revenus: ${stats.revenue}`);
        } catch (error) {
            const errorInfo = handleFirebaseError(error);
            console.error('Erreur lors de la récupération des ventes et revenus:', error.message);
            
            // Si c'est une erreur d'index, essayer sans le filtre de statut
            if (errorInfo.isIndexError) {
                try {
                    console.log('Tentative de récupération des paiements sans filtre de statut...');
                    const simplePaymentsSnapshot = await getDocs(query(
                        collection(db, 'payments'),
                        where('routerId', '==', routerId)
                    ));
                    stats.salesCount = simplePaymentsSnapshot.size;
                    
                    // Calculer les revenus totaux
                    let simpleRevenue = 0;
                    simplePaymentsSnapshot.forEach((doc) => {
                        const payment = doc.data();
                        if (payment.status === 'completed') {
                            simpleRevenue += payment.amount || 0;
                        }
                    });
                    stats.revenue = simpleRevenue;
                    
                    console.log(`Récupération simplifiée - Ventes: ${stats.salesCount}, Revenus: ${stats.revenue}`);
                } catch (secondError) {
                    console.error('Erreur lors de la récupération simplifiée des paiements:', secondError.message);
                }
            }
        }
        
        console.log('Statistiques récupérées pour le routeur ID:', routerId, stats);
        return stats;
    } catch (error) {
        console.error('Erreur générale lors de la récupération des statistiques:', error.message);
        return stats; // Retourner les statistiques par défaut en cas d'erreur
    }
}

/**
 * Charger les statistiques globales
 * @param {string} userId - ID de l'utilisateur connecté
 */
function loadGlobalStats(userId) {
    console.log('Chargement des statistiques globales pour l\'utilisateur:', userId);

    // Afficher les indicateurs de chargement
    document.querySelectorAll('.stats-loader').forEach(loader => {
        loader.classList.remove('d-none');
    });

    // Masquer les valeurs précédentes pendant le chargement
    document.getElementById('codesCount').textContent = '...';
    document.getElementById('clientsCount').textContent = '...';
    document.getElementById('revenueAmount').textContent = '...';

    // Nous devons d'abord récupérer tous les routeurs de l'utilisateur
    const routersCollection = collection(db, 'routers');
    const routersQuery = query(routersCollection, where('userId', '==', userId));
    
    getDocs(routersQuery)
        .then((routersSnapshot) => {
            console.log('Nombre de routeurs trouvés:', routersSnapshot.size);

            // Si aucun routeur, afficher 0 partout
            if (routersSnapshot.size === 0) {
                document.getElementById('codesCount').textContent = '0';
                document.getElementById('clientsCount').textContent = '0';
                document.getElementById('revenueAmount').textContent = '0 FCFA';

                // Masquer les indicateurs de chargement
                document.querySelectorAll('.stats-loader').forEach(loader => {
                    loader.classList.add('d-none');
                });

                return;
            }

            // Extraire les IDs des routeurs
            const routerIds = [];
            routersSnapshot.forEach(doc => {
                routerIds.push(doc.id);
            });

            // Utiliser Promise.all pour exécuter toutes les requêtes en parallèle
            Promise.all([
                // 1. Récupérer tous les codes WiFi disponibles
                Promise.all(routerIds.map(routerId => {
                    const codesCollection = collection(db, 'wifiCodes');
                    const codesQuery = query(
                        codesCollection,
                        where('routerId', '==', routerId),
                        where('status', '==', 'available')
                    );
                    return getDocs(codesQuery);
                })),

                // 2. Récupérer tous les clients
                Promise.all(routerIds.map(routerId => {
                    const clientsCollection = collection(db, 'clients');
                    const clientsQuery = query(clientsCollection, where('routerId', '==', routerId));
                    return getDocs(clientsQuery);
                })),

                // 3. Récupérer tous les paiements complétés
                Promise.all(routerIds.map(routerId => {
                    const paymentsCollection = collection(db, 'payments');
                    const paymentsQuery = query(
                        paymentsCollection,
                        where('routerId', '==', routerId),
                        where('status', '==', 'completed')
                    );
                    return getDocs(paymentsQuery);
                }))
            ])
            .then(([codesSnapshots, clientsSnapshots, paymentsSnapshots]) => {
                // Calculer le nombre total de codes disponibles
                let totalCodes = 0;
                codesSnapshots.forEach(snapshots => {
                    totalCodes += snapshots.size;
                });

                // Calculer le nombre total de clients
                let totalClients = 0;
                clientsSnapshots.forEach(snapshots => {
                    totalClients += snapshots.size;
                });

                // Calculer les revenus totaux
                let totalRevenue = 0;
                paymentsSnapshots.forEach(snapshots => {
                    snapshots.forEach(doc => {
                        const payment = doc.data();
                        totalRevenue += payment.amount || 0;
                    });
                });

                // Mettre à jour l'interface
                document.getElementById('codesCount').textContent = totalCodes;
                document.getElementById('clientsCount').textContent = totalClients;
                document.getElementById('revenueAmount').textContent = totalRevenue.toLocaleString() + ' FCFA';

                // Masquer les indicateurs de chargement
                document.querySelectorAll('.stats-loader').forEach(loader => {
                    loader.classList.add('d-none');
                });

                console.log('Statistiques globales chargées avec succès');
            })
            .catch((error) => {
                console.error('Erreur lors de la récupération des statistiques globales:', error);

                // En cas d'erreur, afficher 0 partout
                document.getElementById('codesCount').textContent = '0';
                document.getElementById('clientsCount').textContent = '0';
                document.getElementById('revenueAmount').textContent = '0 FCFA';

                // Masquer les indicateurs de chargement
                document.querySelectorAll('.stats-loader').forEach(loader => {
                    loader.classList.add('d-none');
                });
            });
        })
        .catch((error) => {
            console.error('Erreur lors de la récupération des routeurs:', error);

            // En cas d'erreur, afficher 0 partout
            document.getElementById('codesCount').textContent = '0';
            document.getElementById('clientsCount').textContent = '0';
            document.getElementById('revenueAmount').textContent = '0 FCFA';

            // Masquer les indicateurs de chargement
            document.querySelectorAll('.stats-loader').forEach(loader => {
                loader.classList.add('d-none');
            });
        });
}

/**
 * Charger l'activité récente
 * @param {string} userId - ID de l'utilisateur connecté
 */
function loadRecentActivity(userId) {
    // Récupérer les 5 derniers paiements
    const paymentsCollection = collection(db, 'payments');
    const paymentsQuery = query(
        paymentsCollection,
        where('userId', '==', userId),
        orderBy('createdAt', 'desc'),
        limit(5)
    );
    
    getDocs(paymentsQuery)
        .then((snapshot) => {
            const recentActivity = document.getElementById('recentActivity');
            
            if (snapshot.empty) {
                recentActivity.innerHTML = `
                    <li class="list-group-item text-center">
                        <div class="text-muted">Aucune activité récente</div>
                    </li>
                `;
                return;
            }
            
            recentActivity.innerHTML = '';
            
            snapshot.forEach((doc) => {
                const payment = doc.data();
                const date = payment.createdAt ? new Date(payment.createdAt.toDate()) : new Date();
                const formattedDate = date.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                const statusClass = payment.status === 'completed' ? 'text-success' : 
                                   payment.status === 'pending' ? 'text-warning' : 
                                   payment.status === 'failed' ? 'text-danger' : 'text-secondary';
                
                const item = document.createElement('li');
                item.className = 'list-group-item';
                item.innerHTML = `
                    <div class="d-flex justify-content-between align-items-center">
                        <div>
                            <strong>${payment.clientName || 'Client'}</strong>
                            <div class="text-muted small">${formattedDate}</div>
                        </div>
                        <div>
                            <span class="badge ${statusClass}">${payment.amount} FCFA</span>
                        </div>
                    </div>
                `;
                
                recentActivity.appendChild(item);
            });
        })
        .catch((error) => {
            console.error('Erreur lors de la récupération de l\'activité récente:', error);
        });
}

/**
 * Initialise le graphique des ventes
 * @param {string} uid - L'ID de l'utilisateur connecté
 */
async function initSalesChart(uid) {
    try {
        // Détruire le graphique existant s'il existe
        if (salesChart) {
            salesChart.destroy();
        }

        const canvas = document.getElementById('salesChart');
        if (!canvas) {
            console.error('Canvas salesChart non trouvé');
            return;
        }

        const ctx = canvas.getContext('2d');
        const salesData = await loadSalesData(uid);

        salesChart = new Chart(ctx, {
            type: 'line',
            data: salesData,
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Ventes des 7 derniers jours'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + ' FCFA';
                            }
                        }
                    }
                }
            }
        });
    } catch (error) {
        console.error('Erreur lors de l\'initialisation du graphique:', error);
    }
}

/**
 * Charge les données de vente pour le graphique
 * @param {string} uid - L'ID de l'utilisateur connecté
 * @returns {Promise<Object>} Les données formatées pour Chart.js
 */
async function loadSalesData(uid) {
    try {
        const today = new Date();
        const lastSevenDays = [];

        // Récupérer les dates des 7 derniers jours
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(today.getDate() - i);
            lastSevenDays.push(date);
        }

        // Formater les dates pour Firestore
        const dailySales = await Promise.all(
            lastSevenDays.map(async (date) => {
                const start = new Date(date);
                start.setHours(0, 0, 0, 0);
                const end = new Date(date);
                end.setHours(23, 59, 59, 999);

                const paymentsRef = collection(db, 'payments');
                const q = query(
                    paymentsRef,
                    where('userId', '==', uid),
                    where('status', '==', 'completed'),
                    where('createdAt', '>=', Timestamp.fromDate(start)),
                    where('createdAt', '<=', Timestamp.fromDate(end))
                );

                const snapshot = await getDocs(q);
                let total = 0;
                snapshot.forEach(doc => {
                    const payment = doc.data();
                    total += payment.amount || 0;
                });
                return total;
            })
        );

        // Préparer les données pour le graphique
        const labels = lastSevenDays.map(date => {
            return date.toLocaleDateString('fr-FR', { weekday: 'short' });
        });

        return {
            labels: labels,
            datasets: [{
                label: 'Ventes (FCFA)',
                data: dailySales,
                backgroundColor: 'rgba(13, 110, 253, 0.2)',
                borderColor: 'rgba(13, 110, 253, 1)',
                borderWidth: 2,
                tension: 0.4
            }]
        };
    } catch (error) {
        console.error('Erreur lors du chargement des données des ventes:', error);
        
        // Vérifier si l'erreur est liée à un index manquant
        if (error.message && error.message.includes('index')) {
            // Extraire l'URL de création d'index si elle existe
            const indexUrlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s"']+/);
            const indexUrl = indexUrlMatch ? indexUrlMatch[0] : null;
            
            // Afficher un message d'erreur avec un lien vers la création d'index
            const errorContainer = document.getElementById('salesChartError');
            if (errorContainer) {
                errorContainer.classList.remove('d-none');
                errorContainer.innerHTML = `
                    <div class="alert alert-warning">
                        <p><strong>Erreur d'index Firebase :</strong> Cette requête nécessite un index composé.</p>
                        ${indexUrl ? `<p>Cliquez sur <a href="${indexUrl}" target="_blank">ce lien</a> pour créer l'index nécessaire.</p>` : ''}
                        <p class="mb-0">Après avoir créé l'index, actualisez la page.</p>
                    </div>
                `;
            }
        }
        
        return {
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
    }
}
