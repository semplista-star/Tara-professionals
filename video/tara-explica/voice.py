#!/usr/bin/env python3
"""Locución con ElevenLabs y línea de tiempo real.

Lee la clave de la variable de entorno ELEVENLABS_API_KEY (nunca en el código).
La voz es, por defecto, la misma de los agentes de voz de TARA (una por idioma);
se puede forzar otra con ELEVENLABS_VOICE_ID.

Genera cada frase por separado (con el texto anterior y el siguiente como
contexto, para que la entonación sea continua), mide su duración real y
escribe:
  out/voice_<lang>.wav        pista de voz completa, ya colocada en el tiempo
  out/timeline_<lang>.json    inicio de cada escena y de cada frase (lo usan render.py y music.py)

Uso:
  python3 voice.py voices            → lista las voces de la cuenta
  python3 voice.py es                → castellano
  python3 voice.py ca                → catalán
"""
import io
import json
import os
import subprocess
import sys
import time
import urllib.request
import wave

import numpy as np

import timeline as TL

HERE = os.path.dirname(os.path.abspath(__file__))
API = "https://api.elevenlabs.io/v1"
SR = 44100

# Agentes de voz de TARA (los mismos que usa soytara.com/chat)
AGENTS = {"es": "agent_2301m20j5c1xe45s37k8drwrhzek", "ca": "agent_5301m231a21nert8r5bd2e20nadv"}
# eleven_multilingual_v2 no incluye el catalán; eleven_v3 sí
MODELS = {"es": os.environ.get("ELEVEN_MODEL_ES", "eleven_multilingual_v2"), "ca": os.environ.get("ELEVEN_MODEL_CA", "eleven_v3")}
SETTINGS = {"stability": 0.55, "similarity_boost": 0.8, "style": 0.25, "use_speaker_boost": True, "speed": 0.95}


def key():
    k = os.environ.get("ELEVENLABS_API_KEY")
    if not k:
        sys.exit("Falta ELEVENLABS_API_KEY en el entorno.")
    return k


def call(method, path, body=None, raw=False):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None,
                                 headers={"xi-api-key": key(), "Content-Type": "application/json", "Accept": "*/*"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                data = r.read()
                return data if raw else json.loads(data)
        except urllib.error.HTTPError as e:
            msg = e.read().decode(errors="replace")
            if e.code in (429, 500, 502, 503) and attempt < 3:
                time.sleep(2 ** (attempt + 1))
                continue
            sys.exit(f"ElevenLabs {e.code} en {path}: {msg[:400]}")


def voice_for(lang):
    if os.environ.get("ELEVENLABS_VOICE_ID"):
        return os.environ["ELEVENLABS_VOICE_ID"]
    ag = call("GET", f"/convai/agents/{AGENTS[lang]}")
    vid = (((ag.get("conversation_config") or {}).get("tts") or {}).get("voice_id"))
    if not vid:
        sys.exit("No he encontrado la voz del agente; define ELEVENLABS_VOICE_ID.")
    return vid


def decode(mp3):
    p = subprocess.run(["ffmpeg", "-loglevel", "error", "-i", "pipe:0", "-f", "s16le", "-ac", "1", "-ar", str(SR), "pipe:1"],
                       input=mp3, capture_output=True, check=True)
    return np.frombuffer(p.stdout, "<i2").astype(np.float32) / 32768


def trim(x, thr=0.01):
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(0.03 * SR)), min(len(x), idx[-1] + int(0.08 * SR))
    return x[a:b]


def tts(text, lang, vid, prev, nxt):
    body = {"text": text, "model_id": MODELS[lang], "voice_settings": SETTINGS}
    if MODELS[lang] != "eleven_v3":
        body["previous_text"] = prev
        body["next_text"] = nxt
    if MODELS[lang] == "eleven_v3":
        body["language_code"] = lang
    mp3 = call("POST", f"/text-to-speech/{vid}?output_format=mp3_44100_128", body, raw=True)
    return trim(decode(mp3))


def build(lang):
    sc = TL.load_script()["scenes"]
    vid = voice_for(lang)
    cache = os.path.join(HERE, "out", f"voice_cache_{lang}")
    os.makedirs(cache, exist_ok=True)
    flat = [x for s in sc for x in s[lang]]
    clips, k = [], 0
    for s in sc:
        cs = []
        for text in s[lang]:
            f = os.path.join(cache, f"{k:03d}.npy")
            if os.path.exists(f):
                a = np.load(f)
            else:
                a = tts(text, lang, vid, " ".join(flat[max(0, k - 2):k]), " ".join(flat[k + 1:k + 2]))
                np.save(f, a)
                print(f"  {k + 1}/{len(flat)} · {len(a) / SR:4.1f}s · {text[:60]}", flush=True)
            cs.append(a)
            k += 1
        clips.append(cs)

    t = TL.INTRO
    scenes, segs = [], []
    for s, cs in zip(sc, clips):
        start = t
        cur = start + TL.LEAD
        lines = []
        for text, a in zip(s[lang], cs):
            d = len(a) / SR
            lines.append({"t0": round(cur - start, 3), "t1": round(cur - start + d, 3), "text": text})
            segs.append((cur, a))
            cur += d + TL.GAP
        dur = (cur - TL.GAP) - start + TL.TAIL
        scenes.append({"id": s["id"], "start": round(start, 3), "dur": round(dur, 3), "lines": lines})
        t = start + dur
    total = round(t + TL.OUTRO, 3)
    track = np.zeros(int(total * SR) + SR, np.float32)
    for t0, a in segs:
        i = int(t0 * SR)
        track[i:i + len(a)] += a
    track = track[: int(total * SR)]
    track /= max(1e-6, np.abs(track).max() / 0.89)
    with wave.open(os.path.join(HERE, "out", f"voice_{lang}.wav"), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes((track * 32767).astype("<i2").tobytes())
    tl = {"lang": lang, "estimated": False, "voice_id": vid, "model": MODELS[lang], "scenes": scenes, "total": total}
    with open(os.path.join(HERE, "out", f"timeline_{lang}.json"), "w", encoding="utf-8") as f:
        json.dump(tl, f, ensure_ascii=False, indent=1)
    print("ok", lang, "·", total, "s")


if __name__ == "__main__":
    arg = sys.argv[1] if len(sys.argv) > 1 else "es"
    if arg == "voices":
        for v in call("GET", "/voices")["voices"]:
            print(v["voice_id"], "·", v["name"], "·", (v.get("labels") or {}).get("accent", ""))
    else:
        build(arg)
