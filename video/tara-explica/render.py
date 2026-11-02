#!/usr/bin/env python3
"""TARA · vídeo explicativo (~5 min) · 1920x1080 · 30 fps.

Todo se dibuja con código (pycairo): personajes, aula, escuela, casa, demos y
tipografía, en la paleta de la marca. Las fotos del equipo y la captura real de
la web son los únicos recursos externos (assets/).

Uso:
  python3 render.py stills es 10,40,120      → fotogramas sueltos en out/stills
  python3 render.py video es                 → out/video_es_noaudio.mp4
  python3 render.py video ca --fps 30
"""
import json
import math
import os
import subprocess
import sys

import cairo
import numpy as np

import timeline as TL

HERE = os.path.dirname(os.path.abspath(__file__))
W, H = 1920, 1080
CX, CY = W / 2, H / 2
FPS = 30
LANG = "es"
TLD = None   # línea de tiempo cargada


# ================================================================== color
def hexc(h, a=1.0):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255, int(h[2:4], 16) / 255, int(h[4:6], 16) / 255, a)


ARENA, ARENA2, DUNA, FIBRA = hexc("F6F3EC"), hexc("EFE9DB"), hexc("E8E0CE"), hexc("DDD3BC")
TINTA, MUSGO, LIQUEN = hexc("1C2621"), hexc("52584F"), hexc("8A8B80")
TERRA, TERRA_D, TERRA_L = hexc("C1652E"), hexc("A9541F"), hexc("E0A27A")
SAGE, SAGE_D, OCHRE, SKY, PEACH = hexc("9FB09A"), hexc("6F8570"), hexc("D9A441"), hexc("A9C1CC"), hexc("F3D2B8")
WHITE = hexc("FFFFFF")
SKIN = [hexc("F1C9A8"), hexc("E2AE8A"), hexc("C68B67"), hexc("8D5A3F"), hexc("F4D3BC")]
HAIR = {"dark": hexc("2B211C"), "brown": hexc("6B4423"), "auburn": hexc("9A4A26"), "blond": hexc("D6B07A"), "grey": hexc("B9B4AA"), "black": hexc("161312")}


def mix(a, b, k):
    k = clamp(k)
    return tuple(a[i] + (b[i] - a[i]) * k for i in range(4))


def src(ctx, c, alpha=1.0):
    ctx.set_source_rgba(c[0], c[1], c[2], c[3] * alpha)


# ================================================================== easing
def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def prog(t, t0, t1):
    if t1 <= t0:
        return 1.0 if t >= t1 else 0.0
    return clamp((t - t0) / (t1 - t0))


def lerp(a, b, k):
    return a + (b - a) * k


def e_out(x):          # cúbica de salida
    x = clamp(x)
    return 1 - (1 - x) ** 3


def e_io(x):
    x = clamp(x)
    return 4 * x ** 3 if x < 0.5 else 1 - (-2 * x + 2) ** 3 / 2


def e_out_back(x, s=1.4):
    x = clamp(x)
    return 1 + (s + 1) * (x - 1) ** 3 + s * (x - 1) ** 2


def fade(t, t0, d=0.6):
    return e_out(prog(t, t0, t0 + d))


def win(t, t0, t1, fi=0.5, fo=0.5):
    """1 dentro de [t0, t1], con entrada y salida suaves."""
    return min(e_out(prog(t, t0, t0 + fi)), 1 - e_io(prog(t, t1 - fo, t1)))


# ================================================================== fuentes y texto
FO = cairo.FontOptions()
FO.set_antialias(cairo.ANTIALIAS_GRAY)
FO.set_hint_style(cairo.HINT_STYLE_NONE)
FO.set_hint_metrics(cairo.HINT_METRICS_OFF)
SERIF, SERIF_SB, SANS, SANSM, SANSB, MONO = "Fraunces Medium", "Fraunces SemiBold", "DM Sans", "DM Sans Medium", "DM Sans", "DM Mono"


def font(ctx, fam, size, italic=False, bold=False):
    ctx.select_font_face(fam, cairo.FONT_SLANT_ITALIC if italic else cairo.FONT_SLANT_NORMAL,
                         cairo.FONT_WEIGHT_BOLD if bold else cairo.FONT_WEIGHT_NORMAL)
    ctx.set_font_size(size)
    ctx.set_font_options(FO)


def tw(ctx, s, tracking=0.0):
    if not tracking:
        return ctx.text_extents(s).x_advance
    return sum(ctx.text_extents(c).x_advance for c in s) + tracking * (len(s) - 1)


def text(ctx, s, x, y, color, alpha=1.0, align="left", tracking=0.0):
    w = tw(ctx, s, tracking)
    if align == "center":
        x -= w / 2
    elif align == "right":
        x -= w
    src(ctx, color, alpha)
    if not tracking:
        ctx.move_to(x, y)
        ctx.show_text(s)
    else:
        for c in s:
            ctx.move_to(x, y)
            ctx.show_text(c)
            x += ctx.text_extents(c).x_advance + tracking
    ctx.new_path()
    return w


def wrap(ctx, s, maxw):
    lines, cur = [], ""
    for word in s.split(" "):
        test = (cur + " " + word).strip()
        if tw(ctx, test) > maxw and cur:
            lines.append(cur)
            cur = word
        else:
            cur = test
    lines.append(cur)
    return lines


def label(ctx, s, x, y, color=MUSGO, alpha=1.0, size=20, align="left"):
    """Etiqueta en mayúsculas, DM Mono con interletraje (como los eyebrows de la web)."""
    font(ctx, MONO, size)
    return text(ctx, s.upper(), x, y, color, alpha, align, tracking=size * 0.16)


def headline(ctx, lines, x, y, size, t0, t, color=TINTA, accent=None, align="left", lh=1.08, fam=SERIF, stagger=0.09):
    """Titular que sube palabra a palabra. lines: lista de str; las palabras entre *asteriscos* van en terracota cursiva."""
    yy = y
    k = 0
    for ln in lines:
        words = ln.split(" ")
        font(ctx, fam, size)
        widths = []
        for w_ in words:
            it = w_.startswith("*")
            font(ctx, fam, size, italic=it)
            widths.append(tw(ctx, w_.strip("*")))
        space = size * 0.26
        total = sum(widths) + space * (len(words) - 1)
        xx = x - total / 2 if align == "center" else x - total if align == "right" else x
        for w_, wd in zip(words, widths):
            it = w_.startswith("*")
            p = e_out(prog(t, t0 + k * stagger, t0 + k * stagger + 0.7))
            if p > 0:
                font(ctx, fam, size, italic=it)
                ctx.save()
                ctx.rectangle(xx - 10, yy - size * 1.05, wd + 30, size * 1.4)
                ctx.clip()
                text(ctx, w_.strip("*"), xx, yy + (1 - p) * size * 0.9, (accent or TERRA) if it else color, p)
                ctx.restore()
            xx += wd + space
            k += 1
        yy += size * lh
    return yy


def para(ctx, s, x, y, maxw, size, color=MUSGO, alpha=1.0, lh=1.45, fam=SANS, align="left"):
    font(ctx, fam, size)
    yy = y
    for ln in wrap(ctx, s, maxw):
        text(ctx, ln, x, yy, color, alpha, align)
        yy += size * lh
    return yy


# ================================================================== geometría
def rrect(ctx, x, y, w, h, r):
    r = max(0, min(r, w / 2, h / 2))
    ctx.new_sub_path()
    ctx.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    ctx.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    ctx.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    ctx.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    ctx.close_path()


def circle(ctx, x, y, r, col, a=1.0):
    ctx.arc(x, y, r, 0, 2 * math.pi)
    src(ctx, col, a)
    ctx.fill()


def fill_rr(ctx, x, y, w, h, r, col, a=1.0):
    rrect(ctx, x, y, w, h, r)
    src(ctx, col, a)
    ctx.fill()


def stroke_rr(ctx, x, y, w, h, r, col, lw=2, a=1.0):
    rrect(ctx, x, y, w, h, r)
    src(ctx, col, a)
    ctx.set_line_width(lw)
    ctx.stroke()


def line(ctx, pts, col, lw=3, a=1.0, cap=cairo.LINE_CAP_ROUND):
    ctx.move_to(*pts[0])
    for p in pts[1:]:
        ctx.line_to(*p)
    src(ctx, col, a)
    ctx.set_line_width(lw)
    ctx.set_line_cap(cap)
    ctx.set_line_join(cairo.LINE_JOIN_ROUND)
    ctx.stroke()


def thread(ctx, pts, col, lw, p, a=1.0):
    """Hilo curvo (Catmull-Rom) que se dibuja hasta la fracción p."""
    if p <= 0:
        return
    n = 24
    dense = []
    P = [pts[0]] + pts + [pts[-1]]
    for i in range(1, len(P) - 2):
        p0, p1, p2, p3 = P[i - 1], P[i], P[i + 1], P[i + 2]
        for j in range(n):
            u = j / n
            u2, u3 = u * u, u * u * u
            x = 0.5 * ((2 * p1[0]) + (-p0[0] + p2[0]) * u + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * u2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * u3)
            y = 0.5 * ((2 * p1[1]) + (-p0[1] + p2[1]) * u + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * u2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * u3)
            dense.append((x, y))
    dense.append(pts[-1])
    m = max(2, int(len(dense) * clamp(p)))
    line(ctx, dense[:m], col, lw, a)
    return dense[m - 1]


def pill(ctx, s, x, y, size, bg, fg, a=1.0, pad=None, align="left", fam=SANSM, bd=None):
    font(ctx, fam, size)
    w = tw(ctx, s)
    pad = pad or size * 0.85
    h = size * 2.0
    if align == "center":
        x -= (w + 2 * pad) / 2
    fill_rr(ctx, x, y - h / 2, w + 2 * pad, h, h / 2, bg, a)
    if bd:
        stroke_rr(ctx, x, y - h / 2, w + 2 * pad, h, h / 2, bd, 1.5, a)
    text(ctx, s, x + pad, y + size * 0.36, fg, a)
    return w + 2 * pad


def bg_fill(ctx, col):
    src(ctx, col)
    ctx.paint()


def vgrad(ctx, x, y, w, h, c0, c1):
    g = cairo.LinearGradient(0, y, 0, y + h)
    g.add_color_stop_rgba(0, *c0)
    g.add_color_stop_rgba(1, *c1)
    ctx.rectangle(x, y, w, h)
    ctx.set_source(g)
    ctx.fill()


def ripples(ctx, x, y, t, rmax, col=FIBRA, n=5, period=10.0, a=1.0):
    for i in range(n):
        k = ((t / period) + i / n) % 1.0
        r = rmax * (0.15 + 1.2 * k)
        al = (1 - k) * min(1, k * 6)
        ctx.arc(x, y, r, 0, 2 * math.pi)
        src(ctx, col, al * a)
        ctx.set_line_width(1.6)
        ctx.stroke()


# ================================================================== personajes
LOOK = {
    "laura": dict(skin=SKIN[1], hair="bob", hairc=HAIR["brown"], top=TERRA, bottom=TINTA, shoe=TINTA),
    "marta": dict(skin=SKIN[2], hair="bun", hairc=HAIR["dark"], top=SAGE_D, bottom=hexc("3E4A44"), shoe=TINTA),
    "hija": dict(skin=SKIN[2], hair="ponytail", hairc=HAIR["dark"], top=OCHRE, bottom=hexc("4A5D78"), shoe=WHITE),
    "padre": dict(skin=SKIN[0], hair="short", hairc=HAIR["auburn"], top=SKY, bottom=TINTA, shoe=TINTA),
    "colega": dict(skin=SKIN[3], hair="curly", hairc=HAIR["black"], top=SAGE, bottom=hexc("4A5D78"), shoe=TINTA),
}


