#!/usr/bin/env python3
"""Rend les icônes PNG et le favicon.ico depuis les sources SVG du logo.

    python outils/generer-icones.py

Sources : public/favicon.svg (la pastille) et public/img/logo.svg (le logo seul).
Le rendu passe par un navigateur Chromium sans tête (Edge ou Chrome, installé sur le poste).
"""
import os, shutil, struct, subprocess, sys, tempfile

RACINE = os.path.normpath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
PUBLIC = os.path.join(RACINE, "public")
NAVIGATEURS = [
    r"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe",
    r"C:\Program Files\Google\Chrome\Application\chrome.exe",
    "msedge", "google-chrome", "chromium",
]
SVG_CARRE = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#127a4a"/>'
             '<g transform="translate(6 6) scale(.8125)">{}</g></svg>')

# (source, sortie, côté en px, fond plein pour iOS)
RENDUS = [
    ("favicon.svg", "img/icone-192.png", 192, False),
    ("favicon.svg", "img/icone-512.png", 512, False),
    ("favicon.svg", "img/apple-touch-icon.png", 180, True),
    ("favicon.svg", "img/logo-courriel.png", 80, False),
    ("favicon.svg", "favicon-32.png", 32, False),
]


def navigateur():
    for n in NAVIGATEURS:
        if os.path.exists(n) or shutil.which(n):
            return n
    sys.exit("Aucun navigateur Chromium trouvé (Edge ou Chrome).")


def rendre(nav, svg, sortie, cote):
    with tempfile.TemporaryDirectory() as d:
        page = os.path.join(d, "p.html")
        with open(page, "w", encoding="utf-8") as f:
            f.write(f'<!doctype html><html><body style="margin:0;background:transparent">'
                    f'<div style="width:{cote}px;height:{cote}px">{svg.replace("<svg ", "<svg width=\"100%\" height=\"100%\" ", 1)}</div></body></html>')
        args = ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000",
                f"--window-size={cote},{cote}", f"--screenshot={sortie}", "file:///" + page.replace("\\", "/")]
        if os.name == "nt":  # sous Windows, Edge n'écrit la capture que lancé par Start-Process
            liste = ",".join("'" + a.replace("'", "''") + "'" for a in args)
            subprocess.run(["powershell", "-NoProfile", "-Command",
                            f"Start-Process -FilePath '{nav}' -ArgumentList {liste} -Wait"], check=True, capture_output=True)
        else:
            subprocess.run([nav, *args], check=True, capture_output=True)
        if not os.path.exists(sortie):
            sys.exit(f"Rendu impossible : {sortie}")


def main():
    nav = navigateur()
    for source, sortie, cote, plein in RENDUS:
        svg = open(os.path.join(PUBLIC, source), encoding="utf-8").read()
        if plein:  # iOS arrondit lui-même : un carré plein, sans transparence
            interieur = svg.split(">", 1)[1].rsplit("</svg>", 1)[0].replace('<rect width="64" height="64" rx="15" fill="#127a4a"/>', "")
            svg = SVG_CARRE.format(interieur)
        rendre(nav, svg, os.path.join(PUBLIC, sortie), cote)
        print("écrit", sortie)
    # favicon.ico : un conteneur ICO qui embarque le PNG de 32 px (accepté par tous les navigateurs)
    png = open(os.path.join(PUBLIC, "favicon-32.png"), "rb").read()
    with open(os.path.join(PUBLIC, "favicon.ico"), "wb") as f:
        f.write(struct.pack("<HHH", 0, 1, 1) + struct.pack("<BBBBHHII", 32, 32, 0, 0, 1, 32, len(png), 22) + png)
    os.remove(os.path.join(PUBLIC, "favicon-32.png"))
    print("écrit favicon.ico")


if __name__ == "__main__":
    main()
