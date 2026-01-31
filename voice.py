import os
import asyncio
import edge_tts
import pygame
import threading
import queue
import time
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMP_AUDIO = os.path.join(BASE_DIR, "voice_temp.mp3")

# Assets radio
NOISE_STATIC = os.path.join(BASE_DIR, "assets", "mp3", "radio-static.mp3")
NOISE_START = os.path.join(BASE_DIR, "assets", "mp3", "radio-static-2.mp3")

# --- VOIX ---
VOICES = {
    0: "fr-FR-DeniseNeural",
    1: "fr-FR-HenriNeural",
    2: "fr-CA-AntoineNeural",
    3: "fr-FR-VivienneMultilingualNeural",
    4: "fr-BE-GerardNeural",
    5: "fr-CH-ArianeNeural",
    6: "fr-FR-RemyMultilingualNeural",
    7: "fr-FR-EloiseNeural",
    8: "fr-BE-CharlineNeural",
    9: "fr-CA-SylvieNeural",
    10: "fr-CA-ThierryNeural",
    11: "fr-CH-FabriceNeural"
}

# Queue audio
voice_queue = queue.Queue()

# --- ANTI-DOUBLON ---
last_spoken = {}          # id -> timestamp
COOLDOWN_SECONDS = 3.0    # délai minimum entre deux mêmes alertes


def voice_worker():
    try:
        pygame.mixer.pre_init(8000, -16, 1, 512)
        pygame.mixer.init()
    except Exception as e:
        print(f"[AUDIO] Erreur init mixer : {e}")
        return

    while True:
        data = voice_queue.get()
        if data is None:
            break

        text = data.get("text")
        v_idx = data.get("voice_index", 0)
        voice = VOICES.get(v_idx, VOICES[0])

        try:
            async def generate():
                communicate = edge_tts.Communicate(
                    text=text,
                    voice=voice,
                    volume="+100%"
                )
                await communicate.save(TEMP_AUDIO)

            asyncio.run(generate())

            if os.path.exists(TEMP_AUDIO):

                # Bip radio start
                if os.path.exists(NOISE_START):
                    start_snd = pygame.mixer.Sound(NOISE_START)
                    pygame.mixer.Channel(0).play(start_snd)
                    time.sleep(0.15)
                    pygame.mixer.Channel(0).stop()

                # Friture radio
                if os.path.exists(NOISE_STATIC):
                    static_snd = pygame.mixer.Sound(NOISE_STATIC)
                    pygame.mixer.Channel(1).set_volume(0.05)
                    pygame.mixer.Channel(1).play(static_snd, loops=-1)

                # Voix
                voice_snd = pygame.mixer.Sound(TEMP_AUDIO)
                pygame.mixer.Channel(0).set_volume(1.0)
                pygame.mixer.Channel(0).play(voice_snd)

                while pygame.mixer.Channel(0).get_busy():
                    time.sleep(0.05)

                pygame.mixer.Channel(1).stop()

        except Exception as e:
            print(f"[AUDIO] Erreur worker : {e}")

        finally:
            voice_queue.task_done()


# Thread audio
threading.Thread(target=voice_worker, daemon=True).start()


# --- API ---

@app.route("/speak", methods=["POST"])
def speak():
    data = request.json or {}

    text = data.get("text", "").strip()
    if not text:
        return jsonify({"status": "ignored", "reason": "empty text"})

    alert_id = data.get("id")
    now = time.time()

    # --- COOLDOWN PAR ID ---
    if alert_id:
        last = last_spoken.get(alert_id, 0)
        if now - last < COOLDOWN_SECONDS:
            return jsonify({
                "status": "ignored",
                "reason": "cooldown",
                "id": alert_id
            })
        last_spoken[alert_id] = now

    voice_queue.put({
        "id": alert_id,
        "text": text,
        "voice_index": int(data.get("voice_index", 0)),
        "time": now
    })

    return jsonify({"status": "queued"})


@app.route("/status", methods=["GET"])
def get_status():
    try:
        return jsonify({
            "playing": pygame.mixer.Channel(0).get_busy()
        })
    except:
        return jsonify({"playing": False})


@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "beta_vocale.html")


if __name__ == "__main__":
    app.run(
        host="127.0.0.1",
        port=5000,
        debug=False,
        use_reloader=False
    )
