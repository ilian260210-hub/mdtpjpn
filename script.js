// =========================================================
// 1. CONFIGURATION (REMPLIS TES INFOS ICI)
// =========================================================

// 👇 COLLE ICI LE BLOC "firebaseConfig" DONNÉ PAR FIREBASE 👇
const firebaseConfig = {
    apiKey: "AIzaSy...",
    authDomain: "mdt-police.firebaseapp.com",
    projectId: "mdt-police",
    storageBucket: "mdt-police.appspot.com",
    messagingSenderId: "...",
    appId: "..."
};
// 👆 FIN DU COLLAGE 👆

// Initialisation de Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// TES INFOS DISCORD (Comme avant)
const CLIENT_ID = "TON_CLIENT_ID_DISCORD"; 
const GUILD_ID = "TON_ID_SERVEUR_DISCORD"; 
const REDIRECT_URI = "TON_LIEN_NETLIFY"; 
const ALLOWED_ROLES = ["ID_ROLE_1", "ID_ROLE_2"];

// WEBHOOKS
const WEBHOOK_PDS = "TON_WEBHOOK_PDS";
const WEBHOOK_PV = "TON_WEBHOOK_PV";

// =========================================================

let currentUser = null;
let enService = false;

// --- DÉMARRAGE ---
window.onload = () => {
    // Vérification session
    const localUser = localStorage.getItem("mdt_user_session");
    if (localUser) {
        currentUser = JSON.parse(localUser);
        lancerInterface();
    } else {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = fragment.get("access_token");
        if (accessToken) verifierUtilisateurDiscord(accessToken);
    }
};

// --- AUTHENTIFICATION ---
function loginWithDiscord() {
    const scope = encodeURIComponent("identify guilds.members.read");
    window.location.href = `https://discord.com/api/oauth2/authorize?client_id=${CLIENT_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&response_type=token&scope=${scope}`;
}

