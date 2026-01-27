def calculer_performance(ir, data):
    if not ir.is_connected:
        return data

    # --- PÉDALES & GEAR ---
    data["throttle"] = float(ir['Throttle'] or 0.0)
    data["brake"]    = float(ir['Brake'] or 0.0)
    data["clutch"]   = float(ir['Clutch'] or 0.0)
    data["gear"]     = int(ir['Gear'] or 0)
    
    # --- VITESSE (Conversion KM/H à la source) ---
    data["speed"] = round((ir['Speed'] or 0) * 3.6)
    
    # --- RPM ---
    data["rpm"] = float(ir['RPM'] or 0.0)
    rpm_pct = ir['RPMPercentage']
    data["rpm_pct"] = float(rpm_pct) if rpm_pct is not None else (data["rpm"] / 7500)

    # --- DELTA (Calcul et Formatage) ---
    d_val = None
    # On teste les différentes sources de delta
    for key in ['LapDeltaToBestLap', 'LapDeltaToSessionBestLap', 'LapDeltaToOptimalLap']:
        try:
            v = ir[key]
            if v not in (None, 0.0):
                d_val = v
                break
        except:
            continue

    if d_val is not None:
        # Stockage de la valeur brute pour la jauge (utile pour le JS)
        data["delta_raw"] = float(d_val)
        
        # Formatage du texte à la source (0:00.00)
        sign = "+" if d_val >= 0 else "-"
        abs_v = abs(d_val)
        mins = int(abs_v // 60)
        secs = abs_v % 60
        
        if mins > 0:
            data["delta_format"] = f"{sign}{mins}:{secs:05.2f}" # Ex: +1:05.20
        else:
            data["delta_format"] = f"{sign}{secs:.2f}" # Ex: -0.45
    else:
        data["delta_raw"] = 0.0
        data["delta_format"] = "0.00"

    return data