// Version 3.2.4
const API_URL = "http://127.0.0.1:8000"; 
const VOICE_URL = "http://127.0.0.1:5000";

async function fetchData() {
    try {
        const response = await fetch(`${API_URL}/data`); 
        const data = await response.json();
        hudClassement(data);
        hudPiste(data);
    } catch (error) {
        console.error("Erreur de connexion à l'API iRacing:", error);
    }
}

  
/* ==========================================================================
   GESTION PERFORMANCE
   ========================================================================== */ 
   
// On déclare l'objet globalement, mais vide
let ÉLÉMENTS_HUD = {};

function initialiserElements() {
    // On remplit l'objet une fois que le DOM est prêt
    ÉLÉMENTS_HUD = {
        vitesse: document.getElementById("perf-vitesse"),
        gear: document.getElementById("perf-gear"),
        rpmBar: document.getElementById("perf-rpm-bar"),
        deltaVal: document.getElementById("perf-delta-val"),
        deltaBar: document.getElementById("perf-delta-bar"),
        throttle: document.getElementById("input-throttle"),
        brake: document.getElementById("input-brake"),
		clutch: document.getElementById("input-clutch") // Changez "input-clutch" par "perf-clutch"
    };
}

/* ==========================================================================
   1. CONFIGURATION & ÉTAT GLOBAL
   ========================================================================== */
const CONFIG_TEAM = {
    "0": { "departement": "Piste", "nom": "Denise Martin", "image": "Denise.png" },
    "1": { "departement": "Météo", "nom": "Henri Dubois", "image": "Henri.png" },
    "2": { "departement": "Voiture", "nom": "Antoine Roux", "image": "Antoine.png" },
    "3": { "departement": "Drapeaux", "nom": "Vivienne Martin", "image": "Vivienne.png" },
    "4": { "departement": "Performance", "nom": "Gerard Petit", "image": "Gerard.png" },
    "5": { "departement": "Classement", "nom": "Ariane Lambert", "image": "Ariane.png" },
    "6": { "departement": "Relatifs", "nom": "Remy Fontaine", "image": "Remy.png" },
    "7": { "departement": "Physio", "nom": "Eloise Morel", "image": "Eloise.png" },
    "8": { "departement": "Stratégie", "nom": "Charline Durand", "image": "Charline.png" },
    "9": { "departement": "Mental", "nom": "Sylvie Vasseur", "image": "Sylvie.png" },
    "10": { "departement": "Spotter", "nom": "Thierry Lefebvre", "image": "Thierry.png" },
    "11": { "departement": "Carburant", "nom": "Fabrice Dubois", "image": "Fabrice.png" }
};

let socket = null;
let lastDataReceived = null;
let lastSessionID = null;

// Timers pour la boucle de rendu
let timers = { moyen: 0, lent: 0, classement: 0 };


let lastTresLent = 0;
let radioQueue = [];
let isRadioTalking = false;

let dernierFlagVocal = null;
// Ajoute cette variable en haut de ton fichier (ou juste avant la fonction)
let timerResetVocal = null;

let derniereSessionAnnoncee = "";
let alertePrioritaire = null;
let usureMini = 100;

// On initialise cette variable en dehors de la boucle principale
let info_meteo_annonce = null; 
	
	
let Tactique = { sessionNum: 0, sessionType: "Practice" };
let MemoireMeteo = { briefingOk: false, pisteTemp: null, pluie: 0, vent: 0, mouille: 0, derniereSession: null };
let MemoireRelatif = { lastTimeAnalyse: 0, lastTimeConseille: 0 };
let MemoireClassement = { posPrecedente: null, meilleurTourClasse: {} };
let MemoireVocale = { derniereAlerte: "", dernierTemps: 0, delaiMin: 2000 };

// je force le rafraicchissement animation navigater pour rester a 60 pas plus !! 
let lastFrameTime = 0;
const fpsLimit = 60;

const RAF = { RAPIDE: 16, MOYEN: 200, TRES_LENT: 1000 };



//Initialisation des mémoires Classement en course
if (!window.MemoireTactique) window.MemoireTactique = {};
if (!window.MemoireClassement) window.MemoireClassement = { posPrecedente: null, meilleurTourClasse: {} };


/* ==========================================================================
   2. BOUCLE PRINCIPALE & WEBSOCKET
   ========================================================================== */
function fermerOverlay() {
    window.overlayState.quit();
}


function connecter() {
    socket = new WebSocket('ws://127.0.0.1:8000/ws');

    socket.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data);
            if (!data) return;



			// ===== NORMALISATION DRAPEAUX =====
			if (data.flags && !data.flag) {
				data.flag = data.flags;
			}

			if (typeof data.flag === "string") {
				data.flag = [data.flag];
			}

			// Optionnel : sécurisation
			if (!Array.isArray(data.flag)) {
				data.flag = [];
			}
			
			 //console.log("FLAGS NORMALISÉS :", data.flag);
			
			// ==================================




            // --- SYNCHRO ÉTAT SESSION ---
            Tactique.sessionNum = data.session_num;
            Tactique.sessionType = data.sessionType || "Race";

            // --- DÉTECTION CHANGEMENT DE SESSION ---
            let currentID = data.SessionID ?? data.session_num ?? 0; // On essaie SessionID, sinon session_num, sinon 0
            
            if (lastSessionID !== null && currentID !== lastSessionID) {
                console.log("♻️ Changement de session ! ID précédent:", lastSessionID, "-> Nouveau:", currentID);
                resetCompletHUD();
                
                // RESET MÉMOIRE VOCALE (Important pour relancer les briefings)
                MemoireMeteo.briefingOk = false;
                if (window.MemoireTactique) {
                    window.MemoireTactique.tourMessage = 0;
                    window.MemoireTactique.etatDelta = 0;
                }
            }
            lastSessionID = currentID;

            // Sécurité reset forcé
            if (data.needs_reset === true) {
                resetCompletHUD();
            }

            lastDataReceived = data;
        } catch (e) { 
            console.error("Erreur WS:", e); 
        }
    };

    socket.onclose = () => { 
        console.warn("🔌 Socket fermé. Reconnexion...");
        setTimeout(connecter, 2000); 
    };
}




function updateLoop(timestamp) {
    requestAnimationFrame(updateLoop);
    if (!lastDataReceived) return;

	
    const interval = 1000 / fpsLimit;// Calcul de l'intervalle nécessaire en millisecondes (1000ms / 60fps = 16.67ms)
    const delta = timestamp - lastFrameTime;	// Si le temps écoulé depuis la dernière image est inférieur à l'intervalle, on sort
    if (delta < interval) return;

    lastFrameTime = timestamp - (delta % interval);	// On ajuste lastFrameTime en soustrayant le surplus (pour rester précis)
	if (!lastDataReceived) return;

    // --- RAPIDE (60 FPS) ---
    hudPerformance(lastDataReceived);

    // --- MOYEN (200ms) : Relatif, Drapeaux, Pneus ---
    if (timestamp - timers.moyen >= 200) {
        hudDrapeaux(lastDataReceived);
        hudPneusDetail(lastDataReceived);
        hudRelatif(lastDataReceived);
        timers.moyen = timestamp;
    }

    // --- LENT (1s) : Météo, Piste, Stratégie ---
    if (timestamp - timers.lent >= 1000) {
        hudMeteo(lastDataReceived);
        hudPiste(lastDataReceived);
        /*surveillerPerformancePractice(lastDataReceived);*/
        timers.lent = timestamp;
    }

    // --- TRÈS LENT (5s) : CLASSEMENT (Optimisation CPU) ---
    if (timestamp - timers.classement >= 5000) {
        hudClassement(lastDataReceived);
        timers.classement = timestamp;
    }
}


