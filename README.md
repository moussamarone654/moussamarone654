# E-School Finance

Application web de gestion financière pour E-School Groupe — inspirée du modèle AEERS (Gestion des Cotisations), adaptée au suivi des dépenses et des paiements des formateurs.

## Installation

Aucune installation n'est nécessaire. C'est une application 100% front-end (HTML/CSS/JS).

1. Décompressez l'archive.
2. Ouvrez `index.html` dans un navigateur (double-clic), ou servez le dossier avec un petit serveur local, par exemple :
   ```
   npx serve .
   ```
   ou
   ```
   python3 -m http.server 8000
   ```
   puis ouvrez `http://localhost:8000`.

## Accès

- **Direction** : accès en lecture seule au tableau de bord et à l'historique, sans connexion nécessaire.
- **Trésorier** : cliquer sur « Espace Trésorier » puis se connecter.
  - Mot de passe par défaut : `tresorier2026`
  - Le mot de passe peut être changé depuis l'onglet Espace Trésorier → Paramètres.

## Fonctionnalités

- Tableau de bord (solde, recettes du mois, dépenses du mois, formateurs à jour)
- Gestion des formateurs (ajout, suppression sécurisée)
- Marquage des paiements par formateur / par mois
- Enregistrement des autres entrées (dons, subventions, événements, ventes...)
- Enregistrement des dépenses (formateur, salaire, fourniture, loyer, autre)
- Historique financier complet, filtrable par exercice (année)
- Suppression sécurisée par mot de passe (formateurs, transactions)
- Changement de mot de passe

## Stockage des données

Toutes les données sont stockées localement dans le navigateur via `localStorage`. Il n'y a pas de base de données ni de serveur : les données restent sur l'appareil utilisé. Pensez à utiliser toujours le même navigateur/appareil pour la saisie, ou à exporter régulièrement une sauvegarde si besoin (fonctionnalité à ajouter en évolution future).

## Synchronisation en ligne (Firebase Firestore)

Depuis cette version, l'application peut partager ses données **en temps réel entre tous les utilisateurs du lien**, via Firebase Firestore (gratuit).

### Configuration (à faire une seule fois)

1. Allez sur [https://console.firebase.google.com](https://console.firebase.google.com) et créez un projet gratuit.
2. Dans le menu de gauche : **Firestore Database** → **Créer une base de données** → démarrez en **mode test**.
3. Une fois créée, ouvrez l'onglet **Règles** de Firestore et collez le contenu du fichier `firestore.rules.txt` fourni dans cette archive, puis cliquez sur **Publier**.
4. Retournez dans **Paramètres du projet** (icône ⚙️) → section **Vos applications** → cliquez sur l'icône Web `</>` pour ajouter une application.
5. Copiez les valeurs affichées (`apiKey`, `authDomain`, `projectId`, etc.) et collez-les dans le fichier `firebase-config.js` de cette archive, à la place des `"VOTRE_..."`.
6. Republiez votre site (GitHub Pages, Netlify, etc.) avec les fichiers mis à jour.

### Résultat

- Un badge en haut à droite indique l'état : **● En ligne — données partagées** (vert) ou **● Mode local** (gris, si Firebase n'est pas configuré ou hors ligne).
- Toute personne qui ouvre le lien voit **les mêmes données**, mises à jour automatiquement dès qu'un changement est fait par n'importe qui (pas besoin de recharger la page).
- Si Firebase n'est pas configuré, l'application continue de fonctionner **en mode local uniquement** (comme avant), sans erreur bloquante.

### Limite de sécurité actuelle

Les règles fournies (`allow read, write: if true`) rendent la base accessible à toute personne connaissant l'URL du projet. Le mot de passe Trésorier protège l'usage dans l'application, mais pas l'accès direct à la base. Pour un usage réellement sensible, une authentification Firebase (comptes utilisateurs) peut être ajoutée en complément — à demander si besoin.


## Structure des fichiers

```
eschool-finance/
├── index.html            # Structure de l'application
├── style.css             # Design (palette, typographie, mise en page)
├── app.js                # Logique applicative + synchronisation Firestore
├── firebase-config.js    # Vos clés de configuration Firebase (à remplir)
├── firestore.rules.txt   # Règles de sécurité à coller dans la console Firebase
└── README.md
```
