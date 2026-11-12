#!/usr/bin/env python3
"""Serveur local de KamasUltra.

Sert le site sur le port 8765 (toutes les interfaces : accessible depuis le
réseau local, par exemple un téléphone) et garde les données dans
donnees/kamasultra.json, pour qu'elles survivent au nettoyage du navigateur.
Une copie par jour est conservée dans donnees/historique/ (les 30 dernières).

Aucune dépendance : Python 3.8 ou plus suffit.
    python3 serveur.py                    (0.0.0.0:8765)
    python3 serveur.py --port 9000
    python3 serveur.py --hote 127.0.0.1   (cet ordinateur seulement)
"""

import argparse
import datetime
import ipaddress
import json
import os
import shutil
import socket
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
_nom = socket.gethostname().lower()
NOMS_LOCAUX = {"localhost", _nom, _nom.split(".")[0], _nom.split(".")[0] + ".local"}


def adresses_reseau():
    """Adresses IPv4 de cette machine sur le réseau local (pour y accéder depuis un autre appareil)."""
    vues = set()
    try:
        for info in socket.getaddrinfo(socket.gethostname(), None, socket.AF_INET):
            vues.add(info[4][0])
    except OSError:
        pass
    try:  # adresse de la route par défaut (aucun paquet n'est envoyé)
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("192.0.2.1", 9))
        vues.add(s.getsockname()[0])
        s.close()
    except OSError:
        pass
    return sorted(a for a in vues if not a.startswith("127."))


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
        fichiers.append({"nom": nom, "date": datetime.datetime.fromtimestamp(mtime).astimezone().isoformat(timespec="milliseconds"), "prix": n})
    valeur = {"fichiers": fichiers, "serveurs": sorted(serveurs), "prix": prix}
    _cache_prix.update(cle=cle, valeur=valeur)
    return valeur


def _cle(nom):
    return str(nom or "").strip().lower()


def _ms(date_iso):
    try:
        return datetime.datetime.fromisoformat(str(date_iso).replace("Z", "+00:00")).timestamp() * 1000
    except ValueError:
        return 0


def a_verifier(jours=2.0):
    """Ressources du craft en cours (Investissements → Craft) dont le prix est inconnu
    ou plus vieux que `jours`. Même règle que le site : entre le prix saisi et celui
    des fichiers de prix, le plus récent compte.
    """
    contenu = lire() or {}
    data = contenu.get("data") if isinstance(contenu, dict) else {}
    data = data if isinstance(data, dict) else {}

    def charger(cle, defaut):
        try:
            v = json.loads(data.get(cle) or "null")
        except ValueError:
            return defaut
        return v if isinstance(v, type(defaut)) else defaut

    brouillon, saisis, ids = charger("ku_iv_draft", {}), charger("ku_prix", {}), charger("ku_ids", {})
    fichier = lire_prix()["prix"]
    maintenant = datetime.datetime.now().timestamp() * 1000
    limite = maintenant - jours * 86400000
    vus, a_faire, a_jour = set(), [], []
    for r in brouillon.get("rows") or []:
        if not isinstance(r, dict):
            continue
        nom = str(r.get("name") or "").strip()
        if not nom or _cle(nom) in vus:
            continue
        vus.add(_cle(nom))
        ident = r.get("id") if isinstance(r.get("id"), int) else ids.get(_cle(nom))
        ident = ident if isinstance(ident, int) and ident > 0 else None
        m = saisis.get(_cle(nom))
        m = m if isinstance(m, dict) and isinstance(m.get("price"), (int, float)) and m["price"] > 0 else None
        f = fichier.get(ident) if ident else None
        m_at = float(m.get("at") or 0) if m else -1
        f_at = _ms(f[1]) if f else -1
        if m and m_at >= f_at:
            prix, quand, source = m["price"], m_at, "saisi"
        elif f:
            prix, quand, source = f[0], f_at, "fichier"
        else:
            prix, quand, source = None, None, None
        try:
            qte = float(str(r.get("qty") or "0").replace(" ", "").replace("\u202f", "").replace(",", "."))
        except ValueError:
            qte = 0
        entree = {
            "itemId": ident, "nom": nom, "quantite": qte if qte != int(qte) else int(qte),
            "prix": prix, "date": _iso(quand) if quand else None, "source": source,
        }
        if prix is None:
            entree["raison"] = "inconnu"
        elif quand < limite:
            entree["raison"] = "ancien"
        if "raison" in entree:
            a_faire.append(entree)
        else:
            a_jour.append(entree)
    return {
        "objet": str(brouillon.get("name") or "").strip(),
        "seuil_jours": jours,
        "genere": _iso(maintenant),
        "a_verifier": a_faire,
        "a_jour": a_jour,
    }


