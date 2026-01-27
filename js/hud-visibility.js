(function() {
    const modules = [
        'module-leaderboard', 'module-relative', 'module-strategie-course',  
        'module-meteo', 'module-pneus-detail', 'module-performance',  
        'module-systeme', 'module-etat-vehicule', 'module-flags', 'module-radio-team'
    ];

    const toggleDisplay = (id, show) => {
        const el = document.getElementById(id);
        if (el) {
            localStorage.setItem('vis_' + id, show);
            el.style.setProperty('display', show ? 'block' : 'none', 'important');
        }
    };

    const buildMenu = () => {
        if (document.getElementById('hud-switcher')) return;
        const menu = document.createElement('div');
        menu.id = 'hud-switcher';
        menu.style.cssText = `position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: rgba(10, 10, 10, 0.98); border: 2px solid #00d4ff; padding: 25px; z-index: 999999; color: #fff; font-family: sans-serif; border-radius: 12px; display: none;`;
        
        let html = `<h3 style='margin:0 0 20px 0; color:#00d4ff; text-align:center;'>VISIBILITÉ DES MODULES</h3>`;
        modules.forEach(id => {
            const isVisible = localStorage.getItem('vis_' + id) !== 'false';
            html += `<div style='margin-bottom:10px; display:flex; justify-content:space-between; align-items:center; width:250px;'>
                        <span style='font-size:12px;'>${id.replace('module-', '').toUpperCase()}</span>
                        <input type='checkbox' class='vis-chk' data-mod='${id}' ${isVisible ? 'checked' : ''}>
                     </div>`;
        });
        html += `<div style='margin-top:20px; border-top:1px solid #333; padding-top:10px; text-align:center;'>
                    <span style='font-size:10px; color:#00d4ff;'>RACCOURCI : CTRL + ALT + F9</span>
                 </div>`;
        menu.innerHTML = html;
        document.body.appendChild(menu);
        menu.querySelectorAll('.vis-chk').forEach(chk => {
            chk.onchange = (e) => toggleDisplay(e.target.dataset.mod, e.target.checked);
        });
    };

    const init = () => {
        modules.forEach(id => {
            const isVisible = localStorage.getItem('vis_' + id) !== 'false';
            const el = document.getElementById(id);
            if (el) el.style.setProperty('display', isVisible ? 'block' : 'none', 'important');
        });
        buildMenu();
    };

    if (document.readyState === 'complete') init();
    else window.addEventListener('load', init);
})();