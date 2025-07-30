/**
 * Module de gestion de l'intégration du widget de profils WiFi
 * Ce module permet de générer le code d'intégration (iframe) pour les profils WiFi
 * à intégrer sur un portail captif MikroTik
 */

// Import des fonctions Firebase
import { 
    getFirestore, 
    collection, 
    query, 
    where, 
    getDocs 
} from 'firebase/firestore';

// Import direct des instances Firebase déjà initialisées
import { auth, db } from './firebase-config';

/**
 * Génère le code d'intégration pour un routeur spécifique
 * @param {string} routerId - ID du routeur
 * @param {string} theme - Thème à appliquer (default, dark, blue, green, orange)
 * @returns {Promise<string>} - Code HTML d'intégration
 */
export async function generateWidgetCode(routerId, theme = 'default') {
    try {
        // Vérifier que le routeur existe et appartient à l'utilisateur courant
        const currentUser = auth.currentUser;
        if (!currentUser) {
            // Afficher un message d'erreur plus convivial et guider l'utilisateur
            throw new Error('Vous devez être connecté pour générer le code d\'intégration. Veuillez vous reconnecter si nécessaire.');
        }
        
        const userId = currentUser.uid;
        
        // Construire l'URL du widget
        const widgetUrl = `${window.location.origin}/widget-profils.html?routerId=${routerId}&userId=${userId}&theme=${theme}`;
        
        // Générer le code d'intégration (iframe)
        const iframeCode = `
<!-- Début du widget FastNetLite -->
<iframe src="${widgetUrl}" 
    id="fastnetlite-widget"
    style="width: 100%; max-width: 600px; height: 400px; border: none; overflow: hidden;" 
    title="Forfaits WiFi FastNetLite" 
    loading="lazy" 
    scrolling="no" 
    allowtransparency="true">
</iframe>
<script>
// Code pour ajuster automatiquement la hauteur de l'iframe
window.addEventListener('message', function(event) {
    // Vérifier l'origine du message (optionnel mais recommandé pour la sécurité)
    if (event.data && event.data.type === 'resize-iframe') {
        const iframe = document.getElementById('fastnetlite-widget');
        if (iframe) {
            // Ajouter une petite marge pour éviter les barres de défilement
            iframe.style.height = (event.data.height + 20) + 'px';
        }
    }
});
</script>
<!-- Fin du widget FastNetLite -->`;

        return iframeCode;
    } catch (error) {
        console.error('Erreur lors de la génération du code d\'intégration:', error);
        throw error;
    }
}

/**
 * Charge les routeurs de l'utilisateur courant
 * @returns {Promise<Array>} - Liste des routeurs
 */
