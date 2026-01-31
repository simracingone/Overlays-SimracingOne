import os
import math

# --- CONFIGURATION ---
SAVE_FOLDER = "assets/cars"

# --- UTILITAIRES ---

def debug_save_car_brands(drivers_info):
    """
    Enregistre le nom de la marque dans un fichier .txt nommé par l'ID.
    Utile pour identifier quelles images .png il te manque.
    """
    if not os.path.exists(SAVE_FOLDER):
        try:
            os.makedirs(SAVE_FOLDER)
        except:
            return

    for d in drivers_info:
        c_id = d.get('CarID')
        c_name = d.get('CarScreenName')
        
        if c_id is not None and c_name:
            # On utilise l'ID pour le nom du fichier (ex: 124.txt)
            file_path = os.path.join(SAVE_FOLDER, f"{c_id}.txt")
            if not os.path.exists(file_path):
                try:
                    with open(file_path, "w", encoding="utf-8") as f:
                        f.write(str(c_name))
                    print(f"📡 [LOG] Nouvelle voiture détectée : ID {c_id} -> {c_name}")
                except:
                    pass

def _format_time(seconds):
    """Formate les secondes en mm:ss.ms"""
    if seconds is None or seconds <= 0 or seconds > 3600: 
        return "--:--.---"
    mins = int(seconds // 60)
    secs = seconds % 60
    return f"{mins}:{secs:06.3f}"

# --- FONCTION PRINCIPALE ---

def classement(ir, data):
    # Initialisation propre
    data["Leaderboard"] = []
    data["Relative"] = []
    
    if not ir.is_connected:
        return data

    try:
        # 1. Récupération sécurisée des données du SDK
        # DriverInfo est déjà parsé en dictionnaire par pyirsdk
        d_info = ir['DriverInfo']
        drivers_list = d_info.get('Drivers', []) if d_info else []
        
        if not drivers_list:
            return data

        # Lancement du log des marques (à retirer quand tu auras tout)
        debug_save_car_brands(drivers_list)

        # Récupération des listes de télémétrie (protection si None)
        player_idx = ir['PlayerCarIdx'] if ir['PlayerCarIdx'] is not None else -1
        est_times = ir['CarIdxEstTime'] or [0.0]*64
        class_pos = ir['CarIdxClassPosition'] or [0]*64
        lap_dist = ir['CarIdxLapDistPct'] or [0.0]*64
        last_laps = ir['CarIdxLastLapTime'] or [0.0]*64
        best_laps = ir['CarIdxBestLapTime'] or [0.0]*64 # Récupère les records de tout le monde

        # ======================================================
        # INCIDENTS PILOTE (CORRECTION)
        # ======================================================
        # On récupère la valeur directe du SDK (Télémétrie dynamique)
        # PlayerCarDriverIncidentCount est la variable officielle
        val_incidents = ir['PlayerCarDriverIncidentCount']

        if val_incidents is not None:
            data["incidents"] = val_incidents
        else:
            # Si la variable n'existe pas (ex: Test Drive), on essaye via DriverInfo
            try:
                if 0 <= player_idx < len(drivers_list):
                    data["incidents"] = drivers_list[player_idx].get("Incidents", 0)
            except:
                data["incidents"] = 0

        #print(f"[PY] INCIDENTS ={data['incidents']}")

        # Position du joueur pour le calcul du relatif
        my_dist = lap_dist[player_idx] if (0 <= player_idx < len(lap_dist)) else 0
        
        all_drivers = []

        # 2. Construction de la liste des pilotes
        for d in drivers_list:
            idx = d.get('CarIdx')
            
            # Sécurités : index valide et exclusion du Pace Car
            if idx is None or idx < 0 or idx >= 64:
                continue
            if d.get('UserName') == "Pace Car":
                continue

            # Données de base
            car_id = d.get('CarID', 0)
            raw_pos = class_pos[idx] if idx < len(class_pos) else 0
            current_pos = int(raw_pos) if raw_pos > 0 else 999
            
            # Gain de places
            start_pos = (d.get('StartingPosition', 0) or 0) + 1
            gain = start_pos - current_pos if current_pos < 999 else 0

            # Distance relative (-0.5 à +0.5 pour le radar/relatif)
            d_dist = lap_dist[idx] if idx < len(lap_dist) else 0
            diff_dist = d_dist - my_dist
            if diff_dist < -0.5: diff_dist += 1.0
            if diff_dist > 0.5: diff_dist -= 1.0



            # Ajout au dictionnaire
            all_drivers.append({
                "CarIdx": idx,
                "CarID": car_id,                 # <--- ID envoyé à ton JS pour l'image
                "Position": current_pos,
                "Gain": gain,
                "UserName": d.get('UserName', '---'),
                "CarName": d.get('CarScreenName', '---'), # Ajoute cette ligne
                "CarNumber": d.get('CarNumber', '0'),
                "IR_Display": f"{d.get('IRating', 0)/1000:.1f}k" if (d.get('IRating', 0) or 0) > 0 else "IA",
                "LicString": d.get('LicString', 'R 0.00'),
                "BestLapTime_raw": best_laps[idx], 
                "IsPlayer": (idx == player_idx),
                "CarClassID": d.get('CarClassID', 0),
                "CarClassShortName": d.get('CarClassShortName', '---'),
                "TimeVal": est_times[idx] if idx < len(est_times) else 0,
                "RelativeDiff": diff_dist,
                "GapRelat": f"{diff_dist * 100:+.1f}s",
                "LastLapTime": _format_time(last_laps[idx]) if idx < len(last_laps) else "--:--.---",
                "LastLapTime_raw": last_laps[idx],  
                "Gap": "---",
                "GapInt": "---"
            })

        if not all_drivers:
            return data

        # 3. Calcul des Gaps (Leaderboard)
        # Tri par classe puis par position
        all_drivers.sort(key=lambda x: (x["CarClassID"], x["Position"]))
        
        leaders_time = {} # Dico pour stocker le temps du premier de chaque classe
        for i, p in enumerate(all_drivers):
            c_id = p["CarClassID"]
            t_val = p["TimeVal"] or 0
            
            # Gap au leader de classe
            if p["Position"] == 1:
                p["Gap"] = "LDR"
                leaders_time[c_id] = t_val
            elif c_id in leaders_time and t_val > 0:
                gap_leader = t_val - leaders_time[c_id]
                p["Gap"] = f"+{max(0, gap_leader):.1f}s"
            
            # Gap à la voiture de devant (Intervalle)
            if i > 0 and all_drivers[i-1]["CarClassID"] == c_id:
                prev_t = all_drivers[i-1]["TimeVal"] or 0
                gap_int = t_val - prev_t
                p["GapInt"] = f"+{max(0, gap_int):.1f}s"

        # 4. Finalisation des données de sortie
        # Leaderboard trié par position brute
        data["Leaderboard"] = sorted(all_drivers, key=lambda x: x["Position"])
        
        # Relatif (centré sur le joueur)
        rel_sorted = sorted(all_drivers, key=lambda x: x["RelativeDiff"], reverse=True)
        try:
            m_idx = next(i for i, p in enumerate(rel_sorted) if p["IsPlayer"])
            data["Relative"] = rel_sorted[max(0, m_idx-3) : min(len(rel_sorted), m_idx+4)]
        except StopIteration:
            data["Relative"] = rel_sorted[:7]

    except Exception as e:
        # En cas d'erreur, on affiche mais on ne crash pas l'overlay
        print(f"⚠️ Erreur Classement : {e}")
    
    return data