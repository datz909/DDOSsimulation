/* =====================================================
   CyberSecure - script.js
   Logique du dashboard + simulation manuelle DDoS
   Projet de lycée - JavaScript pur, sans dépendance
   ===================================================== */

/* =========================================================
   1. NAVIGATION ENTRE LES PAGES
   ========================================================= */

const pageTitles = {
    dashboard: "Tableau de bord",
    simulation: "Simulation DDoS",
    devices: "Appareils connectés",
    alerts: "Centre des alertes",
    logs: "Journal des événements",
    security: "Sécurité du système",
    redteam: "Red Team"
};

function showPage(id, btnEl) {
    document.querySelectorAll(".page").forEach(function (p) {
        p.classList.remove("active-page");
    });
    document.getElementById(id).classList.add("active-page");

    document.querySelectorAll(".menu-btn").forEach(function (b) {
        b.classList.remove("active");
    });

    if (btnEl) {
        btnEl.classList.add("active");
    } else {
        // Cas où la page est ouverte depuis un bouton hors menu (ex: attack-zone)
        document.querySelectorAll(".menu-btn").forEach(function (b) {
            if (b.getAttribute("onclick") && b.getAttribute("onclick").indexOf("'" + id + "'") !== -1) {
                b.classList.add("active");
            }
        });
    }

    document.getElementById("pageTitle").textContent = pageTitles[id] || id;

    if (id === "redteam") requestAnimationFrame(renderRt);
    // Redessiner les canvas quand on affiche la page qui les contient
    if (id === "dashboard") requestAnimationFrame(drawNetworkMap);
    if (id === "simulation") {
        requestAnimationFrame(drawNetworkMap);
        requestAnimationFrame(drawTrafficChart);
    }
}

// Bouton "Ouvrir la simulation" sur le dashboard
document.addEventListener("DOMContentLoaded", function () {
    const goToSimBtn = document.getElementById("goToSimBtn");
    if (goToSimBtn) {
        goToSimBtn.addEventListener("click", function () {
            showPage("simulation", null);
        });
    }
});

/* =========================================================
   2. DATE / HORLOGE
   ========================================================= */

