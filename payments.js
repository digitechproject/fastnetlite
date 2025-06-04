// Import de la couche de compatibilité Firebase v9
// Script pour la gestion des paiements FastNetLite
// Import des modules Firebase et FedaPay
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
    Timestamp,
    runTransaction,
    serverTimestamp
} from "firebase/firestore";
import './src/index';
import { initFedaPay, createFedaPayTransaction } from './fedapay-utils.js';

// Obtenir les instances des services Firebase
const auth = getAuth();
const db = getFirestore();

// Partie 1: Initialisation et statistiques

// Variable globale pour éviter les initialisations multiples
window.paymentsJsInitialized = window.paymentsJsInitialized || false;

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
    if (window.paymentsJsInitialized) {
        console.log('payments.js déjà initialisé, initialisation ignorée');
        return;
    }
    
    // Marquer le script comme initialisé
    window.paymentsJsInitialized = true;
    console.log('Initialisation de payments.js');
    // Récupérer l'ID du routeur depuis l'URL
    const urlParams = new URLSearchParams(window.location.search);
    const routerId = urlParams.get('id');
    
    // Vérifier si l'ID du routeur est présent
    if (!routerId) {
        // Rediriger vers la liste des routeurs si aucun ID n'est fourni
        window.location.href = 'routers.html';
        return;
    }
    
    // Vérifier et créer les collections nécessaires
    checkAndCreateCollections(routerId);
    
    // Initialiser la page
    initPage(routerId);
    
    // Configurer les gestionnaires d'événements
    setupEventHandlers(routerId);
});

/**
 * Vérifie et crée les collections nécessaires si elles n'existent pas
 * @param {string} routerId - ID du routeur
 */
async function checkAndCreateCollections(routerId) {
    try {
        // Créer la collection payments si elle n'existe pas
        const paymentsCollection = collection(db, 'payments');
        const dummyPaymentDoc = await addDoc(paymentsCollection, {
            _dummy: true,
            routerId: routerId,
            createdAt: serverTimestamp()
        });
        await deleteDoc(dummyPaymentDoc);
        console.log('Collection payments créée ou vérifiée avec succès');
        
        // Créer la collection clients si elle n'existe pas
        const clientsCollection = collection(db, 'clients');
        const dummyClientDoc = await addDoc(clientsCollection, {
            _dummy: true,
            routerId: routerId,
            createdAt: serverTimestamp()
        });
        await deleteDoc(dummyClientDoc);
        console.log('Collection clients créée ou vérifiée avec succès');
        
        // Créer la collection profiles si elle n'existe pas
        const profilesCollection = collection(db, 'routers', routerId, 'profiles');
        const dummyProfileDoc = await addDoc(profilesCollection, {
            _dummy: true,
            name: 'Dummy Profile',
            createdAt: serverTimestamp()
        });
        await deleteDoc(dummyProfileDoc);
        console.log('Collection profiles créée ou vérifiée avec succès');
    } catch (error) {
        console.error('Erreur lors de la vérification/création des collections:', error);
    }
}

/**
 * Initialiser la page
 * @param {string} routerId - ID du routeur
 */
function initPage(routerId) {
    // Charger les informations du routeur
    loadRouterInfo(routerId);
    
    // Charger les statistiques des paiements
    loadPaymentStatistics(routerId);
    
    // Charger la liste des paiements
    loadPaymentsList(routerId);
    
    // Initialiser le graphique des revenus
    initRevenueChart(routerId);
    
    // Charger les profils pour les filtres
    loadProfilesForFilters(routerId);
    
    // Charger les clients pour le formulaire d'ajout de paiement
    loadClientsForForm(routerId);
    
    // Mettre à jour les liens de navigation
    updateNavigationLinks(routerId);
}

/**
 * Charger les profils pour les filtres et le formulaire d'ajout de paiement
 * @param {string} routerId - ID du routeur
 */
