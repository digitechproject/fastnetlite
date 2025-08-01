// Utilitaires pour gérer les interactions avec Firebase
import { 
    collection, 
    doc, 
    setDoc, 
    getDoc, 
    deleteDoc,
    serverTimestamp,
    writeBatch
} from "firebase/firestore";

// Importer l'instance Firestore déjà initialisée depuis firebase-config.js
import { db } from '../firebase-config.js';

/**
 * Vérifie si une collection existe et la crée si nécessaire avec un document factice
 * @param {string} collectionPath - Chemin de la collection (ex: 'routers')
 * @param {Object} dummyData - Données factices pour le document temporaire
 * @returns {Promise<boolean>} - Promesse résolue avec true si la collection existe ou a été créée
 */
export async function checkAndCreateCollection(collectionPath, dummyData = {}) {
    try {
        console.log(`Vérification de la collection: ${collectionPath}`);
        
        // Créer un document factice temporaire
        const dummyDocRef = doc(collection(db, collectionPath), 'dummy_doc');
        
        // Vérifier si le document existe déjà
        const dummyDocSnap = await getDoc(dummyDocRef);
        
        if (!dummyDocSnap.exists()) {
            // Ajouter _dummy flag et timestamp
            const dataWithMeta = {
                ...dummyData,
                _dummy: true,
                createdAt: serverTimestamp()
            };
            
            // Créer le document factice
            await setDoc(dummyDocRef, dataWithMeta);
            console.log(`Collection ${collectionPath} créée avec document factice`);
            
            // Supprimer le document factice après un court délai
            setTimeout(async () => {
                try {
                    await deleteDoc(dummyDocRef);
                    console.log(`Document factice supprimé de ${collectionPath}`);
                } catch (error) {
                    console.error(`Erreur lors de la suppression du document factice: ${error}`);
                }
            }, 2000);
        } else {
            console.log(`Collection ${collectionPath} existe déjà`);
        }
        
        return true;
    } catch (error) {
        console.error(`Erreur lors de la vérification/création de la collection ${collectionPath}:`, error);
        return false;
    }
}

/**
 * Vérifie et crée toutes les collections nécessaires pour l'application
 * @param {string} userId - ID de l'utilisateur connecté
 * @param {string} routerId - ID du routeur (optionnel)
 * @returns {Promise<boolean>} - Promesse résolue avec true si toutes les collections ont été vérifiées
 */
export async function initializeCollections(userId, routerId = null) {
    try {
        console.log('Initialisation des collections...');
        
        // Collections au niveau utilisateur
        await checkAndCreateCollection('routers', { userId });
        
        // Collections au niveau routeur (si routerId est fourni)
        if (routerId) {
            await checkAndCreateCollection('profiles', { routerId });
            await checkAndCreateCollection('wifiCodes', { routerId });
            await checkAndCreateCollection('clients', { routerId });
            await checkAndCreateCollection('payments', { routerId });
        }
        
        console.log('Toutes les collections ont été vérifiées et initialisées si nécessaire');
        return true;
    } catch (error) {
        console.error('Erreur lors de l\'initialisation des collections:', error);
        return false;
    }
}

/**
 * Vérifie si un document existe dans une collection
 * @param {string} collectionPath - Chemin de la collection
 * @param {string} docId - ID du document
 * @returns {Promise<boolean>} - Promesse résolue avec true si le document existe
 */
export async function documentExists(collectionPath, docId) {
    try {
        const docRef = doc(db, collectionPath, docId);
        const docSnap = await getDoc(docRef);
        
        return docSnap.exists();
    } catch (error) {
        console.error(`Erreur lors de la vérification de l'existence du document ${docId} dans ${collectionPath}:`, error);
        return false;
    }
}

/**
 * Gère les erreurs d'index Firebase et retourne un objet avec les informations nécessaires
 * @param {Error} error - L'erreur Firebase à traiter
 * @returns {Object} - Objet contenant les informations sur l'erreur
 */
export function handleFirebaseIndexError(error) {
    // Vérifier si c'est une erreur d'index Firebase
    const isIndexError = error.message && error.message.includes('index');
    
    // Extraire l'URL de création d'index si présente
    const indexUrl = isIndexError 
        ? error.message.match(/https:\/\/console\.firebase\.google\.com[^\s]+/)?.[0] || null
        : null;
    
    return {
        isIndexError,
        indexUrl,
        message: error.message,
        originalError: error
    };
}

/**
 * Exécute une requête Firebase avec gestion des erreurs d'index
 * @param {Function} queryFunction - Fonction asynchrone qui exécute la requête
 * @param {Function} onSuccess - Fonction de rappel en cas de succès
 * @param {Function} onIndexError - Fonction de rappel en cas d'erreur d'index
 * @param {Function} onOtherError - Fonction de rappel en cas d'autre erreur
 * @returns {Promise<any>} - Résultat de la requête ou de la gestion d'erreur
 */