async function loadUserRouters() {
    try {
        const currentUser = auth.currentUser;
        if (!currentUser) {
            // Vérifier si l'utilisateur est en cours de chargement
            console.log('Tentative de récupération de l\'utilisateur...');
            
            // Attendre un peu pour voir si l'authentification se termine
            return new Promise((resolve, reject) => {
                const unsubscribe = auth.onAuthStateChanged(user => {
                    unsubscribe();
                    if (user) {
                        // Utilisateur maintenant connecté, continuer le chargement
                        console.log('Utilisateur récupéré avec succès:', user.uid);
                        // Continuer avec le chargement des routeurs
                        const routersQuery = query(
                            collection(db, 'routers'),
                            where('userId', '==', user.uid)
                        );
                        getDocs(routersQuery).then(snapshot => {
                            const routers = [];
                            snapshot.forEach(doc => {
                                routers.push({
                                    id: doc.id,
                                    ...doc.data()
                                });
                            });
                            resolve(routers);
                        }).catch(err => reject(err));
                    } else {
                        // Toujours pas d'utilisateur après vérification
                        reject(new Error('Utilisateur non connecté. Veuillez vous reconnecter pour accéder à cette fonctionnalité.'));
                    }
                });
                
                // Définir un timeout pour éviter d'attendre indéfiniment
                setTimeout(() => {
                    unsubscribe();
                    reject(new Error('Délai d\'attente dépassé pour l\'authentification. Veuillez rafraîchir la page et réessayer.'));
                }, 5000); // 5 secondes maximum d'attente
            });
        }
        
        const userId = currentUser.uid;
        
        // Récupérer tous les routeurs de l'utilisateur
        const routersRef = collection(db, 'routers');
        const routersQuery = query(routersRef, where('userId', '==', userId));
        const routersSnapshot = await getDocs(routersQuery);
        
        if (routersSnapshot.empty) {
            return [];
        }
        
        // Construire la liste des routeurs
        const routers = [];
        routersSnapshot.forEach(doc => {
            routers.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        return routers;
    } catch (error) {
        console.error('Erreur lors du chargement des routeurs:', error);
        throw error;
    }
}

/**
 * Initialise l'interface d'intégration du widget
 * @param {HTMLElement} containerElement - Élément conteneur pour l'interface d'intégration
 */
export function initWidgetIntegration(containerElement) {
    if (!containerElement) return;
    
    // Créer l'interface d'intégration
    containerElement.innerHTML = `
        <div class="card mb-4">
            <div class="card-header">
                <h5 class="card-title mb-0">Intégration du widget de profils</h5>
            </div>
            <div class="card-body">
                <p class="mb-3">
                    Générez un widget prêt à l'emploi que vous pouvez intégrer directement sur votre page de capture MikroTik.
                    Ce widget affichera automatiquement tous les profils disponibles avec leurs boutons d'achat.
                </p>
                
                <div class="alert alert-info mb-3">
                    <i class="fas fa-info-circle me-2"></i>
                    Sélectionnez un routeur et un thème, puis copiez le code généré dans votre page de capture MikroTik.
                </div>
                
                <form id="widgetGeneratorForm" class="mb-4">
                    <div class="row mb-3">
                        <div class="col-md-6">
                            <label for="widgetRouterSelect" class="form-label">Routeur</label>
                            <select class="form-select" id="widgetRouterSelect" required>
                                <option value="">Sélectionnez un routeur</option>
                                <!-- Les routeurs seront chargés dynamiquement ici -->
                            </select>
                        </div>
                        <div class="col-md-6">
                            <label for="widgetThemeSelect" class="form-label">Thème</label>
                            <select class="form-select" id="widgetThemeSelect">
                                <option value="default">Par défaut</option>
                                <option value="dark">Sombre</option>
                                <option value="blue">Bleu</option>
                                <option value="green">Vert</option>
                                <option value="orange">Orange</option>
                            </select>
                        </div>
                    </div>
                    <button type="submit" class="btn btn-primary" id="generateWidgetBtn">
                        <i class="fas fa-code me-2"></i>Générer le code
                    </button>
                </form>
                
                <div id="widgetResultContainer" class="d-none">
                    <div class="alert alert-success mb-4">
                        <i class="fas fa-check-circle me-2"></i>
                        <strong>Code généré avec succès !</strong> Copiez le code ci-dessous et collez-le dans votre portail captif MikroTik.
                    </div>
                    
                    <div id="widgetCodeContainer" class="mb-4">
                        <h6 class="mb-2">Code d'intégration à copier</h6>
                        <div class="position-relative">
                            <pre class="bg-dark text-light p-3 rounded" id="widgetCode" style="max-height: 200px; overflow-y: auto;"></pre>
                            <button class="btn btn-primary position-absolute top-0 end-0 m-2" id="copyWidgetCode">
                                <i class="fas fa-copy me-1"></i> Copier
                            </button>
                        </div>
                        
                        <div class="alert alert-warning mt-3">
                            <i class="fas fa-exclamation-triangle me-2"></i>
                            Assurez-vous d'avoir ajouté les règles Walled Garden IP nécessaires dans votre routeur MikroTik pour que le widget fonctionne correctement.
                        </div>
                    </div>
                    
                    <div id="widgetPreviewContainer" class="mb-4">
                        <h6 class="mb-2">Aperçu du widget</h6>
                        <div class="border p-2 rounded mb-3">
                            <iframe id="widgetPreview" style="width: 100%; height: 400px; border: none;" title="Aperçu du widget"></iframe>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
    
    // Récupérer les éléments du DOM
    const widgetRouterSelect = document.getElementById('widgetRouterSelect');
    const widgetThemeSelect = document.getElementById('widgetThemeSelect');
    const widgetGeneratorForm = document.getElementById('widgetGeneratorForm');
    const widgetPreviewContainer = document.getElementById('widgetPreviewContainer');
    const widgetPreview = document.getElementById('widgetPreview');
    const widgetCodeContainer = document.getElementById('widgetCodeContainer');
    const widgetCode = document.getElementById('widgetCode');
    const copyWidgetCodeBtn = document.getElementById('copyWidgetCode');
    
    // Charger les routeurs
    loadUserRouters()
        .then(routers => {
            if (routers.length === 0) {
                widgetRouterSelect.innerHTML = `
                    <option value="">Aucun routeur disponible</option>
                `;
                return;
            }
            
            // Ajouter les options de routeur
            let routerOptions = `<option value="">Sélectionnez un routeur</option>`;
            routers.forEach(router => {
                routerOptions += `<option value="${router.id}">${router.name}</option>`;
            });
            
            widgetRouterSelect.innerHTML = routerOptions;
        })
        .catch(error => {
            console.error('Erreur lors du chargement des routeurs:', error);
            widgetRouterSelect.innerHTML = `
                <option value="">Erreur lors du chargement des routeurs</option>
            `;
        });
    
    // Gérer la soumission du formulaire
    widgetGeneratorForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        const routerId = widgetRouterSelect.value;
        const theme = widgetThemeSelect.value;
        
        if (!routerId) {
            alert('Veuillez sélectionner un routeur');
            return;
        }
        
        try {
            // Afficher un indicateur de chargement
            const generateBtn = document.getElementById('generateWidgetBtn');
            const originalBtnText = generateBtn.innerHTML;
            generateBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Génération en cours...';
            generateBtn.disabled = true;
            
            // Générer le code d'intégration
            const iframeCode = await generateWidgetCode(routerId, theme);
            
            // Afficher le code
            widgetCode.textContent = iframeCode;
            widgetCodeContainer.style.display = 'block';
            
            // Afficher l'aperçu
            const widgetUrl = `${window.location.origin}/widget-profils.html?routerId=${routerId}&userId=${auth.currentUser.uid}&theme=${theme}`;
            widgetPreview.src = widgetUrl;
            widgetPreviewContainer.style.display = 'block';
            
            // Restaurer le bouton
            generateBtn.innerHTML = originalBtnText;
            generateBtn.disabled = false;
            
            // Afficher un message de succès
            const resultContainer = document.getElementById('widgetResultContainer');
            if (resultContainer) {
                resultContainer.classList.remove('d-none');
            }
            
        } catch (error) {
            console.error('Erreur lors de la génération du code d\'intégration:', error);
            alert('Erreur lors de la génération du code d\'intégration. Veuillez réessayer.');
        }
    });
    
    // Gérer le clic sur le bouton de copie
    copyWidgetCodeBtn.addEventListener('click', () => {
        const codeText = widgetCode.textContent;
        
        navigator.clipboard.writeText(codeText)
            .then(() => {
                // Changer temporairement le texte du bouton pour indiquer le succès
                const originalHTML = copyWidgetCodeBtn.innerHTML;
                copyWidgetCodeBtn.innerHTML = '<i class="fas fa-check me-1"></i> Copié!';
                copyWidgetCodeBtn.classList.remove('btn-primary');
                copyWidgetCodeBtn.classList.add('btn-success');
                
                // Rétablir le bouton après 2 secondes
                setTimeout(() => {
                    copyWidgetCodeBtn.innerHTML = originalHTML;
                    copyWidgetCodeBtn.classList.remove('btn-success');
                    copyWidgetCodeBtn.classList.add('btn-primary');
                }, 2000);
            })
            .catch(err => {
                console.error('Erreur lors de la copie du code:', err);
                alert('Impossible de copier le code. Veuillez le sélectionner manuellement et utiliser Ctrl+C.');
            });
    });
}