// Lancement unique au chargement du DOM
document.addEventListener('DOMContentLoaded', () => {
    applyVisibility();
    connecter();
    requestAnimationFrame(updateLoop);
});

// Écouteur pour l'admin (Visibilité des modules)
window.addEventListener('storage', applyVisibility);


function hudPneusDetail(donnees) {
    if (!donnees || !donnees.tires) return;

    const mapping = { "LF": "fl", "RF": "fr", "LR": "rl", "RR": "rr" };
    
    Object.entries(mapping).forEach(([pyKey, htmlPrefix]) => {
        const pneu = donnees.tires[pyKey];
        if (!pneu) return;

        // --- 1. FREINS (BAR / TEMP) ---
        const brakeVal = parseFloat(pneu.brake || 0);
        let brakeLabel = " bar";
        let brakePct = 0;
        let isDegres = brakeVal > 120;

        if (isDegres) {
            brakeLabel = "°";
            brakePct = Math.min(100, (brakeVal / 900) * 100);
        } else {
            brakeLabel = " bar";
            brakePct = Math.min(100, (brakeVal / 80) * 100);
        }

        const elBrakeTxt = document.getElementById(`${htmlPrefix}-temp-brake`);
        if (elBrakeTxt) {
            elBrakeTxt.textContent = Math.round(brakeVal) + brakeLabel;
            const alerte = (isDegres && brakeVal > 800) || (!isDegres && brakeVal > 70);
            elBrakeTxt.style.color = alerte ? "#ff4757" : "#ffffff";
        }

        const elBrakeBar = document.getElementById(`${htmlPrefix}-brake-bar`);
        if (elBrakeBar) {
            elBrakeBar.style.height = brakePct + "%";
            if (brakePct > 85) elBrakeBar.style.backgroundColor = "#ff4757";
            else if (brakePct > 50) elBrakeBar.style.backgroundColor = "#ffa502";
            else elBrakeBar.style.backgroundColor = "#2ed573";
        }

        // --- 2. PRESSION ET USURE ---
        const psiVal = parseFloat(pneu.press || 0);
        if (document.getElementById(`${htmlPrefix}-pres`)) 
            document.getElementById(`${htmlPrefix}-pres`).textContent = psiVal.toFixed(1);
        
        if (document.getElementById(`${htmlPrefix}-psi-bar`)) 
            document.getElementById(`${htmlPrefix}-psi-bar`).style.height = Math.min(100, (psiVal / 40) * 100) + "%";

        const usureVal = Math.max(0, Math.min(100, pneu.wear || 0));
        if (document.getElementById(`${htmlPrefix}-wear-val`)) 
            document.getElementById(`${htmlPrefix}-wear-val`).textContent = Math.round(usureVal) + "%";
        
        if (document.getElementById(`${htmlPrefix}-wear-bar`)) 
            document.getElementById(`${htmlPrefix}-wear-bar`).style.height = usureVal + "%";

        // --- 3. TEMPÉRATURES IMO ET CORE ---
        const isLeftSide = (pyKey === "LF" || pyKey === "LR");
        const innerVal  = isLeftSide ? pneu.temp_R : pneu.temp_L;
        const outerVal  = isLeftSide ? pneu.temp_L : pneu.temp_R;
        const middleVal = pneu.temp_M; // C'est notre valeur "Core"

        // AFFICHAGE DE LA TEMPÉRATURE GLOBALE (Celle qui te manque)
        const elCore = document.getElementById(`${htmlPrefix}-temp-core`);
        if (elCore) {
            elCore.textContent = Math.round(middleVal) + "°";
        }

        // Mise à jour des couleurs des zones du pneu
        updateZoneColor(`${htmlPrefix}-zone-i`, innerVal);
        updateZoneColor(`${htmlPrefix}-zone-m`, middleVal);
        updateZoneColor(`${htmlPrefix}-zone-o`, outerVal);

        // Texte IMO (ex: 61|59|56)
        const elImo = document.getElementById(`${htmlPrefix}-temp-imo`);
        if (elImo) elImo.textContent = `${Math.round(innerVal)}|${Math.round(middleVal)}|${Math.round(outerVal)}`;
    });
}
/**
 * Met à jour la couleur de fond des zones du pneu selon la température
 */
function updateZoneColor(id, temp) {
    const el = document.getElementById(id);
    if (!el) return;
    
    let color = "rgba(255,255,255,0.05)"; // Couleur neutre si éteint
    
    if (temp > 10) {
        if (temp < 60) color = "#3498db";      // Bleu (Trop froid)
        else if (temp < 95) color = "#2ed573"; // Vert (Température de travail)
        else if (temp < 105) color = "#ffa502"; // Orange (Surchauffe légère)
        else color = "#ff4757";                // Rouge (Critique)
    }
    
    el.style.backgroundColor = color;
}

// Gère les barres de progression verticales et leurs couleurs
function updateBar(id, pourcent, type) {
    const el = document.getElementById(id);
    if (!el) return;
    
    const p = Math.max(0, Math.min(100, pourcent));
    el.style.height = p + "%";

    // Couleur spécifique pour les freins selon la chauffe
    if (type === "frein") {
        if (p > 85) el.style.backgroundColor = "#ff4757";
        else if (p > 60) el.style.backgroundColor = "#ffa502";
        else el.style.backgroundColor = "#2ed573";
    }
}


function rafRapide(d) {
    if (typeof hudPerformance === "function") hudPerformance(d);
}


function rafMoyen(d) {
	if (typeof hudVehicule === "function") hudVehicule(d);
   /* if (typeof mettreAJourTableauxCourse === "function") mettreAJourTableauxCourse(d);*/
	if (typeof hudDrapeaux === "function") hudDrapeaux(d);
	if (typeof hudPneusDetail === "function") hudPneusDetail(d);
	if (typeof hudClassement === "function") hudClassement(d);
	if (typeof hudRelatif === "function") hudRelatif(d);
	
}







/* ==========================================================================
   4. SYSTÈME AUDIO & RESET (FONCTIONS SUPPORTS)
   ========================================================================== */