def _limb(ctx, a, b, c, col, lw):
    line(ctx, [a, b, c], col, lw)


def face(ctx, hx, hy, r, t, mood="neutral", look=0.0, blink_seed=0.0):
    ex = r * 0.34
    ey = hy - r * 0.02
    bl = ((t + blink_seed) % 4.3) < 0.13
    lx = look * r * 0.12
    for s in (-1, 1):
        if bl:
            line(ctx, [(hx + s * ex - r * 0.08 + lx, ey), (hx + s * ex + r * 0.08 + lx, ey)], TINTA, r * 0.06)
        else:
            circle(ctx, hx + s * ex + lx, ey, r * 0.075, TINTA)
    # cejas
    if mood == "worry":
        for s in (-1, 1):
            line(ctx, [(hx + s * (ex - r * 0.14) + lx, ey - r * 0.3), (hx + s * (ex + r * 0.13) + lx, ey - r * 0.22)], TINTA, r * 0.055, 0.8)
    elif mood == "think":
        line(ctx, [(hx - ex - r * 0.12 + lx, ey - r * 0.25), (hx - ex + r * 0.12 + lx, ey - r * 0.28)], TINTA, r * 0.05, 0.75)
        line(ctx, [(hx + ex - r * 0.12 + lx, ey - r * 0.3), (hx + ex + r * 0.12 + lx, ey - r * 0.24)], TINTA, r * 0.05, 0.75)
    # boca
    my = hy + r * 0.38
    if mood in ("smile", "happy"):
        ctx.arc(hx + lx * 0.6, my - r * 0.1, r * (0.22 if mood == "happy" else 0.17), math.radians(25), math.radians(155))
        src(ctx, TINTA)
        ctx.set_line_width(r * 0.06)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        ctx.stroke()
    elif mood == "worry":
        ctx.arc(hx + lx * 0.6, my + r * 0.08, r * 0.13, math.radians(205), math.radians(335))
        src(ctx, TINTA)
        ctx.set_line_width(r * 0.055)
        ctx.stroke()
    else:
        line(ctx, [(hx - r * 0.1 + lx * 0.6, my), (hx + r * 0.1 + lx * 0.6, my)], TINTA, r * 0.055)
    # rubor
    for s in (-1, 1):
        circle(ctx, hx + s * r * 0.55 + lx, hy + r * 0.2, r * 0.13, TERRA, 0.16)


def hair_back(ctx, style, hx, hy, r, col):
    if style == "long":
        fill_rr(ctx, hx - r * 1.08, hy - r * 0.4, r * 2.16, r * 2.3, r * 0.9, col)
    elif style == "bob":
        fill_rr(ctx, hx - r * 1.12, hy - r * 0.6, r * 2.24, r * 1.6, r * 0.7, col)
    elif style == "ponytail":
        ctx.save()
        ctx.translate(hx + r * 0.95, hy - r * 0.25)
        ctx.rotate(0.5)
        fill_rr(ctx, -r * 0.28, 0, r * 0.56, r * 1.5, r * 0.28, col)
        ctx.restore()


def hair_front(ctx, style, hx, hy, r, col):
    if style in ("bob", "long", "short", "ponytail", "bun"):
        ctx.save()
        ctx.arc(hx, hy, r * 1.06, math.pi * 1.0, math.pi * 2.0)
        ctx.curve_to(hx + r * 1.06, hy - r * 0.1, hx + r * 0.4, hy - r * 0.45, hx - r * 0.1, hy - r * 0.42)
        ctx.curve_to(hx - r * 0.6, hy - r * 0.4, hx - r * 1.0, hy - r * 0.15, hx - r * 1.06, hy)
        ctx.close_path()
        src(ctx, col)
        ctx.fill()
        ctx.restore()
    if style == "bun":
        circle(ctx, hx + r * 0.15, hy - r * 1.18, r * 0.42, col)
    if style == "curly":
        for i in range(9):
            a = math.pi * (1.0 + i / 8)
            circle(ctx, hx + math.cos(a) * r * 0.95, hy + math.sin(a) * r * 0.9 - r * 0.05, r * 0.38, col)
    if style == "short":
        pass


def person(ctx, x, y, h, look, t=0.0, mood="neutral", walk=None, arms=("down", "down"), sit=False,
           facing=0.0, seed=0.0, prop=None, head_tilt=0.0):
    """Figura plana de frente. x = centro, y = suelo, h = altura total.
    walk: fase de paso (None = quieta). arms: 'down' | 'front' | 'up' | 'phone' | 'type' | 'cup' | 'hip'."""
    L = LOOK[look] if isinstance(look, str) else look
    r = h * 0.085
    br = math.sin((t + seed) * 1.6) * h * 0.004       # respiración
    if sit:
        hip_y = y - h * 0.30
    else:
        hip_y = y - h * 0.47
    sh_y = hip_y - h * 0.30 + br
    head_y = sh_y - r * 1.25
    hx = x + facing * r * 0.25
    sw = h * 0.29
    lw_arm = h * 0.068
    lw_leg = h * 0.085

    ctx.save()
    hair_back(ctx, L["hair"], hx, head_y, r, L["hairc"])

    # piernas
    ph = math.sin(walk) if walk is not None else 0.0
    if sit:
        for s in (-1, 1):
            kx = x + s * h * 0.06
            line(ctx, [(kx, hip_y + lw_leg * 0.2), (kx + s * h * 0.01, y - lw_leg * 0.3)], L["bottom"], lw_leg)
            fill_rr(ctx, kx - lw_leg * 0.7 + s * h * 0.01, y - lw_leg * 0.55, lw_leg * 1.4, lw_leg * 0.6, lw_leg * 0.3, L["shoe"])
    else:
        for s, k in ((-1, ph), (1, -ph)):
            hxp = x + s * h * 0.05
            fx = hxp + k * h * 0.07
            lift = max(0, -k) * h * 0.02 if walk is not None else 0
            line(ctx, [(hxp, hip_y), (lerp(hxp, fx, 0.55), lerp(hip_y, y, 0.5) - lift * 0.5), (fx, y - lw_leg * 0.4 - lift)], L["bottom"], lw_leg)
            fill_rr(ctx, fx - lw_leg * 0.65, y - lw_leg * 0.75 - lift, lw_leg * 1.45, lw_leg * 0.62, lw_leg * 0.3, L["shoe"])

    # tronco
    ctx.move_to(x - sw / 2, sh_y + h * 0.01)
    ctx.curve_to(x - sw / 2 - h * 0.01, hip_y - h * 0.1, x - sw * 0.42, hip_y, x - sw * 0.4, hip_y + h * 0.03)
    ctx.line_to(x + sw * 0.4, hip_y + h * 0.03)
    ctx.curve_to(x + sw * 0.42, hip_y, x + sw / 2 + h * 0.01, hip_y - h * 0.1, x + sw / 2, sh_y + h * 0.01)
    ctx.curve_to(x + sw * 0.3, sh_y - h * 0.02, x - sw * 0.3, sh_y - h * 0.02, x - sw / 2, sh_y + h * 0.01)
    src(ctx, L["top"])
    ctx.fill()
    if sit:     # regazo: los muslos vienen hacia nosotros y tapan la cadera
        fill_rr(ctx, x - sw * 0.58, hip_y - h * 0.035, sw * 1.16, h * 0.1, h * 0.045, L["bottom"])
    # cuello y escote
    fill_rr(ctx, hx - r * 0.32, head_y + r * 0.6, r * 0.64, r * 0.9, r * 0.2, L["skin"])
    ctx.arc(hx, sh_y + h * 0.004, r * 0.42, 0, math.pi)
    src(ctx, L["skin"])
    ctx.fill()

    # brazos
    sway = math.sin(walk) * h * 0.05 if walk is not None else 0.0
    for i, s in enumerate((-1, 1)):
        a = arms[i]
        shx, shy = x + s * sw * 0.46, sh_y + h * 0.035
        if a == "down":
            el = (shx + s * h * 0.025 - s * sway * 0.3, shy + h * 0.14)
            hd = (shx + s * h * 0.03 + (sway if s < 0 else -sway), shy + h * 0.27)
        elif a == "hip":
            el = (shx + s * h * 0.1, shy + h * 0.12)
            hd = (x + s * sw * 0.38, hip_y - h * 0.02)
        elif a == "front":
            el = (shx + s * h * 0.03, shy + h * 0.15)
            hd = (x + s * h * 0.06, shy + h * 0.17)
        elif a == "type":
            el = (shx + s * h * 0.02, shy + h * 0.15)
            tap = math.sin((t + seed) * 18 + i * 2) * h * 0.006
            hd = (x + s * h * 0.09, shy + h * 0.2 + tap)
        elif a == "phone":
            el = (shx + s * h * 0.05, shy + h * 0.15)
            hd = (x + s * h * 0.05, shy + h * 0.05)
        elif a == "cup":
            el = (shx + s * h * 0.06, shy + h * 0.15)
            hd = (shx + s * h * 0.02, shy + h * 0.1)
        elif a == "up":
            wv = math.sin((t + seed) * 7) * 0.25
            el = (shx + s * h * 0.09, shy - h * 0.06)
            hd = (shx + s * h * (0.12 + wv * 0.1), shy - h * 0.2)
        elif a == "chin":
            el = (shx + s * h * 0.05, shy + h * 0.16)
            hd = (hx + s * r * 0.4, head_y + r * 1.05)
        else:
            el = (shx, shy + h * 0.14)
            hd = (shx, shy + h * 0.27)
        _limb(ctx, (shx, shy), el, hd, L["top"], lw_arm)
        circle(ctx, hd[0], hd[1], lw_arm * 0.55, L["skin"])
        if a == "phone" and i == 1:
            ctx.save()
            ctx.translate(hd[0] - s * h * 0.015, hd[1] - h * 0.035)
            fill_rr(ctx, -h * 0.022, -h * 0.03, h * 0.044, h * 0.075, h * 0.008, TINTA)
            fill_rr(ctx, -h * 0.017, -h * 0.024, h * 0.034, h * 0.058, h * 0.005, SKY, 0.9)
            ctx.restore()
        if a == "cup" and i == 1:
            cup(ctx, hd[0] + h * 0.01, hd[1] - h * 0.005, h * 0.06, t)

    # cabeza
    ctx.save()
    ctx.translate(hx, head_y)
    ctx.rotate(head_tilt)
    ctx.translate(-hx, -head_y)
    ctx.save()
    ctx.translate(hx, head_y)
    ctx.scale(1.0, 1.1)
    ctx.arc(0, 0, r, 0, 2 * math.pi)
    ctx.restore()
    src(ctx, L["skin"])
    ctx.fill()
    for s in (-1, 1):      # orejas
        circle(ctx, hx + s * r * 0.98, head_y + r * 0.08, r * 0.18, L["skin"])
    face(ctx, hx, head_y + r * 0.08, r, t, mood, facing, seed)
    hair_front(ctx, L["hair"], hx, head_y, r, L["hairc"])
    ctx.restore()
    ctx.restore()
    return (hx, head_y, r)


