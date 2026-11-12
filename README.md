# KamasUltra

Outil de gestion des kamas pour Dofus : crafts, achat-revente, inventaire, atelier,
hôtel de vente, calculateurs (runes, alliances, montures, parchemins) et Almanax.

## Lancer en local (données gardées sur le disque)

Il faut Python 3.8 ou plus, sans rien d'autre à installer.

- Linux / macOS : `./lancer.sh`
- Windows : double-clic sur `lancer.bat`

Le navigateur s'ouvre sur <http://127.0.0.1:8765/>. Laisse la fenêtre du serveur ouverte
pendant que tu utilises le site (Ctrl+C pour l'arrêter). Autre port : `./lancer.sh --port 9000`.

Le serveur écoute sur toutes les interfaces (`0.0.0.0`) : depuis un téléphone ou un autre PC du
même réseau, utilise l'adresse « depuis le réseau local » affichée au démarrage. Il n'y a pas de
mot de passe : tout appareil du réseau peut lire et modifier les données. Pour limiter l'accès à
cet ordinateur : `./lancer.sh --hote 127.0.0.1`.

Les données sont écrites dans `donnees/kamasultra.json`, avec une copie par jour dans
`donnees/historique/` (30 jours). Ce dossier n'est pas versionné par git.
Au premier lancement, ce que le navigateur contenait déjà est recopié sur le disque.

### Fichier de prix

Les fichiers `.json` déposés dans `donnees/Price/` sont lus par la page Prix des ressources
(bouton « Relire le fichier de prix » après une mise à jour). Format attendu : des objets
`{"server": {...}, "prices": [{"itemId", "price", "observedAt", ...}]}`, un par ligne ou en un bloc.
Pour chaque ressource, entre ton prix saisi et celui du fichier, le plus récent est utilisé.

Un prix modifié dans la page Prix des ressources met aussi à jour le fichier : l'entrée de
l'objet reçoit le nouveau prix et la date du jour (`observedAt`, `lastConfirmedAt`, et
`lastChangedAt` si le prix change), `revision` + 1 et `freshness: "recent"`. Un objet absent
est ajouté avec `quality: "manual"`. Le reste du fichier est réécrit à l'identique, et une
copie est gardée dans `donnees/historique/` avant la première modification du jour.

Sans serveur (fichier `index.html` ouvert directement, ou GitHub Pages), le site
fonctionne comme avant : les données ne restent que dans le navigateur.

## API pour d'autres programmes (Update_HDV_price)

Sur le serveur local, sans authentification (réseau local de confiance) :

- `GET /api/a-verifier?jours=2&sources=atelier` : ressources dont le prix est inconnu ou plus
  vieux que `jours` (2 par défaut). `sources` : `atelier` (par défaut, les objets de l'Atelier),
  `craft` (la recette ouverte dans Investissements → Craft) ou `craft,atelier`. Réponse :
  `{"objet", "sources", "seuil_jours", "genere", "a_verifier": [{"itemId", "nom", "quantite",
  "prix", "date", "source", "origines", "objets", "raison": "inconnu" | "ancien"}], "a_jour": [...]}`.
  Ordre : craft d'abord, puis prix inconnus, puis du plus ancien au plus récent. `itemId` peut
  être `null` si la ressource n'a pas pu être identifiée.
- `PUT /api/prix` avec l'en-tête `X-KamasUltra: 1` et le corps
  `{"itemId": 22222, "price": 9000, "at": <horodatage en ms, facultatif>}` : met à jour
  `Price.json` comme une saisie sur le site. Le site ouvert reprend le nouveau prix en moins de 20 s.

## Organisation

| Fichier | Rôle |
|---|---|
| `index.html` | structure des pages |
| `css/style.css` | apparence |
| `js/stockage.js` | chargé en premier : lit le disque, recopie chaque modification |
| `js/app.js` | toute la logique du site |
| `serveur.py` | serveur local (fichiers du site + `api/donnees`) |
| `img/logo.png` | logo et icône |