function parler(id_alerte, texte, indexVoix = 1) {
    if (id_alerte === MemoireVocale.derniereAlerte) return;

    MemoireVocale.derniereAlerte = id_alerte;
    radioQueue.push({ texte, indexVoix });

    if (!isRadioTalking) {
        processNextMessage();
    }
}

function resetCompletHUD() {
    console.log("🔄 Reset HUD : Nettoyage complet pour nouvelle session");

    // 1. Vider les conteneurs dynamiques (Classement & Relatif)
    const containers = ["leaderboard-dynamic-container", "relative-dynamic-container"];
    containers.forEach(id => { 
        const el = document.getElementById(id);
        if (el) el.innerHTML = ""; 
    });

    // 2. Réinitialiser les mémoires de voix et de session
    MemoireVocale.derniereAlerte = "";
    derniereSessionAnnoncee = "";
    dernierFlagVocal = null;

    // 3. Remettre les PNEUS à zéro (Visuel et Texte)
    const roues = ["fl", "fr", "rl", "rr"];
    roues.forEach(prefix => {
        // Textes
        if (document.getElementById(`${prefix}-temp-core`)) document.getElementById(`${prefix}-temp-core`).textContent = "--°";
        if (document.getElementById(`${prefix}-temp-brake`)) document.getElementById(`${prefix}-temp-brake`).textContent = "--";
        if (document.getElementById(`${prefix}-pres`)) document.getElementById(`${prefix}-pres`).textContent = "0.0";
        if (document.getElementById(`${prefix}-wear-val`)) document.getElementById(`${prefix}-wear-val`).textContent = "100%";
        if (document.getElementById(`${prefix}-temp-imo`)) document.getElementById(`${prefix}-temp-imo`).textContent = "--|--|--";

        // Jauges (Hauteur à 0%)
        const gauges = [`${prefix}-brake-bar`, `${prefix}-psi-bar`, `${prefix}-wear-bar`];
        gauges.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.height = "0%";
        });

        // Couleurs des zones (Retour au bleu froid ou transparent)
        const zones = [`${prefix}-zone-i`, `${prefix}-zone-m`, `${prefix}-zone-o`];
        zones.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.style.backgroundColor = "rgba(255,255,255,0.05)";
        });
    });

    // 4. Performance (Vitesse et Gear)
    if (document.getElementById("perf-vitesse")) document.getElementById("perf-vitesse").textContent = "0";
    if (document.getElementById("perf-gear")) document.getElementById("perf-gear").textContent = "N";
	
	
	
	// Reset des mémoires de performance pour éviter les erreurs de calcul au 1er tour
    MemoireClassement = { posPrecedente: null, meilleurTourClasse: {} };
    MemoireRelatif = { lastTimeAnalyse: 0, lastTimeConseille: 0 };
    
    // Reset de la mémoire Tactique (Celle qui gère les voix Ariane/Antoine)
	window.MemoireTactique = {
		tourMessage: 0,
		etatDelta: 0,
		dernierVocalPodium: 0,
		dernierGérard: 0,

		tourDuDernierMessage: 0,
		etatDeltaAnnonce: 0,
		positionClassePrecedente: null,
		meilleurTourClasse: 9999,
		dernierCheckRelatif: 0,

		lastFlag: null,
		lastLap: 0,
		lastIncCount: 0
	};

	
	
}


/* ==========================================================================
   5. INITIALISATION
   ========================================================================== */

function applyVisibility() {
    const modules = ['module-leaderboard', 'module-relative', 'module-strategie', 'module-meteo', 'module-pneus-detail'];
    modules.forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            const isActive = localStorage.getItem(id) !== 'false';
            el.style.display = isActive ? 'block' : 'none';
        }
    });
}

// Lancement
document.addEventListener('DOMContentLoaded', () => {
    applyVisibility();
    connecter();
    requestAnimationFrame(updateLoop);
});

window.addEventListener('storage', applyVisibility);





async function processNextMessage() {
    if (radioQueue.length === 0) {
        isRadioTalking = false;
        MemoireVocale.derniereAlerte = null; // Important pour pouvoir répéter
        setTimeout(() => {
            const moduleRadio = document.getElementById("module-radio-team");
            if (moduleRadio && !isRadioTalking) moduleRadio.classList.remove("active");
        }, 2000);
        return;
    }

    isRadioTalking = true;
    const msg = radioQueue.shift();
    const expert = CONFIG_TEAM[msg.indexVoix.toString()] || CONFIG_TEAM["1"];
    const moduleRadio = document.getElementById("module-radio-team");

    if (moduleRadio) {
        // Mise à jour visuelle
        document.getElementById("radio-img").src = `assets/team/${expert.image}`;
        document.getElementById("radio-name").textContent = expert.nom.toUpperCase();
        document.getElementById("radio-message").textContent = msg.texte;

        // On affiche le département
        const elDept = document.getElementById("radio-dept");
        if (elDept) elDept.textContent = expert.departement.toUpperCase();

        moduleRadio.style.display = "block";
        moduleRadio.classList.add("active");

        try {
            await fetch(`${VOICE_URL}/speak`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: msg.texte, voice_index: msg.indexVoix })
            });
            // Attente basée sur la longueur du texte
            const delaiSaisie = Math.max(2000, msg.texte.length * 85);
            await new Promise(r => setTimeout(r, delaiSaisie));
        } catch (e) {
            console.error("Erreur TTS:", e);
        }
    }
    processNextMessage();
}






// Ta fonction attendreFinDeParole (déjà parfaite)
function attendreFinDeParole() {
    return new Promise((resolve) => {
        let aCommenceA_Parler = false;
        
        const verifInterval = setInterval(async () => {
            try {
                const res = await fetch('http://127.0.0.1:5000/status');
                const data = await res.json();

                if (data.playing) {
                    aCommenceA_Parler = true; // On confirme que le son est en cours
                } else if (aCommenceA_Parler && !data.playing) {
                    // Si on a commencé à parler et que maintenant c'est fini
                    clearInterval(verifInterval);
                    resolve();
                }
            } catch (e) {
                // En cas d'erreur API, on libère pour ne pas bloquer le HUD
                clearInterval(verifInterval);
                resolve();
            }
        }, 200); // On vérifie toutes les 200ms
    });
}





/* ==========================================================================
   3. GESTION DES DRAPEAUX (COMPLÈTE ET SÉCURISÉE)
   ========================================================================== */
   
   