def back_head(ctx, x, y, s, hairc, top, t=0.0, seed=0.0):
    """Alumno visto de espaldas (cabeza y hombros), para el aula."""
    bob = math.sin((t + seed) * 1.3) * s * 0.02
    fill_rr(ctx, x - s * 0.9, y - s * 0.15 + bob, s * 1.8, s * 1.1, s * 0.5, top)
    circle(ctx, x, y - s * 0.55 + bob, s * 0.5, hairc)


# ================================================================== objetos
def cup(ctx, x, y, s, t, steam=True):
    fill_rr(ctx, x - s * 0.35, y - s * 0.5, s * 0.7, s * 0.8, s * 0.12, WHITE)
    ctx.arc(x + s * 0.38, y - s * 0.12, s * 0.17, -math.pi / 2, math.pi / 2)
    src(ctx, WHITE)
    ctx.set_line_width(s * 0.09)
    ctx.stroke()
    fill_rr(ctx, x - s * 0.35, y - s * 0.22, s * 0.7, s * 0.16, 0, TERRA, 0.8)
    if steam:
        for i in range(2):
            ph = t * 1.3 + i * 1.7
            pts = [(x + (i - 0.5) * s * 0.25 + math.sin(ph + k) * s * 0.06, y - s * 0.6 - k * s * 0.18) for k in range(5)]
            line(ctx, pts, FIBRA, s * 0.05, 0.7)


def desk(ctx, x, y, w, col=hexc("C9A77F"), leg=hexc("8C6B4C")):
    fill_rr(ctx, x, y, w, 14, 6, col)
    for lx in (x + 18, x + w - 30):
        fill_rr(ctx, lx, y + 10, 12, 120, 4, leg)


def laptop(ctx, x, y, s, glow=1.0, content=None):
    """Portátil de frente: base en y, pantalla hacia arriba. s = ancho."""
    h = s * 0.62
    fill_rr(ctx, x - s / 2, y - h, s, h, s * 0.04, TINTA)
    fill_rr(ctx, x - s / 2 + s * 0.035, y - h + s * 0.035, s - s * 0.07, h - s * 0.08, s * 0.015, mix(ARENA, WHITE, 0.4))
    if content:
        content(x - s / 2 + s * 0.035, y - h + s * 0.035, s - s * 0.07, h - s * 0.08)
    fill_rr(ctx, x - s * 0.58, y - s * 0.01, s * 1.16, s * 0.05, s * 0.02, hexc("3A4540"))


def chair(ctx, x, y, s, col=TINTA):
    fill_rr(ctx, x - s * 0.5, y - s * 1.75, s, s * 1.0, s * 0.22, col, 0.95)


def plant(ctx, x, y, s, t):
    fill_rr(ctx, x - s * 0.35, y - s * 0.6, s * 0.7, s * 0.6, s * 0.12, TERRA)
    for i, (a, l) in enumerate([(-0.9, 1.1), (-0.4, 1.4), (0.1, 1.5), (0.6, 1.2), (1.0, 0.9)]):
        a += math.sin(t * 0.8 + i) * 0.04
        ctx.save()
        ctx.translate(x, y - s * 0.6)
        ctx.rotate(a)
        ctx.scale(0.32, 1)
        ctx.arc(0, -s * l * 0.5, s * l * 0.5, 0, 2 * math.pi)
        ctx.restore()
        src(ctx, SAGE_D if i % 2 else SAGE)
        ctx.fill()


def wall_clock(ctx, x, y, r, hh, mm):
    circle(ctx, x, y, r, WHITE)
    ctx.arc(x, y, r, 0, 2 * math.pi)
    src(ctx, TINTA)
    ctx.set_line_width(r * 0.1)
    ctx.stroke()
    for i in range(12):
        a = i / 12 * 2 * math.pi
        line(ctx, [(x + math.sin(a) * r * 0.75, y - math.cos(a) * r * 0.75), (x + math.sin(a) * r * 0.85, y - math.cos(a) * r * 0.85)], TINTA, r * 0.05)
    am = mm / 60 * 2 * math.pi
    ah = (hh % 12 + mm / 60) / 12 * 2 * math.pi
    line(ctx, [(x, y), (x + math.sin(ah) * r * 0.5, y - math.cos(ah) * r * 0.5)], TINTA, r * 0.09)
    line(ctx, [(x, y), (x + math.sin(am) * r * 0.75, y - math.cos(am) * r * 0.75)], TERRA, r * 0.06)
    circle(ctx, x, y, r * 0.07, TINTA)


def tree(ctx, x, y, s, t, col=SAGE):
    fill_rr(ctx, x - s * 0.06, y - s * 0.9, s * 0.12, s * 0.9, s * 0.05, hexc("8C6B4C"))
    sw = math.sin(t * 0.7 + x) * s * 0.015
    for dx, dy, r, c in [(-0.25, -1.05, 0.38, col), (0.22, -1.1, 0.4, mix(col, SAGE_D, 0.4)), (0, -1.38, 0.42, col)]:
        circle(ctx, x + dx * s + sw, y + dy * s, r * s, c)


def cloud(ctx, x, y, s, a=1.0):
    for dx, dy, r in [(0, 0, 0.5), (0.45, 0.1, 0.38), (-0.45, 0.12, 0.35), (0.15, -0.25, 0.4)]:
        circle(ctx, x + dx * s, y + dy * s, r * s, WHITE, a)


def window(ctx, x, y, w, h, sky0, sky1, frame=WHITE):
    vgrad(ctx, x, y, w, h, sky0, sky1)
    stroke_rr(ctx, x, y, w, h, 6, frame, 10)
    line(ctx, [(x + w / 2, y), (x + w / 2, y + h)], frame, 7)
    line(ctx, [(x, y + h * 0.45), (x + w, y + h * 0.45)], frame, 7)


def whiteboard(ctx, x, y, w, h, t, p=1.0, lang="es"):
    fill_rr(ctx, x - 10, y - 10, w + 20, h + 20, 10, hexc("B9B4AA"))
    fill_rr(ctx, x, y, w, h, 6, WHITE)
    font(ctx, SERIF, 34)
    text(ctx, {"es": "Convivencia", "ca": "Convivència"}[lang], x + 40, y + 70, TINTA, fade(p, 0.0, 0.3))
    thread(ctx, [(x + 40, y + 110), (x + 180, y + 95), (x + 320, y + 130), (x + 470, y + 100)], TERRA, 4, e_out(p))
    for i in range(3):
        a = fade(p, 0.3 + i * 0.15, 0.3)
        circle(ctx, x + 60, y + 165 + i * 42, 6, TINTA, a)
        fill_rr(ctx, x + 80, y + 159 + i * 42, [220, 280, 180][i], 12, 6, FIBRA, a)


def school(ctx, x, y, w, h, t, light=1.0, clock=(8, 15), lang="es"):
    """Fachada de escuela. (x, y) = esquina inferior izquierda."""
    top = y - h
    fill_rr(ctx, x, top, w, h, 4, hexc("EADFC9"))
    fill_rr(ctx, x - 20, top - 26, w + 40, 30, 6, TERRA_D)
    # cuerpo central más alto
    cx = x + w / 2
    fill_rr(ctx, cx - 190, top - 120, 380, 130, 4, hexc("E3D5BB"))
    ctx.move_to(cx - 215, top - 118)
    ctx.line_to(cx, top - 200)
    ctx.line_to(cx + 215, top - 118)
    ctx.close_path()
    src(ctx, TERRA_D)
    ctx.fill()
    wall_clock(ctx, cx, top - 60, 42, *clock)
    # ventanas
    cols = 8
    ww, wh = (w - 120) / cols - 26, 110
    for row in range(2):
        for c in range(cols):
            wx = x + 60 + c * ((w - 120) / cols) + 13
            wy = top + 50 + row * 170
            if abs((wx + ww / 2) - cx) < 120 and row == 1:
                continue
            fill_rr(ctx, wx, wy, ww, wh, 6, mix(hexc("7E9AA6"), hexc("F4C77A"), light * (0.5 + 0.5 * ((c * 7 + row * 3) % 5 > 1))))
            stroke_rr(ctx, wx, wy, ww, wh, 6, WHITE, 6)
            line(ctx, [(wx + ww / 2, wy), (wx + ww / 2, wy + wh)], WHITE, 4)
    # puerta
    fill_rr(ctx, cx - 75, y - 230, 150, 230, 70, TINTA)
    fill_rr(ctx, cx - 62, y - 215, 124, 215, 60, mix(hexc("3A4540"), hexc("F4C77A"), 0.35 * light))
    line(ctx, [(cx, y - 215), (cx, y)], TINTA, 5)
    font(ctx, MONO, 22)
    text(ctx, {"es": "INSTITUTO", "ca": "INSTITUT"}[lang], cx, top + 24 - 120 + 105, WHITE, 0.0, "center")


def phone_ui(ctx, x, y, w, h, t, msgs, brand, status, note=None, note_a=0.0):
    """Teléfono con la conversación (como la maqueta de la web). msgs: lista de (who, text, appear_t, typing_t)."""
    fill_rr(ctx, x, y, w, h, 46, TINTA)
    fill_rr(ctx, x + 10, y + 10, w - 20, h - 20, 38, ARENA)
    # barra
    font(ctx, SERIF, 30)
    bw = text(ctx, brand, x + 40, y + 70, TINTA)
    text(ctx, "tara", x + 40 + bw, y + 70, TERRA)
    circle(ctx, x + 40 + bw + tw(ctx, "tara") + 10, y + 61, 4, TERRA)
    label(ctx, status, x + w - 36, y + 66, MUSGO, 1, 15, "right")
    line(ctx, [(x + 30, y + 96), (x + w - 30, y + 96)], FIBRA, 1.5)
    # mensajes, de abajo arriba
    yb = y + h - 140 - (60 if note else 0)
    font(ctx, SANS, 25)
    blocks = []
    for who, s, ta, ty in msgs:
        if t < ty:
            continue
        if t < ta:
            blocks.append((who, None, ta, ty))
        else:
            blocks.append((who, s, ta, ty))
    yy = yb
    for who, s, ta, ty in reversed(blocks):
        maxw = w * 0.72
        if s is None:
            bwid, bh = 110, 58
            lines = []
        else:
            lines = wrap(ctx, s, maxw - 44)
            bwid = max(tw(ctx, l_) for l_ in lines) + 44
            bh = len(lines) * 34 + 30
        p = e_out_back(prog(t, ta if s else ty, (ta if s else ty) + 0.45))
        bx = x + w - 34 - bwid if who == "me" else x + 34
        by = yy - bh
        if by < y + 110:
            break
        ctx.save()
        ctx.translate(0, (1 - p) * 30)
        col = TINTA if who == "me" else ARENA2
        fill_rr(ctx, bx, by, bwid, bh, 24, col, clamp(p * 1.5))
        if who != "me":
            stroke_rr(ctx, bx, by, bwid, bh, 24, FIBRA, 1.5, clamp(p * 1.5))
        if s is None:
            for k in range(3):
                bounce = math.sin(t * 9 - k * 0.9) * 5
                circle(ctx, bx + 32 + k * 23, by + bh / 2 + bounce, 6, MUSGO, 0.7)
        else:
            font(ctx, SANS, 25)
            for i, ln in enumerate(lines):
                text(ctx, ln, bx + 22, by + 40 + i * 34, ARENA if who == "me" else TINTA, clamp(p * 1.5))
        ctx.restore()
        yy = by - 18
    if note:
        label(ctx, note, x + w / 2, y + h - 150, TERRA_D, note_a, 15, "center")
    fill_rr(ctx, x + 30, y + h - 110, w - 60, 66, 33, WHITE)
    stroke_rr(ctx, x + 30, y + h - 110, w - 60, 66, 33, FIBRA, 1.5)
    font(ctx, SANS, 22)
    text(ctx, {"es": "Escribe aquí…", "ca": "Escriu aquí…"}[LANG], x + 60, y + h - 70, LIQUEN)
    text(ctx, "→", x + w - 70, y + h - 70, TERRA)


