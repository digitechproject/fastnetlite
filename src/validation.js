/**
 * Utilitaire de validation des données pour FastNetLite
 * Permet de valider les données avant de les envoyer à Firestore
 */

/**
 * Schémas de validation pour les différentes collections
 */
const schemas = {
    // Schéma pour la collection 'users'
    users: {
        name: { type: 'string', required: true, minLength: 2, maxLength: 50 },
        email: { type: 'email', required: true },
        role: { type: 'string', enum: ['user', 'admin', 'vendor'], required: true },
        status: { type: 'string', enum: ['active', 'inactive', 'suspended'], required: true }
    },
    
    // Schéma pour la collection 'routers'
    routers: {
        name: { type: 'string', required: true, minLength: 2, maxLength: 50 },
        description: { type: 'string', maxLength: 200 },
        userId: { type: 'string', required: true },
        fedapayApiKey: { type: 'string' },
        testMode: { type: 'boolean', required: true },
        status: { type: 'string', enum: ['active', 'inactive'], required: true }
    },
    
    // Schéma pour la collection 'profiles'
    profiles: {
        name: { type: 'string', required: true, minLength: 2, maxLength: 50 },
        routerId: { type: 'string', required: true },
        price: { type: 'number', required: true, min: 0 },
        duration: { type: 'string', required: true },
        durationInMinutes: { type: 'number', required: true, min: 1 },
        bandwidth: { type: 'string' },
        status: { type: 'string', enum: ['active', 'inactive'], required: true }
    },
    
    // Schéma pour la collection 'wifiCodes'
    wifiCodes: {
        username: { type: 'string', required: true },
        password: { type: 'string', required: true },
        profileId: { type: 'string', required: true },
        routerId: { type: 'string', required: true },
        status: { type: 'string', enum: ['available', 'used', 'expired'], required: true }
    },
    
    // Schéma pour la collection 'clients'
    clients: {
        name: { type: 'string', required: true, minLength: 2, maxLength: 50 },
        phone: { type: 'string', pattern: /^[0-9+]{8,15}$/ },
        email: { type: 'email' },
        routerId: { type: 'string', required: true }
    },
    
    // Schéma pour la collection 'payments'
    payments: {
        amount: { type: 'number', required: true, min: 1 },
        currency: { type: 'string', required: true, enum: ['XOF', 'USD', 'EUR'] },
        clientId: { type: 'string', required: true },
        routerId: { type: 'string', required: true },
        codeId: { type: 'string', required: true },
        status: { type: 'string', enum: ['pending', 'completed', 'failed'], required: true },
        paymentMethod: { type: 'string', required: true }
    }
};

/**
 * Valider un objet par rapport à un schéma
 * @param {Object} data - Données à valider
 * @param {string} collectionName - Nom de la collection (pour déterminer le schéma)
 * @returns {Object} - Résultat de la validation { valid: boolean, errors: Array }
 */
function validateData(data, collectionName) {
    // Vérifier si le schéma existe
    if (!schemas[collectionName]) {
        return { valid: false, errors: [`Schéma non défini pour la collection '${collectionName}'`] };
    }
    
    const schema = schemas[collectionName];
    const errors = [];
    
    // Parcourir tous les champs du schéma
    for (const field in schema) {
        const rules = schema[field];
        const value = data[field];
        
        // Vérifier si le champ est requis
        if (rules.required && (value === undefined || value === null || value === '')) {
            errors.push(`Le champ '${field}' est obligatoire`);
            continue;
        }
        
        // Si le champ n'est pas présent et n'est pas requis, passer à la suite
        if (value === undefined || value === null || value === '') {
            continue;
        }
        
        // Vérifier le type
        switch (rules.type) {
            case 'string':
                if (typeof value !== 'string') {
                    errors.push(`Le champ '${field}' doit être une chaîne de caractères`);
                } else {
                    // Vérifier la longueur minimale
                    if (rules.minLength !== undefined && value.length < rules.minLength) {
                        errors.push(`Le champ '${field}' doit contenir au moins ${rules.minLength} caractères`);
                    }
                    
                    // Vérifier la longueur maximale
                    if (rules.maxLength !== undefined && value.length > rules.maxLength) {
                        errors.push(`Le champ '${field}' ne doit pas dépasser ${rules.maxLength} caractères`);
                    }
                    
                    // Vérifier le pattern
                    if (rules.pattern && !rules.pattern.test(value)) {
                        errors.push(`Le champ '${field}' ne respecte pas le format attendu`);
                    }
                }
                break;
                
            case 'number':
                if (typeof value !== 'number' || isNaN(value)) {
                    errors.push(`Le champ '${field}' doit être un nombre`);
                } else {
                    // Vérifier la valeur minimale
                    if (rules.min !== undefined && value < rules.min) {
                        errors.push(`Le champ '${field}' doit être supérieur ou égal à ${rules.min}`);
                    }
                    
                    // Vérifier la valeur maximale
                    if (rules.max !== undefined && value > rules.max) {
                        errors.push(`Le champ '${field}' doit être inférieur ou égal à ${rules.max}`);
                    }
                }
                break;
                
            case 'boolean':
                if (typeof value !== 'boolean') {
                    errors.push(`Le champ '${field}' doit être un booléen`);
                }
                break;
                
            case 'email':
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (typeof value !== 'string' || !emailRegex.test(value)) {
                    errors.push(`Le champ '${field}' doit être une adresse email valide`);
                }
                break;
        }
        
        // Vérifier les valeurs énumérées
        if (rules.enum && !rules.enum.includes(value)) {
            errors.push(`Le champ '${field}' doit être l'une des valeurs suivantes: ${rules.enum.join(', ')}`);
        }
    }
    
    return {
        valid: errors.length === 0,
        errors: errors
    };
}

/**
 * Nettoyer les données selon le schéma (supprimer les champs non définis dans le schéma)
 * @param {Object} data - Données à nettoyer
 * @param {string} collectionName - Nom de la collection (pour déterminer le schéma)
 * @returns {Object} - Données nettoyées
 */
function sanitizeData(data, collectionName) {
    // Vérifier si le schéma existe
    if (!schemas[collectionName]) {
        return data;
    }
    
    const schema = schemas[collectionName];
    const sanitizedData = {};
    
    // Ne conserver que les champs définis dans le schéma
    for (const field in schema) {
        if (data[field] !== undefined) {
            sanitizedData[field] = data[field];
        }
    }
    
    return sanitizedData;
}

// Exporter les fonctions
export { validateData, sanitizeData, schemas };
