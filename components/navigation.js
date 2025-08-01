/**
 * Module de navigation pour FastNetLite
 * Ce script charge dynamiquement le menu de navigation dans toutes les pages
 * et gère l'activation des liens en fonction de la page courante
 */

// Note: Les fonctions utilitaires pour la gestion des routeurs sont disponibles via window.routerUtils
// Assurez-vous que router-utils.js est chargé avant ce script

document.addEventListener('DOMContentLoaded', async () => {
    // Vérifier si les utilitaires routeur sont disponibles
    if (!window.routerUtils) {
        console.warn('routerUtils non disponible. Certaines fonctionnalités de navigation peuvent être limitées.');
        // Créer un objet vide pour éviter les erreurs
        window.routerUtils = {
            getRouterId: function() {
                const urlParams = new URLSearchParams(window.location.search);
                let routerId = urlParams.get('routerId') || urlParams.get('id');
                console.log('ID du routeur détecté (fallback):', routerId || 'aucun');
                return routerId;
            },
            isRouterPage: function() {
                return this.getRouterId() !== null;
            },
            updateRouterNavigationLinks: function() {
                console.warn('Fonction updateRouterNavigationLinks non disponible');
            }
        };
    }
    
    // Élément où insérer la navigation
    const navContainer = document.getElementById('navigation-container');
    if (!navContainer) {
        console.error("Conteneur de navigation non trouvé. Assurez-vous d'ajouter un div avec id='navigation-container' dans vos pages.");
        return;
    }

    try {
        // Charger le contenu du fichier de navigation
        const response = await fetch('./components/navigation.html');
        if (!response.ok) {
            throw new Error(`Erreur lors du chargement de la navigation: ${response.status}`);
        }
        
        const navigationHTML = await response.text();
        
        // Insérer le HTML dans le conteneur
        navContainer.innerHTML = navigationHTML;
        
        // Activer le lien correspondant à la page courante
        activateCurrentPageLink();
        
        // Configurer la navigation secondaire du routeur si nécessaire
        setupRouterNavigation();
        
        // Configurer le bouton de déconnexion
        setupLogoutButton();
        
        // Afficher le nom de l'utilisateur connecté
        displayUserName();
        
    } catch (error) {
        console.error("Erreur lors du chargement de la navigation:", error);
        navContainer.innerHTML = `
            <div class="alert alert-danger">
                Impossible de charger la navigation. Veuillez rafraîchir la page ou contacter l'administrateur.
            </div>
        `;
    }
});

/**
 * Active le lien correspondant à la page courante
 */
function activateCurrentPageLink() {
    // Récupérer le nom de la page courante à partir de l'URL
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Retirer la classe active de tous les liens
    document.querySelectorAll('#mainNavigation .nav-link').forEach(link => {
        link.classList.remove('active');
    });
    
    // Activer le lien correspondant à la page courante
    let linkToActivate;
    
    switch (true) {
        case currentPage.includes('dashboard'):
            linkToActivate = document.getElementById('nav-dashboard');
            break;
        case currentPage.includes('routers'):
            linkToActivate = document.getElementById('nav-routers');
            break;
        case currentPage.includes('stats'):
            linkToActivate = document.getElementById('nav-stats');
            break;
        case currentPage.includes('logs'):
            linkToActivate = document.getElementById('nav-logs');
            break;
        case currentPage.includes('notifications'):
            linkToActivate = document.getElementById('nav-notifications');
            break;
        case currentPage.includes('settings'):
            linkToActivate = document.getElementById('nav-settings');
            break;
        // Ajouter d'autres cas si nécessaire
    }
    
    if (linkToActivate) {
        linkToActivate.classList.add('active');
    }
}

/**
 * Configure la navigation secondaire pour les pages de routeur
 */
