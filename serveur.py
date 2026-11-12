#!/usr/bin/env python3
"""Serveur local de KamasUltra.

Sert le site sur http://127.0.0.1:8765/ et garde les données dans
donnees/kamasultra.json, pour qu'elles survivent au nettoyage du navigateur.
Une copie par jour est conservée dans donnees/historique/ (les 30 dernières).

Aucune dépendance : Python 3.8 ou plus suffit.
    python3 serveur.py              (port 8765)
    python3 serveur.py --port 9000
"""

import argparse
import datetime
import json
import os
import shutil
import sys
import threading
import webbrowser
from http import HTTPStatus
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

RACINE = os.path.dirname(os.path.abspath(__file__))
DOSSIER = os.path.join(RACINE, "donnees")
FICHIER = os.path.join(DOSSIER, "kamasultra.json")
HISTORIQUE = os.path.join(DOSSIER, "historique")
DOSSIER_PRIX = os.path.join(DOSSIER, "Price")
GARDER_JOURS = 30
TAILLE_MAX = 20 * 1024 * 1024  # 20 Mo, très au-delà d'un usage normal
PREFIXE = "ku_"
CHEMINS_INTERDITS = ("/donnees", "/.git", "/serveur.py")

verrou = threading.Lock()


def lire():
    try:
        with open(FICHIER, encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return None


_cache_prix = {"cle": None, "valeur": None}


def _documents(chemin):
    """Un fichier peut contenir un seul JSON ou une suite de lignes JSON."""
    with open(chemin, encoding="utf-8") as f:
        texte = f.read()
    try:
        yield json.loads(texte)
        return
    except ValueError:
        pass
    for ligne in texte.splitlines():
        ligne = ligne.strip()
        if ligne:
            try:
                yield json.loads(ligne)
            except ValueError:
                continue


def lire_prix():
    """Fusionne les fichiers de donnees/Price/ : le prix le plus récent par objet.

    Formats acceptés : {"server": {...}, "prices": [...]}, une liste de prix,
    ou une suite de ces objets ligne par ligne. Chaque prix doit avoir
    itemId et price ; observedAt (ou lastChangedAt) sert à garder le plus récent.
    """
    if not os.path.isdir(DOSSIER_PRIX):
        return {"fichiers": [], "serveurs": [], "prix": {}}
    noms = sorted(n for n in os.listdir(DOSSIER_PRIX) if n.lower().endswith(".json"))
    cle = tuple((n, os.path.getmtime(os.path.join(DOSSIER_PRIX, n))) for n in noms)
    if _cache_prix["cle"] == cle:
        return _cache_prix["valeur"]
    prix, serveurs, fichiers = {}, set(), []
    for nom, mtime in cle:
        n = 0
        try:
            docs = list(_documents(os.path.join(DOSSIER_PRIX, nom)))
        except OSError:
            continue
        for doc in docs:
            liste = doc.get("prices") if isinstance(doc, dict) else doc
            if isinstance(doc, dict) and isinstance(doc.get("server"), dict) and doc["server"].get("name"):
                serveurs.add(str(doc["server"]["name"]))
            if not isinstance(liste, list):
                continue
            for e in liste:
                if not isinstance(e, dict):
                    continue
                ident, valeur = e.get("itemId"), e.get("price")
                if not isinstance(ident, int) or isinstance(valeur, bool) or not isinstance(valeur, (int, float)) or valeur <= 0:
                    continue
                date = str(e.get("observedAt") or e.get("lastChangedAt") or "")
                ancien = prix.get(ident)
                if ancien is None or date > ancien[1]:
                    prix[ident] = [valeur, date, str(e.get("quality") or ""), str(e.get("freshness") or "")]
                n += 1
        fichiers.append({"nom": nom, "date": datetime.datetime.fromtimestamp(mtime).astimezone().isoformat(timespec="seconds"), "prix": n})
    valeur = {"fichiers": fichiers, "serveurs": sorted(serveurs), "prix": prix}
    _cache_prix.update(cle=cle, valeur=valeur)
    return valeur


def archiver_du_jour():
    """Copie le fichier actuel dans l'historique, une fois par jour."""
    if not os.path.exists(FICHIER):
        return
    os.makedirs(HISTORIQUE, exist_ok=True)
    jour = datetime.date.today().isoformat()
    cible = os.path.join(HISTORIQUE, "kamasultra-%s.json" % jour)
    if not os.path.exists(cible):
        shutil.copy2(FICHIER, cible)
    copies = sorted(n for n in os.listdir(HISTORIQUE) if n.startswith("kamasultra-"))
    for ancienne in copies[:-GARDER_JOURS]:
        os.remove(os.path.join(HISTORIQUE, ancienne))


def ecrire(donnees):
    """Écriture atomique : un fichier temporaire remplace l'ancien d'un coup."""
    os.makedirs(DOSSIER, exist_ok=True)
    archiver_du_jour()
    contenu = {
        "app": "KamasUltra",
        "version": 1,
        "date": datetime.datetime.now().astimezone().isoformat(timespec="seconds"),
        "data": donnees,
    }
    tmp = FICHIER + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(contenu, f, ensure_ascii=False)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, FICHIER)