async function verifierUtilisateurDiscord(token) {
    try {
        const userRes = await fetch('https://discord.com/api/users/@me', { headers: { authorization: `Bearer ${token}` } });
        const user = await userRes.json();
        const guildRes = await fetch(`https://discord.com/api/users/@me/guilds/${GUILD_ID}/member`, { headers: { authorization: `Bearer ${token}` } });
        
        if (!guildRes.ok) throw new Error("Erreur serveur");
        const member = await guildRes.json();

        if (member.roles.some(r => ALLOWED_ROLES.includes(r))) {
            currentUser = { 
                id: user.id,
                name: member.nick || user.global_name, 
                avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png` 
            };
            localStorage.setItem("mdt_user_session", JSON.stringify(currentUser));
            
            // 🔥 ENREGISTRER L'UTILISATEUR DANS FIREBASE (POUR L'ANNUAIRE)
            db.collection("users").doc(currentUser.id).set({
                name: currentUser.name,
                avatar: currentUser.avatar,
                lastLogin: new Date(),
                // On ne touche pas au statut s'il existe déjà, sinon false
            }, { merge: true });

            lancerInterface();
        } else {
            alert("Accès refusé.");
            window.location.href = "/";
        }
    } catch (e) { console.error(e); }
}

function lancerInterface() {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("dashboard-screen").classList.remove("hidden");
    document.getElementById("user-name").innerText = currentUser.name;
    document.getElementById("user-avatar").src = currentUser.avatar;
    window.history.replaceState({}, document.title, "/");

    // Lancer les écoutes en temps réel (C'est ça qui synchronise tout !)
    ecouterRapports();
    ecouterEffectifs();
    verifierMonStatut();
}

// --- SYNCHRONISATION FIREBASE ---

// 1. ÉCOUTER LES RAPPORTS (Pour les stats partagées)
function ecouterRapports() {
    db.collection("reports").orderBy("date", "desc").limit(20)
    .onSnapshot((snapshot) => {
        let total = 0, arrest = 0, amende = 0, inter = 0;
        let htmlList = "";

        snapshot.forEach(doc => {
            const data = doc.data();
            total++;
            if(data.type === "ARRESTATION") arrest++;
            if(data.type === "AMENDE") amende++;
            if(data.type === "INTERVENTION") inter++;

            // Petit style pour la liste accueil
            let tagClass = "rt-info";
            if(data.type === "ARRESTATION") tagClass = "rt-arrest";
            if(data.type === "AMENDE") tagClass = "rt-amende";
            if(data.type === "INTERVENTION") tagClass = "rt-inter";

            htmlList += `
                <div class="report-mini-item">
                    <div>
                        <span class="report-tag ${tagClass}">${data.type}</span>
                        <span style="font-weight:600; font-size:13px;">${data.titre}</span>
                    </div>
                    <div style="font-size:11px; color:#999;">
                        ${new Date(data.date.toDate()).toLocaleDateString()} - par ${data.officer}
                    </div>
                </div>
            `;
        });

        // Mise à jour de l'interface
        document.getElementById("stat-total").innerText = total; // Note: C'est le total des 20 derniers, pour un vrai total il faudrait une autre méthode, mais ça suffit pour l'instant.
        document.getElementById("stat-arrest").innerText = arrest;
        document.getElementById("stat-amende").innerText = amende;
        document.getElementById("stat-inter").innerText = inter;
        document.getElementById("live-reports-list").innerHTML = htmlList;
    });
}

// 2. ÉCOUTER LES EFFECTIFS (Pour la liste des membres)
function ecouterEffectifs() {
    db.collection("users").onSnapshot((snapshot) => {
        let html = "";
        snapshot.forEach(doc => {
            const agent = doc.data();
            const statusClass = agent.enService ? "tag-on" : "tag-off";
            const statusText = agent.enService ? "EN SERVICE" : "HORS SERVICE";
            
            html += `
                <tr>
                    <td><img src="${agent.avatar}" alt="x"></td>
                    <td class="agent-name">${agent.name}</td>
                    <td><span class="tag-service ${statusClass}">${statusText}</span></td>
                </tr>
            `;
        });
        document.getElementById("effectif-list").innerHTML = html;
    });
}

// 3. VÉRIFIER MON STATUT AU CHARGEMENT
function verifierMonStatut() {
    db.collection("users").doc(currentUser.id).get().then((doc) => {
        if (doc.exists && doc.data().enService) {
            enService = true;
            updateUIService(true);
        }
    });
}

// --- ACTIONS ---

function toggleService() {
    enService = !enService;
    updateUIService(enService);

    // Mise à jour Firebase (Visible par tous !)
    db.collection("users").doc(currentUser.id).update({
        enService: enService
    });

    // Webhook
    const msg = enService ? "🟢 PRISE DE SERVICE" : "🔴 FIN DE SERVICE";
    const color = enService ? 3069299 : 15158332;
    envoyerWebhook(WEBHOOK_PDS, msg, color);
}

function updateUIService(isOn) {
    const card = document.getElementById("service-card");
    const btn = document.getElementById("btn-service");
    const header = document.getElementById("header-status");

    if (isOn) {
        card.className = "service-card is-online";
        document.getElementById("service-text").innerText = "EN SERVICE";
        document.getElementById("service-icon").className = "fas fa-user-shield";
        btn.innerText = "FIN DE SERVICE"; btn.style.background = "#ef4444";
        header.className = "status-badge online"; header.innerText = "En Service";
    } else {
        card.className = "service-card is-offline";
        document.getElementById("service-text").innerText = "HORS SERVICE";
        document.getElementById("service-icon").className = "fas fa-user-slash";
        btn.innerText = "PRENDRE MON SERVICE"; btn.style.background = "#1f2937";
        header.className = "status-badge offline"; header.innerText = "Hors Service";
    }
}

function envoyerRapport() {
    const titre = document.getElementById("pv-titre").value;
    const type = document.getElementById("pv-type").value;
    const content = document.getElementById("pv-content").value;

    if (!titre || !content) return alert("Remplissez tout !");

    // 1. Envoyer à Firebase (Pour que tout le monde le voie)
    db.collection("reports").add({
        titre: titre,
        type: type,
        content: content,
        officer: currentUser.name,
        officerId: currentUser.id,
        date: new Date()
    });

    // 2. Envoyer Webhook
    let color = 3447003;
    if(type === "ARRESTATION") color = 15548997;
    if(type === "AMENDE") color = 5763719;
    const desc = `**Officier:** ${currentUser.name}\n**Sujet:** ${titre}\n\n${content}`;
    envoyerWebhook(WEBHOOK_PV, `📄 RAPPORT : ${type}`, color, desc);

    alert("Rapport enregistré et synchronisé !");
    document.getElementById("pv-titre").value = "";
    document.getElementById("pv-content").value = "";
}

// Fonction générique webhook (la tienne)
function envoyerWebhook(url, titre, color, description) {
    fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            embeds: [{ title: titre, description: description, color: color, thumbnail: { url: currentUser.avatar } }]
        })
    }).catch(e => console.error(e));
}

// Navigation
function changerPage(id) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.menu-list li').forEach(li => li.classList.remove('active'));
    document.getElementById('page-' + id).classList.add('active');
    document.getElementById('nav-' + id).classList.add('active');
}
function logout() { localStorage.removeItem("mdt_user_session"); window.location.href = REDIRECT_URI; }
