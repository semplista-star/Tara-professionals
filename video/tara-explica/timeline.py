"""Línea de tiempo del vídeo: cuándo empieza cada escena y cada frase.

Si existe out/timeline_<lang>.json (lo escribe voice.py con los tiempos reales
de la voz de ElevenLabs), se usa ese. Si no, se estima a partir del texto para
poder renderizar un borrador sin voz con los subtítulos en su sitio.
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
INTRO = 4.5      # apertura con el logotipo, antes de la primera frase
OUTRO = 9.0      # cartel final después de la última frase
LEAD = 1.6       # aire al empezar cada escena (la imagen entra antes que la voz)
TAIL = 1.3       # aire al acabar cada escena
GAP = 0.8        # pausa entre frases
CPS = 14.5       # caracteres por segundo de la locución (estimación)


def load_script():
    with open(os.path.join(HERE, "script.json"), encoding="utf-8") as f:
        return json.load(f)


def estimate(lang):
    sc = load_script()["scenes"]
    t = INTRO
    out = []
    for s in sc:
        start = t
        cur = start + LEAD
        lines = []
        for text in s[lang]:
            d = len(text) / CPS
            lines.append({"t0": round(cur - start, 3), "t1": round(cur - start + d, 3), "text": text})
            cur += d + GAP
        dur = (cur - GAP) - start + TAIL
        out.append({"id": s["id"], "start": round(start, 3), "dur": round(dur, 3), "lines": lines})
        t = start + dur
    return {"lang": lang, "estimated": True, "scenes": out, "total": round(t + OUTRO, 3)}


def load(lang):
    p = os.path.join(HERE, "out", f"timeline_{lang}.json")
    if os.path.exists(p):
        with open(p, encoding="utf-8") as f:
            return json.load(f)
    return estimate(lang)


if __name__ == "__main__":
    import sys
    tl = load(sys.argv[1] if len(sys.argv) > 1 else "es")
    for s in tl["scenes"]:
        print(f'{s["id"]:<11} {s["start"]:7.1f}s  +{s["dur"]:5.1f}s  ({len(s["lines"])} frases)')
    print("total", tl["total"], "s", "(estimado)" if tl.get("estimated") else "(voz real)")
