/**
 * Gestionnaire d'installation de la PWA FastNetLite
 */

// Variable pour stocker l'événement d'installation différée
let deferredPrompt;
let installButton;

/**
 * Initialiser le gestionnaire d'installation PWA
 * @param {string} buttonId - ID du bouton d'installation
 */
function initPwaInstaller(buttonId) {
    installButton = document.getElementById(buttonId);
    
    if (!installButton) {
        console.error('Bouton d\'installation PWA non trouvé');
        return;
    }
    
    // Masquer le bouton par défaut
    installButton.style.display = 'none';
    
    // Écouter l'événement beforeinstallprompt
    window.addEventListener('beforeinstallprompt', (e) => {
        // Empêcher Chrome 67+ d'afficher automatiquement la boîte de dialogue
        e.preventDefault();
        
        // Stocker l'événement pour pouvoir le déclencher plus tard
        deferredPrompt = e;
        
        // Afficher le bouton d'installation
        installButton.style.display = 'block';
        
        // Ajouter l'écouteur d'événement au bouton
        installButton.addEventListener('click', installPwa);
    });
    
    // Écouter l'événement appinstalled
    window.addEventListener('appinstalled', (e) => {
        // Masquer le bouton une fois l'application installée
        if (installButton) installButton.style.display = 'none';
        
        // Enregistrer l'installation
        console.log('FastNetLite a été installée avec succès');
        
        // Réinitialiser la variable deferredPrompt
        deferredPrompt = null;
    });
}

/**
 * Installer la PWA
 */
function installPwa() {
    // Vérifier si l'événement d'installation est disponible
    if (!deferredPrompt) {
        console.warn('Événement d\'installation PWA non disponible');
        return;
    }
    
    // Afficher la boîte de dialogue d'installation
    deferredPrompt.prompt();
    
    // Attendre que l'utilisateur réponde à la boîte de dialogue
    deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === 'accepted') {
            console.log('L\'utilisateur a accepté l\'installation de la PWA');
        } else {
            console.log('L\'utilisateur a refusé l\'installation de la PWA');
        }
        
        // Réinitialiser la variable deferredPrompt
        deferredPrompt = null;
    });
}

// Exporter les fonctions
export { initPwaInstaller, installPwa };
