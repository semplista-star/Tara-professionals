# TARA · vídeo explicativo (~5 min, castellano y catalán)

Vídeo humanizado que cuenta qué es TARA a través de una historia: Laura, tutora
de 2.º de ESO, prepara una reunión difícil con una familia; Marta, madre, busca
un acuerdo con su hija. Todo está dibujado con código en el estilo de la marca
(sin bancos de imágenes ni fotos de menores). Los únicos recursos externos son
las fotos del equipo y la captura real de la web (`assets/`).

## Escenas

| # | Escena | Qué se ve |
|---|--------|-----------|
| 0 | Apertura | Logotipo y ondas |
| 1 | `manana` | Laura llega a la escuela (8:15) y piensa «¿Cómo empiezo?» |
| 2 | `reto` | El aula; vocación, conocimiento y protocolos + tiempo, estructura y apoyo; cifras del VIII Informe ANAR / F. Mutua Madrileña |
| 3 | `que_es` | Qué es TARA, los tres anillos, «no es una app más», cómo se integra en el centro |
| 4 | `demo` | Laura escribe en el espacio del profesorado; lo observado frente a lo interpretado; el andamio |
| 5 | `comunidad` | Ecosistema con el profesorado en el centro; Marta y su hija en casa |
| 6 | `niveles` | Los cinco niveles con las etiquetas de la Red 2027 y del curso 2027-28 |
| 7 | `proteccion` | La protección forma parte del diseño educativo |
| 8 | `pilotaje` | Red de Centros Colaboradores (hasta 20) y el equipo |
| 9 | `cierre` | Atardecer, la web real y el cartel final con la llamada a participar |

Los textos siguen la web aprobada (Documento único, 29-oct-2026). El guion está
en `script.json`; cada frase es una línea de subtítulo.

## Cómo se genera

```bash
export ELEVENLABS_API_KEY=...      # en los secretos del entorno, nunca en el código
./make.sh es                       # → out/TARA_que_es_es.mp4
./make.sh ca                       # → out/TARA_que_es_ca.mp4
```

1. `voice.py` genera la locución frase a frase con ElevenLabs, con la voz de los
   agentes de TARA (o `ELEVENLABS_VOICE_ID`), y escribe la línea de tiempo real.
   Castellano con `eleven_multilingual_v2`; catalán con `eleven_v3`.
2. `music.py` compone la banda sonora a la medida de esa línea de tiempo.
3. `render.py` dibuja los fotogramas (1920×1080, 30 fps) y los subtítulos.
4. `make.sh` mezcla voz y música (la música baja sola cuando hay voz).

Sin clave, `make.sh` hace un borrador con música, subtítulos y tiempos estimados.

Fotogramas sueltos para revisar: `python3 render.py stills es 10,60,120`.
Versión sin subtítulos incrustados: `python3 render.py video es --nosubs`.

Requisitos: `/usr/bin/python3` con pycairo, numpy, scipy y Pillow; ffmpeg.