async function loadProfilesForFilters(routerId) {
    console.log('Début du chargement des profils pour les filtres et le formulaire');
    if (!routerId) {
        console.error('loadProfilesForFilters: routerId est null ou non défini');
        return;
    }
    try {
        // Utiliser la même structure de base de données que dans router-dashboard.js
        console.log(`Chargement des profils pour le routeur ${routerId}`);
        
        // Référence à la collection des profils
        const profilesRef = collection(db, 'profiles');
        
        // Requête pour obtenir les profils associés à ce routeur
        const profilesQuery = query(
            profilesRef, 
            where('routerId', '==', routerId),
            orderBy('name', 'asc')
        );
        
        console.log('Requête de profils créée, exécution...');
        const profilesSnapshot = await getDocs(profilesQuery);
        
        // Remplir le sélecteur de profils dans le filtre
        const profileFilter = document.getElementById('profileFilter');
        if (profileFilter) {
            console.log('Élément profileFilter trouvé, ajout des profils');
            // Conserver l'option par défaut
            profileFilter.innerHTML = '<option value="">Tous les profils</option>';
            
            // Ajouter les profils
            let profileCount = 0;
            profilesSnapshot.forEach((doc) => {
                const profile = doc.data();
                if (profile._dummy) return; // Ignorer le document factice
                
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = profile.name || 'Profil sans nom';
                profileFilter.appendChild(option);
                profileCount++;
            });
            console.log(`${profileCount} profils ajoutés au filtre`);
        } else {
            console.warn('Élément profileFilter non trouvé dans le DOM');
        }
        
        // Remplir le sélecteur de profils dans le formulaire d'ajout de paiement
        const paymentProfile = document.getElementById('paymentProfile');
        if (paymentProfile) {
            console.log('Élément paymentProfile trouvé, ajout des profils au formulaire');
            // Conserver l'option par défaut
            paymentProfile.innerHTML = '<option value="">Sélectionner un profil</option>';
            
            // Ajouter les profils
            let profileFormCount = 0;
            profilesSnapshot.forEach((doc) => {
                const profile = doc.data();
                if (profile._dummy) return; // Ignorer le document factice
                
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = `${profile.name || 'Profil sans nom'} - ${profile.price || 0} FCFA`;
                option.dataset.price = profile.price || 0;
                option.dataset.name = profile.name || 'Profil sans nom';
                paymentProfile.appendChild(option);
                profileFormCount++;
            });
            console.log(`${profileFormCount} profils ajoutés au formulaire de paiement`);
            
            // Gestionnaire d'événement pour mettre à jour le montant automatiquement
            // et charger les codes disponibles pour le profil sélectionné
            // Vérifier si un gestionnaire est déjà attaché
            if (!paymentProfile.getAttribute('data-change-handler-attached')) {
                paymentProfile.setAttribute('data-change-handler-attached', 'true');
                paymentProfile.addEventListener('change', function() {
                    console.log('Changement de profil détecté, mise à jour du montant');
                    const selectedOption = this.options[this.selectedIndex];
                    if (selectedOption && selectedOption.value) {
                        // Mettre à jour le montant
                        const paymentAmountInput = document.getElementById('paymentAmount');
                        if (paymentAmountInput && selectedOption.dataset.price) {
                            paymentAmountInput.value = selectedOption.dataset.price;
                            console.log(`Montant mis à jour: ${selectedOption.dataset.price} FCFA`);
                        } else if (!paymentAmountInput) {
                            console.warn('Élément paymentAmount non trouvé dans le DOM');
                        }
                        
                        // Charger les codes disponibles pour ce profil
                        if (selectedOption.value !== '') {
                            loadCodesForPaymentForm(routerId, selectedOption.value);
                        }
                    }
                });
                console.log('Gestionnaire de changement de profil attaché');
            }
        } else {
            console.warn('Élément paymentProfile non trouvé dans le DOM');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des profils:', error);
    }
}

/**
 * Charger les clients pour le formulaire d'ajout de paiement
 * @param {string} routerId - ID du routeur
 */
async function loadClientsForForm(routerId) {
    console.log('Début du chargement des clients pour le formulaire');
    if (!routerId) {
        console.error('loadClientsForForm: routerId est null ou non défini');
        return;
    }
    try {
        // Vérifier si les collections nécessaires existent et les créer si besoin
        try {
            // Créer la collection clients si elle n'existe pas
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
        
        // Récupérer les clients
        const clientsCollection = collection(db, 'clients');
        const clientsQuery = query(
            clientsCollection,
            where('routerId', '==', routerId),
            orderBy('name', 'asc')
        );
        
        const clientsSnapshot = await getDocs(clientsQuery);
        
        // Remplir le sélecteur de clients
        const clientSelect = document.getElementById('paymentClient');
        if (clientSelect) {
            console.log('Élément clientSelect trouvé, ajout des clients au formulaire');
            // Conserver l'option par défaut
            clientSelect.innerHTML = '<option value="">Sélectionner un client</option>';
            
            // Ajouter les clients
            let clientCount = 0;
            clientsSnapshot.forEach((doc) => {
                const client = doc.data();
                if (client._dummy) return; // Ignorer le document factice
                
                const option = document.createElement('option');
                option.value = doc.id;
                option.textContent = client.name || 'Client sans nom';
                option.dataset.name = client.name || 'Client sans nom';
                option.dataset.phone = client.phone || '';
                clientSelect.appendChild(option);
                clientCount++;
            });
            console.log(`${clientCount} clients ajoutés au formulaire de paiement`);
            
            // Ajouter l'option pour ajouter un nouveau client
            const newOption = document.createElement('option');
            newOption.value = 'new';
            newOption.textContent = '+ Ajouter un nouveau client';
            clientSelect.appendChild(newOption);
            
            // Gestionnaire d'événement pour afficher le formulaire d'ajout de client
            // Vérifier si un gestionnaire est déjà attaché
            if (!clientSelect.getAttribute('data-change-handler-attached')) {
                clientSelect.setAttribute('data-change-handler-attached', 'true');
                clientSelect.addEventListener('change', function() {
                    console.log('Changement de client détecté');
                    const addClientForm = document.getElementById('addClientForm');
                    if (!addClientForm) {
                        console.warn('Élément addClientForm non trouvé dans le DOM');
                        return;
                    }
                    
                    if (this.value === 'new') {
                        // Afficher le formulaire d'ajout de client
                        addClientForm.classList.remove('d-none');
                        console.log('Formulaire d\'ajout de client affiché');
                    } else {
                        // Masquer le formulaire d'ajout de client
                        addClientForm.classList.add('d-none');
                        console.log('Formulaire d\'ajout de client masqué');
                    }
                });
                console.log('Gestionnaire de changement de client attaché');
            }
        } else {
            console.warn('Élément clientSelect non trouvé dans le DOM');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des clients:', error);
    }
}

/**
 * Charger les codes WiFi disponibles pour un profil spécifique
 * @param {string} routerId - ID du routeur
 * @param {string} profileId - ID du profil
 */
async function loadCodesForPaymentForm(routerId, profileId) {
    console.log(`Début du chargement des codes pour le profil ${profileId}`);
    if (!routerId || !profileId) {
        console.error('loadCodesForPaymentForm: routerId ou profileId est null ou non défini');
        return;
    }
    
    try {
        // Utiliser la même structure de base de données que dans wifi-codes.js
        console.log(`Chargement des codes WiFi pour le routeur ${routerId} et le profil ${profileId}`);
        
        // Référence à la collection des codes
        const codesRef = collection(db, 'wifiCodes');
        
        // Requête pour obtenir les codes disponibles (non utilisés) pour ce profil
        const q = query(
            codesRef,
            where('routerId', '==', routerId),
            where('profileId', '==', profileId),
            where('status', '==', 'available'),
            orderBy('createdAt', 'desc'),
            limit(50)
        );
        
        // Exécuter la requête
        const codesSnapshot = await getDocs(q);
        
        // Référence au sélecteur de codes
        const codeSelect = document.getElementById('paymentCode');
        if (codeSelect) {
            console.log('Élément codeSelect trouvé, ajout des codes au formulaire');
            // Conserver l'option par défaut
            codeSelect.innerHTML = '<option value="">Sélectionner un code</option>';
            
            // Ajouter les codes
            let codeCount = 0;
            codesSnapshot.forEach((doc) => {
                const code = doc.data();
                
                const option = document.createElement('option');
                option.value = doc.id;
                
                // Déterminer le texte à afficher pour le code
                let codeText = '';
                
                // Si c'est un code de type voucher (code unique)
                if (code.code) {
                    codeText = code.code;
                } 
                // Si c'est un code de type username/password
                else if (code.username && code.password) {
                    codeText = `${code.username} / ${code.password}`;
                }
                // Si c'est un code de type username seulement
                else if (code.username) {
                    codeText = `${code.username}`;
                }
                // Si c'est un code de type password seulement
                else if (code.password) {
                    codeText = `${code.password}`;
                }
                // Si aucune information n'est disponible
                else {
                    codeText = `Code ID: ${doc.id.substring(0, 8)}...`;
                }
                
                option.textContent = codeText;
                option.dataset.username = code.username || '';
                option.dataset.password = code.password || '';
                option.dataset.code = code.code || '';
                codeSelect.appendChild(option);
                codeCount++;
            });
            
            if (codeCount === 0) {
                // Aucun code disponible
                const noCodeOption = document.createElement('option');
                noCodeOption.value = '';
                noCodeOption.textContent = 'Aucun code disponible pour ce profil';
                noCodeOption.disabled = true;
                codeSelect.appendChild(noCodeOption);
                console.log('Aucun code disponible pour ce profil');
            } else {
                console.log(`${codeCount} codes ajoutés au formulaire de paiement`);
            }
        } else {
            console.warn('Élément codeSelect non trouvé dans le DOM');
        }
    } catch (error) {
        console.error('Erreur lors du chargement des codes:', error);
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
            document.title = `Paiements - ${router.name} - FastNetLite`;
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
 * Charger les statistiques des paiements
 * @param {string} routerId - ID du routeur
 */
async function loadPaymentStatistics(routerId) {
    try {
        // Revenus totaux
        const paymentsCollection = collection(db, 'payments');
        
        // Utiliser une requête simple pour éviter les problèmes d'index
        const paymentsQuery = query(
            paymentsCollection,
            where('routerId', '==', routerId)
        );
        
        const snapshot = await getDocs(paymentsQuery);
        
        let totalRevenue = 0;
        let transactionsCount = snapshot.size;
        
        snapshot.forEach((doc) => {
            const payment = doc.data();
            totalRevenue += payment.amount || 0;
        });
        
        // Mettre à jour les statistiques
        const totalRevenueElement = document.getElementById('totalRevenue');
        if (totalRevenueElement) totalRevenueElement.textContent = totalRevenue + ' FCFA';
        
        const transactionsCountElement = document.getElementById('transactionsCount');
        if (transactionsCountElement) transactionsCountElement.textContent = transactionsCount;
        
        // Calculer le panier moyen
        const averageAmount = transactionsCount > 0 ? Math.round(totalRevenue / transactionsCount) : 0;
        const averageAmountElement = document.getElementById('averageAmount');
        if (averageAmountElement) averageAmountElement.textContent = averageAmount + ' FCFA';
        
        // Si aucun paiement, afficher le message
        if (transactionsCount === 0) {
            const loadingElement = document.getElementById('loadingPayments');
            if (loadingElement) loadingElement.classList.add('d-none');
            
            const noPaymentsElement = document.getElementById('noPaymentsMessage');
            if (noPaymentsElement) noPaymentsElement.classList.remove('d-none');
        }
        
        // Revenus du mois
        const firstDayOfMonth = new Date();
        firstDayOfMonth.setDate(1);
        firstDayOfMonth.setHours(0, 0, 0, 0);
        
        // Convertir en Timestamp Firestore
        const firstDayOfMonthTimestamp = Timestamp.fromDate(firstDayOfMonth);
        
        const monthlyQuery = query(
            paymentsCollection,
            where('routerId', '==', routerId),
            where('status', '==', 'completed'),
            where('createdAt', '>=', firstDayOfMonthTimestamp)
        );
        
        const monthlySnapshot = await getDocs(monthlyQuery);
        let monthlyRevenue = 0;
        
        monthlySnapshot.forEach((doc) => {
            const payment = doc.data();
            monthlyRevenue += payment.amount || 0;
        });
        
        const monthlyRevenueElement = document.getElementById('monthlyRevenue');
        if (monthlyRevenueElement) monthlyRevenueElement.textContent = monthlyRevenue + ' FCFA';
    } catch (error) {
        console.error('Erreur lors de la récupération des statistiques des paiements:', error);
    }
}

// La fonction updateNavigationLinks a été déplacée plus bas dans le fichier et exportée

// Partie 2: Chargement des paiements et graphique

/**
 * Charger la liste des paiements
 * @param {string} routerId - ID du routeur
 * @param {number} page - Numéro de page (commence à 1)
 * @param {number} limit - Nombre de paiements par page
 */
async function loadPaymentsList(routerId, page = 1, pageSize = 10) {
    try {
        console.log(`Chargement des paiements pour le routeur ${routerId}, page ${page}`);
        
        // Stocker la page courante dans une variable globale pour pouvoir y accéder depuis d'autres fonctions
        window.currentPaymentPage = page;
        
        // Vérifier si l'élément paymentsList existe
        const paymentsListElement = document.getElementById('paymentsList');
        if (!paymentsListElement) {
            console.warn("L'élément 'paymentsList' n'existe pas dans le DOM");
            return;
        }
        
        // Afficher un indicateur de chargement
        paymentsListElement.innerHTML = '<tr><td colspan="7" class="text-center"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Chargement...</span></div></td></tr>';
        
        // Référence aux paiements du routeur
        const paymentsCollection = collection(db, 'payments');
        
        // Construire la requête de base
        let paymentsQuery = query(
            paymentsCollection,
            where('routerId', '==', routerId),
            orderBy('createdAt', 'desc'),
            limit(pageSize)
        );
        
        // Si ce n'est pas la première page, ajouter le curseur pour la pagination
        if (page > 1) {
            // Récupérer les documents de la page précédente pour obtenir le curseur
            const prevPageQuery = query(
                paymentsCollection,
                where('routerId', '==', routerId),
                orderBy('createdAt', 'desc'),
                limit((page - 1) * pageSize)
            );
            
            const prevPageSnapshot = await getDocs(prevPageQuery);
            const lastVisible = prevPageSnapshot.docs[prevPageSnapshot.docs.length - 1];
            
            if (lastVisible) {
                // Mettre à jour la requête avec le curseur
                paymentsQuery = query(
                    paymentsCollection,
                    where('routerId', '==', routerId),
                    orderBy('createdAt', 'desc'),
                    startAfter(lastVisible),
                    limit(pageSize)
                );
            }
        }
        
        // Récupérer les paiements
        const querySnapshot = await getDocs(paymentsQuery);
        
        // Masquer le chargement
        paymentsListElement.innerHTML = '';
        
        if (querySnapshot.empty) {
            // Aucun paiement trouvé
            const noPaymentsElement = document.getElementById('noPaymentsMessage');
            if (noPaymentsElement) noPaymentsElement.classList.remove('d-none');
            return;
        }
        
        // Conteneur pour les paiements
        const paymentsList = document.getElementById('paymentsList');
        
        // Vérifier si l'élément existe avant de modifier son contenu
        if (paymentsList) {
            // Supprimer le message de chargement
            paymentsList.innerHTML = '';
            
            // Récupérer tous les paiements d'abord
            const payments = [];
            querySnapshot.forEach((doc) => {
                const payment = doc.data();
                payment.id = doc.id;
                payments.push(payment);
            });
            
            // Traiter les paiements pour récupérer les codes WiFi réels
            const processPayments = async () => {
                try {
                    // Pour chaque paiement qui a un codeId, récupérer le code WiFi réel
                    for (const payment of payments) {
                        if (payment.codeId) {
                            try {
                                const codeRef = doc(db, 'wifiCodes', payment.codeId);
                                const codeSnap = await getDoc(codeRef);
                                
                                if (codeSnap.exists()) {
                                    const codeData = codeSnap.data();
                                    // Stocker le code WiFi réel dans le paiement
                                    payment.wifiCodeValue = codeData.code || codeData.value || 'N/A';
                                    console.log(`Code WiFi récupéré pour le paiement ${payment.id}: ${payment.wifiCodeValue}`);
                                }
                            } catch (error) {
                                console.error(`Erreur lors de la récupération du code WiFi pour le paiement ${payment.id}:`, error);
                            }
                        }
                    }
                    
                    // Maintenant ajouter les lignes au tableau avec les codes WiFi réels
                    payments.forEach(payment => {
                        addPaymentRow(payment, paymentsList, routerId);
                    });
                } catch (error) {
                    console.error('Erreur lors du traitement des paiements:', error);
                }
            };
            
            // Lancer le traitement des paiements
            processPayments();
        } else {
            console.warn('Élément paymentsList non trouvé dans le DOM');
        }
        
        // Mettre à jour la pagination
        updatePagination(querySnapshot.size, page, pageSize, routerId);
    } catch (error) {
        console.error('Erreur lors de la récupération des paiements:', error);
        const loadingElement = document.getElementById('loadingPayments');
        if (loadingElement) loadingElement.classList.add('d-none');
        
        const noPaymentsElement = document.getElementById('noPaymentsMessage');
        if (noPaymentsElement) noPaymentsElement.classList.remove('d-none');
    }
}

// La fonction addMockPayments a été supprimée car nous utilisons maintenant des données réelles

/**
 * Ajouter une ligne pour un paiement
 * @param {Object} payment - Données du paiement
 * @param {HTMLElement} container - Conteneur pour la ligne
 * @param {string} routerId - ID du routeur
 */
function addPaymentRow(payment, container, routerId) {
    // Vérifier que le conteneur existe
    if (!container) {
        console.error("Le conteneur pour la ligne de paiement est null ou undefined");
        return;
    }
    
    // Vérifier que le paiement est valide
    if (!payment) {
        console.error("Les données du paiement sont null ou undefined");
        return;
    }
    
    // Créer une ligne
    const row = document.createElement('tr');
    
    // Formater la date avec vérification pour éviter les erreurs
    let formattedDate = 'N/A';
    
    // Essayer d'abord avec createdAt (champ standard de Firestore)
    if (payment.createdAt) {
        try {
            // Si c'est un timestamp Firestore, le convertir en Date
            if (payment.createdAt.toDate && typeof payment.createdAt.toDate === 'function') {
                formattedDate = payment.createdAt.toDate().toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } 
            // Si c'est déjà un objet Date
            else if (payment.createdAt instanceof Date) {
                formattedDate = payment.createdAt.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            // Si c'est une chaîne de date ou un timestamp
            else if (typeof payment.createdAt === 'string' || typeof payment.createdAt === 'number') {
                formattedDate = new Date(payment.createdAt).toLocaleDateString('fr-FR', {
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
            if (payment.date) {
                try {
                    if (payment.date.toDate && typeof payment.date.toDate === 'function') {
                        formattedDate = payment.date.toDate().toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    } else if (payment.date instanceof Date) {
                        formattedDate = payment.date.toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    } else if (typeof payment.date === 'string' || typeof payment.date === 'number') {
                        formattedDate = new Date(payment.date).toLocaleDateString('fr-FR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                        });
                    }
                } catch (error) {
                    console.warn('Erreur lors du formatage de la date de paiement:', error);
                    formattedDate = 'N/A';
                }
            }
        }
    } 
    // Si createdAt n'existe pas, essayer avec date
    else if (payment.date) {
        try {
            // Si c'est un timestamp Firestore, le convertir en Date
            if (payment.date.toDate && typeof payment.date.toDate === 'function') {
                formattedDate = payment.date.toDate().toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } 
            // Si c'est déjà un objet Date
            else if (payment.date instanceof Date) {
                formattedDate = payment.date.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            // Si c'est une chaîne de date ou un timestamp
            else if (typeof payment.date === 'string' || typeof payment.date === 'number') {
                formattedDate = new Date(payment.date).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        } catch (error) {
            console.warn('Erreur lors du formatage de la date de paiement:', error);
            formattedDate = 'N/A';
        }
    }
    
    // Méthode de paiement
    let methodText = '';
    switch (payment.method) {
        case 'cash':
            methodText = 'Espèces';
            break;
        case 'mobile_money':
            methodText = 'Mobile Money';
            break;
        case 'bank_transfer':
            methodText = 'Virement bancaire';
            break;
        case 'fedapay':
            methodText = 'FedaPay';
            break;
        default:
            methodText = 'Autre';
    }
    
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
    
    // Vérifier les données du paiement pour éviter les valeurs undefined
    const paymentId = payment.id || 'N/A';
    const clientName = payment.clientName || 'Client inconnu';
    const profileName = payment.profileName || 'Profil inconnu';
    // Récupérer le code WiFi réel au lieu de l'ID
    const codeValue = payment.wifiCodeValue || payment.wifiCode || payment.code || 'N/A';
    const amount = payment.amount ? `${payment.amount} FCFA` : 'N/A';
    
    // Remplir la ligne
    row.innerHTML = `
        <td><small class="text-muted">${paymentId}</small></td>
        <td>${formattedDate}</td>
        <td>${clientName}</td>
        <td>${profileName}</td>
        <td><code>${codeValue}</code></td>
        <td>${amount}</td>
        <td>${methodText}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>
            <div class="btn-group">
                <button type="button" class="btn btn-sm btn-outline-primary view-payment-btn" data-payment-id="${paymentId}">
                    <i class="fas fa-eye"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger delete-payment-btn" data-payment-id="${paymentId}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
    
    // Ajouter la ligne au conteneur
    container.appendChild(row);
    
    // Ajouter les gestionnaires d'événements pour les boutons avec vérification
    const viewBtn = row.querySelector('.view-payment-btn');
    if (viewBtn) {
        viewBtn.addEventListener('click', function() {
            showPaymentDetails(payment.id || '', routerId);
        });
    } else {
        console.warn("Bouton 'view-payment-btn' non trouvé dans la ligne de paiement");
    }
    
    // Le bouton d'édition a été supprimé
    
    const deleteBtn = row.querySelector('.delete-payment-btn');
    if (deleteBtn) {
        deleteBtn.addEventListener('click', function() {
            deletePayment(payment.id || '', routerId);
        });
    } else {
        console.warn("Bouton 'delete-payment-btn' non trouvé dans la ligne de paiement");
    }
}

/**
 * Mettre à jour la pagination
 * @param {number} totalItems - Nombre total d'éléments
 * @param {number} currentPage - Page actuelle
 * @param {number} itemsPerPage - Éléments par page
 * @param {string} routerId - ID du routeur
 */
function updatePagination(totalItems, currentPage, itemsPerPage, routerId) {
    const totalPages = Math.ceil(totalItems / itemsPerPage);
    const paginationContainer = document.getElementById('paymentsPagination');
    
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
        pageItem.addEventListener('click', function(e) {
            e.preventDefault();
            loadPaymentsList(routerId, i, itemsPerPage);
        });
    }
    
    // Bouton suivant
    const nextButton = document.createElement('li');
    nextButton.className = `page-item ${currentPage === totalPages ? 'disabled' : ''}`;
    nextButton.innerHTML = `<a class="page-link" href="#" ${currentPage === totalPages ? 'aria-disabled="true"' : ''}>Suivant</a>`;
    paginationContainer.appendChild(nextButton);
    
    // Gestionnaires d'événements pour les boutons précédent/suivant
    if (currentPage > 1) {
        prevButton.addEventListener('click', function(e) {
            e.preventDefault();
            loadPaymentsList(routerId, currentPage - 1, itemsPerPage);
        });
    }
    
    if (currentPage < totalPages) {
        nextButton.addEventListener('click', function(e) {
            e.preventDefault();
            loadPaymentsList(routerId, currentPage + 1, itemsPerPage);
        });
    }
}

// Variable globale pour stocker l'instance du graphique
let revenueChartInstance = null;

/**
 * Initialiser le graphique des revenus
 * @param {string} routerId - ID du routeur
 */
function initRevenueChart(routerId) {
    const canvas = document.getElementById('revenueChart');
    if (!canvas) return;
    
    // Détruire l'instance existante du graphique si elle existe
    if (revenueChartInstance) {
        revenueChartInstance.destroy();
        revenueChartInstance = null;
    }
    
    const ctx = canvas.getContext('2d');
    
    // Données initiales vides (seront remplies par updateChartData)
    const data = {
        labels: [],
        datasets: [{
            label: 'Revenus (FCFA)',
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
    revenueChartInstance = new Chart(ctx, config);
    
    // Gestionnaire d'événement pour les boutons de période
    document.querySelectorAll('.btn-group button[data-period]').forEach(button => {
        button.addEventListener('click', function() {
            // Mettre à jour le bouton actif
            document.querySelectorAll('.btn-group button[data-period]').forEach(btn => {
                btn.classList.remove('active');
            });
            this.classList.add('active');
            
            // Récupérer la période
            const period = this.dataset.period;
            
            // Mettre à jour les données du graphique
            updateChartData(revenueChartInstance, period, routerId);
        });
    });
}

/**
 * Afficher les détails d'un paiement
 * @param {string} paymentId - ID du paiement
 * @param {string} routerId - ID du routeur
 */
async function showPaymentDetails(paymentId, routerId) {
    try {
        console.log(`Chargement des détails du paiement ${paymentId} pour le routeur ${routerId}`);
        
        // Vérifier que le modal existe
        const modalElement = document.getElementById('paymentDetailsModal');
        if (!modalElement) {
            console.error("Modal des détails de paiement non trouvé dans le DOM");
            return;
        }
        
        // Initialiser le modal Bootstrap
        const modal = new bootstrap.Modal(modalElement);
        
        // Ajouter un indicateur de chargement
        const modalBody = modalElement.querySelector('.modal-body');
        if (modalBody) {
            // Ajouter un spinner de chargement si nécessaire
            if (!document.getElementById('paymentDetailsSpinner')) {
                const spinnerDiv = document.createElement('div');
                spinnerDiv.id = 'paymentDetailsSpinner';
                spinnerDiv.className = 'text-center my-4';
                spinnerDiv.innerHTML = `
                    <div class="spinner-border text-primary" role="status">
                        <span class="visually-hidden">Chargement...</span>
                    </div>
                    <p class="mt-2">Chargement des détails...</p>
                `;
                modalBody.prepend(spinnerDiv);
            } else {
                const spinner = document.getElementById('paymentDetailsSpinner');
                if (spinner) spinner.classList.remove('d-none');
            }
        }
        
        // Masquer les détails pendant le chargement
        const detailElements = [
            'detailPaymentId', 'detailPaymentDate', 'detailPaymentClient',
            'detailPaymentProfile', 'detailPaymentCode', 'detailPaymentAmount',
            'detailPaymentMethod', 'detailPaymentStatus', 'detailPaymentNote'
        ];
        
        detailElements.forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                // Sauvegarder le contenu original pour le restaurer en cas d'erreur
                element.dataset.originalContent = element.innerHTML;
                element.innerHTML = '<span class="placeholder-glow"><span class="placeholder col-12"></span></span>';
            }
        });
        
        // Afficher le modal pendant le chargement
        modal.show();
        
        // Récupérer les données réelles du paiement depuis Firestore
        const paymentRef = doc(db, 'payments', paymentId);
        const paymentSnap = await getDoc(paymentRef);
        
        if (!paymentSnap.exists()) {
            console.error(`Paiement avec ID ${paymentId} non trouvé dans Firestore`);
            
            // Afficher un message d'erreur dans le modal
            const alertDiv = document.createElement('div');
            alertDiv.className = 'alert alert-danger';
            alertDiv.textContent = 'Paiement non trouvé. Il a peut-être été supprimé.';
            
            // Nettoyer le modal body et afficher l'erreur
            if (modalBody) {
                // Supprimer le spinner
                const spinner = document.getElementById('paymentDetailsSpinner');
                if (spinner) spinner.remove();
                
                // Ajouter l'alerte au début
                modalBody.prepend(alertDiv);
                
                // Restaurer le contenu original des éléments
                detailElements.forEach(id => {
                    const element = document.getElementById(id);
                    if (element && element.dataset.originalContent) {
                        element.innerHTML = element.dataset.originalContent;
                    }
                });
            }
            
            return;
        }
        
        const payment = { id: paymentId, ...paymentSnap.data() };
        console.log('Données de paiement récupérées:', payment);
        
        // Formater les dates
        let formattedDate = 'N/A';
        if (payment.createdAt) {
            try {
                if (payment.createdAt.toDate && typeof payment.createdAt.toDate === 'function') {
                    formattedDate = payment.createdAt.toDate().toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else if (payment.createdAt instanceof Date) {
                    formattedDate = payment.createdAt.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else if (typeof payment.createdAt === 'string' || typeof payment.createdAt === 'number') {
                    formattedDate = new Date(payment.createdAt).toLocaleDateString('fr-FR', {
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
                if (payment.date) {
                    try {
                        if (payment.date.toDate && typeof payment.date.toDate === 'function') {
                            formattedDate = payment.date.toDate().toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        } else if (payment.date instanceof Date) {
                            formattedDate = payment.date.toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        } else if (typeof payment.date === 'string' || typeof payment.date === 'number') {
                            formattedDate = new Date(payment.date).toLocaleDateString('fr-FR', {
                                day: '2-digit',
                                month: '2-digit',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit'
                            });
                        }
                    } catch (error) {
                        console.warn('Erreur lors du formatage de la date de paiement:', error);
                        formattedDate = 'N/A';
                    }
                }
            }
        } else if (payment.date) {
            // Même logique que ci-dessus pour le champ date
            try {
                if (payment.date.toDate && typeof payment.date.toDate === 'function') {
                    formattedDate = payment.date.toDate().toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else if (payment.date instanceof Date) {
                    formattedDate = payment.date.toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                } else if (typeof payment.date === 'string' || typeof payment.date === 'number') {
                    formattedDate = new Date(payment.date).toLocaleDateString('fr-FR', {
                        day: '2-digit',
                        month: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                    });
                }
            } catch (error) {
                console.warn('Erreur lors du formatage de la date de paiement:', error);
                formattedDate = 'N/A';
            }
        }
        
        // Utiliser les fonctions de formatage pour la méthode de paiement et le statut
        const methodText = formatPaymentMethod(payment.method);
        
        // Utiliser la fonction de formatage pour la classe de badge de méthode
        const methodBadgeClass = getPaymentMethodBadgeClass(payment.method);
        
        // Utiliser la fonction de formatage pour le statut
        const { statusText, statusClass: statusBadgeClass } = formatPaymentStatus(payment.status);
        
        // Vérifier les données du paiement pour éviter les valeurs undefined
        const clientName = payment.clientName || 'Client inconnu';
        const profileName = payment.profileName || 'Profil inconnu';
        const codeValue = payment.code || 'N/A';
        const amount = payment.amount ? `${payment.amount} FCFA` : 'N/A';
        const note = payment.note || 'Aucune note';
        
        // Mettre à jour les éléments DOM avec les données du paiement
        const updateElement = (id, content, isHTML = false) => {
            const element = document.getElementById(id);
            if (element) {
                if (isHTML) {
                    element.innerHTML = content;
                } else {
                    element.textContent = content;
                }
            }
        };
        
        // Mettre à jour les éléments
        updateElement('detailPaymentId', paymentId);
        updateElement('detailPaymentDate', formattedDate);
        updateElement('detailPaymentClient', clientName);
        updateElement('detailPaymentProfile', profileName);
        updateElement('detailPaymentCode', codeValue);
        updateElement('detailPaymentAmount', amount);
        updateElement('detailPaymentMethod', `<span class="badge ${methodBadgeClass}">${methodText}</span>`, true);
        updateElement('detailPaymentStatus', `<span class="badge ${statusBadgeClass}">${statusText}</span>`, true);
        updateElement('detailPaymentNote', note);
        
        // Masquer le spinner de chargement
        const spinner = document.getElementById('paymentDetailsSpinner');
        if (spinner) spinner.remove();
        
    } catch (error) {
        console.error('Erreur lors de l\'affichage des détails du paiement:', error);
        
        // Gérer l'erreur dans l'interface
        const modalElement = document.getElementById('paymentDetailsModal');
        if (modalElement) {
            const modalBody = modalElement.querySelector('.modal-body');
            if (modalBody) {
                // Supprimer le spinner
                const spinner = document.getElementById('paymentDetailsSpinner');
                if (spinner) spinner.remove();
                
                // Ajouter un message d'erreur
                const alertDiv = document.createElement('div');
                alertDiv.className = 'alert alert-danger';
                alertDiv.textContent = `Erreur lors du chargement des détails du paiement: ${error.message}`;
                modalBody.prepend(alertDiv);
                
                // Restaurer le contenu original des éléments
                const detailElements = [
                    'detailPaymentId', 'detailPaymentDate', 'detailPaymentClient',
                    'detailPaymentProfile', 'detailPaymentCode', 'detailPaymentAmount',
                    'detailPaymentMethod', 'detailPaymentStatus', 'detailPaymentNote'
                ];
                
                detailElements.forEach(id => {
                    const element = document.getElementById(id);
                    if (element && element.dataset.originalContent) {
                        element.innerHTML = element.dataset.originalContent;
                    }
                });
            }
        }
    }
}

/**
 * Modifier un paiement
 * @param {string} paymentId - ID du paiement
 * @param {string} routerId - ID du routeur
 */
async function editPayment(paymentId, routerId) {
    try {
        console.log(`Préparation de la modification du paiement ${paymentId} pour le routeur ${routerId}`);
        
        // Vérifier que les éléments DOM existent avant de les utiliser
        const modalElement = document.getElementById('paymentFormModal');
        if (!modalElement) {
            console.error("Modal du formulaire de paiement non trouvé dans le DOM");
            return;
        }
        
        // Mettre à jour le titre du modal
        const modalTitle = document.getElementById('paymentFormModalLabel');
        if (modalTitle) {
            modalTitle.textContent = 'Modifier un paiement';
        }
        
        // Afficher un indicateur de chargement dans le modal
        const loadingElement = document.getElementById('loadingPaymentForm');
        if (loadingElement) {
            loadingElement.classList.remove('d-none');
        }
        
        // Masquer le formulaire pendant le chargement
        const formElement = document.getElementById('paymentForm');
        if (formElement) {
            formElement.classList.add('d-none');
        }
        
        // Récupérer les données réelles du paiement depuis Firestore
        const paymentRef = doc(db, 'payments', paymentId);
        const paymentSnap = await getDoc(paymentRef);
        
        if (!paymentSnap.exists()) {
            console.error(`Paiement avec ID ${paymentId} non trouvé dans Firestore`);
            
            // Afficher un message d'erreur dans le modal
            if (formElement) {
                formElement.innerHTML = `<div class="alert alert-danger">Paiement non trouvé. Il a peut-être été supprimé.</div>`;
                formElement.classList.remove('d-none');
            }
            
            // Masquer le chargement
            if (loadingElement) {
                loadingElement.classList.add('d-none');
            }
            
            // Afficher le modal malgré l'erreur
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
            
            return;
        }
        
        const payment = { id: paymentId, ...paymentSnap.data() };
        console.log('Données de paiement récupérées pour modification:', payment);
        
        // Charger les profils et les clients pour le formulaire
        await loadProfilesForFilters(routerId);
        await loadClientsForPaymentForm(routerId);
        
        // Sélectionner le profil du paiement
        const profileSelect = document.getElementById('paymentProfile');
        if (profileSelect && payment.profileId) {
            profileSelect.value = payment.profileId;
            
            // Charger les codes pour ce profil
            await loadCodesForPaymentForm(routerId, payment.profileId);
            
            // Sélectionner le code du paiement
            const codeSelect = document.getElementById('paymentCode');
            if (codeSelect && payment.codeId) {
                codeSelect.value = payment.codeId;
            }
        }
        
        // Sélectionner le client du paiement
        const clientSelect = document.getElementById('paymentClient');
        if (clientSelect && payment.clientId) {
            clientSelect.value = payment.clientId;
        }
        
        // Remplir les autres champs du formulaire
        const amountInput = document.getElementById('paymentAmount');
        if (amountInput) {
            amountInput.value = payment.amount || '';
        }
        
        const methodSelect = document.getElementById('paymentMethod');
        if (methodSelect) {
            methodSelect.value = payment.method || 'cash';
        }
        
        const statusSelect = document.getElementById('paymentStatus');
        if (statusSelect) {
            statusSelect.value = payment.status || 'completed';
        }
        
        const noteTextarea = document.getElementById('paymentNote');
        if (noteTextarea) {
            noteTextarea.value = payment.note || '';
        }
        
        // Stocker l'ID du paiement dans un champ caché
        const paymentIdInput = document.getElementById('paymentId');
        if (paymentIdInput) {
            paymentIdInput.value = paymentId;
        }
        
        // Masquer le chargement et afficher le formulaire
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        if (formElement) {
            formElement.classList.remove('d-none');
        }
        
        // Afficher le modal
        const modal = new bootstrap.Modal(modalElement);
        modal.show();
    } catch (error) {
        console.error('Erreur lors de la préparation de la modification du paiement:', error);
        
        // Gérer l'erreur dans l'interface
        const loadingElement = document.getElementById('loadingPaymentForm');
        if (loadingElement) {
            loadingElement.classList.add('d-none');
        }
        
        const formElement = document.getElementById('paymentForm');
        if (formElement) {
            formElement.innerHTML = `<div class="alert alert-danger">Erreur lors du chargement du formulaire: ${error.message}</div>`;
            formElement.classList.remove('d-none');
        }
        
        // Afficher le modal malgré l'erreur
        const modalElement = document.getElementById('paymentFormModal');
        if (modalElement) {
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        }
    }
}

/**
 * Supprimer un paiement
 * @param {string} paymentId - ID du paiement
 * @param {string} routerId - ID du routeur
 */
async function deletePayment(paymentId, routerId) {
    try {
        console.log(`Demande de suppression du paiement ${paymentId} pour le routeur ${routerId}`);
        
        // Demander confirmation avant de supprimer
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce paiement ? Cette action est irréversible.')) {
            return;
        }
        
        // Récupérer les données du paiement pour libérer le code WiFi si nécessaire
        const paymentRef = doc(db, 'payments', paymentId);
        const paymentSnap = await getDoc(paymentRef);
        
        if (!paymentSnap.exists()) {
            console.error(`Paiement avec ID ${paymentId} non trouvé dans Firestore`);
            alert('Paiement non trouvé. Il a peut-être déjà été supprimé.');
            return;
        }
        
        const payment = paymentSnap.data();
        console.log('Données de paiement récupérées pour suppression:', payment);
        
        // Si le paiement est associé à un code WiFi, le libérer (le rendre disponible)
        if (payment.codeId) {
            const codeRef = doc(db, 'wifiCodes', payment.codeId);
            await updateDoc(codeRef, {
                status: 'available',
                updatedAt: serverTimestamp()
            });
            console.log(`Code WiFi ${payment.codeId} libéré et marqué comme disponible`);
        }
        
        // Supprimer le paiement
        await deleteDoc(paymentRef);
        console.log(`Paiement ${paymentId} supprimé avec succès`);
        
        // Recharger la liste des paiements
        // Utiliser la page 1 par défaut au lieu de currentPage qui n'est pas défini
        loadPaymentsList(routerId, 1, 10);
        
        // Mettre à jour les statistiques
        loadPaymentStatistics(routerId);
        
        // Notification de succès
        alert('Paiement supprimé avec succès.');
    } catch (error) {
        console.error('Erreur lors de la suppression du paiement:', error);
        alert(`Erreur lors de la suppression du paiement: ${error.message}`);
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
    const loadingElement = document.getElementById('chartLoading');
    if (loadingElement) loadingElement.classList.remove('d-none');
    
    try {
        // Définir les paramètres de date en fonction de la période
        const now = new Date();
        let startDate;
        let labels = [];
        let format;
        
        switch (period) {
            case 'week':
                // Dernière semaine
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 6); // 7 jours en arrière
                labels = Array(7).fill().map((_, i) => {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
                });
                format = 'day';
                break;
                
            case 'month':
                // Dernier mois
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 30); // 30 jours en arrière
                // Diviser en semaines
                labels = ['Sem 1', 'Sem 2', 'Sem 3', 'Sem 4'];
                format = 'week';
                break;
                
            case 'year':
                // Dernière année
                startDate = new Date(now);
                startDate.setFullYear(now.getFullYear() - 1);
                startDate.setDate(1);
                labels = Array(12).fill().map((_, i) => {
                    const date = new Date(now.getFullYear(), i, 1);
                    return date.toLocaleDateString('fr-FR', { month: 'short' });
                });
                format = 'month';
                break;
                
            default:
                // Par défaut, dernière semaine
                startDate = new Date(now);
                startDate.setDate(now.getDate() - 6);
                labels = Array(7).fill().map((_, i) => {
                    const date = new Date(startDate);
                    date.setDate(startDate.getDate() + i);
                    return date.toLocaleDateString('fr-FR', { weekday: 'short' });
                });
                format = 'day';
        }
        
        // Convertir les dates en timestamps pour Firestore
        const startTimestamp = Timestamp.fromDate(startDate);
        const endTimestamp = Timestamp.fromDate(now);
        
        // Récupérer les paiements pour la période
        const paymentsCollection = collection(db, 'payments');
        const paymentsQuery = query(
            paymentsCollection,
            where('routerId', '==', routerId),
            where('createdAt', '>=', startTimestamp),
            where('createdAt', '<=', endTimestamp),
            orderBy('createdAt', 'asc')
        );
        
        const querySnapshot = await getDocs(paymentsQuery);
        
        // Préparer les données
        let data = Array(labels.length).fill(0);
        
        if (!querySnapshot.empty) {
            // Traiter les paiements
            querySnapshot.forEach((doc) => {
                const payment = doc.data();
                // Vérifier si createdAt existe et s'il a la méthode toDate (Timestamp Firestore)
                const date = payment.createdAt ? 
                    (typeof payment.createdAt.toDate === 'function' ? new Date(payment.createdAt.toDate()) : 
                    (payment.createdAt instanceof Date ? payment.createdAt : new Date())) : 
                    new Date();
                const amount = payment.amount || 0;
                
                // Déterminer l'index dans le tableau de données en fonction du format
                let index = 0;
                
                switch (format) {
                    case 'day':
                        // Calculer le nombre de jours depuis la date de début
                        const diffTime = Math.abs(paymentDate - startDate);
                        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                        index = Math.min(diffDays, 6); // Max 6 pour une semaine (index 0-6)
                        break;
                        
                    case 'week':
                        // Déterminer la semaine (0-3)
                        const weekDiff = Math.floor((paymentDate - startDate) / (7 * 24 * 60 * 60 * 1000));
                        index = Math.min(weekDiff, 3); // Max 3 pour un mois (index 0-3)
                        break;
                        
                    case 'month':
                        // Utiliser le mois comme index (0-11)
                        index = paymentDate.getMonth();
                        break;
                }
                
                // Ajouter le montant au bon index
                if (index >= 0 && index < data.length) {
                    data[index] += amount;
                }
            });
        }
        
        // Mettre à jour les données du graphique
        chart.data.labels = labels;
        chart.data.datasets[0].data = data;
        chart.update();
        
    } catch (error) {
        console.error('Erreur lors de la mise à jour du graphique:', error);
    } finally {
        // Masquer l'indicateur de chargement
        if (loadingElement) loadingElement.classList.add('d-none');
    }
}

// Partie 3: Chargement des profils et clients, gestion des détails

// La fonction loadProfilesForFilters a été déplacée pour éviter la duplication

/**
 * Ajouter des profils fictifs pour le filtre
 * @param {HTMLElement} container - Conteneur pour les profils
 */
function addMockProfilesToFilter(container) {
    // Données fictives pour le développement
    const mockProfiles = [
        { id: 'profile1', name: 'Journalier' },
        { id: 'profile2', name: 'Hebdomadaire' },
        { id: 'profile3', name: 'Mensuel' }
    ];
    
    // Ajouter chaque profil
    mockProfiles.forEach(profile => {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.name;
        container.appendChild(option);
    });
}

// La fonction loadClientsForForm a été déplacée pour éviter la duplication

/**
 * Ajouter des clients fictifs pour le formulaire
 * @param {HTMLElement} container - Conteneur pour les clients
 */
function addMockClientsToForm(container) {
    // Données fictives pour le développement
    const mockClients = [
        { id: 'client1', name: 'Jean Dupont' },
        { id: 'client2', name: 'Marie Koné' },
        { id: 'client3', name: 'Paul Mensah' },
        { id: 'client4', name: 'Sophie Adeyemi' },
        { id: 'client5', name: 'Luc Ouédraogo' }
    ];
    
    // Ajouter chaque client
    mockClients.forEach(client => {
        const option = document.createElement('option');
        option.value = client.id;
        option.textContent = client.name;
        container.appendChild(option);
    });
}

/**
 * Fonction pour formater la méthode de paiement
 * @param {string} method - Méthode de paiement
 * @returns {string} - Texte formaté de la méthode
 */
function formatPaymentMethod(method) {
    switch (method) {
        case 'cash':
            return 'Espèces';
        case 'mobile_money':
            return 'Mobile Money';
        case 'bank_transfer':
            return 'Virement bancaire';
        case 'fedapay':
            return 'FedaPay';
        default:
            return method || 'Autre';
    }
}

/**
 * Fonction pour formater le statut de paiement
 * @param {string} status - Statut du paiement
 * @returns {Object} - Classe et texte du statut
 */
function formatPaymentStatus(status) {
    let statusClass = '';
    let statusText = '';
    
    switch (status) {
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
            statusText = status || 'Inconnu';
    }
    
    return { statusClass, statusText };
}

/**
 * Fonction de formatage pour les badges de méthode de paiement
 * @param {string} method - Méthode de paiement
 * @returns {string} - Classe CSS pour le badge
 */
function getPaymentMethodBadgeClass(method) {
    switch (method) {
        case 'cash':
            return 'bg-success';
        case 'mobile_money':
            return 'bg-primary';
        case 'bank_transfer':
            return 'bg-info';
        case 'fedapay':
            return 'bg-warning';
        default:
            return 'bg-secondary';
    }
}

// La fonction deletePayment a été déplacée plus haut dans le fichier (version asynchrone)

// La fonction updateNavigationLinks a été déplacée pour éviter la duplication
// Cette fonction est déjà déclarée plus haut dans le fichier

// Partie 4: Gestionnaires d'événements

/**
 * Mettre à jour les liens de navigation pour un routeur spécifique
 * @param {string} routerId - ID du routeur
 */
export function updateNavigationLinks(routerId) {
    console.log('Mise à jour des liens de navigation pour le routeur:', routerId);
    
    // Configuration des liens de navigation du routeur
    const routerLinks = [
        { id: 'routerDashboardLink', href: 'router-dashboard.html' },
        { id: 'routerWifiCodesLink', href: 'wifi-codes.html' },
        { id: 'routerClientsLink', href: 'clients.html' },
        { id: 'routerPaymentsLink', href: 'payments.html' },
        { id: 'routerSettingsLink', href: 'router-settings.html' }
    ];
    
    // Mettre à jour chaque lien avec l'ID du routeur
    routerLinks.forEach(linkInfo => {
        const link = document.getElementById(linkInfo.id);
        if (link) {
            // Ajouter l'ID du routeur comme paramètre d'URL
            link.href = `${linkInfo.href}?id=${routerId}`;
            
            // Marquer le lien actif en fonction de la page courante
            const currentPage = window.location.pathname.split('/').pop();
            if (linkInfo.href === currentPage) {
                link.classList.add('active');
            } else {
                link.classList.remove('active');
            }
            
            console.log(`Lien ${linkInfo.id} mis à jour: ${link.href}`);
        } else {
            console.warn(`Élément ${linkInfo.id} non trouvé dans le DOM`);
        }
    });
    
    // Récupérer tous les autres liens de navigation avec classe router-nav-link
    const navLinks = document.querySelectorAll('.router-nav-link');
    navLinks.forEach(link => {
        const href = link.getAttribute('data-href');
        if (href) {
            // Ajouter l'ID du routeur comme paramètre d'URL
            link.href = `${href}?id=${routerId}`;
            console.log(`Lien router-nav-link mis à jour: ${link.href}`);
        }
    });
}

/**
 * Configurer les gestionnaires d'événements
 * @param {string} routerId - ID du routeur
 */
export function setupEventHandlers(routerId) {
    // Vérifier si nous sommes sur la bonne page
    // Certains éléments peuvent ne pas exister sur toutes les pages
    const isPaymentsPage = window.location.pathname.includes('payments.html');
    const isClientsPage = window.location.pathname.includes('clients.html');
    
    console.log('Configuration des gestionnaires d\'\u00e9v\u00e9nements communs pour la page:', window.location.pathname);
    
    // Gestionnaire pour le filtre de date - spécifique à la page des paiements
    const dateRangeFilter = document.getElementById('dateRangeFilter');
    if (dateRangeFilter && isPaymentsPage) {
        dateRangeFilter.addEventListener('change', function() {
            // Afficher/masquer les dates personnalisées
            const customDateRange = document.getElementById('customDateRange');
            if (this.value === 'custom') {
                customDateRange.classList.remove('d-none');
            } else {
                customDateRange.classList.add('d-none');
            }
        });
    }
    
    // Gestionnaire pour le bouton d'application des filtres
    const applyFiltersBtn = document.getElementById('applyFiltersBtn');
    if (applyFiltersBtn && isPaymentsPage) {
        applyFiltersBtn.addEventListener('click', function() {
            // Récupérer les valeurs des filtres
            const dateRangeFilter = document.getElementById('dateRangeFilter');
            const statusFilter = document.getElementById('statusFilter');
            const profileFilter = document.getElementById('profileFilter');
            
            const dateRange = dateRangeFilter ? dateRangeFilter.value : null;
            const status = statusFilter ? statusFilter.value : null;
            const profile = profileFilter ? profileFilter.value : null;
            
            // Dates personnalisées
            let startDate = null;
            let endDate = null;
            if (dateRange === 'custom') {
                const startDateElem = document.getElementById('startDate');
                const endDateElem = document.getElementById('endDate');
                startDate = startDateElem ? startDateElem.value : null;
                endDate = endDateElem ? endDateElem.value : null;
            }
            
            // Appliquer les filtres
            console.log('Filtres appliqués:', { dateRange, status, profile, startDate, endDate });
            
            // Recharger la liste des paiements (pour le développement)
            if (isPaymentsPage) {
                loadPaymentsList(routerId);
            }
        });
    }
    
    // Gestionnaire pour la recherche
    const searchInput = document.getElementById('searchPayment');
    if (searchInput && isPaymentsPage) {
        searchInput.addEventListener('input', function() {
            // Filtrer les paiements
            filterPayments(this.value, routerId);
        });
    }
    
    // Gestionnaire pour le bouton d'effacement de la recherche
    const clearSearchBtn = document.getElementById('clearSearchBtn');
    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', function() {
            // Effacer la recherche
            const searchPayment = document.getElementById('searchPayment');
            if (searchPayment) {
                searchPayment.value = '';
            }
            
            // Recharger la liste des paiements
            if (isPaymentsPage) {
                loadPaymentsList(routerId);
            }
        });
    }
    
    // Gestionnaire pour le changement de méthode de paiement
    const paymentMethod = document.getElementById('paymentMethod');
    const processFedaPayBtn = document.getElementById('processFedaPayBtn');
    
    if (paymentMethod && processFedaPayBtn) {
        paymentMethod.addEventListener('change', function() {
            // Afficher ou masquer le bouton FedaPay en fonction de la méthode sélectionnée
            if (this.value === 'fedapay') {
                processFedaPayBtn.classList.remove('d-none');
            } else {
                processFedaPayBtn.classList.add('d-none');
            }
        });
    }
    
    // Gestionnaire pour le bouton de paiement FedaPay
    if (processFedaPayBtn) {
        processFedaPayBtn.addEventListener('click', function() {
            // Récupérer les valeurs du formulaire
            const clientSelect = document.getElementById('paymentClient');
            const clientName = clientSelect.options[clientSelect.selectedIndex].text;
            const profileSelect = document.getElementById('paymentProfile');
            const profileName = profileSelect.options[profileSelect.selectedIndex].text;
            const code = document.getElementById('paymentCode').value;
            const amount = parseFloat(document.getElementById('paymentAmount').value);
            
            // Validation basique
            if (!clientSelect.value || !profileSelect.value || !code || isNaN(amount)) {
                const errorElement = document.getElementById('paymentFormError');
                errorElement.textContent = 'Veuillez remplir tous les champs obligatoires';
                errorElement.classList.remove('d-none');
                return;
            }
            
            // Récupérer les informations du routeur pour la clé API FedaPay
            getDoc(doc(db, 'routers', routerId))
                .then((docSnapshot) => {
                    if (docSnapshot.exists()) {
                        const router = docSnapshot.data();
                        const fedapayApiKey = router.fedapayApiKey;
                        const testMode = router.testMode !== false; // Par défaut en mode test
                        
                        if (!fedapayApiKey) {
                            throw new Error('Clé API FedaPay non configurée pour ce routeur');
                        }
                        
                        // Initialiser FedaPay
                        initFedaPay(fedapayApiKey, testMode);
                        
                        // Créer une transaction FedaPay
                        createFedaPayTransaction({
                            amount: amount,
                            description: `Achat de code WiFi - ${profileName} - ${code}`,
                            clientName: clientName,
                            clientPhone: document.getElementById('paymentClientPhone')?.value || '',
                            onSuccess: function(response) {
                                // Enregistrer le paiement dans Firestore
                                savePaymentWithFedaPay(routerId, {
                                    clientId: clientSelect.value,
                                    clientName: clientName,
                                    profileId: profileSelect.value,
                                    profileName: profileName,
                                    code: code,
                                    amount: amount,
                                    method: 'fedapay',
                                    status: 'completed',
                                    note: document.getElementById('paymentNote').value.trim(),
                                    fedapayTransactionId: response.id || response.transaction_id,
                                    fedapayResponse: response
                                });
                            },
                            onError: function(error) {
                                console.error('Erreur FedaPay:', error);
                                const errorElement = document.getElementById('paymentFormError');
                                errorElement.textContent = 'Erreur lors du paiement: ' + (error.message || 'Veuillez réessayer');
                                errorElement.classList.remove('d-none');
                            },
                            onClose: function() {
                                // Ne rien faire si l'utilisateur ferme le modal
                            }
                        });
                    } else {
                        throw new Error('Routeur non trouvé');
                    }
                })
                .catch((error) => {
                    console.error('Erreur lors de la récupération des informations du routeur:', error);
                    const errorElement = document.getElementById('paymentFormError');
                    errorElement.textContent = error.message || 'Erreur lors de l\'initialisation du paiement';
                    errorElement.classList.remove('d-none');
                });
        });
    }
    
    // Gestionnaire pour le formulaire d'ajout de paiement
    const savePaymentBtn = document.getElementById('savePaymentBtn');
    if (savePaymentBtn) {
        savePaymentBtn.addEventListener('click', function() {
            // Récupérer les valeurs du formulaire
            const clientSelect = document.getElementById('paymentClient');
            const clientName = clientSelect.options[clientSelect.selectedIndex].text;
            const profileSelect = document.getElementById('paymentProfile');
            const profileName = profileSelect.options[profileSelect.selectedIndex].text;
            const code = document.getElementById('paymentCode').value;
            const amount = parseFloat(document.getElementById('paymentAmount').value);
            const method = document.getElementById('paymentMethod').value;
            const status = document.getElementById('paymentStatus').value;
            const note = document.getElementById('paymentNote').value.trim();
            
            // Validation basique
            if (!clientSelect.value || !profileSelect.value || !code || isNaN(amount)) {
                const errorElement = document.getElementById('paymentFormError');
                errorElement.textContent = 'Veuillez remplir tous les champs obligatoires';
                errorElement.classList.remove('d-none');
                return;
            }
            
            // Si c'est un paiement FedaPay, utiliser le bouton dédié
            if (method === 'fedapay') {
                const errorElement = document.getElementById('paymentFormError');
                errorElement.textContent = 'Pour un paiement en ligne, veuillez utiliser le bouton "Procéder au paiement en ligne"';
                errorElement.classList.remove('d-none');
                return;
            }
            
            // Afficher le spinner
            const spinner = document.getElementById('savePaymentSpinner');
            spinner.classList.remove('d-none');
            savePaymentBtn.disabled = true;
            
            // Vérifier s'il s'agit d'une modification ou d'un ajout
            const paymentId = savePaymentBtn.dataset.paymentId;
            
            // Préparer les données du paiement
            const paymentData = {
                routerId: routerId,
                clientId: clientSelect.value,
                clientName: clientName,
                profileId: profileSelect.value,
                profileName: profileName,
                code: code,
                amount: amount,
                method: method,
                status: status,
                note: note,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };
            
            // Enregistrer le paiement dans Firestore
            if (paymentId) {
                // Mise à jour d'un paiement existant
                const paymentDocRef = doc(db, 'payments', paymentId);
                updateDoc(paymentDocRef, {
                    ...paymentData,
                    createdAt: serverTimestamp() // Ne pas écraser la date de création
                })
                .then(() => {
                    // Fermer le modal
                    const modalElement = document.getElementById('addPaymentModal');
                    if (modalElement) {
                        const modal = bootstrap.Modal.getInstance(modalElement);
                        if (modal) {
                            modal.hide();
                        } else {
                            console.warn('Instance du modal non trouvée');
                        }
                    } else {
                        console.warn('Élément addPaymentModal non trouvé dans le DOM');
                    }
                    
                    // Recharger la liste des paiements
                    loadPaymentsList(routerId);
                    
                    // Réinitialiser le formulaire
                    const addPaymentForm = document.getElementById('addPaymentForm');
                    if (addPaymentForm) {
                        addPaymentForm.reset();
                    } else {
                        console.warn('Élément addPaymentForm non trouvé dans le DOM');
                    }
                    
                    const paymentFormError = document.getElementById('paymentFormError');
                    if (paymentFormError) {
                        paymentFormError.classList.add('d-none');
                    }
                    
                    // Masquer le spinner
                    if (spinner) {
                        spinner.classList.add('d-none');
                    }
                    
                    if (savePaymentBtn) {
                        savePaymentBtn.disabled = false;
                    }
                    
                    // Réinitialiser le titre du modal et le bouton
                    const addPaymentModalLabel = document.getElementById('addPaymentModalLabel');
                    if (addPaymentModalLabel) {
                        addPaymentModalLabel.textContent = 'Enregistrer un paiement';
                    }
                    
                    if (savePaymentBtn) {
                        savePaymentBtn.textContent = 'Enregistrer';
                        delete savePaymentBtn.dataset.paymentId;
                    }
                })
                .catch((error) => {
                    console.error('Erreur lors de la mise à jour du paiement:', error);
                    const errorElement = document.getElementById('paymentFormError');
                    if (errorElement) {
                        errorElement.textContent = 'Erreur lors de la mise à jour du paiement: ' + error.message;
                        errorElement.classList.remove('d-none');
                    } else {
                        console.warn('Élément paymentFormError non trouvé dans le DOM');
                    }
                    
                    // Masquer le spinner
                    if (spinner) {
                        spinner.classList.add('d-none');
                    }
                    
                    if (savePaymentBtn) {
                        savePaymentBtn.disabled = false;
                    }
                });
            } else {
                // Ajout d'un nouveau paiement
                const paymentsCollection = collection(db, 'payments');
                addDoc(paymentsCollection, paymentData)
                .then(() => {
                    // Fermer le modal
                    const modalElement = document.getElementById('addPaymentModal');
                    if (modalElement) {
                        const modal = bootstrap.Modal.getInstance(modalElement);
                        if (modal) {
                            modal.hide();
                        } else {
                            console.warn('Instance du modal non trouvée');
                        }
                    } else {
                        console.warn('Élément addPaymentModal non trouvé dans le DOM');
                    }
                    
                    // Recharger la liste des paiements
                    loadPaymentsList(routerId);
                    
                    // Réinitialiser le formulaire
                    const addPaymentForm = document.getElementById('addPaymentForm');
                    if (addPaymentForm) {
                        addPaymentForm.reset();
                    } else {
                        console.warn('Élément addPaymentForm non trouvé dans le DOM');
                    }
                    
                    const paymentFormError = document.getElementById('paymentFormError');
                    if (paymentFormError) {
                        paymentFormError.classList.add('d-none');
                    }
                    
                    // Masquer le spinner
                    if (spinner) {
                        spinner.classList.add('d-none');
                    }
                    
                    if (savePaymentBtn) {
                        savePaymentBtn.disabled = false;
                    }
                })
                .catch((error) => {
                    console.error('Erreur lors de l\'ajout du paiement:', error);
                    const errorElement = document.getElementById('paymentFormError');
                    if (errorElement) {
                        errorElement.textContent = 'Erreur lors de l\'ajout du paiement: ' + error.message;
                        errorElement.classList.remove('d-none');
                    } else {
                        console.warn('Élément paymentFormError non trouvé dans le DOM');
                    }
                    
                    // Masquer le spinner
                    if (spinner) {
                        spinner.classList.add('d-none');
                    }
                    
                    if (savePaymentBtn) {
                        savePaymentBtn.disabled = false;
                    }
                });
            }
        });
    }
    
    // Gestionnaire pour l'ajout rapide d'un client
    const saveQuickClientBtn = document.getElementById('saveQuickClientBtn');
    if (saveQuickClientBtn) {
        saveQuickClientBtn.addEventListener('click', function() {
            // Récupérer les valeurs du formulaire
            const quickClientNameElement = document.getElementById('quickClientName');
            const quickClientWhatsappElement = document.getElementById('quickClientWhatsapp');
            
            if (!quickClientNameElement || !quickClientWhatsappElement) {
                console.error('Les éléments du formulaire d\'ajout rapide de client sont introuvables');
                return;
            }
            
            const name = quickClientNameElement.value.trim();
            const whatsapp = quickClientWhatsappElement.value.trim();
            
            // Validation basique
            if (!name || !whatsapp) {
                const errorElement = document.getElementById('quickClientFormError');
                if (errorElement) {
                    errorElement.textContent = 'Veuillez remplir tous les champs obligatoires';
                    errorElement.classList.remove('d-none');
                } else {
                    console.warn('Élément quickClientFormError non trouvé dans le DOM');
                }
                return;
            }
            
            // Afficher le spinner
            const spinner = document.getElementById('saveQuickClientSpinner');
            if (spinner) {
                spinner.classList.remove('d-none');
            }
            
            if (saveQuickClientBtn) {
                saveQuickClientBtn.disabled = true;
            }
            
            // Simuler l'enregistrement
            setTimeout(() => {
                console.log('Nouveau client:', { name, whatsapp, routerId });
                
                // Ajouter le client à la liste déroulante
                const clientSelect = document.getElementById('paymentClient');
                if (clientSelect) {
                    const option = document.createElement('option');
                    option.value = 'new-client-' + Date.now(); // ID temporaire
                    option.textContent = name;
                    clientSelect.appendChild(option);
                    clientSelect.value = option.value;
                    console.log(`Client ${name} ajouté à la liste déroulante`);
                } else {
                    console.warn('Élément paymentClient non trouvé dans le DOM');
                }
                
                // Fermer le modal
                const modalElement = document.getElementById('quickAddClientModal');
                if (modalElement) {
                    const modal = bootstrap.Modal.getInstance(modalElement);
                    if (modal) {
                        modal.hide();
                    } else {
                        console.warn('Instance du modal quickAddClientModal non trouvée');
                    }
                } else {
                    console.warn('Élément quickAddClientModal non trouvé dans le DOM');
                }
                
                // Réinitialiser le formulaire
                const quickAddClientForm = document.getElementById('quickAddClientForm');
                if (quickAddClientForm) {
                    quickAddClientForm.reset();
                } else {
                    console.warn('Élément quickAddClientForm non trouvé dans le DOM');
                }
                
                const quickClientFormError = document.getElementById('quickClientFormError');
                if (quickClientFormError) {
                    quickClientFormError.classList.add('d-none');
                }
                
                // Masquer le spinner
                if (spinner) {
                    spinner.classList.add('d-none');
                }
                
                if (saveQuickClientBtn) {
                    saveQuickClientBtn.disabled = false;
                }
            }, 1000);
        });
    }
    
    // Gestionnaire pour le bouton d'impression du reçu
    const printReceiptBtn = document.getElementById('printReceiptBtn');
    if (printReceiptBtn) {
        printReceiptBtn.addEventListener('click', function() {
            // Simuler l'impression
            console.log('Impression du reçu');
            alert('Fonctionnalité d\'impression en cours de développement');
        });
    }
    
    // Gestionnaire pour l'ouverture du modal d'ajout de paiement
    const addPaymentModal = document.getElementById('addPaymentModal');
    if (addPaymentModal) {
        addPaymentModal.addEventListener('show.bs.modal', function() {
            console.log('Ouverture du modal d\'ajout de paiement');
            
            // Recharger les profils et les clients à chaque ouverture du modal
            loadProfilesForFilters(routerId);
            loadClientsForForm(routerId);
            
            // Réinitialiser le formulaire
            const addPaymentForm = document.getElementById('addPaymentForm');
            if (addPaymentForm) {
                addPaymentForm.reset();
            }
            
            // Réinitialiser les messages d'erreur
            const paymentFormError = document.getElementById('paymentFormError');
            if (paymentFormError) {
                paymentFormError.classList.add('d-none');
            }
            
            console.log('Profils et clients rechargés pour le modal d\'ajout de paiement');
        });
    } else {
        console.warn('Élément addPaymentModal non trouvé dans le DOM');
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

/**
 * Enregistrer un paiement effectué via FedaPay
 * @param {string} routerId - ID du routeur
 * @param {Object} paymentData - Données du paiement
 */
function savePaymentWithFedaPay(routerId, paymentData) {
    // Ajouter les informations manquantes
    const completePaymentData = {
        ...paymentData,
        routerId: routerId,
        createdAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
    };
    
    // Enregistrer le paiement dans Firestore
    const paymentsCollection = collection(db, 'payments');
    addDoc(paymentsCollection, completePaymentData)
        .then(() => {
            // Fermer le modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('addPaymentModal'));
            modal.hide();
            
            // Recharger la liste des paiements
            loadPaymentsList(routerId);
            
            // Réinitialiser le formulaire
            document.getElementById('addPaymentForm').reset();
            document.getElementById('paymentFormError').classList.add('d-none');
            
            // Afficher un message de succès
            alert('Paiement effectué avec succès!');
        })
        .catch((error) => {
            console.error('Erreur lors de l\'enregistrement du paiement FedaPay:', error);
            const errorElement = document.getElementById('paymentFormError');
            errorElement.textContent = 'Erreur lors de l\'enregistrement du paiement: ' + error.message;
            errorElement.classList.remove('d-none');
        });
}

/**
 * Filtrer les paiements
 * @param {string} query - Requête de recherche
 * @param {string} routerId - ID du routeur
 */
function filterPayments(query, routerId) {
    if (!query) {
        // Si la requête est vide, recharger tous les paiements
        loadPaymentsList(routerId);
        return;
    }
    
    // Convertir la requête en minuscules pour une recherche insensible à la casse
    query = query.toLowerCase();
    
    // Simuler le filtrage
    console.log('Filtrage des paiements:', query);
    
    // Recharger la liste des paiements (pour le développement)
    loadPaymentsList(routerId);
}
