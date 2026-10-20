#!/usr/bin/env python3
"""Importe dans public/identite/ ce que Pharmat reprend du kit Identity, et construit sa
planche de pictogrammes.

    python outils/importer-kits.py <dossier d'un clone de Benoit62/Identity>

Pharmat reprend la mécanique du kit (composants bw-, sélecteur de thème, police Figtree) mais
pas sa partie « organique » (Bricolage Grotesque, papier chaud, courbes de niveau) : sa
palette verte et ses ajustements sont dans public/css/pharmat.css.

Pictogrammes : Lucide, même version figée et même empreinte que le kit Identity, même trait
de 1,75 px, avec la liste propre à Pharmat (ICONES ci-dessous). Pour en ajouter un : l'écrire
dans ICONES, relancer le script.
"""
import hashlib, io, os, re, shutil, subprocess, sys, tarfile, urllib.request

VERSION = "1.52.0"
URL = f"https://registry.npmjs.org/lucide-static/-/lucide-static-{VERSION}.tgz"
SHA512 = ("d336588a10337b866650273235af4e91662a9ff6397fd01d4e1d3601923132d3"
          "f9adabdc4d37e848802750f047e99bcac6df995b6f0907495dccb4720fcd9f73")
TRAIT = "1.75"
RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
CIBLE = os.path.join(RACINE, "public", "identite")

FICHIERS = [  # (dans Identity, dans public/identite)
    ("web/css/bw-ui.css", "css/bw-ui.css"),
    ("web/js/bw-theme.js", "js/bw-theme.js"),
    ("web/js/bw-ui.js", "js/bw-ui.js"),
    ("fonts/Figtree-VF.woff2", "fonts/Figtree-VF.woff2"),
    ("fonts/Figtree-Italic-VF.woff2", "fonts/Figtree-Italic-VF.woff2"),
]

ICONES = [
    # Navigation
    "house", "history", "chart-column", "user", "shield", "log-out", "log-in", "menu", "x",
    "arrow-left", "arrow-right", "chevron-left", "chevron-right", "external-link",
    # Séances
    "dumbbell", "book-open", "graduation-cap", "play", "shuffle", "rotate-ccw", "timer", "flag",
    "list-checks", "circle-check", "circle-x", "circle-help", "circle-minus", "check", "target",
    "flame", "trophy", "layers", "pill",
    # Formulaires et messages
    "mail", "lock", "eye", "eye-off", "info", "triangle-alert", "bell", "bell-off",
    "sun", "moon", "monitor",
    # Administration
    "users", "user-check", "user-x", "pencil", "trash-2", "plus", "search", "upload", "download",
    "file-json", "send", "filter",
]


def lucide():
    with urllib.request.urlopen(URL, timeout=120) as r:
        brut = r.read()
    if hashlib.sha512(brut).hexdigest() != SHA512:
        sys.exit("Lucide : empreinte inattendue, rien n'est écrit.")
    return tarfile.open(fileobj=io.BytesIO(brut))


def interieur(svg):
    corps = re.search(r"<svg[^>]*>(.*)</svg>", svg, re.S).group(1)
    corps = re.sub(r"<!--.*?-->", "", corps, flags=re.S)
    corps = re.sub(r"\s*\n\s*", "", corps)
    return re.sub(r"\s+/>", "/>", corps).strip()


def main():
    if len(sys.argv) != 2 or not os.path.isdir(os.path.join(sys.argv[1], "web")):
        sys.exit(__doc__)
    identite = sys.argv[1]
    commit = subprocess.run(["git", "-C", identite, "log", "-1", "--format=%H %cs %s"],
                            capture_output=True, text=True).stdout.strip() or "inconnu"

    if os.path.isdir(CIBLE):
        shutil.rmtree(CIBLE)
    for source, cible in FICHIERS:
        os.makedirs(os.path.dirname(os.path.join(CIBLE, cible)), exist_ok=True)
        shutil.copyfile(os.path.join(identite, source), os.path.join(CIBLE, cible))

    tar = lucide()
    attr = (f'fill="none" stroke="currentColor" stroke-width="{TRAIT}" '
            'stroke-linecap="round" stroke-linejoin="round"')
    symboles = []
    for nom in ICONES:
        try:
            trace = interieur(tar.extractfile(f"package/icons/{nom}.svg").read().decode())
        except KeyError:
            sys.exit(f"« {nom} » n'existe pas dans Lucide {VERSION}.")
        symboles.append(f'<symbol id="{nom}" viewBox="0 0 24 24" {attr}>{trace}</symbol>')
    os.makedirs(os.path.join(CIBLE, "icones"), exist_ok=True)
    with open(os.path.join(CIBLE, "icones", "icones.svg"), "w", encoding="utf-8", newline="\n") as o:
        o.write('<svg xmlns="http://www.w3.org/2000/svg">\n'
                f'<!-- Pictogrammes de Pharmat : Lucide {VERSION} (ISC), trait {TRAIT} px. '
                'Ne pas éditer : relancer outils/importer-kits.py. -->\n'
                + "\n".join(symboles) + "\n</svg>\n")
    with open(os.path.join(CIBLE, "icones", "LICENSE.txt"), "w", encoding="utf-8", newline="\n") as o:
        o.write(tar.extractfile("package/LICENSE").read().decode())

    with open(os.path.join(CIBLE, "SOURCE.txt"), "w", encoding="utf-8", newline="\n") as o:
        o.write("Extraits du kit web de Benoit62/Identity — copiés par outils/importer-kits.py.\n"
                f"Commit : {commit}\n"
                "Ne pas éditer ici : corriger dans Identity, puis réimporter. Les ajustements propres\n"
                "à Pharmat sont dans public/css/pharmat.css.\n"
                "Police Figtree : SIL Open Font License 1.1.\n"
                f"Pictogrammes : Lucide {VERSION} (ISC), {len(ICONES)} retenus, sha512 {SHA512[:16]}…\n")
    print(f"identite : {len(FICHIERS)} fichiers du kit ({commit[:7]}), {len(ICONES)} pictogrammes")


if __name__ == "__main__":
    main()
