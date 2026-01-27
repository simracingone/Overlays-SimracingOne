import datetime

def calculer_session(ir, data):
    def get_val(key, default=0):
        try:
            val = ir[key]
            return default if val is None else val
        except:
            return default

    # --- 1. RÉCUPÉRATION ---
    session_num = get_val('SessionNum', 0)
    st = get_val('SessionState', 0)
    
    # --- 2. LOGIQUE DE TYPE ---
    try:
        raw_name = ir['SessionInfo']['Sessions'][session_num]['SessionType'].lower()
    except:
        raw_name = "practice"

    if "qualify" in raw_name or "qualy" in raw_name:
        type_final = "Qualify"
    elif "race" in raw_name:
        type_final = "Race"
    else:
        type_final = "Practice"

    # --- 3. REMPLISSAGE DU DICTIONNAIRE DATA ---
    # Ces clés doivent correspondre EXACTEMENT à ce que le JS attend
    data["sessionType"] = type_final 
    data["session_num"] = int(session_num) 
    data["session_time_remain"] = get_val('SessionTimeRemain', 0)
    
    
    
    
    
    # État du HUD (Pit Lane vs État iRacing)
    on_pit_road = get_val('OnPitRoad', False)
    sessions_map = {
        0:"Inconnu", 1:"Garage", 2:"Warmup", 3:"Grille", 
        4:"Race", 5:"Damier", 6:"Stands", 7:"Practice", 
        8:"Qualify", 9:"Pit Lane"
    }
    
    data["session"] = "Pit Lane" if on_pit_road else sessions_map.get(st, type_final)
    data["session_status"] = sessions_map.get(st, "Actif")

    # Temps restant
    raw_remain = get_val('SessionTimeRemain', 0)
    data["session_time_remain"] = raw_remain # Pour la logique de sécurité JS
    
    if raw_remain > 86400 or raw_remain <= 0:
        data["session_time_str"] = "--:--:--"
    else:
        m, s = divmod(int(raw_remain), 60)
        h, m = divmod(m, 60)
        data["session_time_str"] = f"{h:02d}:{m:02d}:{s:02d}"

    # Position et Laps
    data["pos"] = int(get_val('PlayerCarClassPosition', 0))
    data["pos_max"] = int(get_val('SessionNumEntries', 0))
    data["lap"] = int(get_val('Lap', 0))
    
    # Carburant
    fuel_now = get_val('FuelLevel', 0.0)
    fuel_max = get_val('FuelCapacity', 1.0)
    data["fuel"] = round(fuel_now, 1)
    data["fuel_pct"] = round((fuel_now / fuel_max) * 100, 1) if fuel_max > 0 else 0
    
    data["session_num"] = int(session_num)
    data["sessionType"] = type_final        
    return data