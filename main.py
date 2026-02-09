import asyncio
import os
import mimetypes
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from data import get_all_data
from starlette.websockets import WebSocketState

# FORCE LE NAVIGATEUR A RECONNAITRE LE CSS ET LE JS SOUS WINDOWS
mimetypes.add_type('text/css', '.css')
mimetypes.add_type('application/javascript', '.js')

app = FastAPI()

# CONFIGURATION DES PERMISSIONS (CORS)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# GESTION DU FLUX DE DONNEES (WEBSOCKET)
@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            data = get_all_data()
            if data and ws.client_state == WebSocketState.CONNECTED:
                await ws.send_json(data)
            await asyncio.sleep(0.1)
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        if ws.client_state != WebSocketState.DISCONNECTED:
            try:
                await ws.close()
            except:
                pass

# CONFIGURATION DES FICHIERS STATIQUES (L'AFFICHAGE DU HUD)
# On récupère le dossier où se trouve ce fichier main.py
current_dir = os.path.dirname(os.path.realpath(__file__))


@app.get("/data")
async def read_data():
    return get_all_data()
    
    
# On monte le dossier racine. 
# 'html=True' permet de charger index.html automatiquement sur http://127.0.0.1:8000
app.mount("/", StaticFiles(directory=current_dir, html=True), name="static")