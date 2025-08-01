/**
 * Utilitaires pour la gestion des routeurs dans FastNetLite
 * Ce fichier centralise les fonctions communes liées aux routeurs
 */

// Créer un namespace global pour les utilitaires de routeur
window.routerUtils = window.routerUtils || {};

/**
 * Récupère l'ID du routeur depuis l'URL de manière cohérente
 * Vérifie d'abord le paramètre 'routerId', puis le paramètre 'id'
 * @returns {string|null} L'ID du routeur ou null si non trouvé
 */
window.routerUtils.getRouterId = function() {
    const urlParams = new URLSearchParams(window.location.search);
    
    // Vérifier d'abord le paramètre 'routerId'
    let routerId = urlParams.get('routerId');
    
    // Si non trouvé, vérifier le paramètre 'id'
    if (!routerId) {
        routerId = urlParams.get('id');
    }
    
    console.log('ID du routeur détecté:', routerId || 'aucun');
    return routerId;
};

/**
 * Vérifie si la page actuelle est une page de routeur
 * @returns {boolean} true si la page est une page de routeur
 */
window.routerUtils.isRouterPage = function() {
    return window.routerUtils.getRouterId() !== null;
};

/**
 * Construit une URL avec l'ID du routeur
 * @param {string} baseUrl - L'URL de base (ex: 'router-dashboard.html')
 * @param {string} routerId - L'ID du routeur
 * @returns {string} L'URL complète avec l'ID du routeur
 */
window.routerUtils.buildRouterUrl = function(baseUrl, routerId) {
    if (!routerId) {
        routerId = window.routerUtils.getRouterId();
    }
    
    if (!routerId) {
        console.warn('Tentative de construction d\'une URL de routeur sans ID de routeur');
        return baseUrl;
    }
    
    // Utiliser toujours le même format de paramètre (id) pour la cohérence
    return `${baseUrl}?id=${routerId}`;
};

/**
 * Met à jour tous les liens de navigation du routeur avec l'ID du routeur actuel
 * @param {string} routerId - L'ID du routeur
 */
window.routerUtils.updateRouterNavigationLinks = function(routerId) {
    if (!routerId) {
        routerId = window.routerUtils.getRouterId();
    }
    
    if (!routerId) {
        console.warn('Tentative de mise à jour des liens de navigation sans ID de routeur');
        return;
    }
    
    // Définir les liens avec leurs IDs et URLs
    const links = {
        'nav-router-dashboard': window.routerUtils.buildRouterUrl('router-dashboard.html', routerId),
        'nav-router-users': window.routerUtils.buildRouterUrl('clients.html', routerId),
        'nav-router-wifi-codes': window.routerUtils.buildRouterUrl('wifi-codes.html', routerId),
        'nav-router-payments': window.routerUtils.buildRouterUrl('payments.html', routerId),
        'nav-router-settings': window.routerUtils.buildRouterUrl('router-settings.html', routerId)
    };
    
    // Mettre à jour chaque lien
    Object.entries(links).forEach(([id, href]) => {
        const link = document.getElementById(id);
        if (link) {
            // Sauvegarder l'ancienne valeur pour le débogage
            const oldHref = link.href;
            
            // Mettre à jour l'attribut href explicitement
            link.setAttribute('href', href);
            
            console.log(`Mise à jour du lien ${id}: ${oldHref} -> ${link.getAttribute('href')}`);
            
            // Supprimer tout gestionnaire d'événement existant qui pourrait interférer
            link.onclick = null;
            
            // Vérifier que l'attribut href est bien mis à jour dans le DOM
            console.log(`Vérification de l'attribut href pour ${id}:`, link.getAttribute('href'));
        } else {
            console.warn(`Lien avec ID ${id} non trouvé dans le DOM`);
        }
    });
};

// Log pour confirmer que le module est chargé
console.log('Module router-utils chargé, fonctions disponibles via window.routerUtils');
