/**
 * Script d'initialisation pour FastNetLite
 * Ce script s'assure que les dépendances sont correctement chargées
 * et disponibles dans l'ordre approprié
 */

// Fonction pour vérifier si Firebase est disponible
function checkFirebase() {
    if (typeof firebase === 'undefined') {
        console.warn('Firebase n\'est pas disponible. Certaines fonctionnalités peuvent être limitées.');
        return false;
    }
    return true;
}

// Initialisation de l'objet routerUtils s'il n'existe pas déjà
if (!window.routerUtils) {
    console.log('Initialisation de routerUtils...');
    window.routerUtils = {
        getRouterId: function() {
            const urlParams = new URLSearchParams(window.location.search);
            let routerId = urlParams.get('routerId') || urlParams.get('id');
            console.log('ID du routeur détecté:', routerId || 'aucun');
            return routerId;
        },
        isRouterPage: function() {
            return this.getRouterId() !== null;
        },
        buildRouterUrl: function(page, routerId) {
            if (!routerId) {
                routerId = this.getRouterId();
            }
            
            if (!routerId) {
                console.warn('Tentative de construction d\'URL sans ID de routeur');
                return page;
            }
            
            // Vérifier si l'URL contient déjà des paramètres
            const hasParams = page.includes('?');
            const baseUrl = hasParams ? page : page;
            
            // Utiliser toujours le même format de paramètre (id) pour la cohérence
            return `${baseUrl}?id=${routerId}`;
        },
        updateRouterNavigationLinks: function(routerId) {
            if (!routerId) {
                routerId = this.getRouterId();
            }
            
            if (!routerId) {
                console.warn('Tentative de mise à jour des liens de navigation sans ID de routeur');
                return;
            }
            
            // Définir les liens avec leurs IDs et URLs
            const links = {
                'nav-router-dashboard': this.buildRouterUrl('router-dashboard.html', routerId),
                'nav-router-users': this.buildRouterUrl('clients.html', routerId),
                'nav-router-wifi-codes': this.buildRouterUrl('wifi-codes.html', routerId),
                'nav-router-payments': this.buildRouterUrl('payments.html', routerId),
                'nav-router-settings': this.buildRouterUrl('router-settings.html', routerId)
            };
            
            // Mettre à jour chaque lien
            Object.entries(links).forEach(([id, href]) => {
                const link = document.getElementById(id);
                if (link) {
                    // Mettre à jour l'attribut href explicitement
                    link.setAttribute('href', href);
                    console.log(`Mise à jour du lien ${id} vers ${href}`);
                } else {
                    console.warn(`Lien avec ID ${id} non trouvé dans le DOM`);
                }
            });
        }
    };
    console.log('routerUtils initialisé avec succès');
}

// Vérifier si Firebase est disponible
document.addEventListener('DOMContentLoaded', function() {
    console.log('Vérification des dépendances...');
    checkFirebase();
});

console.log('Script d\'initialisation chargé');