function hudDrapeaux(donnees) {
    // 1. Sécurité et détection des données (flag ou flags)
    if (!donnees || (!donnees.flag && !donnees.flags)) return;

    const MAP_FLAGS = {
        "VERT": "f-VERT", "JAUNE": "f-JAUNE", "ROUGE": "f-ROUGE", "BLEU": "f-BLEU",
        "BLANC": "f-BLANC", "VIOLET": "f-VIOLET", "DAMIER": "f-DAMIER", "GRAVIER": "f-GRAVIER",
        "MEATBALL": "f-MEATBALL", "STOPGO": "f-STOPGO", "PITPASS": "f-PITPASS",      
        "AVERT": "f-AVERT", "NOIR": "f-NOIR"      
    };

    // Nettoyage visuel immédiat
    document.querySelectorAll('.drapeau-cellule').forEach(el => el.classList.remove("actif", "vibrate"));
    
    // Normalisation de la liste
    const liste = Array.isArray(donnees.flag) ? donnees.flag : (donnees.flag ? [donnees.flag] : [donnees.flags]);

    if (liste.length > 0) {
        // --- PARTIE 1 : AFFICHAGE VISUEL ---
        liste.forEach(nom => {
            if (!nom) return;
            const key = nom.toUpperCase().trim();
            const element = document.getElementById(MAP_FLAGS[key]);
            if (element) {
                element.classList.add("actif");
                if (["JAUNE", "ROUGE", "MEATBALL", "STOPGO"].includes(key)) {
                    element.classList.add("vibrate");
                }
            }
        });

        // --- PARTIE 2 : LOGIQUE VOCALE ---
        const flagsNormalises = liste.map(f => f.toUpperCase().trim());
        const alerteID = flagsNormalises[flagsNormalises.length - 1];

        // Anti-répétition strict
        if (alerteID === dernierFlagVocal) return;
        dernierFlagVocal = alerteID;

        // Détermination de la session
        let sessionActive = Tactique.sessionType || "Practice";
        if (Tactique.sessionNum === 0) sessionActive = "Practice";
        if (Tactique.sessionNum === 1) sessionActive = "Qualify";
        if (Tactique.sessionNum === 2) sessionActive = "Race";

        const cleVert = Tactique.sessionNum + "-VERT";






        // Dispatching par session et par drapeau
        switch (sessionActive) {

            case "Practice":
                switch (alerteID) {
                    case "VERT":
                        if (derniereSessionAnnoncee !== cleVert) {
                            parler("VOX_VERT_PRAC", `Drapeau vert. Ariane à la radio, on valide les réglages.`, 5);
                            derniereSessionAnnoncee = cleVert;
                        }
                        break;
                    case "JAUNE":
                        parler("VOX_JAUNE_PRAC", `Attention, danger ! Drapeau jaune !`, 3);
                        break;
                   /*     
                    case "NOIRCUT":
                        parler("VOX_CUT_PRAC", `Petite pénalité, attention aux limites de piste !`, 0);
                        break;
*/
                    case "NOIRCUTPIT":
                        parler("VOX_CUTPIT_PRAC", `Attention, les commissaires t'ont à l'œil ! Pénalité pour franchissement de la ligne continue en sortie de pit.`, 10);
                        break;
                    case "MEATBALL":
                        parler("VOX_MEATBALL_PRAC", `Drapeau noir et orange ! Rentre au stand immédiatement !`, 2);
                        break;					 
					case "GRAVIER":
						parler(
							"VOX_GRAVIER_PRAC",
							`Attention, du gravier a été ramené sur la piste. Reste sur la trajectoire propre.`,
							3
						);
						break;
							
						
						
                }
                break;

            case "Qualify":
                switch (alerteID) {
                    case "VERT":
                        if (derniereSessionAnnoncee !== cleVert) {
                            parler("VOX_VERT_QUALY", "La piste est libre. Sylvie au rapport : c'est ton tour.", 9);
                            derniereSessionAnnoncee = cleVert;
                        }
                        break;
                    case "JAUNE":
                        parler("VOX_JAUNE_QUALY", `Attention, danger ! Drapeau jaune en piste !`, 3);
                        break;
                    case "DAMIER":
                        parler("VOX_DAMIER_QUALY", `Drapeau à damier. Fin de la séance.`, 9);
                        break;
                    case "QUALIFCASSE":
                        parler("VOX_CASSE_QUALY", `C'est vraiment navrant pour les qualifications. Philippe, il faut la ramener.`, 2);
                        break;
                    case "NOIRCUT":
                        parler("VOX_CUT_QUALY", `Il faut te concentrer, attention à la pénalité !`, 10);
                        break;      
                    case "DERNIERTOUR":
                        parler("VOX_LASTLAP_QUALY", `Allez, dernière chance. On est tous derrière toi, donne tout !`, 5);
                        break;                              
                    case "MEATBALL":
                        parler("VOX_MEATBALL_QUALY", `Drapeau noir et orange ! Rentre au stand immédiatement !`, 2);
                        break;
                }
                break;

            case "Race":
                switch (alerteID) {
                    case "VERT":
                        if (derniereSessionAnnoncee !== cleVert) {
                            parler("VOX_VERT_RACE", `Drapeau vert, en piste !`, 3);
                            derniereSessionAnnoncee = cleVert;
                        }
                        break;
                    case "JAUNE":
                        parler("VOX_JAUNE_RACE", `Attention, danger ! Drapeau jaune !`, 3);
                        break;
                    case "BLEU":
                        parler("VOX_BLEU_RACE", `Drapeau bleu, laisse passer.`, 6);
                        break;
                    case "DAMIER":
                        parler("VOX_DAMIER_RACE", `Drapeau à damier ! C'est terminé.`, 5);
                        break;
                    case "NOIRCUT":
                        parler("VOX_CUT_RACE", `Pénalité pour avoir coupé un virage.`, 0);
                        break;
                    case "STOPGO":
                        parler("VOX_STOPGO_RACE", `Pénalité Stop and Go ! Denise t'attend aux stands.`, 0);
                        break;
                    case "MEATBALL":
                        parler("VOX_MEATBALL_RACE", `Drapeau noir et orange ! Rentre au stand immédiatement !`, 2);
                        break;
                    case "NOIR":
                        parler("VOX_BLACK_RACE", `Drapeau noir. Nous sommes disqualifiés.`, 0);
                        break;
                }
                break;
        }
    }
}




