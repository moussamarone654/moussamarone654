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

## Structure des fichiers

```
eschool-finance/
├── index.html   # Structure de l'application
├── style.css    # Design (palette, typographie, mise en page)
├── app.js       # Logique applicative (état, calculs, interactions)
└── README.md
```
