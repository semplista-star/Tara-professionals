#!/usr/bin/env bash
# Vídeo explicativo de TARA, de principio a fin.
#   ./make.sh es        → out/TARA_que_es_es.mp4
#   ./make.sh ca        → out/TARA_que_es_ca.mp4
# Con ELEVENLABS_API_KEY en el entorno, genera la locución y ajusta todo a ella.
# Sin la clave, hace un borrador con subtítulos y música (tiempos estimados).
set -euo pipefail
cd "$(dirname "$0")"
LANG_="${1:-es}"
PY=/usr/bin/python3

# Fuentes de la marca (Fraunces, DM Sans, DM Mono) para cairo
mkdir -p ~/.fonts && cp -n fonts/*.ttf ~/.fonts/ 2>/dev/null || true
fc-cache -f >/dev/null 2>&1 || true

if [ -n "${ELEVENLABS_API_KEY:-}" ]; then
  $PY voice.py "$LANG_"
fi
$PY timeline.py "$LANG_"
$PY music.py "$LANG_"
$PY render.py video "$LANG_"

OUT="out/TARA_que_es_${LANG_}.mp4"
if [ -f "out/voice_${LANG_}.wav" ] && [ -f "out/timeline_${LANG_}.json" ]; then
  # voz al frente; la música baja sola cuando habla (sidechain)
  ffmpeg -y -loglevel error -i "out/video_${LANG_}_noaudio.mp4" -i "out/music_${LANG_}.wav" -i "out/voice_${LANG_}.wav" \
    -filter_complex "[2:a]aformat=channel_layouts=stereo,asplit=2[v][sc];[1:a]volume=0.55[m];[m][sc]sidechaincompress=threshold=0.02:ratio=8:attack=40:release=600[md];[md][v]amix=inputs=2:normalize=0,loudnorm=I=-16:TP=-1.5:LRA=11[a]" \
    -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart "$OUT"
else
  ffmpeg -y -loglevel error -i "out/video_${LANG_}_noaudio.mp4" -i "out/music_${LANG_}.wav" \
    -filter_complex "[1:a]loudnorm=I=-18:TP=-1.5[a]" -map 0:v -map "[a]" -c:v copy -c:a aac -b:a 192k -movflags +faststart "${OUT%.mp4}_borrador_sin_voz.mp4"
  OUT="${OUT%.mp4}_borrador_sin_voz.mp4"
fi
echo "listo: $OUT"