# ================================================================== imágenes
_IMG = {}


def img(name):
    if name not in _IMG:
        from PIL import Image
        p = os.path.join(HERE, "assets", name)
        im = Image.open(p).convert("RGBA")
        a = np.array(im)
        bgra = a[..., [2, 1, 0, 3]].copy()
        surf = cairo.ImageSurface.create_for_data(memoryview(bgra), cairo.FORMAT_ARGB32, im.width, im.height)
        _IMG[name] = (surf, bgra)
    return _IMG[name][0]


def photo_circle(ctx, name, x, y, r, a=1.0, focus=(0.5, 0.3), zoom=1.0):
    s = img(name)
    iw, ih = s.get_width(), s.get_height()
    sc = (2 * r) * zoom / min(iw, ih)
    ctx.save()
    ctx.arc(x, y, r, 0, 2 * math.pi)
    ctx.clip()
    ctx.translate(x - iw * sc * focus[0], y - ih * sc * focus[1] - r * (0.0))
    ctx.translate(0, -(ih * sc - 2 * r) * 0 if ih <= iw else 0)
    ctx.scale(sc, sc)
    # centra el recorte en el foco
    ox = clamp(iw * focus[0] - r / sc, 0, iw - 2 * r / sc)
    oy = clamp(ih * focus[1] - r / sc, 0, ih - 2 * r / sc)
    ctx.restore()
    ctx.save()
    ctx.arc(x, y, r, 0, 2 * math.pi)
    ctx.clip()
    ctx.translate(x - r, y - r)
    ctx.scale(sc, sc)
    ctx.translate(-ox, -oy)
    ctx.set_source_surface(s, 0, 0)
    ctx.get_source().set_filter(cairo.FILTER_GOOD)
    ctx.paint_with_alpha(a)
    ctx.restore()


def browser(ctx, x, y, w, h, url, shot, scroll, a=1.0):
    """Ventana de navegador con la captura real de la web, desplazada `scroll` px (de la captura)."""
    ctx.save()
    ctx.push_group()
    fill_rr(ctx, x, y, w, h, 18, WHITE)
    fill_rr(ctx, x, y, w, 56, 18, hexc("ECE7DC"))
    ctx.rectangle(x, y + 36, w, 20)
    src(ctx, hexc("ECE7DC"))
    ctx.fill()
    for i, c in enumerate([hexc("E46F5A"), hexc("E8B84A"), hexc("7FB069")]):
        circle(ctx, x + 30 + i * 24, y + 28, 7, c)
    fill_rr(ctx, x + 120, y + 12, w - 240, 32, 16, WHITE)
    font(ctx, SANS, 18)
    text(ctx, url, x + w / 2, y + 34, MUSGO, 1, "center")
    s = img(shot)
    sc = w / s.get_width()
    ctx.save()
    ctx.rectangle(x, y + 56, w, h - 56)
    ctx.clip()
    ctx.translate(x, y + 56 - scroll * sc)
    ctx.scale(sc, sc)
    ctx.set_source_surface(s, 0, 0)
    ctx.get_source().set_filter(cairo.FILTER_GOOD)
    ctx.paint()
    ctx.restore()
    stroke_rr(ctx, x, y, w, h, 18, FIBRA, 2)
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(a)
    ctx.restore()


# ================================================================== textos de pantalla por idioma
V = {
    "es": {
        "brand": "soy", "url": "soytara.com", "tuesday": "Martes · 8:15", "evening": "Martes · 18:00",
        "how": "¿Cómo empiezo?", "voc": ["Vocación", "Conocimiento", "Protocolos"], "gap": "+ tiempo, estructura y apoyo",
        "s1": "del profesorado señala la falta de recursos como barrera para intervenir ante el acoso",
        "s2": "señala la falta de formación",
        "src": "Fundación Mutua Madrileña y Fundación ANAR · VIII Informe de Acoso Escolar en Centros Educativos, curso 2025-2026",
        "eco": "Ecosistema educativo · Convivencia y cultura de paz",
        "rings": ["Comprender", "Cuidar", "Construir"], "tags": ["Formación", "Estructuras de centro", "IA conversacional"],
        "noapp": ["No es una app más.", "Ni un sistema paralelo."],
        "integra": ["Plan de convivencia", "Tutoría", "Orientación", "Protocolos"],
        "principle": ["La tecnología acompaña y facilita.", "*Las personas valoran, deciden y actúan.*"],
        "status": "Espacio del profesorado",
        "me": "Mañana me reúno con la familia de un alumno de 2.º de ESO por un conflicto en el patio. No sé cómo empezar.",
        "tara": "Antes de preparar la reunión, podemos separar lo que se ha observado de lo que se interpreta. ¿Qué ocurrió exactamente, según lo que sabes?",
        "obs": "Lo observado", "int": "Lo interpretado",
        "obs_i": ["Discusión en el patio, 10:40", "Dos alumnos, un balón", "Lo vio la monitora"],
        "int_i": ["«Siempre empieza él»", "«La familia no colabora»", "«Esto va a ir mal»"],
        "q": ["¿Qué ocurrió exactamente?", "¿Qué puede necesitar cada parte?", "¿Cómo abrir la conversación?"],
        "scaf": ["Parar", "Comprender", "Preparar la acción"], "decide": "La decisión es tuya. TARA te ayuda a pensarla.",
        "eco_n": ["Profesorado", "Orientación", "Alumnado", "Familias"],
        "prof": ["Preparar una tutoría difícil", "Conflicto en el aula", "Una pausa antes de responder"],
        "ifcenter": "Si el centro lo decide", "home": "Casa · 19:30",
        "nosub": ["TARA no sustituye al tutor, al orientador ni a la familia.", "*Les abre la puerta para que su acompañamiento llegue antes.*"],
        "lv": [("Profesionales del centro", "Red 2027"), ("Familias", "Red 2027 · si el centro lo decide"), ("Uso pedagógico colectivo", "Red 2027 · con el docente"),
               ("Trabajo guiado del alumnado", "Curso 2027-28 · secundaria"), ("Uso individual supervisado", "Curso 2027-28 · desde 14 años")],
        "lvtitle": ["Cinco niveles,", "*siempre con preparación previa.*"], "noauto": "Ningún nivel se activa de forma automática.",
        "prot": "Protección", "prottitle": ["La protección forma parte", "*del diseño educativo.*"],
        "p": [("No diagnostica ni decide.", "No evalúa a las personas ni decide sanciones."), ("Trabaja con lo que la persona expresa.", "Lo que propone es una hipótesis abierta."), ("Reconoce el límite.", "Orienta hacia las personas responsables del centro.")],
        "red": "Red de Centros Colaboradores TARA", "red_n": "hasta 20", "red_c": "centros pioneros", "pilot": "Pilotaje 2027",
        "check": ["Formación del equipo", "Materiales y sesiones prácticas", "Acompañamiento en la implementación", "Evaluación de lo que funciona"],
        "team": "Equipo", "roles": ["Arquitectura · Visión", "Estrategia · Crecimiento", "Dirección pedagógica", "Validación psicológica", "Arquitectura técnica"],
        "done": "No todo está resuelto,", "done2": "*pero la conversación ha sido posible.*",
        "final": ["Pedagogía e inteligencia artificial", "*para aprender a convivir.*"], "cta": "¿Quieres que tu centro participe en el pilotaje 2027?",
        "contact": "tara@soytara.com",
    },
    "ca": {
        "brand": "soc", "url": "soctara.com", "tuesday": "Dimarts · 8:15", "evening": "Dimarts · 18:00",
        "how": "Com començo?", "voc": ["Vocació", "Coneixement", "Protocols"], "gap": "+ temps, estructura i suport",
        "s1": "del professorat assenyala la manca de recursos com a barrera per intervenir davant l'assetjament",
        "s2": "assenyala la manca de formació",
        "src": "Fundació Mutua Madrileña i Fundació ANAR · VIII Informe de Acoso Escolar en Centros Educativos, curs 2025-2026",
        "eco": "Ecosistema educatiu · Convivència i cultura de pau",
        "rings": ["Comprendre", "Cuidar", "Construir"], "tags": ["Formació", "Estructures de centre", "IA conversacional"],
        "noapp": ["No és una app més.", "Ni un sistema paral·lel."],
        "integra": ["Pla de convivència", "Tutoria", "Orientació", "Protocols"],
        "principle": ["La tecnologia acompanya i facilita.", "*Les persones valoren, decideixen i actuen.*"],
        "status": "Espai del professorat",
        "me": "Demà em reuneixo amb la família d'un alumne de 2n d'ESO per un conflicte al pati. No sé com començar.",
        "tara": "Abans de preparar la reunió, podem separar el que s'ha observat del que s'interpreta. Què va passar exactament, segons el que saps?",
        "obs": "L'observat", "int": "L'interpretat",
        "obs_i": ["Discussió al pati, 10:40", "Dos alumnes, una pilota", "Ho va veure la monitora"],
        "int_i": ["«Sempre comença ell»", "«La família no col·labora»", "«Això anirà malament»"],
        "q": ["Què va passar exactament?", "Què pot necessitar cada part?", "Com obrir la conversa?"],
        "scaf": ["Aturar-se", "Comprendre", "Preparar l'acció"], "decide": "La decisió és teva. TARA t'ajuda a pensar-la.",
        "eco_n": ["Professorat", "Orientació", "Alumnat", "Famílies"],
        "prof": ["Preparar una tutoria difícil", "Conflicte a l'aula", "Una pausa abans de respondre"],
        "ifcenter": "Si el centre ho decideix", "home": "Casa · 19:30",
        "nosub": ["TARA no substitueix el tutor, l'orientador ni la família.", "*Els obre la porta perquè el seu acompanyament arribi abans.*"],
        "lv": [("Professionals del centre", "Xarxa 2027"), ("Famílies", "Xarxa 2027 · si el centre ho decideix"), ("Ús pedagògic col·lectiu", "Xarxa 2027 · amb el docent"),
               ("Treball guiat de l'alumnat", "Curs 2027-28 · secundària"), ("Ús individual supervisat", "Curs 2027-28 · des dels 14 anys")],
        "lvtitle": ["Cinc nivells,", "*sempre amb preparació prèvia.*"], "noauto": "Cap nivell no s'activa de manera automàtica.",
        "prot": "Protecció", "prottitle": ["La protecció forma part", "*del disseny educatiu.*"],
        "p": [("No diagnostica ni decideix.", "No avalua les persones ni decideix sancions."), ("Treballa amb el que la persona expressa.", "El que proposa és una hipòtesi oberta."), ("Reconeix el límit.", "Orienta cap a les persones responsables del centre.")],
        "red": "Xarxa de Centres Col·laboradors TARA", "red_n": "fins a 20", "red_c": "centres pioners", "pilot": "Pilotatge 2027",
        "check": ["Formació de l'equip", "Materials i sessions pràctiques", "Acompanyament en la implementació", "Avaluació del que funciona"],
        "team": "Equip", "roles": ["Arquitectura · Visió", "Estratègia · Creixement", "Direcció pedagògica", "Validació psicològica", "Arquitectura tècnica"],
        "done": "No tot està resolt,", "done2": "*però la conversa ha estat possible.*",
        "final": ["Pedagogia i intel·ligència artificial", "*per aprendre a conviure.*"], "cta": "Vols que el teu centre participi en el pilotatge 2027?",
        "contact": "tara@soytara.com",
    },
}


