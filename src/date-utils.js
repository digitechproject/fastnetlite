/**
 * Utilitaires pour le formatage des dates
 */

/**
 * Formate une date en toute sécurité, en gérant les cas où la date peut être null, undefined ou invalide
 * @param {Date|Object|string|number} dateValue - La valeur de date à formater (peut être un timestamp Firestore, une Date, une chaîne ou un nombre)
 * @param {string} locale - La locale à utiliser pour le formatage (par défaut: 'fr-FR')
 * @param {Object} options - Options de formatage pour toLocaleDateString
 * @returns {string} - La date formatée ou 'N/A' si la date est invalide
 */
export function formatDateSafely(dateValue, locale = 'fr-FR', options = {}) {
    // Valeur par défaut si la date est invalide
    if (!dateValue) {
        return 'N/A';
    }
    
    try {
        // Si c'est un timestamp Firestore, le convertir en Date
        if (dateValue.toDate && typeof dateValue.toDate === 'function') {
            return dateValue.toDate().toLocaleDateString(locale, options);
        } 
        // Si c'est déjà un objet Date
        else if (dateValue instanceof Date) {
            return dateValue.toLocaleDateString(locale, options);
        }
        // Si c'est une chaîne de date ou un timestamp
        else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
            return new Date(dateValue).toLocaleDateString(locale, options);
        }
        // Autres cas
        return 'N/A';
    } catch (error) {
        console.warn('Erreur lors du formatage de la date:', error);
        return 'N/A';
    }
}

/**
 * Formate une date et heure en toute sécurité
 * @param {Date|Object|string|number} dateValue - La valeur de date à formater
 * @param {string} locale - La locale à utiliser pour le formatage (par défaut: 'fr-FR')
 * @returns {string} - La date et heure formatées ou 'N/A' si la date est invalide
 */
export function formatDateTimeSafely(dateValue, locale = 'fr-FR') {
    return formatDateSafely(dateValue, locale, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}
