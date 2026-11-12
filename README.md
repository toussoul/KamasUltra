# KamasUltra

Outil de gestion des kamas pour Dofus : crafts, achat-revente, inventaire, atelier,
hôtel de vente, calculateurs (runes, alliances, montures, parchemins) et Almanax.

## Lancer en local (données gardées sur le disque)

Il faut Python 3.8 ou plus, sans rien d'autre à installer.

- Linux / macOS : `./lancer.sh`
- Windows : double-clic sur `lancer.bat`

Le navigateur s'ouvre sur <http://127.0.0.1:8765/>. Laisse la fenêtre du serveur ouverte
pendant que tu utilises le site (Ctrl+C pour l'arrêter). Autre port : `./lancer.sh --port 9000`.

Les données sont écrites dans `donnees/kamasultra.json`, avec une copie par jour dans
`donnees/historique/` (30 jours). Ce dossier n'est pas versionné par git.
Au premier lancement, ce que le navigateur contenait déjà est recopié sur le disque.

### Fichier de prix

Les fichiers `.json` déposés dans `donnees/Price/` sont lus par la page Prix des ressources
(bouton « Relire le fichier de prix » après une mise à jour). Format attendu : des objets
`{"server": {...}, "prices": [{"itemId", "price", "observedAt", ...}]}`, un par ligne ou en un bloc.
Pour chaque ressource, entre ton prix saisi et celui du fichier, le plus récent est utilisé.

Sans serveur (fichier `index.html` ouvert directement, ou GitHub Pages), le site
fonctionne comme avant : les données ne restent que dans le navigateur.

## Organisation

| Fichier | Rôle |
|---|---|
| `index.html` | structure des pages |
| `css/style.css` | apparence |
| `js/stockage.js` | chargé en premier : lit le disque, recopie chaque modification |
| `js/app.js` | toute la logique du site |
| `serveur.py` | serveur local (fichiers du site + `api/donnees`) |
| `img/logo.png` | logo et icône |
