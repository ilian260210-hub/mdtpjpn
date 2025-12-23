// =========================================================
// 1. CONFIGURATION (REMPLIS TES INFOS ICI)
// =========================================================

// 👇 COLLE TA CONFIG FIREBASE ICI 👇
const firebaseConfig = {
    apiKey: "AIzaSyDtFen2Y4hDrUCJ2liJRW2RCeSpqDCFqvo",
  authDomain: "mdtpj-77770.firebaseapp.com",
  projectId: "mdtpj-77770",
  storageBucket: "mdtpj-77770.firebasestorage.app",
  messagingSenderId: "680483447000",
  appId: "1:680483447000:web:606be70a09a0ce1c3d77ad",
  measurementId: "G-5M253L4EVJ"
};

// Initialisation Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// INFOS DISCORD
const CLIENT_ID = "1452733483922358363"; 
const GUILD_ID = "1453095674638766161"; 
const REDIRECT_URI = "https://mdtpjpn.vercel.app"; 

// RÔLES AUTORISÉS (ACCÈS BASIQUE)
const ALLOWED_ROLES = ["1453098124342984727"];

// RÔLES ADMIN (PEUVENT SUPPRIMER, VOIR PANEL ADMIN)
const ADMIN_ROLES = ["1453148877384581275"];

// WEBHOOKS
const WEBHOOK_PDS = "https://discord.com/api/webhooks/1453106174269456424/JqbDXXfYJWeFH9yTB7JEUgSRdkmr5DjZNIxiLb_PItwanTmJY9gJuhLs0s1ntm15qI9e";
const WEBHOOK_PV = "https://discord.com/api/webhooks/1453106369765838850/g53oZ0v0hVE_gtcZ_UA6Lbm1JSXVP8QUqpvZEo4431gOeEqAhopvcbX74TrbRKmjjAM2";

// =========================================================

let currentUser = null;
let enService = false;
let isAdmin = false;

// --- DÉMARRAGE ---
window.onload = () => {
    const localUser = localStorage.getItem("mdt_user_session");
    if (localUser) {
        currentUser = JSON.parse(localUser);
        verifierDroitsAdminLocal(); // Vérifie si admin dans la session
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

        // Vérification Basique
        if (member.roles.some(r => ALLOWED_ROLES.includes(r))) {
            
            // Vérification Admin
            isAdmin = member.roles.some(r => ADMIN_ROLES.includes(r));

            currentUser = { 
                id: user.id,
                name: member.nick || user.global_name, 
                avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
                admin: isAdmin
            };
            localStorage.setItem("mdt_user_session", JSON.stringify(currentUser));
            
            // Mise à jour annuaire
            db.collection("users").doc(currentUser.id).set({
                name: currentUser.name, avatar: currentUser.avatar, lastLogin: new Date()
            }, { merge: true });

            lancerInterface();
        } else {
            alert("Accès refusé."); window.location.href = "/";
        }
    } catch (e) { console.error(e); }
}

function verifierDroitsAdminLocal() {
    if(currentUser.admin === true) isAdmin = true;
}

function lancerInterface() {
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("dashboard-screen").classList.remove("hidden");
    document.getElementById("user-name").innerText = currentUser.name;
    document.getElementById("user-avatar").src = currentUser.avatar;
    window.history.replaceState({}, document.title, "/");

    // Afficher onglet Admin si Admin
    if(isAdmin) {
        document.getElementById("nav-admin").classList.remove("hidden");
    }

    ecouterRapports();
    ecouterEffectifs();
    verifierMonStatut();
}