def archiver_du_jour(chemin=FICHIER, prefixe="kamasultra"):
    """Copie le fichier dans l'historique, une fois par jour (les GARDER_JOURS derniers)."""
    if not os.path.exists(chemin):
        return
    os.makedirs(HISTORIQUE, exist_ok=True)
    jour = datetime.date.today().isoformat()
    cible = os.path.join(HISTORIQUE, "%s-%s.json" % (prefixe, jour))
    if not os.path.exists(cible):
        shutil.copy2(chemin, cible)
    copies = sorted(n for n in os.listdir(HISTORIQUE) if n.startswith(prefixe + "-") and n[len(prefixe) + 1:][:4].isdigit())
    for ancienne in copies[:-GARDER_JOURS]:
        os.remove(os.path.join(HISTORIQUE, ancienne))


def _ecrire_atomique(chemin, texte):
    tmp = chemin + ".tmp"
    with open(tmp, "w", encoding="utf-8", newline="") as f:
        f.write(texte)
        f.flush()
        os.fsync(f.fileno())
    os.replace(tmp, chemin)


def _iso(ms):
    return datetime.datetime.fromtimestamp(ms / 1000, datetime.timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _compact(doc):
    # Même écriture que les fichiers de prix d'origine : compacte, sans espaces
    return json.dumps(doc, separators=(",", ":"), ensure_ascii=False)


def maj_prix(ident, valeur, quand_ms):
    """Met à jour le prix d'un objet dans les fichiers de donnees/Price/.

    Chaque entrée de cet objet reçoit le nouveau prix et la date (observedAt,
    lastConfirmedAt, lastChangedAt), revision + 1 et freshness « recent ». Si
    l'objet n'est dans aucun fichier, il est ajouté au fichier modifié le plus
    récemment. Le reste du fichier est réécrit à l'identique. Une copie de chaque
    fichier est gardée dans l'historique avant sa première modification du jour.
    """
    if not os.path.isdir(DOSSIER_PRIX):
        raise LookupError("dossier donnees/Price/ absent")
    noms = sorted(n for n in os.listdir(DOSSIER_PRIX) if n.lower().endswith(".json"))
    if not noms:
        raise LookupError("aucun fichier .json dans donnees/Price/")
    date = _iso(quand_ms)

    def maj(e):
        if e.get("price") != valeur:
            e["lastChangedAt"] = date
            if isinstance(e.get("revision"), int):
                e["revision"] += 1
        e["price"] = valeur
        e["observedAt"] = date
        e["lastConfirmedAt"] = date
        e["freshness"] = "recent"
        if e.get("quality") in (None, "", "unknown"):
            e["quality"] = "manual"

    def charger(nom):
        chemin = os.path.join(DOSSIER_PRIX, nom)
        with open(chemin, encoding="utf-8", newline="") as f:
            texte = f.read()
        try:
            return chemin, "bloc", [texte], [json.loads(texte)]
        except ValueError:
            pass
        parties = texte.split("\n")
        docs = []
        for p in parties:
            try:
                docs.append(json.loads(p) if p.strip() else None)
            except ValueError:
                docs.append(None)
        return chemin, "lignes", parties, docs

    def listes(doc):
        if isinstance(doc, dict) and isinstance(doc.get("prices"), list):
            return doc["prices"]
        return doc if isinstance(doc, list) else None

    def enregistrer(chemin, mode, parties, docs, modifies):
        if mode == "bloc":
            texte = _compact(docs[0])
        else:
            for i in modifies:
                parties[i] = _compact(docs[i])
            texte = "\n".join(parties)
        archiver_du_jour(chemin, "prix-" + os.path.splitext(os.path.basename(chemin))[0])
        _ecrire_atomique(chemin, texte)

    modifies_fichiers = []
    for nom in noms:
        chemin, mode, parties, docs = charger(nom)
        modifies = set()
        for i, doc in enumerate(docs):
            for e in listes(doc) or []:
                if isinstance(e, dict) and e.get("itemId") == ident:
                    maj(e)
                    modifies.add(i)
        if modifies:
            enregistrer(chemin, mode, parties, docs, modifies)
            modifies_fichiers.append(nom)

    ajoute = False
    if not modifies_fichiers:
        nom = max(noms, key=lambda n: os.path.getmtime(os.path.join(DOSSIER_PRIX, n)))
        chemin, mode, parties, docs = charger(nom)
        cible = next((i for i in range(len(docs) - 1, -1, -1) if listes(docs[i]) is not None), None)
        if cible is None:
            raise LookupError("format de %s non reconnu" % nom)
        doc = docs[cible]
        serveur = doc.get("server") if isinstance(doc, dict) and isinstance(doc.get("server"), dict) else {}
        entree = {"itemId": ident}
        if serveur.get("id"):
            entree["serverId"] = serveur["id"]
        entree.update({"price": valeur, "revision": 1, "quality": "manual", "freshness": "recent",
                       "reference": "unit_observed", "observedAt": date, "lastConfirmedAt": date, "lastChangedAt": date})
        listes(doc).append(entree)
        enregistrer(chemin, mode, parties, docs, {cible})
        modifies_fichiers.append(nom)
        ajoute = True

    _cache_prix["cle"] = None  # relu au prochain appel
    return {"ok": True, "fichiers": modifies_fichiers, "ajoute": ajoute, "date": date}


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
        # Protection contre le « DNS rebinding » : un site malveillant ne peut viser ce serveur
        # que par un nom de domaine qu'il contrôle. On n'accepte donc qu'une adresse IP écrite
        # telle quelle (127.0.0.1, 192.168.1.20…), localhost ou le nom de cette machine.
        hote = (self.headers.get("Host") or "").strip()
        if hote.startswith("["):
            hote = hote[1:].split("]", 1)[0]
        elif hote.count(":") == 1:
            hote = hote.split(":", 1)[0]
        hote = hote.lower().rstrip(".")
        try:
            ipaddress.ip_address(hote)
            return True
        except ValueError:
            pass
        return hote in NOMS_LOCAUX

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
        if c == "/api/a-verifier":
            try:
                q = self.path.split("?", 1)[1] if "?" in self.path else ""
                params = dict(p.split("=", 1) for p in q.split("&") if "=" in p)
                jours = float(params.get("jours", "2").replace(",", "."))
                if not 0 <= jours <= 3650:
                    raise ValueError
            except ValueError:
                return self.repondre_json(HTTPStatus.BAD_REQUEST, {"erreur": "jours invalide"})
            with verrou:
                return self.repondre_json(HTTPStatus.OK, a_verifier(jours))
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
        if not self.hote_local() or self.chemin() not in ("/api/donnees", "/api/prix"):
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
            corps = json.loads(self.rfile.read(taille).decode("utf-8"))
        except (ValueError, UnicodeDecodeError) as e:
            return self.repondre_json(HTTPStatus.BAD_REQUEST, {"erreur": str(e)})
        if self.chemin() == "/api/prix":
            return self.put_prix(corps)
        try:
            donnees = valider(corps)
        except ValueError as e:
            return self.repondre_json(HTTPStatus.BAD_REQUEST, {"erreur": str(e)})
        try:
            with verrou:
                ecrire(donnees)
        except OSError as e:
            return self.repondre_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"erreur": "écriture impossible : %s" % e})
        return self.repondre_json(HTTPStatus.OK, {"ok": True})

    def put_prix(self, corps):
        """{"itemId": 15271, "price": 58000, "at": 1794514035708} : met à jour les fichiers de prix."""
        c = corps if isinstance(corps, dict) else {}
        ident, valeur, quand = c.get("itemId"), c.get("price"), c.get("at")
        if (not isinstance(ident, int) or isinstance(ident, bool) or ident <= 0
                or isinstance(valeur, bool) or not isinstance(valeur, (int, float)) or not 0 < valeur < 1e13):
            return self.repondre_json(HTTPStatus.BAD_REQUEST, {"erreur": "itemId et price attendus"})
        if isinstance(valeur, float) and valeur.is_integer():
            valeur = int(valeur)
        maintenant = datetime.datetime.now().timestamp() * 1000
        if isinstance(quand, bool) or not isinstance(quand, (int, float)) or abs(quand - maintenant) > 86400000:
            quand = maintenant  # date du client absente ou incohérente : date du serveur
        try:
            with verrou:
                return self.repondre_json(HTTPStatus.OK, maj_prix(ident, valeur, quand))
        except LookupError as e:
            return self.repondre_json(HTTPStatus.NOT_FOUND, {"erreur": str(e)})
        except OSError as e:
            return self.repondre_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"erreur": "écriture impossible : %s" % e})

    def do_POST(self):
        return self.send_error(HTTPStatus.METHOD_NOT_ALLOWED)


