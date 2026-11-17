import json, sys
sys.stdout.reconfigure(encoding="utf-8")

# PRECIOS DE EJEMPLO: cámbialos por los reales
PRECIOS = {"Lápidas": 3500, "Escaleras": 1800, "Comedores": 9500,
           "Altares": 4000, "Mesas": 3000, "Floreros": 800, "Lavabos": 2200}

txt = open("catalogo.js", encoding="utf-8").read()
cab = txt[:txt.index("const trabajos")]
datos = json.loads(txt[txt.index("["):txt.rindex("]") + 1])
for t in datos:
    if "precio" not in t and t["categoria"] in PRECIOS:
        t["precio"] = PRECIOS[t["categoria"]]
open("catalogo.js", "w", encoding="utf-8").write(cab + "const trabajos = " + json.dumps(datos, ensure_ascii=False, indent=2) + ";\n")
print("Listo")