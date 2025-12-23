// ==========================================
// ⚠️ CONFIGURATION (REMPLIS TES INFOS ICI) ⚠️
// ==========================================

const CLIENT_ID = "1452733483922358363";      
const GUILD_ID = "1453095674638766161";     
const REDIRECT_URI = "https://mdtpjpn.vercel.app"; 

const ALLOWED_ROLES = [
    "1453098124342984727"
];

const WEBHOOK_PDS = "https://discord.com/api/webhooks/1453106174269456424/JqbDXXfYJWeFH9yTB7JEUgSRdkmr5DjZNIxiLb_PItwanTmJY9gJuhLs0s1ntm15qI9e";
const WEBHOOK_PV = "https://discord.com/api/webhooks/1453106369765838850/g53oZ0v0hVE_gtcZ_UA6Lbm1JSXVP8QUqpvZEo4431gOeEqAhopvcbX74TrbRKmjjAM2";

// ==========================================

let currentUser = null;
let serviceStatus = false; // false = OFF, true = ON

// --- STATS SYSTEM (Sauvegarde locale) ---
const stats = {
    arrestations: parseInt(localStorage.getItem('stats_arrest')) || 0,
    amendes: parseInt(localStorage.getItem('stats_amende')) || 0,
    interventions: parseInt(localStorage.getItem('stats_inter')) || 0,
    total: parseInt(localStorage.getItem('stats_total')) || 0
};

function updateStatsDisplay() {
    document.getElementById('count-arrest').innerText = stats.arrestations;
    document.getElementById('count-amende').innerText = stats.amendes;
    document.getElementById('count-inter').innerText = stats.interventions;
    document.getElementById('count-total').innerText = stats.total;
}

function incrementStat(type) {
    if (type === 'ARRESTATION') stats.arrestations++;
    else if (type === 'AMENDE') stats.amendes++;
    else if (type === 'INTERVENTION') stats.interventions++;
    
    stats.total++;

    // Sauvegarde
    localStorage.setItem('stats_arrest', stats.arrestations);
    localStorage.setItem('stats_amende', stats.amendes);
    localStorage.setItem('stats_inter', stats.interventions);
    localStorage.setItem('stats_total', stats.total);
    
    updateStatsDisplay();
}

// --- LOGIN DISCORD ---
function loginWithDiscord() {
    const scope = encodeURIComponent("identify guilds.members.read");
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${scope}`;
    window.location.href = url;
}

window.onload = () => {
    updateStatsDisplay(); // Charger les stats au démarrage
    
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    if (accessToken) fetchDiscordData(accessToken);
};

async function fetchDiscordData(token) {
    try {
        const userRes = await fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${token}` } });
        const user = await userRes.json();
        
        const guildRes = await fetch(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, { headers: { authorization: `Bearer ${token}` } });
        
        if (!guildRes.ok) throw new Error("Erreur serveur");
        const member = await guildRes.json();
        
        if (member.roles.some(r => ALLOWED_ROLES.includes(r))) {
            launchDashboard(user, member.nick || user.global_name);
        } else {
            alert("Accès refusé");
        }
    } catch (err) {
        console.error(err);
    }
}

function launchDashboard(user, nickname) {
    currentUser = { name: nickname, avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` };
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("dashboard-screen").classList.remove("hidden");
    document.getElementById("user-name").innerText = currentUser.name;
    document.getElementById("user-avatar").src = currentUser.avatar;
    window.history.replaceState({}, document.title, "/");
}

function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    document.getElementById(pageId).classList.add('active');
    document.getElementById('btn-' + pageId).classList.add('active');
}

function logout() {
    window.location.href = REDIRECT_URI;
}

// --- NOUVEAU SYSTÈME ON/OFF (État) ---
function toggleService() {
    serviceStatus = !serviceStatus; // On inverse l'état
    
    const display = document.getElementById('status-display');
    const icon = document.getElementById('status-icon');
    const text = document.getElementById('status-text');
    const btn = document.getElementById('btn-pds');
    const headerStatus = document.getElementById('header-status');

    if (serviceStatus) {
        // PASSER EN SERVICE
        display.classList.remove('inactive-service');
        display.classList.add('active-service');
        icon.className = "fas fa-user-shield";
        text.innerText = "EN SERVICE";
        
        btn.classList.remove('off');
        btn.classList.add('on');
        btn.innerHTML = '<i class="fas fa-sign-out-alt"></i> FIN DE SERVICE';
        
        headerStatus.classList.remove('offline');
        headerStatus.classList.add('online');
        headerStatus.innerText = "En Service";
        
        envoyerWebhookPDS(true);
    } else {
        // PASSER HORS SERVICE
        display.classList.remove('active-service');
        display.classList.add('inactive-service');
        icon.className = "fas fa-user-slash";
        text.innerText = "HORS SERVICE";
        
        btn.classList.remove('on');
        btn.classList.add('off');
        btn.innerHTML = '<i class="fas fa-power-off"></i> PRENDRE MON SERVICE';

        headerStatus.classList.remove('online');
        headerStatus.classList.add('offline');
        headerStatus.innerText = "Hors Service";

        envoyerWebhookPDS(false);
    }
}

function envoyerWebhookPDS(isPrise) {
    if (!currentUser) return;
    const color = isPrise ? 3069299 : 15158332;
    const msg = isPrise ? "🟢 PRISE DE SERVICE" : "🔴 FIN DE SERVICE";

    fetch(WEBHOOK_PDS, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            embeds: [{
                title: msg,
                description: `**Agent:** ${currentUser.name}\n**Heure:** ${new Date().toLocaleTimeString()}`,
                color: color,
                thumbnail: { url: currentUser.avatar }
            }]
        })
    });
}

function envoyerPV() {
    if (!currentUser) return;
    const titre = document.getElementById("pv-titre").value;
    const type = document.getElementById("pv-type").value;
    const content = document.getElementById("pv-content").value;

    if (!titre || !content) return alert("Remplissez tout !");

    let color = 3447003;
    if (type === "ARRESTATION") color = 15548997;
    if (type === "AMENDE") color = 5763719;

    // Incrémenter la stat locale
    incrementStat(type);

    fetch(WEBHOOK_PV, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            embeds: [{
                title: `📄 RAPPORT: ${type}`,
                description: `**Sujet:** ${titre}\n**Officier:** ${currentUser.name}\n\n${content}`,
                color: color,
                thumbnail: { url: currentUser.avatar },
                timestamp: new Date().toISOString()
            }]
        })
    }).then(() => {
        alert("Rapport envoyé et Stats mises à jour !");
        document.getElementById("pv-titre").value = "";
        document.getElementById("pv-content").value = "";
    });
}
