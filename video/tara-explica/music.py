#!/usr/bin/env python3
"""Banda sonora del vídeo explicativo (~5 min). Síntesis pura, sin samples.

Piano suave + pads cálidos + bajo, 72 BPM, en Re mayor. La armonía sigue el
arco emocional de cada escena (tomado de la línea de tiempo): mañana tranquila
con algo de inquietud, apertura luminosa en «qué es TARA», recogimiento en
«protección», y un final abierto y cálido.

Uso: python3 music.py es   → out/music_es.wav
"""
import os
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

import timeline as TL

HERE = os.path.dirname(os.path.abspath(__file__))
SR = 44100
BPM = 72
BEAT = 60 / BPM
BAR = 4 * BEAT
RNG = np.random.default_rng(2027)


def mtof(m):
    return 440.0 * 2 ** ((m - 69) / 12)


# acordes (notas MIDI) — Re mayor
CH = {
    "D": [50, 57, 62, 66, 69], "Bm": [47, 54, 59, 62, 66], "G": [43, 50, 55, 59, 62], "A": [45, 52, 57, 61, 64],
    "Em": [40, 47, 52, 55, 59], "F#m": [42, 49, 54, 57, 61], "Gmaj7": [43, 50, 54, 59, 62], "Asus": [45, 52, 57, 62, 64],
    "Dadd9": [50, 57, 62, 64, 66], "Bm7": [47, 54, 57, 62, 66],
}
PROG = {
    "intro": ["Dadd9", "Gmaj7"],
    "manana": ["D", "Bm", "Gmaj7", "Asus"],
    "reto": ["Bm", "G", "Em", "Asus"],
    "que_es": ["D", "A", "Bm", "G"],
    "demo": ["Gmaj7", "D", "Asus", "Bm7"],
    "comunidad": ["D", "Bm", "G", "A"],
    "niveles": ["G", "A", "Bm", "D"],
    "proteccion": ["Bm", "G", "Em", "F#m"],
    "pilotaje": ["D", "A", "G", "A"],
    "cierre": ["Gmaj7", "A", "Dadd9", "Dadd9"],
}
# intensidad por escena (0..1): cuánta textura se añade
ENERGY = {"intro": 0.3, "manana": 0.35, "reto": 0.45, "que_es": 0.6, "demo": 0.5, "comunidad": 0.6,
          "niveles": 0.65, "proteccion": 0.4, "pilotaje": 0.75, "cierre": 0.55}


def piano(f, dur, vel):
    t = np.arange(int(dur * SR)) / SR
    env = np.exp(-t * (2.2 + f / 900)) * (1 - np.exp(-t * 300))
    s = np.zeros_like(t)
    for k, a in enumerate([1.0, 0.42, 0.22, 0.12, 0.06]):
        s += a * np.sin(2 * np.pi * f * (k + 1) * t * (1 + 0.0004 * k * k)) * np.exp(-t * k * 0.9)
    return s * env * vel


def pad(freqs, dur):
    t = np.arange(int(dur * SR)) / SR
    s = np.zeros((2, len(t)))
    for i, f in enumerate(freqs):
        for d, side in ((-0.12, 0), (0.12, 1)):
            ph = RNG.uniform(0, 2 * np.pi)
            ff = f * 2 ** (d / 12)
            w = np.sin(2 * np.pi * ff * t + ph) + 0.25 * np.sin(2 * np.pi * 2 * ff * t + ph) + 0.1 * np.sin(2 * np.pi * 3 * ff * t)
            s[side] += w
    att = np.minimum(1, t / 1.6)
    rel = np.minimum(1, (dur - t) / 1.6).clip(0)
    return s * att * rel / (len(freqs) * 2)


def lowpass(x, fc):
    sos = butter(2, fc / (SR / 2), "low", output="sos")
    return sosfilt(sos, x, axis=-1)


def reverb_ir(sec=3.2):
    n = int(sec * SR)
    t = np.arange(n) / SR
    ir = RNG.normal(0, 1, (2, n)) * np.exp(-t * 2.3)
    ir = lowpass(ir, 5000)
    ir[:, : int(0.02 * SR)] *= np.linspace(0, 1, int(0.02 * SR))
    return ir / np.abs(ir).sum(axis=1, keepdims=True) * 18