function hudClassement(donnees) {
    const container = document.getElementById("leaderboard-dynamic-container");
    if (!container || !donnees.Leaderboard) return;

    let html = "";
    const classes = {};

    // 1. Regrouper les pilotes par catégorie
    donnees.Leaderboard.forEach(p => {
        const idCl = p.CarClassID || 0;
        if (!classes[idCl]) classes[idCl] = { nom: p.CarClassShortName, pilotes: [] };
        classes[idCl].pilotes.push(p);
    });

    Object.keys(classes).forEach(id => {
        const cat = classes[id];
        const classIdx = id % 5;
        
        let pilotesAffiches = [];
        const indexJoueur = cat.pilotes.findIndex(p => p.IsPlayer);

        if (indexJoueur !== -1) {
            pilotesAffiches = cat.pilotes.slice(Math.max(0, indexJoueur - 3), indexJoueur + 4);
        } else {
            pilotesAffiches = cat.pilotes.slice(0, 6);
        }

        html += `
        <div class="capsule-classe">
            <div class="titre-categorie cat-color-${classIdx}" style="color: white !important; text-shadow: 1px 1px 2px #000;">
                ${cat.nom}
            </div>
            <div class="lb-table">`;

        pilotesAffiches.forEach(p => {
            const carId = p.CarID || 0; 
            const imageUrl = `assets/cars/${carId}.png`;
            const lic = (p.LicString || "R").split(" ");
            const posDisplay = p.Position >= 999 ? "-" : p.Position;
            
            let gainHtml = "";
            if (p.Position < 999) {
                if (p.Gain > 0) gainHtml = `<span style="color: #00ff00;">▲${p.Gain}</span>`;
                else if (p.Gain < 0) gainHtml = `<span style="color: #ff4444;">▼${Math.abs(p.Gain)}</span>`;
                else gainHtml = `<span style="color: #666;">0</span>`;
            } else {
                gainHtml = `<span style="color: #666;">-</span>`;
            }

            html += `
            <div class="lb-row ${p.IsPlayer ? 'is-me' : ''}">
                <div class="col-pos" style="background:white; color:black; font-weight:bold;">${posDisplay}</div>
                <div class="col-car" style="color:#aaa;">${p.CarNumber}</div>
                <div class="col-cat-bar cat-color-${classIdx}"></div>
                <div class="col-cars"><img src="${imageUrl}" /></div>
                <div class="col-name">
                    <div class="name-stack">
                        <span class="driver-name">${p.IsPlayer ? '👉 ' : ''}${p.UserName}</span>
                        <span class="car-model-name">${p.CarName}</span>
                    </div>
                </div>
                <div class="col-gain" style="font-weight:bold; font-size:11px;">${gainHtml}</div>
                <div class="col-ir"><span class="badge-ir">${p.IR_Display}</span></div>
                <div class="col-lic"><span class="badge-lic lic-${lic[0][0]}">${lic[0][0]}</span></div>
                <div class="col-sr"><span class="badge-sr lic-${lic[0][0]}">${lic[1] || ""}</span></div>
                <div class="col-gap" style="color:#ffcc00;">${p.Gap}</div>
                <div class="col-gap" style="color:#ff9800;">${p.GapInt}</div>
                <div class="col-time chrono-fluo-${classIdx}">${p.LastLapTime}</div>
            </div>`;
        });
        html += `</div></div>`;
    });
    container.innerHTML = html;

    /* ==========================================================================
       LOGIQUE VOCALE INTÉGRÉE (COURSE & DÉBRIEFING)
       ========================================================================== */
    const now = Date.now();
    const joueur = donnees.Leaderboard.find(p => p.IsPlayer);
    
    // On n'active les voix que si on est en course ("Race")
    if (!joueur || donnees.sessionType !== "Race") return;

    const maPos = parseInt(joueur.Position);
    if (!window.MemoireClassement) window.MemoireClassement = { posPrecedente: maPos };
    if (!window.MemoireTactique) window.MemoireTactique = {};

    // 1. CHANGEMENTS DE POSITION (ARIANE / DENISE)
    if (window.MemoireClassement.posPrecedente !== null && maPos !== window.MemoireClassement.posPrecedente) {
        const diff = window.MemoireClassement.posPrecedente - maPos;
        
        if (diff >= 3) {
            parler("RACE_HUGE_GAIN", `Ariane : Énorme ! On vient de gagner ${diff} places. On est P${maPos} !`, 5, "ARIANE");
        } else if (diff > 0) {
            parler("RACE_GAIN", `Ariane : Belle manœuvre, on prend la P${maPos}.`, 5, "ARIANE");
        } else if (diff <= -3) {
            parler("RACE_HUGE_LOSS", `Denise : On a perdu ${Math.abs(diff)} positions. Garde ton calme, rien n'est fini.`, 0, "DENISE");
        } else if (diff < 0) {
            parler("RACE_LOSS", `Denise : Une place de perdue. On redescend P${maPos}.`, 0, "DENISE");
        }
        window.MemoireClassement.posPrecedente = maPos;
    }

    // 2. DUELS & RELATIFS (REMY)
    const devant = donnees.Leaderboard.find(p => p.Position === maPos - 1);
    const derriere = donnees.Leaderboard.find(p => p.Position === maPos + 1);

    if (now - (window.MemoireTactique.dernierDuel || 0) > 120000) {
        // Chasse (devant < 0.7s)
        if (devant && devant.GapInt_raw < 0.7) {
            parler("RACE_HUNT", `Remy : On est sur ses talons. Écart ${devant.GapInt_raw.toFixed(1)}s. Attaque !`, 6, "REMY");
            window.MemoireTactique.dernierDuel = now;
        } 
        // Défense (derrière < 0.6s)
        else if (derriere && derriere.GapInt_raw < 0.6) {
            parler("RACE_DEFEND", `Remy : Danger derrière. Il est à ${derriere.GapInt_raw.toFixed(1)}s. Protège ta ligne.`, 6, "REMY");
            window.MemoireTactique.dernierDuel = now;
        }
    }

    // 3. FIN DE COURSE & DÉBRIEFING (AU DRAPEAU À DAMIER)
    const flag = donnees.flags || "";
    if (flag.includes("Checkered") && !window.MemoireTactique.vocalFinCourse) {
        if (maPos === 1) {
            parler("RACE_WIN", `Ariane : P 1 ! Victoire ! Quelle performance magistrale aujourd'hui !`, 5, "ARIANE");
        } else if (maPos <= 3) {
            parler("RACE_PODIUM", `Ariane : Podium ! On termine P${maPos}. C'est un superbe résultat pour l'équipe.`, 5, "ARIANE");
        } else if (maPos <= 10) {
            parler("RACE_TOP10", `Remy : On finit P${maPos}. C'est dans le Top 10, l'objectif est rempli.`, 6, "REMY");
        } else {
            parler("RACE_FINISH", `Denise : Drapeau à damier. On termine P${maPos}. On range la voiture.`, 0, "DENISE");
        }
        window.MemoireTactique.vocalFinCourse = true;
    }
}






