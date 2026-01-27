import math
import time 

_last_print_meteo = 0

def calculer_meteo(ir, data):
    global _last_print_meteo
    
    if not ir.is_connected:
        return data

    try:
        # --- 1. LECTURE DES CAPTEURS (SDK BRUT) ---
        ir_precip = float(ir['Precipitation'] or 0.0)
        ir_wetness_prop = float(ir['TrackWetnessProp'] or 0.0)
        ir_wetness_index = ir['TrackWetness'] or 0
        ir_track_temp = float(ir['TrackTemp'] or 0.0)
        
        ir_wind_speed = float(ir['WindSpeed'] or ir['WindVel'] or 0.0)
        ir_wind_dir = float(ir['WindDir'] or 0.0)

        # --- 2. LOGIQUE DE SECOURS VENT ---
        if ir_wind_speed == 0:
            try:
                meteo_yaml = ir['SessionInfo']['Sessions'][0]['SessionEnviroment']['WindSpeed']
                if "mph" in meteo_yaml.lower():
                    ir_wind_speed = float(meteo_yaml.split()[0]) / 2.237
                elif "km/h" in meteo_yaml.lower():
                    ir_wind_speed = float(meteo_yaml.split()[0]) / 3.6
            except:
                pass

        # --- 3. MISE À JOUR DES DONNÉES STANDARD ---
        data["air_temp"] = round(float(ir['AirTemp'] or 0.0), 1)
        data["track_temp"] = round(ir_track_temp, 1)
        data["humidity_pct"] = int(round(float(ir['RelativeHumidity'] or 0.0) * 100))
        data["wind_vel"] = round(ir_wind_speed * 3.6, 1)
        data["wind_dir"] = int(math.degrees(ir_wind_dir)) % 360
        
        data["rain_intensity_pct"] = 0 if ir_precip < 0.001 else min(int(round(ir_precip * 100)), 100)
        
        # --- 4. LOGIQUE "EAU AU SOL" ANTI-BUG ---
        pct_physique = int(round(ir_wetness_prop * 100))
        
        if ir_wetness_index >= 5:    
            data["track_wetness_pct"] = max(pct_physique, 85)
        elif ir_wetness_index >= 3:  
            data["track_wetness_pct"] = max(pct_physique, 45)
        elif ir_wetness_index >= 2:  
            data["track_wetness_pct"] = max(pct_physique, 15)
        elif ir_wetness_index == 1:  
            data["track_wetness_pct"] = max(pct_physique, 5)
        else:
            data["track_wetness_pct"] = pct_physique

        # --- 5. MONITORING TERMINAL (DÉSACTIVÉ) ---
        now = time.time()
        if now - _last_print_meteo > 5:
            # print("\n" + "📊 [MÉTÉO SYNC OK]".center(50, "="))
            # print(f"🌡️  PISTE : {data['track_temp']}°C | 🌬️  VENT : {data['wind_vel']} km/h")
            # print(f"☁️  PLUIE (Ciel) : {data['rain_intensity_pct']}%")
            # print(f"🌊 EAU (Sol)    : {data['track_wetness_pct']}% (SDK Index: {ir_wetness_index})")
            
            # Diagnostic
            status = "✅ SEC"
            if data["rain_intensity_pct"] > 0: status = "🌧️  PLUIE EN COURS"
            elif data["track_wetness_pct"] > 10: status = "🌥️  PISTE HUMIDE"
            
            # print(f"📢 STATUS : {status}")
            # print("=" * 50)
            _last_print_meteo = now

    except Exception as e:
        print(f"⚠️ Erreur Module Meteo : {e}")

    return data