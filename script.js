// =========================================================
// 🛑 CONFIGURATION OBLIGATOIRE (REMPLIS CECI)
// =========================================================

const CLIENT_ID = "1452733483922358363"; 
const GUILD_ID = "1453095674638766161"; 
const REDIRECT_URI = "https://mdtpjpn.vercel.app"; // Pas de slash à la fin

// IDs des rôles autorisés
const ALLOWED_ROLES = [
    "1453098124342984727"
];

// WEBHOOKS
const WEBHOOK_PDS = "https://discord.com/api/webhooks/1453106174269456424/JqbDXXfYJWeFH9yTB7JEUgSRdkmr5DjZNIxiLb_PItwanTmJY9gJuhLs0s1ntm15qI9e";
const WEBHOOK_PV = "https://discord.com/api/webhooks/1453106369765838850/g53oZ0v0hVE_gtcZ_UA6Lbm1JSXVP8QUqpvZEo4431gOeEqAhopvcbX74TrbRKmjjAM2";

// =========================================================

let currentUser = null;
let enService = false;

// Gestion des Stats
const stats = {
    total: parseInt(localStorage.getItem('st_total')) || 0,
    arrest: parseInt(localStorage.getItem('st_arrest')) || 0,
    amende: parseInt(localStorage.getItem('st_amende')) || 0,
    inter: parseInt(localStorage.getItem('st_inter')) || 0
};

// --- 1. DÉMARRAGE (C'est ici que la magie opère) ---
window.onload = () => {
    // A. Est-ce qu'on est déjà connecté ? (Mémoire)
    const memoireUtilisateur = localStorage.getItem("mdt_user_session");
    
    if (memoireUtilisateur) {
        // OUI -> On charge direct le dashboard
        currentUser = JSON.parse(memoireUtilisateur);
        lancerInterface();
        majStats();
        return; // On arrête là, pas besoin de vérifier Discord
    }

    // B. Sinon, est-ce qu'on revient de Discord avec un token ?
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");

    if (accessToken) {
        verifierUtilisateurDiscord(accessToken);
    }
};

function loginWithDiscord() {
    const scope = encodeURIComponent("identify guilds.members.read");
    const url = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${scope}`;
    window.location.href = url;
}

async function verifierUtilisateurDiscord(token) {
    try {
        // Récupération Profil
        const userRes = await fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${token}` } });
        const user = await userRes.json();
        
        // Récupération Serveur & Rôles
        const guildRes = await fetch(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, { headers: { authorization: `Bearer ${token}` } });
        
        if (!guildRes.ok) throw new Error("Membre introuvable");
        const member = await guildRes.json();
        
        // Vérification Rôle
        const aLeRole = member.roles.some(r => ALLOWED_ROLES.includes(r));
        
        if (aLeRole) {
            // Création de l'objet utilisateur
            currentUser = { 
                name: member.nick || user.global_name, 
                avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
            };

            // SAUVEGARDE EN MÉMOIRE (C'est ça qui empêche le retour au login)
            localStorage.setItem("mdt_user_session", JSON.stringify(currentUser));

            lancerInterface();
        } else {
            alert("⛔ Accès refusé : Rôle insuffisant.");
            window.location.href = "/";
        }
    } catch (e) {
        console.error(e);
        alert("Erreur de connexion.");
    }
}

function lancerInterface() {
    // Masquer login, afficher dashboard
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("dashboard-screen").classList.remove("hidden");
    
    // Remplir les infos
    document.getElementById("user-name").innerText = currentUser.name;
    document.getElementById("user-avatar").src = currentUser.avatar;
    
    // Nettoyer l'URL (enlève le token moche)
    window.history.replaceState({}, document.title, "/");
    
    majStats();
}

function logout() {
    // On vide la mémoire pour vraiment déconnecter
    localStorage.removeItem("mdt_user_session");
    window.location.href = REDIRECT_URI;
}

// --- 2. NAVIGATION ---
function changerPage(pageId) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.menu-list li').forEach(li => li.classList.remove('active'));
    
    document.getElementById('page-' + pageId).classList.add('active');
    document.getElementById('nav-' + pageId).classList.add('active');
}

// --- 3. SERVICE ON/OFF ---
function toggleService() {
    if (!currentUser) return;
    
    enService = !enService;

    const card = document.getElementById("service-card");
    const icon = document.getElementById("service-icon");
    const text = document.getElementById("service-text");
    const btn = document.getElementById("btn-service");
    const headerStatus = document.getElementById("header-status");

    if (enService) {
        card.className = "service-card is-online";
        icon.className = "fas fa-user-shield";
        text.innerText = "EN SERVICE";
        btn.innerText = "FIN DE SERVICE";
        btn.style.background = "#ef4444";
        
        headerStatus.className = "status-badge online";
        headerStatus.innerText = "En Service";
        
        envoyerWebhook(WEBHOOK_PDS, "🟢 PRISE DE SERVICE", 3069299);
    } else {
        card.className = "service-card is-offline";
        icon.className = "fas fa-user-slash";
        text.innerText = "HORS SERVICE";
        btn.innerText = "PRENDRE MON SERVICE";
        btn.style.background = "#1f2937";

        headerStatus.className = "status-badge offline";
        headerStatus.innerText = "Hors Service";
        
        envoyerWebhook(WEBHOOK_PDS, "🔴 FIN DE SERVICE", 15158332);
    }
}

// --- 4. RAPPORTS & STATS ---
function envoyerRapport() {
    if (!currentUser) return;
    const titre = document.getElementById("pv-titre").value;
    const type = document.getElementById("pv-type").value;
    const content = document.getElementById("pv-content").value;

    if (!titre || !content) return alert("Remplis tous les champs !");

    // Incrémentation
    stats.total++;
    if(type === "ARRESTATION") stats.arrest++;
    if(type === "AMENDE") stats.amende++;
    if(type === "INTERVENTION") stats.inter++;

    // Sauvegarde Stats
    localStorage.setItem('st_total', stats.total);
    localStorage.setItem('st_arrest', stats.arrest);
    localStorage.setItem('st_amende', stats.amende);
    localStorage.setItem('st_inter', stats.inter);
    
    majStats();

    let color = 3447003;
    if(type === "ARRESTATION") color = 15548997;
    if(type === "AMENDE") color = 5763719;

    const description = `**Sujet :** ${titre}\n**Officier :** ${currentUser.name}\n\n${content}`;
    envoyerWebhook(WEBHOOK_PV, `📄 RAPPORT : ${type}`, color, description);
    
    alert("Rapport envoyé !");
    document.getElementById("pv-titre").value = "";
    document.getElementById("pv-content").value = "";
}

function majStats() {
    if(document.getElementById("stat-total")) {
        document.getElementById("stat-total").innerText = stats.total;
        document.getElementById("stat-arrest").innerText = stats.arrest;
        document.getElementById("stat-amende").innerText = stats.amende;
        document.getElementById("stat-inter").innerText = stats.inter;
    }
}

function envoyerWebhook(url, titre, color, description = "") {
    if (!currentUser) return;
    const desc = description || `**Agent :** ${currentUser.name}\n**Heure :** ${new Date().toLocaleTimeString()}`;

    fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            embeds: [{
                title: titre,
                description: desc,
                color: color,
                thumbnail: { url: currentUser.avatar },
                timestamp: new Date().toISOString()
            }]
        })
    }).catch(err => console.error(err));
}
