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
let currentReportId = null; // Pour l'édition

window.onload = () => {
    const localUser = localStorage.getItem("mdt_final_premium");
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

// --- SYSTÈME DE NOTIFICATION (TOAST) ---
function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    let icon = 'fa-info-circle';
    if(type === 'success') icon = 'fa-check-circle';
    if(type === 'error') icon = 'fa-exclamation-circle';

    toast.innerHTML = `<i class="fas ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => { toast.remove(); }, 4000);
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
                id: user.id,
                name: member.nick || user.global_name, 
                avatar: `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png`,
                isAdmin: isAdmin
            };
            localStorage.setItem("mdt_final_premium", JSON.stringify(currentUser));
            
            db.collection("users").doc(currentUser.id).set({
                name: currentUser.name, avatar: currentUser.avatar, lastLogin: new Date()
            }, { merge: true });

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
        ecouterRapports();
        ecouterEffectifs();
        ecouterMails();
        verifierMonStatut();
    } catch(e) { console.error("Erreur init Firebase", e); }

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

// --- LOGIQUE ADMIN RESET ---
async function resetAllReports() {
    if(!confirm("⚠️ ATTENTION : Suppression totale des rapports ?")) return;

    try {
        const snapshot = await db.collection("reports").get();
        if(snapshot.empty) {
            showToast("Base de données déjà vide.", "info");
            return;
        }
        const batch = db.batch();
        snapshot.docs.forEach(doc => batch.delete(doc.ref));
        await batch.commit();
        showToast("Tous les rapports ont été supprimés.", "success");
    } catch (error) {
        showToast("Erreur : " + error, "error");
    }
}

// --- MESSAGERIE (NOM AJOUTÉ) ---
function ecouterMails() {
    db.collection("mails").orderBy("date", "asc").limitToLast(50).onSnapshot((s) => {
        const box = document.getElementById("chat-box"); box.innerHTML = "";
        s.forEach(d => {
            const m = d.data(); 
            const isMe = m.authorId === currentUser.id;
            const rowClass = isMe ? "msg-row me" : "msg-row other";
            
            // Afficher le nom seulement si ce n'est pas moi
            const nameHtml = !isMe ? `<span class="msg-name">${m.authorName}</span>` : '';
            const avatarHtml = !isMe ? `<img src="${m.authorAvatar}" class="msg-avatar">` : '';

            box.innerHTML += `
                <div class="${rowClass}">
                    ${avatarHtml}
                    <div class="msg-content-wrapper">
                        ${nameHtml}
                        <div class="msg-bubble">${m.content}</div>
                    </div>
                </div>
            `;
        });
        box.scrollTop = box.scrollHeight;
    });
}

function envoyerMail() {
    const input = document.getElementById("mail-input");
    if(!input.value.trim()) return;
    db.collection("mails").add({ 
        content: input.value, authorName: currentUser.name, 
        authorId: currentUser.id, authorAvatar: currentUser.avatar, date: new Date() 
    });
    input.value = "";
}

// --- SERVICE ---
function verifierMonStatut() {
    db.collection("users").doc(currentUser.id).get().then((doc) => {
        if (doc.exists && doc.data().enService) {
            enService = true;
            updateUIStatus(true);
        }
    });
}

function toggleServiceButton(action) {
    if(action === 'prise') enService = true;
    else enService = false;

    updateUIStatus(enService);
    db.collection("users").doc(currentUser.id).update({ enService: enService });

    const msg = enService ? "🟢 PRISE DE SERVICE" : "🔴 FIN DE SERVICE";
    const color = enService ? 3069299 : 15158332;
    const typeToast = enService ? "success" : "info";
    
    showToast(msg, typeToast);
    envoyerWebhook(WEBHOOK_PDS, msg, color, `**Agent:** ${currentUser.name}\n**Action:** ${msg}`);
}

function updateUIStatus(isOn) {
    const txt = document.getElementById("txt-status-big");
    const header = document.getElementById("header-status");
    if(isOn) {
        txt.innerText = "EN SERVICE"; txt.style.color = "#10b981";
        header.className = "status-pill online"; header.innerText = "En Service";
    } else {
        txt.innerText = "HORS SERVICE"; txt.style.color = "#ef4444";
        header.className = "status-pill offline"; header.innerText = "Hors Service";
    }
}

// --- RAPPORTS STATS ---
function ecouterRapports() {
    db.collection("reports").orderBy("date", "desc").limit(30).onSnapshot((s) => {
        let st = {t:0, amende:0, p:0, pl:0}; let html="";
        s.forEach(d => {
            const da = d.data(); st.t++;
            if(da.type==="AMENDE") st.amende++; 
            if(da.type==="PVI") st.p++; 
            if(da.type==="PLAINTE") st.pl++;
            
            let tagC = "info"; 
            if(da.type==="ARRESTATION") tagC="arrest";
            if(da.type==="AMENDE") tagC="amende";
            
            html += `<div class="list-item" onclick="ouvrirModal('${d.id}')">
                        <div><span class="tag ${tagC}">${da.type}</span> <b>${da.titre}</b></div>
                        <div style="font-size:12px;color:#999">${new Date(da.date.toDate()).toLocaleDateString()}</div>
                     </div>`;
        });
        document.getElementById("stat-total").innerText = st.t; 
        document.getElementById("stat-amende").innerText = st.amende;
        document.getElementById("stat-pvi").innerText = st.p; 
        document.getElementById("stat-plainte").innerText = st.pl;
        document.getElementById("live-reports-list").innerHTML = html;
    });
}

// --- EFFECTIFS (CORRIGÉ) ---
function ecouterEffectifs() {
    db.collection("users").onSnapshot((s) => {
        let h = "";
        s.forEach(d => {
            const a = d.data();
            const statusClass = a.enService ? "st-on" : "st-off";
            const statusText = a.enService ? "En Service" : "Hors Service";
            const lastSeen = a.lastLogin ? new Date(a.lastLogin.toDate()).toLocaleDateString() : '-';
            // La première cellule contient maintenant l'image ET le nom
            h += `<tr>
                    <td><img src="${a.avatar}" class="agent-cell-avatar"> <strong>${a.name}</strong></td>
                    <td style="color:#64748b; font-size:13px;">${lastSeen}</td>
                    <td><span class="status-badge-table ${statusClass}"><div class="dot-status"></div> ${statusText}</span></td>
                  </tr>`;
        });
        document.getElementById("effectif-list").innerHTML = h;
    });
}

// --- MODAL & ÉDITION (ADMIN) ---
async function ouvrirModal(id) {
    const d = await db.collection("reports").doc(id).get();
    if(!d.exists) return;
    const data = d.data();
    
    document.getElementById("modal-title").innerText = data.titre;
    document.getElementById("modal-type").innerText = data.type;
    document.getElementById("modal-author").innerText = data.officer;
    document.getElementById("modal-date").innerText = new Date(data.date.toDate()).toLocaleString();
    document.getElementById("modal-content").innerText = data.content;
    
    // GESTION DES BOUTONS ADMIN
    const btnEdit = document.getElementById("btn-edit-report");
    const btnDelete = document.getElementById("btn-delete-report");

    if(isAdmin) {
        btnEdit.classList.remove("hidden");
        btnDelete.classList.remove("hidden");
        // Assigner les fonctions au clic avec l'ID du rapport
        btnEdit.onclick = () => chargerEdition(id, data);
        btnDelete.onclick = () => supprimerRapport(id);
    } else {
        btnEdit.classList.add("hidden");
        btnDelete.classList.add("hidden");
    }

    document.getElementById("modal-overlay").classList.remove("hidden");
}
function fermerModal() { document.getElementById("modal-overlay").classList.add("hidden"); }

// Fonction pour supprimer un rapport (Admin)
async function supprimerRapport(id) {
    if(!confirm("Voulez-vous vraiment supprimer ce rapport ?")) return;
    try {
        await db.collection("reports").doc(id).delete();
        showToast("Rapport supprimé.", "success");
        fermerModal();
    } catch (error) {
        showToast("Erreur lors de la suppression.", "error");
    }
}

// Fonction pour charger le rapport dans le formulaire d'édition
function chargerEdition(id, data) {
    // Vérifier le service
    if (!enService) {
        showToast("Vous devez être en service pour modifier un rapport.", "error");
        return;
    }

    currentReportId = id; // On sauvegarde l'ID
    
    // Remplir le formulaire
    document.getElementById("pv-titre").value = data.titre;
    document.getElementById("pv-type").value = data.type;
    document.getElementById("pv-content").value = data.content;
    
    // Changer l'interface du formulaire
    document.getElementById("form-title").innerHTML = '<i class="fas fa-edit"></i> Modification du Dossier';
    document.getElementById("btn-submit-report").innerText = "Sauvegarder les modifications";
    document.getElementById("btn-cancel-edit").classList.remove("hidden");
    
    fermerModal();
    changerPage('rapports');
}

// Fonction pour annuler l'édition
function annulerEdition() {
    currentReportId = null;
    document.getElementById("pv-titre").value = "";
    document.getElementById("pv-content").value = "";
    document.getElementById("form-title").innerHTML = '<i class="fas fa-pen-nib"></i> Nouveau Dossier';
    document.getElementById("btn-submit-report").innerText = "Transmettre";
    document.getElementById("btn-cancel-edit").classList.add("hidden");
}

// Fonction unique pour Créer OU Modifier un rapport
function traiterRapport() {
    // VÉRIFICATION DE SERVICE OBLIGATOIRE
    if (!enService) {
        showToast("Vous devez être en service pour transmettre un rapport.", "error");
        return;
    }

    const t = document.getElementById("pv-titre").value;
    const ty = document.getElementById("pv-type").value;
    const c = document.getElementById("pv-content").value;
    
    if(!t || !c) { showToast("Veuillez remplir tous les champs.", "error"); return; }
    
    const reportData = {
        titre: t, type: ty, content: c,
        officer: currentUser.name, officerId: currentUser.id, date: new Date()
    };

    if(currentReportId) {
        // MODIFICATION
        db.collection("reports").doc(currentReportId).update(reportData)
        .then(() => {
            showToast("Rapport modifié avec succès.", "success");
            annulerEdition(); // Reset du formulaire
        });
    } else {
        // CRÉATION
        db.collection("reports").add(reportData).then(() => {
            let col = 3447003; 
            if(ty==="ARRESTATION") col=15548997; 
            if(ty==="PLAINTE") col=9662683;
            if(ty==="AMENDE") col=2140013; // Vert
            
            envoyerWebhook(WEBHOOK_PV, `📄 ${ty}`, col, `**Officier:** ${currentUser.name}\n**Titre:** ${t}\n\n${c}`);
            showToast("Rapport transmis avec succès.", "success");
            document.getElementById("pv-titre").value=""; 
            document.getElementById("pv-content").value="";
        });
    }
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

// --- DÉCONNEXION AVEC ANIMATION ---
function logout() {
    const loader = document.getElementById("loading-overlay");
    const loaderText = document.getElementById("loader-text");
    
    if(loader && loaderText) {
        loaderText.innerText = "Déconnexion en cours...";
        loader.classList.remove("hidden");
        loader.style.opacity = "1";
    }

    setTimeout(() => {
        localStorage.removeItem("mdt_final_premium");
        window.location.href = REDIRECT_URI;
    }, 2000);
}