// --- SYNCHRONISATION FIREBASE ---
function ecouterRapports() {
    db.collection("reports").orderBy("date", "desc").limit(30)
    .onSnapshot((snapshot) => {
        let stats = { total: 0, arrest: 0, pvi: 0, amende: 0, plainte: 0 };
        let htmlList = "";

        snapshot.forEach(doc => {
            const data = doc.data();
            const id = doc.id;
            stats.total++;
            
            let tagClass = "rt-info";
            if(data.type === "ARRESTATION") { stats.arrest++; tagClass = "rt-arrest"; }
            else if(data.type === "AMENDE") { stats.amende++; tagClass = "rt-amende"; }
            else if(data.type === "PVI") { stats.pvi++; tagClass = "rt-pvi"; }
            else if(data.type === "PLAINTE") { stats.plainte++; tagClass = "rt-plainte"; }

            // On rend l'élément cliquable pour ouvrir le modal
            // On échappe les guillemets simples dans le titre pour le onclick
            const safeTitle = data.titre.replace(/'/g, "\\'"); 
            
            htmlList += `
                <div class="report-mini-item" onclick="ouvrirModalRapport('${id}')">
                    <div>
                        <span class="rt-tag ${tagClass}">${data.type}</span>
                        <span style="font-weight:600; font-size:14px;">${data.titre}</span>
                    </div>
                    <div style="font-size:12px; color:#999;">
                        ${new Date(data.date.toDate()).toLocaleDateString()}
                    </div>
                </div>
            `;
        });

        // Update UI
        document.getElementById("stat-total").innerText = stats.total;
        document.getElementById("stat-arrest").innerText = stats.arrest;
        document.getElementById("stat-pvi").innerText = stats.pvi;
        document.getElementById("stat-amende").innerText = stats.amende;
        document.getElementById("stat-plainte").innerText = stats.plainte;
        document.getElementById("live-reports-list").innerHTML = htmlList;
    });
}

function ecouterEffectifs() {
    db.collection("users").onSnapshot((snapshot) => {
        let html = "";
        snapshot.forEach(doc => {
            const agent = doc.data();
            const tag = agent.enService ? `<span class="tag-on">EN SERVICE</span>` : `<span class="tag-off">HORS SERVICE</span>`;
            html += `<tr><td><img src="${agent.avatar}"></td><td style="font-weight:600">${agent.name}</td><td>${tag}</td></tr>`;
        });
        document.getElementById("effectif-list").innerHTML = html;
    });
}

// --- GESTION DU MODAL (DÉTAILS & SUPPRESSION) ---
async function ouvrirModalRapport(id) {
    const doc = await db.collection("reports").doc(id).get();
    if(!doc.exists) return;
    const data = doc.data();

    // Remplissage
    document.getElementById("modal-title").innerText = data.titre;
    document.getElementById("modal-type").innerText = data.type;
    document.getElementById("modal-author").innerText = data.officer;
    document.getElementById("modal-date").innerText = new Date(data.date.toDate()).toLocaleString();
    document.getElementById("modal-content").innerText = data.content;

    // Bouton Supprimer (Seulement si Admin)
    const footer = document.getElementById("modal-footer-actions");
    footer.innerHTML = ""; // Reset
    if(isAdmin) {
        footer.innerHTML = `<button onclick="supprimerRapport('${id}')" class="btn-delete"><i class="fas fa-trash"></i> Supprimer ce rapport</button>`;
    }

    // Afficher
    document.getElementById("modal-overlay").classList.remove("hidden");
}

function fermerModal() {
    document.getElementById("modal-overlay").classList.add("hidden");
}

function supprimerRapport(id) {
    if(confirm("Êtes-vous sûr de vouloir supprimer définitivement ce rapport ?")) {
        db.collection("reports").doc(id).delete()
        .then(() => {
            alert("Rapport supprimé.");
            fermerModal();
        })
        .catch(err => alert("Erreur: " + err));
    }
}

// --- ACTIONS UTILISATEUR ---

function verifierMonStatut() {
    db.collection("users").doc(currentUser.id).get().then((doc) => {
        if (doc.exists && doc.data().enService) {
            enService = true;
            document.getElementById("service-toggle").checked = true;
            updateUIService(true);
        }
    });
}

function toggleService() {
    // Récupérer l'état de la checkbox
    const isChecked = document.getElementById("service-toggle").checked;
    enService = isChecked;
    
    updateUIService(enService);

    // Update Firebase
    db.collection("users").doc(currentUser.id).update({ enService: enService });

    // Webhook
    const msg = enService ? "🟢 PRISE DE SERVICE" : "🔴 FIN DE SERVICE";
    const color = enService ? 3069299 : 15158332;
    envoyerWebhook(WEBHOOK_PDS, msg, color);
}

function updateUIService(isOn) {
    const txt = document.getElementById("service-text-status");
    const header = document.getElementById("header-status");
    
    if (isOn) {
        txt.innerText = "EN SERVICE"; txt.style.color = "#10b981";
        header.className = "status-badge online"; header.innerText = "En Service";
    } else {
        txt.innerText = "HORS SERVICE"; txt.style.color = "#991b1b";
        header.className = "status-badge offline"; header.innerText = "Hors Service";
    }
}

function envoyerRapport() {
    const titre = document.getElementById("pv-titre").value;
    const type = document.getElementById("pv-type").value;
    const content = document.getElementById("pv-content").value;

    if (!titre || !content) return alert("Champs vides !");

    // Firebase
    db.collection("reports").add({
        titre: titre, type: type, content: content,
        officer: currentUser.name, officerId: currentUser.id, date: new Date()
    });

    // Webhook (Couleurs adaptées)
    let color = 3447003; // Info (Bleu)
    if(type === "ARRESTATION") color = 15548997; // Rouge
    if(type === "AMENDE") color = 5763719; // Vert
    if(type === "PVI") color = 15105570; // Orange
    if(type === "PLAINTE") color = 9662683; // Violet

    const desc = `**Officier:** ${currentUser.name}\n**Titre:** ${titre}\n\n${content}`;
    envoyerWebhook(WEBHOOK_PV, `📄 RAPPORT : ${type}`, color, desc);

    alert("Envoyé !");
    document.getElementById("pv-titre").value = "";
    document.getElementById("pv-content").value = "";
}

function envoyerWebhook(url, titre, color, description) {
    fetch(url, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ embeds: [{ title: titre, description: description, color: color, thumbnail: { url: currentUser.avatar } }] })
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
