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

window.onload = () => {
    const localUser = localStorage.getItem("mdt_session_v4");
    if (localUser) {
        currentUser = JSON.parse(localUser);
        if(currentUser.isAdmin) isAdmin = true;
        lancerInterface();
    } else {
        const fragment = new URLSearchParams(window.location.hash.slice(1));
        const accessToken = fragment.get("access_token");
        if (accessToken) verifierUtilisateurDiscord(accessToken);
    }
};

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
            localStorage.setItem("mdt_session_v4", JSON.stringify(currentUser));
            
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
    document.getElementById("login-screen").classList.add("hidden");
    document.getElementById("dashboard-screen").classList.remove("hidden");
    document.getElementById("user-name").innerText = currentUser.name;
    document.getElementById("user-avatar").src = currentUser.avatar;
    window.history.replaceState({}, document.title, "/");

    ecouterRapports();
    ecouterEffectifs();
    ecouterMails();
    verifierMonStatut();
}

// --- BOUTON SERVICE UNIQUE ---
function verifierMonStatut() {
    db.collection("users").doc(currentUser.id).get().then((doc) => {
        if (doc.exists && doc.data().enService) {
            enService = true;
            updateUIService(true);
        }
    });
}

function toggleServiceAction() {
    // Si on est en service, on passe hors service, et inversement
    enService = !enService;
    updateUIService(enService);
    
    // Update DB
    db.collection("users").doc(currentUser.id).update({ enService: enService });

    // Webhook
    const msg = enService ? "🟢 PRISE DE SERVICE" : "🔴 FIN DE SERVICE";
    const color = enService ? 3069299 : 15158332;
    envoyerWebhook(WEBHOOK_PDS, msg, color, `**Agent:** ${currentUser.name}\n**Action:** ${msg}`);
}

function updateUIService(isOn) {
    const btn = document.getElementById("btn-service-toggle");
    const icon = document.getElementById("service-btn-icon");
    const text = document.getElementById("service-btn-text");
    const statusTxt = document.getElementById("txt-status-big");
    const headerStatus = document.getElementById("header-status");

    if (isOn) {
        // Mode EN SERVICE (Bouton devient Rouge pour dire 'Stop')
        btn.className = "btn-service-morph on";
        icon.className = "fas fa-stop";
        text.innerText = "FIN DE SERVICE";
        statusTxt.innerText = "EN SERVICE"; statusTxt.style.color = "#10b981";
        headerStatus.className = "status-dot-text online"; headerStatus.innerText = "En Service";
    } else {
        // Mode HORS SERVICE (Bouton devient Vert pour dire 'Start')
        btn.className = "btn-service-morph off";
        icon.className = "fas fa-power-off";
        text.innerText = "PRENDRE MON SERVICE";
        statusTxt.innerText = "HORS SERVICE"; statusTxt.style.color = "#ef4444";
        headerStatus.className = "status-dot-text offline"; headerStatus.innerText = "Hors Service";
    }
}

// --- MESSAGERIE ---
function ecouterMails() {
    db.collection("mails").orderBy("date", "asc").limitToLast(50)
    .onSnapshot((snapshot) => {
        const box = document.getElementById("chat-box");
        box.innerHTML = "";
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.authorId === currentUser.id;
            const bubble = isMe ? "msg-mine" : "msg-other";
            box.innerHTML += `<div class="msg-bubble ${bubble}"><span class="msg-meta">${msg.authorName}</span>${msg.content}</div>`;
        });
        box.scrollTop = box.scrollHeight;
    });
}
function envoyerMail() {
    const input = document.getElementById("mail-input");
    if(!input.value) return;
    db.collection("mails").add({ content: input.value, authorName: currentUser.name, authorId: currentUser.id, date: new Date() });
    input.value = "";
}