function hudRelatif(donnees) {

    /* ======================================================================
       PARTIE 1 : HUD RELATIF (INTOUCHÉ — TOUJOURS EXÉCUTÉ)
       ====================================================================== */

    const container = document.getElementById("relative-drivers-list");
    if (!container || !donnees.Relative) return;

    let html = '<div class="lb-table">';

    donnees.Relative.forEach((p) => {
        const classIdx = p.CarClassID % 5;
        const lic = (p.LicString || "R").split(" ");
        const posDisplay = p.Position >= 999 ? "-" : p.Position;

        html += `
        <div class="lb-row ${p.IsPlayer ? 'is-me' : ''}">
            <div class="col-pos" style="background:white; color:black; font-weight:bold;">${posDisplay}</div>
            <div class="col-car" style="color:#aaa;">${p.CarNumber}</div>
            <div class="col-cat-bar cat-color-${classIdx}"></div>
            <div class="col-name">${p.UserName}</div>
            <div class="col-gain"></div> 
            <div class="col-ir"><span class="badge-ir">${p.IR_Display}</span></div>
            <div class="col-lic"><span class="badge-lic lic-${lic[0][0]}">${lic[0][0]}</span></div>
            <div class="col-sr"><span class="badge-sr lic-${lic[0][0]}">${lic[1] || ""}</span></div>
            <div class="col-gap" style="grid-column: span 2; color:white; text-align:right; padding-right:15px;">
                ${p.IsPlayer ? "SELF" : p.GapRelat}
            </div>
            <div class="col-time chrono-fluo-${classIdx}">${p.LastLapTime}</div>
        </div>`;
    });

    container.innerHTML = html + '</div>';


    /* ======================================================================
       PARTIE 2 : LOGIQUE VOCALE SÉCURISÉE (ARIANCE, REMY, GÉRARD)
       ====================================================================== */

    /* --- 1. Sécurités de base --- */
    if (!donnees.speed || donnees.speed < 40) return; // Sécurité stands
    if (typeof Tactique === "undefined" || typeof MemoireRelatif === "undefined") return;

    const now = Date.now();

    /* --- 2. Initialisation Mémoire Tactique --- */
    if (typeof window.MemoireTactique === "undefined") {
        window.MemoireTactique = { tourMessage: -1, etatDelta: 0, dernierVocalPodium: 0, dernierGerard: 0 };
    }

    /* --- 3. Détermination de la Session (Source: session.py) --- */
    const sessionActive = donnees.sessionType || "Practice";

    /* --- 4. Contexte Pilote & Delta --- */
    const myIndex = donnees.Relative.findIndex(p => p.IsPlayer);
    if (myIndex === -1) return;

    const moi = donnees.Relative[myIndex];
    const devant = donnees.Relative[myIndex - 1];
    const delta = parseFloat(donnees.delta_raw || 0);
    const currentLap = donnees.lap || 0;

    /* --- 5. Reset du verrou "Une fois par tour" --- */
    if (currentLap > window.MemoireTactique.tourMessage) {
        window.MemoireTactique.tourMessage = currentLap;
        window.MemoireTactique.etatDelta = 0; // Autorise Ariane pour ce nouveau tour
    }

    /* ======================================================================
       👉 CONDITION ARIANE (GOD MODE) - SÉCURISÉE
       ====================================================================== */

    // VERROUS : Practice + Chrono Valide (>0) + Pas encore parlé ce tour
    const aUnChronoValide = (moi.LastLapTime_raw && moi.LastLapTime_raw > 0);

    if (sessionActive === "Practice" && aUnChronoValide && window.MemoireTactique.etatDelta === 0) {
        
        if (delta <= -1.0) {
            const msgsAriane = [
                `Focus ! On a plus d'une seconde d'avance. Reste sur les rails, ce tour est historique !`,
                `Le delta est magnifique, plus d'une seconde d'avance. Ne change rien, trajectoires tendues !`,
                `C'est le tour de la semaine ! On survole la piste là, reste fluide !`,
                `Regarde-moi ce chrono ! Plus d'une seconde d'avance. Respire, c'est ton tour !`
            ];
            parler("DELTA_GOD", msgsAriane[Math.floor(Math.random() * msgsAriane.length)], 5, "ARIANE");
            
            // On verrouille Ariane pour le reste du tour actuel
            window.MemoireTactique.etatDelta = 1; 
        }
    }

    /* ======================================================================
       👉 AUTRES INTERVENTIONS (REMY, GÉRARD)
       ====================================================================== */

    // --- GÉRARD : Analyse de précision (Delta entre -0.3s et -0.6s) ---
    if (sessionActive === "Practice" && delta < -0.3 && delta > -0.6 && aUnChronoValide) {
        if (now - window.MemoireTactique.dernierGerard > 240000) {
            const msgsGerard = [
                `On gagne du temps de manière constante dans ce secteur. Continue sur cette ligne.`,
                `Les relevés sont bons. Tu améliores tes sorties de virage, le delta est au vert.`
            ];
            parler("DELTA_TECH", msgsGerard[Math.floor(Math.random() * msgsGerard.length)], 4, "GÉRARD");
            window.MemoireTactique.dernierGerard = now;
        }
    }

    // --- REMY : Gestion du Trafic ---
    if (devant && devant.UserName !== "OFF TRACK") {
        const gap = parseFloat(devant.GapRelat);
        const memeCategorie = (devant.CarClassID === moi.CarClassID);

        // Le Lièvre (Remy)
        if (sessionActive === "Practice" && memeCategorie && gap < 3.0 && gap > 0.8) {
            if (now - MemoireRelatif.lastTimeAnalyse > 120000) {
                parler("PRAC_TARGET", `Cible en vue : ${devant.UserName} est ton lièvre. Accroche-toi !`, 6, "REMY");
                MemoireRelatif.lastTimeAnalyse = now;
            }
        }

        // Trop proche (Coach)
        if (gap < 0.3 && now - MemoireRelatif.lastTimeConseille > 180000) {
            parler("PRAC_COOL", `Tu es dans ses échappements. Garde de l'espace.`, 5, "COACH");
            MemoireRelatif.lastTimeConseille = now;
        }
    }

    // --- CLASSEMENT : Podium et Pole Position ---
    const maPosition = donnees.Position || 0;
    if (now - window.MemoireTactique.dernierVocalPodium > 300000) {
        if (maPosition === 1) {
            parler("POLE", "Incroyable ! On vient de prendre la pole position ! T'es le patron.", 5, "ARIANE");
            window.MemoireTactique.dernierVocalPodium = now;
        } else if (maPosition > 1 && maPosition <= 3) {
            parler("PODIUM", `On tient le podium ! P${maPosition} au classement. Reste concentré.`, 6, "REMY");
            window.MemoireTactique.dernierVocalPodium = now;
        }
    }
	
	
	/* ======================================================================
       👉 ÉLOÏSE : ANALYSE DES RECORDS (BEST LAP)
       ====================================================================== */

    // On récupère le best lap actuel du joueur
    const monBestLap = moi.BestLapTime_raw || 0; // Il faudra s'assurer que Python l'envoie

    // --- SCÉNARIO A : PREMIER CHRONO ENREGISTRÉ (Practice uniquement) ---
    if (sessionActive === "Practice" && aUnChronoValide && !window.MemoireTactique.premierChronoFait) {
        const msgsEloiseFirst = [
            `Premier chrono enregistré. C'est une bonne base de travail, on va pouvoir affiner maintenant.`,
            `Le premier temps de référence est tombé. On a une base, voyons où on peut gratter des dixièmes.`,
            `C'est validé. Premier tour propre, le chrono est dans la boîte.`
        ];
        parler("FIRST_LAP", msgsEloiseFirst[Math.floor(Math.random() * msgsEloiseFirst.length)], 4, "ÉLOÏSE");
        window.MemoireTactique.premierChronoFait = true; // Flag définitif pour la session
    }

    // --- SCÉNARIO B : RECORD BATTU (Practice & Race) ---
    // On compare le dernier tour au meilleur tour enregistré
    if (aUnChronoValide && (sessionActive === "Practice" || sessionActive === "Race")) {
        
        // Si le dernier tour est égal au best lap (donc on vient de le faire)
        // ET qu'on ne l'a pas encore annoncé pour ce tour précis
        if (moi.LastLapTime_raw === monBestLap && monBestLap > 0 && window.MemoireTactique.tourBestAnnonce !== currentLap) {
            
            const msgsEloiseBest = [
                `Nouveau record personnel ! On améliore encore, la voiture est parfaitement exploitée.`,
                `C'est ton meilleur tour en piste ! Ton rythme est excellent, continue sur cette lancée.`,
                `Record battu ! Les data sont formelles : tu es plus rapide que jamais aujourd'hui.`
            ];
            
            parler("BEST_LAP", msgsEloiseBest[Math.floor(Math.random() * msgsEloiseBest.length)], 9, "SYLVIE");
            window.MemoireTactique.tourBestAnnonce = currentLap; // Évite de répéter 50 fois sur le même tour
        }
    }
	
	
	
	
	
}







