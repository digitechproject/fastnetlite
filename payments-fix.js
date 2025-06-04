/**
 * Fonction corrigée pour ajouter une ligne de paiement
 * Remplacez la fonction addPaymentRow dans payments.js par cette version
 */
function addPaymentRow(payment, container, routerId) {
    // Créer une ligne
    const row = document.createElement('tr');
    
    // Formater la date avec vérification pour éviter les erreurs
    let formattedDate = 'N/A';
    
    // Vérifier si la date est valide avant de formater
    if (payment.date) {
        try {
            // Si c'est un timestamp Firestore, le convertir en Date
            if (payment.date.toDate && typeof payment.date.toDate === 'function') {
                formattedDate = payment.date.toDate().toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            } 
            // Si c'est déjà un objet Date
            else if (payment.date instanceof Date) {
                formattedDate = payment.date.toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
            // Si c'est une chaîne de date ou un timestamp
            else if (typeof payment.date === 'string' || typeof payment.date === 'number') {
                formattedDate = new Date(payment.date).toLocaleDateString('fr-FR', {
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        } catch (error) {
            console.warn('Erreur lors du formatage de la date de paiement:', error);
        }
    }
    
    // Méthode de paiement
    let methodText = '';
    switch (payment.method) {
        case 'cash':
            methodText = 'Espèces';
            break;
        case 'mobile_money':
            methodText = 'Mobile Money';
            break;
        case 'bank_transfer':
            methodText = 'Virement bancaire';
            break;
        case 'fedapay':
            methodText = 'FedaPay';
            break;
        default:
            methodText = 'Autre';
    }
    
    // Statut
    let statusClass = '';
    let statusText = '';
    switch (payment.status) {
        case 'completed':
            statusClass = 'bg-success';
            statusText = 'Complété';
            break;
        case 'pending':
            statusClass = 'bg-warning';
            statusText = 'En attente';
            break;
        case 'failed':
            statusClass = 'bg-danger';
            statusText = 'Échoué';
            break;
        default:
            statusClass = 'bg-secondary';
            statusText = payment.status;
    }
    
    // Remplir la ligne
    row.innerHTML = `
        <td><small class="text-muted">${payment.id}</small></td>
        <td>${formattedDate}</td>
        <td>${payment.clientName || 'Client inconnu'}</td>
        <td>${payment.profileName || 'N/A'}</td>
        <td><code>${payment.code || 'N/A'}</code></td>
        <td>${payment.amount || 0} FCFA</td>
        <td>${methodText}</td>
        <td><span class="badge ${statusClass}">${statusText}</span></td>
        <td>
            <div class="btn-group">
                <button type="button" class="btn btn-sm btn-outline-primary view-payment-btn" data-payment-id="${payment.id}">
                    <i class="fas fa-eye"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary edit-payment-btn" data-payment-id="${payment.id}">
                    <i class="fas fa-edit"></i>
                </button>
                <button type="button" class="btn btn-sm btn-outline-danger delete-payment-btn" data-payment-id="${payment.id}">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </td>
    `;
    
    // Ajouter la ligne au conteneur
    container.appendChild(row);
    
    // Ajouter les gestionnaires d'événements pour les boutons
    row.querySelector('.view-payment-btn').addEventListener('click', function() {
        showPaymentDetails(payment.id, routerId);
    });
    
    row.querySelector('.edit-payment-btn').addEventListener('click', function() {
        editPayment(payment.id, routerId);
    });
    
    row.querySelector('.delete-payment-btn').addEventListener('click', function() {
        deletePayment(payment.id, routerId);
    });
}