// --- RAPPORTS & EFFECTIFS ---
function ecouterRapports() {
    db.collection("reports").orderBy("date", "desc").limit(30).onSnapshot((s) => {
        let st = {t:0, a:0, p:0, pl:0}; let html="";
        s.forEach(d => {
            const da = d.data(); st.t++;
            if(da.type==="ARRESTATION") st.a++; if(da.type==="PVI") st.p++; if(da.type==="PLAINTE") st.pl++;
            
            let tagC = "info"; 
            if(da.type==="ARRESTATION") tagC="arrest"; if(da.type==="PVI") tagC="pvi"; if(da.type==="PLAINTE") tagC="plainte"; if(da.type==="AMENDE") tagC="amende";
            
            html += `<div class="list-item" onclick="ouvrirModal('${d.id}')">
                        <div><span class="tag ${tagC}">${da.type}</span> <b>${da.titre}</b></div>
                        <div style="font-size:12px;color:#999">${new Date(da.date.toDate()).toLocaleDateString()}</div>
                     </div>`;
        });
        document.getElementById("stat-total").innerText = st.t; document.getElementById("stat-arrest").innerText = st.a;
        document.getElementById("stat-pvi").innerText = st.p; document.getElementById("stat-plainte").innerText = st.pl;
        document.getElementById("live-reports-list").innerHTML = html;
    });
}

function ecouterEffectifs() {
    db.collection("users").onSnapshot((s) => {
        let h = "";
        s.forEach(d => {
            const a = d.data();
            const col = a.enService ? "#10b981" : "#ef4444"; const txt = a.enService ? "En Service" : "Hors Service";
            h += `<tr><td><img src="${a.avatar}"></td><td><b>${a.name}</b></td><td>${a.lastLogin?new Date(a.lastLogin.toDate()).toLocaleDateString():'-'}</td><td><span class="dot" style="background:${col}"></span> ${txt}</td></tr>`;
        });
        document.getElementById("effectif-list").innerHTML = h;
    });
}

// --- MODAL & ENVOI ---
async function ouvrirModal(id) {
    const d = await db.collection("reports").doc(id).get();
    if(!d.exists) return;
    const data = d.data();
    
    document.getElementById("modal-title").innerText = data.titre;
    document.getElementById("modal-type").innerText = data.type;
    document.getElementById("modal-author").innerText = data.officer;
    document.getElementById("modal-date").innerText = new Date(data.date.toDate()).toLocaleString();
    document.getElementById("modal-content").innerText = data.content;
    
    const ft = document.getElementById("modal-footer-actions"); ft.innerHTML="";
    if(isAdmin) ft.innerHTML = `<button onclick="delReport('${id}')" style="background:#ef4444;color:white;border:none;padding:10px;border-radius:6px;cursor:pointer;">Supprimer (Admin)</button>`;
    
    document.getElementById("modal-overlay").classList.remove("hidden");
}
function fermerModal() { document.getElementById("modal-overlay").classList.add("hidden"); }
function delReport(id) { if(confirm("Supprimer ?")) db.collection("reports").doc(id).delete().then(()=>fermerModal()); }

function envoyerRapport() {
    const t=document.getElementById("pv-titre").value; const ty=document.getElementById("pv-type").value; const c=document.getElementById("pv-content").value;
    if(!t||!c) return alert("Remplissez tout");
    db.collection("reports").add({ titre:t, type:ty, content:c, officer:currentUser.name, officerId:currentUser.id, date:new Date() });
    
    let col=3447003; if(ty==="ARRESTATION") col=15548997; if(ty==="PLAINTE") col=9662683;
    envoyerWebhook(WEBHOOK_PV, `📄 ${ty}`, col, `**Officier:** ${currentUser.name}\n**Titre:** ${t}\n\n${c}`);
    alert("Envoyé");
    document.getElementById("pv-titre").value=""; document.getElementById("pv-content").value="";
}

function envoyerWebhook(url, title, color, desc) {
    fetch(url, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({embeds:[{title:title, description:desc, color:color, thumbnail:{url:currentUser.avatar}}]}) });
}

function changerPage(id) {
    document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
    document.querySelectorAll('.nav-menu li').forEach(l=>l.classList.remove('active'));
    document.getElementById('page-'+id).classList.add('active');
    document.getElementById('nav-'+id).classList.add('active');
}
function logout() { localStorage.removeItem("mdt_session_v4"); window.location.href=REDIRECT_URI; }