def T(k):
    return V[LANG][k]


def logo(ctx, x, y, size, a=1.0, align="center", dark=False):
    font(ctx, SERIF, size)
    b, tt = T("brand"), "tara"
    wb, wt = tw(ctx, b), tw(ctx, tt)
    x0 = x - (wb + wt) / 2 if align == "center" else x
    text(ctx, b, x0, y, ARENA if dark else TINTA, a)
    text(ctx, tt, x0 + wb, y, TERRA, a)
    return wb + wt


# ================================================================== escenas
# Cada escena recibe (ctx, t, D, m): t = tiempo local, D = duración, m = inicio de cada frase.

def cam(ctx, t, D, z0=1.0, z1=1.05, ox=0.0, oy=0.0):
    k = e_io(prog(t, 0, D))
    z = lerp(z0, z1, k)
    ctx.translate(CX + ox * k, CY + oy * k)
    ctx.scale(z, z)
    ctx.translate(-CX, -CY)


def sc_intro(ctx, t, D):
    bg_fill(ctx, ARENA)
    ripples(ctx, CX, CY, t, 520, FIBRA, 5, 9.0)
    p = e_out(prog(t, 0.4, 1.6))
    font(ctx, SERIF, 150)
    logo(ctx, CX, CY + 40 + (1 - p) * 40, 150, p)
    label(ctx, T("eco"), CX, CY + 130, MUSGO, fade(t, 1.3), 22, "center")
    thread(ctx, [(CX - 420, CY + 190), (CX - 140, CY + 165), (CX + 140, CY + 210), (CX + 420, CY + 185)], TERRA, 3, e_io(prog(t, 1.2, 3.2)))


def sc_manana(ctx, t, D, m):
    shot2 = m[2] - 0.6
    if t < shot2 + 0.8:
        a = 1 - e_io(prog(t, shot2, shot2 + 0.8))
        ctx.save()
        ctx.push_group()
        cam(ctx, t, shot2 + 1, 1.0, 1.06, 0, 30)
        dawn = e_io(prog(t, 0, shot2))
        vgrad(ctx, 0, 0, W, H, mix(hexc("F7D9C0"), hexc("CFE0E6"), dawn * 0.6), ARENA)
        circle(ctx, 1500, 260 - dawn * 60, 80, hexc("F4C77A"), 0.9)
        for i, (cx_, cy_, s_) in enumerate([(300, 180, 70), (900, 130, 55), (1700, 210, 60)]):
            cloud(ctx, (cx_ + t * (8 + i * 3)) % (W + 300) - 150, cy_, s_, 0.85)
        fill_rr(ctx, -50, 900, W + 100, 300, 0, hexc("D8CBB0"))
        fill_rr(ctx, -50, 880, W + 100, 30, 0, hexc("CDBF9F"))
        school(ctx, 360, 880, 1200, 420, t, light=1 - dawn * 0.4, clock=(8, 15), lang=LANG)
        tree(ctx, 220, 900, 260, t)
        tree(ctx, 1720, 900, 300, t, mix(SAGE, OCHRE, 0.2))
        # Laura camina hacia la puerta
        wk = prog(t, 0.8, shot2 - 0.5)
        lx = lerp(-80, 860, e_io(wk))
        walking = 0 < wk < 1
        person(ctx, lx, 1000, 300, "laura", t, mood="neutral", walk=(t * 6.5 if walking else None),
               arms=("down", "cup"), facing=0.6 if walking else 0, seed=1)
        for i, (sx, col) in enumerate([(1300, "padre"), (1420, "colega")]):
            person(ctx, sx - t * 18, 990 + i * 8, 250 - i * 10, col, t, mood="smile", walk=t * 6 + i, seed=i * 2)
        fill_rr(ctx, 80, 70, 330, 64, 32, ARENA, 0.92 * fade(t, 0.5))
        label(ctx, T("tuesday"), 245, 112, TINTA, fade(t, 0.5), 22, "center")
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()
    if t > shot2:
        a = e_io(prog(t, shot2, shot2 + 0.8))
        ctx.save()
        ctx.push_group()
        lt = t - shot2
        cam(ctx, lt, D - shot2, 1.02, 1.08, -40, 10)
        bg_fill(ctx, hexc("EFE6D6"))
        fill_rr(ctx, 0, 760, W, 400, 0, hexc("D9C7A8"))
        window(ctx, 1220, 170, 460, 420, hexc("F7D9C0"), hexc("CFE0E6"))
        wall_clock(ctx, 330, 230, 70, 8, 15 + lt * 0.05)
        plant(ctx, 1730, 760, 120, t)
        # Laura sentada a la mesa con el café, pensativa
        chair(ctx, 960, 900, 220, SAGE_D)
        person(ctx, 960, 900, 560, "laura", t, mood="worry" if lt < m[4] - shot2 else "think", sit=True,
               arms=("chin", "front"), facing=-0.2, seed=1, head_tilt=-0.06)
        fill_rr(ctx, 500, 770, 920, 30, 8, hexc("C9A77F"))
        fill_rr(ctx, 520, 794, 880, 200, 6, hexc("B8936A"))
        cup(ctx, 1240, 762, 70, t)
        fill_rr(ctx, 640, 734, 240, 36, 4, WHITE)
        fill_rr(ctx, 650, 704, 220, 34, 4, hexc("F0EBE0"))
        # bocadillo de pensamiento
        bp = e_out_back(prog(lt, 1.6, 2.3))
        if bp > 0:
            bx, by = 1240, 330
            for i, (dx, dy, r_) in enumerate([(-170, 140, 10), (-140, 105, 16)]):
                circle(ctx, bx + dx, by + dy, r_ * bp, WHITE)
            fill_rr(ctx, bx - 120, by - 40 - (1 - bp) * 20, 330, 100, 50, WHITE, clamp(bp))
            font(ctx, SERIF, 38)
            text(ctx, T("how"), bx + 45, by + 22, TINTA, clamp(bp), "center")
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()


def classroom(ctx, t, lt, D, tint=0.0):
    bg_fill(ctx, hexc("EFE6D6"))
    fill_rr(ctx, 0, 820, W, 300, 0, hexc("D9C7A8"))
    whiteboard(ctx, 610, 150, 700, 340, t, e_out(prog(lt, 0.3, 2.5)), LANG)
    window(ctx, 120, 170, 330, 380, hexc("CFE0E6"), hexc("F2EDE3"))
    window(ctx, 1490, 170, 330, 380, hexc("CFE0E6"), hexc("F2EDE3"))
    person(ctx, 1380, 860, 420, "laura", t, mood="smile", arms=("up" if (lt % 9) < 2.5 else "down", "front"), facing=-0.5, seed=1)
    cols = [(TERRA, HAIR["dark"]), (SAGE_D, HAIR["brown"]), (OCHRE, HAIR["blond"]), (SKY, HAIR["black"]), (hexc("4A5D78"), HAIR["auburn"])]
    for row in range(2):
        for c in range(5):
            x = 330 + c * 300 + (row * 40)
            y = 840 + row * 130
            desk(ctx, x - 120, y - 30, 240, hexc("C9A77F"))
            top, hc = cols[(c + row * 2) % 5]
            back_head(ctx, x, y - 30, 70 + row * 12, hc, top, t, seed=c + row)


def sc_reto(ctx, t, D, m):
    # Plano 1: el aula (frases 0-2) · Plano 2: las cifras (3-4) · cierre hacia TARA (5)
    s2 = m[3] - 0.5
    if t < s2 + 0.8:
        a = 1 - e_io(prog(t, s2, s2 + 0.8))
        ctx.save()
        ctx.push_group()
        cam(ctx, t, s2 + 1, 1.0, 1.05, 0, -20)
        classroom(ctx, t, t, D)
        # píldoras: vocación, conocimiento, protocolos → + tiempo, estructura y apoyo
        for i, s in enumerate(T("voc")):
            pa = fade(t, m[1] + i * 0.35, 0.5)
            if pa > 0:
                pill(ctx, s, 170 + i * 290, 700 - 40 * (1 - pa), 30, ARENA, TINTA, pa, bd=FIBRA)
        ga = e_out_back(prog(t, m[2] + 0.6, m[2] + 1.3))
        if ga > 0:
            pill(ctx, T("gap"), 170, 790, 34, TERRA, ARENA, clamp(ga))
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()
    if t > s2:
        a = e_io(prog(t, s2, s2 + 0.8))
        lt = t - s2
        ctx.save()
        ctx.push_group()
        bg_fill(ctx, ARENA)
        ripples(ctx, 1600, 900, t, 600, FIBRA, 4, 12)
        label(ctx, "VIII Informe · ANAR · Fundación Mutua Madrileña" if LANG == "es" else "VIII Informe · ANAR · Fundació Mutua Madrileña", 200, 240, MUSGO, fade(lt, 0.2), 20)
        for i, (val, key, t0) in enumerate([(84.6, "s1", 0.3), (46.9, "s2", m[4] - s2)]):
            pa = e_out(prog(lt, t0, t0 + 1.6))
            if pa <= 0:
                continue
            x = 200 + i * 820
            n = val * pa
            s = (f"{n:.1f}".replace(".", ",")) + " %"
            font(ctx, SERIF, 190)
            text(ctx, s, x, 520, TERRA, clamp(pa * 2))
            para(ctx, T(key), x + 6, 600, 640, 34, TINTA, clamp(pa * 2), 1.35, SANS)
        para(ctx, T("src"), 200, 800, 1400, 20, LIQUEN, fade(lt, 1.0), 1.4)
        # hacia TARA: un punto terracota que crece y se lleva la pantalla
        if len(m) > 5:
            k = e_io(prog(t, m[5] + 1.4, D))
            if k > 0:
                circle(ctx, CX, CY, 8 + k * 1400, ARENA)
                circle(ctx, CX, CY, 14 * (1 - k) + 6, TERRA, 1 - k * 0.6)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()


