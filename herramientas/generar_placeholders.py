#!/usr/bin/env python3
"""Genera placeholders (imágenes grises y tonos de audio) para cada estímulo de estimulos.json.
Uso: python3 herramientas/generar_placeholders.py   (requiere Pillow y ffmpeg)
NO sobrescribe archivos existentes salvo con --forzar. Reemplaza estos archivos por los reales."""
import json, math, os, random, struct, subprocess, sys, wave, tempfile

RAIZ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FORZAR = "--forzar" in sys.argv
from PIL import Image, ImageDraw, ImageFont

def fuente(t):
    for f in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"]:
        if os.path.exists(f):
            return ImageFont.truetype(f, t)
    return ImageFont.load_default()

def imagen(ruta, etiqueta, semilla):
    rnd = random.Random(semilla)
    w, h = rnd.choice([(1200, 900), (900, 1200), (1200, 800), (1080, 1080)])
    g = rnd.randint(120, 170)
    im = Image.new("RGB", (w, h), (g, g, g))
    d = ImageDraw.Draw(im)
    for i in range(0, w, 60): d.line([(i, 0), (i, h)], fill=(g - 12,) * 3, width=1)
    for j in range(0, h, 60): d.line([(0, j), (w, j)], fill=(g - 12,) * 3, width=1)
    for _ in range(6):
        x, y, r = rnd.randint(0, w), rnd.randint(0, h), rnd.randint(40, 160)
        c = g + rnd.randint(-35, 35)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(c, c, c))
    f1, f2 = fuente(64), fuente(30)
    d.text((w / 2, h / 2 - 30), etiqueta, fill=(250, 250, 250), font=f1, anchor="mm")
    d.text((w / 2, h / 2 + 40), "PLACEHOLDER · reemplazar por la imagen final", fill=(235, 235, 235), font=f2, anchor="mm")
    im.save(ruta, "JPEG", quality=82)

def audio(ruta, semilla, dur=None, freq=None):
    rnd = random.Random(semilla)
    sr = 22050
    dur = dur or rnd.uniform(9, 14)
    freq = freq or rnd.choice([196, 220, 247, 262, 294, 330])
    n = int(sr * dur)
    # Ráfagas tipo "sílabas" con silencios, para que la forma de onda tenga estructura.
    env = [0.0] * n
    t = 0.3
    while t < dur - 0.4:
        largo = rnd.uniform(0.15, 0.6)
        amp = rnd.uniform(0.35, 0.9)
        a, b = int(t * sr), int(min(dur, t + largo) * sr)
        for i in range(a, b):
            p = (i - a) / max(1, b - a)
            env[i] = amp * math.sin(math.pi * p)
        t += largo + rnd.choice([0.05, 0.1, 0.2, 0.45])
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False).name
    with wave.open(tmp, "w") as wf:
        wf.setnchannels(1); wf.setsampwidth(2); wf.setframerate(sr)
        data = bytearray()
        for i in range(n):
            s = env[i] * (0.7 * math.sin(2 * math.pi * freq * i / sr) + 0.3 * math.sin(4 * math.pi * freq * i / sr))
            s += 0.01 * (rnd.random() - 0.5)
            data += struct.pack("<h", int(max(-1, min(1, s)) * 32000 * 0.8))
        wf.writeframes(bytes(data))
    # loudnorm = normalización de volumen (EBU R128), igual que se recomienda para los audios finales
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", "-i", tmp, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11",
                    "-ar", "44100", "-ac", "1", "-codec:a", "libmp3lame", "-b:a", "96k", ruta], check=True)
    os.remove(tmp)

def main():
    with open(os.path.join(RAIZ, "estimulos.json"), encoding="utf-8") as f:
        datos = json.load(f)
    todos = datos["estimulos"] + datos.get("cierre", [])
    for k, e in enumerate(todos):
        ruta = os.path.join(RAIZ, e["archivo"])
        os.makedirs(os.path.dirname(ruta), exist_ok=True)
        if os.path.exists(ruta) and not FORZAR:
            print("existe, se omite:", e["archivo"]); continue
        if e["medio"] == "imagen": imagen(ruta, e["id"], k)
        else: audio(ruta, k)
        print("creado:", e["archivo"])
    prueba = os.path.join(RAIZ, "media", "prueba_sonido.mp3")
    if not os.path.exists(prueba) or FORZAR:
        audio(prueba, 999, dur=4, freq=440); print("creado: media/prueba_sonido.mp3")

if __name__ == "__main__":
    main()
