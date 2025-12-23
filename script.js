// ==========================================
// ⚠️ CONFIGURATION (REMPLIS TES INFOS ICI) ⚠️
// ==========================================

const CLIENT_ID = "1452733483922358363";      
const GUILD_ID = "1453095674638766161";     
const REDIRECT_URI = "https://pjpn-udf.netlify.app"; // Ex: https://monsite.netlify.app (pas de slash à la fin)

const ALLOWED_ROLES = [
    "1453098124342984727"
];

// WEBHOOKS (Déjà configurés)
const WEBHOOK_PDS = "https://discord.com/api/webhooks/1453106174269456424/JqbDXXfYJWeFH9yTB7JEUgSRdkmr5DjZNIxiLb_PItwanTmJY9gJuhLs0s1ntm15qI9e";
const WEBHOOK_PV = "https://discord.com/api/webhooks/1453106369765838850/g53oZ0v0hVE_gtcZ_UA6Lbm1JSXVP8QUqpvZEo4431gOeEqAhopvcbX74TrbRKmjjAM2";

// ==========================================

let currentUser = null;

function loginWithDiscord() {
    const scope = encodeURIComponent("identify guilds.members.read");
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${scope}`;
    window.location.href = url;
}

window.onload = () => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");
    if (accessToken) {
        fetchDiscordData(accessToken);
    }
};

async function fetchDiscordData(token) {
    try {
        const userRes = await fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${token}` } });
        const user = await userRes.json();
        
        const guildRes = await fetch(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, { headers: { authorization: `Bearer ${token}` } });
        
        if (!guildRes.ok) throw new Error("Erreur serveur");
        const member = await guildRes.json();
        
        const hasRole = member.roles.some(r => ALLOWED_ROLES.includes(r));

        if (hasRole) {
            launchDashboard(user, member.nick || user.global_name);
        } else {
            document.getElementById("error-message").style.display = "block";
        }
    } catch (err) {
        console.error(err);
        alert("Erreur: Vérifie tes IDs dans le script.js !");
    }
}

function launchDashboard(user, nickname) {
    currentUser = { name: nickname, avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` };
    
    // Bascule de l'écran Login vers Dashboard
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("dashboard-screen").classList.remove("hidden");
    
    // Remplissage infos
    document.getElementById("user-name").innerText = currentUser.name;
    document.getElementById("user-avatar").src = currentUser.avatar;

    window.history.replaceState({}, document.title, "/");
}

// Navigation des onglets
function showPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
    
    document.getElementById(pageId).classList.add('active');
    document.getElementById('btn-' + pageId).classList.add('active');
}

function logout() {
    window.location.href = REDIRECT_URI;
}

// Fonctions Webhooks
function envoyerPDS(type) {
    if (!currentUser) return;
    const isPrise = (type === 'prise');
    const color = isPrise ? 3069299 : 15158332;
    const msg = isPrise ? "🟢 PRISE DE SERVICE" : "🔴 FIN DE SERVICE";

    const payload = {
        embeds: [{
            title: msg,
            description: `**Agent:** ${currentUser.name}\n**Heure:** ${new Date().toLocaleTimeString()}`,
            color: color,
            thumbnail: { url: currentUser.avatar }
        }]
    };
    
    fetch(WEBHOOK_PDS, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    .then(() => alert("Statut mis à jour !"));
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

    const payload = {
        embeds: [{
            title: `📄 RAPPORT: ${type}`,
            description: `**Sujet:** ${titre}\n**Officier:** ${currentUser.name}\n\n${content}`,
            color: color,
            thumbnail: { url: currentUser.avatar },
            timestamp: new Date().toISOString()
        }]
    };

    fetch(WEBHOOK_PV, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
    .then(() => {
        alert("Rapport envoyé !");
        document.getElementById("pv-titre").value = "";
        document.getElementById("pv-content").value = "";
    });
}