def sc_que_es(ctx, t, D, m):
    bg_fill(ctx, ARENA)
    ripples(ctx, CX, CY + 40, t, 640, FIBRA, 5, 11, 0.8)
    # Fase A: logo + definición (frases 0-1)
    pa = win(t, 0.0, m[2] - 0.2, 0.8, 0.7)
    if pa > 0:
        logo(ctx, CX, 270 - (1 - fade(t, 0.2, 1.0)) * 40, 130, pa)
        label(ctx, T("eco"), CX, 345, MUSGO, pa * fade(t, 0.8), 22, "center")
        # anillos
        rp = e_out(prog(t, m[0] + 1.0, m[0] + 3.0))
        for i, (dx, dy) in enumerate([(-130, 0), (130, 0), (0, 200)]):
            k = clamp(rp * 3 - i)
            if k <= 0:
                continue
            cx_, cy_ = CX + dx, 560 + dy * 0.7
            ctx.arc(cx_, cy_, 150 * e_out(k), 0, 2 * math.pi)
            src(ctx, [TERRA, SAGE_D, OCHRE][i], 0.12 * pa)
            ctx.fill()
            ctx.arc(cx_, cy_, 150 * e_out(k), 0, 2 * math.pi)
            src(ctx, [TERRA, SAGE_D, OCHRE][i], 0.8 * pa)
            ctx.set_line_width(2.5)
            ctx.stroke()
            font(ctx, SERIF, 32)
            text(ctx, T("rings")[i], cx_ + [-55, 55, 0][i], cy_ + [-35, -35, 80][i], TINTA, pa * k, "center")
        for i, s in enumerate(T("tags")):
            ta = fade(t, m[1] + 0.4 + i * 0.45)
            if ta > 0:
                pill(ctx, s, 1400, 520 + i * 90, 28, TINTA if i == 2 else ARENA2, ARENA if i == 2 else TINTA, ta * pa, bd=None if i == 2 else FIBRA)
    # Fase B: «no es una app más» + integración (frases 2-3)
    pb = win(t, m[2] - 0.2, m[4] - 0.2, 0.7, 0.7)
    if pb > 0:
        headline(ctx, [T("noapp")[0]], 160, 420, 68, m[2], t, TINTA)
        headline(ctx, ["*" + T("noapp")[1].replace(" ", "* *") + "*"], 160, 510, 68, m[2] + 0.7, t)
        # el centro y lo que ya tiene; TARA se teje por dentro
        bx, by = 1080, 170
        fill_rr(ctx, bx, by, 680, 660, 30, ARENA2, pb)
        stroke_rr(ctx, bx, by, 680, 660, 30, FIBRA, 2, pb)
        label(ctx, {"es": "Tu centro", "ca": "El teu centre"}[LANG], bx + 40, by + 60, MUSGO, pb, 20)
        nodes = []
        for i, s in enumerate(T("integra")):
            na = fade(t, m[3] + 0.2 + i * 0.35)
            x, y = bx + 60 + (i % 2) * 320, by + 160 + (i // 2) * 230
            fill_rr(ctx, x, y, 270, 110, 22, WHITE, na * pb)
            stroke_rr(ctx, x, y, 270, 110, 22, FIBRA, 1.5, na * pb)
            font(ctx, SANSM, 27)
            for j, ln in enumerate(wrap(ctx, s, 230)):
                text(ctx, ln, x + 135, y + 62 + j * 30 - (len(wrap(ctx, s, 230)) - 1) * 15, TINTA, na * pb, "center")
            nodes.append((x + 135, y + 55))
        thp = e_io(prog(t, m[3] + 1.6, m[3] + 4.0))
        if thp > 0:
            pts = [(bx + 30, by + 120), nodes[0], nodes[1], nodes[3], nodes[2], (bx + 340, by + 600)]
            thread(ctx, pts, TERRA, 5, thp, pb)
        if thp > 0.8:
            pill(ctx, "TARA", bx + 340, by + 600, 26, TERRA, ARENA, pb * e_out(prog(thp, 0.8, 1)), align="center")
    # Fase C: el principio
    pc = win(t, m[4] - 0.2, D + 1, 0.8, 0.5)
    if pc > 0:
        headline(ctx, [T("principle")[0]], CX, 470, 78, m[4] + 0.2, t, TINTA, align="center")
        headline(ctx, [T("principle")[1].replace(" ", "* *")], CX, 580, 78, m[4] + 2.6, t, align="center")
        thread(ctx, [(CX - 380, 680), (CX - 120, 660), (CX + 120, 700), (CX + 380, 675)], TERRA, 3, e_io(prog(t, m[4] + 3.4, m[4] + 5.0)), pc)


def staffroom(ctx, t):
    bg_fill(ctx, hexc("EFE6D6"))
    fill_rr(ctx, 0, 820, W, 300, 0, hexc("D9C7A8"))
    window(ctx, 120, 150, 330, 360, hexc("CFE0E6"), hexc("F2EDE3"))
    plant(ctx, 150, 820, 110, t)


def sc_demo(ctx, t, D, m):
    staffroom(ctx, t)
    # Laura con el portátil, a la izquierda
    ctx.save()
    ctx.translate(-60, 40)
    chair(ctx, 560, 880, 200, SAGE_D)
    person(ctx, 560, 880, 500, "laura", t, mood="think" if t < m[5] else "smile", sit=True, arms=("type", "type"), facing=0.5, seed=1)
    laptop(ctx, 560, 770, 220)
    fill_rr(ctx, 230, 768, 680, 30, 8, hexc("C9A77F"))
    fill_rr(ctx, 250, 792, 640, 190, 6, hexc("B8936A"))
    cup(ctx, 820, 760, 60, t)
    ctx.restore()
    # teléfono / espacio del profesorado, a la derecha
    me_t = m[1] + 0.6
    ty_t = m[2] + 0.2
    ta_t = m[3] + 0.2
    msgs = [("me", T("me"), me_t, me_t - 0.01), ("tara", T("tara"), ta_t, ty_t)]
    pz = e_out(prog(t, 0.2, 1.2))
    ph = win(t, 0, m[4] + 0.4, 1.0, 0.8)
    if ph > 0:
        ctx.save()
        ctx.push_group()
        phone_ui(ctx, 1060, 90 + (1 - pz) * 60, 620, 900, t, msgs, T("brand"), T("status"))
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(ph)
        ctx.restore()
    # observado vs interpretado + preguntas
    pq = win(t, m[4] + 0.2, m[5] - 0.2, 0.8, 0.6)
    if pq > 0:
        fill_rr(ctx, 980, 120, 820, 820, 30, ARENA, pq)
        stroke_rr(ctx, 980, 120, 820, 820, 30, FIBRA, 2, pq)
        for c, (title, items, col) in enumerate([(T("obs"), T("obs_i"), SAGE_D), (T("int"), T("int_i"), TERRA)]):
            x = 1020 + c * 390
            label(ctx, title, x, 190, col, pq, 20)
            for i, s in enumerate(items):
                ia = fade(t, m[4] + 0.4 + (i + c * 3) * 0.25)
                fill_rr(ctx, x, 220 + i * 92, 360, 72, 18, WHITE if c == 0 else hexc("F7E6DA"), ia * pq)
                font(ctx, SANS, 23)
                text(ctx, s, x + 20, 264 + i * 92, TINTA, ia * pq)
        line(ctx, [(1400, 200), (1400, 480)], FIBRA, 2, pq)
        for i, s in enumerate(T("q")):
            qa = fade(t, m[4] + 2.0 + i * 0.9)
            y = 590 + i * 110
            circle(ctx, 1045, y, 22, TERRA, qa * pq)
            font(ctx, SANSB, 22, bold=True)
            text(ctx, str(i + 1), 1045, y + 8, ARENA, qa * pq, "center")
            font(ctx, SERIF, 36)
            text(ctx, s, 1090, y + 13, TINTA, qa * pq)
    # andamio: parar · comprender · preparar la acción
    ps = win(t, m[5] - 0.2, D + 1, 0.8, 0.4)
    if ps > 0:
        fill_rr(ctx, 980, 120, 820, 820, 30, ARENA, ps)
        stroke_rr(ctx, 980, 120, 820, 820, 30, FIBRA, 2, ps)
        for i, s in enumerate(T("scaf")):
            k = e_out_back(prog(t, m[5] + 0.3 + i * 0.7, m[5] + 0.9 + i * 0.7))
            y = 760 - i * 170
            w = 560 - i * 90
            fill_rr(ctx, 1390 - w / 2, y - 60, w, 110, 26, [SAGE, OCHRE, TERRA][i], clamp(k) * ps)
            font(ctx, SERIF, 40)
            text(ctx, s, 1390, y + 12, ARENA if i == 2 else TINTA, clamp(k) * ps, "center")
            if i < 2:
                line(ctx, [(1390 - w / 2 + 40, y - 60), (1390 - w / 2 + 40, y - 110)], TINTA, 6, clamp(k) * ps * 0.4)
                line(ctx, [(1390 + w / 2 - 40, y - 60), (1390 + w / 2 - 40, y - 110)], TINTA, 6, clamp(k) * ps * 0.4)
        da = fade(t, m[6] + 0.2)
        label(ctx, T("decide"), 1390, 880, TERRA_D, da * ps, 19, "center")


def livingroom(ctx, t, lt, closeness):
    bg_fill(ctx, hexc("F1E4D3"))
    fill_rr(ctx, 0, 840, W, 300, 0, hexc("CDB89A"))
    window(ctx, 1380, 160, 420, 400, hexc("E8A97C"), hexc("F7D9C0"))
    # lámpara
    line(ctx, [(300, 840), (300, 380)], TINTA, 8)
    ctx.move_to(220, 380)
    ctx.line_to(380, 380)
    ctx.line_to(340, 290)
    ctx.line_to(260, 290)
    ctx.close_path()
    src(ctx, OCHRE)
    ctx.fill()
    g = cairo.RadialGradient(300, 400, 10, 300, 400, 500)
    g.add_color_stop_rgba(0, 1, 0.85, 0.6, 0.35)
    g.add_color_stop_rgba(1, 1, 0.85, 0.6, 0)
    ctx.set_source(g)
    ctx.paint()
    # sofá
    fill_rr(ctx, 520, 540, 900, 260, 60, SAGE_D)
    fill_rr(ctx, 480, 700, 980, 150, 50, SAGE)
    fill_rr(ctx, 540, 840, 30, 50, 8, TINTA)
    fill_rr(ctx, 1370, 840, 30, 50, 8, TINTA)
    plant(ctx, 1650, 840, 130, t)
    d = lerp(330, 120, closeness)
    person(ctx, CX - 60 - d * 0.6, 860, 460, "marta", t, mood="worry" if closeness < 0.5 else "smile", sit=True,
           arms=("front", "front") if closeness < 0.5 else ("down", "front"), facing=0.6, seed=3)
    person(ctx, CX + 40 + d * 0.6, 870, 380, "hija", t, mood="neutral" if closeness < 0.5 else "smile", sit=True,
           arms=("phone", "phone") if closeness < 0.7 else ("down", "down"), facing=-0.3 - 0.4 * closeness, seed=5,
           head_tilt=0.12 * (1 - closeness))


def sc_comunidad(ctx, t, D, m):
    sh = m[2] - 0.4
    if t < sh + 0.8:
        a = 1 - e_io(prog(t, sh, sh + 0.8))
        ctx.save()
        ctx.push_group()
        bg_fill(ctx, ARENA)
        # diagrama del ecosistema: profesorado en el centro
        cx_, cy_ = 760, 520
        names = T("eco_n")
        pts = [(1340, 280), (1420, 520), (1340, 760)]
        for i, (px, py) in enumerate(pts):
            k = e_io(prog(t, 0.6 + i * 0.3, 1.8 + i * 0.3))
            thread(ctx, [(cx_ + 90, cy_), (lerp(cx_, px, 0.5), lerp(cy_, py, 0.25)), (px - 50, py)], FIBRA, 3, k)
            # pulso que viaja
            ph = ((t * 0.4 + i * 0.33) % 1.0)
            if k >= 1:
                circle(ctx, lerp(cx_ + 90, px - 50, ph), lerp(cy_, py, ph) - math.sin(ph * math.pi) * 20 * (1 if py < cy_ else -1 if py > cy_ else 0), 6, TERRA)
            circle(ctx, px, py, 46 * e_out(k), ARENA2)
            ctx.arc(px, py, 46 * e_out(k), 0, 2 * math.pi)
            src(ctx, TINTA)
            ctx.set_line_width(2)
            ctx.stroke()
            font(ctx, SANSM, 32)
            text(ctx, names[i + 1], px + 70, py + 11, TINTA, k)
        circle(ctx, cx_, cy_, 92 * e_out(prog(t, 0.2, 1.0)), TINTA)
        person(ctx, cx_, cy_ + 70, 150, "laura", t, mood="smile", seed=1)
        font(ctx, SERIF, 40)
        text(ctx, names[0], cx_, cy_ + 150, TINTA, fade(t, 0.6), "center")
        for i, s in enumerate(T("prof")):
            pa = fade(t, m[1] + 0.8 + i * 1.1)
            pill(ctx, s, 200 + i * 0, 830 + i * 0, 28, ARENA2, TINTA, 0) if False else None
            if pa > 0:
                pill(ctx, s, 140 + [0, 560, 1040][i], 830, 27, ARENA2 if i != 2 else TERRA, TINTA if i != 2 else ARENA, pa, bd=FIBRA if i != 2 else None)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()
    if t > sh and t < m[4] + 0.6:
        a = min(e_io(prog(t, sh, sh + 0.8)), 1 - e_io(prog(t, m[4] - 0.2, m[4] + 0.6)))
        lt = t - sh
        ctx.save()
        ctx.push_group()
        cam(ctx, lt, m[4] - sh, 1.0, 1.06, 0, 0)
        closeness = e_io(prog(t, m[3] + 2.5, m[3] + 6.5))
        livingroom(ctx, t, lt, closeness)
        fill_rr(ctx, 80, 70, 300, 64, 32, ARENA, 0.92 * fade(lt, 0.4))
        label(ctx, T("home"), 230, 112, TINTA, fade(lt, 0.4), 22, "center")
        ia = fade(lt, 0.8)
        pill(ctx, T("ifcenter"), 1660, 102, 24, TERRA, ARENA, ia, align="center")
        # bocadillos: primero tensión, luego acuerdo
        if t > m[3]:
            ba = win(t, m[3] + 0.6, m[3] + 3.2, 0.4, 0.4)
            for i, (bx, by) in enumerate([(700, 380), (1210, 420)]):
                fill_rr(ctx, bx - 60, by - 40, 120, 70, 35, WHITE, ba)
                for k in range(3):
                    line(ctx, [(bx - 30 + k * 30 - 8, by - 12), (bx - 30 + k * 30 + 8, by + 6)], TERRA, 5, ba)
            ca = fade(t, m[3] + 5.5, 0.8)
            if ca > 0:
                fill_rr(ctx, 880, 330, 180, 76, 38, WHITE, ca)
                ctx.save()
                ctx.translate(970, 368)
                ctx.scale(1.4, 1.4)
                ctx.move_to(0, 6)
                ctx.curve_to(-14, -4, -12, -16, 0, -9)
                ctx.curve_to(12, -16, 14, -4, 0, 6)
                src(ctx, TERRA, ca)
                ctx.fill()
                ctx.restore()
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()
    if t > m[4] - 0.2:
        a = e_io(prog(t, m[4] - 0.2, m[4] + 0.6))
        ctx.save()
        ctx.push_group()
        bg_fill(ctx, ARENA)
        ripples(ctx, CX, CY, t, 600, FIBRA, 4, 12)
        headline(ctx, [T("nosub")[0]], CX, 470, 58, m[4] + 0.2, t, TINTA, align="center", stagger=0.06)
        h2 = T("nosub")[1].strip("*")
        font(ctx, SERIF, 58, italic=True)
        ls = wrap(ctx, h2, 1500)
        headline(ctx, ["*" + l_.replace(" ", "* *") + "*" for l_ in ls], CX, 580, 58, m[4] + 3.6, t, align="center", stagger=0.06)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()


def sc_niveles(ctx, t, D, m):
    bg_fill(ctx, ARENA2)
    headline(ctx, [T("lvtitle")[0]], 150, 200, 70, 0.3, t, TINTA)
    headline(ctx, [T("lvtitle")[1].replace(" ", "* *")], 150, 280, 70, 0.8, t)
    # en qué frase aparece cada nivel
    starts = [m[1] + 0.2, m[1] + 3.0, m[2] + 0.6, m[3] + 2.2, m[3] + 5.0]
    for i, ((title, tag), st) in enumerate(zip(T("lv"), starts)):
        k = e_out(prog(t, st, st + 0.9))
        x = 150 + i * 70
        y = 360 + i * 118
        w = 1620 - i * 70
        later = i >= 3
        fill_rr(ctx, x + (1 - k) * -40, y, w, 100, 24, ARENA if not later else ARENA2, max(0.25, k) if t > st else 0.25)
        stroke_rr(ctx, x + (1 - k) * -40, y, w, 100, 24, FIBRA if k < 1 else TINTA, 1.5, max(0.3, k))
        circle(ctx, x + 60, y + 50, 32, TERRA if k >= 1 and i == int(clamp(sum(1 for s in starts if t > s) - 1, 0, 4)) else ARENA, max(0.3, k))
        ctx.arc(x + 60, y + 50, 32, 0, 2 * math.pi)
        src(ctx, TINTA, max(0.3, k))
        ctx.set_line_width(2)
        ctx.stroke()
        font(ctx, SERIF, 30)
        cur = k >= 1 and i == int(clamp(sum(1 for s in starts if t > s) - 1, 0, 4))
        text(ctx, f"0{i + 1}", x + 60, y + 61, ARENA if cur else TINTA, max(0.3, k), "center")
        font(ctx, SERIF, 36)
        text(ctx, title, x + 120, y + 62, TINTA, max(0.25, k))
        font(ctx, MONO, 17)
        tg = tag.upper()
        tgw = tw(ctx, tg) + 40
        tx = x + w - tgw - 30
        if later:
            stroke_rr(ctx, tx, y + 30, tgw, 40, 20, TINTA, 1.5, k)
            text(ctx, tg, tx + 20, y + 57, TINTA, k)
        else:
            fill_rr(ctx, tx, y + 30, tgw, 40, 20, TINTA, k)
            text(ctx, tg, tx + 20, y + 57, ARENA, k)
    na = fade(t, m[4] + 0.3)
    if na > 0:
        pill(ctx, T("noauto"), CX, 1000, 30, TERRA, ARENA, na, align="center")


def sc_proteccion(ctx, t, D, m):
    bg_fill(ctx, TINTA)
    for i in range(5):
        pts = [(-100 + k * 260, 180 + i * 170 + math.sin(t * 0.5 + k * 0.9 + i) * 26) for k in range(10)]
        thread(ctx, pts, TERRA if i == 4 else hexc("DDD3BC", 0.18), 1.8, 1.0, 0.5 if i == 4 else 1.0)
    label(ctx, T("prot"), 150, 190, LIQUEN, fade(t, 0.2), 22)
    headline(ctx, [T("prottitle")[0]], 150, 300, 76, 0.5, t, ARENA, TERRA_L)
    headline(ctx, [T("prottitle")[1].replace(" ", "* *")], 150, 390, 76, 1.2, t, ARENA, TERRA_L)
    for i, (tt_, dd) in enumerate(T("p")):
        st = m[i + 1] + 0.2 if i + 1 < len(m) else D
        k = e_out(prog(t, st, st + 0.9))
        x = 150 + i * 560
        fill_rr(ctx, x, 520 + (1 - k) * 40, 520, 380, 28, hexc("26322C"), k)
        stroke_rr(ctx, x, 520 + (1 - k) * 40, 520, 380, 28, hexc("DDD3BC", 0.22), 1.5, k)
        # icono
        ic_y = 600 + (1 - k) * 40
        ctx.arc(x + 70, ic_y, 30, 0, 2 * math.pi)
        src(ctx, TERRA_L, k)
        ctx.set_line_width(2.5)
        ctx.stroke()
        if i == 0:
            line(ctx, [(x + 56, ic_y - 14), (x + 84, ic_y + 14)], TERRA_L, 3, k)
            line(ctx, [(x + 84, ic_y - 14), (x + 56, ic_y + 14)], TERRA_L, 3, k)
        elif i == 1:
            font(ctx, SERIF, 34)
            text(ctx, "?", x + 70, ic_y + 12, TERRA_L, k, "center")
        else:
            circle(ctx, x + 62, ic_y - 4, 7, TERRA_L, k)
            circle(ctx, x + 80, ic_y - 4, 7, TERRA_L, k)
            line(ctx, [(x + 52, ic_y + 14), (x + 90, ic_y + 14)], TERRA_L, 3, k)
        font(ctx, SERIF, 34)
        yy = 700 + (1 - k) * 40
        for ln in wrap(ctx, tt_, 450):
            text(ctx, ln, x + 40, yy, ARENA, k)
            yy += 42
        para(ctx, dd, x + 40, yy + 16, 440, 25, hexc("C9C6B9"), k, 1.45)


def network_pts():
    rng = np.random.default_rng(7)
    pts = []
    while len(pts) < 20:
        x, y = rng.uniform(980, 1780), rng.uniform(260, 860)
        if all((x - a) ** 2 + (y - b) ** 2 > 110 ** 2 for a, b in pts):
            pts.append((x, y))
    return pts


NET = network_pts()


def sc_pilotaje(ctx, t, D, m):
    sh = m[2] - 0.3
    if t < sh + 0.8:
        a = 1 - e_io(prog(t, sh, sh + 0.8))
        ctx.save()
        ctx.push_group()
        bg_fill(ctx, ARENA2)
        label(ctx, T("pilot"), 150, 210, TERRA_D, fade(t, 0.2), 22)
        headline(ctx, [T("red")], 150, 300, 58, 0.5, t, TINTA, stagger=0.06)
        font(ctx, SERIF, 150)
        na = fade(t, 1.6, 0.8)
        text(ctx, T("red_n"), 150, 520, TERRA, na)
        font(ctx, SANSM, 34)
        text(ctx, T("red_c"), 160, 580, TINTA, na)
        for i, s in enumerate(T("check")):
            ca = fade(t, m[1] + 0.3 + i * 1.0)
            y = 650 + i * 62
            circle(ctx, 172, y - 10, 18, SAGE_D, ca)
            line(ctx, [(163, y - 10), (170, y - 2), (182, y - 19)], ARENA, 4, ca)
            font(ctx, SANS, 30)
            text(ctx, s, 210, y, TINTA, ca)
        # red de 20 centros que se van encendiendo y conectando
        on = int(clamp(prog(t, 1.2, m[1]), 0, 1) * 20 + 0.5)
        for i, (x, y) in enumerate(NET):
            for j in range(i):
                if j < on and i < on:
                    x2, y2 = NET[j]
                    dd = math.hypot(x - x2, y - y2)
                    if dd < 260:
                        line(ctx, [(x, y), (x2, y2)], TERRA, 1.8, 0.35)
        for i, (x, y) in enumerate(NET):
            k = 1.0 if i < on else 0.0
            pulse = 1 + 0.08 * math.sin(t * 2 + i)
            circle(ctx, x, y, 30 * pulse, ARENA, 1)
            ctx.arc(x, y, 30 * pulse, 0, 2 * math.pi)
            src(ctx, TINTA if k else FIBRA)
            ctx.set_line_width(2)
            ctx.stroke()
            # pequeña escuela dentro
            if k:
                ctx.move_to(x - 13, y - 2)
                ctx.line_to(x, y - 14)
                ctx.line_to(x + 13, y - 2)
                ctx.close_path()
                src(ctx, TERRA)
                ctx.fill()
                fill_rr(ctx, x - 10, y - 2, 20, 14, 2, TERRA)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()
    if t > sh:
        a = e_io(prog(t, sh, sh + 0.8))
        lt = t - sh
        ctx.save()
        ctx.push_group()
        bg_fill(ctx, ARENA)
        ripples(ctx, CX, 1100, t, 900, FIBRA, 4, 12)
        label(ctx, T("team"), CX, 230, MUSGO, fade(lt, 0.2), 22, "center")
        team = [("marc-boix.jpg", "Marc Boix", (0.5, 0.27), 1.9), ("marc-ribo.jpg", "Marc Ribó", (0.5, 0.4), 1.0), ("flor-alonso.jpg", "Flor Alonso", (0.5, 0.35), 1.15),
                ("mireia-font.jpg", "Mireia Font", (0.5, 0.33), 1.2), ("mustapha-sousan.jpg", "Mustapha Sousan", (0.42, 0.35), 1.0)]
        for i, (f, n, fc, zm) in enumerate(team):
            k = e_out_back(prog(lt, 0.4 + i * 0.35, 1.1 + i * 0.35))
            x = 300 + i * 330
            y = 520
            if k <= 0:
                continue
            circle(ctx, x, y, 122 * clamp(k), ARENA2)
            photo_circle(ctx, f, x, y, 115 * clamp(k), clamp(k), fc, zm)
            ctx.arc(x, y, 122 * clamp(k), 0, 2 * math.pi)
            src(ctx, FIBRA, clamp(k))
            ctx.set_line_width(3)
            ctx.stroke()
            font(ctx, SERIF, 32)
            text(ctx, n, x, 700, TINTA, clamp(k), "center")
            label(ctx, T("roles")[i], x, 745, MUSGO, clamp(k), 15, "center")
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()


def sc_cierre(ctx, t, D, m):
    # Plano 1: atardecer, Laura sale (frases 0-1) · Plano 2: la web real · Plano 3: cartel final
    s2 = m[2] - 0.4
    if t < s2 + 0.8:
        a = 1 - e_io(prog(t, s2, s2 + 0.8))
        ctx.save()
        ctx.push_group()
        cam(ctx, t, s2 + 1, 1.04, 1.0, 0, 0)
        vgrad(ctx, 0, 0, W, H, hexc("E8A97C"), hexc("F7E3CF"))
        circle(ctx, 480, 640, 120, hexc("F4B46A"), 0.9)
        fill_rr(ctx, -50, 900, W + 100, 300, 0, hexc("C9B593"))
        school(ctx, 360, 880, 1200, 420, t, light=1.0, clock=(18, 0), lang=LANG)
        tree(ctx, 220, 900, 260, t, mix(SAGE, OCHRE, 0.3))
        tree(ctx, 1720, 900, 300, t, mix(SAGE, OCHRE, 0.4))
        wk = prog(t, 0.6, s2 - 0.3)
        lx = lerp(960, 1500, e_io(wk))
        person(ctx, lx, 1000, 300, "laura", t, mood="smile", walk=(t * 6.0 if 0 < wk < 1 else None), arms=("down", "down"), facing=0.5, seed=1)
        person(ctx, lx - 170 + (1 - e_io(wk)) * 60, 1000, 290, "padre", t, mood="smile", arms=("up" if t > m[1] else "down", "down"), facing=-0.4, seed=4)
        fill_rr(ctx, 80, 70, 330, 64, 32, ARENA, 0.92 * fade(t, 0.4))
        label(ctx, T("evening"), 245, 112, TINTA, fade(t, 0.4), 22, "center")
        ca = fade(t, m[1] + 0.3)
        if ca > 0:
            fill_rr(ctx, 1100, 150, 700, 210, 30, ARENA, 0.94 * ca)
            headline(ctx, [T("done")], 1150, 240, 48, m[1] + 0.3, t, TINTA, stagger=0.05)
            headline(ctx, [T("done2").replace(" ", "* *")], 1150, 310, 48, m[1] + 1.4, t, stagger=0.05)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()
    if t > s2:
        a = e_io(prog(t, s2, s2 + 0.8))
        ctx.save()
        ctx.push_group()
        bg_fill(ctx, ARENA)
        ripples(ctx, CX, CY, t, 700, FIBRA, 5, 10)
        lt = t - s2
        # la web real, de fondo, desplazándose
        wa = win(t, s2, m[3] + 0.2, 0.8, 0.8)
        if wa > 0:
            shot = f"web-{LANG}.png"
            sc_ = lerp(0, 9800, e_io(prog(t, s2 + 1.0, m[3] - 0.2)))
            browser(ctx, 260, 90, 1400, 860, T("url"), shot, sc_, wa)
            fill_rr(ctx, 0, 0, W, H, 0, ARENA, 0.0)
        fa = fade(t, m[3] - 0.3, 0.8)
        if fa > 0:
            bg = ARENA
            src(ctx, bg, fa)
            ctx.paint()
            ripples(ctx, CX, CY, t, 700, FIBRA, 5, 10, fa)
            logo(ctx, CX, 260, 96, fa)
            headline(ctx, [T("final")[0]], CX, 470, 84, m[3] - 0.1, t, TINTA, align="center", stagger=0.07)
            headline(ctx, [T("final")[1].replace(" ", "* *")], CX, 575, 84, m[3] + 0.6, t, align="center", stagger=0.07)
            ka = fade(t, m[3] + 2.0)
            font(ctx, SANSM, 34)
            text(ctx, T("cta"), CX, 720, MUSGO, ka, "center")
            pill(ctx, T("url"), CX, 830, 40, TERRA, ARENA, fade(t, m[3] + 2.8), align="center")
            label(ctx, T("contact"), CX, 935, MUSGO, fade(t, m[3] + 3.4), 20, "center")
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()


SCENES = {"manana": sc_manana, "reto": sc_reto, "que_es": sc_que_es, "demo": sc_demo, "comunidad": sc_comunidad,
          "niveles": sc_niveles, "proteccion": sc_proteccion, "pilotaje": sc_pilotaje, "cierre": sc_cierre}

XF = 0.7   # fundido entre escenas


# ================================================================== subtítulos
def subtitle(ctx, t):
    for sc in TLD["scenes"]:
        lt = t - sc["start"]
        if lt < -0.5 or lt > sc["dur"] + 0.5:
            continue
        for ln in sc["lines"]:
            if ln["t0"] - 0.1 <= lt <= ln["t1"] + 0.25:
                a = min(e_out(prog(lt, ln["t0"] - 0.1, ln["t0"] + 0.15)), 1 - e_out(prog(lt, ln["t1"], ln["t1"] + 0.25)))
                font(ctx, SANSM, 38)
                lines = wrap(ctx, ln["text"], 1420)
                bh = len(lines) * 50 + 34
                maxw = max(tw(ctx, l_) for l_ in lines)
                y0 = H - 70 - bh
                fill_rr(ctx, CX - maxw / 2 - 34, y0, maxw + 68, bh, 26, TINTA, 0.78 * a)
                for i, l_ in enumerate(lines):
                    text(ctx, l_, CX, y0 + 52 + i * 50, ARENA, a, "center")
                return


def scene_at(t):
    out = []
    for sc in TLD["scenes"]:
        last = sc is TLD["scenes"][-1]
        if sc["start"] - XF <= t <= (TLD["total"] + 1 if last else sc["start"] + sc["dur"] + XF):
            out.append(sc)
    return out


def draw_frame(ctx, t, subs=True):
    bg_fill(ctx, ARENA)
    first = TLD["scenes"][0]["start"]
    if t < first + XF:
        a = 1 - e_io(prog(t, first - XF * 0.2, first + XF))
        if a > 0:
            ctx.save()
            ctx.push_group()
            sc_intro(ctx, t, first)
            ctx.pop_group_to_source()
            ctx.paint_with_alpha(a)
            ctx.restore()
    for sc in scene_at(t):
        lt = t - sc["start"]
        D = sc["dur"]
        a = min(e_io(prog(lt, -XF / 2, XF / 2)), 1.0 if sc is TLD["scenes"][-1] else 1 - e_io(prog(lt, D - XF / 2, D + XF / 2)))
        if a <= 0:
            continue
        m = [ln["t0"] for ln in sc["lines"]]
        ctx.save()
        ctx.push_group()
        SCENES[sc["id"]](ctx, max(lt, 0.0), D + (TLD["total"] - sc["start"] - D if sc is TLD["scenes"][-1] else 0), m)
        ctx.pop_group_to_source()
        ctx.paint_with_alpha(a)
        ctx.restore()
    if subs:
        subtitle(ctx, t)


# ================================================================== render
_yy, _xx = np.mgrid[0:H, 0:W].astype(np.float32)
_rr = ((_xx - CX) / CX) ** 2 + ((_yy - CY) / CY) ** 2
VIGN = (1 - 0.06 * _rr)[..., None].astype(np.float32)
del _yy, _xx, _rr


def render(fi):
    surf = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
    ctx = cairo.Context(surf)
    t = fi / FPS
    draw_frame(ctx, t, SUBS)
    surf.flush()
    acc = np.ndarray((H, W, 4), np.uint8, surf.get_data()).astype(np.float32)
    rng = np.random.default_rng(fi)
    grain = rng.normal(0, 2.0, (H // 2, W // 2, 1)).astype(np.float32).repeat(2, 0).repeat(2, 1)
    acc[..., :3] = acc[..., :3] * VIGN + grain
    np.clip(acc, 0, 255, out=acc)
    out = acc.astype(np.uint8)
    out[..., 3] = 255
    return out.tobytes()


SUBS = True


def setup(lang, fps):
    global LANG, TLD, FPS
    LANG, FPS = lang, fps
    TLD = TL.load(lang)


def main():
    global SUBS
    args = sys.argv[1:]
    mode = args[0] if args else "video"
    lang = args[1] if len(args) > 1 else "es"
    fps = int(args[args.index("--fps") + 1]) if "--fps" in args else 30
    SUBS = "--nosubs" not in args
    setup(lang, fps)
    os.makedirs(os.path.join(HERE, "out"), exist_ok=True)
    if mode == "stills":
        times = [float(x) for x in args[2].split(",")]
        d = os.path.join(HERE, "out", "stills")
        os.makedirs(d, exist_ok=True)
        for tt in times:
            buf = render(int(round(tt * FPS)))
            s = cairo.ImageSurface.create_for_data(bytearray(buf), cairo.FORMAT_ARGB32, W, H)
            s.write_to_png(os.path.join(d, f"{lang}_{tt:06.1f}.png"))
            print("still", tt, flush=True)
        return
    n = int(TLD["total"] * FPS)
    if "--range" in args:
        a, b = [float(x) for x in args[args.index("--range") + 1].split(":")]
        frames = range(int(a * FPS), int(b * FPS))
        out = os.path.join(HERE, "out", f"clip_{lang}_{int(a)}_{int(b)}.mp4")
    else:
        frames = range(n)
        out = os.path.join(HERE, "out", f"video_{lang}{'' if SUBS else '_nosubs'}_noaudio.mp4")
    ff = subprocess.Popen(["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "bgra",
                           "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-c:v", "libx264", "-preset", "medium",
                           "-crf", "19", "-profile:v", "high", "-pix_fmt", "yuv420p", "-movflags", "+faststart", out],
                          stdin=subprocess.PIPE)
    from multiprocessing import Pool
    with Pool(os.cpu_count(), initializer=setup, initargs=(lang, fps)) as pool:
        for i, buf in enumerate(pool.imap(render, frames, chunksize=4)):
            ff.stdin.write(buf)
            if i % (FPS * 10) == 0:
                print(f"frame {i}/{len(frames)}", flush=True)
    ff.stdin.close()
    ff.wait()
    print("ok", out)


if __name__ == "__main__":
    main()
