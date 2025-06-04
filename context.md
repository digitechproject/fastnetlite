# FastNetLite - Contexte et Spécifications

## Vue d'ensemble

FastNetLite est une version simplifiée respoonsive et SaaS de FastNet, conçue pour être hébergée sur Vercel. Cette application permet aux propriétaires de hotspots WiFi (vendeurs) de gérer la vente de codes d'accès WiFi sans nécessiter une connexion directe aux routeurs MikroTik.

## Caractéristiques techniques

- **Hébergement** : Vercel (architecture JAMstack)
- **Frontend** : HTML, CSS, JavaScript, Bootstrap (via CDN)
- **Base de données** : Firebase (Firestore/Realtime Database)
- **Authentification** : Firebase Authentication
- **Paiement** : Intégration FedaPay
- **Architecture** : SaaS multi-tenants (plusieurs vendeurs peuvent créer leur compte)

## Différence avec FastNet

Contrairement à FastNet qui communique directement avec les routeurs MikroTik, FastNetLite fonctionne avec des codes pré-générés :

1. Les vendeurs génèrent leurs codes WiFi depuis leur système Mikhmon/Userman
2. Ils importent ces codes dans FastNetLite
3. FastNetLite gère la vente et le suivi de ces codes

## Structure de l'application

### Modèle de données

1. **Utilisateurs (Vendeurs)**
   - ID
   - Nom
   - Email
   - Date d'inscription
   - Statut (actif, suspendu)
   - Plan d'abonnement

2. **Routeurs (WifiZones)**
   - ID
   - Nom du WifiZone
   - Vendeur (ID)
   - Description
   - Clé API FedaPay
   - Date d'ajout

3. **Profils WiFi**
   - ID
   - Routeur (ID)
   - Nom
   - Description
   - Durée
   - Prix
   - Date de création

4. **Codes WiFi**
   - ID
   - Profil (ID)
   - Routeur (ID)
   - Code
   - Statut (disponible, utilisé, expiré)
   - Client (ID, si utilisé)
   - Date d'importation
   - Date d'utilisation

5. **Clients**
   - ID
   - Nom
   - Numéro WhatsApp
   - Date de création
   - Dernière activité

6. **Paiements**
   - ID
   - Code WiFi (ID)
   - Client (ID)
   - Montant
   - Méthode de paiement
   - Référence transaction
   - Statut (en attente, complété, échoué, remboursé)
   - Date de paiement
   - Métadonnées

### Structure de navigation

#### Navigation principale (page d'accueil)
- Mes Routeurs (WifiZones)
- Menu Admin (Paramètres, Déconnexion)

#### Navigation du panel admin d'un routeur
- Tableau de bord
- Clients
- Codes WiFi
- Paiements
- Paramètres du routeur

## Fonctionnalités détaillées

### 1. Authentification et gestion des comptes

- **Inscription** : Les vendeurs peuvent créer un compte avec email/mot de passe
- **Connexion** : Authentification sécurisée
- **Récupération de mot de passe** : Via email
- **Profil utilisateur** : Modification des informations personnelles

### 2. Gestion des routeurs (WifiZones)

- **Ajout de routeurs** : Création d'un nouveau WifiZone
- **Configuration** : Paramètres spécifiques pour chaque WifiZone
  - Nom du WifiZone
  - Description
  - Intégration FedaPay (clé API)
- **Liste des routeurs** : Vue d'ensemble de tous les WifiZones du vendeur
- **Suppression** : Possibilité de supprimer un WifiZone

### 3. Tableau de bord

- **Statistiques globales** :
  - Nombre de codes disponibles
  - Nombre de codes vendus
  - Revenus totaux
  - Clients actifs
- **Graphiques** :
  - Ventes par jour/semaine/mois
  - Répartition des ventes par profil
- **Alertes** :
  - Profils avec peu de codes disponibles
  - Transactions récentes

### 4. Gestion des profils WiFi

- **Création de profils** :
  - Nom
  - Description
  - Durée
  - Prix
- **Modification** : Mise à jour des informations des profils
- **Suppression** : Possibilité de supprimer un profil (si aucun code associé n'est vendu)
- **Liste des profils** : Vue d'ensemble de tous les profils d'un WifiZone

### 5. Gestion des codes WiFi

- **Importation de codes** :
  - Import massif via fichier CSV/Excel
  - Association à un profil spécifique
- **Liste des codes** :
  - Filtrage par statut (disponible, utilisé, expiré)
  - Recherche par code ou client
- **Détails d'un code** :
  - Informations complètes
  - Historique d'utilisation
- **Suppression** : Possibilité de supprimer des codes non utilisés

### 6. Gestion des clients

- **Enregistrement** :
  - Nom
  - Numéro WhatsApp
- **Liste des clients** :
  - Recherche
  - Filtrage
- **Profil client** :
  - Historique des achats
  - Codes actuellement actifs
- **Statistiques client** :
  - Montant total dépensé
  - Fréquence d'achat

### 7. Gestion des paiements

- **Intégration FedaPay** :
  - Configuration par WifiZone
  - Webhooks pour les notifications
- **Suivi des transactions** :
  - Liste des paiements
  - Filtrage par statut
  - Recherche par référence
- **Détails d'une transaction** :
  - Informations complètes
  - Possibilité de marquer comme remboursé

### 8. Paramètres du routeur

- **Informations générales** :
  - Nom
  - Description
- **Configuration FedaPay** :
  - Clé API
  - Mode test/production
- **Personnalisation** :
  - Logo
  - Couleurs
  - Message de bienvenue

## Flux de fonctionnement

### Côté vendeur (administrateur)

1. **Inscription/Connexion** au système
2. **Création d'un WifiZone** (routeur)
3. **Création de profils WiFi** pour le WifiZone
4. **Génération de codes** dans le système Mikhmon/Userman (hors application)
5. **Importation des codes** dans FastNetLite et association aux profils
6. **Configuration de FedaPay** pour recevoir les paiements
7. **Suivi des ventes et clients** via le tableau de bord

<!-- ### Côté client (acheteur) -->
<!-- 
1. **Accès** à la page d'achat spécifique au WifiZone
2. **Sélection** d'un forfait WiFi
3. **Saisie** des informations personnelles
4. **Paiement** via FedaPay
5. **Réception** du code WiFi (par affichage et/ou WhatsApp) -->

## Interface utilisateur

### Pages principales

1. **Connexion/Inscription**
2. **Liste des WifiZones**
3. **Tableau de bord**
4. **Gestion des profils**
5. **Gestion des codes**
6. **Liste des clients**
7. **Historique des paiements**
8. **Paramètres**
9. **Page d'achat client**

### Composants UI

- Tableaux de données avec pagination et filtrage
- Formulaires d'ajout/modification
- Graphiques et statistiques
- Modales de confirmation
- Notifications système
- Interface d'importation de fichiers

## Sécurité

- Authentification Firebase
<!-- - Protection CSRF -->
- Validation des entrées utilisateur
- Règles de sécurité Firebase
- Isolation des données entre vendeurs

## Déploiement et architecture

- **Frontend** : Déploiement sur Vercel
- **Base de données** : Firebase Firestore/Realtime Database
- **Authentification** : Firebase Authentication
- **Stockage** : Firebase Storage (pour les logos, etc.)
- **Fonctions serverless** : Vercel Serverless Functions ou Firebase Cloud Functions

## Évolutions futures potentielles

- Application mobile pour les vendeurs
- Système d'abonnement pour les vendeurs
- Intégration de plusieurs passerelles de paiement
- Système de tickets de support
- Statistiques avancées et rapports
- API pour intégration avec d'autres systèmes
