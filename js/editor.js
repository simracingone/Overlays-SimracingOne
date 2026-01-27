var toggleHudEditor; 
var isHudEditorActive;

// Fonction globale pour forcer l'état depuis l'extérieur
window.modifierVisibiliteCommandes = function (etat) {
    if (typeof toggleHudEditor === 'function') {
        if (etat && !isHudEditorActive()) toggleHudEditor(true);
        else if (!etat && isHudEditorActive()) toggleHudEditor(false);
    }
};

(function () {
    const GRID_SIZE = 10;
    const SCALE_STEP = 0.05;
    const STORAGE_KEY = 'simracingone_layout';

    let editEnabled = false;
    let activeMod = null;
    let isResizing = false;
    let startX = 0, startY = 0, startL = 0, startT = 0, startScale = 1, startW = 0;
    let highestZIndex = 1000;

    /* ================= LOGIQUE VISUELLE ================= */
    const updateModuleVisual = (el) => {
        if (!el) return;
        const isVisibleInMenu = localStorage.getItem('vis_' + el.id) !== 'false';
        
        if (editEnabled) {
            el.style.outline = '2px dashed #00ff00';
            if (el.id === 'module-radio-team') {
                el.style.setProperty('display', 'block', 'important');
                el.style.opacity = "1";
                el.style.backgroundColor = "rgba(0, 162, 255, 0.3)";
            } else {
                el.style.setProperty('display', isVisibleInMenu ? 'block' : 'none', 'important');
            }
        } else {
            el.style.outline = 'none';
            if (el.id === 'module-radio-team') {
                el.style.backgroundColor = "transparent";
                el.style.setProperty('display', 'none', 'important');
                el.style.opacity = "0";
            } else {
                el.style.setProperty('display', isVisibleInMenu ? 'block' : 'none', 'important');
            }
        }
    };

    const loadLayout = () => {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        const modules = document.querySelectorAll('.editable-mod');
        modules.forEach(el => {
            if (data[el.id]) {
                Object.assign(el.style, data[el.id]);
                highestZIndex = Math.max(highestZIndex, parseInt(data[el.id].zIndex || 1000));
            } else {
                el.style.position = 'absolute';
            }
            updateModuleVisual(el);
        });
    };

    /* ================= GESTION SOURIS ================= */
    const onMouseDown = (e) => {
        const mod = e.target.closest('.editable-mod');
        if (!mod || !editEnabled) return;
        activeMod = mod;
        activeMod.style.zIndex = ++highestZIndex;
        isResizing = e.target.classList.contains('resizer');
        startX = e.clientX; startY = e.clientY;
        startL = parseFloat(activeMod.style.left) || 0;
        startT = parseFloat(activeMod.style.top) || 0;
        const tr = getComputedStyle(activeMod).transform;
        startScale = (tr !== 'none') ? parseFloat(tr.split(',')[0].replace('matrix(', '')) : 1;
        startW = activeMod.getBoundingClientRect().width / startScale;
        e.preventDefault();
    };

    const onMouseMove = (e) => {
        if (!activeMod) return;
        const dx = e.clientX - startX; const dy = e.clientY - startY;
        if (isResizing) {
            let s = Math.round((startScale + dx / startW) / SCALE_STEP) * SCALE_STEP;
            activeMod.style.transform = `scale(${Math.min(Math.max(s, 0.2), 4)})`;
        } else {
            activeMod.style.left = Math.round((startL + dx) / GRID_SIZE) * GRID_SIZE + 'px';
            activeMod.style.top = Math.round((startT + dy) / GRID_SIZE) * GRID_SIZE + 'px';
        }
    };

    const onMouseUp = () => {
        if (activeMod) {
            const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
            data[activeMod.id] = { 
                left: activeMod.style.left, 
                top: activeMod.style.top, 
                transform: activeMod.style.transform, 
                position: 'absolute', 
                zIndex: activeMod.style.zIndex 
            };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        }
        activeMod = null; isResizing = false;
    };

    const showResetPopup = () => {
        if (document.getElementById('sr1-reset-popup')) return;
        const popup = document.createElement('div');
        popup.id = 'sr1-reset-popup';
        popup.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(5, 5, 5, 0.95); border: 2px solid #00d4ff; border-radius: 10px; padding: 30px; z-index: 100000; text-align: center; color: white; font-family: 'Segoe UI', sans-serif; box-shadow: 0 0 30px rgba(0, 212, 255, 0.3);`;
        popup.innerHTML = `
            <h2 style="margin: 0 0 15px 0; color: #00d4ff; text-transform: uppercase; font-size: 18px;">Réinitialisation</h2>
            <p style="margin-bottom: 25px; font-size: 14px; color: #ccc;">Voulez-vous remettre toutes les fenêtres à leur position par défaut ?</p>
            <button id="btn-reset-ok" style="background: #00d4ff; color: black; border: none; padding: 10px 25px; font-weight: bold; cursor: pointer; margin-right: 10px; border-radius: 4px;">OUI, RESET</button>
            <button id="btn-reset-no" style="background: #333; color: white; border: none; padding: 10px 25px; cursor: pointer; border-radius: 4px;">ANNULER</button>
        `;
        document.body.appendChild(popup);
        document.getElementById('btn-reset-ok').onclick = () => { localStorage.removeItem(STORAGE_KEY); window.location.reload(); };
        document.getElementById('btn-reset-no').onclick = () => popup.remove();
    };

    const toggleEditMode = (forceValue = null) => {
        editEnabled = (forceValue !== null) ? forceValue : !editEnabled;
        document.body.classList.toggle('edit-mode-active', editEnabled);
        document.querySelectorAll('.editable-mod').forEach(m => updateModuleVisual(m));
        
        if (!editEnabled) {
            const menu = document.getElementById('hud-switcher');
            if (menu) menu.style.display = 'none';
        }
    };

    toggleHudEditor = toggleEditMode;
    isHudEditorActive = () => editEnabled;

    /* --- RÉCEPTION DES SIGNAUX ELECTRON --- */
    const api = window.overlayState || window.electronAPI;

    if (api) {
        api.onToggleEditMode((isEnabled) => {
            toggleEditMode(isEnabled);
        });

        api.onShowResetPopup(() => {
            showResetPopup();
        });

        if (api.onToggleVisibilityMenu) {
            api.onToggleVisibilityMenu(() => {
                const menu = document.getElementById('hud-switcher');
                if (menu && editEnabled) {
                    const isHidden = (menu.style.display === 'none' || menu.style.display === '');
                    menu.style.display = isHidden ? 'block' : 'none';
                }
            });
        }
    }

    /* --- GESTION DU CLAVIER POUR LE NAVIGATEUR (F9, F10, F12) --- */
    window.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.altKey) {
            if (e.key === 'F12') {
                e.preventDefault();
                toggleEditMode();
            }
            if (e.key === 'F10') {
                e.preventDefault();
                showResetPopup();
            }
            if (e.key === 'F9') {
                e.preventDefault();
                const menu = document.getElementById('hud-switcher');
                if (menu && editEnabled) {
                    const isHidden = (menu.style.display === 'none' || menu.style.display === '');
                    menu.style.display = isHidden ? 'block' : 'none';
                }
            }
        }
    });

    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    window.addEventListener('load', loadLayout);
})();