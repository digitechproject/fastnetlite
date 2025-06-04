// Gestion du modal de licence pour FastNetLite
import { getAuth } from 'firebase/auth';
import { activateLicense, needsLicenseActivation } from './license-utils';

// Nous utiliserons directement getAuth() à chaque fois que nous avons besoin de l'instance Auth
// Cela garantit que nous utilisons toujours l'instance correcte

// Éléments DOM
let licenseModal;
let licenseForm;
let licenseKeyInput;
let activateLicenseBtn;
let licenseError;
let licenseErrorMessage;
let licenseSuccess;
let licenseSuccessMessage;
let getLicenseLink;

// Fonction d'initialisation du modal
export function initLicenseModal() {
    // Vérifier si le modal est déjà dans le DOM
    if (!document.getElementById('licenseModal')) {
        // Charger le modal depuis le fichier HTML
        fetch('license-modal.html')
            .then(response => response.text())
            .then(html => {
                // Ajouter le modal au body
                document.body.insertAdjacentHTML('beforeend', html);
                
                // Initialiser les éléments DOM après l'ajout du modal
                initDOMElements();
                
                // Ajouter les écouteurs d'événements
                addEventListeners();
            })
            .catch(error => {
                console.error('Erreur lors du chargement du modal de licence:', error);
            });
    } else {
        // Le modal est déjà dans le DOM, initialiser les éléments
        initDOMElements();
        addEventListeners();
    }
}

// Initialiser les éléments DOM
function initDOMElements() {
    licenseModal = document.getElementById('licenseModal');
    licenseForm = document.getElementById('licenseForm');
    licenseKeyInput = document.getElementById('licenseKey');
    activateLicenseBtn = document.getElementById('activateLicenseBtn');
    licenseError = document.getElementById('licenseError');
    licenseErrorMessage = document.getElementById('licenseErrorMessage');
    licenseSuccess = document.getElementById('licenseSuccess');
    licenseSuccessMessage = document.getElementById('licenseSuccessMessage');
    getLicenseLink = document.getElementById('getLicenseLink');
}

// Ajouter les écouteurs d'événements
function addEventListeners() {
    // Activation de la licence
    activateLicenseBtn.addEventListener('click', handleLicenseActivation);
    
    // Réinitialiser le formulaire à l'ouverture du modal
    licenseModal.addEventListener('show.bs.modal', () => {
        resetLicenseForm();
    });
    
    // Fermer le modal après succès
    licenseModal.addEventListener('hidden.bs.modal', () => {
        if (!licenseSuccess.classList.contains('d-none')) {
            // Recharger la page après fermeture du modal si la licence a été activée
            window.location.reload();
        }
    });
    
    // Formater automatiquement la clé de licence
    if (licenseKeyInput) {
        licenseKeyInput.addEventListener('input', formatLicenseKey);
    }
}

// Gérer l'activation de la licence
async function handleLicenseActivation() {
    // Masquer les messages précédents
    licenseError.classList.add('d-none');
    licenseSuccess.classList.add('d-none');
    
    // Vérifier si le formulaire est valide
    if (!licenseForm.checkValidity()) {
        licenseForm.reportValidity();
        return;
    }
    
    // Désactiver le bouton pendant l'activation
    activateLicenseBtn.disabled = true;
    activateLicenseBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Activation en cours...';
    
    try {
        // Récupérer l'utilisateur actuel
        const user = auth.currentUser;
        
        if (!user) {
            showLicenseError('Vous devez être connecté pour activer une licence.');
            return;
        }
        
        // Activer la licence
        const licenseKey = licenseKeyInput.value.trim();
        const result = await activateLicense(user.uid, licenseKey);
        
        if (result.success) {
            showLicenseSuccess(result.message);
        } else {
            showLicenseError(result.message);
        }
    } catch (error) {
        console.error('Erreur lors de l\'activation de la licence:', error);
        showLicenseError('Une erreur est survenue lors de l\'activation de la licence.');
    } finally {
        // Réactiver le bouton
        activateLicenseBtn.disabled = false;
        activateLicenseBtn.innerHTML = '<i class="fas fa-key me-2"></i>Activer la licence';
    }
}

// Afficher un message d'erreur
function showLicenseError(message) {
    licenseError.classList.remove('d-none');
    licenseErrorMessage.textContent = message;
}

// Afficher un message de succès
function showLicenseSuccess(message) {
    licenseSuccess.classList.remove('d-none');
    licenseSuccessMessage.textContent = message;
}

// Réinitialiser le formulaire de licence
function resetLicenseForm() {
    licenseForm.reset();
    licenseError.classList.add('d-none');
    licenseSuccess.classList.add('d-none');
    activateLicenseBtn.disabled = false;
}

/**
 * Formate automatiquement la clé de licence au format XXXX-XXXX-XXXX-XXXX
 * @param {Event} e - Événement d'input
 */
export function formatLicenseKey(e) {
    // Récupérer la valeur actuelle et supprimer tous les caractères non alphanumériques
    let value = e.target.value.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    
    // Limiter à 16 caractères maximum
    if (value.length > 16) {
        value = value.substring(0, 16);
    }
    
    // Formater avec des tirets tous les 4 caractères
    let formattedValue = '';
    for (let i = 0; i < value.length; i++) {
        if (i > 0 && i % 4 === 0 && i < 16) {
            formattedValue += '-';
        }
        formattedValue += value[i];
    }
    
    // Mettre à jour la valeur du champ
    e.target.value = formattedValue;
}

// Vérifier si l'utilisateur a besoin d'une licence et afficher le modal si nécessaire
export async function checkAndShowLicenseModal() {
    try {
        // Obtenir l'instance auth directement via getAuth()
        const auth = getAuth();
        const user = auth.currentUser;
        
        if (!user) {
            return false;
        }
        
        const needsLicense = await needsLicenseActivation(user.uid);
        
        if (needsLicense) {
            // Initialiser le modal s'il n'est pas déjà initialisé
            await new Promise((resolve) => {
                initLicenseModal();
                
                // Vérifier si le modal est bien chargé dans le DOM
                const checkModalLoaded = setInterval(() => {
                    const modalElement = document.getElementById('licenseModal');
                    if (modalElement) {
                        clearInterval(checkModalLoaded);
                        resolve();
                    }
                }, 100);
                
                // Timeout après 3 secondes pour éviter une attente infinie
                setTimeout(() => {
                    clearInterval(checkModalLoaded);
                    resolve();
                }, 3000);
            });
            
            // Vérifier si Bootstrap est disponible
            if (typeof bootstrap === 'undefined' || !bootstrap.Modal) {
                console.warn('Bootstrap n\'est pas disponible. Impossible d\'afficher le modal de licence.');
                return true; // On retourne true quand même pour indiquer que la licence est nécessaire
            }
            
            const modalElement = document.getElementById('licenseModal');
            if (!modalElement) {
                console.warn('Modal de licence introuvable dans le DOM.');
                return true;
            }
            
            // Afficher le modal avec gestion d'erreur
            try {
                const bsModal = new bootstrap.Modal(modalElement, {
                    backdrop: 'static',  // Empêche la fermeture en cliquant en dehors
                    keyboard: false       // Empêche la fermeture avec la touche Echap
                });
                bsModal.show();
            } catch (modalError) {
                console.error('Erreur lors de l\'initialisation du modal Bootstrap:', modalError);
            }
            
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Erreur lors de la vérification de la licence:', error);
        return false;
    }
}