function setupRouterNavigation() {
    console.log('Initialisation de la navigation du routeur');
    // Utiliser la fonction utilitaire pour récupérer l'ID du routeur
    const routerId = window.routerUtils.getRouterId();
    console.log('ID du routeur détecté:', routerId);
    
    if (!routerId) {
        // Pas sur une page de routeur, masquer la navigation secondaire
        const routerSubNav = document.getElementById('routerSubNav');
        if (routerSubNav) {
            routerSubNav.classList.add('d-none');
        }
        // Retirer les classes CSS spécifiques au routeur
        document.body.classList.remove('has-router-sidebar');
        document.body.classList.remove('has-router-bottom-nav');
        return;
    }
    
    // Nous sommes sur une page de routeur, afficher la navigation secondaire
    const routerSubNav = document.getElementById('routerSubNav');
    if (routerSubNav) {
        routerSubNav.classList.remove('d-none');
        
        // Ajouter les classes CSS pour le positionnement du menu secondaire
        if (window.innerWidth >= 992) {
            // Version desktop: sidebar
            document.body.classList.add('has-router-sidebar');
            document.body.classList.remove('has-router-bottom-nav');
            
            // Appliquer la classe router-sidebar au conteneur principal
            routerSubNav.classList.add('router-sidebar');
            
            // S'assurer que les éléments sont disposés verticalement
            const navPills = routerSubNav.querySelector('.nav-pills');
            if (navPills) {
                navPills.classList.add('flex-column');
                navPills.classList.remove('flex-nowrap');
            }
        } else {
            // Version mobile: barre de navigation en bas
            document.body.classList.add('has-router-bottom-nav');
            document.body.classList.remove('has-router-sidebar');
            
            // Retirer la classe router-sidebar du conteneur principal
            routerSubNav.classList.remove('router-sidebar');
            
            // Rétablir la disposition horizontale pour mobile
            const navPills = routerSubNav.querySelector('.nav-pills');
            if (navPills) {
                navPills.classList.remove('flex-column');
                navPills.classList.add('flex-nowrap');
            }
        }
        
        // Utiliser la fonction utilitaire pour mettre à jour les liens de navigation
        // S'assurer que la fonction existe avant de l'appeler
        if (typeof window.routerUtils !== 'undefined' && typeof window.routerUtils.updateRouterNavigationLinks === 'function') {
            window.routerUtils.updateRouterNavigationLinks(routerId);
        } else {
            console.error('La fonction updateRouterNavigationLinks n\'est pas disponible');
            // Mise à jour manuelle des liens si la fonction n'est pas disponible
            updateRouterLinksManually(routerId);
        }
        
        // Activer le lien correspondant à la page courante
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        // Désactiver tous les liens d'abord
        document.querySelectorAll('#routerSubNav .nav-link').forEach(link => {
            link.classList.remove('active');
        });
        
        // Déterminer quel lien activer en fonction de la page courante
        let activeNavId = null;
        
        // Mapper les pages aux IDs de navigation
        if (currentPage.includes('router-dashboard')) {
            activeNavId = 'nav-router-dashboard';
        } else if (currentPage.includes('clients')) {
            activeNavId = 'nav-router-users';
        } else if (currentPage.includes('wifi-codes')) {
            activeNavId = 'nav-router-wifi-codes';
        } else if (currentPage.includes('payments')) {
            activeNavId = 'nav-router-payments';
        } else if (currentPage.includes('router-settings')) {
            activeNavId = 'nav-router-settings';
        }
        
        // Activer le lien correspondant s'il existe
        if (activeNavId) {
            const activeLink = document.getElementById(activeNavId);
            if (activeLink) {
                activeLink.classList.add('active');
                console.log('Lien activé:', activeNavId);
            }
        } else {
            console.log('Aucun lien à activer pour la page:', currentPage);
        }
        
        // Afficher le nom du routeur
        displayRouterName(routerId);
        
        // Gérer le redimensionnement de la fenêtre
        window.addEventListener('resize', handleRouterNavResponsive);
    }
}

/**
 * Met à jour manuellement les liens de navigation du routeur
 * @param {string} routerId - L'ID du routeur
 */
function updateRouterLinksManually(routerId) {
    if (!routerId) {
        console.warn('Tentative de mise à jour manuelle des liens sans ID de routeur');
        return;
    }
    
    // Définir les liens avec leurs IDs et URLs
    const links = {
        'nav-router-dashboard': `router-dashboard.html?id=${routerId}`,
        'nav-router-users': `clients.html?id=${routerId}`,
        'nav-router-wifi-codes': `wifi-codes.html?id=${routerId}`,
        'nav-router-payments': `payments.html?id=${routerId}`,
        'nav-router-settings': `router-settings.html?id=${routerId}`
    };
    
    // Mettre à jour chaque lien
    Object.entries(links).forEach(([id, href]) => {
        const link = document.getElementById(id);
        if (link) {
            // Mettre à jour l'attribut href explicitement
            link.setAttribute('href', href);
            console.log(`Mise à jour manuelle du lien ${id} vers ${href}`);
        } else {
            console.warn(`Lien avec ID ${id} non trouvé dans le DOM`);
        }
    });
}

/**
 * Gère le comportement responsive du menu secondaire
 */
