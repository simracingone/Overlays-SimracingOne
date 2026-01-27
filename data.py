import time
import irsdk
from iracing.flags import FlagState, compute_flags
from iracing.meteo import calculer_meteo
from iracing.voiture import calculer_voiture
from iracing.performance import calculer_performance
from iracing.session import calculer_session
from iracing.pneus import calculer_pneus
from iracing.classement import classement

ir = irsdk.IRSDK()
flag_state = FlagState()
last_session_id = -1
last_session_time = -1

def get_all_data():
    global last_session_id, last_session_time, ir
    
    # 1. INITIALISATION DU DICTIONNAIRE AVEC LES DEUX VALEURS
    data = {
        "server": "OK",
        "IsConnected": False,
        "needs_reset": False,
        # Variables Météo
        "air_temp": 0.0,
        "track_temp": 0.0,
        "humidity_pct": 0,
        "rain_intensity_pct": 0,  # <--- Ce qui tombe du ciel
        "track_wetness_pct": 0,   # <--- Ce qui est au sol
        # Autres
        "session": "Déconnecté",
        "tires": {},
        "fuel": 0.0,
        "delta": 0.0,
        "Leaderboard": [],
        "Relative": []
    }

    if not ir.is_connected:
        if not ir.startup():
            last_session_id = -1
            return data

    if not ir['DriverInfo']:
        return data

    data["IsConnected"] = True

    try:
        ir.freeze_var_buffer_latest()
        curr_id = ir['SessionNum']
        curr_time = ir['SessionTime']

        # Détection changement ou restart
        if (curr_id != last_session_id or curr_time < last_session_time) and last_session_id != -1:
            ir.shutdown()
            ir = irsdk.IRSDK()
            ir.startup()
            last_session_id = curr_id
            last_session_time = curr_time
            data["needs_reset"] = True
            return data

        last_session_id = curr_id
        last_session_time = curr_time

        # Appels des modules (On récupère bien le retour data)
        data = classement(ir, data)
        data = calculer_pneus(ir, data)
        data = calculer_performance(ir, data)
        data = calculer_meteo(ir, data) 
        data = calculer_voiture(ir, data)
        data = calculer_session(ir, data)

        combined, flags = compute_flags(ir, flag_state)
        data["combined"] = combined
        data["flag"] = flags

    except Exception as e:
        print(f"⚠️ Erreur Data: {e}")

    return data