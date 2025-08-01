// Utilitaires pour la gestion des licences dans FastNetLite
import { doc, getDoc, setDoc, updateDoc, addDoc, collection, query, where, orderBy, getDocs, serverTimestamp } from "firebase/firestore";
import { getAuth } from 'firebase/auth';

// Importer l'instance Firestore déjà initialisée depuis firebase-config.js
import { db } from './firebase-config.js';

// Utiliser directement les fonctions getFirestore et getAuth pour obtenir les instances
// Cela garantit qu'on utilise toujours les instances déjà initialisées

/**
 * Vérifie si l'utilisateur a une licence active
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<Object>} - Informations sur la licence ou null
 */
export async function checkActiveLicense(userId) {
    try {
        // Utiliser l'instance Firestore importée au début du fichier
        
        // Vérifier si l'utilisateur a une souscription
        const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
        const subscriptionDoc = await getDoc(subscriptionRef);
        
        if (!subscriptionDoc.exists()) {
            return null;
        }
        
        const subscriptionData = subscriptionDoc.data();
        
        // Si pas de licenseKeyId, pas de licence active
        if (!subscriptionData.licenseKeyId) {
            return null;
        }
        
        // Récupérer les informations de la licence
        const licenseRef = doc(db, 'licenses', subscriptionData.licenseKeyId);
        const licenseDoc = await getDoc(licenseRef);
        
        if (!licenseDoc.exists()) {
            return null;
        }
        
        const licenseData = licenseDoc.data();
        
        // Vérifier si la licence est active
        const now = new Date();
        const expirationDate = licenseData.expirationDate.toDate();
        
        if (now > expirationDate) {
            // La licence a expiré, mettre à jour le statut
            await updateDoc(licenseRef, {
                status: 'expired'
            });
            
            await updateDoc(subscriptionRef, {
                status: 'expired',
                updatedAt: serverTimestamp()
            });
            
            return {
                ...licenseData,
                status: 'expired',
                isActive: false
            };
        }
        
        return {
            ...licenseData,
            isActive: true
        };
    } catch (error) {
        console.error('Erreur lors de la vérification de la licence:', error);
        return null;
    }
}

/**
 * Active une licence pour un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {string} licenseKey - Clé de licence à activer
 * @returns {Promise<Object>} - Résultat de l'activation
 */
export async function activateLicense(userId, licenseKey) {
    try {
        // Utiliser l'instance Firestore importée au début du fichier
        
        // Vérifier si la licence existe
        const licensesRef = collection(db, 'licenses');
        const q = query(licensesRef, where('licenseKey', '==', licenseKey));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            return {
                success: false,
                message: 'Clé de licence invalide.'
            };
        }
        
        const licenseDoc = querySnapshot.docs[0];
        const licenseData = licenseDoc.data();
        
        // Vérifier si la licence est disponible
        if (licenseData.status !== 'available') {
            return {
                success: false,
                message: 'Cette licence est déjà utilisée ou a expiré.'
            };
        }
        
        // Calculer la date d'expiration
        const now = new Date();
        const expirationDate = new Date(now);
        expirationDate.setDate(now.getDate() + licenseData.duration);
        
        // Mettre à jour la licence
        await updateDoc(doc(db, 'licenses', licenseDoc.id), {
            status: 'activated',
            userId: userId,
            activationDate: now,
            expirationDate: expirationDate,
            updatedAt: serverTimestamp()
        });
        
        // Créer ou mettre à jour la souscription de l'utilisateur
        const subscriptionRef = doc(db, 'users', userId, 'subscription', 'current');
        await setDoc(subscriptionRef, {
            licenseKeyId: licenseDoc.id,
            status: 'active',
            activationDate: now,
            expirationDate: expirationDate,
            plan: licenseData.plan,
            updatedAt: serverTimestamp()
        });
        
        return {
            success: true,
            message: 'Licence activée avec succès!',
            licenseData: {
                ...licenseData,
                activationDate: now,
                expirationDate: expirationDate,
                status: 'activated'
            }
        };
    } catch (error) {
        console.error('Erreur lors de l\'activation de la licence:', error);
        return {
            success: false,
            message: 'Une erreur est survenue lors de l\'activation de la licence.'
        };
    }
}

/**
 * Génère une nouvelle licence
 * @param {Object} licenseData - Données de la licence
 * @returns {Promise<Object>} - Résultat de la génération
 */
export async function generateLicense(licenseData) {
    try {
        // Utiliser l'instance Firestore importée au début du fichier
        
        // Générer une clé de licence unique
        const licenseKey = generateLicenseKey();
        
        // Créer la licence dans Firestore
        const licenseRef = collection(db, 'licenses');
        const newLicense = {
            licenseKey: licenseKey,
            duration: licenseData.duration,
            plan: licenseData.plan,
            price: licenseData.price,
            status: 'available',
            creationDate: new Date(),
            sellerId: licenseData.sellerId || null,
            userId: null,
            activationDate: null,
            expirationDate: null,
            createdAt: serverTimestamp()
        };
        
        const docRef = await addDoc(licenseRef, newLicense);
        
        return {
            success: true,
            message: 'Licence générée avec succès!',
            licenseId: docRef.id,
            licenseKey: licenseKey
        };
    } catch (error) {
        console.error('Erreur lors de la génération de la licence:', error);
        return {
            success: false,
            message: 'Une erreur est survenue lors de la génération de la licence.'
        };
    }
}

/**
 * Génère une clé de licence unique
 * @returns {string} - Clé de licence
 */
function generateLicenseKey() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let key = '';
    
    // Format: XXXX-XXXX-XXXX-XXXX
    for (let i = 0; i < 4; i++) {
        for (let j = 0; j < 4; j++) {
            key += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (i < 3) key += '-';
    }
    
    return key;
}

/**
 * Vérifie si l'utilisateur a besoin d'activer une licence
 * @param {string} userId - ID de l'utilisateur
 * @returns {Promise<boolean>} - True si l'utilisateur a besoin d'activer une licence
 */
export async function needsLicenseActivation(userId) {
    try {
        // On utilise directement checkActiveLicense qui utilise déjà getFirebaseInstances()
        const license = await checkActiveLicense(userId);
        return !license || !license.isActive;
    } catch (error) {
        console.error('Erreur lors de la vérification de la licence:', error);
        return true; // Par défaut, on considère qu'une licence est nécessaire en cas d'erreur
    }
}
