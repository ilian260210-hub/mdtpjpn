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
let currentReportId = null;

window.onload = () => {
    const localUser = localStorage.getItem("mdt_final_v7");
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = fragment.get("access_token");

    if (accessToken) {
        verifierUtilisateurDiscord(accessToken);
    } else if (localUser) {
        try {
            currentUser = JSON.parse(localUser);
            if (!currentUser.id) throw new Error("Session invalide");
            if(currentUser.isAdmin) {
                isAdmin = true;
                document.getElementById("nav-admin").classList.remove("hidden");
            }
            lancerInterface();
        } catch(e) {
            logout();
        }
    }
};

function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    let icon = type === 'success' ? 'fa-check-circle' : type === 'error' ? 'fa-exclamation-circle' : 'fa-info-circle';
    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

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
            isAdmin = member.roles.some(r => ADMIN_ROLES.includes(r));
            currentUser = { 
                id: user.id, name: member.nick || user.global_name, 
                avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`, isAdmin: isAdmin 
            };
            localStorage.setItem("mdt_final_v7", JSON.stringify(currentUser));
            db.collection("users").doc(currentUser.id).set({ name: currentUser.name, avatar: currentUser.avatar, lastLogin: new Date() }, { merge: true });
            lancerInterface();
        } else {
            alert("Accès refusé."); window.location.href = "/";
        }
    } catch (e) { console.error(e); }
}

function lancerInterface() {
    const loader = document.getElementById("loading-overlay");
    if(loader) loader.classList.remove("hidden");
    document.getElementById("login-screen").classList.add("hidden");
    
    if(currentUser) {
        document.getElementById("user-name").innerText = currentUser.name;
        document.getElementById("user-avatar").src = currentUser.avatar;
    }
    window.history.replaceState({}, document.title, "/");
    if(isAdmin) document.getElementById("nav-admin").classList.remove("hidden");

    try {
        ecouterRapports(); ecouterEffectifs(); ecouterMails(); verifierMonStatut();
    } catch(e) { console.error(e); }

    setTimeout(() => {
        if(loader) {
            loader.style.opacity = "0";
            setTimeout(() => {
                loader.classList.add("hidden");
                document.getElementById("dashboard-screen").classList.remove("hidden");
            }, 800);
        }
    }, 3000);
}

// --- GESTION DES RAPPORTS (CORRIGÉE) ---
// ... (LE DÉBUT AVEC LES CONFIGS RESTE LE MÊME) ...

// --- FONCTION DE DEBUG POUR LES RAPPORTS ---
function traiterRapport() {
    console.log("Tentative d'envoi du rapport...");

    // 1. Récupération des valeurs
    const t = document.getElementById("pv-titre").value;
    const ty = document.getElementById("pv-type").value;
    const c = document.getElementById("pv-content").value;
    
    // 2. Vérification champs vides
    if(!t || !c) { 
        showToast("Erreur : Titre ou contenu vide !", "error"); 
        return; 
    }

    // 3. Vérification de l'utilisateur (Sécurité)
    if(!currentUser || !currentUser.id) {
        showToast("Erreur : Utilisateur non connecté.", "error");
        return;
    }

    // 4. Préparation des données
    const reportData = {
        titre: t, 
        type: ty, 
        content: c,
        officer: currentUser.name, 
        officerId: currentUser.id, 
        date: new Date()
    };

    console.log("Données prêtes :", reportData);

    // 5. Envoi vers Firebase
    // Si c'est une modification
    if(currentReportId) {
        db.collection("reports").doc(currentReportId).update(reportData)
        .then(() => {
            showToast("Rapport modifié avec succès !", "success");
            annulerEdition();
        })
        .catch((error) => {
            console.error("Erreur modif : ", error);
            showToast("Erreur lors de la modification.", "error");
        });
    } 
    // Si c'est une création (Nouveau rapport)
    else {
        db.collection("reports").add(reportData)
        .then(() => {
            console.log("Rapport envoyé à la DB !");
            
            // Webhook Discord
            let col = 3447003; // Bleu par défaut
            if(ty === "ARRESTATION") col = 15548997; // Rouge
            if(ty === "AMENDE") col = 2140013; // Vert
            
            envoyerWebhook(WEBHOOK_PV, `📄 ${ty}`, col, `**Officier:** ${currentUser.name}\n**Titre:** ${t}\n\n${c}`);
            
            showToast("Rapport transmis avec succès !", "success");
            
            // Vider le formulaire
            document.getElementById("pv-titre").value = ""; 
            document.getElementById("pv-content").value = "";
        })
        .catch((error) => {
            console.error("Erreur envoi : ", error);
            showToast("Erreur technique : " + error.message, "error");
        });
    }
}

// ... (LE RESTE DU FICHIER RESTE IDENTIQUE) ...
// --- ADMIN : MODIFIER / SUPPRIMER ---
async function ouvrirModal(id) {
    const d = await db.collection("reports").doc(id).get();
    if(!d.exists) return;
    const data = d.data();
    
    document.getElementById("modal-title").innerText = data.titre;
    document.getElementById("modal-content").innerText = data.content;
    document.getElementById("modal-author").innerText = data.officer;
    document.getElementById("modal-date").innerText = new Date(data.date.toDate()).toLocaleString();
    
    const btnEdit = document.getElementById("btn-edit-report");
    const btnDelete = document.getElementById("btn-delete-report");

    if(isAdmin) {
        btnEdit.classList.remove("hidden");
        btnDelete.classList.remove("hidden");
        btnEdit.onclick = () => chargerEdition(id, data);
        btnDelete.onclick = () => supprimerRapport(id);
    } else {
        btnEdit.classList.add("hidden");
        btnDelete.classList.add("hidden");
    }
    document.getElementById("modal-overlay").classList.remove("hidden");
}

function chargerEdition(id, data) {
    if (!enService) { showToast("Mettez-vous en service pour modifier.", "error"); return; }
    currentReportId = id;
    document.getElementById("pv-titre").value = data.titre;
    document.getElementById("pv-type").value = data.type;
    document.getElementById("pv-content").value = data.content;
    
    document.getElementById("form-title").innerHTML = '<i class="fas fa-edit"></i> Modifier le Dossier';
    document.getElementById("btn-submit-report").innerText = "Sauvegarder les modifications";
    document.getElementById("btn-cancel-edit").classList.remove("hidden");
    
    fermerModal();
    changerPage('rapports');
}

function annulerEdition() {
    currentReportId = null;
    document.getElementById("pv-titre").value = "";
    document.getElementById("pv-content").value = "";
    document.getElementById("form-title").innerHTML = '<i class="fas fa-pen-nib"></i> Nouveau Dossier';
    document.getElementById("btn-submit-report").innerText = "Transmettre";
    document.getElementById("btn-cancel-edit").classList.add("hidden");
}

function supprimerRapport(id) {
    if(confirm("Supprimer ce rapport définitivement ?")) {
        db.collection("reports").doc(id).delete().then(() => {
            showToast("Rapport supprimé.", "success");
            fermerModal();
        });
    }
}

// --- AUTRES FONCTIONS ---
function fermerModal() { document.getElementById("modal-overlay").classList.add("hidden"); }

async function resetAllReports() {
    if(!confirm("SUPPRIMER TOUS LES RAPPORTS ? Irréversible.")) return;
    const s = await db.collection("reports").get();
    const b = db.batch();
    s.docs.forEach(d => b.delete(d.ref));
    await b.commit();
    showToast("Base de données vidée.", "success");
}

function ecouterRapports() {
    db.collection("reports").orderBy("date", "desc").limit(30).onSnapshot((s) => {
        let st = {t:0, amende:0, p:0, pl:0}; let html="";
        s.forEach(d => {
            const da = d.data(); st.t++;
            if(da.type==="AMENDE") st.amende++; if(da.type==="PVI") st.p++; if(da.type==="PLAINTE") st.pl++;
            let tagC="info"; if(da.type==="ARRESTATION") tagC="arrest"; if(da.type==="AMENDE") tagC="amende";
            html += `<div class="list-item" onclick="ouvrirModal('${d.id}')">
                        <div><span class="tag ${tagC}">${da.type}</span> <b>${da.titre}</b></div>
                        <div style="font-size:12px;color:#999">${new Date(da.date.toDate()).toLocaleDateString()}</div>
                     </div>`;
        });
        document.getElementById("stat-total").innerText = st.t; document.getElementById("stat-amende").innerText = st.amende;
        document.getElementById("stat-pvi").innerText = st.p; document.getElementById("stat-plainte").innerText = st.pl;
        document.getElementById("live-reports-list").innerHTML = html;
    });
}

function ecouterEffectifs() {
    db.collection("users").onSnapshot((s) => {
        let h = "";
        s.forEach(d => {
            const a = d.data();
            const statusClass = a.enService ? "st-on" : "st-off";
            const statusText = a.enService ? "En Service" : "Hors Service";
            const lastSeen = a.lastLogin ? new Date(a.lastLogin.toDate()).toLocaleDateString() : '-';
            h += `<tr><td><img src="${a.avatar}" class="agent-cell-avatar"> <strong>${a.name}</strong></td><td style="color:#64748b;">${lastSeen}</td><td><span class="status-badge-table ${statusClass}"><div class="dot-status"></div> ${statusText}</span></td></tr>`;
        });
        document.getElementById("effectif-list").innerHTML = h;
    });
}

function ecouterMails() {
    db.collection("mails").orderBy("date", "asc").limitToLast(50).onSnapshot((s) => {
        const box = document.getElementById("chat-box"); box.innerHTML = "";
        s.forEach(d => {
            const m = d.data(); const isMe = m.authorId === currentUser.id;
            const nameHtml = !isMe ? `<span class="msg-name">${m.authorName}</span>` : '';
            const avatarHtml = !isMe ? `<img src="${m.authorAvatar}" class="msg-avatar">` : '';
            box.innerHTML += `<div class="${isMe ? "msg-row me" : "msg-row other"}">${avatarHtml}<div class="msg-content-wrapper">${nameHtml}<div class="msg-bubble">${m.content}</div></div></div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function verifierMonStatut() {
    db.collection("users").doc(currentUser.id).get().then((d) => {
        if (d.exists && d.data().enService) { enService = true; updateUIStatus(true); }
    });
}

function toggleServiceButton(action) {
    if(action === 'prise') enService = true; else enService = false;
    updateUIStatus(enService);
    db.collection("users").doc(currentUser.id).update({ enService: enService });
    const msg = enService ? "🟢 PRISE DE SERVICE" : "🔴 FIN DE SERVICE";
    showToast(msg, enService ? "success" : "info");
    envoyerWebhook(WEBHOOK_PDS, msg, enService ? 3069299 : 15158332, `**Agent:** ${currentUser.name}\n**Action:** ${msg}`);
}

function updateUIStatus(isOn) {
    const txt = document.getElementById("txt-status-big"); const header = document.getElementById("header-status");
    if(isOn) { txt.innerText = "EN SERVICE"; txt.style.color = "#10b981"; header.className = "status-pill online"; header.innerText = "En Service"; }
    else { txt.innerText = "HORS SERVICE"; txt.style.color = "#ef4444"; header.className = "status-pill offline"; header.innerText = "Hors Service"; }
}

function envoyerMail() {
    const input = document.getElementById("mail-input"); if(!input.value.trim()) return;
    db.collection("mails").add({ content: input.value, authorName: currentUser.name, authorId: currentUser.id, authorAvatar: currentUser.avatar, date: new Date() });
    input.value = "";
}

function envoyerWebhook(url, title, color, desc) {
    fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({embeds:[{title:title, description:desc, color:color, thumbnail:{url:currentUser.avatar}}]}) });
}

function changerPage(id) {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-links li').forEach(l=>l.classList.remove('active'));
    document.getElementById('page-'+id).classList.add('active');
    document.getElementById('nav-'+id).classList.add('active');
}

function logout() {
    const loader = document.getElementById("loading-overlay");
    const txt = document.getElementById("loader-text");
    if(loader && txt) { txt.innerText = "Déconnexion en cours..."; loader.classList.remove("hidden"); loader.style.opacity = "1"; }
    setTimeout(() => { localStorage.removeItem("mdt_final_v7"); window.location.href = REDIRECT_URI; }, 2000);
}

