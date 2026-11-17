#!/usr/bin/env python3
"""Agrega al catálogo las fotos nuevas de img/<categoria>/ con un ID aleatorio.
Uso: copia la foto a su carpeta (img/lapidas/, img/mesas/...) y corre:  python agregar.py"""
import json, os, re, secrets, sys
sys.stdout.reconfigure(encoding="utf-8")
BASE = os.path.dirname(os.path.abspath(__file__))
CAT = os.path.join(BASE, "catalogo.js")
EXT = (".jpg", ".jpeg", ".png", ".webp")
ALFA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
txt = open(CAT, encoding="utf-8").read()
cab = txt[:txt.index("const trabajos")]
datos = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
carpeta_cat = {os.path.basename(os.path.dirname(t["imagen"])): t["categoria"] for t in datos}
ids = {t["id"] for t in datos}; rutas = {t["imagen"] for t in datos}
nuevos = 0
for car in sorted(os.listdir(os.path.join(BASE, "img"))):
    ruta_car = os.path.join(BASE, "img", car)
    if not os.path.isdir(ruta_car): continue
    cat = carpeta_cat.get(car, car.capitalize())
    for f in sorted(os.listdir(ruta_car)):
        rel = f"img/{car}/{f}"
        if not f.lower().endswith(EXT) or rel in rutas: continue
        while True:
            nid = "SM-" + "".join(secrets.choice(ALFA) for _ in range(5))
            if nid not in ids: break
        ids.add(nid)
        n = sum(1 for t in datos if t["categoria"] == cat) + 1
        datos.append({"id": nid, "nombre": f"{cat} {n:02d}", "categoria": cat, "imagen": rel})
        print(f"+ {nid}  {cat} {n:02d}  ({rel})"); nuevos += 1
open(CAT, "w", encoding="utf-8").write(cab + "const trabajos = " + json.dumps(datos, ensure_ascii=False, indent=2) + ";\n")
print(f"Listo: {nuevos} diseño(s) nuevo(s)." if nuevos else "No hay fotos nuevas.")
