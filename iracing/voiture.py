from collections import deque
import time

_last_lap = None
_fuel_at_start_of_lap = None
_fuel_history = deque(maxlen=5)
_last_conso = 0.0
_last_print_time = 0  # Pour contrôler la fréquence du print

def calculer_voiture(ir, data):
    global _last_lap, _fuel_at_start_of_lap, _fuel_history, _last_conso, _last_print_time

    if not ir.is_connected:
        return data

    try:
        fuel_actuel = float(ir['FuelLevel'] or 0.0)
        fuel_cap = float(ir['FuelCapacity'] or 50.0)
        lap_termine = int(ir['LapCompleted'] or 0)

        if _last_lap is None:
            _last_lap = lap_termine
            _fuel_at_start_of_lap = fuel_actuel

        if lap_termine > _last_lap:
            conso_tour = _fuel_at_start_of_lap - fuel_actuel
            _last_conso = conso_tour
            _fuel_history.append(conso_tour)
            _fuel_at_start_of_lap = fuel_actuel
            _last_lap = lap_termine

        moyenne = sum(_fuel_history) / len(_fuel_history) if _fuel_history else 0.0
        tours_possibles = fuel_actuel / moyenne if moyenne > 0 else 0.0
        fuel_pct = fuel_actuel / fuel_cap if fuel_cap > 0 else 0.0

        # Injection des données
        data["fuel"] = round(fuel_actuel, 2)
        data["fuel_pct"] = round(fuel_pct, 3)
        data["fuel_per_lap"] = round(moyenne, 3)
        data["fuel_laps_est"] = round(tours_possibles, 1)
        data["fuel_last_lap"] = round(_last_conso, 3)
        
        data["water_temp"] = float(ir['WaterTemp'] or 0.0)
        data["oil_temp"] = float(ir['OilTemp'] or 0.0)
        data["voltage"] = float(ir['Voltage'] or 0.0)


    except Exception as e:
        print(f"⚠️ ERREUR VOITURE: {e}")


# --- ROUTE DE PRINT (Toutes les 5 secondes) ---
        temps_actuel = time.time()
        if temps_actuel - _dernier_print > 5:
            print("\n" + "="*30)
            print(f"📊 DEBUG TELEMETRIE ({time.strftime('%H:%M:%S')})")
            print(f"⛽ Essence : {data['fuel']} L ({data['fuel_pct']*100:.1f}%)")
            print(f"🌡️  Eau     : {data['water_temp']} °C")
            print(f"🛢️  Huile   : {data['oil_temp']} °C")
            print(f"⚡ Voltage : {data['voltage']} V")
            print(f"🏁 Conso/T : {data['fuel_last_lap']} L/tour")
            print("="*30)
            _dernier_print = temps_actuel


    return data