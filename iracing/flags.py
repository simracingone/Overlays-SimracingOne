import time
from dataclasses import dataclass

# =========================================================
# CONFIGURATION DES COULEURS TERMINAL (ANSI)
# =========================================================
class TermCol:
    GREEN  = '\033[92m'
    YELLOW = '\033[93m'
    RED    = '\033[91m'
    BLUE   = '\033[94m'
    PURPLE = '\033[95m'
    CYAN   = '\033[96m'
    WHITE  = '\033[97m'
    BLACK  = '\033[30;100m' # Texte noir sur fond gris
    RESET  = '\033[0m'
    BOLD   = '\033[1m'

COLOR_MAP = {
    "VERT": TermCol.GREEN,
    "JAUNE": TermCol.YELLOW,
    "ROUGE": TermCol.RED,
    "BLEU": TermCol.BLUE,
    "VIOLET": TermCol.PURPLE,
    "BLANC": TermCol.WHITE,
    "DAMIER": TermCol.BOLD + TermCol.WHITE,
    "ORANGE": TermCol.CYAN, # Utilisé pour différencier du jaune
    "NOIR": TermCol.BLACK,
    "GRAVIER": TermCol.YELLOW + TermCol.BOLD,
    "REPAIR": TermCol.RED + TermCol.BOLD
}

@dataclass
class FlagState:
    last_flag_sent: list[str] = None
    last_flag_time: float = 0.0
    last_printed_raw: int = -1 
    
    def __post_init__(self):
        if self.last_flag_sent is None:
            self.last_flag_sent = []

# =========================================================
# TABLES DE DÉCISION
# =========================================================

COMBINED_FLAG_MAP = {
    0x10140200: ["MEATBALL","QUALIFCASSE"],
    0x10040201: ["DAMIER"],
    0x10140020: ["BLEU", "MEATBALL"], # Remplacé ORANGE par MEATBALL 0X10050000
    0x10140000: ["MEATBALL"],
    0x10150000: ["MEATBALL"],
    0x10040020: ["BLEU"],
    0x10040002: ["BLANC","DERNIERTOUR"],# Dernier tour
    0x100c0200: ["NOIR", "NOIRCUT"], 
    0x10040004: ["VERT"],
    0x10140021: ["DAMIER", "MEATBALL"],
    0x100C0000: ["NOIR", "NOIRCUT"],   
    0x100C0004: ["NOIR", "VERT"],
    0x10000200: ["VERT"],
    0x80040204: ["STOPGO"],   # Si ce code est un stop & go, on envoie le nom précis
    0x10050000: ["NOIR", "NOIRCUTPIT"], 
    0x10050020: ["NOIR", "BLEU"],
    0x10040001: ["DAMIER"],
    0x100C0201: ["NOIR"],
    0x10040040: ["GRAVIER"],
    0x10140002: ["MEATBALL"],
    0X10050004: ["VERT", "NOIR"],
    0X10050200: ["NOIR","NOIR_SORTPITBAD"], # Mauvais esortie des PIT
    0X20040200: ["VERT"],  
    0X20040600: ["STAYREADY"],
    0X10050040: ["GRAVIER"],
    0X10150040: ["MEATBALL"],
    0X10140004: ["MEATBALL"],
}


FLAG_MASKS = {
    "ORANGE": 0x00000200, 
    "NOIR":   0x00000080,
    "JAUNE":  0x00001008,
    "BLEU":   0x00000020,
    "BLANC":  0x00000002,# Dernier tour
    "VERT":   0x00000004,
    "VIOLET": 0x10040200,
}

def compute_flags(ir, state: FlagState):
    now = time.time()
    session_flags = int(ir['SessionFlags'] or 0)
    player_idx = ir['PlayerCarIdx']
    player_flags = 0

    car_flags = ir['CarIdxSessionFlags']
    if car_flags and player_idx is not None and player_idx < len(car_flags):
        player_flags = int(car_flags[player_idx] or 0)

    combined = session_flags | player_flags
    
    # Contexte
    on_pit_road  = bool(ir['PlayerCarOnPitRoad'])
    in_pit_stall = bool(ir['PlayerCarInPitStall'])
    speed        = ir['Speed'] or 0
    lap          = ir['Lap'] or 0
    repair_left  = ir['PlayerCarRepairLeft'] or 0
    tow_time     = ir['PlayerCarTowTime'] or 0
    has_damage   = repair_left > 0 or tow_time > 0

    flags = []

    # 1. PRIORITÉ : COMBINED EXACT
    if combined in COMBINED_FLAG_MAP:
        flags = COMBINED_FLAG_MAP[combined]
        state.last_flag_time = now
    else:
        # 2. FALLBACK PAR BITMASK
        for name, mask in FLAG_MASKS.items():
            if combined & mask:
                if name == "ORANGE":
                    if not on_pit_road and not in_pit_stall:
                        flags.append("ORANGE")
                        state.last_flag_time = now
                    elif now - state.last_flag_time < 2:
                        flags.append("ORANGE")
                elif name == "VERT":
                    if not has_damage and speed > 0 and lap >= 0:
                        flags.append("VERT")
                        state.last_flag_time = now
                else:
                    flags.append(name)
                    state.last_flag_time = now

    # 3. MÉMOIRE (ANTI-CLIGNOTEMENT)
    if not flags and now - state.last_flag_time < 2:
        flags = state.last_flag_sent

    state.last_flag_sent = flags

    # 4. FILTRES FINAUX
    if combined in {0x10040200, 0x10000000, 0x80040004, 0x10040000}:  
        flags = []

    # 5. MOUCHARD TERMINAL COLORÉ
    if combined != state.last_printed_raw:
        timestamp = time.strftime("%H:%M:%S")
        hex_val = f"{TermCol.BOLD}{hex(combined).upper()}{TermCol.RESET}"
        
        if flags:
            colored_flags = []
            for f in flags:
                color = COLOR_MAP.get(f, TermCol.WHITE)
                colored_flags.append(f"{color}{f}{TermCol.RESET}")
            
            print(f"[{timestamp}] {hex_val} >> {' + '.join(colored_flags)}")
        else:
            print(f"[{timestamp}] {hex_val} >> {TermCol.GREEN}TRACK_CLEAR{TermCol.RESET}")
            
        state.last_printed_raw = combined
   
    return combined, flags