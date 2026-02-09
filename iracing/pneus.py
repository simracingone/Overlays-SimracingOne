def get_tire(ir, prefix):
    def clean_val(val, index=0):
        if isinstance(val, (list, tuple)):
            return val[index] if len(val) > index else val[0]
        return val if val is not None else 0

    # --- PNEUS ---
    t_L = clean_val(ir[f"{prefix}tempL"] or ir[f"{prefix}tempCL"] or 0)
    t_M = clean_val(ir[f"{prefix}tempM"] or ir[f"{prefix}tempCM"] or 0)
    t_R = clean_val(ir[f"{prefix}tempR"] or ir[f"{prefix}tempCR"] or 0)
    p_raw = clean_val(ir[f"{prefix}press"] or ir[f"{prefix}pressure"] or 0)
    w_raw = clean_val(ir[f"{prefix}wearM"] or 0)
    wear_final = int(w_raw * 100) if 0 < w_raw <= 1.0 else int(w_raw)

    # --- FREINS (LOGIQUE UNIFIÉE POUR TON JS) ---
    b_temp = clean_val(ir[f"{prefix}tempbrake"] or 0)
    b_line = clean_val(ir[f"{prefix}brakeLinePress"] or ir[f"{prefix}brakepress"] or 0)
    
    # Priorité à la température, sinon pression (Bar ou Pédale * 80)
    if b_temp > 20: 
        valeur_frein = b_temp
    else:
        valeur_frein = b_line if b_line > 0 else (clean_val(ir["Brake"] or 0) * 80)

    return {
        "temp_L": int(t_L),
        "temp_M": int(t_M),
        "temp_R": int(t_R),
        "press": round(p_raw * 0.000145038, 1) if p_raw > 0 else 28.5,
        "wear": wear_final,
        "brake": round(valeur_frein, 1)
    }

def calculer_pneus(ir, data):
    roues = ["LF", "RF", "LR", "RR"]
    data["tires"] = {nom: get_tire(ir, nom) for nom in roues}
    return data