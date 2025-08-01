/**
 * Script pour corriger les importations Firebase dans tous les fichiers
 * Ce script remplace les appels getFirestore() par l'import de l'instance db depuis firebase-config.js
 */
const fs = require('fs');
const path = require('path');

// Liste des fichiers à corriger
const filesToFix = [
  'auth.js',
  'clients.js',
  'dashboard.js',
  'license-utils.js',
  'payments.js',
  'router-dashboard.js',
  'router-settings.js',
  'routers.js',
  'wifi-codes.js'
];

// Fonction pour corriger un fichier
function fixFile(filePath) {
  console.log(`Correction du fichier: ${filePath}`);
  
  try {
    // Lire le contenu du fichier
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Vérifier si le fichier utilise getFirestore()
    if (content.includes('getFirestore()')) {
      console.log(`- Remplacement de getFirestore() dans ${filePath}`);
      
      // Remplacer l'import de getFirestore
      content = content.replace(
        /import\s*{\s*([^}]*getFirestore[^}]*)\s*}\s*from\s*["']firebase\/firestore["']/g,
        (match, imports) => {
          // Supprimer getFirestore des imports
          const newImports = imports
            .split(',')
            .map(i => i.trim())
            .filter(i => !i.includes('getFirestore'))
            .join(', ');
          
          return `import { ${newImports} } from "firebase/firestore"`;
        }
      );
      
      // Remplacer la déclaration de db
      content = content.replace(
        /const\s+db\s*=\s*getFirestore\(\);/g,
        `// Importer l'instance Firestore déjà initialisée depuis firebase-config.js
import { db } from './firebase-config.js';`
      );
      
      // Si le fichier est dans un sous-dossier, ajuster le chemin d'importation
      if (filePath.includes('/') || filePath.includes('\\')) {
        content = content.replace(
          /import\s*{\s*db\s*}\s*from\s*['"]\.\/firebase-config\.js['"];/g,
          `import { db } from '../firebase-config.js';`
        );
      }
      
      // Remplacer également getAuth() si présent
      if (content.includes('getAuth()')) {
        // Supprimer l'import de getAuth
        content = content.replace(
          /import\s*{\s*([^}]*getAuth[^}]*)\s*}\s*from\s*["']firebase\/auth["']/g,
          (match, imports) => {
            // Supprimer getAuth des imports
            const newImports = imports
              .split(',')
              .map(i => i.trim())
              .filter(i => !i.includes('getAuth'))
              .join(', ');
            
            if (newImports.trim() === '') {
              return ''; // Supprimer complètement la ligne d'import si elle est vide
            }
            
            return `import { ${newImports} } from "firebase/auth"`;
          }
        );
        
        // Remplacer la déclaration de auth
        content = content.replace(
          /const\s+auth\s*=\s*getAuth\(\);/g,
          `// Importer l'instance Auth déjà initialisée depuis firebase-config.js
import { auth } from './firebase-config.js';`
        );
        
        // Si le fichier est dans un sous-dossier, ajuster le chemin d'importation
        if (filePath.includes('/') || filePath.includes('\\')) {
          content = content.replace(
            /import\s*{\s*auth\s*}\s*from\s*['"]\.\/firebase-config\.js['"];/g,
            `import { auth } from '../firebase-config.js';`
          );
        }
        
        // Fusionner les imports de firebase-config.js si nécessaire
        content = content.replace(
          /import\s*{\s*db\s*}\s*from\s*['"]\.\.\/firebase-config\.js['"];\s*import\s*{\s*auth\s*}\s*from\s*['"]\.\.\/firebase-config\.js['"];/g,
          `import { db, auth } from '../firebase-config.js';`
        );
        
        content = content.replace(
          /import\s*{\s*db\s*}\s*from\s*['"]\.\/firebase-config\.js['"];\s*import\s*{\s*auth\s*}\s*from\s*['"]\.\/firebase-config\.js['"];/g,
          `import { db, auth } from './firebase-config.js';`
        );
      }
      
      // Écrire le contenu modifié dans le fichier
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`- Fichier corrigé: ${filePath}`);
    } else {
      console.log(`- Aucune correction nécessaire pour ${filePath}`);
    }
  } catch (error) {
    console.error(`Erreur lors de la correction de ${filePath}:`, error);
  }
}

// Corriger tous les fichiers
filesToFix.forEach(file => {
  const filePath = path.join(__dirname, file);
  fixFile(filePath);
});

console.log('Correction terminée!');