function updateClock() {
    const el = document.getElementById("currentDate");
    if (!el) return;
    const now = new Date();
    const options = { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" };
    el.textContent = now.toLocaleDateString("fr-FR", options);
}
updateClock();
setInterval(updateClock, 30000);

/* =========================================================
   3. CARTE DU RESEAU (canvas dashboard + simulation)
   ========================================================= */

const networkDevices = [
    { name: "SRV-WEB", online: true, target: true },
    { name: "SRV-DNS", online: true, target: false },
    { name: "SRV-FTP", online: false, target: false },
    { name: "PC-ADMIN", online: true, target: false }
];

function drawNetworkMap() {
    const canvas = document.getElementById("networkCanvas");
    if (!canvas) return;
    fitCanvas(canvas);
    const ctx = canvas.getContext("2d");
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const centerX = w / 2;
    const centerY = h / 2;

    // Noeud central = pare-feu / routeur
    const hub = { x: centerX, y: centerY };

    const angleStep = (Math.PI * 2) / networkDevices.length;
    const radius = Math.min(w, h) / 2.6;

    const points = networkDevices.map(function (dev, i) {
        const angle = i * angleStep - Math.PI / 2;
        return {
            x: centerX + Math.cos(angle) * radius,
            y: centerY + Math.sin(angle) * radius,
            dev: dev
        };
    });

    const underAttack = simState.running && !simState.ended;

    // Lignes attaquant -> hub (visuel uniquement) si attaque en cours
    if (underAttack) {
        for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = radius * 1.6;
            const ax = centerX + Math.cos(angle) * dist;
            const ay = centerY + Math.sin(angle) * dist;
            ctx.strokeStyle = "rgba(255,61,110,0.45)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(hub.x, hub.y);
            ctx.stroke();
            ctx.fillStyle = "rgba(255,61,110,0.9)";
            ctx.beginPath();
            ctx.arc(ax, ay, 3, 0, Math.PI * 2);
            ctx.fill();
        }
    }

    // Lignes hub -> appareils
    points.forEach(function (p) {
        ctx.strokeStyle = p.dev.online ? "rgba(0,240,255,0.5)" : "rgba(255,61,110,0.4)";
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(hub.x, hub.y);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
    });

    // Hub
    ctx.fillStyle = underAttack ? "#ff3d6e" : "#00f0ff";
    ctx.beginPath();
    ctx.arc(hub.x, hub.y, 14, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e6ebf5";
    ctx.font = "11px Share Tech Mono, monospace";
    ctx.textAlign = "center";
    ctx.fillText("Pare-feu", hub.x, hub.y + 28);

    // Appareils
    points.forEach(function (p) {
        ctx.fillStyle = p.dev.online ? "#39ff88" : "#ff3d6e";
        if (p.dev.target && underAttack) ctx.fillStyle = "#ffb020";
        ctx.beginPath();
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#e6ebf5";
        ctx.font = "11px Share Tech Mono, monospace";
        ctx.textAlign = "center";
        ctx.fillText(p.dev.name, p.x, p.y + 22);
    });
}

function fitCanvas(canvas) {
    const ratio = window.devicePixelRatio || 1;
    const width = canvas.clientWidth || canvas.parentElement.clientWidth;
    const height = canvas.clientHeight || 220;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.getContext("2d").setTransform(ratio, 0, 0, ratio, 0, 0);
}

window.addEventListener("resize", function () {
    drawNetworkMap();
    drawTrafficChart();
});

/* =========================================================
   4. GRAPHIQUE DE TRAFIC (canvas simulation)
   ========================================================= */

function drawTrafficChart() {
    const canvas = document.getElementById("trafficChart");
    if (!canvas) return;
    fitCanvas(canvas);
    const ctx = canvas.getContext("2d");
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    ctx.clearRect(0, 0, w, h);

    const history = simState.history;
    const padding = 20;

    // Grille horizontale
    ctx.strokeStyle = "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const y = padding + ((h - padding * 2) / 4) * i;
        ctx.beginPath();
        ctx.moveTo(padding, y);
        ctx.lineTo(w - padding, y);
        ctx.stroke();
    }

    if (history.length < 2) {
        ctx.fillStyle = "#8a93ab";
        ctx.font = "12px Segoe UI";
        ctx.textAlign = "center";
        ctx.fillText("En attente de données…", w / 2, h / 2);
        return;
    }

    const maxVal = Math.max.apply(null, history.concat([100]));
    const stepX = (w - padding * 2) / (history.length - 1);

    ctx.strokeStyle = "#00f0ff";
    ctx.shadowColor = "#00f0ff";
    ctx.shadowBlur = 10;
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach(function (val, i) {
        const x = padding + i * stepX;
        const y = h - padding - (val / maxVal) * (h - padding * 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Remplissage léger sous la courbe
    ctx.lineTo(padding + (history.length - 1) * stepX, h - padding);
    ctx.lineTo(padding, h - padding);
    ctx.closePath();
    ctx.shadowBlur = 0;
    ctx.fillStyle = "rgba(0,240,255,0.10)";
    ctx.fill();
}

/* =========================================================
   5. CONSEILS DE DEFENSE (contenu pédagogique)
   ========================================================= */

const tipsByType = {
    syn: "<p><strong>SYN Flood :</strong> l'attaquant envoie une multitude de paquets SYN sans jamais terminer la poignée de main TCP, ce qui sature la table des connexions à demi ouvertes du serveur.</p>" +
        "<p><strong>Conseils :</strong> active les <em>SYN Cookies</em> pour ne réserver de mémoire qu'après confirmation, réduis le délai d'expiration des connexions incomplètes, et envisage un filtrage géographique si les paquets proviennent d'une zone limitée.</p>",
    udp: "<p><strong>UDP Flood :</strong> l'attaquant inonde des ports aléatoires de paquets UDP, ce qui épuise la bande passante et force le serveur à répondre par des erreurs ICMP.</p>" +
        "<p><strong>Conseils :</strong> mets en place une <em>limitation de débit</em> par adresse source, désactive les services UDP non utilisés, et utilise le <em>blackholing</em> uniquement sur les sources les plus agressives pour ne pas couper le trafic légitime.</p>",
    http: "<p><strong>HTTP Flood :</strong> l'attaquant imite des requêtes web normales (souvent via un botnet), ce qui la rend difficile à distinguer d'un pic de fréquentation légitime.</p>" +
        "<p><strong>Conseils :</strong> utilise un <em>WAF</em> avec vérification <em>CAPTCHA</em>, répartis la charge via un <em>CDN</em>, et surveille les motifs de requêtes répétitifs (même URL, même User-Agent) pour distinguer un bot d'un vrai visiteur.</p>"
};

const generalTip = "<p>💡 <strong>Astuce générale :</strong> ne bloque jamais une IP uniquement parce qu'elle est active — vérifie d'abord son débit et son origine. Un faux positif fait fuir un vrai client et abîme ta réputation.</p>";

function updateTips(type) {
    const el = document.getElementById("tipsContent");
    if (!el) return;
    el.innerHTML = (tipsByType[type] || "") + generalTip;
}

/* =========================================================
   6. ETAT DE LA SIMULATION
   ========================================================= */

const simState = {
    running: false,
    ended: false,
    defenseModeActive: false,
    attackType: "syn",
    intensity: "moyenne",
    baseFlood: 90,
    mitigationFactor: 1,
    serverLoad: 4,
    serverCapacity: 500,
    reqPerSec: 150,
    blockedCount: 0,
    actionsLeft: 8,
    actionsMax: 8,
    reputation: 100,
    ipQueue: [],
    history: [],
    tickCount: 0,
    lowLoadStreak: 0,
    interval: null,
    logEntries: [],
    attackMode: "auto",          // "auto" (scénario classique) ou "manual" (Red Team)
    mit: { syn: 1, udp: 1, http: 1 }, // atténuation par vecteur (mode Red Team)
    rt: newRt()
};

const intensityFactors = { faible: 50, moyenne: 90, forte: 140 };

/* =========================================================
   7. SELECTION DU TYPE D'ATTAQUE / INTENSITE
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    document.querySelectorAll("#attackTypeGroup .pill").forEach(function (btn) {
        btn.addEventListener("click", function () {
            if (simState.running) return; // pas de triche en cours de partie
            document.querySelectorAll("#attackTypeGroup .pill").forEach(function (b) { b.classList.remove("active"); });
            btn.classList.add("active");
            simState.attackType = btn.getAttribute("data-type");
            updateTips(simState.attackType);
        });
    });

    document.querySelectorAll("#intensityGroup .pill").forEach(function (btn) {
        btn.addEventListener("click", function () {
            if (simState.running) return;
            document.querySelectorAll("#intensityGroup .pill").forEach(function (b) { b.classList.remove("active"); });
            btn.classList.add("active");
            simState.intensity = btn.getAttribute("data-level");
        });
    });

    document.getElementById("launchBtn").addEventListener("click", function () { launchAttack(false); });
    document.getElementById("defenseBtn").addEventListener("click", activateManualDefense);
    document.getElementById("resetBtn").addEventListener("click", resetSimulation);

    document.querySelectorAll(".cm-btn").forEach(function (btn) {
        btn.addEventListener("click", function () {
            applyCountermeasure(btn.getAttribute("data-defense-btn"));
        });
    });

    updateTips(simState.attackType);
});

/* =========================================================
   8. LANCEMENT DE L'ATTAQUE
   ========================================================= */

function launchAttack(manual) {
    if (simState.running) return;

    simState.running = true;
    simState.ended = false;
    simState.defenseModeActive = false;
    simState.baseFlood = intensityFactors[simState.intensity];
    simState.attackMode = manual ? "manual" : "auto";
    simState.mit = { syn: 1, udp: 1, http: 1 };
    simState.rt = newRt();
    if (manual) { simState.baseFlood = 0; simState.attackType = "syn"; }
    simState.mitigationFactor = 1;
    simState.serverLoad = 6;
    simState.blockedCount = 0;
    simState.actionsLeft = simState.actionsMax;
    simState.reputation = 100;
    simState.ipQueue = [];
    simState.history = [];
    simState.tickCount = 0;
    simState.lowLoadStreak = 0;

    document.getElementById("launchBtn").disabled = true;
    document.getElementById("defenseBtn").disabled = false;
    document.querySelectorAll("#attackTypeGroup .pill, #intensityGroup .pill").forEach(function (b) {
        b.disabled = true;
    });

    resetCountermeasureCards();
    clearIpTable();
    disableFirewallConsole("en attente");

    if (manual) {
        setBanner("state-attack", "⚔️ Opération Red Team en cours — un attaquant joue en direct");
        addLog("Opération Red Team lancée : l'attaquant constitue son botnet.", "danger");
    } else {
        setBanner("state-attack", "⚠️ Attaque " + attackLabel(simState.attackType) + " en cours — intensité " + simState.intensity);
        addLog("Attaque " + attackLabel(simState.attackType) + " lancée (intensité " + simState.intensity + ").", "danger");
    }
    updateTips(simState.attackType);

    sessionStats.attempts++;
    updateSessionRecap();
    pushGlobalAlert(
        "Attaque DDoS détectée",
        "Pic de trafic anormal sur SRV-WEB (" + (manual ? "opération Red Team" : attackLabel(simState.attackType) + ", intensité " + simState.intensity) + ").",
        "danger"
    );
    pushGlobalLogEntry((manual ? "Opération Red Team lancée" : "Attaque " + attackLabel(simState.attackType) + " lancée") + " sur SRV-WEB.", "log-red", "ALERTE");

    updateStatsDisplay();

    simState.interval = setInterval(simulationTick, 1200);
}

function attackLabel(type) {
    return { syn: "SYN Flood", udp: "UDP Flood", http: "HTTP Flood" }[type] || type;
}

/* =========================================================
   9. ACTIVATION DU MODE RIPOSTE MANUELLE
   ========================================================= */

function activateManualDefense() {
    if (!simState.running || simState.defenseModeActive) return;
    simState.defenseModeActive = true;
    document.getElementById("defenseBtn").disabled = true;

    document.querySelectorAll(".ip-block-btn").forEach(function (b) { b.disabled = false; });

    document.getElementById("firewallIpInput").disabled = false;
    document.getElementById("firewallBlockBtn").disabled = false;
    document.getElementById("firewallStatus").textContent = "en ligne";
    document.getElementById("firewallStatus").classList.add("firewall-online");
    flashFirewallMessage("Console prête. Colle ou glisse une IP analysée puis exécute le blocage.", "info");

    addLog("Mode riposte manuelle activé : contre-mesures et console du pare-feu disponibles.", "info");
    pushGlobalLogEntry("Mode riposte manuelle activé par l'administrateur.", "log-blue", "DEFENSE");
}

/* =========================================================
   10. BOUCLE DE SIMULATION (tick)
   ========================================================= */

function simulationTick() {
    if (!simState.running || simState.ended) return;
    simState.tickCount++;

    // Générer éventuellement une nouvelle IP dans la file
    if (simState.ipQueue.filter(function (ip) { return !ip.blocked && !ip.bot; }).length < 6 && Math.random() < 0.6) {
        spawnIp();
    }

    // Régénération lente des actions pour ne pas bloquer une partie longue
    if (simState.tickCount % 6 === 0 && simState.actionsLeft < simState.actionsMax) {
        simState.actionsLeft++;
        addLog("Une action de riposte supplémentaire est disponible.", "info");
    }

    const visibleMalicious = simState.ipQueue
        .filter(function (ip) { return ip.malicious && !ip.blocked; })
        .reduce(function (sum, ip) { return sum + ip.rate; }, 0);

    if (simState.attackMode === "manual") rtTick();
    else simState.reqPerSec = Math.round(
        simState.baseFlood * simState.mitigationFactor +
        visibleMalicious * simState.mitigationFactor * 0.6 +
        20
    );

    const loadDelta = (simState.reqPerSec / simState.serverCapacity) * 14 - 3;
    simState.serverLoad = clamp(simState.serverLoad + loadDelta, 0, 100);

    simState.history.push(simState.reqPerSec);
    if (simState.history.length > 30) simState.history.shift();

    updateStatsDisplay();
    renderIpTable();
    drawTrafficChart();
    drawNetworkMap();
    if (simState.attackMode === "manual") { aiTick(); rtSync(); }

    // Condition d'échec
    if (simState.serverLoad >= 100) {
        endSimulation(false);
        return;
    }

    // Mode Red Team : le défenseur gagne s'il tient la durée ou épuise l'attaquant
    if (simState.attackMode === "manual") {
        if (rtDefenderWins()) endSimulation(true);
        return;
    }

    // Condition de réussite : charge basse et maintenue après un minimum de temps
    if (simState.tickCount > 6 && simState.serverLoad < 15) {
        simState.lowLoadStreak++;
    } else {
        simState.lowLoadStreak = 0;
    }

    if (simState.lowLoadStreak >= 4) {
        endSimulation(true);
    }
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

/* =========================================================
   11. GENERATION DES IPs
   ========================================================= */

const originsLegit = ["🇫🇷 FR", "🇧🇪 BE", "🇨🇭 CH", "🇨🇦 CA"];
const originsMalicious = ["🇷🇺 RU", "🇰🇵 KP", "🇧🇷 BR", "🇻🇳 VN", "🇮🇷 IR"];

function randomIpAddress(malicious) {
    if (malicious) {
        return "45.14." + rnd(0, 255) + "." + rnd(1, 254);
    }
    return rnd(80, 95) + "." + rnd(0, 255) + "." + rnd(0, 255) + "." + rnd(1, 254);
}

function rnd(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function spawnIp() {
    // 60% de trafic malveillant, 25% légitime normal, 15% "power user" ambigu
    // En mode Red Team, seuls les bots du joueur sont malveillants : le reste est légitime
    const roll = simState.attackMode === "manual" ? 0.6 + Math.random() * 0.4 : Math.random();
    let malicious, rate, origin;

    if (roll < 0.6) {
        malicious = true;
        rate = rnd(50, 220);
        origin = originsMalicious[rnd(0, originsMalicious.length - 1)];
    } else if (roll < 0.85) {
        malicious = false;
        rate = rnd(2, 20);
        origin = originsLegit[rnd(0, originsLegit.length - 1)];
    } else {
        malicious = false;
        rate = rnd(25, 40); // client légitime à fort trafic : cas piège
        origin = originsLegit[rnd(0, originsLegit.length - 1)];
    }

    simState.ipQueue.push({
        id: "ip-" + Date.now() + "-" + rnd(0, 9999),
        ip: randomIpAddress(malicious),
        rate: rate,
        origin: origin,
        malicious: malicious,
        blocked: false,
        analyzed: false
    });

    // On garde la file lisible : max 8 lignes affichées
    if (simState.ipQueue.length > 8) {
        const old = simState.ipQueue.findIndex(function (i) { return !i.bot; }); // les bots ne disparaissent pas
        if (old !== -1) simState.ipQueue.splice(old, 1);
    }
}

function suspicionLevel(rate) {
    if (rate > 45) return { label: "⚠️ Débit anormal", cls: "badge-malicious" };
    if (rate >= 25) return { label: "🔸 À surveiller", cls: "badge-unknown" };
    return { label: "✅ Normal", cls: "badge-legit" };
}

/* =========================================================
   12. AFFICHAGE DE LA FILE D'IPs
   ========================================================= */

function clearIpTable() {
    const table = document.getElementById("ipTable");
    table.querySelectorAll(".ip-row:not(.ip-row-head)").forEach(function (r) { r.remove(); });
    document.getElementById("ipTableEmpty").style.display = "block";
    document.getElementById("ipQueueCount").textContent = "0";
}

function renderIpTable() {
    const table = document.getElementById("ipTable");
    const emptyMsg = document.getElementById("ipTableEmpty");

    table.querySelectorAll(".ip-row:not(.ip-row-head)").forEach(function (r) { r.remove(); });

    const visible = simState.ipQueue.filter(function (ip) { return !ip.blocked; });
    document.getElementById("ipQueueCount").textContent = visible.length;
    emptyMsg.style.display = simState.ipQueue.length === 0 ? "block" : "none";

    simState.ipQueue.slice().reverse().forEach(function (ip) {
        const row = document.createElement("div");
        row.className = "ip-row" + (ip.blocked ? " blocked" : "");
        row.setAttribute("draggable", ip.blocked ? "false" : "true");

        const ipCell = document.createElement("span");
        ipCell.className = "ip-address-cell";
        ipCell.textContent = ip.ip;
        row.appendChild(ipCell);

        const rateCell = document.createElement("span");
        rateCell.textContent = ip.rate + " req/s";
        row.appendChild(rateCell);

        const originCell = document.createElement("span");
        originCell.textContent = ip.origin;
        row.appendChild(originCell);

        const natureCell = document.createElement("span");
        if (!ip.analyzed) {
            natureCell.className = "badge-unknown";
            natureCell.textContent = "❔ Non analysée";
        } else {
            const suspicion = suspicionLevel(ip.rate);
            natureCell.className = suspicion.cls;
            natureCell.textContent = suspicion.label;
        }
        row.appendChild(natureCell);

        const actionCell = document.createElement("span");
        actionCell.className = "ip-action-cell";
        if (ip.blocked) {
            actionCell.textContent = "Bloquée";
        } else {
            if (!ip.analyzed) {
                const analyzeBtn = document.createElement("button");
                analyzeBtn.className = "ip-block-btn ip-analyze-btn";
                analyzeBtn.textContent = "Analyser";
                analyzeBtn.title = "Révèle le débit, l'origine et le niveau de suspicion de cette IP";
                analyzeBtn.disabled = !simState.defenseModeActive;
                analyzeBtn.addEventListener("click", function () { analyzeIp(ip.id); });
                actionCell.appendChild(analyzeBtn);
            } else {
                const copyBtn = document.createElement("button");
                copyBtn.className = "ip-copy-btn";
                copyBtn.textContent = "📋";
                copyBtn.title = "Copier cette adresse IP pour la coller dans la console du pare-feu";
                copyBtn.addEventListener("click", function () { copyIpToClipboard(ip.ip); });
                actionCell.appendChild(copyBtn);
            }
        }
        row.appendChild(actionCell);

        // Glisser-déposer réaliste : on fait glisser la ligne d'IP vers la console du pare-feu
        if (!ip.blocked) {
            row.addEventListener("dragstart", function (e) {
                e.dataTransfer.setData("text/plain", ip.ip);
                e.dataTransfer.effectAllowed = "copy";
                row.classList.add("dragging");
            });
            row.addEventListener("dragend", function () {
                row.classList.remove("dragging");
            });
        }

        table.appendChild(row);
    });
}

function analyzeIp(id) {
    const ip = simState.ipQueue.find(function (i) { return i.id === id; });
    if (!ip || ip.blocked || ip.analyzed) return;
    ip.analyzed = true;
    addLog("IP " + ip.ip + " analysée (" + ip.rate + " req/s, " + ip.origin + ").", "info");
    renderIpTable();
}

function copyIpToClipboard(ip) {
    // Méthode compatible avec l'ouverture directe du fichier (file://),
    // où l'API Clipboard moderne est parfois bloquée.
    const temp = document.createElement("textarea");
    temp.value = ip;
    temp.style.position = "fixed";
    temp.style.opacity = "0";
    document.body.appendChild(temp);
    temp.select();
    try {
        document.execCommand("copy");
        flashFirewallMessage("📋 " + ip + " copiée — colle-la dans la console du pare-feu.", "info");
    } catch (err) {
        flashFirewallMessage("Impossible de copier automatiquement : sélectionne l'IP à la main.", "warning");
    }
    document.body.removeChild(temp);
}

/* =========================================================
   12bis. CONSOLE DU PARE-FEU MANUEL
   ========================================================= */

function flashFirewallMessage(text, type) {
    const el = document.getElementById("firewallMessage");
    el.textContent = text;
    el.className = "firewall-message type-" + (type || "info");
}

function disableFirewallConsole(statusText, message) {
    const input = document.getElementById("firewallIpInput");
    const btn = document.getElementById("firewallBlockBtn");
    input.disabled = true;
    btn.disabled = true;
    input.value = "";
    updateFirewallPreview("");
    document.getElementById("firewallStatus").textContent = statusText;
    document.getElementById("firewallStatus").classList.remove("firewall-online");
    flashFirewallMessage(message || "La console s'active dès que la riposte manuelle est activée.", "info");
}

function updateFirewallPreview(value) {
    const preview = document.getElementById("firewallCmdPreview");
    const ip = (value || "").trim();
    preview.innerHTML = "iptables -A INPUT -s " +
        (ip ? "<strong>" + ip + "</strong>" : "<em>&lt;adresse IP&gt;</em>") +
        " -j DROP";
}

function executeFirewallBlock() {
    const input = document.getElementById("firewallIpInput");
    const value = input.value.trim();

    if (!simState.defenseModeActive || !simState.running) {
        flashFirewallMessage("La console n'est pas active pour le moment.", "warning");
        return;
    }

    if (!value) {
        flashFirewallMessage("❌ Commande invalide : entre une adresse IP avant d'exécuter.", "warning");
        return;
    }

    const target = simState.ipQueue.find(function (i) { return i.ip === value && !i.blocked; });

    if (!target) {
        flashFirewallMessage("❌ IP introuvable dans le trafic surveillé. Vérifie l'orthographe.", "warning");
        return;
    }

    if (!target.analyzed) {
        flashFirewallMessage("⚠️ Cette IP n'a pas encore été analysée. Clique sur « Analyser » d'abord.", "warning");
        return;
    }

    if (simState.actionsLeft <= 0) {
        flashFirewallMessage("❌ Aucune action disponible pour exécuter cette règle.", "warning");
        return;
    }

    target.blocked = true;
    simState.actionsLeft--;

    if (target.malicious) {
        simState.blockedCount++;
        simState.baseFlood = Math.max(15, simState.baseFlood - 10);
        flashFirewallMessage("✅ Règle ajoutée — trafic de " + target.ip + " rejeté (" + target.rate + " req/s bloqués).", "success");
        addLog("IP " + target.ip + " bloquée via le pare-feu : trafic malveillant confirmé (" + target.rate + " req/s).", "success");
        globalCounters.threatCount++;
        updateGlobalCounters();
        pushGlobalLogEntry("IP " + target.ip + " bloquée via iptables (" + target.rate + " req/s).", "log-green", "DEFENSE");
    } else {
        simState.reputation = clamp(simState.reputation - 12, 0, 100);
        flashFirewallMessage("⚠️ Règle ajoutée, mais " + target.ip + " était un visiteur légitime. Réputation impactée.", "warning");
        addLog("Faux positif : " + target.ip + " bloquée par erreur via le pare-feu. Réputation impactée.", "warning");
        pushGlobalLogEntry("Faux positif : " + target.ip + " bloquée par erreur (client légitime).", "log-orange", "ALERTE");
    }

    input.value = "";
    updateFirewallPreview("");
    updateStatsDisplay();
    renderIpTable();
}

document.addEventListener("DOMContentLoaded", function () {
    const input = document.getElementById("firewallIpInput");
    const btn = document.getElementById("firewallBlockBtn");
    const dropZone = document.getElementById("firewallDropZone");

    input.addEventListener("input", function () { updateFirewallPreview(input.value); });

    input.addEventListener("keydown", function (e) {
        if (e.key === "Enter") executeFirewallBlock();
    });

    btn.addEventListener("click", executeFirewallBlock);

    // Glisser-déposer une ligne d'IP directement dans la console
    dropZone.addEventListener("dragover", function (e) {
        e.preventDefault();
        dropZone.classList.add("drag-over");
    });
    dropZone.addEventListener("dragleave", function () {
        dropZone.classList.remove("drag-over");
    });
    dropZone.addEventListener("drop", function (e) {
        e.preventDefault();
        dropZone.classList.remove("drag-over");
        if (input.disabled) return;
        const ip = e.dataTransfer.getData("text/plain");
        if (ip) {
            input.value = ip;
            updateFirewallPreview(ip);
            input.focus();
        }
    });
});

/* =========================================================
   13. CONTRE-MESURES
   ========================================================= */

function resetCountermeasureCards() {
    document.querySelectorAll(".countermeasure-card").forEach(function (card) {
        card.classList.remove("applied", "weak-effect");
        const btn = card.querySelector(".cm-btn");
        btn.disabled = false;
        btn.textContent = "Appliquer";
    });
}

function applyCountermeasure(key) {
    if (!simState.defenseModeActive) return;
    const card = document.querySelector('.countermeasure-card[data-defense="' + key + '"]');
    if (!card || card.classList.contains("applied") || card.classList.contains("weak-effect")) return;

    if (simState.actionsLeft <= 0) {
        addLog("Aucune action disponible pour appliquer une contre-mesure.", "warning");
        return;
    }

    simState.actionsLeft--;
    const effective = card.getAttribute("data-effective") === simState.attackType;
    const btn = card.querySelector(".cm-btn");

    if (simState.attackMode === "manual") {
        // Red Team : la contre-mesure agit sur son vecteur, quel que soit celui de la salve en cours
        simState.mit[card.getAttribute("data-effective")] *= 0.5;
        card.classList.add("applied");
        btn.textContent = "Appliquée ✓";
        btn.disabled = true;
        addLog(card.querySelector("h3").textContent + " appliquée.", "success");
        updateStatsDisplay();
        rtSync();
        return;
    }

    if (effective) {
        simState.mitigationFactor *= 0.5;
        simState.baseFlood = Math.max(10, simState.baseFlood * 0.7);
        card.classList.add("applied");
        btn.textContent = "Appliquée ✓";
        addLog(card.querySelector("h3").textContent + " appliquée : contre-mesure adaptée, effet fort.", "success");
    } else {
        simState.mitigationFactor *= 0.9;
        card.classList.add("weak-effect");
        btn.textContent = "Effet limité";
        addLog(card.querySelector("h3").textContent + " appliquée : peu adaptée à ce type d'attaque, effet faible.", "warning");
    }

    btn.disabled = true;
    updateStatsDisplay();
}

/* =========================================================
   14. FIN DE SIMULATION
   ========================================================= */

function endSimulation(success) {
    simState.ended = true;
    simState.running = false;
    clearInterval(simState.interval);

    document.querySelectorAll(".ip-block-btn").forEach(function (b) { b.disabled = true; });
    document.querySelectorAll(".ip-copy-btn").forEach(function (b) { b.disabled = true; });
    document.querySelectorAll(".ip-row").forEach(function (r) { r.setAttribute("draggable", "false"); });
    document.getElementById("defenseBtn").disabled = true;
    document.getElementById("launchBtn").disabled = false;
    document.querySelectorAll("#attackTypeGroup .pill, #intensityGroup .pill").forEach(function (b) {
        b.disabled = false;
    });
    disableFirewallConsole(
        success ? "menace neutralisée" : "serveur hors ligne",
        success ? "✅ Simulation terminée : la menace a été neutralisée." : "🚨 Simulation terminée : le serveur est tombé."
    );

    if (success) {
        const score = Math.round(simState.actionsLeft * 10 + simState.reputation);
        setBanner("state-success", "✅ Attaque neutralisée avec succès !");
        addLog("Simulation réussie. Score final : " + score + " points (actions restantes : " +
            simState.actionsLeft + ", réputation : " + simState.reputation + "%).", "success");

        sessionStats.victories++;
        if (sessionStats.bestScore === null || score > sessionStats.bestScore) {
            sessionStats.bestScore = score;
        }
        updateSessionRecap();

        setSrvWebStatus(true);
        pushGlobalAlert(
            "Attaque neutralisée",
            "SRV-WEB a résisté à l'attaque grâce aux contre-mesures appliquées (score : " + score + ").",
            "success"
        );
        pushGlobalLogEntry("Simulation réussie — score final " + score + " points.", "log-green", "INFO");
    } else {
        setBanner("state-critical", "🚨 SERVEUR HORS LIGNE — le système a été submergé par l'attaque.");
        addLog("Échec de la simulation : la charge serveur a atteint 100%.", "danger");

        updateSessionRecap();

        setSrvWebStatus(false);
        pushGlobalAlert(
            "Serveur SRV-WEB hors ligne",
            "La charge du serveur a atteint 100% : le système a cessé de répondre.",
            "danger"
        );
        pushGlobalLogEntry("Échec de la simulation — SRV-WEB hors ligne.", "log-red", "ALERTE");
    }
    rtSync();
}

/* =========================================================
   15. REINITIALISATION
   ========================================================= */

function resetSimulation() {
    clearInterval(simState.interval);

    simState.running = false;
    simState.ended = false;
    simState.defenseModeActive = false;
    simState.mitigationFactor = 1;
    simState.serverLoad = 4;
    simState.reqPerSec = 150;
    simState.blockedCount = 0;
    simState.actionsLeft = simState.actionsMax;
    simState.reputation = 100;
    simState.ipQueue = [];
    simState.history = [];
    simState.tickCount = 0;
    simState.lowLoadStreak = 0;
    simState.logEntries = [];

    document.getElementById("launchBtn").disabled = false;
    document.getElementById("defenseBtn").disabled = true;
    document.querySelectorAll("#attackTypeGroup .pill, #intensityGroup .pill").forEach(function (b) {
        b.disabled = false;
    });

    resetCountermeasureCards();
    clearIpTable();
    setBanner("", "Système au repos — aucune menace active");
    disableFirewallConsole("en attente");
    setSrvWebStatus(true);

    const simLog = document.getElementById("simLog");
    simLog.innerHTML = '<p class="sim-log-empty">Aucun événement pour le moment. Lancez une simulation pour commencer.</p>';
    document.getElementById("simEventCount").textContent = "0";
    simState.attackMode = "auto";
    simState.mit = { syn: 1, udp: 1, http: 1 };
    simState.rt = newRt();

    updateStatsDisplay();
    drawTrafficChart();
    drawNetworkMap();
    rtSync();
}

/* =========================================================
   16. MISE A JOUR DE L'AFFICHAGE DES STATS
   ========================================================= */

function updateStatsDisplay() {
    document.getElementById("reqPerSec").textContent = simState.reqPerSec;
    document.getElementById("attackerIpCount").textContent =
        simState.ipQueue.filter(function (ip) { return ip.malicious && !ip.blocked; }).length;
    document.getElementById("blockedCount").textContent = simState.blockedCount;

    const loadPercent = Math.round(simState.serverLoad);
    document.getElementById("serverLoadValue").textContent = loadPercent + "%";
    document.getElementById("serverLoadPercentLabel").textContent = loadPercent + "%";

    const bar = document.getElementById("serverLoadBar");
    bar.style.width = loadPercent + "%";
    bar.classList.remove("level-warning", "level-danger");
    const statusEl = document.getElementById("serverLoadStatus");
    if (loadPercent >= 75) {
        bar.classList.add("level-danger");
        statusEl.textContent = "critique";
    } else if (loadPercent >= 40) {
        bar.classList.add("level-warning");
        statusEl.textContent = "élevée";
    } else {
        statusEl.textContent = "nominale";
    }

    document.getElementById("actionsLeft").textContent = simState.actionsLeft;
    document.getElementById("reputationValue").textContent = simState.reputation + "%";
    const repStatus = document.getElementById("reputationStatus");
    if (simState.reputation >= 90) repStatus.textContent = "aucune erreur";
    else if (simState.reputation >= 60) repStatus.textContent = "quelques erreurs";
    else repStatus.textContent = "trop de faux positifs";
}

/* =========================================================
   17. BANNIERE D'ETAT
   ========================================================= */

function setBanner(stateClass, text) {
    const banner = document.getElementById("simBanner");
    banner.classList.remove("state-attack", "state-success", "state-critical");
    if (stateClass) banner.classList.add(stateClass);
    document.getElementById("simBannerText").textContent = text;
}

/* =========================================================
   18. JOURNAL DE LA SIMULATION
   ========================================================= */

function addLog(message, type) {
    const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    simState.logEntries.unshift({ time: time, message: message, type: type });
    if (simState.logEntries.length > 40) simState.logEntries.pop();

    const container = document.getElementById("simLog");
    container.innerHTML = "";
    simState.logEntries.forEach(function (entry) {
        const div = document.createElement("div");
        div.className = "sim-log-entry type-" + entry.type;
        div.innerHTML = '<span class="time">' + entry.time + '</span><span>' + entry.message + '</span>';
        container.appendChild(div);
    });

    document.getElementById("simEventCount").textContent = simState.logEntries.length;
}

/* =========================================================
   20. TABLEAU DE BORD GLOBAL (alertes, journal, appareils)
   ========================================================= */

const globalCounters = { alertCount: 2, threatCount: 17 };
const sessionStats = { attempts: 0, victories: 0, bestScore: null };

function updateGlobalCounters() {
    document.getElementById("alertCount").textContent = globalCounters.alertCount;
    document.getElementById("smallAlertCount").textContent = globalCounters.alertCount;
    document.getElementById("threatCount").textContent = globalCounters.threatCount;
}

function updateSessionRecap() {
    if (window.csSaveStats) window.csSaveStats();
    document.getElementById("sessionAttempts").textContent = sessionStats.attempts;
    document.getElementById("sessionVictories").textContent = sessionStats.victories;
    document.getElementById("sessionBestScore").textContent =
        sessionStats.bestScore === null ? "—" : sessionStats.bestScore + " pts";
}

function pushGlobalAlert(title, desc, level) {
    // level attendu : "danger", "warning" ou "success"
    const icon = level === "danger" ? "🚨" : level === "success" ? "✅" : "⚠️";
    const priority = level === "danger" ? "ÉLEVÉE" : level === "success" ? "RÉSOLUE" : "MOYENNE";
    const tagText = level === "danger" ? "ACTIVE" : level === "success" ? "RÉSOLU" : "EN COURS";

    const big = document.createElement("div");
    big.className = "big-alert " + level;
    big.innerHTML =
        '<div class="alert-icon">' + icon + '</div>' +
        '<div><h3>' + title + '</h3><p>' + desc + '</p><small>Priorité : ' + priority + '</small></div>' +
        '<span class="alert-tag ' + level + '-tag">' + tagText + '</span>';

    const allAlerts = document.getElementById("allAlerts");
    allAlerts.insertBefore(big, allAlerts.firstChild);
    while (allAlerts.children.length > 6) allAlerts.removeChild(allAlerts.lastChild);

    const mini = document.createElement("div");
    mini.className = "mini-alert " + level;
    mini.innerHTML = '<span>' + icon + '</span><div><strong>' + title + '</strong><small>' + desc + '</small></div>';

    const miniList = document.getElementById("dashboardAlerts");
    miniList.insertBefore(mini, miniList.firstChild);
    while (miniList.children.length > 3) miniList.removeChild(miniList.lastChild);

    if (level === "danger") {
        globalCounters.alertCount++;
    } else if (level === "success") {
        globalCounters.alertCount = Math.max(2, globalCounters.alertCount - 1);
    }
    updateGlobalCounters();
}

function pushGlobalLogEntry(message, tagClass, tagText) {
    const time = new Date().toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
    const row = document.createElement("div");
    row.className = "log";
    row.innerHTML = '<span>' + time + '</span><strong class="' + tagClass + '">' + tagText + '</strong> ' + message;

    const list = document.getElementById("logsList");
    list.insertBefore(row, list.firstChild);
    while (list.children.length > 25) list.removeChild(list.lastChild);
}

function setSrvWebStatus(online) {
    const dot = document.getElementById("dashSrvWebDot");
    const text = document.getElementById("dashSrvWebText");
    const badge = document.getElementById("networkStatusBadge");
    const rowStatus = document.getElementById("devicesSrvWebStatus");

    if (online) {
        dot.classList.remove("offline");
        dot.classList.add("online");
        text.textContent = "En ligne";
        text.className = "green-text";
        badge.textContent = "EN LIGNE";
        badge.classList.remove("badge-critical");
        rowStatus.textContent = "● En ligne";
        rowStatus.className = "table-online";
    } else {
        dot.classList.remove("online");
        dot.classList.add("offline");
        text.textContent = "Hors ligne";
        text.className = "red-text";
        badge.textContent = "SOUS ATTAQUE";
        badge.classList.add("badge-critical");
        rowStatus.textContent = "● Hors ligne";
        rowStatus.className = "table-offline";
    }
}

/* =========================================================
   21. INITIALISATION AU CHARGEMENT
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {
    drawNetworkMap();
    drawTrafficChart();
    updateGlobalCounters();
    updateSessionRecap();
});


/* =========================================================
   22. RED TEAM : jouer l'attaquant (solo ou duo)
   Les actions de l'attaquant modifient la MEME simState que
   l'onglet Simulation. En duo, la fenêtre du défenseur "héberge"
   la simulation et la fenêtre de l'attaquant lui envoie ses ordres.
   ========================================================= */

const botTypes = [
    { key: "iot", icon: "📷", name: "Caméra IoT", cost: 15, rate: [55, 80], origins: originsMalicious, tip: "Puissante mais bruyante : débit anormal, facile à repérer." },
    { key: "pc", icon: "💻", name: "PC zombie", cost: 20, rate: [26, 40], origins: originsLegit, tip: "Débit ambigu et origine banale : peut passer pour un vrai client." },
    { key: "res", icon: "🏠", name: "Box résidentielle", cost: 10, rate: [12, 22], origins: originsLegit, tip: "Quasi invisible mais faible. À recruter en nombre." },
    { key: "srv", icon: "🖥️", name: "Serveur compromis", cost: 35, rate: [120, 180], origins: originsMalicious, tip: "Très puissant, mais l'analyse le démasque aussitôt." }
];
const rtVectors = ["syn", "udp", "http"];
const RT = { maxBots: 10, salvoCost: 10, salvoTicks: 3, cooldown: 4, duration: 75 };
const aiLevels = { debutant: { period: 5, thr: 70 }, standard: { period: 3, thr: 45 }, expert: { period: 2, thr: 26 } };
const rtLocal = { link: "local", ai: "standard", remoteView: null, lastSeen: 0, peerSeen: 0 };
const rtEmpty = { manual: false, running: false, ended: false, won: false, load: 0, req: 0, tick: 0, credits: 100, cooldown: 0, salvo: 0, vector: "syn", peak: 0, bots: [], log: [] };

function newRt() {
    return { credits: 100, cooldown: 0, salvo: 0, vector: "syn", peak: 0, ai: null };
}

// Appelée à chaque tick du mode Red Team : calcule le flux entrant
function rtTick() {
    const rt = simState.rt;
    rt.credits = Math.min(100, rt.credits + 3);
    if (rt.cooldown > 0) rt.cooldown--;
    const power = simState.ipQueue
        .filter(function (i) { return i.bot && !i.blocked; })
        .reduce(function (s, i) { return s + i.rate; }, 0);
    // Botnet au repos : 10% du débit ; pendant une salve : x2, réduit par les contre-mesures du vecteur
    simState.reqPerSec = Math.round(20 + power * (rt.salvo > 0 ? 2 : 0.1) * simState.mit[rt.vector]);
    if (rt.salvo > 0) rt.salvo--;
    rt.peak = Math.max(rt.peak, Math.round(simState.serverLoad));
}

function rtDefenderWins() {
    const live = simState.ipQueue.filter(function (i) { return i.bot && !i.blocked; }).length;
    return simState.tickCount >= RT.duration || (simState.tickCount > 5 && live === 0 && simState.rt.credits < 10);
}

// Défenseur IA (solo) : analyse puis bloque, plus ou moins vite selon le niveau
function aiTick() {
    const rt = simState.rt;
    const lv = rt.ai && aiLevels[rt.ai];
    if (!lv || simState.tickCount % lv.period) return;
    const open = simState.ipQueue.filter(function (i) { return !i.blocked; });
    const fresh = open.find(function (i) { return !i.analyzed; });
    if (fresh) { fresh.analyzed = true; return; }
    const bad = open.filter(function (i) { return i.rate >= lv.thr; }).sort(function (a, b) { return b.rate - a.rate; })[0];
    if (bad) {
        bad.blocked = true;
        if (bad.malicious) { simState.blockedCount++; globalCounters.threatCount++; updateGlobalCounters(); }
        addLog("🤖 Défenseur IA : IP " + bad.ip + " bloquée (" + bad.rate + " req/s).", "success");
        updateStatsDisplay();
        renderIpTable();
        return;
    }
    if (simState.serverLoad > 35 && simState.mit[rt.vector] === 1) {
        simState.mit[rt.vector] = 0.5;
        const card = document.querySelector('.countermeasure-card[data-effective="' + rt.vector + '"]:not(.applied)');
        if (card) {
            card.classList.add("applied");
            card.querySelector(".cm-btn").textContent = "Appliquée ✓";
            card.querySelector(".cm-btn").disabled = true;
        }
        addLog("🤖 Défenseur IA : contre-mesure " + attackLabel(rt.vector) + " activée.", "success");
    }
}

// Ordres de l'attaquant (exécutés sur la fenêtre qui héberge la simulation)
function rtApply(op, p) {
    const rt = simState.rt;
    const playing = simState.attackMode === "manual" && simState.running && !simState.ended;
    const live = simState.ipQueue.filter(function (i) { return i.bot && !i.blocked; }).length;

    if (op === "start" && !simState.running) {
        launchAttack(true);
        simState.rt.ai = p.defender === "ia" ? (aiLevels[p.level] ? p.level : "standard") : null;
    } else if (op === "reset") {
        resetSimulation();
    } else if (op === "recruit" && playing) {
        const bt = botTypes.find(function (b) { return b.key === p.type; });
        if (!bt || rt.credits < bt.cost || live >= RT.maxBots) return;
        rt.credits -= bt.cost;
        simState.ipQueue.push({
            id: "bot-" + Date.now() + "-" + rnd(0, 9999),
            ip: randomIpAddress(bt.origins !== originsLegit),
            rate: rnd(bt.rate[0], bt.rate[1]),
            origin: bt.origins[rnd(0, bt.origins.length - 1)],
            malicious: true, blocked: false, analyzed: false, bot: true, btype: bt.key
        });
        addLog("Nouvelle source de trafic détectée.", "warning");
    } else if (op === "salvo" && playing) {
        if (rtVectors.indexOf(p.vector) === -1 || rt.credits < RT.salvoCost || rt.cooldown > 0 || live === 0) return;
        rt.credits -= RT.salvoCost;
        rt.salvo = RT.salvoTicks;
        rt.cooldown = RT.cooldown;
        rt.vector = p.vector;
        simState.attackType = p.vector;
        updateTips(p.vector);
        addLog("Salve " + attackLabel(p.vector) + " détectée : pic de trafic.", "danger");
    }
    updateStatsDisplay();
    renderIpTable();
    rtSync();
}

// Photo de l'état de la simulation, vue côté attaquant
function rtView() {
    const s = simState;
    return {
        manual: s.attackMode === "manual", running: s.running, ended: s.ended,
        won: s.ended && s.serverLoad >= 100,
        load: Math.round(s.serverLoad), req: s.reqPerSec, tick: s.tickCount,
        credits: Math.round(s.rt.credits), cooldown: s.rt.cooldown, salvo: s.rt.salvo,
        vector: s.rt.vector, peak: s.rt.peak,
        bots: s.ipQueue.filter(function (i) { return i.bot; }).map(function (i) {
            return { ip: i.ip, type: i.btype, rate: i.rate, blocked: i.blocked };
        }),
        log: s.logEntries.slice(0, 8)
    };
}

/* ---------- Liaison entre deux fenêtres (mode duo) ---------- */

const duoId = Math.random().toString(36).slice(2);
let duoCh = null;

function duoSend(msg) {
    msg.from = duoId;
    msg.n = Date.now() + Math.random();
    if (duoCh) duoCh.postMessage(msg);
    try { localStorage.setItem("cs-duo", JSON.stringify(msg)); } catch (e) { /* ignoré */ }
}

function duoOnMessage(msg) {
    if (!msg || msg.from === duoId || msg.n === duoOnMessage.last) return;
    duoOnMessage.last = msg.n;
    if (rtLocal.link === "remote") {            // fenêtre de l'attaquant
        if (msg.t === "state") {
            rtLocal.remoteView = msg.view;
            rtLocal.lastSeen = Date.now();
            renderRt();
        }
    } else if (msg.t === "hello" || msg.t === "cmd") { // fenêtre du défenseur (hôte)
        rtLocal.peerSeen = Date.now();
        if (msg.t === "cmd") rtApply(msg.op, msg.p || {});
        else duoSend({ t: "state", view: rtView() });
    }
}

function rtSend(op, p) {
    if (rtLocal.link === "remote") duoSend({ t: "cmd", op: op, p: p || {} });
    else rtApply(op, p || {});
}

// Met à jour l'affichage Red Team et prévient l'attaquant distant s'il y en a un
function rtSync() {
    renderRt();
    if (rtLocal.link !== "remote" && Date.now() - rtLocal.peerSeen < 6000) {
        duoSend({ t: "state", view: rtView() });
    }
}

/* ---------- Affichage de l'onglet Red Team ---------- */

function renderRt() {
    const el = function (id) { return document.getElementById(id); };
    if (!el("rtBanner")) return;
    const remote = rtLocal.link === "remote";
    const v = remote ? (rtLocal.remoteView || rtEmpty) : rtView();
    const linked = !remote || Date.now() - rtLocal.lastSeen < 5000;
    const live = v.bots.filter(function (b) { return !b.blocked; }).length;
    const busy = v.running && !v.manual;
    const playing = v.manual && v.running && !v.ended;

    el("rtCredits").textContent = v.credits;
    el("rtBotCount").textContent = live + " / " + v.bots.length;
    el("rtLoad").textContent = v.load + "%";
    el("rtLoadLabel").textContent = v.load + "%";
    el("rtReq").textContent = v.req;
    el("rtTime").textContent = playing ? Math.max(0, Math.round((RT.duration - v.tick) * 1.2)) + " s" : "—";
    const bar = el("rtLoadBar");
    bar.style.width = v.load + "%";
    bar.classList.toggle("level-warning", v.load >= 40 && v.load < 75);
    bar.classList.toggle("level-danger", v.load >= 75);

    let cls = "", txt = "Prêt — lance l'opération pour commencer à recruter.";
    if (remote && !linked) txt = "⏳ En attente de la fenêtre du défenseur…";
    else if (busy) { cls = "state-attack"; txt = "Une attaque automatique est en cours dans l'onglet Simulation : réinitialise-la d'abord."; }
    else if (v.manual && v.ended) {
        cls = v.won ? "state-success" : "state-critical";
        txt = v.won ? "🏆 Serveur abattu ! Pic de charge : " + v.peak + "%." : "🛡️ La défense a tenu — opération échouée (pic : " + v.peak + "%).";
    } else if (playing) {
        cls = "state-attack";
        txt = v.salvo > 0 ? "💥 Salve " + attackLabel(v.vector) + " en cours !" : "Botnet en attente — recrute, puis envoie une salve.";
    }
    const ban = el("rtBanner");
    ban.classList.remove("state-attack", "state-success", "state-critical");
    if (cls) ban.classList.add(cls);
    el("rtBannerText").textContent = txt;

    el("rtLinkInfo").textContent = remote
        ? (linked ? "🔗 Défenseur connecté. Il doit cliquer sur « Activer la riposte manuelle » dans l'onglet Simulation DDoS."
                  : "Ouvre cette même page dans une 2ᵉ fenêtre : ton camarade y reste sur l'onglet « Simulation DDoS » et défend.")
        : "Défenseur IA (niveau " + rtLocal.ai + ") : il analyse et bloque tes bots. Suis ses actions dans l'onglet Simulation DDoS.";
    el("rtAiWrap").style.display = remote ? "none" : "";

    el("rtStartBtn").disabled = v.running || !linked;
    document.querySelectorAll("[data-bot]").forEach(function (b) {
        const bt = botTypes.find(function (x) { return x.key === b.dataset.bot; });
        b.disabled = !playing || v.credits < bt.cost || live >= RT.maxBots;
    });
    document.querySelectorAll("[data-vector]").forEach(function (b) {
        b.disabled = !playing || v.credits < RT.salvoCost || v.cooldown > 0 || live === 0;
    });
    document.querySelectorAll("#rtModeGroup .pill, #rtAiGroup .pill").forEach(function (b) { b.disabled = v.running; });

    el("rtBots").innerHTML = v.bots.length ? v.bots.slice().reverse().map(function (b) {
        const bt = botTypes.find(function (x) { return x.key === b.type; }) || botTypes[0];
        return '<div class="rt-bot' + (b.blocked ? " blocked" : "") + '"><span>' + bt.icon + '</span><div><strong>' + bt.name +
            '</strong><br><small>' + b.ip + " · " + b.rate + ' req/s</small></div><span class="rt-state">' +
            (b.blocked ? "🚫 bloqué" : "actif") + "</span></div>";
    }).join("") : '<p class="sim-log-empty">Aucun bot recruté.</p>';

    el("rtLog").innerHTML = v.log.length ? v.log.map(function (e) {
        return '<div class="sim-log-entry type-' + e.type + '"><span class="time">' + e.time + "</span><span>" + e.message + "</span></div>";
    }).join("") : '<p class="sim-log-empty">Aucun événement pour le moment.</p>';
}

document.addEventListener("DOMContentLoaded", function () {
    const grid = document.getElementById("rtRecruitGrid");
    if (!grid) return;

    botTypes.forEach(function (bt) {
        grid.insertAdjacentHTML("beforeend",
            '<div class="countermeasure-card"><div class="cm-head"><span class="cm-icon">' + bt.icon + "</span><h3>" + bt.name + "</h3></div><p>" +
            bt.tip + '</p><small class="cm-tip">' + bt.cost + " crédits · " + bt.rate[0] + "–" + bt.rate[1] +
            ' req/s</small><button class="cm-btn" data-bot="' + bt.key + '">Recruter</button></div>');
    });
    grid.addEventListener("click", function (e) {
        if (e.target.dataset && e.target.dataset.bot) rtSend("recruit", { type: e.target.dataset.bot });
    });

    const sg = document.getElementById("rtSalvoGroup");
    rtVectors.forEach(function (v) {
        sg.insertAdjacentHTML("beforeend", '<button class="pill rt-salvo" data-vector="' + v + '">💥 ' + attackLabel(v) + "</button>");
    });
    sg.addEventListener("click", function (e) {
        if (e.target.dataset && e.target.dataset.vector) rtSend("salvo", { vector: e.target.dataset.vector });
    });

    document.querySelectorAll("#rtModeGroup .pill").forEach(function (b) {
        b.addEventListener("click", function () {
            document.querySelectorAll("#rtModeGroup .pill").forEach(function (x) { x.classList.remove("active"); });
            b.classList.add("active");
            rtLocal.link = b.dataset.rtmode === "duo" ? "remote" : "local";
            rtLocal.remoteView = null;
            rtLocal.lastSeen = 0;
            if (rtLocal.link === "remote") duoSend({ t: "hello" });
            renderRt();
        });
    });
    document.querySelectorAll("#rtAiGroup .pill").forEach(function (b) {
        b.addEventListener("click", function () {
            document.querySelectorAll("#rtAiGroup .pill").forEach(function (x) { x.classList.remove("active"); });
            b.classList.add("active");
            rtLocal.ai = b.dataset.ai;
            renderRt();
        });
    });

    document.getElementById("rtStartBtn").addEventListener("click", function () {
        rtSend("start", { defender: rtLocal.link === "remote" ? "humain" : "ia", level: rtLocal.ai });
    });
    document.getElementById("rtResetBtn").addEventListener("click", function () { rtSend("reset"); });

    // Canaux de communication entre fenêtres (BroadcastChannel + repli localStorage)
    if ("BroadcastChannel" in window) {
        duoCh = new BroadcastChannel("cybersecure-duo");
        duoCh.onmessage = function (e) { duoOnMessage(e.data); };
    }
    window.addEventListener("storage", function (e) {
        if (e.key === "cs-duo" && e.newValue) {
            try { duoOnMessage(JSON.parse(e.newValue)); } catch (err) { /* ignoré */ }
        }
    });
    setInterval(function () {
        if (rtLocal.link === "remote") { duoSend({ t: "hello" }); renderRt(); }
    }, 2000);

    renderRt();
});

/* =========================================================
   23. EFFET SOURIS (halo doux + lueur dans les panneaux)
   ========================================================= */

(function () {
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const glow = document.createElement("div");
    glow.id = "mouseGlow";
    document.addEventListener("DOMContentLoaded", function () { document.body.appendChild(glow); });

    document.addEventListener("mousemove", function (e) {
        glow.style.transform = "translate(" + (e.clientX - 150) + "px," + (e.clientY - 150) + "px)";
        glow.style.opacity = "1";

        const spot = e.target.closest && e.target.closest(".panel, .stat-card, .security-card");
        if (spot) {
            const r = spot.getBoundingClientRect();
            spot.style.setProperty("--mx", (e.clientX - r.left) + "px");
            spot.style.setProperty("--my", (e.clientY - r.top) + "px");
        }
    });
    document.addEventListener("mouseleave", function () { glow.style.opacity = "0"; });
})();


/* =========================================================
   24. COOKIES + COMPTES UTILISATEURS
   Tout est stocké dans le navigateur (projet pédagogique).
   Les cookies passent par document.cookie ; si le navigateur les
   refuse (ex : page ouverte en file://), on se rabat sur le
   stockage local pour que ça marche quand même.
   ========================================================= */

(function () {

    /* ---------- Cookies ---------- */

    function setCookie(name, value, days) {
        let c = name + "=" + encodeURIComponent(value) + "; path=/; SameSite=Lax" + (location.protocol === "https:" ? "; Secure" : "");
        if (days) c += "; expires=" + new Date(Date.now() + days * 864e5).toUTCString();
        document.cookie = c;
        try {
            localStorage.removeItem("ck_" + name);
            sessionStorage.removeItem("ck_" + name);
            (days ? localStorage : sessionStorage).setItem("ck_" + name,
                JSON.stringify({ v: value, exp: days ? Date.now() + days * 864e5 : 0 }));
        } catch (e) { /* stockage indisponible */ }
    }

    function getCookie(name) {
        const m = document.cookie.split("; ").find(function (r) { return r.indexOf(name + "=") === 0; });
        if (m) return decodeURIComponent(m.slice(name.length + 1));
        try {
            const raw = localStorage.getItem("ck_" + name) || sessionStorage.getItem("ck_" + name);
            if (raw) {
                const o = JSON.parse(raw);
                if (!o.exp || o.exp > Date.now()) return o.v;
            }
        } catch (e) { /* ignoré */ }
        return null;
    }

    function delCookie(name) {
        document.cookie = name + "=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        try { localStorage.removeItem("ck_" + name); sessionStorage.removeItem("ck_" + name); } catch (e) { /* ignoré */ }
    }

    /* ---------- Comptes ---------- */

    function readJson(key) {
        try { return JSON.parse(localStorage.getItem(key)) || {}; } catch (e) { return {}; }
    }
    function writeJson(key, obj) {
        try { localStorage.setItem(key, JSON.stringify(obj)); } catch (e) { /* ignoré */ }
    }

    function randomHex(n) {
        const a = new Uint8Array(n);
        (window.crypto || window.msCrypto).getRandomValues(a);
        return Array.from(a).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
    }

    // Mot de passe : jamais stocké en clair, uniquement une empreinte salée.
    // PBKDF2 (150 000 itérations) pour les nouveaux comptes ; SHA-256 simple conservé pour les anciens.
    function toHex(buf) {
        return Array.from(new Uint8Array(buf)).map(function (x) { return x.toString(16).padStart(2, "0"); }).join("");
    }
    async function hashPassword(pw, salt, algo) {
        const enc = new TextEncoder();
        const s = window.crypto && window.crypto.subtle;
        if (s && algo === "pbkdf2") {
            const key = await s.importKey("raw", enc.encode(pw), "PBKDF2", false, ["deriveBits"]);
            return toHex(await s.deriveBits({ name: "PBKDF2", salt: enc.encode(salt), iterations: 150000, hash: "SHA-256" }, key, 256));
        }
        const data = enc.encode(salt + ":" + pw);
        if (s) return toHex(await s.digest("SHA-256", data));
        let h = 5381; // repli minimal si SubtleCrypto est indisponible
        data.forEach(function (c) { h = ((h << 5) + h + c) >>> 0; });
        return "f" + h.toString(16);
    }

    function startSession(email, remember) {
        const sessions = readJson("cs_sessions");
        const token = randomHex(24);
        sessions[token] = email;
        writeJson("cs_sessions", sessions);
        setCookie("cs_session", token, remember ? 7 : 0);
    }

    function currentUser() {
        const token = getCookie("cs_session");
        if (!token) return null;
        const email = readJson("cs_sessions")[token];
        const user = email && readJson("cs_users")[email];
        return user ? Object.assign({ email: email }, user) : null;
    }

    function endSession() {
        const token = getCookie("cs_session");
        if (token) {
            const sessions = readJson("cs_sessions");
            delete sessions[token];
            writeJson("cs_sessions", sessions);
        }
        delCookie("cs_session");
    }

    /* ---------- Statistiques par compte ---------- */

    window.csSaveStats = function () {
        const u = currentUser();
        if (!u) return;
        const all = readJson("cs_stats");
        all[u.email] = { attempts: sessionStats.attempts, victories: sessionStats.victories, bestScore: sessionStats.bestScore };
        writeJson("cs_stats", all);
    };
    function loadStats(u) {
        const s = readJson("cs_stats")[u.email] || {};
        sessionStats.attempts = s.attempts || 0;
        sessionStats.victories = s.victories || 0;
        sessionStats.bestScore = s.bestScore === undefined ? null : s.bestScore;
        updateSessionRecap();
    }

    /* ---------- Démarrage de l'interface ---------- */

    document.addEventListener("DOMContentLoaded", function () {
        const $ = function (id) { return document.getElementById(id); };
        if (!$("authScreen")) return;

        let mode = "login";
        let failures = 0;
        let lockedUntil = 0;
        try { lockedUntil = parseInt(localStorage.getItem("cs_lock"), 10) || 0; } catch (e) { /* ignoré */ }
        let visitsCounted = false;
        let restored = false;

        /* ----- Consentement cookies ----- */

        function readConsent() {
            try { return JSON.parse(getCookie("cs_consent")); } catch (e) { return null; }
        }
        let consent = readConsent();

        function saveConsent(c) {
            consent = c;
            setCookie("cs_consent", JSON.stringify(c), 180);
            if (!c.prefs) delCookie("cs_prefs");
            if (!c.stats) delCookie("cs_visits");
            $("cookieBanner").hidden = true;
            $("cookieModal").hidden = true;
            const u = currentUser();
            if (u) applyUser(u);
        }

        function openCookieModal() {
            $("ckPrefs").checked = !!(consent && consent.prefs);
            $("ckStats").checked = !!(consent && consent.stats);
            $("cookieModal").hidden = false;
        }

        $("ckAccept").addEventListener("click", function () { saveConsent({ prefs: true, stats: true }); });
        $("ckRefuse").addEventListener("click", function () { saveConsent({ prefs: false, stats: false }); });
        $("ckCustom").addEventListener("click", openCookieModal);
        $("cookieSettingsBtn").addEventListener("click", openCookieModal);
        $("ckClose").addEventListener("click", function () { $("cookieModal").hidden = true; });
        $("ckSave").addEventListener("click", function () {
            saveConsent({ prefs: $("ckPrefs").checked, stats: $("ckStats").checked });
        });
        if (!consent) $("cookieBanner").hidden = false;

        // La dernière page visitée n'est mémorisée que si l'utilisateur l'a accepté
        const baseShowPage = window.showPage;
        window.showPage = function (id, btn) {
            baseShowPage(id, btn);
            if (consent && consent.prefs && currentUser()) setCookie("cs_prefs", id, 180);
        };

        /* ----- Affichage selon l'état de connexion ----- */

        function applyUser(u) {
            $("userName").textContent = u.name;
            $("userIcon").textContent = u.name.charAt(0).toUpperCase();

            let visits = "";
            if (consent && consent.stats) {
                let n = parseInt(getCookie("cs_visits"), 10) || 0;
                if (!visitsCounted) { n++; visitsCounted = true; setCookie("cs_visits", n, 180); }
                visits = " · visite n°" + n;
            }
            $("userSub").textContent = (u.provider ? "via " + u.provider : "Session active") + visits;

            loadStats(u);
            $("authScreen").hidden = true;
            document.body.classList.remove("locked");

            if (!restored) {
                restored = true;
                const last = consent && consent.prefs && getCookie("cs_prefs");
                if (last && document.getElementById(last)) {
                    const btn = Array.prototype.slice.call(document.querySelectorAll(".menu-btn")).find(function (b) {
                        return (b.getAttribute("onclick") || "").indexOf("'" + last + "'") !== -1;
                    });
                    if (btn) window.showPage(last, btn);
                }
            }
        }

        function showAuth() {
            $("authScreen").hidden = false;
            document.body.classList.add("locked");
            $("authForm").reset();
            $("authError").textContent = "";
            $("strength").hidden = true;
            Object.assign(sessionStats, { attempts: 0, victories: 0, bestScore: null });
            updateSessionRecap();
        }

        /* ----- Onglets connexion / inscription ----- */

        function setMode(m) {
            mode = m;
            document.querySelectorAll(".auth-tab").forEach(function (t) {
                t.classList.toggle("active", t.dataset.tab === m);
            });
            const signup = m === "signup";
            $("fieldName").hidden = !signup;
            $("fieldConfirm").hidden = !signup;
            $("strength").hidden = !signup;
            $("authPass").autocomplete = signup ? "new-password" : "current-password";
            $("authSubmit").textContent = signup ? "Créer mon compte" : "Se connecter";
            $("authError").textContent = "";
        }
        document.querySelectorAll(".auth-tab").forEach(function (t) {
            t.addEventListener("click", function () { setMode(t.dataset.tab); });
        });

        $("authPass").addEventListener("input", function () {
            const p = $("authPass").value;
            const score = (p.length >= 8) + (/[A-Z]/.test(p)) + (/[0-9]/.test(p)) + (/[^A-Za-z0-9]/.test(p));
            const bar = $("strengthBar");
            bar.style.width = (p ? Math.max(score, 1) * 25 : 0) + "%";
            bar.className = score >= 4 ? "good" : score >= 2 ? "mid" : "";
        });

        function fail(msg) { $("authError").textContent = msg; }

        /* ----- Formulaire e-mail + mot de passe ----- */

        $("authForm").addEventListener("submit", async function (e) {
            e.preventDefault();
            fail("");

            if (Date.now() < lockedUntil) {
                fail("Trop d'essais. Réessaie dans " + Math.ceil((lockedUntil - Date.now()) / 1000) + " s.");
                return;
            }

            const email = $("authEmail").value.trim().toLowerCase();
            const pass = $("authPass").value;
            const remember = $("authRemember").checked;
            const users = readJson("cs_users");

            if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return fail("Adresse e-mail invalide.");
            if (pass.length < 8) return fail("Le mot de passe doit faire au moins 8 caractères.");

            if (mode === "signup") {
                const name = $("authName").value.trim();
                if (!/^[\p{L}\p{N} ._-]{2,20}$/u.test(name)) return fail("Nom d'utilisateur : 2 à 20 caractères (lettres, chiffres, espace, . _ -).");
                if (pass !== $("authConfirm").value) return fail("Les deux mots de passe ne correspondent pas.");
                if (users[email]) return fail("Un compte existe déjà avec cette adresse.");

                const salt = randomHex(8);
                users[email] = { name: name, salt: salt, algo: "pbkdf2", hash: await hashPassword(pass, salt, "pbkdf2") };
                writeJson("cs_users", users);
                startSession(email, remember);
                pushGlobalLogEntry("Nouveau compte créé : " + name + ".", "log-green", "INFO");
                applyUser(currentUser());
                return;
            }

            const u = users[email];
            const ok = u && u.hash && (await hashPassword(pass, u.salt, u.algo)) === u.hash;
            if (!ok) {
                failures++;
                if (failures >= 5) {
                    lockedUntil = Date.now() + 30000;
                    try { localStorage.setItem("cs_lock", lockedUntil); } catch (e) { /* ignoré */ }
                    failures = 0;
                    pushGlobalLogEntry("5 échecs de connexion consécutifs : accès verrouillé 30 s.", "log-red", "ALERTE");
                    return fail("Trop d'essais. Accès verrouillé 30 secondes.");
                }
                return fail("Identifiants incorrects.");
            }
            failures = 0;
            startSession(email, remember);
            pushGlobalLogEntry("Connexion réussie : " + u.name + ".", "log-green", "INFO");
            applyUser(currentUser());
        });

        /* ----- Déconnexion ----- */

        $("logoutBtn").addEventListener("click", function () {
            endSession();
            pushGlobalLogEntry("Déconnexion de l'administrateur.", "log-blue", "INFO");
            showAuth();
        });

        /* ----- État initial ----- */

        const user = currentUser();
        if (user) applyUser(user);
        else showAuth();
    });
})();