def build(lang):
    tl = TL.load(lang)
    total = tl["total"]
    N = int(total * SR) + SR
    dry = np.zeros((2, N))
    # secciones: intro + escenas
    secs = [("intro", 0.0, tl["scenes"][0]["start"])] + [(s["id"], s["start"], s["start"] + s["dur"]) for s in tl["scenes"]]
    secs[-1] = (secs[-1][0], secs[-1][1], total)
    t = 0.0
    bar_i = 0
    while t < total - 0.5:
        sec = next((s for s in secs if s[1] <= t < s[2]), secs[-1])
        name = sec[0]
        prog = PROG[name]
        chord = CH[prog[bar_i % len(prog)]]
        en = ENERGY[name]
        # fundido final
        fin = np.clip((total - t) / 6.0, 0, 1)
        start_gain = np.clip(t / 3.0, 0.2, 1)
        g = fin * start_gain
        i0 = int(t * SR)
        # pad
        p = pad([mtof(n) for n in chord[1:4]], BAR + 1.8) * (0.16 + 0.08 * en) * g
        seg = dry[:, i0:i0 + p.shape[1]]
        seg += p[:, : seg.shape[1]]
        # bajo
        b = piano(mtof(chord[0] - 12), BAR, 0.32 * g) + 0.5 * np.sin(2 * np.pi * mtof(chord[0] - 12) * np.arange(int(BAR * SR)) / SR) * np.exp(-np.arange(int(BAR * SR)) / SR * 0.8) * 0.18 * g
        seg = dry[:, i0:i0 + len(b)]
        seg += b[: seg.shape[1]] * 0.8
        # arpegio de piano (corcheas), más denso con más energía
        notes = chord[1:] + [chord[2] + 12]
        steps = 8
        for k in range(steps):
            if RNG.random() > 0.45 + 0.5 * en and k % 2 == 1:
                continue
            n = notes[[0, 2, 1, 3, 2, 4, 3, 1][k] % len(notes)] + 12
            if name in ("que_es", "pilotaje", "cierre") and k in (0, 4):
                n += 12 if RNG.random() < 0.3 else 0
            v = (0.11 + 0.05 * en) * (1.0 if k % 4 == 0 else 0.7) * RNG.uniform(0.85, 1.1) * g
            nt = t + k * BEAT / 2 + RNG.normal(0, 0.006)
            s = piano(mtof(n), 2.6, v)
            j0 = int(nt * SR)
            pan = RNG.uniform(-0.4, 0.4)
            seg = dry[:, j0:j0 + len(s)]
            L = len(seg[0])
            seg[0] += s[:L] * np.cos((pan + 1) * np.pi / 4) * np.sqrt(2)
            seg[1] += s[:L] * np.sin((pan + 1) * np.pi / 4) * np.sqrt(2)
        # melodía ocasional en las escenas luminosas
        if name in ("que_es", "comunidad", "pilotaje", "cierre") and bar_i % 2 == 0:
            mel = [chord[4] + 12, chord[3] + 12, chord[2] + 12]
            for k, n in enumerate(mel):
                s = piano(mtof(n), 3.0, 0.08 * g)
                j0 = int((t + k * BEAT * 1.5) * SR)
                seg = dry[:, j0:j0 + len(s)]
                seg += s[: seg.shape[1]]
        t += BAR
        bar_i += 1
    dry = lowpass(dry, 9000)
    ir = reverb_ir()
    wet = np.vstack([fftconvolve(dry[c], ir[c])[:N] for c in range(2)])
    mixd = dry * 0.75 + wet * 0.55
    mixd = mixd[:, : int(total * SR)]
    mixd /= np.sqrt(np.mean(mixd ** 2)) / 0.11      # nivel medio
    mixd = np.tanh(mixd * 1.6) / 1.6                  # limitador suave
    out = os.path.join(HERE, "out", f"music_{lang}.wav")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    pcm = (np.clip(mixd.T, -1, 1) * 32767).astype("<i2")
    with wave.open(out, "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(pcm.tobytes())
    print("ok", out, round(total, 1), "s")


if __name__ == "__main__":
    build(sys.argv[1] if len(sys.argv) > 1 else "es")