function handleRouterNavResponsive() {
    const routerSubNav = document.getElementById('routerSubNav');
    if (!routerSubNav || routerSubNav.classList.contains('d-none')) {
        return;
    }
    
    const navPills = routerSubNav.querySelector('.nav-pills');
    
    if (window.innerWidth >= 992) {
        // Version desktop: sidebar
        document.body.classList.add('has-router-sidebar');
        document.body.classList.remove('has-router-bottom-nav');
        routerSubNav.classList.add('router-sidebar');
        
        // S'assurer que les éléments sont disposés verticalement
        if (navPills) {
            navPills.classList.add('flex-column');
            navPills.classList.remove('flex-nowrap');
        }
    } else {
        // Version mobile: barre de navigation en bas
        document.body.classList.add('has-router-bottom-nav');
        document.body.classList.remove('has-router-sidebar');
        routerSubNav.classList.remove('router-sidebar');
        
        // Rétablir la disposition horizontale pour mobile
        if (navPills) {
            navPills.classList.remove('flex-column');
            navPills.classList.add('flex-nowrap');
        }
    }
}

/**
 * Affiche le nom du routeur dans la navigation secondaire
 */
async function displayRouterName(routerId) {
    try {
        console.log('Tentative d\'affichage du nom du routeur:', routerId);
        const routerNameElement = document.getElementById('currentRouterName');
        if (!routerNameElement) {
            console.warn('L\'élément pour afficher le nom du routeur n\'existe pas');
            return;
        }
        
        // D'abord, afficher un nom temporaire
        routerNameElement.textContent = 'Routeur ' + routerId.substring(0, 4);
        
        // Attendre que Firebase soit disponible (max 5 secondes)
        let attempts = 0;
        const maxAttempts = 10; // 10 tentatives de 500ms = 5 secondes max
        
        while (attempts < maxAttempts) {
            // Vérifier si Firebase est disponible via window.db (méthode moderne)
            if (window.db) {
                break;
            }
            
            // Vérifier si Firebase est disponible via window.firebase (méthode ancienne)
            if (window.firebase && window.firebase.firestore) {
                break;
            }
            
            console.log(`Attente de l'initialisation de Firebase (tentative ${attempts + 1}/${maxAttempts})`);
            await new Promise(resolve => setTimeout(resolve, 500)); // Attendre 500ms
            attempts++;
        }
        
        // Après les tentatives, vérifier si Firebase est disponible
        if (!window.db && (!window.firebase || !window.firebase.firestore())) {
            console.warn('Firebase n\'est pas initialisé après plusieurs tentatives');
            return; // Garder le nom temporaire
        }
        
        try {
            let routerDoc;
            
            // Utiliser l'API moderne si disponible (préféré)
            if (window.db && window.doc && window.getDoc) {
                console.log('Utilisation de l\'API Firebase moderne');
                routerDoc = await window.getDoc(window.doc(window.db, 'routers', routerId));
            } 
            // Sinon, utiliser l'API ancienne
            else if (window.firebase && typeof window.firebase.firestore === 'function') {
                console.log('Utilisation de l\'API Firebase ancienne');
                const docRef = window.firebase.firestore().collection('routers').doc(routerId);
                routerDoc = await docRef.get();
            } else {
                console.warn('Aucune API Firebase disponible');
                return;
            }
            
            if (routerDoc && routerDoc.exists()) {
                // Récupérer les données (compatible avec les deux APIs)
                const routerData = routerDoc.data();
                routerNameElement.textContent = routerData.name || 'Routeur ' + routerId.substring(0, 4);
                console.log('Nom du routeur récupéré:', routerData.name);
            } else {
                console.warn('Le document du routeur n\'existe pas dans Firestore');
            }
        } catch (firebaseError) {
            console.error('Erreur Firebase lors de la récupération du nom du routeur:', firebaseError);
        }
    } catch (error) {
        console.error('Erreur lors de la récupération du nom du routeur:', error);
    }
}

/**
 * Configure le bouton de déconnexion
 */
function setupLogoutButton() {
    const logoutBtn = document.getElementById('navLogoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            
            try {
                // Importer les fonctions Firebase si elles ne sont pas déjà disponibles
                if (typeof auth === 'undefined') {
                    console.warn('Firebase n\'est pas initialisé dans ce contexte');
                    return;
                }
                
                // Déconnecter l'utilisateur
                await signOut(auth);
                
                // Rediriger vers la page de connexion
                window.location.href = 'index.html';
            } catch (error) {
                console.error('Erreur lors de la déconnexion:', error);
                alert('Erreur lors de la déconnexion. Veuillez réessayer.');
            }
        });
    }
}

/**
 * Affiche le nom de l'utilisateur connecté
 */
function displayUserName() {
    const userNameElement = document.getElementById('navUserName');
    if (!userNameElement) return;
    
    // Importer les fonctions Firebase si elles ne sont pas déjà disponibles
    if (typeof auth === 'undefined') {
        console.warn('Firebase n\'est pas initialisé dans ce contexte');
        return;
    }
    
    // Écouter les changements d'état d'authentification
    auth.onAuthStateChanged(user => {
        if (user) {
            userNameElement.textContent = user.displayName || user.email || 'Utilisateur';
        } else {
            userNameElement.textContent = 'Utilisateur';
        }
    });
}