/* ==========================================================================
   4. GESTION DE LA MÉTÉO
   ========================================================================== */
function hudMeteo(data) {
    if (!data) return;
    if (typeof Tactique === "undefined") return;

    /* ======================================================================
       A. HUD VISUEL (INCHANGÉ)
       ====================================================================== */

    if (document.getElementById("val-temp")) {
        document.getElementById("val-temp").textContent = data.air_temp.toFixed(1);
    }

    if (document.getElementById("val-piste-temp")) {
        document.getElementById("val-piste-temp").textContent = data.track_temp.toFixed(1);
        const jaugePiste = document.getElementById("jauge-piste");
        if (jaugePiste) {
            let trackPct = (data.track_temp / 60) * 100;
            jaugePiste.style.height = Math.min(Math.max(trackPct, 0), 100) + "%";
        }
    }

    if (document.getElementById("val-humidite")) {
        document.getElementById("val-humidite").textContent = data.humidity_pct;
    }

    if (document.getElementById("val-vent-vitesse")) {
        document.getElementById("val-vent-vitesse").textContent = Math.round(data.wind_vel * 3.6);
    }

    const iconDir = document.getElementById("icone-direction");
    if (iconDir) iconDir.style.transform = `rotate(${data.wind_dir}deg)`;

    const elRainIcon = document.getElementById("icone-pluie");
    if (elRainIcon) {
        const rainIntensity = data.rain_intensity_pct || 0;
        if (rainIntensity === 0) {
            elRainIcon.textContent = "🌞";
            elRainIcon.style.color = "#ffca28";
        } else if (rainIntensity <= 30) {
            elRainIcon.textContent = "🌤️";
            elRainIcon.style.color = "#ffffff";
        } else {
            elRainIcon.textContent = "🌧️";
            elRainIcon.style.color = "#00f2ff";
        }
    }

    /* ======================================================================
       B. CONTEXTE SESSION (MINIMAL)
       ====================================================================== */

    const session = Tactique.sessionType || "Practice";

    /* ======================================================================
       C. VARIABLES COURANTES
       ====================================================================== */

    const pluie = data.rain_intensity_pct || 0;
    const vent = data.wind_vel * 3.6;



    /* ======================================================================
       E. VARIATION TEMPÉRATURE (PRACTICE + RACE)
       ====================================================================== */

    if (
        (session === "Practice" || session === "Race") &&
        MemoireMeteo.pisteTemp !== null
    ) {
        const delta = data.track_temp - MemoireMeteo.pisteTemp;

        if (delta >= 2) {
            parler("METEO_CHAUD", "La piste chauffe rapidement.", 1, "MÉTÉO");
            MemoireMeteo.pisteTemp = data.track_temp;
        } else if (delta <= -2) {
            parler("METEO_FROID", "La piste refroidit rapidement.", 1, "MÉTÉO");
            MemoireMeteo.pisteTemp = data.track_temp;
        }
    }

    /* ======================================================================
       F. PLUIE (TOUTES SESSIONS)
       ====================================================================== */

    if (pluie > 0 && MemoireMeteo.pluie === 0) {
        parler("PLUIE_DEBUT", "La pluie arrive sur le circuit.", 1, "MÉTÉO");
    }

    if (pluie === 0 && MemoireMeteo.pluie > 0) {
        parler("PLUIE_FIN", "La pluie s'arrête, la piste va sécher.", 1, "MÉTÉO");
    }

    MemoireMeteo.pluie = pluie;

    /* ======================================================================
       G. VENT FORT (RACE UNIQUEMENT)
       ====================================================================== */

    if (session === "Race" && vent > 35 && MemoireMeteo.vent <= 35) {
        parler("VENT_FORT", "Vent fort sur le circuit, attention.", 1, "MÉTÉO");
    }

    MemoireMeteo.vent = vent;
}













   /* ==========================================================================
   4. GESTION DE LA PISTE
   ========================================================================== */