export async function executeWithIndexErrorHandling(queryFunction, onSuccess, onIndexError, onOtherError) {
    try {
        // Exécuter la requête
        const result = await queryFunction();
        
        // Appeler le callback de succès
        return onSuccess(result);
    } catch (error) {
        // Traiter l'erreur
        const errorInfo = handleFirebaseIndexError(error);
        
        if (errorInfo.isIndexError) {
            // Erreur d'index Firebase
            console.warn('Erreur d\'index Firebase détectée:', errorInfo.message);
            return onIndexError(errorInfo);
        } else {
            // Autre type d'erreur
            console.error('Erreur lors de l\'exécution de la requête:', error);
            return onOtherError(error);
        }
    }
}

/**
 * Gère les erreurs Firebase et extrait les informations utiles
 * @param {Error} error - L'erreur Firebase à traiter
 * @returns {Object} - Informations sur l'erreur
 */
export function handleFirebaseError(error) {
    // Initialiser l'objet de résultat
    const result = {
        isIndexError: false,
        indexUrl: null,
        collection: null,
        fields: [],
        message: error.message,
        originalError: error
    };
    
    // Vérifier si c'est une erreur d'index manquant
    if (error.message && error.message.includes('index')) {
        result.isIndexError = true;
        
        // Extraire l'URL de création d'index si elle existe
        const indexUrlMatch = error.message.match(/https:\/\/console\.firebase\.google\.com[^\s"']+/);
        if (indexUrlMatch) {
            result.indexUrl = indexUrlMatch[0];
        }
        
        // Essayer d'extraire la collection concernée
        const collectionMatch = error.message.match(/collection ([a-zA-Z0-9_-]+)/);
        if (collectionMatch) {
            result.collection = collectionMatch[1];
        }
        
        // Essayer d'extraire les champs concernés
        const fieldsMatch = error.message.match(/\[([^\]]+)\]/);
        if (fieldsMatch) {
            result.fields = fieldsMatch[1].split(', ').map(field => field.trim());
        }
        
        console.warn(`Erreur d'index Firebase détectée pour la collection ${result.collection || 'inconnue'}`);
        if (result.indexUrl) {
            console.info(`Créez l'index en visitant: ${result.indexUrl}`);
        }
    }
    
    return result;
}

/**
 * Affiche un message d'erreur d'index dans un conteneur HTML
 * @param {string} containerId - ID du conteneur HTML pour afficher l'erreur
 * @param {Object} errorInfo - Informations sur l'erreur d'index
 */
export function displayIndexError(containerId, errorInfo) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.classList.remove('d-none');
    container.innerHTML = `
        <div class="alert alert-warning">
            <p><strong>Erreur d'index Firebase :</strong> Cette requête nécessite un index composé.</p>
            ${errorInfo.collection ? `<p>Collection concernée: <code>${errorInfo.collection}</code></p>` : ''}
            ${errorInfo.fields.length > 0 ? `<p>Champs: <code>${errorInfo.fields.join('</code>, <code>')}</code></p>` : ''}
            ${errorInfo.indexUrl ? `<p>Cliquez sur <a href="${errorInfo.indexUrl}" target="_blank">ce lien</a> pour créer l'index nécessaire.</p>` : ''}
            <p class="mb-0">Après avoir créé l'index, actualisez la page.</p>
        </div>
    `;
}

/**
 * Crée des index composites pour les requêtes complexes
 * @param {string} routerId - ID du routeur
 * @returns {Promise<void>}
 */
export async function createCompositeIndexes(routerId) {
    console.log('Création des index composites...');
    
    // Cette fonction est principalement informative car les index doivent être créés
    // via la console Firebase, mais elle peut aider à identifier les index nécessaires
    
    const indexesNeeded = [
        {
            collection: 'payments',
            fields: ['routerId', 'createdAt'],
            description: 'Paiements par routeur et date de création'
        },
        {
            collection: 'wifiCodes',
            fields: ['routerId', 'profileId', 'status'],
            description: 'Codes par routeur, profil et statut'
        },
        {
            collection: 'clients',
            fields: ['routerId', 'createdAt'],
            description: 'Clients par routeur et date de création'
        },
        {
            collection: 'routers',
            fields: ['userId', 'name'],
            description: 'Routeurs par utilisateur et nom'
        }
    ];
    
    indexesNeeded.forEach(index => {
        console.log(`Index requis pour ${index.collection}: ${index.fields.join(', ')} - ${index.description}`);
    });
    
    console.log('Note: Les index composites doivent être créés manuellement dans la console Firebase');
    console.log('Vous pouvez créer les index nécessaires en suivant les liens dans les messages d\'erreur');
}
