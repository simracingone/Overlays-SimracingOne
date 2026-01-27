def calculer_etat(ir, data, is_sim_running, is_ui_running):
    # 1. DONNÉES (box-server)
    if hasattr(ir, 'is_connected') and ir.is_connected:
        data["server"] = "OK"
    else:
        data["server"] = "Signal coupé"

    # 2. iRACING (box-game)
    if is_sim_running:
        data["game"] = "Simulateur actif"
    elif is_ui_running:
        data["game"] = "Menu UI"
    else:
        data["game"] = "Hors ligne"  # Message explicite

    # 3. SESSION (box-session)
    if hasattr(ir, 'is_connected') and ir.is_connected:
        try:
            st = ir.get('SessionState', 0)
            states = {
                1: "Garage",
                2: "Practice",
                3: "Qualify",
                4: "Race",
                5: "Terminé",
                7: "Practice",  # Ajout d'un état "Practice"
                8: "Qualif",    # Ajout d'un état "Qualif"
                9: "Pit Lane",  # Ajout d'un état "Pit Lane"
            }
            data["session"] = states.get(st, "En piste")
        except Exception:
            data["session"] = "Erreur de session"
    else:
        data["session"] = "Aucune session"  # Message explicite