def valider(corps):
    """Seules les clés ku_* à valeur texte sont acceptées, comme dans le navigateur."""
    if not isinstance(corps, dict) or not isinstance(corps.get("data"), dict):
        raise ValueError("format attendu : {\"data\": {...}}")
    donnees = corps["data"]
    for cle, valeur in donnees.items():
        if not cle.startswith(PREFIXE) or not isinstance(valeur, str):
            raise ValueError("clé refusée : %r" % cle[:40])
    return donnees


class Gestionnaire(SimpleHTTPRequestHandler):
    extensions_map = {
        **SimpleHTTPRequestHandler.extensions_map,
        ".html": "text/html; charset=utf-8",
        ".js": "text/javascript; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".json": "application/json",
        ".png": "image/png",
    }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=RACINE, **kwargs)

    # --- garde-fous -------------------------------------------------------
    def hote_local(self):
        # Refuse les noms d'hôte inconnus (protection contre le « DNS rebinding »)
        hote = (self.headers.get("Host") or "").rsplit(":", 1)[0].strip("[]")
        return hote in ("127.0.0.1", "localhost", "::1")

    def chemin(self):
        return self.path.split("?", 1)[0].split("#", 1)[0]

    def repondre_json(self, statut, objet):
        corps = json.dumps(objet, ensure_ascii=False).encode("utf-8")
        self.send_response(statut)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(corps)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(corps)

    def end_headers(self):
        if not self.chemin().startswith("/api/"):
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def log_message(self, fmt, *args):
        if self.chemin().startswith("/api/") and str(args[1] if len(args) > 1 else "").startswith("2"):
            return  # pas de bruit pour chaque enregistrement réussi
        super().log_message(fmt, *args)

    # --- routes -----------------------------------------------------------
    def do_GET(self):
        if not self.hote_local():
            return self.send_error(HTTPStatus.FORBIDDEN)
        c = self.chemin()
        if c == "/api/donnees":
            with verrou:
                contenu = lire()
            if contenu is None:
                return self.repondre_json(HTTPStatus.OK, {"app": "KamasUltra", "absent": True})
            return self.repondre_json(HTTPStatus.OK, contenu)
        if c == "/api/prix":
            try:
                return self.repondre_json(HTTPStatus.OK, lire_prix())
            except OSError as e:
                return self.repondre_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"erreur": str(e)})
        if any(c == p or c.startswith(p + "/") for p in CHEMINS_INTERDITS):
            return self.send_error(HTTPStatus.NOT_FOUND)
        return super().do_GET()

    def do_HEAD(self):
        if not self.hote_local():
            return self.send_error(HTTPStatus.FORBIDDEN)
        return super().do_HEAD()

    def do_PUT(self):
        if not self.hote_local() or self.chemin() != "/api/donnees":
            return self.send_error(HTTPStatus.FORBIDDEN)
        # En-tête propre au site : une page d'un autre site ne peut pas l'envoyer
        # sans autorisation CORS, que ce serveur ne donne jamais.
        if self.headers.get("X-KamasUltra") != "1":
            return self.send_error(HTTPStatus.FORBIDDEN)
        try:
            taille = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            taille = -1
        if taille <= 0 or taille > TAILLE_MAX:
            return self.repondre_json(HTTPStatus.REQUEST_ENTITY_TOO_LARGE, {"erreur": "taille invalide"})
        try:
            donnees = valider(json.loads(self.rfile.read(taille).decode("utf-8")))
        except (ValueError, UnicodeDecodeError) as e:
            return self.repondre_json(HTTPStatus.BAD_REQUEST, {"erreur": str(e)})
        try:
            with verrou:
                ecrire(donnees)
        except OSError as e:
            return self.repondre_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"erreur": "écriture impossible : %s" % e})
        return self.repondre_json(HTTPStatus.OK, {"ok": True})

    def do_POST(self):
        return self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)


def main():
    p = argparse.ArgumentParser(description="Serveur local de KamasUltra")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--sans-navigateur", action="store_true", help="ne pas ouvrir le navigateur")
    args = p.parse_args()

    try:
        serveur = ThreadingHTTPServer(("127.0.0.1", args.port), Gestionnaire)
    except OSError as e:
        print("Impossible d'utiliser le port %d (%s). KamasUltra tourne peut-être déjà :" % (args.port, e))
        print("  http://127.0.0.1:%d/" % args.port)
        sys.exit(1)

    adresse = "http://127.0.0.1:%d/" % args.port
    print("KamasUltra : %s" % adresse)
    print("Données : %s" % FICHIER)
    print("Ctrl+C pour arrêter.")
    if not args.sans_navigateur:
        threading.Timer(0.5, webbrowser.open, (adresse,)).start()
    try:
        serveur.serve_forever()
    except KeyboardInterrupt:
        print("\nArrêt.")


if __name__ == "__main__":
    main()
