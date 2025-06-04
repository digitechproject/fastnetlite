// Utilitaires pour l'intégration de FedaPay dans FastNetLite

// Variable globale pour éviter les initialisations multiples
window.fedaPayUtilsInitialized = window.fedaPayUtilsInitialized || false;

// Vérifier si le script a déjà été initialisé
if (!window.fedaPayUtilsInitialized) {
    window.fedaPayUtilsInitialized = true;
    console.log('Initialisation de fedapay-utils.js');
} else {
    console.log('fedapay-utils.js déjà initialisé, initialisation ignorée');
}

/**
 * Initialiser FedaPay avec la clé API
 * @param {string} apiKey - Clé API FedaPay
 * @param {boolean} testMode - Mode de test (true) ou production (false)
 */
function initFedaPay(apiKey, testMode = true) {
    if (!apiKey) {
        console.error('Clé API FedaPay non fournie');
        return;
    }
    
    // Charger le script FedaPay si ce n'est pas déjà fait
    if (!window.FedaPay) {
        const script = document.createElement('script');
        script.src = 'https://js.fedapay.com/v2.js';
        script.async = true;
        document.head.appendChild(script);
        
        script.onload = function() {
            configureFedaPay(apiKey, testMode);
        };
    } else {
        configureFedaPay(apiKey, testMode);
    }
}

/**
 * Configurer FedaPay avec la clé API
 * @param {string} apiKey - Clé API FedaPay
 * @param {boolean} testMode - Mode de test (true) ou production (false)
 */
function configureFedaPay(apiKey, testMode) {
    window.FedaPay.init({
        public_key: apiKey,
        transaction: {
            amount: 0,
            description: ''
        },
        environment: testMode ? 'sandbox' : 'production'
    });
    
    console.log(`FedaPay initialisé en mode ${testMode ? 'test' : 'production'}`);
}

/**
 * Créer une transaction FedaPay
 * @param {Object} options - Options de la transaction
 * @param {number} options.amount - Montant de la transaction en FCFA
 * @param {string} options.description - Description de la transaction
 * @param {string} options.clientName - Nom du client
 * @param {string} options.clientEmail - Email du client (optionnel)
 * @param {string} options.clientPhone - Téléphone du client
 * @param {Function} options.onSuccess - Fonction appelée en cas de succès
 * @param {Function} options.onError - Fonction appelée en cas d'erreur
 * @param {Function} options.onClose - Fonction appelée à la fermeture du modal
 */
function createFedaPayTransaction(options) {
    if (!window.FedaPay) {
        console.error('FedaPay n\'est pas initialisé');
        if (options.onError) {
            options.onError('FedaPay n\'est pas initialisé');
        }
        return;
    }
    
    // Configurer la transaction
    const transactionConfig = {
        amount: options.amount,
        description: options.description,
        customer: {
            name: options.clientName,
            email: options.clientEmail || '',
            phone_number: {
                number: options.clientPhone,
                country: 'bj' // Code pays pour le Bénin
            }
        },
        callback_url: window.location.href
    };
    
    // Mettre à jour la configuration FedaPay
    window.FedaPay.setTransaction(transactionConfig);
    
    // Ouvrir le modal de paiement
    window.FedaPay.open({
        onComplete: function(response) {
            console.log('Transaction complétée:', response);
            if (options.onSuccess) {
                options.onSuccess(response);
            }
        },
        onClose: function() {
            console.log('Modal fermé');
            if (options.onClose) {
                options.onClose();
            }
        },
        onError: function(error) {
            console.error('Erreur lors de la transaction:', error);
            if (options.onError) {
                options.onError(error);
            }
        }
    });
}

/**
 * Vérifier le statut d'une transaction FedaPay
 * @param {string} transactionId - ID de la transaction FedaPay
 * @param {string} apiKey - Clé API FedaPay
 * @param {boolean} testMode - Mode de test (true) ou production (false)
 * @returns {Promise<Object>} - Promesse contenant les détails de la transaction
 */
function checkFedaPayTransactionStatus(transactionId, apiKey, testMode = true) {
    const baseUrl = testMode 
        ? 'https://sandbox-api.fedapay.com/v1/transactions/' 
        : 'https://api.fedapay.com/v1/transactions/';
    
    return fetch(`${baseUrl}${transactionId}`, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
        }
    })
    .then(response => {
        if (!response.ok) {
            throw new Error(`Erreur HTTP: ${response.status}`);
        }
        return response.json();
    })
    .then(data => {
        return data.transaction || data;
    });
}

// Exporter les fonctions pour une utilisation dans d'autres fichiers
window.fedaPayUtils = {
    initFedaPay,
    createFedaPayTransaction,
    checkFedaPayTransactionStatus
};
