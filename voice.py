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

# --- LES 12 VOIX / PERSONNAGES ---
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

voice_queue = queue.Queue()

def voice_worker():
    # Mixage Radio (8000Hz pour l'effet casque de course)
    try:
        pygame.mixer.pre_init(8000, -16, 1, 512)
        pygame.mixer.init()
    except Exception as e:
        print(f"Erreur Audio : {e}")
        return

    while True:
        data = voice_queue.get()
        if data is None: break

        text = data.get("text")
        v_idx = data.get("voice_index", 0)
        voice = VOICES.get(v_idx, VOICES[0])

        try:
            # 1. Génération de la voix avec BOOST de volume
            async def generate():
                # On force le volume au maximum (+100%)
                communicate = edge_tts.Communicate(text, voice, volume="+100%")
                await communicate.save(TEMP_AUDIO)
            
            # Lancement de la génération asynchrone
            asyncio.run(generate())

            if os.path.exists(TEMP_AUDIO):
                # 2. BIP RADIO (START)
                if os.path.exists(NOISE_START):
                    start_snd = pygame.mixer.Sound(NOISE_START)
                    pygame.mixer.Channel(0).play(start_snd)
                    time.sleep(0.15) 
                    pygame.mixer.Channel(0).stop()

                # 3. STATIQUE + VOIX
                if os.path.exists(NOISE_STATIC):
                    static_snd = pygame.mixer.Sound(NOISE_STATIC)
                    # On baisse la friture pour laisser la place à la voix
                    pygame.mixer.Channel(1).set_volume(0.05)
                    pygame.mixer.Channel(1).play(static_snd, loops=-1)

                voice_snd = pygame.mixer.Sound(TEMP_AUDIO)
                # Volume du canal au taquet (1.0)
                pygame.mixer.Channel(0).set_volume(1.0) 
                pygame.mixer.Channel(0).play(voice_snd)
                
                # Attente réelle de la fin du son
                while pygame.mixer.Channel(0).get_busy():
                    time.sleep(0.05)

                pygame.mixer.Channel(1).stop()
                
        except Exception as e:
            print(f"Erreur dans le worker : {e}")
        finally:
            voice_queue.task_done()

# Lancement du thread audio
threading.Thread(target=voice_worker, daemon=True).start()

# --- ROUTES API ---

@app.route("/speak", methods=["POST"])
def speak():
    data = request.json or {}
    text = data.get("text", "").strip()

    if not text:
        return jsonify({"status": "ignored", "reason": "empty text"})

    voice_queue.put({
        "text": text,
        "voice_index": int(data.get("voice_index", 0)),
        "time": time.time()
    })

    return jsonify({"status": "queued"})


@app.route("/status", methods=["GET"])
def get_status():
    """Vérifie si le canal de la radio est occupé"""
    try:
        is_playing = pygame.mixer.Channel(0).get_busy()
        return jsonify({"playing": is_playing})
    except:
        return jsonify({"playing": False})

@app.route("/")
def index():
    return send_from_directory(BASE_DIR, "beta_vocale.html")

if __name__ == "__main__":
    # Désactivation du reloader pour éviter de lancer 2 fois le mixer audio
    app.run(host="127.0.0.1", port=5000, debug=False, use_reloader=False)
