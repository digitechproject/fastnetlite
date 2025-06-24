/**
 * Module de navigation pour FastNetLite
 * Ce script charge dynamiquement le menu de navigation dans toutes les pages
 * et gère l'activation des liens en fonction de la page courante
 */

document.addEventListener('DOMContentLoaded', async () => {
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
    // Vérifier si nous sommes sur une page de routeur (avec un ID de routeur dans l'URL)
    const urlParams = new URLSearchParams(window.location.search);
    // Vérifier à la fois 'routerId' et 'id' comme paramètres possibles
    let routerId = urlParams.get('routerId');
    if (!routerId) {
        routerId = urlParams.get('id'); // Essayer avec le paramètre 'id' si 'routerId' n'existe pas
    }
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
        
        // Configurer les liens avec l'ID du routeur
        const links = {
            'nav-router-dashboard': `router-dashboard.html?id=${routerId}`,
            'nav-router-users': `clients.html?id=${routerId}`,
            'nav-router-wifi-codes': `wifi-codes.html?id=${routerId}`,
            'nav-router-payments': `payments.html?id=${routerId}`,
            'nav-router-settings': `router-settings.html?id=${routerId}`
        };
        
        // Mettre à jour les liens
        Object.entries(links).forEach(([id, href]) => {
            const link = document.getElementById(id);
            if (link) {
                link.href = href;
                
                // Activer le lien correspondant à la page courante
                const currentPage = window.location.pathname.split('/').pop() || 'index.html';
                const targetPage = href.split('?')[0];
                
                console.log('Comparaison de pages:', { currentPage, targetPage });
                
                if (currentPage === targetPage) {
                    link.classList.add('active');
                    console.log('Lien activé:', id);
                }
            }
        });
        
        // Afficher le nom du routeur
        displayRouterName(routerId);
        
        // Gérer le redimensionnement de la fenêtre
        window.addEventListener('resize', handleRouterNavResponsive);
    }
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
        
        // Vérifier si Firebase est disponible
        if (typeof window.firebase === 'undefined' || typeof db === 'undefined' || typeof getDoc === 'undefined' || typeof doc === 'undefined') {
            console.warn('Firebase n\'est pas complètement initialisé dans ce contexte');
            // On laisse le nom temporaire affiché
            return;
        }
        
        try {
            // Récupérer les informations du routeur depuis Firebase
            const routerDoc = await getDoc(doc(db, 'routers', routerId));
            if (routerDoc.exists()) {
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