function hudPiste(data) {
    if (!data) return;

    // --- INITIALISATION POUR LES VOIX (SÉCURITÉ) ---
    const now = Date.now();
    if (!window.MemoireTactique) window.MemoireTactique = {};
    if (window.MemoireTactique.dernierFuelVocal === undefined) window.MemoireTactique.dernierFuelVocal = 0;
    if (window.MemoireTactique.dernierGerardPiste === undefined) window.MemoireTactique.dernierGerardPiste = 0;
    if (window.MemoireTactique.lastIncCount === undefined) window.MemoireTactique.lastIncCount = 0;
    if (window.MemoireTactique.dernierVocalPhysio === undefined) window.MemoireTactique.dernierVocalPhysio = 0;

    // --- 1. CARBURANT (Conso + Tours Possibles) ---
    const elCons = document.getElementById("strat-fuel-last");
    const elLapsEst = document.getElementById("strat-fuel-laps");

    if (data.fuel_last_lap !== undefined) {
        if (elCons) {
            elCons.textContent = data.fuel_last_lap > 0 ? data.fuel_last_lap.toFixed(3) : "-.---";
        }

        if (elLapsEst) {
            let toursRestants = data.fuel_laps_est || 0;
            
            if (toursRestants > 0) {
                elLapsEst.textContent = toursRestants.toFixed(1);
                
                // Alerte visuelle
                if (toursRestants < 2) {
                    elLapsEst.style.color = "#ff0000";
                    elLapsEst.classList.add("blink-fast");
                } else {
                    elLapsEst.style.color = "#fff";
                    elLapsEst.classList.remove("blink-fast");
                }

                // --- VOCAL CARBURANT (ANTOINE ID 2) ---
                if (now - window.MemoireTactique.dernierFuelVocal > 300000) {
                    if (toursRestants < 1.2) {
                        parler("FUEL_EMERGENCY", "C'est le dernier tour ! Rentre maintenant ou on finit à pied !", 2);
                        window.MemoireTactique.dernierFuelVocal = now;
                    } else if (data.fuel_avg > 0 && data.fuel_last_lap > (data.fuel_avg * 1.08)) {
                        parler("FUEL_BURN", "ici Antoine. On consomme trop sur ce run. Lève un peu le pied.", 2);
                        window.MemoireTactique.dernierFuelVocal = now;
                    }
                }
            } else {
                elLapsEst.textContent = "--";
            }
        }
    }

    // --- 2. JAUGES FUEL ---
    const jFuel = document.getElementById("strat-fuel-bar");
    if (jFuel && data.fuel_pct !== undefined) {
        const pct = data.fuel_pct * 100;
        jFuel.style.height = Math.min(pct, 100) + "%";
    }

    // --- 3. CHRONOS & COMPARATIF (GÉRARD ID 4) ---
    let monInfo = null;
    if (data.Leaderboard) {
        monInfo = data.Leaderboard.find(p => p.IsPlayer === true);
    }

    if (monInfo) {
        const elLast = document.getElementById("strat-last-lap");
        const elBest = document.getElementById("strat-best-lap");
        if (elLast) elLast.textContent = monInfo.LastLapTime || "--:--.---";
        if (elBest) elBest.textContent = monInfo.BestLapTime || "--:--.---";

        // --- VOCAL PERFORMANCE (GÉRARD ID 4) ---
        if (data.leader_best_lap > 0 && monInfo.BestLapTime_raw > 0 && (now - window.MemoireTactique.dernierGerardPiste > 600000)) {
            const diff = (monInfo.BestLapTime_raw - data.leader_best_lap).toFixed(3);
            if (diff > 0.6) {
                parler("PERF_GAP", `ici Gérard. On rend ${diff} au leader sur le meilleur tour. Travaille tes entrées de virage.`, 4, "GÉRARD");
                window.MemoireTactique.dernierGerardPiste = now;
            }
        }
    }




// --- 4. INCIDENTS STRATÉGIQUES ---
    const elInc = document.getElementById("strat-incidents");
    const inc = Number(data.incidents) || 0;

    if (elInc) {
        elInc.textContent = inc;

        // On ne déclenche Denise que sur des paliers spécifiques
        if (inc > window.MemoireTactique.lastIncCount) {
            let message = "";
            let priorite = 0;

            // --- SEUILS D'ALERTE ---
            if (inc === 4) {
                message = `Ici Denise. On commence à accumuler les erreurs. 4 incidents, stabilise ta conduite.`;
            } 
            else if (inc === 8) {
                message = `Attention, 8 incidents au compteur. On ne peut plus se permettre de bêtises si on veut sauver le Safety Rating.`;
                priorite = 1; // Un peu plus urgent
            } 
            else if (inc === 12) {
                message = `Alerte ! 12 incidents ! On est proche de la correctionnelle. Reste sur la piste, quoi qu'il arrive.`;
                priorite = 2; // Urgent
            } 
            else if (inc >= 15) {
                message = `C'est critique ! ${inc} incidents. Encore un ou deux et c'est le drapeau noir. Calme le jeu immédiatement !`;
                priorite = 2;
            }

            // On ne parle que si un message a été défini (donc pas à chaque 1x)
            if (message !== "") {
                const idUnique = "INC_STRAT_" + inc + "_" + Date.now();
                parler(idUnique, message, priorite);
            }

            // On met à jour la mémoire pour ne pas oublier où on en est
            window.MemoireTactique.lastIncCount = inc;
        }
    }





	
    
    // Joker Status
    const labelJoker = document.getElementById("strat-joker-status");
    const blocJoker = document.getElementById("bloc-joker");
    if (labelJoker) {
        if (data.joker_state) {
            labelJoker.textContent = "NEEDED";
            if (blocJoker) blocJoker.classList.add("vibrate");
        } else {
            labelJoker.textContent = "DONE";
            if (blocJoker) blocJoker.classList.remove("vibrate");
        }
    }

    // Session Infos
    if (document.getElementById("strat-lap-current")) 
        document.getElementById("strat-lap-current").textContent = data.lap || "--";
    if (document.getElementById("strat-lap-total")) 
        document.getElementById("strat-lap-total").textContent = data.lap_total || "--";
    if (document.getElementById("strat-session-time")) 
        document.getElementById("strat-session-time").textContent = data.session_time_str || "--:--:--";

    // --- VOCAL FATIGUE (ELOÏSE ID 7) ---
    if (data.avg_lap_raw > 0 && data.last_lap_raw > (data.avg_lap_raw + 2.0) && (now - window.MemoireTactique.dernierVocalPhysio > 900000)) {
        parler("PHYSIO_ALERT", "Eloïse ici. Ton rythme chute, bois un peu et relaxe tes mains sur le volant.", 7);
        window.MemoireTactique.dernierVocalPhysio = now;
    }
}
   



function hudPerformance(data) {
    if (!data || !ÉLÉMENTS_HUD.vitesse) return; // Sécurité si pas encore chargé

    // 1. Vitesse et Gear
    ÉLÉMENTS_HUD.vitesse.textContent = data.speed;

    if (ÉLÉMENTS_HUD.gear) {
        let g = data.gear;
        ÉLÉMENTS_HUD.gear.textContent = g === 0 ? "N" : (g === -1 ? "R" : g);
    }

    // 2. RPM
    if (ÉLÉMENTS_HUD.rpmBar) 
        ÉLÉMENTS_HUD.rpmBar.style.width = (data.rpm_pct * 100) + "%";

    // 3. DELTA
    if (ÉLÉMENTS_HUD.deltaVal && ÉLÉMENTS_HUD.deltaBar) {
        ÉLÉMENTS_HUD.deltaVal.textContent = data.delta_format;
        const color = (data.delta_raw <= 0) ? "#10b981" : "#ef4444";
        ÉLÉMENTS_HUD.deltaVal.style.color = color;
        ÉLÉMENTS_HUD.deltaBar.style.backgroundColor = color;

        const largeur = Math.min(Math.abs(data.delta_raw), 1) * 50; 
        ÉLÉMENTS_HUD.deltaBar.style.width = largeur + "%";
        ÉLÉMENTS_HUD.deltaBar.style.left = (data.delta_raw <= 0) ? (50 - largeur) + "%" : "50%";
    }

    // 4. Pédales
    if (ÉLÉMENTS_HUD.throttle) ÉLÉMENTS_HUD.throttle.style.height = (data.throttle * 100) + "%";
    if (ÉLÉMENTS_HUD.brake) ÉLÉMENTS_HUD.brake.style.height = (data.brake * 100) + "%";
    // CORRECTION INVERSION : On soustrait la valeur de 100 pour inverser le remplissage
    if (ÉLÉMENTS_HUD.clutch) {
        ÉLÉMENTS_HUD.clutch.style.height = (100 - (data.clutch * 100)) + "%";
    }
}







document.addEventListener('DOMContentLoaded', () => {
    initialiserElements(); // CRUCIAL : On cherche les IDs ici
    connecter();
    requestAnimationFrame(updateLoop);
})


// Lancement final
connecter();
requestAnimationFrame(updateLoop);