def main():
    p = argparse.ArgumentParser(description="Serveur local de KamasUltra")
    p.add_argument("--port", type=int, default=8765)
    p.add_argument("--hote", default="0.0.0.0",
                   help="adresse d'écoute (0.0.0.0 = tout le réseau local, 127.0.0.1 = cet ordinateur seulement)")
    p.add_argument("--sans-navigateur", action="store_true", help="ne pas ouvrir le navigateur")
    args = p.parse_args()
    try:
        sys.stdout.reconfigure(line_buffering=True)  # messages visibles tout de suite, même redirigés
    except AttributeError:
        pass

    try:
        serveur = ThreadingHTTPServer((args.hote, args.port), Gestionnaire)
    except OSError as e:
        print("Impossible d'utiliser le port %d (%s). KamasUltra tourne peut-être déjà :" % (args.port, e))
        print("  http://127.0.0.1:%d/" % args.port)
        sys.exit(1)

    adresse = "http://127.0.0.1:%d/" % args.port
    print("KamasUltra : %s" % adresse)
    if args.hote in ("0.0.0.0", ""):
        for ip in adresses_reseau():
            print("  depuis le réseau local : http://%s:%d/" % (ip, args.port))
        print("  Attention : sans mot de passe, tout appareil du réseau peut lire et modifier tes données.")
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
