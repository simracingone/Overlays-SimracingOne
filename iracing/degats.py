def calculer_degats(ir, data):
    if not ir.is_connected:
        return

    # Initialisation du dictionnaire de dégâts
    if "damage" not in data:
        data["damage"] = {
            "aero_front": 0,
            "aero_rear": 0,
            "engine_status": "OK",
            "repair_time": 0,
            "optional_repair": 0
        }

    # Récupération des temps de réparation (en secondes)
    # Required = Réparations obligatoires pour repartir (Drapeau noir/orange)
    # Optional = Réparations esthétiques ou performances non critiques
    req_repair = ir['PitSvRepair'] or 0
    opt_repair = ir['PitSvOptRepair'] or 0

    # Statut moteur (0 = OK, 1 = Warning, 2 = Critical)
    eng_warning = ir['EngineWarnings'] or 0
    
    status_map = {0: "OK", 1: "HOT", 2: "DANGER", 4: "STALL", 8: "PIT_LIMITER"}
    # On utilise un masque binaire simple pour le moteur
    motor_status = "OK"
    if eng_warning & 1: motor_status = "OVERHEAT"
    if eng_warning & 2: motor_status = "DAMAGE"

    data["damage"] = {
        "required_sec": round(req_repair, 1),
        "optional_sec": round(opt_repair, 1),
        "engine": motor_status,
        "is_damaged": req_repair > 0 or opt_repair > 0
    }

    # Affichage console pour test
    if data["damage"]["is_damaged"]:
        print(f"⚠️ DÉGÂTS DÉTECTÉS ! Réparation : {data['damage']['required_sec']}s (+ {data['damage']['optional_sec']}s)")