<!DOCTYPE html>
<html lang="fr">
<head>
<!-- Tueur automatique de vieux Service Workers (évite "ça mouline" après update) -->
<script>
(function(){
  var CURRENT_VERSION = 'mobilea-v3.6';
  var FLAG = '_sw_killed_v3_6';
  if (!('serviceWorker' in navigator)) return;
  if (sessionStorage.getItem(FLAG)) return;
  // Si un SW est déjà actif, vérifier sa version
  navigator.serviceWorker.getRegistrations().then(function(regs){
    if (!regs.length) return;
    // Récupérer la version du SW actuel via fetch
    fetch('/sw.js', { cache: 'no-cache' })
      .then(function(r){ return r.text(); })
      .then(function(txt){
        if (txt.indexOf(CURRENT_VERSION) === -1) {
          // Vieux SW détecté : on nettoie tout
          sessionStorage.setItem(FLAG, '1');
          Promise.all(regs.map(function(reg){ return reg.unregister(); }))
            .then(function(){
              return caches.keys().then(function(keys){
                return Promise.all(keys.map(function(k){ return caches.delete(k); }));
              });
            })
            .then(function(){ location.reload(); });
        }
      })
      .catch(function(){});
  }).catch(function(){});
})();
</script>

<script>
(function(){
  try {
    var h = (location.hash||'').toLowerCase();
    // Routes valides : on garde ce que l'utilisateur a demandé (admin.html,
    // partner.html, dispatch.html, lien chauffeur externe #c/..., etc.)
    var ok = ['#admin','#dispatch','#partner','#partenaire','#partener',
              '#client','#client-particulier','#client-partner','#particulier',
              '#chauffeur'];
    if (ok.indexOf(h) !== -1) return;
    if (h.indexOf('#c/') === 0) return;
    // Par défaut (ouverture directe de /index.html sans hash) → dispatch
    location.hash = 'dispatch';
  } catch(e){}
})();
</script>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<!-- SÉCURITÉ -->
<meta http-equiv="X-Content-Type-Options" content="nosniff">
<meta name="referrer" content="strict-origin-when-cross-origin">

<!-- PWA -->
<meta name="application-name" content="MOBILEA">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
<meta name="apple-mobile-web-app-title" content="MOBILEA">
<meta name="mobile-web-app-capable" content="yes">
<meta name="theme-color" content="#c8a96e">
<meta name="description" content="MOBILEA — Transferts VTC Premium. Aéroports CDG, Orly, Disneyland Paris, Paris Île-de-France.">
<meta name="keywords" content="VTC, transfert, aéroport, CDG, Orly, Disneyland, chauffeur privé">
<meta name="author" content="MOBILEA">

<!-- Open Graph -->
<meta property="og:title" content="MOBILEA — VTC Premium">
<meta property="og:description" content="Réservez votre transfert VTC premium">
<meta property="og:type" content="website">
<meta property="og:url" content="https://mobilea-6tg.pages.dev">

<!-- Icônes iOS — Client (par défaut) -->
<link rel="apple-touch-icon" sizes="180x180" href="/icons/chauffeur-192.png">
<link rel="apple-touch-icon" sizes="152x152" href="/icons/chauffeur-152.png">
<link rel="apple-touch-icon" sizes="120x120" href="/icons/chauffeur-128.png">

<!-- Manifest dynamique selon le rôle (défaut: client) -->
<link rel="manifest" id="pwa-manifest" href="/manifest-chauffeur.json">
<link rel="icon" type="image/png" sizes="192x192" href="/icons/chauffeur-192.png">
<link rel="icon" type="image/png" sizes="32x32" href="/icons/client-96.png">
<title>MOBILEA — VTC Premium</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

<!-- Firebase Authentication (SDK compat — compatible avec le code actuel) -->
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js"></script>
<script src="https://www.gstatic.com/firebasejs/10.12.2/firebase-database-compat.js"></script>
<script>
  // Configuration Firebase (identifiants publics — protégés par les règles de sécurité)
  const firebaseConfig = {
    apiKey: "AIzaSyBiXGNZnAsPRz4mp-mQ6UMu2XbXNnAutUA",
    authDomain: "simplycab-58808.firebaseapp.com",
    databaseURL: "https://simplycab-58808-default-rtdb.europe-west1.firebasedatabase.app",
    projectId: "simplycab-58808",
    storageBucket: "simplycab-58808.firebasestorage.app",
    messagingSenderId: "862420643161",
    appId: "1:862420643161:web:5ab64510bca4fcf028b048"
  };
  function initFirebaseAuth() {
    if (typeof firebase === 'undefined') {
      // SDK pas encore chargé — réessayer dans 200ms
      setTimeout(initFirebaseAuth, 200);
      return;
    }
    try {
      if (!firebase.apps || !firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
      }
      window.fbAuth = firebase.auth();
      // PERSISTANCE explicite : indispensable en app native (WebView), sinon la
      // session Firebase n'est pas restaurée au redémarrage — l'app croit être
      // connectée (localStorage) mais currentUser reste null → 401 partout.
      try {
        window.fbAuth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
          .catch(function(e){ if(window._diagShow) window._diagShow('setPersistence échec: '+(e&&e.message)); });
      } catch(e) {}
      // Attendre que Firebase ait FINI de restaurer la session (currentUser est
      // null tant que cette restauration n'est pas terminée). On expose une
      // promesse que getAuthToken pourra attendre.
      window._fbAuthReady = new Promise(function(resolve){
        try {
          const unsub = window.fbAuth.onAuthStateChanged(function(u){
            window._fbAuthRestored = true;
            try { unsub(); } catch(e){}
            resolve(u || null);
          });
        } catch(e) { window._fbAuthRestored = true; resolve(null); }
      });
      try { window.fbDB = firebase.database(); } catch(e) { console.warn('Realtime DB indisponible:', e); }
      console.log('Firebase Auth initialisé ✓');
    } catch(e) {
      console.error('Erreur init Firebase Auth:', e);
    }
  }
  initFirebaseAuth();
</script>
<style>
:root{
  --black:#ffffff;--dark:#f5f6f8;--card:#ffffff;--card2:#f0f2f5;--card3:#e8eaed;
  --border:#e0e3e8;--border2:#d0d3d8;--border3:#b8bcc4;
  --gold:#b8860b;--gold2:#d4a017;--gold-dim:rgba(184,134,11,0.10);--gold-glow:rgba(184,134,11,0.05);
  --white:#111111;--white2:#333333;--muted:#6b6b6b;--muted2:#555555;
  --green:#1a9e5c;--green2:#22c76e;--green-dim:rgba(26,158,92,0.10);
  --red:#c0392b;--red-dim:rgba(192,57,43,0.10);
  --blue:#2563eb;--blue2:#3b82f6;--blue-dim:rgba(37,99,235,0.10);
  --orange:#d97706;--orange-dim:rgba(217,119,6,0.10);
  --purple:#7c3aed;--purple-dim:rgba(124,58,237,0.10);
  --shadow:0 4px 16px rgba(0,0,0,0.10);--shadow-sm:0 2px 8px rgba(0,0,0,0.07);
  --r:12px;--r-sm:8px;--r-xs:6px;--tr:all 0.2s ease;
}
*{box-sizing:border-box;margin:0;padding:0}
body{background:#f5f6f8;color:#111111;font-family:'DM Sans',sans-serif;min-height:100vh;overflow-x:hidden;font-size:14px}
::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#c0c4cc;border-radius:3px}
h1,h2,h3,h4{font-family:'Syne',sans-serif}
/* Navigation au clavier : contour visible uniquement au clavier, pas au clic */
:focus-visible{outline:2px solid var(--gold);outline-offset:2px}
/* iPhone : un champ < 16px déclenche un zoom automatique au focus depuis que le zoom est autorisé */
@supports (-webkit-touch-callout: none){input,select,textarea{font-size:max(16px,1em)!important}}
@media (prefers-reduced-motion: reduce){*,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}}

/* LOADING */
#loading{position:fixed;inset:0;background:#f5f6f8;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px}
#loading.out{display:none}
.ld-ring{width:48px;height:48px;border:3px solid var(--border2);border-top-color:var(--gold);border-radius:50%;animation:spin 0.9s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes slideDown{from{opacity:0;transform:translate(-50%,-30px)}to{opacity:1;transform:translate(-50%,0)}}
@keyframes slideDownFull{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:translateY(0)}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.15)}}
@keyframes mapPulse{0%{transform:scale(0.8);opacity:0.8}100%{transform:scale(2.2);opacity:0}}
@keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}

/* LOGIN */
#login{min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px;
  background:#f0f2f5}
.lbox{width:400px;max-width:100%}
.llogo{text-align:center;margin-bottom:32px}
.llogo .brand{font-family:'Syne',sans-serif;font-size:26px;font-weight:800;color:var(--gold);letter-spacing:3px}
.llogo .sub{font-size:11px;color:#666;margin-top:4px;letter-spacing:2px;text-transform:uppercase}
.lcard{background:#ffffff;border:1px solid #e0e0e0;border-radius:var(--r);overflow:hidden;box-shadow:0 8px 32px rgba(0,0,0,0.12)}
.lcard::before{content:'';display:block;height:3px;background:linear-gradient(90deg,var(--gold),var(--gold2),var(--gold))}
.lbody{padding:28px;background:#ffffff}
.ltabs{display:flex;gap:3px;background:#f0f0f0;border-radius:var(--r-xs);padding:4px;margin-bottom:20px}
.ltab{flex:1;padding:9px;border:none;background:transparent;color:#888;font-family:'Syne',sans-serif;font-size:11px;font-weight:600;cursor:pointer;border-radius:var(--r-xs);transition:var(--tr)}
.ltab.on{background:#fff;color:var(--gold);box-shadow:0 1px 4px rgba(0,0,0,0.1)}
.fld{margin-bottom:14px}
.fld label{display:block;font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:0.8px;margin-bottom:5px;font-weight:600}
.fld input,.fld select,.fld textarea{width:100%;background:#ffffff;border:1px solid #d0d3d8;border-radius:var(--r-sm);padding:11px 14px;color:#111;font-family:'DM Sans',sans-serif;font-size:13px;outline:none;transition:var(--tr)}
.fld input:focus,.fld select:focus,.fld textarea:focus{border-color:var(--gold)}
.fld select option{background:#ffffff;color:#111}
.fld input::placeholder{color:#999}.lcard .fld input,.lcard .fld select{background:#f8f8f8;border-color:#ddd;color:#111}.lcard label{color:#444}.lcard .fld input:focus,.lcard .fld select:focus{border-color:var(--gold);background:#fff}
.btn-login{width:100%;padding:13px;background:linear-gradient(135deg,var(--gold),var(--gold2));color:var(--black);border:none;border-radius:var(--r-sm);font-family:'Syne',sans-serif;font-size:14px;font-weight:700;cursor:pointer;transition:var(--tr)}
.btn-login:hover{opacity:0.9}
.lerr{color:#d32f2f;font-size:12px;text-align:center;margin-top:10px;min-height:16px}
/* PIN login supprimé — connexion par email uniquement */

/* APP */
#app{display:none;min-height:100vh}
.sidebar{position:fixed;left:0;top:0;bottom:0;width:280px;background:#ffffff;border-right:1px solid #e0e3e8;display:flex;flex-direction:column;z-index:100000;transition:transform 0.28s cubic-bezier(0.4,0,0.2,1);transform:translateX(-100%);box-shadow:none;padding-top:env(safe-area-inset-top);padding-bottom:env(safe-area-inset-bottom)}
.sidebar.on{transform:translateX(0);box-shadow:0 0 40px rgba(0,0,0,0.25)}
.sb-top{padding:18px 16px 14px;border-bottom:1px solid var(--border)}
.sb-brand{font-family:'Syne',sans-serif;font-size:15px;font-weight:800;color:var(--gold);letter-spacing:1px}
.sb-sub{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:0.5px;margin-top:1px}
.sb-role{display:inline-block;margin-top:7px;padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600}
.role-admin{background:var(--gold-dim);color:var(--gold);border:1px solid rgba(201,168,76,0.2)}
.role-dispatch{background:var(--blue-dim);color:var(--blue);border:1px solid rgba(91,156,246,0.2)}
.role-chauffeur{background:var(--green-dim);color:var(--green);border:1px solid rgba(46,204,138,0.2)}
.nav{flex:1;padding:12px 8px;overflow-y:auto}
.nsec{font-size:9px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;padding:8px 12px 4px;font-weight:600;margin-top:4px}
.ni{display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:var(--r-xs);cursor:pointer;font-size:13px;color:var(--muted2);margin-bottom:2px;transition:var(--tr);border:none;background:none;width:100%;text-align:left;font-family:'DM Sans',sans-serif;font-weight:500;position:relative}
.ni:hover{color:#111;background:rgba(0,0,0,0.05)}
.ni.on{color:var(--gold);background:rgba(184,134,11,0.10);font-weight:600}
.ni.on::before{content:'';position:absolute;left:0;top:8px;bottom:8px;width:3px;background:var(--gold);border-radius:0 3px 3px 0}
.nb{margin-left:auto;background:var(--red);color:#fff;font-size:9px;padding:2px 6px;border-radius:10px;font-weight:700;min-width:18px;text-align:center}
.nb.g{background:var(--green)}.nb.b{background:var(--blue)}
.sb-bot{padding:12px 8px;border-top:1px solid var(--border)}
.sb-user{display:flex;align-items:center;gap:8px;padding:9px 12px;border-radius:var(--r-xs);cursor:pointer;transition:var(--tr)}
.sb-user:hover{background:var(--card)}
.sb-av{width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--orange));display:flex;align-items:center;justify-content:center;font-family:'Syne',sans-serif;font-weight:700;font-size:11px;color:var(--black);flex-shrink:0}
.sb-logout{width:28px;height:28px;border-radius:var(--r-xs);background:var(--card2);border:1px solid var(--border);color:var(--muted2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:var(--tr);flex-shrink:0;font-size:11px}
.sb-logout:hover{color:var(--red);border-color:var(--red)}

.main{margin-left:0;min-height:100vh;display:flex;flex-direction:column}
.topbar{padding:13px 22px;padding-top:max(13px, calc(13px + env(safe-area-inset-top)));border-bottom:1px solid #e0e3e8;display:flex;align-items:center;justify-content:space-between;background:#ffffff;position:sticky;top:0;z-index:50;gap:12px}
.tbl{display:flex;align-items:center;gap:12px}
.mob-btn{display:flex;width:40px;height:40px;border-radius:10px;background:#fff;border:1px solid #e0e3e8;color:#333;align-items:center;justify-content:center;cursor:pointer;font-size:18px}.mob-btn:hover{background:#f0f2f5}
.tb-title{font-family:'Syne',sans-serif;font-size:18px;font-weight:700}
.tbr{display:flex;align-items:center;gap:8px}
.tb-clock{font-size:12px;color:var(--muted2);font-weight:500}
.tb-ico{width:34px;height:34px;border-radius:var(--r-xs);background:var(--card);border:1px solid var(--border);color:var(--muted2);display:flex;align-items:center;justify-content:center;cursor:pointer;transition:var(--tr);font-size:12px}
.tb-ico:hover{color:var(--white);border-color:var(--border3)}
.content{padding:22px;flex:1}

/* STATS */
.sg{display:grid;grid-template-columns:repeat(4,1fr);gap:13px;margin-bottom:22px}
.sc{background:var(--card);border:1px solid var(--border);border-radius:var(--r);padding:18px;position:relative;overflow:hidden;transition:var(--tr);cursor:pointer}
.sc:hover{border-color:var(--border3);transform:translateY(-2px)}
.sc::before{content:'';position:absolute;top:0;left:0;width:4px;height:100%;border-radius:var(--r) 0 0 var(--r)}
.sc.cg::before{background:linear-gradient(180deg,var(--gold),var(--gold2))}
.sc.cgr::before{background:linear-gradient(180deg,var(--green),var(--green2))}
.sc.cb::before{background:linear-gradient(180deg,var(--blue),var(--blue2))}
.sc.co::before{background:linear-gradient(180deg,var(--orange),#ffb87a)}
.sc-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px}
.sc-ico{width:38px;height:38px;border-radius:var(--r-xs);display:flex;align-items:center;justify-content:center;font-size:16px}
.sc.cg .sc-ico{background:var(--gold-dim);color:var(--gold)}
.sc.cgr .sc-ico{background:var(--green-dim);color:var(--green)}
.sc.cb .sc-ico{background:var(--blue-dim);color:var(--blue)}
.sc.co .sc-ico{background:var(--orange-dim);color:var(--orange)}
.sc-val{font-family:'Syne',sans-serif;font-size:26px;font-weight:700;margin-bottom:3px}
.sc-lbl{font-size:11px;color:var(--muted)}
.sc-sub{font-size:11px;color:var(--muted2);margin-top:4px}

/* SEC */
.sec{background:var(--card);border:1px solid var(--border);border-radius:var(--r);margin-bottom:18px;overflow:hidden}
.sec-h{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.sec-t{font-family:'Syne',sans-serif;font-size:15px;font-weight:700;display:flex;align-items:center;gap:8px}
.sec-t i{color:var(--gold);font-size:14px}
.sec-a{display:flex;align-items:center;gap:8px;flex-wrap:wrap}

/* BTNS */
.btn{display:inline-flex;align-items:center;gap:7px;padding:8px 15px;border-radius:var(--r-xs);font-family:'DM Sans',sans-serif;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:var(--tr);white-space:nowrap}
.btn-p{background:linear-gradient(135deg,var(--gold),var(--gold2));color:var(--black)}
.btn-p:hover{opacity:0.9}
.btn-s{background:#f0f2f5;color:#333;border:1px solid #d0d3d8}
.btn-s:hover{background:#e8eaed}
.btn-d{background:var(--red-dim);color:var(--red);border:1px solid rgba(224,92,92,0.2)}
.btn-g{background:var(--green-dim);color:var(--green);border:1px solid rgba(46,204,138,0.2)}
.btn-ghost{background:transparent;color:#555;border:1px solid #d0d3d8}
.btn-ghost:hover{color:#111;background:#f0f2f5}
.btn-sm{padding:6px 12px;font-size:12px}
.btn-xs{padding:4px 8px;font-size:11px}

/* TABLE */
.tw{overflow-x:auto}
table{width:100%;border-collapse:collapse}
th{padding:10px 16px;text-align:left;font-size:10px;color:#666;text-transform:uppercase;letter-spacing:0.8px;border-bottom:1px solid #e0e3e8;font-weight:600;white-space:nowrap;background:#f8f9fa}
td{padding:12px 16px;font-size:13px;border-bottom:1px solid #f0f2f5;vertical-align:middle;color:#333}
tbody tr:hover td{background:#f8f9fa}
tr:last-child td{border-bottom:none}
.t-empty{text-align:center;padding:50px 20px;color:var(--muted)}
.t-empty i{font-size:36px;color:var(--border3);display:block;margin-bottom:10px}

/* BADGES */
.bdg{display:inline-flex;align-items:center;gap:4px;padding:3px 8px;border-radius:20px;font-size:10px;font-weight:600;white-space:nowrap}
.bdg::before{content:'';width:5px;height:5px;border-radius:50%;flex-shrink:0}
.bdg-gold{background:var(--gold-dim);color:var(--gold);border:1px solid rgba(201,168,76,0.15)}.bdg-gold::before{background:var(--gold)}
.bdg-green{background:var(--green-dim);color:var(--green);border:1px solid rgba(46,204,138,0.15)}.bdg-green::before{background:var(--green)}
.bdg-red{background:var(--red-dim);color:var(--red);border:1px solid rgba(224,92,92,0.15)}.bdg-red::before{background:var(--red)}
.bdg-blue{background:var(--blue-dim);color:var(--blue);border:1px solid rgba(91,156,246,0.15)}.bdg-blue::before{background:var(--blue)}
.bdg-orange{background:var(--orange-dim);color:var(--orange);border:1px solid rgba(240,147,74,0.15)}.bdg-orange::before{background:var(--orange)}
.bdg-purple{background:var(--purple-dim);color:var(--purple);border:1px solid rgba(155,127,240,0.15)}.bdg-purple::before{background:var(--purple)}
.bdg-muted{background:rgba(90,93,101,0.15);color:var(--muted2);border:1px solid rgba(90,93,101,0.2)}.bdg-muted::before{background:var(--muted2)}

/* MODAL */
.mo{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.40);z-index:200;align-items:center;justify-content:center;backdrop-filter:blur(6px);padding:16px}
.mo.on{display:flex}
.mo-box{background:#ffffff;border:1px solid #e0e3e8;border-radius:var(--r);width:560px;max-width:100%;max-height:90vh;overflow:hidden;box-shadow:var(--shadow);display:flex;flex-direction:column;animation:fadeUp 0.25s ease}
.mo-box.wide{width:640px}
.mo-h{padding:18px 22px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
.mo-t{font-family:'Syne',sans-serif;font-size:16px;font-weight:700}
.mo-x{width:30px;height:30px;border-radius:var(--r-xs);background:var(--card2);border:1px solid var(--border);color:var(--muted2);display:flex;align-items:center;justify-content:center;cursor:pointer;font-size:12px}
.mo-x:hover{color:var(--red);border-color:var(--red)}
.mo-b{padding:20px 22px;overflow-y:auto;flex:1}
.mo-f{padding:14px 22px;border-top:1px solid var(--border);display:flex;justify-content:flex-end;gap:8px;flex-shrink:0}
.fg2{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.fg3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px}
.fg2 .fld,.fg3 .fld{margin-bottom:0}
@media(max-width:520px){.fg2,.fg3{grid-template-columns:1fr}}

/* SEARCH */
.sbw{position:relative;min-width:180px}
.sbw input{width:100%;background:#ffffff;border:1px solid #d0d3d8;border-radius:var(--r-xs);padding:8px 12px 8px 32px;color:var(--white);font-size:12px;outline:none}
.sbw input:focus{border-color:var(--gold)}
.sbw i{position:absolute;left:10px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:11px}
.fsel{background:#ffffff;border:1px solid #d0d3d8;border-radius:var(--r-xs);padding:8px 12px;color:var(--white);font-size:12px;outline:none;cursor:pointer}
.fsel option{background:#ffffff;color:#111}

/* TOAST */
.toast{position:fixed;bottom:20px;right:20px;background:#ffffff;border:1px solid var(--green);color:var(--green);padding:11px 16px;border-radius:var(--r-sm);font-size:12px;z-index:9999;transform:translateY(100px);opacity:0;transition:all 0.3s ease;display:flex;align-items:center;gap:9px;box-shadow:var(--shadow);font-weight:500;max-width:320px}
.toast.show{transform:translateY(0);opacity:1}
.toast.err{border-color:var(--red);color:var(--red)}
.toast.info{border-color:var(--blue);color:var(--blue)}
.toast.warn{border-color:var(--orange);color:var(--orange)}

/* PAGES */
.page{display:none}.page.on{display:block;animation:fadeUp 0.25s ease}

/* TIMELINE */
.tl{padding:16px 20px;position:relative}
.tl::before{content:'';position:absolute;left:28px;top:16px;bottom:16px;width:2px;background:var(--border)}
.tl-item{position:relative;padding-left:40px;margin-bottom:14px}
.tl-dot{position:absolute;left:21px;top:4px;width:13px;height:13px;border-radius:50%;border:2px solid var(--card);z-index:1}
.tl-dot.g{background:var(--gold)}.tl-dot.gr{background:var(--green)}.tl-dot.b{background:var(--blue)}.tl-dot.r{background:var(--red)}.tl-dot.o{background:var(--orange)}
.tl-time{font-size:10px;color:var(--muted);margin-bottom:2px}
.tl-text{font-size:12px;color:var(--white2)}

/* CARDS */
.cg{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:13px;padding:18px}
.ic{background:var(--card2);border:1px solid var(--border);border-radius:var(--r-sm);padding:16px;transition:var(--tr)}
.ic:hover{border-color:var(--border3);transform:translateY(-2px)}
.ic-h{display:flex;align-items:center;gap:10px;margin-bottom:12px}
.ic-t{font-family:'Syne',sans-serif;font-size:13px;font-weight:700}
.ic-s{font-size:11px;color:var(--muted);margin-top:1px}
.ic-foot{display:flex;gap:6px;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}

/* PROG */
.prog{height:4px;background:var(--dark);border-radius:3px;overflow:hidden;margin-top:7px}
.prog-fill{height:100%;border-radius:3px}

/* CONFIRM */
.conf-ov{position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:300;display:none;align-items:center;justify-content:center;padding:20px}
.conf-ov.on{display:flex}
.conf-box{background:#ffffff;border:1px solid #e0e3e8;border-radius:var(--r);padding:24px;width:340px;max-width:100%;text-align:center;box-shadow:var(--shadow)}
.conf-box i{font-size:36px;color:var(--orange);margin-bottom:12px;display:block}
.conf-box h3{font-family:'Syne',sans-serif;font-size:16px;margin-bottom:7px}
.conf-box p{color:var(--muted2);font-size:12px;margin-bottom:20px}
.conf-btns{display:flex;gap:8px;justify-content:center}

/* MOBILE */
.mob-ov{display:none;position:fixed;inset:0;background:rgba(0,0,0,0.55);z-index:99999}
.rappel-chip{display:inline-flex;align-items:center;gap:7px;background:var(--card2);border:1px solid var(--border2);border-radius:20px;padding:8px 14px;font-size:12px;font-weight:600;color:var(--white);cursor:pointer}
.rappel-chip input{accent-color:#b8860b;width:16px;height:16px;cursor:pointer}
/* Empêche les cartes Leaflet (marqueurs, popups, contrôles) de passer par-dessus
   le menu latéral : leurs z-index internes élevés débordaient sur le menu. */
.leaflet-pane,.leaflet-top,.leaflet-bottom{z-index:5 !important}
.leaflet-popup{z-index:6 !important}
.mob-ov.on{display:block}
@media(max-width:1024px){.sg{grid-template-columns:repeat(2,1fr)}}
@media(max-width:768px){
  
  .main{margin-left:0}.mob-btn{display:flex}.sg{grid-template-columns:1fr 1fr}
  .content{padding:13px;padding-top:calc(13px + env(safe-area-inset-top))}.topbar{padding:11px 14px;padding-top:calc(11px + env(safe-area-inset-top))}.cg{grid-template-columns:1fr}
  .sec-h{flex-direction:column;align-items:flex-start}
}
@media(max-width:480px){.sg{grid-template-columns:1fr}}
/* MESSAGERIE — sur mobile, on affiche soit la liste des conversations,
   soit le chat en cours, jamais les deux côte à côte (sinon le chat
   est coupé/illisible sur petit écran) */
.msg-back-btn{display:none}
@media(max-width:768px){
  #msg-wrap{grid-template-columns:1fr!important;height:calc(100vh - 90px)!important}
  #msg-wrap .msg-list-panel{display:flex}
  /* Conversation non lue : pastille + fond qui pulsent doucement pour attirer
     l'oeil de l'admin/dispatch sans être agressif. */
  @keyframes convPulse{0%,100%{background:rgba(231,76,60,0.10)}50%{background:rgba(231,76,60,0.22)}}
  .conv-unread{animation:convPulse 1.8s ease-in-out infinite}
  @keyframes badgePulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.18);opacity:.85}}
  .conv-badge-pulse{animation:badgePulse 1.2s ease-in-out infinite}
  #msg-wrap .msg-chat-panel{display:none}
  #msg-wrap.msg-chat-active .msg-list-panel{display:none}
  #msg-wrap.msg-chat-active .msg-chat-panel{display:flex}
  .msg-back-btn{display:inline-flex!important}
}
.text-gold{color:var(--gold)}.fw7{font-weight:700}.ff-syne{font-family:'Syne',sans-serif}
.hidden{display:none!important}
.col-toggle{display:flex;align-items:center;gap:7px;font-size:12px;padding:4px 0;cursor:pointer;color:var(--white2)}
.col-toggle:hover{color:var(--white)}
.col-toggle input{cursor:pointer}
.col-hidden{display:none!important}

/* AGENDA DISPATCH */
.agenda-item{display:flex;gap:0;margin-bottom:6px;border-radius:var(--r-sm);overflow:hidden;cursor:pointer;transition:transform 0.15s,box-shadow 0.15s}
.agenda-item:hover{transform:translateX(3px);box-shadow:var(--shadow-sm)}
.agenda-stripe{width:5px;flex-shrink:0}
.agenda-body{flex:1;padding:10px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.agenda-time{font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--white);white-space:nowrap;min-width:50px}
.agenda-info{flex:1;min-width:0}
.agenda-title{font-size:13px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agenda-sub{font-size:11px;color:rgba(255,255,255,0.7);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.agenda-right{display:flex;flex-direction:column;align-items:flex-end;gap:3px;flex-shrink:0}
.agenda-chauff{font-size:11px;font-weight:600;white-space:nowrap}
.week-day{font-size:15px;text-align:center;padding:6px 4px;border-radius:var(--r-xs);cursor:pointer;transition:background 0.15s}
.week-day:hover{background:var(--card2)}
.week-day.today{background:var(--gold-dim)}
.week-day.selected{background:var(--gold);color:var(--black)}
.week-day .dn{font-size:10px;color:var(--muted);font-weight:600;text-transform:uppercase}
.week-day .dd{font-size:16px;font-weight:700;font-family:'Syne',sans-serif}
.week-day .dots{display:flex;justify-content:center;gap:2px;margin-top:2px;min-height:6px}
.week-day .dot{width:5px;height:5px;border-radius:50%}
.drv-wrap{position:relative}
.drv-input{width:100%;background:#ffffff;border:1px solid #d0d3d8;border-radius:var(--r-xs);padding:9px 12px;color:#1a1d21;font-size:13px;outline:none;font-family:'DM Sans',sans-serif;transition:var(--tr)}
.drv-input::placeholder{color:#8a8f96}
.drv-input:focus{border-color:var(--gold)}
.drv-drop{position:absolute;top:100%;right:0;min-width:270px;max-width:calc(100vw - 40px);background:#ffffff;border:1px solid #d0d3d8;border-radius:var(--r-xs);margin-top:3px;max-height:300px;overflow-y:auto;z-index:500;box-shadow:var(--shadow);display:none}
.drv-drop.on{display:block}
.drv-opt{padding:11px 12px;font-size:14px;cursor:pointer;color:#1a1d21;transition:background 0.15s;display:flex;align-items:center;gap:8px;border-bottom:1px solid #f0f1f3}
.drv-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
.drv-name{flex:1;white-space:normal;word-break:break-word;font-weight:600;line-height:1.2}
.drv-veh{font-size:15px;flex-shrink:0;margin-left:auto}
.drv-opt:hover,.drv-opt.sel{background:var(--gold-dim);color:var(--gold)}
.drv-opt .av{width:24px;height:24px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--orange));display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:700;color:var(--black);flex-shrink:0;font-family:'Syne',sans-serif}
.drv-empty{padding:12px;font-size:12px;color:var(--muted);text-align:center}

/* KANBAN */
.kb{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;padding:18px}
.kb-col{background:var(--card2);border-radius:var(--r-sm);border:1px solid var(--border)}
.kb-ch{padding:11px 13px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between}
.kb-ct{font-family:'Syne',sans-serif;font-size:11px;font-weight:700;display:flex;align-items:center;gap:6px}
.kb-cc{font-size:10px;padding:2px 6px;border-radius:10px;background:var(--dark);color:var(--muted)}
.kb-items{padding:8px;min-height:120px}
.kb-card{background:var(--card);border:1px solid var(--border);border-radius:var(--r-xs);padding:10px;margin-bottom:7px;cursor:pointer;transition:var(--tr)}
.kb-card:hover{border-color:var(--border3)}
@media(max-width:900px){.kb{grid-template-columns:repeat(2,1fr)}}
@media(max-width:600px){.kb{grid-template-columns:1fr}}
.mc-carrousel::-webkit-scrollbar{display:none;height:0}
.mc-carrousel{scrollbar-width:none}
</style>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" media="print" onload="this.media='all'">
<script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
<script>
  // Marqueur de version — visible dans « Diagnostic » pour confirmer que l'app
  // (surtout l'app native) charge bien la DERNIÈRE version du code.
  window.MOBILEA_BUILD = '2026-10-13-notif-diag';
  window.OneSignalDeferred = window.OneSignalDeferred || [];
  OneSignalDeferred.push(async function(OneSignal) {
    await OneSignal.init({
      appId: "85e71302-1646-456d-9db4-a1875bb7d25c",
      safari_web_id: "web.onesignal.auto.064b44a8-1dd7-4e10-9d87-452ef5b9c9dd",
      notifyButton: { enable: true },
    });
  });
</script>
<!-- MOBILEA — Stripe.js -->
<script src="https://js.stripe.com/v3/" defer></script>
<!-- MOBILEA — PayPal SDK (DÉSACTIVÉ pour l'instant : pas encore de Client ID).
     Pour réactiver PayPal plus tard : décommente la ligne ci-dessous et remplace
     REMPLACE_PAR_TON_CLIENT_ID_PAYPAL par ton vrai Client ID PayPal Live. -->
<!-- <script src="https://www.paypal.com/sdk/js?client-id=REMPLACE_PAR_TON_CLIENT_ID_PAYPAL&currency=EUR&locale=fr_FR&intent=capture&components=buttons" data-namespace="paypal_sdk"></script> -->
<!-- MOBILEA — Google Places Autocomplete -->
<script src="https://maps.googleapis.com/maps/api/js?key=AIzaSyC1tzZPk1ZlhMhtk3hUvhkIcd08U7LyTT8&libraries=places,geometry&language=fr&region=FR" defer onload="initPlacesAutocomplete()"></script>
<style id="driver-premium-skin">
/* ═══════════════════════════════════════════════════════════════
   MOBILEA DRIVER PREMIUM SKIN
   Appliqué uniquement si body[data-driver-skin="premium"]
   Thème navy + light inspiré des apps VTC premium (Heetch, Blacklane).
   N'affecte PAS les rôles admin / dispatch / client.
   ═══════════════════════════════════════════════════════════════ */
body[data-driver-skin="premium"]{
  --dp-bg:#f3f5fb; --dp-card:#ffffff; --dp-border:#e5e8ef;
  --dp-text:#0a1a3f; --dp-sub:#6b7280;
  --dp-navy:#0b1538; --dp-navy2:#131f52;
  --dp-accent:#f4c300; --dp-online:#10b981;
  background:var(--dp-bg) !important;
}
body[data-driver-skin="premium"] .sidebar{ display:none !important; }
body[data-driver-skin="premium"] .main{ margin-left:0 !important; padding-bottom:92px; background:var(--dp-bg); }
body[data-driver-skin="premium"] .content{ background:var(--dp-bg); color:var(--dp-text); padding:12px; }
body[data-driver-skin="premium"] .page{ background:transparent; color:var(--dp-text); }

/* TOPBAR navy — arrondie en bas */
body[data-driver-skin="premium"] .topbar{
  background:var(--dp-navy); color:#fff;
  border-bottom:0; border-radius:0 0 22px 22px;
  padding:14px 18px 16px;
  box-shadow:0 2px 14px rgba(10,26,63,.18);
  position:sticky; top:0; z-index:50;
}
body[data-driver-skin="premium"] .topbar .tb-title{ color:#fff; font-weight:800; font-size:17px; }
body[data-driver-skin="premium"] .topbar .mob-btn,
body[data-driver-skin="premium"] .topbar .tb-ico{
  color:#fff; background:rgba(255,255,255,.1); border:0;
  width:38px; height:38px; border-radius:50%; display:flex; align-items:center; justify-content:center;
}
body[data-driver-skin="premium"] .topbar .tb-clock{ color:#9fb0d4; font-weight:600; font-size:13px; }
body[data-driver-skin="premium"] #fb-status{ color:#10b981 !important; }

/* CARDS plus modernes, blanches, bords arrondis, ombre douce */
body[data-driver-skin="premium"] .sec,
body[data-driver-skin="premium"] .card,
body[data-driver-skin="premium"] .cs,
body[data-driver-skin="premium"] .sc{
  background:var(--dp-card) !important;
  color:var(--dp-text) !important;
  border:1px solid var(--dp-border) !important;
  border-radius:16px !important;
  box-shadow:0 2px 8px rgba(10,26,63,.05);
}
body[data-driver-skin="premium"] .sec-h{
  background:transparent !important; color:var(--dp-text) !important;
  border-bottom:1px solid var(--dp-border) !important; padding:14px 18px;
}
body[data-driver-skin="premium"] .sec-t{ color:var(--dp-text) !important; font-weight:800; }

/* Texte muted */
body[data-driver-skin="premium"] .muted,
body[data-driver-skin="premium"] [style*="color:var(--muted)"]{ color:var(--dp-sub) !important; }

/* Boutons principaux : fond navy pour les actions principales, jaune pour l'actif */
body[data-driver-skin="premium"] .btn-p{ background:var(--dp-navy) !important; color:#fff !important; border:0; }
body[data-driver-skin="premium"] .btn{ border-radius:12px; }
body[data-driver-skin="premium"] .btn-g{ background:var(--dp-online) !important; color:#fff !important; border:0; }

/* Toggle EN LIGNE / HORS LIGNE : badge visible dans la topbar à côté du titre */
body[data-driver-skin="premium"] #dp-status-pill{
  display:inline-flex; align-items:center; gap:8px;
  padding:6px 14px; border-radius:999px;
  background:var(--dp-online); color:#fff; font-weight:800; font-size:12px;
  margin-left:auto;
}
body[data-driver-skin="premium"] #dp-status-pill.off{ background:#9ca3af; }
body[data-driver-skin="premium"] #dp-status-pill::before{
  content:''; width:8px; height:8px; border-radius:50%; background:#fff;
  box-shadow:0 0 6px rgba(255,255,255,.6);
}

/* Table + lignes */
body[data-driver-skin="premium"] table{ background:var(--dp-card); color:var(--dp-text); }
body[data-driver-skin="premium"] th{ color:var(--dp-sub) !important; background:#f8fafc !important; font-weight:700; }
body[data-driver-skin="premium"] td{ color:var(--dp-text) !important; border-color:#eef1f7 !important; }

/* États vides */
body[data-driver-skin="premium"] .empty-state{
  text-align:center; padding:40px 20px; color:var(--dp-sub);
}

/* BOTTOM NAV FLOTTANT — 5 icônes */
#dp-bottom-nav{ display:none; }
body[data-driver-skin="premium"] #dp-bottom-nav{
  display:flex; position:fixed; left:50%; bottom:12px; transform:translateX(-50%);
  background:#fff; border-radius:999px;
  box-shadow:0 6px 24px rgba(10,26,63,.14), 0 0 0 1px rgba(10,26,63,.04);
  padding:8px 10px; gap:4px; z-index:100;
  max-width:calc(100% - 20px);
}
#dp-bottom-nav .dp-tab{
  background:transparent; border:0; cursor:pointer;
  display:flex; flex-direction:column; align-items:center; justify-content:center;
  padding:8px 12px; min-width:60px;
  font-size:11px; font-weight:700; color:var(--dp-sub);
  border-radius:999px; transition:background .15s;
}
#dp-bottom-nav .dp-tab i{ font-size:19px; margin-bottom:2px; color:currentColor; }
#dp-bottom-nav .dp-tab.on{ background:#eef2fb; color:var(--dp-navy); }
#dp-bottom-nav .dp-tab:hover{ background:#f3f5fb; }

/* Inputs et selects clairs */
body[data-driver-skin="premium"] input,
body[data-driver-skin="premium"] select,
body[data-driver-skin="premium"] textarea{
  background:#fff; color:var(--dp-text); border:1px solid var(--dp-border); border-radius:10px;
}

/* Badges */
body[data-driver-skin="premium"] .bdg{ border-radius:999px; font-weight:700; }

@media(max-width:760px){
  body[data-driver-skin="premium"] .main{ margin:0 !important; }
  body[data-driver-skin="premium"] .content{ padding:10px 10px 100px; }
  body[data-driver-skin="premium"] .topbar{ padding:12px 14px; }
  body[data-driver-skin="premium"] .topbar .tb-title{ font-size:15px; }
  #dp-bottom-nav .dp-tab{ padding:7px 10px; min-width:54px; font-size:10px; }
  #dp-bottom-nav .dp-tab i{ font-size:17px; }
}
</style>
<!-- Garde-fou : cache le spinner même si app.js échoue (évite "ça mouline à l'infini") -->
<script>
(function(){
  function hideLoading(){
    try {
      var el = document.getElementById('loading');
      if(el) el.classList.add('out');
    } catch(e){}
  }
  // 3 déclencheurs indépendants : DCL, load, et timeout 8s
  if(document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function(){ setTimeout(hideLoading, 3500); });
  } else {
    setTimeout(hideLoading, 3500);
  }
  window.addEventListener('load', function(){ setTimeout(hideLoading, 1500); });
  setTimeout(hideLoading, 8000); // Hard fallback : 8s max avant de cacher
  // Diagnostic visible : si app.js n'a pas défini fbGet au bout de 10s, on affiche un message
  setTimeout(function(){
    if(typeof window.fbGet === 'undefined' && typeof window.gp === 'undefined') {
      var el = document.getElementById('loading');
      if(el) {
        el.innerHTML = '<div style="text-align:center;padding:20px;max-width:400px;font-family:system-ui,sans-serif">'
          + '<div style="font-size:48px;margin-bottom:12px">⚠️</div>'
          + '<div style="font-size:18px;font-weight:700;color:#1a1a1a;margin-bottom:12px">Problème de chargement</div>'
          + '<div style="font-size:14px;color:#555;margin-bottom:20px">L\'application n\'a pas pu démarrer. Vérifiez votre connexion internet.</div>'
          + '<button onclick="location.reload()" style="background:#c8a96e;color:#000;padding:12px 24px;border:0;border-radius:8px;font-weight:700;font-size:14px;cursor:pointer">Recharger</button>'
          + '<div style="font-size:11px;color:#999;margin-top:16px">Si le problème persiste, désinstallez puis réinstallez l\'app.</div>'
          + '</div>';
        el.classList.remove('out');
        el.style.cssText += ';background:#f5f6f8;';
      }
    }
  }, 15000);
})();
</script>

</head>
<body>



<div id="loading">
  <div class="ld-ring"></div>
  <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--gold);letter-spacing:2px">MOBILEA</div>
  <div style="font-size:11px;color:var(--muted);letter-spacing:2px">by MOBILEA</div>
</div>

<!-- LOGIN -->
<div id="login" role="main">
  <div class="lbox">
    <div class="llogo">
      <div class="brand">MOBILEA</div>
      <div class="sub">by MOBILEA — Système VTC Pro</div>
    </div>
    <div class="lcard">
      <div class="lbody">
        <div class="ltabs" id="login-tabs" style="display:none">
          <button class="ltab" id="lt-admin" onclick="switchTab('admin')">Administrateur</button>
          <button class="ltab on" id="lt-dispatch" onclick="switchTab('dispatch')">Dispatch</button>
          <button class="ltab" id="lt-chauffeur" onclick="switchTab('chauffeur')">Chauffeur</button>
          <button class="ltab" id="lt-client" onclick="switchTab('client')">Espace Client</button>
        </div>
        <div id="pane-admin" style="display:none">
          <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:700;margin-bottom:4px;color:#111">Connexion Admin</div>
          <div style="font-size:12px;color:#666;margin-bottom:20px">Accès complet — Mustafa Akdogan</div>
          <div class="fld"><label>Email</label><input type="email" id="l-email" placeholder="votre@email.com" autocomplete="username" maxlength="100"></div>
          <div class="fld"><label>Mot de passe admin</label><input type="password" id="l-pass" placeholder="••••••••" autocomplete="current-password" onkeydown="if(event.key==='Enter')doAdminLogin()" maxlength="128"></div>
          <button class="btn-login" onclick="doAdminLogin()">Se connecter →</button>
          <div style="text-align:center;margin-top:10px"><a href="#" onclick="resetAdminPassword();return false;" style="font-size:12px;color:var(--gold);text-decoration:none">Mot de passe oublié ?</a></div>
          <div class="lerr" id="l-err"></div>
        </div>
        <div id="pane-dispatch">
          <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:700;margin-bottom:4px">Connexion Dispatch</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:20px">Accès dispatch</div>
          <div class="fld"><label>Identifiant</label><input type="text" id="d-user" placeholder="dispatch01" maxlength="200"></div>
          <div class="fld"><label>Mot de passe</label><input type="password" id="d-pass" placeholder="••••••••" onkeydown="if(event.key==='Enter')doDispatchLogin()" maxlength="128"></div>
          <button class="btn-login" onclick="doDispatchLogin()">Se connecter →</button>
          <div class="lerr" id="d-err"></div>
        </div>
        <div id="pane-chauffeur" style="display:none">
          <div style="font-family:'Syne',sans-serif;font-size:17px;font-weight:700;margin-bottom:4px">Connexion Chauffeur</div>
          <div style="font-size:12px;color:var(--muted);margin-bottom:16px">Email et mot de passe</div>
          <div class="fld"><label>Email</label><input type="email" id="chl-email" placeholder="votre@email.com" autocomplete="username" onkeydown="if(event.key==='Enter')doChauffeurLogin()" maxlength="100"></div>
          <div class="fld"><label>Mot de passe</label><input type="password" id="chl-pass" placeholder="••••••••" autocomplete="current-password" onkeydown="if(event.key==='Enter')doChauffeurLogin()" maxlength="128"></div>
          <button class="btn-login" onclick="doChauffeurLogin()">Se connecter →</button>
          <div style="text-align:center;margin-top:10px"><a href="#" onclick="resetChauffeurPassword();return false;" style="font-size:12px;color:var(--gold);text-decoration:none">Mot de passe oublié ?</a></div>
          <div class="lerr" id="chl-err"></div>

          <!-- Ancienne connexion PIN (masquée par défaut) -->
        </div>
        <div id="pane-client" style="display:none">
          <div style="display:flex;gap:6px;margin-bottom:18px">
            <button id="cl-tab-login" onclick="clShowTab('login')" style="flex:1;padding:8px;border:none;border-radius:var(--r-sm);background:var(--gold);color:var(--black);font-family:'Syne',sans-serif;font-size:12px;font-weight:700;cursor:pointer">Se connecter</button>
            <button id="cl-tab-signup" onclick="clShowTab('signup')" style="flex:1;padding:8px;border:1px solid var(--border);border-radius:var(--r-sm);background:transparent;color:var(--muted);font-family:'Syne',sans-serif;font-size:12px;font-weight:700;cursor:pointer">Créer un compte</button>
          </div>
          <div id="cl-panel-login">
            <div class="fld"><label>Email</label><input type="email" id="cl-login-email" placeholder="votre@email.com" autocomplete="username" onkeydown="if(event.key==='Enter')doClientLogin()" maxlength="100"></div>
            <div class="fld"><label>Mot de passe</label><input type="password" id="cl-login-pass" placeholder="••••••••" autocomplete="current-password" onkeydown="if(event.key==='Enter')doClientLogin()" maxlength="128"></div>
            <button class="btn-login" onclick="doClientLogin()">Accéder à mon espace →</button>
            <div style="text-align:center;margin-top:10px"><a href="#" onclick="resetClientPassword();return false;" style="font-size:12px;color:var(--gold);text-decoration:none">Mot de passe oublié ?</a></div>
          </div>
          <div id="cl-panel-signup" style="display:none">
            <div class="fld"><label>Prénom *</label><input type="text" id="cl-reg-prenom" placeholder="Jean" maxlength="100"></div>
            <div class="fld"><label>Nom *</label><input type="text" id="cl-reg-nom" placeholder="Dupont" maxlength="100"></div>
            <div class="fld"><label>Téléphone *</label><input type="tel" id="cl-reg-tel" placeholder="+33 6 00 00 00 00" maxlength="20"></div>
            <div class="fld"><label>Email *</label><input type="email" id="cl-reg-email" placeholder="votre@email.com" maxlength="100"></div>
            <div class="fld"><label>Mot de passe *</label><input type="password" id="cl-reg-pass" placeholder="Min. 6 caractères" maxlength="128"></div>
            <div class="fld"><label>Confirmer *</label><input type="password" id="cl-reg-pass2" placeholder="••••••••" maxlength="128" onkeydown="if(event.key==='Enter')doClientSignup()"></div>
            <button class="btn-login" onclick="doClientSignup()">Créer mon compte →</button>
            <p style="font-size:11px;color:var(--muted);text-align:center;margin:10px 0 0;line-height:1.4">En créant un compte, vous acceptez notre <a href="#" onclick="mobileaOuvrirConfidentialite();return false;" style="color:var(--gold)">politique de confidentialité</a>.</p>
            <div id="cl-signup-ok" style="display:none;margin-top:12px;padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r-sm);font-size:13px;color:#166534;text-align:center">
              ✅ Compte créé ! Connexion en cours...
            </div>
          </div>
          <div class="lerr" id="cl-err"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<!-- APP -->
<div id="app">
  <div class="mob-ov" id="mob-ov" onclick="closeMob()"></div>
  <aside class="sidebar" id="sidebar">
    <div class="sb-top" style="position:relative">
      <div class="sb-brand">MOBILEA</div>
      <div class="sb-sub">by MOBILEA</div>
      <div class="sb-role role-admin" id="sb-role">Administrateur</div>
    </div>
    <nav class="nav" id="main-nav">
      <div class="nsec">Principal</div>
      <button class="ni on admin-only" data-p="dashboard" onclick="gp('dashboard',this)"><i style="width:16px;text-align:center" class="fas fa-chart-line"></i> Dashboard</button>
      <button class="ni" data-p="dispatch" onclick="gp('dispatch',this)"><i style="width:16px;text-align:center" class="fas fa-route"></i> Dispatch <span class="nb" id="nb-d">0</span></button>
      <button class="ni" data-p="planning" onclick="gp('planning',this)"><i style="width:16px;text-align:center" class="fas fa-calendar-alt"></i> Planning</button>
      <button class="ni" data-p="transfertsgerants" onclick="gp('transfertsgerants',this)"><i style="width:16px;text-align:center" class="fas fa-user-tie"></i> Transferts gérants <span class="nb" id="nb-tg">0</span></button>
      <div class="nsec">Équipe</div>
      <button class="ni" data-p="chauffeurs" onclick="gp('chauffeurs',this)"><i style="width:16px;text-align:center" class="fas fa-id-card"></i> Chauffeurs <span class="nb g" id="nb-c">0</span></button>
      <button class="ni" data-p="vehicules" onclick="gp('vehicules',this)"><i style="width:16px;text-align:center" class="fas fa-car"></i> Véhicules</button>
      <button class="ni" data-p="cartechauffeurs" onclick="gp('cartechauffeurs',this)"><i style="width:16px;text-align:center" class="fas fa-map-marked-alt"></i> Carte chauffeurs</button>
      <button class="ni" data-p="pointage" onclick="gp('pointage',this)"><i style="width:16px;text-align:center" class="fas fa-clipboard-check"></i> Pointage & Véhicules</button>
      <button class="ni admin-only" data-p="soustraitants" onclick="gp('soustraitants',this)"><i style="width:16px;text-align:center" class="fas fa-handshake"></i> Sous-traitants</button>
      <div class="nsec">Gestion</div>
      <button class="ni admin-only" data-p="clients" onclick="gp('clients',this)"><i style="width:16px;text-align:center" class="fas fa-users"></i> Clients</button>
      <button class="ni admin-only" data-p="tarifs" onclick="gp('tarifs',this)"><i style="width:16px;text-align:center" class="fas fa-tags"></i> Tarifs</button>
      <div class="nsec">Communication</div>
      <button class="ni" data-p="messagerie" onclick="gp('messagerie',this)"><i style="width:16px;text-align:center" class="fas fa-comments"></i> Messagerie <span class="nb b" id="nb-msg">0</span></button>
      <div class="nsec">Finance</div>
      <button class="ni admin-only" data-p="facturation" onclick="gp('facturation',this)"><i style="width:16px;text-align:center" class="fas fa-file-invoice-dollar"></i> Facturation</button>
      <button class="ni admin-only" data-p="rapports" onclick="gp('rapports',this)"><i style="width:16px;text-align:center" class="fas fa-chart-pie"></i> Rapports</button>
      <button class="ni admin-only" data-p="dirigeant" onclick="gp('dirigeant',this)"><i style="width:16px;text-align:center" class="fas fa-chart-bar"></i> Dashboard dirigeant</button>
      <div class="nsec">Système</div>
      <button class="ni admin-only" data-p="reservation" onclick="gp('reservation',this)"><i style="width:16px;text-align:center" class="fas fa-globe"></i> App cliente</button>
      <button class="ni admin-only" data-p="comptes-clients" onclick="gp('comptes-clients',this)"><i style="width:16px;text-align:center" class="fas fa-building"></i> Comptes Clients</button>
      <button class="ni admin-only" data-p="comptes" onclick="gp('comptes',this)"><i style="width:16px;text-align:center" class="fas fa-users-cog"></i> Comptes Dispatch</button>
      <button class="ni" data-p="historique" onclick="gp('historique',this)"><i style="width:16px;text-align:center" class="fas fa-history"></i> Historique</button>
      <button class="ni admin-only" data-p="aiphone" onclick="gp('aiphone',this)"><i style="width:16px;text-align:center" class="fas fa-phone-volume"></i> IA Téléphonique</button>
      <button class="ni admin-only" data-p="parametres" onclick="gp('parametres',this)"><i style="width:16px;text-align:center" class="fas fa-cog"></i> Paramètres</button>
    </nav>
    <div class="sb-bot">
      <div class="sb-user">
        <div class="sb-av" id="sb-av">M</div>
        <div style="flex:1;min-width:0">
          <div style="font-size:12px;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis" id="sb-un">Mustafa</div>
          <div style="font-size:10px;color:var(--muted)" id="sb-ue">Admin</div>
        </div>
        <div class="sb-logout" onclick="doLogout()"><i class="fas fa-sign-out-alt"></i></div>
      </div>
    </div>
  </aside>

  <main class="main">
    <div class="topbar">
      <div class="tbl">
        <button class="mob-btn" onclick="toggleMob()" aria-label="Menu"><i class="fas fa-bars" aria-hidden="true"></i></button>
        <div class="tb-title" id="page-title">Dashboard</div>
      </div>
      <div class="tbr">
        <div class="tb-clock" id="clock">--:--</div>
        <div id="fb-status" style="font-size:11px;color:var(--muted)">⏳</div>
        <div class="tb-ico" onclick="loadAll().then(()=>showToast('Actualisé ✓'))" title="Actualiser"><i class="fas fa-sync-alt"></i></div>
        <button class="btn btn-p btn-sm" id="btn-new" onclick="openCourseModal()" style="display:none"><i class="fas fa-plus"></i> Nouvelle course</button>
      </div>
    </div>

    <div class="content">

      <!-- DASHBOARD -->
      <div class="page on" id="page-dashboard">
        <div class="sg">
          <div class="sc cg" onclick="gp('dispatch',document.querySelector('[data-p=dispatch]'))">
            <div class="sc-head"><div class="sc-ico"><i class="fas fa-route"></i></div></div>
            <div class="sc-val" id="sd-courses">0</div><div class="sc-lbl">Courses ce mois</div><div class="sc-sub">Transferts + MAD</div>
          </div>
          <div class="sc cgr" onclick="gp('facturation',document.querySelector('[data-p=facturation]'))">
            <div class="sc-head"><div class="sc-ico"><i class="fas fa-euro-sign"></i></div></div>
            <div class="sc-val" id="sd-ca">0€</div><div class="sc-lbl">CA TTC ce mois</div><div class="sc-sub">Terminées uniquement</div>
          </div>
          <div class="sc cb" onclick="gp('chauffeurs',document.querySelector('[data-p=chauffeurs]'))">
            <div class="sc-head"><div class="sc-ico"><i class="fas fa-id-card"></i></div></div>
            <div class="sc-val" id="sd-chauff">0</div><div class="sc-lbl">Chauffeurs</div><div class="sc-sub">Sur l'équipe</div>
          </div>
          <div class="sc co">
            <div class="sc-head"><div class="sc-ico"><i class="fas fa-clock"></i></div></div>
            <div class="sc-val" id="sd-wait">0</div><div class="sc-lbl">En attente dispatch</div><div class="sc-sub">À assigner</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;margin-bottom:18px">
          <div class="sec">
            <div class="sec-h"><div class="sec-t"><i class="fas fa-chart-bar"></i> CA mensuel (TTC)</div></div>
            <div style="padding:18px;height:220px"><canvas id="chart-main" style="width:100%;height:100%"></canvas></div>
          </div>
          <div class="sec">
            <div class="sec-h"><div class="sec-t"><i class="fas fa-bell"></i> Activité récente</div></div>
            <div class="tl" id="tl-dash"></div>
          </div>
        </div>

        <!-- ANALYSE FINANCIÈRE — indicateurs de pilotage (rempli par renderDashFinance) -->
        <div id="dash-finance"></div>
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-route"></i> Courses actives</div>
            <div style="display:flex;gap:8px">
              <button class="btn btn-g btn-sm" onclick="exportExcel()"><i class="fas fa-file-excel"></i> Export Excel</button>
              <button class="btn btn-p btn-sm" onclick="openCourseModal()"><i class="fas fa-plus"></i> Nouvelle course</button>
            </div>
          </div>
          <div class="tw"><table><thead><tr><th>Client</th><th>Type</th><th>Trajet</th><th>Chauffeur</th><th>Statut</th><th>TTC</th><th>Action</th></tr></thead><tbody id="tb-dash"></tbody></table></div>
        </div>
      </div>

      <!-- DISPATCH -->
      <div class="page" id="page-dispatch">

        <!-- DEMANDES IA EN ATTENTE DE VALIDATION -->
        <div id="aip-pending-wrap" style="display:none;margin-bottom:14px;padding:14px;background:linear-gradient(135deg,rgba(245,158,11,.12),rgba(245,158,11,.06));border:1px solid rgba(245,158,11,.4);border-radius:12px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
            <div style="font-weight:800;color:var(--orange,#f59e0b);font-size:14px"><i class="fas fa-robot"></i> Demandes IA téléphonique à valider <span id="aip-pending-count" style="background:var(--orange,#f59e0b);color:#111;border-radius:999px;padding:1px 8px;font-size:11px;margin-left:6px">0</span></div>
            <button class="btn btn-ghost btn-sm" onclick="aipPendingLoad()" title="Rafraîchir" aria-label="Rafraîchir"><i class="fas fa-sync" aria-hidden="true"></i></button>
          </div>
          <div id="aip-pending-list" style="display:flex;flex-direction:column;gap:8px"></div>
        </div>

        <!-- VUE PLANNING STYLE GOOGLE AGENDA (défaut pour dispatch) -->
        <div id="dv-planning-agenda">
          <!-- Header navigation date -->
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;flex-wrap:wrap;gap:10px">
            <div style="display:flex;align-items:center;gap:10px">
              <button class="btn btn-ghost btn-sm" onclick="agendaDay(-1)" aria-label="Précédent"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
              <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700" id="agenda-date-title"></div>
              <button class="btn btn-ghost btn-sm" onclick="agendaDay(1)" aria-label="Suivant"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="agendaToday()">Aujourd'hui</button>
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <button class="btn btn-p" onclick="openCourseModal()" style="font-size:13px;padding:10px 18px"><i class="fas fa-plus"></i> Nouveau transfert</button>
              <button class="btn btn-s btn-sm admin-only" onclick="switchDispatchView('table')"><i class="fas fa-table"></i> Tableau</button>
              <span class="bdg bdg-muted" id="agenda-cnt">0 courses</span>
            </div>
          </div>

          <!-- Mini calendrier semaine -->
          <div id="agenda-week-strip" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:16px"></div>

          <!-- Liste courses du jour style agenda -->
          <div id="agenda-list"></div>
        </div>

        <!-- VUE TABLEAU (admin) -->
        <div id="dv-planning-table" style="display:none">
          <div class="sec-a" style="margin-bottom:14px;gap:8px;flex-wrap:wrap">
            <button class="btn btn-p" onclick="openCourseModal()"><i class="fas fa-plus"></i> Nouvelle course</button>
            <button class="btn btn-s btn-sm" onclick="switchDispatchView('agenda')"><i class="fas fa-calendar-alt"></i> Planning</button>
            <div class="sbw" style="min-width:260px"><i class="fas fa-search"></i><input type="text" placeholder="Client, passager, chauffeur, adresse, vol, n° bon, tél, prix..." id="ds-q" oninput="renderDispatch()" maxlength="200"></div>
            <div style="display:flex;align-items:center;gap:4px">
              <input type="date" class="fsel" id="ds-d1" onchange="renderDispatch()" title="Date de début" style="padding:6px 8px">
              <span style="color:var(--muted);font-size:11px">→</span>
              <input type="date" class="fsel" id="ds-d2" onchange="renderDispatch()" title="Date de fin" style="padding:6px 8px">
              <button class="btn btn-ghost btn-sm" onclick="resetRechercheDispatch()" title="Effacer la recherche et les dates" aria-label="Effacer la recherche et les dates"><i class="fas fa-eraser" aria-hidden="true"></i></button>
            </div>
            <select class="fsel" id="ds-s" onchange="renderDispatch()">
              <option value="">Tous statuts</option>
              <option value="nouvelle">🆕 Nouvelle</option>
              <option value="en_attente">⏳ En attente</option>
              <option value="attribuee">👤 Attribuée</option>
              <option value="acceptee">✅ Accepté</option>
              <option value="en_route">🚗 En route</option>
              <option value="sur_place">📍 Sur place</option>
              <option value="onboard">👤 Client à bord</option>
              <option value="depose">🏁 Déposé</option>
              <option value="terminee">✔ Terminée</option>
              <option value="facturee">📄 Facturée</option>
              <option value="payee">💚 Payée</option>
              <option value="annulee">✗ Annulée</option>
              <option value="noshow">👻 No-show</option>
            </select>
            <select class="fsel" id="ds-t" onchange="renderDispatch()">
              <option value="">Tous types</option>
              <option value="transfert">Transfert</option>
              <option value="mad">Mise à disposition</option>
            </select>
            <select class="fsel" id="ds-v" onchange="switchView(this.value)">
              <option value="table">Liste</option><option value="kanban">Kanban</option>
            </select>
            <span class="bdg bdg-muted" id="ds-cnt">0 courses</span>
            <button class="btn btn-g btn-sm" onclick="exportExcel()"><i class="fas fa-file-excel"></i> Export Excel</button>
            <label class="btn btn-s btn-sm" style="cursor:pointer"><i class="fas fa-file-upload"></i> Importer Excel<input type="file" accept=".csv,.xlsx,.xls" style="display:none" onchange="importExcel(this)"></label>
            <div style="position:relative">
              <button class="btn btn-s btn-sm" onclick="toggleColMenu()" id="col-btn"><i class="fas fa-columns"></i> Colonnes</button>
            <div id="col-menu" style="display:none;position:absolute;top:36px;right:0;background:var(--card);border:1px solid var(--border2);border-radius:var(--r-sm);padding:12px;z-index:200;min-width:180px;box-shadow:var(--shadow)">
              <div style="font-family:'Syne',sans-serif;font-size:11px;font-weight:700;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:0.5px">Afficher / Masquer</div>
              <label class="col-toggle" data-col="col-ref"><input type="checkbox" checked onchange="toggleCol('col-ref',this.checked)"> Référence</label>
              <label class="col-toggle" data-col="col-dt"><input type="checkbox" checked onchange="toggleCol('col-dt',this.checked)"> Date / Heure</label>
              <label class="col-toggle" data-col="col-client"><input type="checkbox" checked onchange="toggleCol('col-client',this.checked)"> Client</label>
              <label class="col-toggle" data-col="col-type"><input type="checkbox" checked onchange="toggleCol('col-type',this.checked)"> Type</label>
              <label class="col-toggle" data-col="col-dep"><input type="checkbox" checked onchange="toggleCol('col-dep',this.checked)"> Départ</label>
              <label class="col-toggle" data-col="col-arr"><input type="checkbox" checked onchange="toggleCol('col-arr',this.checked)"> Arrivée</label>
              <label class="col-toggle" data-col="col-term"><input type="checkbox" checked onchange="toggleCol('col-term',this.checked)"> Terminaux</label>
              <label class="col-toggle" data-col="col-chauff"><input type="checkbox" checked onchange="toggleCol('col-chauff',this.checked)"> Chauffeur</label>
              <label class="col-toggle" data-col="col-veh"><input type="checkbox" checked onchange="toggleCol('col-veh',this.checked)"> Véhicule</label>
              <label class="col-toggle" data-col="col-pax"><input type="checkbox" checked onchange="toggleCol('col-pax',this.checked)"> Pax</label>
              <label class="col-toggle" data-col="col-ttc"><input type="checkbox" checked onchange="toggleCol('col-ttc',this.checked)"> Prix TTC</label>
              <label class="col-toggle" data-col="col-statut"><input type="checkbox" checked onchange="toggleCol('col-statut',this.checked)"> Statut</label>
              <div style="border-top:1px solid var(--border);margin-top:8px;padding-top:8px">
                <button onclick="resetCols()" style="background:none;border:none;color:var(--gold);font-size:11px;cursor:pointer;padding:0"><i class="fas fa-redo"></i> Tout afficher</button>
              </div>
            </div>
          </div>
        </div>
        <div id="dv-table"><div id="groupe-bar" style="display:none;margin-bottom:10px;padding:10px 14px;background:var(--purple-dim);border:1px solid rgba(155,127,240,0.3);border-radius:var(--r-sm);align-items:center;gap:10px;flex-wrap:wrap"><span style="font-size:12px;color:var(--purple);font-weight:600"><i class="fas fa-check-square"></i> <span id="sel-count">0</span> course(s) sélectionnée(s)</span><div class="drv-wrap" style="min-width:220px"><input type="text" id="groupe-drv-input" class="drv-input" placeholder="Rechercher un chauffeur..." autocomplete="off" oninput="filterDrv('groupe-drv',this.value)" onfocus="openDrv('groupe-drv')" onblur="setTimeout(()=>closeDrv('groupe-drv'),200)" maxlength="200"><input type="hidden" id="groupe-drv" value=""><div class="drv-drop" id="drv-drop-groupe-drv"></div></div><button class="btn btn-p btn-sm" onclick="assignGroupe()"><i class="fas fa-user-check"></i> Assigner le groupe</button><button class="btn btn-sm" onclick="proposerSelectionAuxPrioritaires()" style="background:linear-gradient(135deg,#fef3c7,#fde68a);border:1px solid #d97706;color:#92400e;font-weight:700">⭐ Proposer aux prioritaires</button><button class="btn btn-ghost btn-sm" onclick="clearSelection()"><i class="fas fa-times"></i> Annuler</button></div><div class="sec"><div class="tw"><table><thead><tr><th><input type="checkbox" id="chk-all" onchange="toggleAll(this)" style="cursor:pointer;width:14px;height:14px"></th><th class="col-dt">Date / Heure</th><th class="col-dep">Départ</th><th class="col-arr">Arrivée</th><th class="col-veh">Véhicule</th><th class="col-chauff">Chauffeur</th><th class="col-term">Terminaux</th><th class="col-client">Client</th><th class="col-pax">Pax</th><th class="col-ttc">TTC</th><th class="col-statut">Statut</th><th>Actions</th></tr></thead><tbody id="tb-dispatch"></tbody></table></div></div></div>
        <div id="dv-kanban" style="display:none"><div class="kb" id="kb-dispatch"></div></div>
        </div><!-- end dv-planning-table -->
      </div>

      <!-- PLANNING -->
      <div class="page" id="page-planning">
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-calendar-alt"></i> Planning <span id="plan-m" style="color:var(--gold);margin-left:6px"></span></div>
            <div class="sec-a">
              <button class="btn btn-ghost btn-sm" onclick="chMonth(-1)" aria-label="Précédent"><i class="fas fa-chevron-left" aria-hidden="true"></i></button>
              <button class="btn btn-ghost btn-sm" onclick="chMonth(1)" aria-label="Suivant"><i class="fas fa-chevron-right" aria-hidden="true"></i></button>
              <button class="btn btn-p btn-sm" onclick="openCourseModal()"><i class="fas fa-plus"></i> Ajouter</button>
            </div>
          </div>
          <div id="cal-wrap" style="padding:16px"></div>
        </div>
        <div class="sec" style="margin-top:16px">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-list"></i> Aujourd'hui par chauffeur</div></div>
          <div id="plan-drivers" style="padding:16px"></div>
        </div>
      </div>

      <!-- CHAUFFEURS -->
      <div class="page" id="page-chauffeurs">
        <div class="sec-a" style="margin-bottom:14px;gap:8px;flex-wrap:wrap">
          <div class="sbw"><i class="fas fa-search"></i><input type="text" placeholder="Rechercher..." id="ch-q" oninput="renderChauffeurs()" maxlength="200"></div>
          <select class="fsel" id="ch-s" onchange="renderChauffeurs()"><option value="" data-t="all">Tous</option><option value="disponible">Disponible</option><option value="indisponible">Indisponible</option><option value="archived">📦 Archivés</option></select>
          <button class="btn btn-p btn-sm admin-only" id="btn-add-chauffeur" onclick="openChauffeurModal()"><i class="fas fa-plus"></i> Ajouter chauffeur</button>
          <button class="btn btn-s btn-sm" onclick="toggleLiveMap()"><i class="fas fa-map-marked-alt"></i> Carte temps réel</button>
        </div>

        <!-- CARTE TEMPS RÉEL -->
        <div id="live-map-wrap" style="display:none;margin-bottom:16px">
          <div class="sec">
            <div class="sec-h">
              <div class="sec-t"><i class="fas fa-map-marked-alt" style="color:var(--green)"></i> Suivi temps réel <span id="live-map-count" class="bdg bdg-green" style="margin-left:6px">0 actif(s)</span></div>
              <div style="display:flex;align-items:center;gap:8px">
                <span style="font-size:11px;color:var(--muted)" id="live-map-updated"></span>
                <button class="btn btn-ghost btn-sm" onclick="toggleLiveMapList()"><i class="fas fa-list"></i> <span id="live-map-list-lbl">Liste</span></button>
                <button class="btn btn-ghost btn-sm" onclick="refreshLiveMap()"><i class="fas fa-sync-alt"></i> Actualiser</button>
                <button class="btn btn-ghost btn-sm" onclick="toggleLiveMap()" style="color:var(--red)"><i class="fas fa-times"></i> Fermer</button>
              </div>
            </div>
            <div id="live-map-container" style="height:420px;border-radius:0 0 var(--r) var(--r);overflow:hidden;position:relative">
              <div id="live-map" style="width:100%;height:100%"></div>
              <div id="live-map-list" style="display:none;position:absolute;top:10px;right:10px;background:rgba(13,15,18,0.92);border:1px solid var(--border);border-radius:var(--r-sm);padding:10px;min-width:190px;max-height:390px;overflow-y:auto;box-shadow:var(--shadow);z-index:1000"></div>
            </div>
          </div>
        </div>

        <div class="cg" id="cg-ch"></div>
      </div>

      <!-- VEHICULES -->
      <!-- POINTAGE JOURNALIER + AFFECTATION DES VEHICULES -->
      <div class="page" id="page-pointage">
        <div class="sec" style="margin-bottom:16px">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-clipboard-check"></i> Saisie du jour</div>
            <div class="sec-a">
              <input type="date" class="fsel" id="pt-date" onchange="renderPointage()" style="padding:6px 10px">
              <button class="btn btn-ghost btn-sm" onclick="ptAujourdhui()">Aujourd'hui</button>
            </div>
          </div>
          <div style="padding:16px">
            <div class="fg3" style="margin-bottom:12px">
              <div class="fld"><label>Chauffeur</label>
                <select id="pt-chauffeur"><option value="">— Choisir —</option></select>
              </div>
              <div class="fld"><label>Début de journée</label>
                <input type="time" id="pt-debut" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;color:var(--white);font-size:13px;width:100%">
              </div>
              <div class="fld"><label>Fin de journée</label>
                <input type="time" id="pt-fin" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;color:var(--white);font-size:13px;width:100%">
              </div>
            </div>
            <div class="fg3" style="margin-bottom:12px">
              <div class="fld"><label>Véhicule utilisé</label>
                <select id="pt-vehicule"><option value="">— Aucun —</option></select>
              </div>
              <div class="fld"><label>Note (facultatif)</label>
                <input type="text" id="pt-note" maxlength="200" placeholder="Congé, maintenance…" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;color:var(--white);font-size:13px;width:100%">
              </div>
              <div class="fld"><label>&nbsp;</label>
                <button class="btn btn-p" style="width:100%" onclick="savePointage()"><i class="fas fa-save"></i> Enregistrer</button>
              </div>
            </div>
            <div id="pt-msg" style="font-size:12px;color:var(--muted)"></div>
          </div>
        </div>

        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-list-ul"></i> Journée du <span id="pt-jour-label">—</span></div>
            <div class="sec-a">
              <span class="bdg bdg-gold" id="pt-total">0 h</span>
            </div>
          </div>
          <div class="tw"><table><thead><tr>
            <th>Chauffeur</th><th>Début</th><th>Fin</th><th>Heures</th><th>Véhicule</th><th>Note</th><th>Saisi par</th><th>Actions</th>
          </tr></thead><tbody id="tb-pointage"></tbody></table></div>
        </div>

        <div class="sec" style="margin-top:16px">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-calendar-alt"></i> Récapitulatif du mois</div>
            <div class="sec-a">
              <input type="month" class="fsel" id="pt-mois" onchange="renderPointage()" style="padding:6px 10px">
            </div>
          </div>
          <div style="padding:12px 16px;display:flex;gap:10px;flex-wrap:wrap;align-items:flex-end;border-bottom:1px solid var(--border2)">
            <div class="fld" style="flex:1;min-width:160px">
              <label>🏢 Société</label>
              <select id="pt-filtre-societe" onchange="renderPointage()" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:9px;color:var(--white);font-size:13px">
                <option value="">Toutes les sociétés</option>
              </select>
            </div>
            <div class="fld" style="flex:1;min-width:160px">
              <label>🔍 Rechercher un chauffeur</label>
              <input type="text" id="pt-recherche" oninput="renderPointage()" placeholder="Nom du chauffeur..." style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:9px;color:var(--white);font-size:13px">
            </div>
            <button class="btn btn-g" onclick="exportPointageExcel()" style="white-space:nowrap"><i class="fas fa-file-excel"></i> Export Excel (compta)</button>
          </div>
          <div class="tw"><table><thead><tr>
            <th>Chauffeur</th><th>Jours travaillés</th><th>Total heures</th><th>Moyenne / jour</th><th>Véhicules utilisés</th>
          </tr></thead><tbody id="tb-pointage-mois"></tbody></table></div>
        </div>
      </div>

      <div class="page" id="page-vehicules">
        <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
          <button class="btn btn-p btn-sm" onclick="openVehiculeModal()"><i class="fas fa-plus"></i> Ajouter véhicule</button>
        </div>
        <div class="cg" id="cg-vh"></div>
      </div>

      <!-- CARTE CHAUFFEURS -->
      <div class="page" id="page-cartechauffeurs">
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-map-marked-alt" style="color:var(--green)"></i> Carte des chauffeurs <span id="cc-count" class="bdg bdg-green" style="margin-left:6px">0 actif(s)</span></div>
            <div class="sec-a">
              <span style="font-size:11px;color:var(--muted)" id="cc-updated"></span>
              <button class="btn btn-s btn-sm" onclick="refreshCarteChauffeurs()"><i class="fas fa-sync"></i> Actualiser</button>
            </div>
          </div>
          <div style="padding:10px 16px;border-top:1px solid var(--border);display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:var(--card2)">
            <span style="font-size:12px;color:var(--muted);font-weight:600"><i class="fas fa-route" style="color:var(--gold)"></i> Historique de déplacement :</span>
            <select id="cc-hist-driver" class="fsel" style="padding:6px 8px;min-width:150px"><option value="">Choisir un chauffeur…</option></select>
            <input type="date" id="cc-hist-date" class="fsel" style="padding:6px 8px">
            <button class="btn btn-p btn-sm" onclick="voirTraceChauffeur()"><i class="fas fa-play"></i> Voir le trajet</button>
            <button class="btn btn-ghost btn-sm" onclick="effacerTraceChauffeur()"><i class="fas fa-eraser"></i> Effacer</button>
            <span id="cc-hist-info" style="font-size:11px;color:var(--muted)"></span>
          </div>
          <div id="cc-map-container" style="height:540px;border-radius:0 0 var(--r) var(--r);overflow:hidden;position:relative">
            <div id="cc-map" style="width:100%;height:100%"></div>
          </div>
        </div>
        <div style="margin-top:14px;padding:12px 16px;background:var(--blue-dim);border:1px solid rgba(91,156,246,0.2);border-radius:var(--r-sm);font-size:12px;color:var(--blue)">
          <i class="fas fa-info-circle"></i> Seuls les chauffeurs ayant activé le partage de position apparaissent. La carte se rafraîchit automatiquement toutes les 15 secondes.
        </div>
      </div>

      <div class="page" id="page-soustraitants">
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-handshake" style="color:var(--gold)"></i> Sous-traitants & Partenaires <span id="st-count" class="bdg bdg-gold" style="margin-left:6px">0</span></div>
          </div>
          <div style="padding:14px 16px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--border2)">
            Sociétés sous-traitantes, leurs chauffeurs, coordonnées et véhicules — regroupés par société.
          </div>
          <div id="st-list" style="padding:12px"></div>
        </div>
      </div>

      <!-- CLIENTS -->
      <div class="page" id="page-clients">
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-users"></i> Clients</div>
            <div class="sec-a">
              <div class="sbw"><i class="fas fa-search"></i><input type="text" placeholder="Rechercher..." id="cl-q" oninput="renderClients()" maxlength="200"></div>
              <button class="btn btn-p btn-sm" onclick="openClientModal()"><i class="fas fa-plus"></i> Ajouter</button>
            </div>
          </div>
          <div class="tw"><table><thead><tr><th>Société</th><th>Contact</th><th>Téléphone</th><th>Email</th><th>Infos légales</th><th>Facturation</th><th>Activité</th><th>Actions</th></tr></thead><tbody id="tb-cl"></tbody></table></div>
        </div>
      </div>

      <!-- TARIFS -->
      <div class="page" id="page-tarifs">
        <!-- APPLIQUER LA GRILLE AUX COURSES SANS PRIX.
             Les tarifs ne s'appliquent qu'a la saisie d'une course. Les courses
             importees de LogiPax arrivent sans prix chauffeur : sans ce
             rattrapage, le chauffeur ne voit aucun montant. -->
        <div class="sec" style="margin-bottom:16px">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-wand-magic-sparkles" style="color:var(--gold)"></i> Appliquer les tarifs aux courses sans prix</div>
          </div>
          <div style="padding:16px">
            <div style="font-size:12px;color:var(--muted);margin-bottom:12px">
              Applique la grille tarifaire aux courses qui n'ont pas encore de prix — notamment celles importées de LogiPax. Sans prix chauffeur, le montant n'apparaît ni sur l'app du chauffeur ni sur son bon de commande.
            </div>
            <div class="fg3" style="margin-bottom:12px">
              <div class="fld"><label>Client</label>
                <select id="rtp-client"><option value="">— Choisir un client —</option></select>
              </div>
              <div class="fld"><label>À partir du</label>
                <input type="date" id="rtp-date" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;color:var(--white);font-size:13px;width:100%">
              </div>
              <div class="fld"><label>&nbsp;</label>
                <button class="btn btn-s" style="width:100%" onclick="analyserPrixManquants()"><i class="fas fa-search"></i> Analyser</button>
              </div>
            </div>
            <div id="rtp-resultat"></div>
          </div>
        </div>

        <!-- GRILLE TARIFAIRE PAR CLIENT -->
        <div class="sec" style="margin-bottom:16px">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-building" style="color:var(--gold)"></i> Grille tarifaire par client</div>
            <div style="display:flex;gap:8px;align-items:center">
              <select id="grid-client-select" onchange="loadClientGrid()" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;color:var(--white);font-size:12px;min-width:160px">
                <option value="">— Choisir un client —</option>
              </select>
              <button class="btn btn-p btn-sm" onclick="saveClientGrid()"><i class="fas fa-save"></i> Enregistrer</button>
            </div>
          </div>
          <div style="padding:16px">
            <div style="font-size:12px;color:var(--muted);margin-bottom:14px">Prix de base et supplément par arrêt supplémentaire. Tous les montants en € TTC. Sélectionnez un client pour voir/modifier sa grille.</div>
            <div id="client-grid-wrap" style="display:none">
              <div style="overflow-x:auto">
                <table style="width:100%;border-collapse:collapse;font-size:12px;min-width:680px">
                  <thead>
                    <tr style="background:var(--dark)">
                      <th style="padding:8px;text-align:left;color:var(--gold)">Trajet / Véhicule</th>
                      <th style="padding:8px;text-align:center;color:var(--white)">Prix CLIENT (€)</th>
                      <th style="padding:8px;text-align:center;color:var(--green)">Prix CHAUFFEUR (€)</th>
                      <th style="padding:8px;text-align:center;color:var(--white2)">Suppl. arrêt CLIENT (€)</th>
                      <th style="padding:8px;text-align:center;color:var(--green)">Suppl. arrêt CHAUFFEUR (€)</th>
                    </tr>
                  </thead>
                  <tbody id="client-grid-body"></tbody>
                </table>
              </div>
            </div>
            <div id="client-grid-empty" style="text-align:center;padding:30px;color:var(--muted);font-size:13px">
              <i class="fas fa-arrow-up" style="font-size:20px;margin-bottom:8px;display:block;color:var(--gold)"></i>
              Sélectionnez un client ci-dessus pour configurer sa grille tarifaire
            </div>
          </div>
        </div>

        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
          <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--white2)">Autres tarifs</div>
          <button class="btn btn-p btn-sm" onclick="openTarifModal()"><i class="fas fa-plus"></i> Ajouter tarif</button>
        </div>
        <div class="cg" id="cg-tf"></div>

        <!-- ZONES TARIFAIRES FIXES (pour clients particuliers) -->
        <div class="sec" style="margin-top:20px">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-map-marked-alt" style="color:var(--gold)"></i> Zones tarifaires fixes</div>
            <button class="btn btn-p btn-sm" onclick="openZoneModal()"><i class="fas fa-plus"></i> Ajouter une zone</button>
          </div>
          <div style="padding:12px 16px;font-size:12px;color:var(--muted);background:var(--card2);border-bottom:1px solid var(--border)">
            <i class="fas fa-info-circle" style="color:var(--gold)"></i>
            Les zones fixes sont prioritaires. Si le trajet ne correspond à aucune zone, le prix est calculé au km.
            <br>Tarif hors zone : <strong id="hz-tarif-display">—</strong> €/km —
            <button onclick="loadHorsZoneForm()" style="background:none;border:none;color:var(--gold);cursor:pointer;font-size:12px;text-decoration:underline">Modifier</button>
          </div>
          <div style="padding:16px">
            <div id="zones-list" style="display:flex;flex-direction:column;gap:8px">
              <div style="text-align:center;color:var(--muted);font-size:12px;padding:20px">Chargement...</div>
            </div>
          </div>
        </div>

        <!-- TARIF HORS ZONE PAR KM -->
        <div class="sec" style="margin-top:16px">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-road" style="color:var(--blue)"></i> Tarif hors zone (au km)</div></div>
          <div style="padding:16px">
            <div class="fg3">
              <div class="fld"><label>Berline (€/km)</label><input type="number" id="hz-berline" step="0.1" min="0" placeholder="1.80" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none"></div>
              <div class="fld"><label>Van (€/km)</label><input type="number" id="hz-van" step="0.1" min="0" placeholder="2.20" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none"></div>
              <div class="fld"><label>Sprinter (€/km)</label><input type="number" id="hz-sprinter" step="0.1" min="0" placeholder="2.80" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none"></div>
              <div class="fld"><label>Limousine (€/km)</label><input type="number" id="hz-limousine" step="0.1" min="0" placeholder="3.50" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none"></div>
              <div class="fld"><label>🖤 Classe S (€/km)</label><input type="number" id="hz-classes" step="0.1" min="0" placeholder="4.00" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none"></div>
            </div>
            <div class="fg3" style="margin-top:10px">
              <div class="fld"><label>Prise en charge (€)</label><input type="number" id="hz-pec" step="0.5" min="0" placeholder="5.00" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none"></div>
              <div class="fld"><label>Nuit/WE +%</label><input type="number" id="hz-majoration" step="1" min="0" max="100" placeholder="20" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none"></div>
              <div class="fld"><label>Min. de facturation (€)</label><input type="number" id="hz-min" step="1" min="0" placeholder="30" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none"></div>
            </div>
            <button class="btn btn-p" style="margin-top:12px" onclick="saveHorsZone()"><i class="fas fa-save"></i> Enregistrer les tarifs hors zone</button>
          </div>
        </div>
      </div>

      <!-- FACTURATION -->
      <div class="page" id="page-facturation">
        <!-- GÉNÉRATEUR DE FACTURES -->
        <div class="sec" style="margin-bottom:16px">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-file-invoice-dollar"></i> Générer une facture</div>
          </div>
          <div style="padding:16px">
            <div class="fg3" style="margin-bottom:14px">
              <div class="fld"><label>Client</label>
                <select id="inv-client"><option value="">— Choisir un client —</option></select>
              </div>
              <div class="fld"><label>Date début</label>
                <input type="date" id="inv-date-start" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;color:var(--white);font-size:13px;width:100%">
              </div>
              <div class="fld"><label>Date fin</label>
                <input type="date" id="inv-date-end" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;color:var(--white);font-size:13px;width:100%">
              </div>
            </div>
            <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:12px">
              <button class="btn btn-ghost btn-sm" onclick="setInvoiceRange('week')">Cette semaine</button>
              <button class="btn btn-ghost btn-sm" onclick="setInvoiceRange('lastweek')">Semaine dernière</button>
              <button class="btn btn-ghost btn-sm" onclick="setInvoiceRange('month')">Ce mois</button>
              <button class="btn btn-ghost btn-sm" onclick="setInvoiceRange('lastmonth')">Mois dernier</button>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button class="btn btn-p" onclick="previewInvoice()"><i class="fas fa-eye"></i> Aperçu</button>
              <button class="btn btn-s" onclick="generateInvoicePDF()"><i class="fas fa-file-pdf"></i> Télécharger PDF</button>
            </div>
            <div id="inv-preview" style="margin-top:18px"></div>
          </div>
        </div>

        <!-- LISTE DES COURSES À FACTURER -->
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-list"></i> Détail des courses</div>
            <div class="sec-a">
              <span class="bdg bdg-muted" id="fac-ht">HT : 0€</span>
              <span class="bdg bdg-gold" id="fac-ttc">TTC : 0€</span>
              <select class="fsel" id="fac-s" onchange="renderFact()"><option value="">Toutes</option><option value="terminee">Terminée</option><option value="facturee">Facturée</option><option value="payee">Payée</option><option value="noshow">No-show (facturé)</option></select>
            </div>
          </div>
          <div class="tw"><table><thead><tr><th>N° Facture</th><th>Client</th><th>Chauffeur</th><th>Date</th><th>Type</th><th>Trajet</th><th>HT</th><th>TVA 10%</th><th>TTC</th><th>Statut</th><th>Actions</th></tr></thead><tbody id="tb-fac"></tbody></table></div>
        </div>
        <!-- FACTURES REÇUES DES CHAUFFEURS -->
        <div class="sec" style="margin-top:16px">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-file-invoice"></i> Factures reçues des chauffeurs <span class="bdg bdg-gold" id="fc-count" style="margin-left:6px">0</span></div>
          </div>
          <div class="tw"><table><thead><tr><th>Date reçue</th><th>Chauffeur</th><th>Société</th><th>Mois</th><th>Courses</th><th>Total</th><th>N° Facture</th><th>Statut</th></tr></thead><tbody id="tb-fac-ch"></tbody></table></div>
        </div>
      </div>

      <!-- RAPPORTS -->
      <div class="page" id="page-rapports">
        <!-- Filtre de periode : tous les indicateurs de la page s'y conforment -->
        <div class="sec" style="margin-bottom:14px">
          <div style="padding:12px 16px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <span style="font-size:12px;color:var(--muted);font-weight:600">Période :</span>
            <select class="fsel" id="rap-periode" onchange="renderRapports()">
              <option value="mois">Ce mois-ci</option>
              <option value="mois-1">Mois dernier</option>
              <option value="trimestre">3 derniers mois</option>
              <option value="annee">12 derniers mois</option>
              <option value="tout" selected>Tout l'historique</option>
              <option value="perso">Période personnalisée</option>
            </select>
            <input type="date" class="fsel" id="rap-d1" onchange="document.getElementById('rap-periode').value='perso';renderRapports()" style="padding:6px 8px">
            <span style="color:var(--muted);font-size:11px">→</span>
            <input type="date" class="fsel" id="rap-d2" onchange="document.getElementById('rap-periode').value='perso';renderRapports()" style="padding:6px 8px">
            <span class="bdg bdg-muted" id="rap-periode-info">—</span>
            <button class="btn btn-s btn-sm" onclick="exportRapportCSV()" style="margin-left:auto"><i class="fas fa-download"></i> Export CSV</button>
          </div>
        </div>

        <!-- 4 indicateurs principaux : CA, marge, volume, completion -->
        <div class="sg" style="grid-template-columns:repeat(4,1fr)">
          <div class="sc cg"><div class="sc-head"><div class="sc-ico"><i class="fas fa-euro-sign"></i></div></div><div class="sc-val" id="rap-ca">0€</div><div class="sc-lbl">CA TTC encaissé</div><div class="sc-lbl" id="rap-ca-sub" style="opacity:0.7"></div></div>
          <div class="sc cg"><div class="sc-head"><div class="sc-ico"><i class="fas fa-hand-holding-usd"></i></div></div><div class="sc-val" id="rap-marge">0€</div><div class="sc-lbl">Marge brute</div><div class="sc-lbl" id="rap-marge-pct" style="opacity:0.7"></div></div>
          <div class="sc cb"><div class="sc-head"><div class="sc-ico"><i class="fas fa-route"></i></div></div><div class="sc-val" id="rap-tot">0</div><div class="sc-lbl">Courses</div><div class="sc-lbl" id="rap-panier" style="opacity:0.7"></div></div>
          <div class="sc cgr"><div class="sc-head"><div class="sc-ico"><i class="fas fa-check-circle"></i></div></div><div class="sc-val" id="rap-tx">0%</div><div class="sc-lbl">Taux de complétion</div><div class="sc-lbl" id="rap-tx-sub" style="opacity:0.7"></div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="sec"><div class="sec-h"><div class="sec-t"><i class="fas fa-chart-bar"></i> CA par mois</div></div><div style="padding:16px;height:200px"><canvas id="chart-ca"></canvas></div></div>
          <div class="sec"><div class="sec-h"><div class="sec-t"><i class="fas fa-users"></i> Top chauffeurs</div></div><div style="padding:16px" id="rap-ch"></div></div>
        </div>
        <!-- ANALYSE PAR SOCIETE : rentabilite globale et par chauffeur -->
        <div class="sec" style="margin-top:16px">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-sitemap"></i> Analyse par société</div>
            <div class="sec-a">
              <select class="fsel" id="rap-societe" onchange="renderRapports()">
                <option value="">Toutes les sociétés</option>
              </select>
            </div>
          </div>
          <div style="padding:16px">
            <div class="sg" style="grid-template-columns:repeat(5,1fr);margin-bottom:0">
              <div class="sc cg"><div class="sc-head"><div class="sc-ico"><i class="fas fa-euro-sign"></i></div></div><div class="sc-val" id="soc-ca">0€</div><div class="sc-lbl">CA client TTC</div></div>
              <div class="sc cb"><div class="sc-head"><div class="sc-ico"><i class="fas fa-user-tie"></i></div></div><div class="sc-val" id="soc-remu">0€</div><div class="sc-lbl">Reversé aux chauffeurs</div></div>
              <div class="sc cg"><div class="sc-head"><div class="sc-ico"><i class="fas fa-hand-holding-usd"></i></div></div><div class="sc-val" id="soc-marge">0€</div><div class="sc-lbl">Marge société</div><div class="sc-lbl" id="soc-marge-pct" style="opacity:0.7"></div></div>
              <div class="sc cgr"><div class="sc-head"><div class="sc-ico"><i class="fas fa-route"></i></div></div><div class="sc-val" id="soc-transferts">0</div><div class="sc-lbl">Transferts</div></div>
              <div class="sc co"><div class="sc-head"><div class="sc-ico"><i class="fas fa-clock"></i></div></div><div class="sc-val" id="soc-heures">0h</div><div class="sc-lbl">Heures travaillées</div><div class="sc-lbl" id="soc-euro-heure" style="opacity:0.7"></div></div>
            </div>
          </div>
          <div class="tw"><table><thead><tr>
            <th>Chauffeur</th><th>Société</th><th>Transferts</th><th>CA client</th><th>Sa rémunération</th>
            <th>Marge</th><th>Jours</th><th>Heures</th><th>€/heure</th><th>Transf./jour</th><th>Véhicules</th>
          </tr></thead><tbody id="tb-soc-chauffeurs"></tbody></table></div>
          <div style="padding:10px 16px;font-size:11px;color:var(--muted);border-top:1px solid var(--border2)">
            « CA client » = ce que facture MOBILEA · « Sa rémunération » = ce qui revient au chauffeur (prix chauffeur) · Les heures proviennent des pointages.
          </div>
        </div>

        <!-- EVOLUTION MENSUELLE : la tendance, pas seulement l'instantane -->
        <div class="sec" style="margin-top:16px">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-chart-line"></i> Évolution mensuelle (12 derniers mois)</div></div>
          <div class="tw"><table><thead><tr>
            <th>Mois</th><th>Courses</th><th>CA TTC</th><th>Évolution</th><th>Marge</th><th>Panier moyen</th><th>Annulées</th>
          </tr></thead><tbody id="tb-evolution"></tbody></table></div>
        </div>

        <!-- ALERTES : ce qui demande une action immediate -->
        <div class="sec" style="margin-top:16px">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-exclamation-triangle"></i> Points de vigilance</div></div>
          <div style="padding:16px" id="rap-alertes"></div>
        </div>

        <!-- ACTIVITE : quand travaillez-vous reellement -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px">
          <div class="sec">
            <div class="sec-h"><div class="sec-t"><i class="fas fa-clock"></i> Répartition par tranche horaire</div></div>
            <div style="padding:16px" id="rap-heures"></div>
          </div>
          <div class="sec">
            <div class="sec-h"><div class="sec-t"><i class="fas fa-calendar-week"></i> Répartition par jour</div></div>
            <div style="padding:16px" id="rap-jours"></div>
          </div>
        </div>

        <!-- ANALYSE PAR CLIENT : volume, panier moyen, marge, fiabilite -->
        <div class="sec" style="margin-top:16px">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-building"></i> Analyse par client</div></div>
          <div class="tw"><table><thead><tr>
            <th>Client</th><th>Courses</th><th>Honorées</th><th>CA TTC</th><th>Panier moyen</th>
            <th>Marge</th><th>Taux marge</th><th>Annulées</th><th>No-show<br><span style="font-size:9px;font-weight:400;opacity:0.7">(facturés)</span></th><th>Fiabilité</th>
          </tr></thead><tbody id="tb-stats-cli"></tbody></table></div>
        </div>

        <!-- STATS DÉTAILLÉES PAR CHAUFFEUR -->
        <div class="sec" style="margin-top:16px">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-chart-line"></i> Statistiques par chauffeur</div></div>
          <div class="tw"><table><thead><tr>
            <th>Chauffeur</th><th>Courses</th><th>Terminées</th><th>No-show</th><th>Annulées</th><th>Ponctualité</th><th>CA généré</th><th>Marge</th>
          </tr></thead><tbody id="tb-stats-ch"></tbody></table></div>
        </div>

        <!-- À FACTURER / ENCAISSER -->
        <div class="sec" style="margin-top:16px">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-file-invoice-dollar"></i> À facturer / encaisser</div></div>
          <div style="padding:16px" id="rap-afacturer"></div>
          <div style="padding:0 16px 14px;font-size:11px;color:var(--muted)">Courses terminées pas encore passées en « Facturée » ou « Payée » — c'est l'argent qu'il reste à encaisser sur la période.</div>
        </div>

        <!-- CA PAR MODE DE PAIEMENT · VÉHICULE · TOP TRAJETS -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:16px;margin-top:16px">
          <div class="sec"><div class="sec-h"><div class="sec-t"><i class="fas fa-credit-card"></i> CA par mode de paiement</div></div><div style="padding:16px" id="rap-paiement"></div></div>
          <div class="sec"><div class="sec-h"><div class="sec-t"><i class="fas fa-car-side"></i> Répartition par véhicule</div></div><div style="padding:16px" id="rap-veh"></div></div>
          <div class="sec"><div class="sec-h"><div class="sec-t"><i class="fas fa-route"></i> Top trajets</div></div><div style="padding:16px" id="rap-axes"></div></div>
        </div>
      </div>

      <!-- COMPTES DISPATCH -->
      <div class="page" id="page-comptes">
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-users-cog"></i> Comptes Dispatch</div>
            <button class="btn btn-p btn-sm" onclick="openDispatchAccountModal()"><i class="fas fa-plus"></i> Créer un compte</button>
          </div>
          <div class="tw"><table><thead><tr><th>Identifiant</th><th>Nom</th><th>Créé le</th><th>Modifié</th><th>Actions</th></tr></thead><tbody id="tb-comptes"></tbody></table></div>
        </div>
        <div style="margin-top:14px;padding:12px 16px;background:var(--blue-dim);border:1px solid rgba(91,156,246,0.2);border-radius:var(--r-sm);font-size:12px;color:var(--blue)">
          <i class="fas fa-shield-alt"></i> Seul l'admin peut créer des comptes Dispatch. Ils ont accès aux courses et chauffeurs mais pas à la facturation ni aux paramètres.
        </div>
      </div>

      <!-- HISTORIQUE -->
      <div class="page" id="page-historique">
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-history"></i> Journal <span class="bdg bdg-muted" id="log-count" style="margin-left:6px">0</span></div>
            <div class="sec-a" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              <input type="text" id="log-search" placeholder="Rechercher..." oninput="renderHistorique()" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:6px 12px;color:var(--white);font-size:12px;outline:none;width:160px" maxlength="200">
              <input type="date" id="log-date" onchange="renderHistorique()" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:6px 10px;color:var(--white);font-size:12px;outline:none">
              <label style="display:flex;align-items:center;gap:5px;color:var(--muted);font-size:11px;cursor:pointer;white-space:nowrap"><input type="checkbox" id="log-hide-auto" onchange="renderHistorique()" style="cursor:pointer"> Masquer imports auto</label>
              <button class="btn btn-ghost btn-sm" onclick="document.getElementById('log-search').value='';document.getElementById('log-date').value='';renderHistorique()" aria-label="Fermer"><i class="fas fa-times" aria-hidden="true"></i></button>
            </div>
          </div>
          <div style="padding:16px" id="log-wrap"></div>
        </div>
      </div>

      <!-- TRANSFERTS GÉRANTS (réseau — hors CA MOBILEA) -->
      <div class="page" id="page-transfertsgerants">
        <div class="sec">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-user-tie"></i> Transferts gérants (réseau)</div></div>
          <div style="padding:14px 18px;font-size:12px;color:var(--muted2);border-bottom:1px solid var(--border)">
            Transferts proposés par les gérants au réseau MOBILEA. Facturés entre le gérant (donneur d'ordre) et le chauffeur — <b>ils ne comptent pas dans le chiffre d'affaires de MOBILEA</b> et n'apparaissent pas dans le dispatch, le planning ni la facturation.
          </div>
          <div id="tg-list" style="padding:16px"></div>
        </div>
      </div>

      <!-- PARAMETRES -->
      <div class="page" id="page-parametres">
        <div class="sec" style="max-width:600px">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-cog"></i> Paramètres</div></div>
          <div style="padding:20px">
            <div style="background:var(--green-dim);border:1px solid rgba(46,204,138,0.2);border-radius:var(--r-sm);padding:12px;font-size:12px;color:var(--green);margin-bottom:18px">
              <i class="fas fa-check-circle"></i> Firebase connecté — simplycab-58808
            </div>
            <div style="margin-bottom:18px">
              <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:10px">Mot de passe admin</div>
              <div class="fg2">
                <div class="fld"><label>Nouveau mot de passe</label><input type="password" id="new-pass" placeholder="Nouveau mot de passe" maxlength="128"></div>
                <div class="fld"><label>Confirmer</label><input type="password" id="conf-pass" placeholder="Confirmer" maxlength="128"></div>
              </div>
              <button class="btn btn-p btn-sm" onclick="changeAdminPass()"><i class="fas fa-key"></i> Changer</button>
            </div>
            <div style="padding-top:18px;border-top:1px solid var(--border);margin-bottom:18px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700">🔄 Synchronisation LogiPax</div>
                <button class="btn btn-s btn-sm" onclick="relancerSyncLogipax()"><i class="fas fa-sync-alt"></i> Relancer les échecs</button>
              </div>
              <div style="font-size:11px;color:var(--muted2)">Quand LogiPax est en panne (erreur 502, délai dépassé), MOBILEA continue de fonctionner normalement : les courses sont enregistrées et marquées à resynchroniser. Cliquez ici une fois LogiPax revenu en ligne. <span id="lgpx-pending" style="color:var(--gold);font-weight:600"></span></div>
            </div>
            <div style="padding-top:18px;border-top:1px solid var(--border);margin-bottom:18px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700">📍 Zones d'alerte (géofence)</div>
                <button class="btn btn-p btn-sm" onclick="openGeofenceZone('')"><i class="fas fa-plus"></i> Ajouter</button>
              </div>
              <div style="font-size:11px;color:var(--muted2);margin-bottom:10px">Le dispatch est alerté quand un chauffeur entre dans une zone. Définissez la position, le rayon et le délai.</div>
              <div id="gz-list"></div>
            </div>
            <div style="padding-top:18px;border-top:1px solid var(--border);margin-bottom:18px">
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
                <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700">🎟️ Codes promo</div>
                <button class="btn btn-p btn-sm" onclick="openPromoForm()"><i class="fas fa-plus"></i> Ajouter</button>
              </div>
              <div style="font-size:11px;color:var(--muted2);margin-bottom:10px">Créez des codes de réduction (montant en € ou pourcentage). Le client les saisit à la réservation : la remise s'applique automatiquement sur l'estimation.</div>
              <div id="promo-list"></div>
            </div>
            <div style="padding-top:18px;border-top:1px solid var(--border);margin-bottom:18px">
              <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:10px">🔔 Notifications</div>
              <div style="font-size:11px;color:var(--muted2);margin-bottom:10px">Alerte le dispatch quand un chauffeur entre dans une zone. Sur iPhone, l'app doit être ajoutée à l'écran d'accueil et ouverte depuis son icône.</div>
              <div id="notif-etat" style="font-size:12px;font-weight:600;margin-bottom:10px;color:var(--orange)">…</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button id="notif-activer-btn" class="btn btn-p btn-sm" onclick="activerNotifications()" style="display:none"><i class="fas fa-bell"></i> Activer les notifications</button>
                <button class="btn btn-s btn-sm" onclick="testerNotification()"><i class="fas fa-vial"></i> Tester</button>
                <button class="btn btn-s btn-sm" onclick="diagnostiquerPush()"><i class="fas fa-stethoscope"></i> Diagnostic</button>
              </div>
              <div id="notif-diag" style="display:none;margin-top:10px;font-size:11px;color:var(--muted2);background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:8px 10px;line-height:1.6"></div>
            </div>
            <div style="padding-top:18px;border-top:1px solid var(--border);margin-bottom:18px">
              <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:6px">⏰ Rappels avant chaque course</div>
              <div style="font-size:11px;color:var(--muted2);margin-bottom:12px">Choisissez quand une notification de rappel est envoyée avant chaque course — au chauffeur concerné <b>et</b> au dispatch/admin.</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px">
                <label class="rappel-chip"><input type="checkbox" class="rappel-opt" value="15"> 15 min avant</label>
                <label class="rappel-chip"><input type="checkbox" class="rappel-opt" value="30"> 30 min avant</label>
                <label class="rappel-chip"><input type="checkbox" class="rappel-opt" value="60"> 1 h avant</label>
                <label class="rappel-chip"><input type="checkbox" class="rappel-opt" value="120"> 2 h avant</label>
              </div>
              <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:12px">
                <span style="font-size:12px;color:var(--muted)">Ou personnalisé :</span>
                <input id="rappel-custom" type="number" min="1" max="2880" step="1" placeholder="ex. 45" style="width:90px;background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px;color:var(--white);font-size:13px">
                <select id="rappel-custom-unit" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px;color:var(--white);font-size:13px"><option value="1">minutes</option><option value="60">heures</option></select>
                <span style="font-size:12px;color:var(--muted)">avant</span>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
                <button class="btn btn-p btn-sm" onclick="saveRappelConfig()"><i class="fas fa-save"></i> Enregistrer les rappels</button>
                <span id="rappel-etat" style="font-size:12px;color:var(--muted)"></span>
              </div>
            </div>
            <div style="padding-top:18px;border-top:1px solid var(--border);margin-bottom:18px">
              <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:10px">📩 SMS automatiques</div>
              <div id="sms-toggle-wrap" style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px;border-radius:12px;background:rgba(34,197,94,0.12);border:1px solid var(--border)">
                <div>
                  <div id="sms-toggle-label" style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700">🔔 SMS automatiques…</div>
                  <div style="font-size:11px;color:var(--muted);margin-top:2px">Alertes SMS aux chauffeurs. Désactivez en période calme pour économiser.</div>
                </div>
                <label style="position:relative;display:inline-block;width:52px;height:30px;flex-shrink:0;cursor:pointer">
                  <input type="checkbox" id="sms-toggle" onchange="toggleSmsAuto(this)" style="opacity:0;width:0;height:0">
                  <span style="position:absolute;inset:0;background:#22c55e;border-radius:30px;transition:0.3s"></span>
                  <span style="position:absolute;left:3px;top:3px;width:24px;height:24px;background:#fff;border-radius:50%;transition:0.3s;box-shadow:0 2px 4px rgba(0,0,0,0.2)" id="sms-toggle-knob"></span>
                </label>
              </div>
            </div>
            <div style="padding-top:18px;border-top:1px solid var(--border);margin-bottom:18px">
              <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:10px">⚡ Réservations immédiates</div>
              <label style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;background:var(--card2);border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer">
                <div>
                  <div style="font-size:13px;font-weight:700">Autoriser la réservation immédiate</div>
                  <div style="font-size:11px;color:var(--muted2);margin-top:2px">Les clients peuvent commander un transfert avec attribution auto au chauffeur le plus proche</div>
                </div>
                <div style="position:relative;flex-shrink:0">
                  <input type="checkbox" id="set-immediate" onchange="toggleImmediateReservations(this.checked)" style="opacity:0;position:absolute;width:0;height:0">
                  <div id="set-immediate-track" style="width:50px;height:28px;background:#ccc;border-radius:20px;transition:all 0.2s;position:relative">
                    <div id="set-immediate-knob" style="width:22px;height:22px;background:#fff;border-radius:50%;position:absolute;top:3px;left:3px;transition:all 0.2s;box-shadow:0 2px 4px rgba(0,0,0,0.2)"></div>
                  </div>
                </div>
              </label>
            </div>
            <div style="padding-top:18px;border-top:1px solid var(--border);margin-bottom:18px">
              <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:10px">⏱️ Déconnexion chauffeur inactif</div>
              <label style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px;background:var(--card2);border:1px solid var(--border);border-radius:var(--r-sm)">
                <div>
                  <div style="font-size:13px;font-weight:700">Durée avant déconnexion automatique</div>
                  <div style="font-size:11px;color:var(--muted2);margin-top:2px">Si le chauffeur ne touche pas son écran pendant cette durée, il est déconnecté automatiquement</div>
                </div>
                <select id="set-driver-timeout" onchange="saveDriverTimeout(this.value)" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;color:var(--white);font-size:13px;font-weight:700;min-width:100px;cursor:pointer">
                  <option value="1">1 heure</option>
                  <option value="2">2 heures</option>
                  <option value="3">3 heures</option>
                  <option value="4">4 heures</option>
                  <option value="5" selected>5 heures</option>
                  <option value="6">6 heures</option>
                  <option value="8">8 heures</option>
                  <option value="10">10 heures</option>
                  <option value="12">12 heures</option>
                  <option value="24">24 heures</option>
                </select>
              </label>
            </div>
            <div style="padding-top:18px;border-top:1px solid var(--border);margin-bottom:18px">
              <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:6px">🔗 Connexions API partenaires</div>
              <div style="font-size:11px;color:var(--muted2);margin-bottom:12px">Générez une clé pour qu'un partenaire externe envoie automatiquement ses transferts dans MOBILEA.</div>
              <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
                <input type="text" id="api-partner-name" placeholder="Nom du partenaire (ex: Agence Voyage X)" maxlength="80" style="flex:1;min-width:180px;background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;color:var(--white);font-size:13px">
                <button class="btn btn-p btn-sm" onclick="generateApiKey()"><i class="fas fa-plus"></i> Générer une clé</button>
              </div>
              <div id="api-keys-list"></div>
            </div>
            <div style="padding-top:18px;border-top:1px solid var(--border);margin-bottom:18px">
              <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:6px">🎨 Couleurs par client</div>
              <div style="font-size:12px;color:var(--muted);margin-bottom:12px">Choisissez une couleur d'<b>arrivée</b> 🛬 et de <b>départ</b> 🛫 pour chaque client. Laissez vide pour garder la couleur par défaut.</div>
              <div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">
                <input type="text" id="cc-new-name" placeholder="Nom d'un nouveau client…" maxlength="60" style="flex:1;min-width:160px;padding:8px 10px;border-radius:8px;border:1px solid var(--border);background:var(--bg);color:var(--white);font-size:13px">
                <button class="btn btn-p btn-sm" onclick="ccAddClient()"><i class="fas fa-plus"></i> Ajouter</button>
              </div>
              <div id="cc-list"></div>
              <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn btn-p btn-sm" onclick="saveClientColors()"><i class="fas fa-save"></i> Enregistrer les couleurs</button>
                <button class="btn btn-sm" onclick="renderClientColors()" style="background:var(--card);color:var(--muted)"><i class="fas fa-rotate-left"></i> Annuler</button>
              </div>
            </div>
            <div style="padding-top:18px;border-top:1px solid var(--border)">
              <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin-bottom:10px">Données</div>
              <div style="display:flex;gap:8px;flex-wrap:wrap">
                <button class="btn btn-p" onclick="loadDemoData()"><i class="fas fa-magic"></i> Données démo</button>
                <button class="btn btn-d" onclick="if(confirm('Tout supprimer ?'))resetAll()"><i class="fas fa-trash"></i> Réinitialiser</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- MESSAGERIE -->
      <div class="page" id="page-messagerie">
        <div id="msg-wrap" style="display:grid;grid-template-columns:280px 1fr;gap:0;height:calc(100vh - 120px);background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden">
          <!-- Liste conversations -->
          <div class="msg-list-panel" style="border-right:1px solid var(--border);display:flex;flex-direction:column">
            <div style="padding:14px 16px;border-bottom:1px solid var(--border);font-family:'Syne',sans-serif;font-size:14px;font-weight:700;display:flex;align-items:center;justify-content:space-between">
              <span><i class="fas fa-comments" style="color:var(--gold)"></i> Conversations</span>
              <button id="btn-nouvelle-conv" onclick="ouvrirNouvelleConv()" title="Nouvelle conversation" style="width:32px;height:32px;border-radius:50%;background:linear-gradient(135deg,var(--gold),var(--gold2));border:none;color:var(--black);font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center" aria-label="Nouvelle conversation"><i class="fas fa-plus" aria-hidden="true"></i></button>
            </div>
            <div style="padding:10px">
              <div class="sbw"><i class="fas fa-search"></i><input type="text" placeholder="Rechercher..." id="msg-search" oninput="renderConvList()" maxlength="200"></div>
            </div>
            <div id="conv-list" style="flex:1;overflow-y:auto"></div>
          </div>
          <!-- Zone chat -->
          <div class="msg-chat-panel" style="display:flex;flex-direction:column;min-width:0;min-height:0;overflow:hidden">
            <div id="chat-header" style="padding:14px 18px;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;min-height:54px">
              <div style="color:var(--muted);font-size:13px">Sélectionner une conversation</div>
            </div>
            <div id="chat-messages" style="flex:1 1 auto;min-height:0;overflow-y:auto;padding:16px;display:flex;flex-direction:column;gap:10px"></div>
            <div id="chat-input-wrap" style="padding:12px 16px;border-top:1px solid var(--border);display:none;flex:0 0 auto;background:var(--card)">
              <div style="display:flex;gap:8px">
                <input type="text" id="chat-input" placeholder="Écrire un message..." 
                  style="flex:1;background:var(--dark);border:1px solid var(--border2);border-radius:20px;padding:10px 16px;color:var(--white);font-size:13px;outline:none"
                  onkeydown="if(event.key==='Enter')sendMsg()" maxlength="1000">
                <button onclick="sendMsg()" style="background:linear-gradient(135deg,var(--gold),var(--gold2));border:none;border-radius:50%;width:40px;height:40px;cursor:pointer;font-size:16px;color:var(--black)">➤</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- DASHBOARD DIRIGEANT -->
      <div class="page" id="page-dirigeant">
        <div style="margin-bottom:18px">
          <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:4px">Dashboard Dirigeant</div>
          <div style="font-size:12px;color:var(--muted)">Vue globale de l'activité MOBILEA</div>
        </div>
        <!-- KPIs -->
        <div class="sg" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
          <div class="sc cg"><div class="sc-head"><div class="sc-ico"><i class="fas fa-euro-sign"></i></div></div><div class="sc-val" id="dir-ca-total">0€</div><div class="sc-lbl">CA total TTC</div><div class="sc-sub" id="dir-ca-sub"></div></div>
          <div class="sc cgr"><div class="sc-head"><div class="sc-ico"><i class="fas fa-route"></i></div></div><div class="sc-val" id="dir-total">0</div><div class="sc-lbl">Courses totales</div><div class="sc-sub" id="dir-total-sub"></div></div>
          <div class="sc cb"><div class="sc-head"><div class="sc-ico"><i class="fas fa-check-circle"></i></div></div><div class="sc-val" id="dir-tx">0%</div><div class="sc-lbl">Taux complétion</div></div>
          <div class="sc co"><div class="sc-head"><div class="sc-ico"><i class="fas fa-star"></i></div></div><div class="sc-val" id="dir-moy">0€</div><div class="sc-lbl">Panier moyen TTC</div></div>
        </div>
        <!-- Filtres -->
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          <select class="fsel" id="dir-period" onchange="renderDirigeant()">
            <option value="month">Ce mois</option>
            <option value="quarter">Ce trimestre</option>
            <option value="year">Cette année</option>
            <option value="all">Tout</option>
          </select>
          <select class="fsel" id="dir-chauff-filter" onchange="renderDirigeant()">
            <option value="">Tous les chauffeurs</option>
          </select>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <!-- CA par chauffeur -->
          <div class="sec">
            <div class="sec-h"><div class="sec-t"><i class="fas fa-users"></i> CA par chauffeur (TTC)</div></div>
            <div style="padding:16px" id="dir-by-chauff"></div>
          </div>
          <!-- CA par catégorie -->
          <div class="sec">
            <div class="sec-h"><div class="sec-t"><i class="fas fa-tags"></i> CA par catégorie</div></div>
            <div style="padding:16px" id="dir-by-cat"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px">
          <!-- Top clients -->
          <div class="sec">
            <div class="sec-h"><div class="sec-t"><i class="fas fa-building"></i> Top clients (CA)</div></div>
            <div style="padding:16px" id="dir-by-client"></div>
          </div>
          <!-- Top destinations -->
          <div class="sec">
            <div class="sec-h"><div class="sec-t"><i class="fas fa-map-marker-alt"></i> Top destinations</div></div>
            <div style="padding:16px" id="dir-top-dest"></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px">
          <!-- CA par mois -->
          <div class="sec">
            <div class="sec-h"><div class="sec-t"><i class="fas fa-chart-bar"></i> Évolution CA mensuel</div></div>
            <div style="padding:16px;height:220px"><canvas id="chart-dirigeant"></canvas></div>
          </div>
          <!-- Top clients -->
          <div class="sec">
            <div class="sec-h"><div class="sec-t"><i class="fas fa-trophy"></i> Top clients</div></div>
            <div style="padding:16px" id="dir-top-clients"></div>
          </div>
        </div>
      </div>

      <!-- REVENUS CHAUFFEUR (visible chauffeur uniquement) -->
      <div class="page" id="page-revenus">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-bottom:16px">
          <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:700"><i class="fas fa-chart-line" style="color:var(--gold)"></i> Mes revenus</div>
          <div style="display:flex;gap:8px;align-items:center">
            <select id="driver-inv-month" style="background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:8px 12px;color:var(--white);font-size:13px"></select>
            <button class="btn btn-p btn-sm" onclick="generateDriverInvoice()"><i class="fas fa-file-invoice"></i> Générer ma facture</button>
          </div>
        </div>
        <div class="sg" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px">
          <div class="sc cg"><div class="sc-val" id="rev-week">0€</div><div class="sc-lbl">Cette semaine</div></div>
          <div class="sc cgr"><div class="sc-val" id="rev-month">0€</div><div class="sc-lbl">Ce mois</div></div>
          <div class="sc cb"><div class="sc-val" id="rev-total">0€</div><div class="sc-lbl">Total cumulé</div></div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div class="sec"><div class="sec-h"><div class="sec-t"><i class="fas fa-chart-bar"></i> CA par semaine</div></div><div style="padding:16px;height:200px"><canvas id="chart-rev-week"></canvas></div></div>
          <div class="sec"><div class="sec-h"><div class="sec-t"><i class="fas fa-chart-line"></i> CA par mois</div></div><div style="padding:16px;height:200px"><canvas id="chart-rev-month"></canvas></div></div>
        </div>
        <div class="sec" style="margin-top:16px">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-list"></i> Détail par course</div></div>
          <div class="tw"><table><thead><tr><th>Date</th><th>Client</th><th>Type</th><th>Trajet</th><th>Mon prix</th><th>Paiement</th><th>À reverser</th><th>Statut</th></tr></thead><tbody id="tb-rev-detail"></tbody></table></div>
        </div>
        <!-- TOTAL À REVERSER -->
        <div id="reverser-wrap" style="margin-top:14px;padding:14px 18px;background:var(--orange-dim);border:1px solid rgba(240,147,74,0.3);border-radius:var(--r-sm)">
          <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--orange);margin-bottom:6px"><i class="fas fa-hand-holding-usd"></i> Total à reverser à MOBILEA</div>
          <div style="font-size:24px;font-weight:800;color:var(--orange);font-family:'Syne',sans-serif" id="rev-reverser">0€</div>
          <div style="font-size:11px;color:var(--muted);margin-top:4px">Courses payées directement par les clients</div>
        </div>
      </div>

      <!-- APP CLIENTE RÉSERVATION -->
      <div class="page" id="page-reservation">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
          <!-- Aperçu formulaire -->
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;margin-bottom:4px"><i class="fas fa-globe" style="color:var(--gold)"></i> Page de réservation client</div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:16px">Formulaire que vos clients utilisent pour réserver</div>
            <div style="background:var(--card);border:1px solid var(--border);border-radius:var(--r);overflow:hidden">
              <div style="padding:16px;background:linear-gradient(135deg,#0d0f12,#141618);border-bottom:1px solid var(--border);text-align:center">
                <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:800;color:var(--gold);letter-spacing:2px">MOBILEA</div>
                <div style="font-size:11px;color:var(--muted);margin-top:3px">by MOBILEA — Réservation en ligne</div>
              </div>
              <div style="padding:20px">
                <div class="fld"><label>Votre nom complet *</label><input type="text" placeholder="Jean Dupont" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:11px;color:var(--white);font-size:13px;outline:none" maxlength="200"></div>
                <div class="fld"><label>Téléphone *</label><input type="tel" placeholder="+33 6 00 00 00 00" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:11px;color:var(--white);font-size:13px;outline:none" maxlength="20"></div>
                <div class="fld"><label>Email</label><input type="email" placeholder="email@exemple.com" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:11px;color:var(--white);font-size:13px;outline:none" maxlength="100"></div>
                <div class="fg2">
                  <div class="fld"><label>Date & Heure *</label><input type="datetime-local" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:11px;color:var(--white);font-size:13px;outline:none"></div>
                  <div class="fld"><label>Véhicule</label><select style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:11px;color:var(--white);font-size:13px;outline:none"><option>🚗 Berline</option><option>🚐 Van</option><option>🚌 Sprinter</option></select></div>
                </div>
                <div class="fld"><label>Départ *</label><input type="text" placeholder="Adresse de départ" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:11px;color:var(--white);font-size:13px;outline:none" maxlength="200"></div>
                <div class="fld"><label>Arrivée *</label><input type="text" placeholder="Adresse d'arrivée" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:11px;color:var(--white);font-size:13px;outline:none" maxlength="200"></div>
                <div class="fld"><label>N° de vol (si aéroport)</label><input type="text" placeholder="AF1234" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:11px;color:var(--white);font-size:13px;outline:none" maxlength="200"></div>
                <div class="fld"><label>Passagers & Notes</label><textarea rows="2" placeholder="2 personnes, 3 bagages..." style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:11px;color:var(--white);font-size:13px;outline:none;resize:none" maxlength="2000"></textarea></div>
                <button style="width:100%;background:linear-gradient(135deg,var(--gold),var(--gold2));color:var(--black);border:none;border-radius:var(--r-sm);padding:13px;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;cursor:pointer">Envoyer ma demande →</button>
              </div>
            </div>
          </div>
          <!-- Demandes reçues -->
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:18px;font-weight:700;margin-bottom:4px"><i class="fas fa-inbox" style="color:var(--blue)"></i> Demandes reçues</div>
            <div style="font-size:12px;color:var(--muted);margin-bottom:16px">Nouvelles réservations à confirmer</div>
            <div class="sec">
              <div class="sec-h">
                <div class="sec-t"><span class="nb" id="res-count">0</span> demande(s)</div>
                <button class="btn btn-ghost btn-sm" onclick="loadAll()" aria-label="Rafraîchir"><i class="fas fa-sync-alt" aria-hidden="true"></i></button>
              </div>
              <div id="res-list" style="padding:16px"></div>
            </div>
            <div style="margin-top:14px;padding:12px 16px;background:var(--blue-dim);border:1px solid rgba(91,156,246,0.2);border-radius:var(--r-sm);font-size:12px;color:var(--blue)">
              
            </div>
          </div>
        </div>
      </div>

      <!-- ESPACE CLIENT -->
      <div class="page" id="page-clientportal">
        <!-- Header client -->
        <div style="background:linear-gradient(135deg,var(--card),var(--card2));border:1px solid var(--border);border-radius:var(--r);padding:20px;margin-bottom:18px;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800;color:var(--gold)" id="cp-company-name">—</div>
            <div style="font-size:12px;color:var(--muted2);margin-top:3px"><span data-t="welcome">Bienvenue</span>, <span id="cp-user-name" style="color:var(--white);font-weight:600"></span></div>
          </div>
          <div style="display:flex;align-items:center;gap:10px">
            <select id="cp-lang-select" onchange="setClientLang(this.value)" style="background:var(--card2);border:1px solid var(--border2);border-radius:8px;padding:6px 10px;color:var(--white);font-size:13px;outline:none;cursor:pointer">
              <option value="fr">🇫🇷 FR</option>
              <option value="en">🇬🇧 EN</option>
              <option value="ar">🇸🇦 AR</option>
              <option value="es">🇪🇸 ES</option>
              <option value="de">🇩🇪 DE</option>
              <option value="it">🇮🇹 IT</option>
              <option value="zh">🇨🇳 ZH</option>
              <option value="pt">🇵🇹 PT</option>
              <option value="ru">🇷🇺 RU</option>
              <option value="ja">🇯🇵 JA</option>
            </select>
  <div style="display:flex;gap:8px">
            <button class="btn btn-ghost btn-sm" onclick="gp('messagerie',null)" style="font-size:12px"><i class="fas fa-comments"></i> <span id="cp-msg-badge" style="display:none;background:var(--red);color:#fff;font-size:9px;padding:1px 5px;border-radius:8px;margin-left:3px">0</span></button>
            <button class="btn btn-p" id="cp-new-booking-btn" onclick="openClientBooking()"><i class="fas fa-plus"></i> <span data-t="new_booking">Nouvelle réservation</span></button>
          </div>
          </div>
        </div>

        <!-- Assistance 24/24 -->
        <a href="tel:0033164395554" style="display:flex;align-items:center;gap:12px;background:linear-gradient(135deg,#16a34a,#22c55e);border-radius:14px;padding:13px 16px;margin-bottom:16px;text-decoration:none;box-shadow:0 4px 12px rgba(22,163,74,0.25)">
          <div style="width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0">📞</div>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:800;color:#fff;font-family:'Syne',sans-serif">Assistance 24h/24 · 7j/7</div>
            <div style="font-size:12px;color:rgba(255,255,255,0.9);margin-top:1px">En cas de souci, appelez-nous : 01 64 39 55 54</div>
          </div>
          <div style="font-size:11px;color:#fff;font-weight:700;background:rgba(255,255,255,0.2);padding:6px 12px;border-radius:8px;flex-shrink:0">Appeler</div>
        </a>

        <!-- Stats rapides -->
        <div class="sg" style="grid-template-columns:repeat(3,1fr);margin-bottom:18px">
          <div class="sc cg"><div class="sc-val" id="cp-total">0</div><div class="sc-lbl" data-t="my_transfers">Mes transferts</div></div>
          <div class="sc cb"><div class="sc-val" id="cp-active">0</div><div class="sc-lbl" data-t="in_progress">En cours</div></div>
          <div class="sc cgr"><div class="sc-val" id="cp-done">0</div><div class="sc-lbl" data-t="done">Terminés</div></div>
        </div>

        <!-- Carte suivi chauffeur (visible si course en cours avec GPS) -->
        <div class="sec" id="cp-map-section" style="margin-bottom:16px;display:none">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-map-marked-alt" style="color:#00b4ff"></i> <span data-t="driver_tracking">Suivi de votre chauffeur</span></div>
            <button class="btn btn-ghost btn-sm" onclick="refreshClientMap()" aria-label="Rafraîchir"><i class="fas fa-sync-alt" aria-hidden="true"></i></button>
          </div>
          <div id="cp-map-container" style="height:380px;border-radius:0 0 var(--r) var(--r);overflow:hidden;position:relative">
            <div id="cp-map" style="width:100%;height:100%"></div>
          </div>
        </div>

        <!-- Transferts en cours -->
        <div class="sec" style="margin-bottom:16px">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-route" style="color:var(--gold)"></i> <span data-t="active_transfers">Transferts en cours</span></div>
            <button class="btn btn-ghost btn-sm" onclick="loadAll()"><i class="fas fa-sync-alt"></i> Actualiser</button>
          </div>
          <div style="padding:10px 16px 0;display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <div class="sbw" style="flex:1;min-width:200px"><i class="fas fa-search"></i><input type="text" placeholder="Rechercher un passager (nom, prénom)..." id="cp-search" oninput="renderClientPortal()" maxlength="100"></div>
            <button class="btn btn-ghost btn-sm" onclick="window._cpDay=new Date().toISOString().slice(0,10);document.getElementById('cp-search').value='';renderClientPortal()"><i class="fas fa-calendar-day"></i> Aujourd'hui</button>
            <input type="date" id="cp-date-picker" onchange="if(this.value){window._cpDay=this.value;document.getElementById('cp-search').value='';renderClientPortal();}" style="padding:8px 10px;border-radius:10px;border:1px solid var(--border2);background:var(--dark);color:var(--white);font-size:12px">
          </div>
          <div id="cp-day-strip" style="display:flex;gap:6px;overflow-x:auto;padding:10px 16px 4px"></div>
          <div id="cp-active-list" style="padding:16px"></div>
        </div>

      </div>

      <!-- HISTORIQUE CLIENT (page dédiée, accessible via le menu) -->
      <div class="page" id="page-clienthistorique">
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-history"></i> Historique des transferts</div>
            <div class="sec-a">
              <select class="fsel" id="cp-filter" onchange="renderClientPortal()">
                <option value="">Tous</option>
                <option value="terminee" data-t="done">Terminés</option>
                <option value="annulee" data-t="cancelled">Annulés</option>
              </select>
            </div>
          </div>
          <div class="tw"><table><thead><tr><th data-t="date">Date</th><th data-t="route">Trajet</th><th data-t="passengers">Passagers</th><th data-t="vehicle">Véhicule</th><th data-t="driver">Chauffeur</th><th data-t="status">Statut</th><th data-t="created_by">Créé par</th></tr></thead><tbody id="cp-hist-list"></tbody></table></div>
        </div>
      </div>

      <!-- COMPTES CLIENTS (admin) -->
      <div class="page" id="page-comptes-clients">
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-building" style="color:var(--gold)"></i> Comptes Clients</div>
            <button class="btn btn-p btn-sm" onclick="openClientAccountModal()"><i class="fas fa-plus"></i> Créer un compte</button>
          </div>
          <div class="tw"><table><thead><tr><th>Identifiant</th><th>Nom</th><th>Société (client)</th><th>Créé le</th><th>Actions</th></tr></thead><tbody id="tb-comptes-clients"></tbody></table></div>
        </div>
        <div style="margin-top:14px;padding:12px 16px;background:var(--blue-dim);border:1px solid rgba(91,156,246,0.2);border-radius:var(--r-sm);font-size:12px;color:var(--blue)">
          <i class="fas fa-info-circle"></i> Chaque société peut avoir plusieurs utilisateurs. Ils voient uniquement les courses associées à leur société.
        </div>
      </div>

      <!-- MES COURSES (chauffeur) -->
      <div class="page" id="page-mescourses">

        <!-- BANDEAU DE SYNCHRONISATION : visible uniquement quand des actions
             sont en attente d'envoi (reseau instable). Sans lui, le chauffeur
             croyait que son action n'avait pas ete prise en compte et tapait
             plusieurs fois. -->
        <div id="mc-sync-banner" style="display:none;margin-bottom:12px;background:#fff8ed;border:1px solid #f0c674;border-radius:12px;padding:12px 14px">
          <div style="display:flex;align-items:center;gap:10px">
            <span style="font-size:18px">⏳</span>
            <div style="flex:1">
              <div style="font-size:13px;font-weight:700;color:#b45309" id="mc-sync-txt">Envoi en cours…</div>
              <div style="font-size:11px;color:#92700a">Vos actions sont enregistrées et seront envoyées dès le retour du réseau.</div>
            </div>
            <button onclick="flushSyncQueue();majBandeauSync()" style="background:#b8860b;border:none;border-radius:10px;padding:8px 14px;color:#fff;font-size:12px;font-weight:700;cursor:pointer">Réessayer</button>
          </div>
        </div>

        <!-- BOUTON EN SERVICE / HORS SERVICE (style Uber) -->
        <div id="driver-service-toggle" style="margin-bottom:16px">
          <button id="service-btn" onclick="toggleDriverService()" style="width:100%;padding:16px 20px;border-radius:16px;border:none;font-size:16px;font-weight:800;font-family:'Syne',sans-serif;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:12px;transition:all 0.3s;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff;box-shadow:0 4px 16px rgba(34,197,94,0.4)">
            <i class="fas fa-power-off" style="font-size:20px"></i>
            <span id="service-btn-text">EN SERVICE</span>
          </button>
          <div id="service-status" style="text-align:center;font-size:11px;color:var(--green);margin-top:6px;font-weight:600">● Connecté — GPS actif — En attente de courses</div>
        </div>

        <!-- MA JOURNEE : le chauffeur declare lui-meme ses heures.
             Affichée UNIQUEMENT aux chauffeurs à qui l'admin a accordé la
             pointeuse (permission `pointeuse`). Masquée par défaut. -->
        <div class="sec" id="mj-bloc" style="margin-bottom:16px;display:none">
          <div style="padding:14px 16px">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
              <div style="font-family:'Syne',sans-serif;font-size:15px;font-weight:800">⏱️ Ma journée</div>
              <span class="bdg bdg-muted" id="mj-total">—</span>
            </div>
            <div id="mj-date-label" style="font-size:11px;color:var(--muted);margin-bottom:10px"></div>
            <!-- Un pointage ne se saisit QU'UNE FOIS. Une fois l'heure
                 enregistree, le bouton est verrouille : le chauffeur ne peut
                 plus la modifier lui-meme. Cela evite les corrections a
                 posteriori qui fausseraient la paie. -->
            <div style="display:flex;gap:8px;flex-wrap:wrap">
              <button id="mj-btn-debut" onclick="pointerDebut()" style="flex:1;min-width:130px;padding:14px;border-radius:12px;border:none;font-size:14px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#22c55e,#16a34a);color:#fff">
                ▶️ Je commence
              </button>
              <button id="mj-btn-fin" onclick="pointerFin()" style="flex:1;min-width:130px;padding:14px;border-radius:12px;border:none;font-size:14px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff">
                ⏹️ Je termine
              </button>
            </div>
            <button id="mj-btn-pause" onclick="pointerPause()" style="width:100%;margin-top:8px;padding:13px;border-radius:12px;border:none;font-size:14px;font-weight:800;cursor:pointer;background:linear-gradient(135deg,#f59e0b,#d97706);color:#fff">
              ☕ Je prends ma pause
            </button>
            <div id="mj-verrou" style="display:none;margin-top:10px;background:#fff8ed;border:1px solid #f0c674;border-radius:10px;padding:10px 12px">
              <div style="font-size:12px;font-weight:700;color:#b45309">🔒 Horaires enregistrés</div>
              <div style="font-size:11px;color:#92700a;margin-top:3px">En cas d'erreur, contactez votre dispatch ou votre gérant pour les corriger.</div>
            </div>
            <!-- Le choix du vehicule a ete RETIRE : c'est le gerant (ou un
                 dispatch autorise) qui attribue les vehicules, depuis sa page
                 "Mes chauffeurs". Le chauffeur ne fait que pointer ses heures. -->
          </div>
        </div>

        <!-- HEADER CHAUFFEUR -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:16px;flex-wrap:wrap;gap:10px">
          <div>
            <div style="font-family:'Syne',sans-serif;font-size:20px;font-weight:800" id="mc-greeting">Bonjour 👋</div>
            <div style="font-size:12px;color:var(--muted)" id="mc-date-now"></div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <div id="gps-status" style="font-size:11px;color:var(--muted)"></div>
          </div>
        </div>

        <!-- STATS RAPIDES -->
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:12px">
          <div style="background:#fff;border:1px solid #e0e3e8;border-radius:12px;padding:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
            <div style="font-size:22px;font-weight:800;font-family:'Syne',sans-serif;color:#111" id="mc-today">0</div>
            <div style="font-size:11px;color:#777;margin-top:2px">Aujourd'hui</div>
          </div>
          <div style="background:#fff;border:1px solid #e0e3e8;border-radius:12px;padding:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
            <div style="font-size:22px;font-weight:800;font-family:'Syne',sans-serif;color:#111" id="mc-month">0</div>
            <div style="font-size:11px;color:#777;margin-top:2px">Ce mois</div>
          </div>
          <div id="mc-ca-card" style="background:#fff;border:1px solid #e0e3e8;border-radius:12px;padding:14px;text-align:center;box-shadow:0 2px 8px rgba(0,0,0,0.06)">
            <div style="font-size:22px;font-weight:800;font-family:'Syne',sans-serif;color:var(--gold)" id="mc-ca">0€</div>
            <div style="font-size:11px;color:#777;margin-top:2px">Revenus mois</div>
          </div>
        </div>
        <button id="mc-earnings-btn" onclick="openDriverEarnings()" style="width:100%;background:linear-gradient(135deg,#b8860b,#d4a933);border:none;border-radius:12px;padding:13px;color:#fff;font-family:'Syne',sans-serif;font-size:14px;font-weight:800;cursor:pointer;margin-bottom:20px;box-shadow:0 4px 12px rgba(184,134,11,0.3)">💰 Voir mes gains en détail</button>

        <!-- TABS -->
        <div style="display:flex;gap:8px;margin-bottom:16px">
          <button id="mc-tab-active" onclick="mcTab('active')" style="flex:1;padding:10px;border:2px solid var(--gold);background:var(--gold);border-radius:10px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;color:#fff;position:relative">🚗 En cours <span id="mc-active-badge" style="display:none;position:absolute;top:-8px;right:-6px;background:#ef4444;color:#fff;border-radius:12px;min-width:20px;height:20px;font-size:11px;line-height:20px;padding:0 5px;box-shadow:0 2px 6px rgba(0,0,0,0.3)">0</span></button>
          <button id="mc-tab-history" onclick="mcTab('history')" style="flex:1;padding:10px;border:2px solid #e0e3e8;background:#fff;border-radius:10px;font-family:'Syne',sans-serif;font-size:13px;font-weight:700;cursor:pointer;color:#777">📋 Historique</button>
        </div>

        <!-- COURSES EN COURS -->
        <div id="mc-pane-active">
          <div id="mc-cards-list"></div>
        </div>

        <!-- HISTORIQUE -->
        <div id="mc-pane-history" style="display:none">
          <div style="background:#fff;border:1px solid #e0e3e8;border-radius:12px;overflow:hidden">
            <div style="padding:12px 16px;border-bottom:1px solid #f0f2f5;display:flex;gap:8px;flex-wrap:wrap">
              <div class="sbw" style="flex:1"><i class="fas fa-search"></i><input type="text" placeholder="Rechercher..." id="mc-hist-q" oninput="renderHistMC()" maxlength="200"></div>
              <select class="fsel" id="mc-hist-s" onchange="renderHistMC()">
                <option value="">Tous statuts</option>
                <option value="terminee">✔ Terminée</option>
                <option value="noshow">👻 No-show</option>
                <option value="annulee">✗ Annulée</option>
              </select>
              <select class="fsel" id="mc-hist-m" onchange="renderHistMC()"><option value="">Tous les mois</option></select>
            </div>
            <div class="tw"><table><thead><tr><th>Date/H</th><th>Client</th><th>Départ</th><th>Arrivée</th><th>Statut</th></tr></thead><tbody id="tb-mc-hist"></tbody></table></div>
          </div>
        </div>
      </div>

      <!-- GÉRANT : Mes chauffeurs -->
      <!-- GÉRANT : Mes transferts -->
      <div class="page" id="page-gerant-transferts">
        <div class="sec" style="max-width:660px;margin:0 auto">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-list-ul" style="color:#f59e0b"></i> Mes transferts <span id="gt-count" class="bdg bdg-gold" style="margin-left:6px">0</span></div>
            <div class="sec-a"><button class="btn btn-s btn-sm" onclick="renderGerantTransferts()"><i class="fas fa-sync"></i> Actualiser</button></div>
          </div>
          <div style="padding:12px 16px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--border2)">Suivez les transferts que vous avez créés : attribués à vos chauffeurs ou proposés au réseau. Vous pouvez annuler ceux qui ne sont pas encore pris.</div>
          <div id="gt-list" style="padding:14px"></div>
        </div>
      </div>

      <!-- GÉRANT : Mon tableau de bord -->
      <div class="page" id="page-gerant-dashboard">
        <div style="margin-bottom:18px">
          <div style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;margin-bottom:4px">Mon tableau de bord</div>
          <div style="font-size:12px;color:var(--muted)" id="gd-soc">Activité de ma société</div>
        </div>
        <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap">
          <select class="fsel" id="gd-period" onchange="renderGerantDashboard()">
            <option value="month">Ce mois</option>
            <option value="all">Tout</option>
          </select>
        </div>
        <div class="sg" style="grid-template-columns:repeat(4,1fr);margin-bottom:18px">
          <div class="sc cg"><div class="sc-head"><div class="sc-ico"><i class="fas fa-euro-sign"></i></div></div><div class="sc-val" id="gd-ca-client">0€</div><div class="sc-lbl">CA client (TTC)</div></div>
          <div class="sc cgr"><div class="sc-head"><div class="sc-ico"><i class="fas fa-hand-holding-usd"></i></div></div><div class="sc-val" id="gd-marge">0€</div><div class="sc-lbl">Marge</div></div>
          <div class="sc cb"><div class="sc-head"><div class="sc-ico"><i class="fas fa-route"></i></div></div><div class="sc-val" id="gd-courses">0</div><div class="sc-lbl">Courses terminées</div></div>
          <div class="sc co"><div class="sc-head"><div class="sc-ico"><i class="fas fa-users"></i></div></div><div class="sc-val" id="gd-nbch">0</div><div class="sc-lbl">Chauffeurs</div></div>
        </div>
        <div class="sec">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-users"></i> Production par chauffeur</div></div>
          <div style="padding:16px" id="gd-by-chauff"></div>
        </div>
      </div>

      <!-- GÉRANT : Nouveau transfert -->
      <div class="page" id="page-gerant-nouveau">
        <div class="sec" style="max-width:660px;margin:0 auto">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-plus-circle" style="color:#16a34a"></i> Nouveau transfert</div></div>
          <div style="padding:16px">
            <div style="font-size:12px;color:var(--muted);margin-bottom:16px;line-height:1.5">Créez un transfert : attribuez-le à un de vos chauffeurs, ou proposez-le à tous les chauffeurs disponibles du réseau MOBILEA — le premier qui accepte réalise le transfert.</div>
            <div class="fld"><label>Client</label><input id="gn-client" type="text" placeholder="Nom du client" maxlength="120"></div>
            <div class="fg2" style="margin-bottom:14px">
              <div class="fld"><label>Date &amp; heure</label><input id="gn-dt" type="datetime-local"></div>
              <div class="fld"><label>Véhicule</label><select id="gn-veh"><option value="berline">🚗 Berline</option><option value="van">🚐 Van</option><option value="sprinter">🚌 Sprinter</option><option value="bus">🚍 Bus</option><option value="pmr">♿ Van PMR</option><option value="limousine">🥂 Limousine</option></select></div>
            </div>
            <div class="fld"><label>Départ</label><input id="gn-dep" type="text" placeholder="Adresse de prise en charge" maxlength="200"></div>
            <div class="fld"><label>Arrivée</label><input id="gn-arr" type="text" placeholder="Adresse de destination" maxlength="200"></div>
            <div class="fg2" style="margin-bottom:14px">
              <div class="fld"><label>Passagers</label><input id="gn-pax" type="number" min="1" value="1"></div>
              <div class="fld"><label>Bagages</label><input id="gn-bags" type="number" min="0" value="0"></div>
            </div>
            <div class="fg2" style="margin-bottom:6px">
              <div class="fld"><label>Prix client (€)</label><input id="gn-prix" type="number" min="0" step="0.01" placeholder="0" oninput="gerantMajMarge()"></div>
              <div class="fld"><label>Prix chauffeur (€)</label><input id="gn-prix-ch" type="number" min="0" step="0.01" placeholder="0" oninput="gerantMajMarge()"></div>
            </div>
            <div id="gn-marge" style="font-size:12px;color:var(--gold);font-weight:600;margin-bottom:14px">Marge : — €</div>
            <div class="fld"><label>Paiement</label><select id="gn-paiement"><option value="compte">🧾 En compte (facturé — rien à encaisser)</option><option value="bord">💵 À bord (le chauffeur encaisse le client)</option></select></div>
            <div class="fld"><label>Notes</label><textarea id="gn-notes" rows="2" placeholder="Infos (vol, étage, digicode…)" maxlength="500"></textarea></div>
            <div style="border-top:1px solid var(--border2);margin:8px 0 14px;padding-top:14px">
              <div style="font-family:'Syne',sans-serif;font-size:14px;font-weight:700;color:var(--white);margin-bottom:12px">Que faire de ce transfert ?</div>
              <div style="background:var(--card);border:1px solid var(--border2);border-radius:12px;padding:14px;margin-bottom:12px">
                <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:8px">👤 Attribuer à un de mes chauffeurs</div>
                <div class="fld" style="margin-bottom:10px"><select id="gn-mon-ch"><option value="">— Choisir un de mes chauffeurs —</option></select></div>
                <button class="btn" style="width:100%;background:#16a34a;border:none;color:#fff;font-weight:700;padding:13px" onclick="gerantCreerTransfert('mon_chauffeur')"><i class="fas fa-user-check"></i> Attribuer à ce chauffeur</button>
              </div>
              <div style="background:var(--card);border:1px solid var(--border2);border-radius:12px;padding:14px">
                <div style="font-size:13px;font-weight:700;color:var(--white);margin-bottom:4px">🙋 Proposer à tout le réseau MOBILEA</div>
                <div style="font-size:11px;color:var(--muted);margin-bottom:10px">Envoyé à tous les chauffeurs disponibles — le premier qui accepte réalise le transfert.</div>
                <button class="btn" style="width:100%;background:#f59e0b;border:none;color:#fff;font-weight:700;padding:13px" onclick="gerantCreerTransfert('reseau')"><i class="fas fa-bullhorn"></i> Proposer à tout le réseau</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="page" id="page-gerant-chauffeurs">
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-users" style="color:#2563eb"></i> Mes chauffeurs <span id="gc-count" class="bdg bdg-blue" style="margin-left:6px">0</span></div>
          </div>
          <div id="gc-list" style="padding:12px"></div>
        </div>
      </div>

      <!-- GÉRANT : Mes véhicules -->
      <div class="page" id="page-gerant-vehicules">
        <div class="sec">
          <div class="sec-h">
            <div class="sec-t"><i class="fas fa-car" style="color:#2563eb"></i> Mes véhicules <span id="gv-count" class="bdg bdg-blue" style="margin-left:6px">0</span></div>
          </div>
          <div style="padding:12px 16px;font-size:12px;color:var(--muted);border-bottom:1px solid var(--border2)">Véhicules de votre société. Pour en ajouter, contactez MOBILEA.</div>
          <div id="gv-list" style="padding:12px"></div>
        </div>
      </div>

    </div>
  </main>
</div>

<!-- MODALS -->
<!-- COURSE -->
<div class="mo" id="mo-course">
  <div class="mo-box" style="width:720px;max-width:98vw">
    <div class="mo-h">
      <div class="mo-t"><i class="fas fa-route" style="color:var(--gold)"></i> Nouvelle course</div>
      <div style="display:flex;align-items:center;gap:8px">
        <div style="position:relative">
          <button class="btn btn-s btn-sm" onclick="toggleClientSearch()" id="btn-client-search"><i class="fas fa-user-circle"></i> Choisir un client</button>
          <div id="client-search-drop" style="display:none;position:absolute;top:36px;right:0;width:300px;background:var(--card);border:1px solid var(--border2);border-radius:var(--r-sm);box-shadow:var(--shadow);z-index:500;overflow:hidden">
            <div style="padding:10px 12px;border-bottom:1px solid var(--border)">
              <div style="position:relative">
                <i class="fas fa-search" style="position:absolute;left:9px;top:50%;transform:translateY(-50%);color:var(--muted);font-size:11px"></i>
                <input type="text" id="client-search-input" placeholder="Rechercher un client..." autocomplete="off"
                  style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-xs);padding:8px 10px 8px 28px;color:var(--white);font-size:12px;outline:none"
                  oninput="searchClientDrop(this.value)" maxlength="200">
              </div>
            </div>
            <div id="client-search-results" style="max-height:220px;overflow-y:auto"></div>
          </div>
        </div>
        <div class="mo-x" onclick="closeMo('course')"><i class="fas fa-times"></i></div>
      </div>
    </div>
    <div class="mo-b">

      <!-- DATE & HEURE (en premier) -->
      <div class="fld"><label>Date & Heure *</label><input type="datetime-local" id="fc-dt"></div>

      <!-- TYPE (sans icônes) -->
      <div class="fld">
        <label>Type de course</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div id="t-transfert" onclick="selType('transfert')" style="padding:13px;background:var(--blue-dim);border:2px solid var(--blue);border-radius:var(--r-sm);cursor:pointer;text-align:center">
            <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--blue)">Transfert</div>
          </div>
          <div id="t-mad" onclick="selType('mad')" style="padding:13px;background:var(--card2);border:2px solid var(--border);border-radius:var(--r-sm);cursor:pointer;text-align:center">
            <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--muted2)">Mise à disposition</div>
          </div>
        </div>
        <input type="hidden" id="fc-type" value="transfert">
      </div>

      <!-- RÉSERVATION IMMÉDIATE -->
      <div class="fld" style="display:flex;align-items:center;gap:8px;background:rgba(200,169,110,0.08);border:1px solid rgba(200,169,110,0.3);border-radius:var(--r-xs);padding:10px 12px">
        <input type="checkbox" id="fc-immediate" style="width:16px;height:16px;flex-shrink:0">
        <label for="fc-immediate" style="margin:0;font-size:12px;cursor:pointer">🚀 Réservation immédiate — si aucun chauffeur n'est choisi ci-dessous, attribuer automatiquement au chauffeur disponible le plus proche</label>
      </div>

      <div id="f-transfert">
        <!-- DÉPART + ARRIVÉE -->
        <div class="fg2">
          <div class="fld"><label>Départ *</label><input type="text" id="fc-dep" placeholder="Ex: 15 rue de Rivoli, Paris" onkeydown="this.dataset.autoClient=''" oninput="detectCategorie();autoFillPrix();genRef()" maxlength="200"><div id="fc-dep-adresses" style="display:none;margin-top:8px"></div></div>
          <div class="fld"><label>Arrivée *</label><input type="text" id="fc-arr" placeholder="Ex: CDG Terminal 2E, Roissy" oninput="detectCategorie();autoFillPrix();genRef()" maxlength="200"></div>
        </div>

        <!-- VÉHICULE + CHAUFFEUR (côte à côte, juste après l'arrivée) -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="fld"><label>Véhicule</label>
            <select id="fc-veh" onchange="genRef();updatePaxMax();autoFillPrix()">
              <option value="berline">🚗 Berline (3 pax)</option>
              <option value="van">🚐 Van (8 pax)</option>
              <option value="sprinter">🚌 Sprinter (19 pax)</option>
              <option value="bus">🚍 Bus (35 pax)</option>
              <option value="pmr">♿ Van PMR (4 pax)</option>
              <option value="limousine">🥂 Limousine (8 pax)</option>
              <option value="classes">🖤 Classe S (3 pax)</option>
            </select>
          </div>
          <div class="fld"><label>Chauffeur</label>
            <div class="drv-wrap">
              <input type="text" id="fc-ch-input" class="drv-input" placeholder="Rechercher un chauffeur..." autocomplete="off" oninput="filterDrv('fc-ch',this.value)" onfocus="openDrv('fc-ch')" onblur="setTimeout(()=>closeDrv('fc-ch'),200)" maxlength="200" onchange="genRef()">
              <input type="hidden" id="fc-ch" value="">
              <div class="drv-drop" id="drv-drop-fc-ch"></div>
            </div>
          </div>
        </div>

        <!-- SENS -->
        <div class="fld">
          <label>Sens (pour la référence)</label>
          <div style="display:flex;gap:8px">
            <button type="button" id="fc-sens-arr" onclick="setSens('arrivee')" style="flex:1;padding:10px;border-radius:10px;border:2px solid var(--gold);background:var(--gold);color:#000;font-weight:700;cursor:pointer;font-size:13px">🛬 Arrivée</button>
            <button type="button" id="fc-sens-dep" onclick="setSens('depart')" style="flex:1;padding:10px;border-radius:10px;border:2px solid var(--border);background:var(--card2);color:var(--white);font-weight:700;cursor:pointer;font-size:13px">🛫 Départ</button>
          </div>
          <input type="hidden" id="fc-sens" value="arrivee">
        </div>

        <!-- CLIENT + TÉLÉPHONE -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <div class="fld"><label>Client</label>
            <div class="drv-wrap">
              <input type="text" id="fc-client-input" class="drv-input" placeholder="← Utilisez « Choisir un client » en haut" autocomplete="off" readonly onclick="toggleClientSearch()" style="font-size:13px;cursor:pointer;background:var(--dark)">
              <input type="hidden" id="fc-client" value="">
            </div>
          </div>
          <div class="fld"><label>Téléphone client</label><input type="tel" id="fc-tel" placeholder="+33 6 00 00 00 00" maxlength="20"></div>
        </div>

        <div class="fld"><label>🧳 Nombre de bagages</label><input type="number" id="fc-bagages" value="0" min="0" max="60" placeholder="0"></div>
      </div>

      <div id="f-mad" style="display:none">
        <div class="fld"><label>Lieu de prise en charge *</label><input type="text" id="fc-lieu" placeholder="Hôtel Le Marais, Paris" maxlength="200"></div>
        <div class="fg2">
          <div class="fld"><label>Durée</label>
            <select id="fc-duree">
              <option value="1h">1 heure</option><option value="2h">2 heures</option><option value="3h">3 heures</option>
              <option value="4h">4 heures</option><option value="demi">Demi-journée (4h)</option>
              <option value="journee">Journée complète (8h)</option>
            </select>
          </div>
          <div class="fld"><label>Prix TTC (€)</label><input type="number" id="fc-prix-mad" placeholder="0"></div>
        </div>
      </div>

      <!-- RÉFÉRENCE + PRIX (simplifié) -->
      <!-- Catégorie cachée : détectée automatiquement depuis les adresses -->
      <input type="hidden" id="fc-cat" value="autre">
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:8px">
        <div class="fld"><label>N° de voiture</label><input type="text" id="fc-numveh" placeholder="1, 2, 3..." oninput="genRef()" maxlength="200"></div>
        <div class="fld">
          <label>Prix client TTC (€)</label>
          <input type="number" id="fc-prix" placeholder="0" oninput="calcMarge()">
          <div style="font-size:10px;color:var(--muted);margin-top:3px">Payé par le client</div>
        </div>
        <div class="fld">
          <label style="color:var(--green)">Prix chauffeur TTC (€)</label>
          <input type="number" id="fc-prix-chauffeur" placeholder="0" oninput="calcMarge()"
            style="background:var(--dark);border:2px solid var(--green);border-radius:var(--r-xs);padding:9px 12px;color:var(--green);font-size:14px;font-weight:700;outline:none;width:100%">
          <div style="font-size:10px;color:var(--muted);margin-top:3px">Ce que voit le chauffeur</div>
        </div>
      </div>
      <!-- Différence = commission à déduire de la facture chauffeur -->
      <div style="display:flex;align-items:center;justify-content:space-between;background:var(--gold-dim);border:1px solid rgba(200,169,110,0.4);border-radius:var(--r-xs);padding:10px 14px;margin-bottom:10px">
        <span style="font-size:12px;color:var(--gold);font-weight:600">Différence à déduire sur facture chauffeur</span>
        <span id="fc-marge" style="font-family:'Syne',sans-serif;font-size:16px;font-weight:800;color:var(--gold)">—</span>
      </div>
      <!-- Champs cachés conservés pour ne pas casser les calculs existants -->
      <input type="hidden" id="fc-frais-annulation" value="">
      <input type="hidden" id="fc-commission-pct" value="">
      <input type="hidden" id="fc-commission-mode" value="marge">
      <input type="hidden" id="fc-commission-val" value="">

      <!-- MODE DE PAIEMENT (simplifié) -->
      <div style="margin-bottom:10px">
        <label style="font-size:10px;color:var(--muted2);text-transform:uppercase;letter-spacing:0.8px;font-weight:600;display:block;margin-bottom:6px">Mode de paiement</label>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div id="pay-mobilea" onclick="selPayMode('mobilea')"
            style="padding:12px 14px;background:var(--gold-dim);border:2px solid var(--gold);border-radius:var(--r-sm);cursor:pointer;text-align:center">
            <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--gold)">🏢 En compte</div>
          </div>
          <div id="pay-direct" onclick="selPayMode('direct')"
            style="padding:12px 14px;background:var(--card2);border:2px solid var(--border);border-radius:var(--r-sm);cursor:pointer;text-align:center">
            <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--muted2)">🚗 Paiement à bord</div>
          </div>
        </div>
        <input type="hidden" id="fc-pay-mode" value="mobilea">
        <!-- Champ commission MOBILEA (visible seulement en paiement à bord) -->
        <div id="fc-pab-commission-wrap" style="display:none;margin-top:10px">
          <div class="fld">
            <label style="color:var(--orange)">💰 Commission MOBILEA à déduire (€)</label>
            <input type="number" id="fc-commission-pab" placeholder="ex: 20" min="0" step="0.01">
          </div>
          <div style="font-size:10px;color:var(--muted2);margin-top:4px">Le chauffeur encaisse le client ; cette commission sera déduite de sa facture (ligne « Frais transfert »).</div>
        </div>
        <!-- Bloc détaillé caché : la différence ci-dessus suffit -->
        <div id="pay-direct-info" style="display:none">
          <strong id="pay-total-info"></strong><strong id="pay-marge-info"></strong>
          <span id="fc-commission-unit"></span><strong id="fc-commission-result"></strong>
        </div>
      </div>
      <div id="prix-suggest" style="display:none;padding:7px 10px;background:var(--gold-dim);border-radius:var(--r-xs);font-size:11px;color:var(--gold);margin-bottom:8px"></div>
      <div class="fld"><label>Notes générales</label><textarea id="fc-notes" rows="1" placeholder="Infos générales sur la course..." maxlength="2000"></textarea></div>

      <!-- LISTE PASSAGERS -->
      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700"><i class="fas fa-users" style="color:var(--gold)"></i> Passagers <span id="pax-count" style="color:var(--muted);font-size:11px"></span></div>
          <span id="pax-cap-warn" style="font-size:11px;color:var(--red);display:none"><i class="fas fa-exclamation-triangle"></i> Capacité max atteinte</span>
        </div>
        <div style="font-size:10px;color:var(--muted);margin-bottom:8px">
          Une ligne par passager — format libre. Exemple : <span style="color:var(--gold)">07:20 / TO3910 / 3 / R4N7XF3F5KF / Angela Bruciafreddo Italy +393491972346</span>
        </div>
        <textarea id="pax-notes" rows="6" placeholder="Colle tes passagers ici, une ligne par personne :&#10;07:20 / TO3910 / 3 / R4N7XF3F5KF / Angela Bruciafreddo Italy +393491972346&#10;14:30 / BA1234 / ORY4 / REF-002 / Marie Martin / +33698765432&#10;..."
          style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:12px;color:var(--white);font-size:12px;outline:none;resize:vertical;font-family:'DM Sans',sans-serif;line-height:1.7"
          oninput="updatePaxCount()" maxlength="2000"></textarea>
        <div id="pax-list" style="display:none"></div>
      </div>

    </div>
    <div class="mo-f"><button class="btn btn-ghost" onclick="closeMo('course')">Annuler</button><button class="btn btn-p" onclick="saveCourse()"><i class="fas fa-save"></i> Enregistrer la course</button></div>
  </div>
</div>


<!-- COMPTE CLIENT -->
<div class="mo" id="mo-client-account">
  <div class="mo-box" style="width:460px">
    <div class="mo-h">
      <div class="mo-t"><i class="fas fa-building" style="color:var(--gold)"></i> <span id="ca-modal-title">Compte Client</span></div>
      <div class="mo-x" onclick="closeMo('client-account')"><i class="fas fa-times"></i></div>
    </div>
    <div class="mo-b">
      <input type="hidden" id="ca-edit-id">
      <div class="fld"><label>Identifiant *</label><input type="text" id="ca-user" placeholder="duemea_sophie" maxlength="200"></div>
      <div class="fg2">
        <div class="fld"><label>Prénom *</label><input type="text" id="ca-prenom" placeholder="Sophie" maxlength="200"></div>
        <div class="fld"><label>Nom *</label><input type="text" id="ca-nom-field" placeholder="Martin" maxlength="200"></div>
      </div>
      <div class="fld"><label>Société *</label>
        <select id="ca-societe"><option value="">— Choisir —</option></select>
      </div>
      <div class="fg2">
        <div class="fld"><label>Email</label><input type="email" id="ca-email" placeholder="sophie@societe.com" maxlength="100"></div>
        <div class="fld"><label>Téléphone</label><input type="tel" id="ca-tel" placeholder="+33 1 23 45 67 89" maxlength="20"></div>
      </div>
      <div class="fld">
        <label id="ca-pass-label">Mot de passe *</label>
        <input type="password" id="ca-pass" placeholder="Min. 6 caractères" maxlength="128">
        <div id="ca-pass-hint" style="display:none;font-size:10px;color:var(--muted);margin-top:3px">Laisser vide pour ne pas changer</div>
      </div>
      <div class="fld" style="margin-top:4px">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:normal">
          <input type="checkbox" id="ca-partner" style="width:16px;height:16px;cursor:pointer">
          <span>Compte <strong>partenaire</strong> (peut créer ses propres transferts, ne voit que les siens)</span>
        </label>
      </div>
    </div>
    <div class="mo-f">
      <button class="btn btn-ghost" onclick="closeMo('client-account')">Annuler</button>
      <button class="btn btn-p" onclick="saveClientAccount()"><i class="fas fa-save"></i> <span id="ca-save-lbl">Créer</span></button>
    </div>
  </div>
</div>

<!-- RÉSERVATION CLIENT -->
<!-- MODAL MODIFICATION RÉSERVATION CLIENT -->
<div class="mo" id="mo-edit-booking">
  <div class="mo-box" style="width:560px">
    <div class="mo-h">
      <div class="mo-t"><i class="fas fa-edit" style="color:var(--gold)"></i> Modifier ma réservation</div>
      <div class="mo-x" onclick="closeMo('edit-booking')"><i class="fas fa-times"></i></div>
    </div>
    <div class="mo-b">
      <input type="hidden" id="edit-course-id">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px">
        <div class="fld" style="grid-column:1/-1"><label>Date & Heure *</label><input type="datetime-local" id="edit-dt" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none"></div>
        <div class="fld" style="grid-column:1/-1"><label>Départ *</label><input type="text" id="edit-dep" placeholder="Adresse de départ" autocomplete="off" maxlength="200" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none"></div>
        <div class="fld" style="grid-column:1/-1"><label>Arrivée *</label><input type="text" id="edit-arr" placeholder="Adresse d'arrivée" autocomplete="off" maxlength="200" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none"></div>
        <div class="fld"><label>Passagers</label><input type="number" id="edit-pax" min="1" max="20" value="1" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none"></div>
        <div class="fld"><label>Véhicule</label>
          <select id="edit-veh" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
            <option value="berline">🚗 Berline</option>
            <option value="van">🚐 Van</option>
            <option value="sprinter">🚌 Sprinter</option>
            <option value="limousine">🥂 Limousine</option>
            <option value="classes">🖤 Classe S</option>
          </select>
        </div>
        <div class="fld" style="grid-column:1/-1"><label>N° de vol / train</label><input type="text" id="edit-vol" placeholder="Ex: AF1234" maxlength="20" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none"></div>
        <div class="fld" style="grid-column:1/-1"><label>Notes</label><textarea id="edit-notes" rows="2" maxlength="300" placeholder="Informations complémentaires..." style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none;resize:vertical"></textarea></div>
      </div>
      <div style="background:rgba(200,169,110,0.08);border:1px solid rgba(200,169,110,0.2);border-radius:6px;padding:10px;font-size:12px;color:var(--muted);margin-bottom:14px">
        <i class="fas fa-info-circle" style="color:var(--gold)"></i> Modification possible uniquement si la course n'est pas encore acceptée par un chauffeur.
      </div>
      <div id="edit-err" style="color:#ef4444;font-size:12px;min-height:18px;margin-bottom:8px"></div>
      <div style="display:flex;gap:10px">
        <button onclick="closeMo('edit-booking')" style="flex:1;padding:10px;background:var(--card2);border:none;border-radius:var(--r-sm);color:var(--white);cursor:pointer;font-size:13px">Annuler</button>
        <button onclick="submitEditBooking()" style="flex:2;padding:10px;background:var(--gold);border:none;border-radius:var(--r-sm);color:var(--black);font-weight:700;cursor:pointer;font-size:13px">✓ Enregistrer les modifications</button>
      </div>
    </div>
  </div>
</div>

<div class="mo" id="mo-client-booking">
  <div class="mo-box" style="width:620px;max-height:92vh;overflow-y:auto;padding:0">

    <!-- ÉTAPE 1 — ADRESSES + CARTE -->
    <div id="cb-step1" style="display:block">
      <div style="padding:20px 24px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px">
          <h2 style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:var(--white);margin:0">🚗 Nouvelle réservation</h2>
          <button onclick="closeMo('client-booking')" style="background:var(--card2);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;color:var(--muted);font-size:16px;display:flex;align-items:center;justify-content:center">×</button>
        </div>

        <!-- Adresses favorites (Domicile / Travail / lieux enregistrés) -->
        <div id="cb-fav" style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px"></div>

        <!-- Champs adresse style Uber -->
        <div style="background:var(--card2);border-radius:12px;padding:4px;margin-bottom:14px">
          <div style="display:flex;align-items:center;gap:12px;padding:12px;border-bottom:1px solid var(--border)">
            <div style="display:flex;flex-direction:column;align-items:center;gap:3px">
              <div style="width:10px;height:10px;border-radius:50%;background:#c8a96e;border:2px solid var(--bg)"></div>
              <div style="width:2px;height:20px;background:var(--border2)"></div>
              <div style="width:10px;height:10px;border-radius:2px;background:#2ecc8a"></div>
            </div>
            <div style="flex:1;display:flex;flex-direction:column;gap:0">
              <input type="text" id="cb-dep" placeholder="📍 Adresse de départ" autocomplete="off" maxlength="200"
                oninput="cbEstimatePrix()" onchange="cbEstimatePrix()"
                style="background:transparent;border:none;outline:none;color:var(--white);font-size:14px;padding:4px 0;width:100%;font-family:'DM Sans',sans-serif">
              <input type="text" id="cb-arr" placeholder="🏁 Adresse d'arrivée" autocomplete="off" maxlength="200"
                oninput="cbEstimatePrix()" onchange="cbEstimatePrix()"
                style="background:transparent;border:none;outline:none;color:var(--white);font-size:14px;padding:4px 0;width:100%;font-family:'DM Sans',sans-serif">
            </div>
          </div>
        </div>

        <!-- Mini carte itinéraire -->
        <div id="cb-map-wrap" style="border-radius:12px;overflow:hidden;height:180px;margin-bottom:14px;background:var(--card2);display:flex;align-items:center;justify-content:center">
          <div id="cb-map" style="width:100%;height:100%"></div>
          <div id="cb-map-placeholder" style="display:none;flex-direction:column;align-items:center;gap:8px;color:var(--muted);font-size:13px">
            <i class="fas fa-map" style="font-size:28px;opacity:0.3"></i>
            <span>La carte s'affichera après saisie des adresses</span>
          </div>
        </div>

        <!-- Estimation prix -->
        <div id="cb-prix-estimate" style="display:none;background:linear-gradient(135deg,rgba(200,169,110,0.12),rgba(200,169,110,0.06));border:1px solid rgba(200,169,110,0.3);border-radius:12px;padding:14px;margin-bottom:14px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <div>
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.06em">Estimation du prix</div>
              <div id="cb-prix-label" style="font-size:28px;font-weight:800;font-family:'Syne',sans-serif;color:var(--gold)">—</div>
              <div id="cb-prix-detail" style="font-size:11px;color:var(--muted);margin-top:2px"></div>
            </div>
            <div style="text-align:right">
              <div id="cb-dist-label" style="font-size:13px;color:var(--white2)"></div>
              <div id="cb-duree-label" style="font-size:11px;color:var(--muted)"></div>
              <div id="cb-zone-label" style="font-size:10px;color:var(--gold);margin-top:4px"></div>
            </div>
          </div>
        </div>

        <!-- Sélection véhicule style Uber -->
        <div style="margin-bottom:14px">
          <div style="font-size:12px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:.06em">Choisir un véhicule</div>
          <div style="display:flex;gap:8px">
            <div id="veh-berline" onclick="cbSelectVeh('berline')" style="flex:1;padding:12px 8px;background:var(--gold-dim);border:2px solid var(--gold);border-radius:12px;cursor:pointer;text-align:center;transition:all .15s">
              <div style="font-size:22px">🚗</div>
              <div style="font-size:12px;font-weight:700;color:var(--gold);margin-top:4px">Berline</div>
              <div style="font-size:10px;color:var(--muted)">1-3 pax</div>
              <div id="veh-berline-prix" style="font-size:13px;font-weight:700;color:var(--white);margin-top:4px">—</div>
            </div>
            <div id="veh-van" onclick="cbSelectVeh('van')" style="flex:1;padding:12px 8px;background:var(--card2);border:2px solid transparent;border-radius:12px;cursor:pointer;text-align:center;transition:all .15s">
              <div style="font-size:22px">🚐</div>
              <div style="font-size:12px;font-weight:700;color:var(--white2);margin-top:4px">Van</div>
              <div style="font-size:10px;color:var(--muted)">1-7 pax</div>
              <div id="veh-van-prix" style="font-size:13px;font-weight:700;color:var(--white);margin-top:4px">—</div>
            </div>
            <div id="veh-sprinter" onclick="cbSelectVeh('sprinter')" style="flex:1;padding:12px 8px;background:var(--card2);border:2px solid transparent;border-radius:12px;cursor:pointer;text-align:center;transition:all .15s">
              <div style="font-size:22px">🚌</div>
              <div style="font-size:12px;font-weight:700;color:var(--white2);margin-top:4px">Sprinter</div>
              <div style="font-size:10px;color:var(--muted)">1-16 pax</div>
              <div id="veh-sprinter-prix" style="font-size:13px;font-weight:700;color:var(--white);margin-top:4px">—</div>
            </div>
          </div>
          <input type="hidden" id="cb-veh" value="berline">
          <div id="cb-capacity-warn" style="display:none;margin-top:10px;padding:10px 12px;background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.35);border-radius:8px;font-size:12px;color:#ef4444"></div>
        </div>
      </div>

      <div style="padding:0 24px 20px">
        <button onclick="cbStep2()" style="width:100%;padding:14px;background:var(--gold);color:var(--black);border:none;border-radius:12px;font-size:15px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer">
          Continuer →
        </button>
      </div>
    </div>

    <!-- ÉTAPE 2 — DÉTAILS + CONFIRMATION -->
    <div id="cb-step2" style="display:none;padding:20px 24px">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:18px">
        <button onclick="document.getElementById('cb-step1').style.display='block';document.getElementById('cb-step2').style.display='none'" style="background:var(--card2);border:none;border-radius:50%;width:32px;height:32px;cursor:pointer;color:var(--white);font-size:14px">←</button>
        <h2 style="font-family:'Syne',sans-serif;font-size:17px;font-weight:800;color:var(--white);margin:0">Détails de la course</h2>
      </div>

      <!-- Récap trajet -->
      <div id="cb-recap" style="background:var(--card2);border-radius:10px;padding:12px;margin-bottom:14px;font-size:13px">
        <div style="display:flex;gap:8px;align-items:flex-start">
          <div style="display:flex;flex-direction:column;align-items:center;gap:2px;padding-top:2px">
            <div style="width:8px;height:8px;border-radius:50%;background:#c8a96e"></div>
            <div style="width:1px;height:16px;background:var(--border2)"></div>
            <div style="width:8px;height:8px;border-radius:2px;background:#2ecc8a"></div>
          </div>
          <div style="flex:1">
            <div id="cb-recap-dep" style="color:var(--white);margin-bottom:8px">—</div>
            <div id="cb-recap-arr" style="color:var(--white2)">—</div>
          </div>
          <div id="cb-recap-prix" style="font-size:18px;font-weight:700;color:var(--gold)">—</div>
        </div>
      </div>

      <div class="fg2" style="gap:10px">
        <div class="fld"><label>Date & Heure *</label><input type="datetime-local" id="cb-dt" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none"></div>
        <div class="fld"><label>Passagers</label><input type="number" id="cb-pax" value="1" min="1" max="60" oninput="checkVehCapacityClient()" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none"></div>
      </div>
      <div class="fg2" style="gap:10px">
        <div class="fld"><label>N° de vol / train</label><input type="text" id="cb-vol" placeholder="AF1234" maxlength="200" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none"></div>
        <div class="fld"><label>Bagages</label><input type="number" id="cb-bagages" value="0" min="0" max="60" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none"></div>
      </div>
      <div class="fld"><label>Options</label>
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-top:4px;align-items:center">
          <div style="display:flex;align-items:center;gap:5px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px">👶 Siège bébé
            <select id="cb-opt-bebe-nb" style="background:var(--dark);border:1px solid var(--border2);border-radius:6px;padding:3px 6px;color:var(--white);font-size:12px;outline:none;cursor:pointer">
              <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
            </select>
          </div>
          <div style="display:flex;align-items:center;gap:5px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;font-size:12px">🧒 Réhausseur
            <select id="cb-opt-rehausseur-nb" style="background:var(--dark);border:1px solid var(--border2);border-radius:6px;padding:3px 6px;color:var(--white);font-size:12px;outline:none;cursor:pointer">
              <option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option>
            </select>
          </div>
          <label style="display:flex;align-items:center;gap:5px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px"><input type="checkbox" id="cb-opt-pmr"> ♿ PMR</label>
          <label style="display:flex;align-items:center;gap:5px;background:var(--card2);border:1px solid var(--border);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px"><input type="checkbox" id="cb-opt-animal"> 🐕 Animal</label>
        </div>
      </div>
      <div class="fld"><label>👤 Passager(s) transporté(s)</label>
        <textarea id="cb-passagers-info" rows="3" maxlength="1000" placeholder="Exemple : Marie Dupont, 06 12 34 56 78&#10;Jean Martin, 06 98 76 54 32"
          style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:12px;outline:none;resize:vertical;line-height:1.6"></textarea>
        <div style="font-size:10px;color:var(--muted2);margin-top:4px">Indiquez le nom de la personne transportée et son numéro de téléphone (une ligne par passager).</div>
      </div>
      <!-- #1 Réserver pour quelqu'un d'autre -->
      <div class="fld" style="background:rgba(255,255,255,0.03);border:1px solid var(--border);border-radius:var(--r-xs);padding:10px 12px">
        <label style="display:flex;align-items:center;gap:8px;margin:0;cursor:pointer;font-size:12px">
          <input type="checkbox" id="cb-other-toggle" onchange="cbToggleOther(this.checked)" style="width:16px;height:16px;flex-shrink:0"> 👤 Je réserve pour quelqu'un d'autre
        </label>
        <div id="cb-other-fields" style="display:none;margin-top:10px">
          <div class="fg2" style="gap:10px">
            <div class="fld" style="margin:0"><label>Nom du passager</label><input type="text" id="cb-other-nom" maxlength="80" placeholder="Nom complet" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none"></div>
            <div class="fld" style="margin:0"><label>Téléphone passager</label><input type="tel" id="cb-other-tel" maxlength="30" placeholder="06 12 34 56 78" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none"></div>
          </div>
          <div style="font-size:10px;color:var(--muted2);margin-top:4px">Le chauffeur contactera cette personne, pas le titulaire du compte.</div>
        </div>
      </div>

      <!-- #3 Arrêts intermédiaires -->
      <div class="fld">
        <label>🛑 Arrêts intermédiaires (optionnel)</label>
        <div id="cb-etapes-list" style="display:flex;flex-direction:column;gap:6px"></div>
        <button type="button" id="cb-etape-add" onclick="cbAddEtape()" style="margin-top:6px;background:var(--card2);border:1px dashed var(--border2);border-radius:8px;padding:9px;color:var(--white2);font-size:12px;cursor:pointer;width:100%">➕ Ajouter un arrêt</button>
      </div>

      <!-- #5 Code promo -->
      <div class="fld"><label>🎟️ Code promo (optionnel)</label>
        <input type="text" id="cb-promo" maxlength="40" placeholder="Entrez votre code" onchange="cbApplyPromo()" onblur="cbApplyPromo()" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none;text-transform:uppercase">
        <div id="cb-promo-res" style="font-size:11px;margin-top:4px;min-height:14px"></div>
      </div>

      <div class="fld"><label>Notes</label>
        <textarea id="cb-notes" rows="2" maxlength="500" placeholder="Informations complémentaires..."
          style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:12px;outline:none;resize:none"></textarea>
      </div>
      <input type="hidden" id="cb-pax-notes" value="">
      <div class="fld" style="display:flex;align-items:center;gap:8px;background:rgba(200,169,110,0.08);border:1px solid rgba(200,169,110,0.3);border-radius:var(--r-xs);padding:10px 12px">
        <input type="checkbox" id="cb-immediate" style="width:16px;height:16px;flex-shrink:0">
        <label for="cb-immediate" style="margin:0;font-size:12px;cursor:pointer">🚀 J'ai besoin d'un chauffeur immédiatement — proposer en priorité au chauffeur disponible le plus proche</label>
      </div>
      <input type="hidden" id="cb-paiement-ligne" value="">
      <input type="hidden" id="cb-prix-stripe" value="">
      <input type="hidden" id="cb-prix-wrap" value="">
      <input type="hidden" id="cb-mode-paiement" value="onboard">

      <!-- Choix du mode de paiement — particuliers uniquement -->
      <div id="cb-paiement-wrap" style="display:none;margin-bottom:14px">
        <div style="font-size:12px;font-weight:700;color:var(--white2);margin-bottom:8px">💳 Mode de paiement</div>
        <div style="display:flex;flex-direction:column;gap:8px">
          <button type="button" onclick="cbSelectPaiement('carte')" id="cb-pm-carte" class="cb-pm-btn" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--card2);border:2px solid var(--border);border-radius:10px;color:var(--white);cursor:pointer;text-align:left">
            <span style="display:flex;align-items:center;gap:10px"><span style="font-size:18px">💳</span><span><span style="font-size:13px;font-weight:700;display:block">Carte bancaire en ligne</span><span style="font-size:11px;color:var(--muted)">Paiement sécurisé Stripe · immédiat</span></span></span>
            <span class="cb-pm-check" style="font-size:16px;color:var(--gold);opacity:0">✓</span>
          </button>
          <button type="button" onclick="cbSelectPaiement('paypal')" id="cb-pm-paypal" class="cb-pm-btn" style="display:none;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--card2);border:2px solid var(--border);border-radius:10px;color:var(--white);cursor:pointer;text-align:left">
            <span style="display:flex;align-items:center;gap:10px"><span style="font-size:18px">🅿️</span><span><span style="font-size:13px;font-weight:700;display:block">PayPal</span><span style="font-size:11px;color:var(--muted)">Payer avec votre compte PayPal</span></span></span>
            <span class="cb-pm-check" style="font-size:16px;color:var(--gold);opacity:0">✓</span>
          </button>
          <button type="button" onclick="cbSelectPaiement('onboard')" id="cb-pm-onboard" class="cb-pm-btn" style="display:flex;align-items:center;justify-content:space-between;padding:12px 14px;background:var(--card2);border:2px solid var(--gold);border-radius:10px;color:var(--white);cursor:pointer;text-align:left">
            <span style="display:flex;align-items:center;gap:10px"><span style="font-size:18px">🚗</span><span><span style="font-size:13px;font-weight:700;display:block">Paiement à bord</span><span style="font-size:11px;color:var(--muted)">Espèces ou carte auprès du chauffeur</span></span></span>
            <span class="cb-pm-check" style="font-size:16px;color:var(--gold);opacity:1">✓</span>
          </button>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
          <div style="font-size:12px;color:var(--muted)">Montant à régler</div>
          <div id="cb-final-prix" style="font-size:22px;font-weight:800;color:var(--gold)">—</div>
        </div>
      </div>

      <div id="cb-err-step2" style="color:#ef4444;font-size:12px;min-height:16px;margin-bottom:8px"></div>
      <button id="cb-submit-btn" onclick="submitClientBooking()" style="width:100%;padding:14px;background:var(--gold);color:var(--black);border:none;border-radius:12px;font-size:15px;font-weight:700;font-family:'Syne',sans-serif;cursor:pointer">
        <i class="fas fa-paper-plane" style="margin-right:6px"></i> <span id="cb-submit-label">Envoyer la demande</span>
      </button>
      <div style="text-align:center;font-size:11px;color:var(--muted);margin-top:8px">Prix fixe garanti · Pas de surcharge</div>
    </div>

  </div>
</div>

<!-- MODAL ZONE TARIFAIRE ADMIN -->
<div class="mo" id="mo-zone-tarif">
  <div class="mo-box" style="width:520px">
    <div class="mo-h">
      <div class="mo-t"><i class="fas fa-map-marker-alt" style="color:var(--gold)"></i> <span id="zt-title">Ajouter une zone tarifaire</span></div>
      <div class="mo-x" onclick="closeMo('zone-tarif')"><i class="fas fa-times"></i></div>
    </div>
    <div class="mo-b">
      <input type="hidden" id="zt-id">
      <div class="fg2">
        <div class="fld" style="grid-column:1/-1"><label>Nom de la zone *</label>
          <input type="text" id="zt-nom" placeholder="Ex: CDG → Paris, Orly → Disneyland..." maxlength="100"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
        </div>
        <div class="fld" style="grid-column:1/-1"><label>Mots-clés départ (séparés par virgule)</label>
          <input type="text" id="zt-dep-keys" placeholder="charles de gaulle, cdg, roissy, terminal 1, terminal 2" maxlength="300"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
          <div style="font-size:11px;color:var(--muted);margin-top:4px">Si vide = n'importe quelle adresse de départ</div>
        </div>
        <div class="fld" style="grid-column:1/-1"><label>Mots-clés arrivée (séparés par virgule)</label>
          <input type="text" id="zt-arr-keys" placeholder="paris, 75, châtelet, gare de lyon, opéra" maxlength="300"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
          <div style="font-size:11px;color:var(--muted);margin-top:4px">Si vide = n'importe quelle adresse d'arrivée</div>
        </div>
      </div>
      <div style="font-size:12px;font-weight:700;color:var(--gold);margin:12px 0 6px;text-transform:uppercase;letter-spacing:.05em">Prix fixe par véhicule (€ TTC)</div>
      <div class="fg3">
        <div class="fld"><label>🚗 Berline</label>
          <input type="number" id="zt-berline" step="0.5" min="0" placeholder="100"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none;font-weight:700">
        </div>
        <div class="fld"><label>🚐 Van</label>
          <input type="number" id="zt-van" step="0.5" min="0" placeholder="130"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none">
        </div>
        <div class="fld"><label>🚌 Sprinter</label>
          <input type="number" id="zt-sprinter" step="0.5" min="0" placeholder="180"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none">
        </div>
        <div class="fld"><label>🥂 Limousine</label>
          <input type="number" id="zt-limousine" step="0.5" min="0" placeholder="250"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:14px;outline:none">
        </div>
      </div>
      <div class="fg2" style="margin-top:10px">
        <div class="fld"><label>Bidirectionnel ?</label>
          <select id="zt-bidir" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
            <option value="1">✅ Oui (A→B et B→A même prix)</option>
            <option value="0">❌ Non (sens unique)</option>
          </select>
        </div>
        <div class="fld"><label>Priorité</label>
          <input type="number" id="zt-prio" value="10" min="1" max="100"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
          <div style="font-size:11px;color:var(--muted);margin-top:3px">Plus élevé = plus prioritaire</div>
        </div>
      </div>
    </div>
    <div class="mo-f">
      <button class="btn btn-ghost" onclick="closeMo('zone-tarif')">Annuler</button>
      <button class="btn btn-p" onclick="saveZoneTarif()"><i class="fas fa-save"></i> Enregistrer</button>
    </div>
  </div>
</div>

<!-- ZONE GÉOFENCE (alerte d'approche) -->
<div class="mo" id="mo-geofence-zone">
  <div class="mo-box" style="width:480px">
    <div class="mo-h">
      <div class="mo-t"><i class="fas fa-map-marker-alt" style="color:var(--gold)"></i> <span id="gz-modal-title">Nouvelle zone</span></div>
      <div class="mo-x" onclick="closeMo('geofence-zone')"><i class="fas fa-times"></i></div>
    </div>
    <div class="mo-b">
      <input type="hidden" id="gz-edit-id">
      <div class="fld" style="margin-bottom:12px"><label>Nom de la zone *</label>
        <input type="text" id="gz-nom" placeholder="Ex: Disneyland, CDG, Val d'Europe..." maxlength="80"
          style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
      </div>
      <div class="fg2">
        <div class="fld"><label>Latitude *</label>
          <input type="text" id="gz-lat" placeholder="48.867202"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
        </div>
        <div class="fld"><label>Longitude *</label>
          <input type="text" id="gz-lng" placeholder="2.783691"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
        </div>
      </div>
      <div style="font-size:11px;color:var(--muted);margin:6px 0 12px">Astuce : copiez les coordonnées depuis Google Maps (clic droit sur un point → les chiffres).</div>
      <div class="fg2">
        <div class="fld"><label>Rayon (km) *</label>
          <input type="number" id="gz-rayon" value="7" min="0.5" step="0.5"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
        </div>
        <div class="fld"><label>Délai d'alerte (min)</label>
          <input type="number" id="gz-delai" placeholder="5" min="1"
            style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
        </div>
      </div>
      <div class="fld" style="margin-top:12px"><label>Client associé (optionnel)</label>
        <input type="text" id="gz-client" placeholder="Ex: Value Retail, DreamCastle..." maxlength="80"
          style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px;outline:none">
      </div>
      <div style="margin-top:14px;background:var(--card2);border:1px solid var(--border);border-radius:var(--r-sm);padding:12px">
        <div style="font-size:12px;font-weight:700;color:var(--white2);margin-bottom:8px">🔔 Qui reçoit l'alerte ?</div>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-bottom:8px;font-weight:normal">
          <input type="checkbox" id="gz-notif-dispatch" checked style="width:16px;height:16px;cursor:pointer">
          <span>Dispatch / Admin</span>
        </label>
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-weight:normal">
          <input type="checkbox" id="gz-notif-partenaire" style="width:16px;height:16px;cursor:pointer">
          <span>Le client partenaire associé <span id="gz-notif-part-nom" style="color:var(--gold)"></span></span>
        </label>
        <div style="display:flex;align-items:center;gap:8px;margin-top:10px;flex-wrap:wrap">
          <span style="font-size:12px;color:var(--white2)">⏱️ Prévenir le client</span>
          <input type="number" id="gz-arrivee-min" min="0" max="120" placeholder="15" style="width:70px;background:var(--dark);border:1px solid var(--border2);border-radius:8px;padding:7px;color:var(--white);font-size:13px;outline:none">
          <span style="font-size:12px;color:var(--white2)">min avant son arrivée</span>
        </div>
        <div style="font-size:10px;color:var(--muted2);margin-top:6px">Ex. Value Retail : mettez 15 → le client est prévenu automatiquement ~15 min avant que le chauffeur arrive, uniquement pour les transferts qui vont chez lui. Laissez vide pour ne pas utiliser cette alerte. Le partenaire doit être connecté et avoir autorisé les notifications.</div>
      </div>
      <label style="display:flex;align-items:center;gap:8px;cursor:pointer;margin-top:14px;font-weight:normal">
        <input type="checkbox" id="gz-actif" checked style="width:16px;height:16px;cursor:pointer">
        <span>Zone active</span>
      </label>
    </div>
    <div class="mo-f">
      <button class="btn btn-g btn-sm" onclick="closeMo('geofence-zone')">Annuler</button>
      <button class="btn btn-p btn-sm" onclick="saveGeofenceZone()"><i class="fas fa-check"></i> Enregistrer</button>
    </div>
  </div>
</div>

<!-- CHAUFFEUR --><div class="mo" id="mo-chauffeur">
  <div class="mo-box" style="width:460px">
    <div class="mo-h">
      <div class="mo-t"><i class="fas fa-id-card" style="color:var(--gold)"></i> <span id="mo-ch-title">Ajouter chauffeur</span></div>
      <div class="mo-x" onclick="closeMo('chauffeur')"><i class="fas fa-times"></i></div>
    </div>
    <div class="mo-b">
      <input type="hidden" id="ch-edit-id">
      <div class="fg2"><div class="fld"><label>Prénom *</label><input type="text" id="ch-prenom" placeholder="Prénom" maxlength="200"></div><div class="fld"><label>Nom</label><input type="text" id="ch-nom" placeholder="Nom" maxlength="200"></div></div>
      <div class="fg2"><div class="fld"><label>Téléphone</label><input type="tel" id="ch-tel" placeholder="+33 6 00 00 00 00" maxlength="20"></div><div class="fld"><label>Email</label><input type="email" id="ch-email" placeholder="email@exemple.com" maxlength="100"></div></div>
      <div class="fg2">
        <div class="fld"><label>Véhicule</label><select id="ch-veh"><option value="berline">🚗 Berline</option><option value="van">🚐 Van</option><option value="sprinter">🚌 Sprinter</option><option value="bus">🚍 Bus</option><option value="pmr">♿ Van PMR</option><option value="limousine">🥂 Limousine</option><option value="classes">🖤 Classe S</option></select></div>
        <div class="fld" id="ch-vehjour-wrap" style="display:none">
          <label>Véhicule du jour <span style="font-weight:400;color:var(--muted);font-size:11px">(utilisé pour ses courses, modifiable à tout moment)</span></label>
          <select id="ch-vehjour"><option value="">— Aucun (type par défaut) —</option></select>
        </div>
      </div>
      <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--card2);border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer;margin-top:4px">
        <input type="checkbox" id="ch-historique" style="width:18px;height:18px;cursor:pointer;accent-color:var(--gold)">
        <div>
          <div style="font-size:13px;font-weight:700">📋 Accès à l'historique des transferts</div>
          <div style="font-size:11px;color:var(--muted2)">Si activé, ce chauffeur peut consulter tous les transferts qu'il a effectués</div>
        </div>
      </label>

      <label style="display:flex;align-items:center;gap:10px;padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r-sm);cursor:pointer;margin-top:8px">
        <input type="checkbox" id="ch-voir-prix" checked style="width:18px;height:18px;cursor:pointer;accent-color:#16a34a">
        <div>
          <div style="font-size:13px;font-weight:700;color:#16a34a">💰 Voir les prix des transferts</div>
          <div style="font-size:11px;color:#15803d">Si désactivé, ce chauffeur ne verra pas les montants de ses courses</div>
        </div>
      </label>

      <label style="display:flex;align-items:center;gap:10px;padding:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:var(--r-sm);cursor:pointer;margin-top:8px">
        <input type="checkbox" id="ch-blocked" style="width:18px;height:18px;cursor:pointer;accent-color:#dc2626">
        <div>
          <div style="font-size:13px;font-weight:700;color:#dc2626">🚫 Bloquer l'accès</div>
          <div style="font-size:11px;color:#b91c1c">Ce chauffeur ne pourra plus se connecter à l'application</div>
        </div>
      </label>

      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
        <div style="font-size:12px;font-weight:700;color:var(--gold);margin-bottom:8px">🔐 Connexion sécurisée (email + mot de passe)</div>
        <div class="fld"><label>Mot de passe (min. 6 caractères)</label><input type="password" id="ch-password" placeholder="Mot de passe du chauffeur" maxlength="128"></div>
        <div style="font-size:11px;color:var(--muted2);margin-bottom:8px">Définissez un mot de passe ici, OU envoyez une invitation au chauffeur pour qu'il crée le sien.</div>
        <button type="button" class="btn btn-ghost btn-sm" onclick="inviteChauffeurByEmail()" style="width:100%"><i class="fas fa-paper-plane"></i> Envoyer une invitation par email</button>
      </div>

      <div style="margin-top:14px;padding-top:14px;border-top:1px solid var(--border)">
        <label style="display:flex;align-items:center;gap:10px;padding:12px;background:var(--card2);border:1px solid var(--border);border-radius:var(--r-sm);cursor:pointer">
          <input type="checkbox" id="ch-soustraitant" style="width:18px;height:18px;cursor:pointer;accent-color:var(--gold)" onchange="document.getElementById('ch-societe-fields').style.display=this.checked?'block':'none'">
          <div>
            <div style="font-size:13px;font-weight:700">🏢 Sous-traitant (société externe)</div>
            <div style="font-size:11px;color:var(--muted2)">Active la facturation avec ses infos société</div>
          </div>
        </label>
        <div id="ch-societe-fields" style="display:none;margin-top:12px">
          <div class="fld">
            <label>Société</label>
            <div style="display:flex;gap:8px">
              <select id="ch-soc-select" onchange="onSocieteSelect()" style="flex:1;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px;color:var(--white);font-size:13px">
                <option value="">— Choisir une société —</option>
                <option value="__new__">➕ Nouvelle société...</option>
              </select>
            </div>
          </div>
          <div class="fld" id="ch-soc-nom-wrap" style="display:none"><label>Nom de la société</label><input type="text" id="ch-soc-nom" placeholder="Ex: VTC Martin SARL" maxlength="200"></div>
          <div class="fg2">
            <div class="fld"><label>SIRET</label><input type="text" id="ch-soc-siret" placeholder="123 456 789 00012" maxlength="200"></div>
            <div class="fld"><label>N° TVA</label><input type="text" id="ch-soc-tva" placeholder="FR12345678900" maxlength="200"></div>
          </div>
          <div class="fld"><label>Adresse société</label><input type="text" id="ch-soc-adresse" placeholder="12 rue de Paris, 77700 Bailly-Romainvilliers" maxlength="200"></div>
          <div class="fg2">
            <div class="fld"><label>Assujetti TVA ?</label><select id="ch-soc-tvaapp"><option value="non">Non (auto-entrepreneur)</option><option value="oui">Oui (TVA 10%)</option></select></div>
            <div class="fld"><label>IBAN (paiement)</label><input type="text" id="ch-soc-iban" placeholder="FR76 ..." maxlength="200"></div>
          </div>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;background:#eff6ff;border:1px solid #93c5fd;border-radius:var(--r-sm);cursor:pointer;margin-top:10px">
            <input type="checkbox" id="ch-gerant" style="width:18px;height:18px;cursor:pointer;accent-color:#2563eb">
            <div>
              <div style="font-size:13px;font-weight:700;color:#2563eb">👔 Gérant de la société</div>
              <div style="font-size:11px;color:#1d4ed8">Débloque l'accès gérant : Mon tableau de bord, Nouveau transfert (attribuer à ses chauffeurs ou proposer au réseau), Carte de ses chauffeurs, Mes chauffeurs &amp; Mes véhicules, et le CA de sa société. Décochez pour retirer l'accès.</div>
            </div>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;background:#f5f3ff;border:1px solid #c4b5fd;border-radius:var(--r-sm);cursor:pointer;margin-top:10px">
            <input type="checkbox" id="ch-gerant-pro" style="width:18px;height:18px;cursor:pointer;accent-color:#7c3aed">
            <div>
              <div style="font-size:13px;font-weight:700;color:#7c3aed">⚡ Transferts &amp; tableau de bord</div>
              <div style="font-size:11px;color:#6d28d9">Débloque : Mon tableau de bord, Nouveau transfert (attribuer à ses chauffeurs ou proposer au réseau) et Carte de ses chauffeurs. Indépendant du statut gérant.</div>
            </div>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r-sm);cursor:pointer;margin-top:10px">
            <input type="checkbox" id="ch-pointeuse" style="width:18px;height:18px;cursor:pointer;accent-color:#16a34a">
            <div>
              <div style="font-size:13px;font-weight:700;color:#16a34a">⏱️ Pointeuse (heures de travail)</div>
              <div style="font-size:11px;color:#15803d">Ce chauffeur saisit lui-même son heure de début et de fin de travail sur chaque course</div>
            </div>
          </label>
          <label style="display:flex;align-items:center;gap:10px;padding:12px;background:#fffbeb;border:1px solid #fcd34d;border-radius:var(--r-sm);cursor:pointer;margin-top:10px">
            <input type="checkbox" id="ch-prioritaire" style="width:18px;height:18px;cursor:pointer;accent-color:#f59e0b">
            <div>
              <div style="font-size:13px;font-weight:700;color:#b45309">⭐ Chauffeur prioritaire</div>
              <div style="font-size:11px;color:#92400e">Reçoit les transferts ouverts en priorité, avant qu'ils ne soient proposés à tous les chauffeurs</div>
            </div>
          </label>
        </div>
      </div>
    </div>
    <div class="mo-f">
      <button class="btn btn-ghost" onclick="closeMo('chauffeur')">Annuler</button>
      <button class="btn btn-p" onclick="saveChauffeur()"><i class="fas fa-save"></i> <span id="ch-save-lbl">Enregistrer</span></button>
    </div>
  </div>
</div>

<!-- VEHICULE -->
<div class="mo" id="mo-vehicule">
  <div class="mo-box" style="width:460px">
    <div class="mo-h">
      <div class="mo-t"><i class="fas fa-car" style="color:var(--gold)"></i> <span id="mo-vh-title">Ajouter véhicule</span></div>
      <div class="mo-x" onclick="closeMo('vehicule')"><i class="fas fa-times"></i></div>
    </div>
    <div class="mo-b">
      <input type="hidden" id="vh-edit-id">
      <div class="fg2"><div class="fld"><label>Marque *</label><input type="text" id="vh-marque" placeholder="Mercedes" maxlength="200"></div><div class="fld"><label>Modèle</label><input type="text" id="vh-modele" placeholder="Classe E" maxlength="200"></div></div>
      <div class="fg2"><div class="fld"><label>Immatriculation</label><input type="text" id="vh-immat" placeholder="AB-123-CD" maxlength="200"></div><div class="fld"><label>Année</label><input type="number" id="vh-annee" placeholder="2024"></div></div>
      <div class="fg2">
        <div class="fld"><label>Type</label><select id="vh-type"><option value="berline">Berline</option><option value="van">Van</option><option value="sprinter">Sprinter</option><option value="bus">Bus</option><option value="pmr">Van PMR</option><option value="limousine">Limousine</option><option value="classes">Classe S</option></select></div>
        <div class="fld"><label>Km</label><input type="number" id="vh-km" placeholder="0"></div>
      </div>
      <div class="fld"><label>Société <span style="font-weight:400;color:var(--muted);font-size:11px">(choisir d'abord pour filtrer les chauffeurs)</span></label><select id="vh-societe" onchange="fillVehChauffeurSelect()"><option value="">— MOBILEA (aucune société) —</option></select></div>
      <div class="fld"><label>Chauffeur <span style="font-weight:400;color:var(--muted);font-size:11px" id="vh-ch-hint"></span></label>
        <input type="text" id="vh-ch-search" placeholder="Rechercher un chauffeur…" oninput="filterVehChauffeur(this.value)" autocomplete="off" style="width:100%;margin-bottom:6px;box-sizing:border-box">
        <select id="vh-ch" size="1"><option value="">— Non assigné —</option></select>
      </div>
    </div>
    <div class="mo-f"><button class="btn btn-ghost" onclick="closeMo('vehicule')">Annuler</button><button class="btn btn-p" onclick="saveVehicule()"><i class="fas fa-save"></i> <span id="vh-save-lbl">Enregistrer</span></button></div>
  </div>
</div>

<!-- CLIENT -->
<div class="mo" id="mo-client">
  <div class="mo-box" style="width:640px">
    <div class="mo-h">
      <div class="mo-t"><i class="fas fa-building" style="color:var(--gold)"></i> <span id="mo-client-title">Ajouter client</span></div>
      <div class="mo-x" onclick="closeMo('client')"><i class="fas fa-times"></i></div>
    </div>
    <div class="mo-b">
      <input type="hidden" id="cl-edit-id">

      <!-- INFOS SOCIÉTÉ -->
      <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">🏢 Informations société</div>
      <div class="fg2">
        <div class="fld"><label>Raison sociale *</label><input type="text" id="cl-nom" placeholder="DUEMEA SAS" maxlength="200"></div>
        <div class="fld"><label>Nom commercial</label><input type="text" id="cl-commercial" placeholder="DUEMEA" maxlength="200"></div>
      </div>
      <div class="fg2">
        <div class="fld"><label>SIRET</label><input type="text" id="cl-siret" placeholder="123 456 789 00012" maxlength="200"></div>
        <div class="fld"><label>N° TVA intracommunautaire</label><input type="text" id="cl-tva" placeholder="FR12345678901" maxlength="200"></div>
      </div>
      <div class="fld"><label>📍 Adresse principale (remplit le départ auto)</label><input type="text" id="cl-adresse" placeholder="Ex: Dream Castle Hotel, 40 Av. de la Fosse des Pressoirs, 77700 Magny-le-Hongre" maxlength="250"></div>

      <!-- Adresses fréquentes (plusieurs lieux de départ nommés) -->
      <div class="fld">
        <label>📍 Autres adresses fréquentes (départ rapide)</label>
        <div id="cl-adresses-list" style="display:flex;flex-direction:column;gap:8px;margin-bottom:8px"></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <input type="text" id="cl-adr-nom" placeholder="Nom court (ex: Université)" maxlength="40" style="flex:1;min-width:120px;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:9px;color:var(--white);font-size:12px">
          <input type="text" id="cl-adr-full" placeholder="Adresse complète" maxlength="250" style="flex:2;min-width:180px;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:9px;color:var(--white);font-size:12px">
          <button type="button" class="btn btn-p btn-sm" onclick="clAjouterAdresse()"><i class="fas fa-plus"></i> Ajouter</button>
        </div>
        <div style="font-size:11px;color:var(--muted);margin-top:4px">Ces adresses seront proposées dans un menu quand vous choisirez ce client pour une course</div>
      </div>

      <div class="fg3">
        <div class="fld"><label>Code postal</label><input type="text" id="cl-cp" placeholder="75001" maxlength="200"></div>
        <div class="fld"><label>Ville</label><input type="text" id="cl-ville" placeholder="Paris" maxlength="200"></div>
        <div class="fld"><label>Pays</label><input type="text" id="cl-pays" placeholder="France" value="France" maxlength="200"></div>
      </div>

      <!-- CONTACT -->
      <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin:14px 0 10px">👤 Contact principal</div>
      <div class="fg2">
        <div class="fld"><label>Nom & Prénom</label><input type="text" id="cl-contact" placeholder="Jean Dupont" maxlength="200"></div>
        <div class="fld"><label>Poste</label><input type="text" id="cl-poste" placeholder="Responsable transport" maxlength="200"></div>
      </div>
      <div class="fg2">
        <div class="fld"><label>Téléphone</label><input type="tel" id="cl-tel" placeholder="+33 1 23 45 67 89" maxlength="20"></div>
        <div class="fld"><label>Email</label><input type="email" id="cl-email" placeholder="contact@societe.com" maxlength="100"></div>
      </div>
      <div class="fld"><label>Email facturation</label><input type="email" id="cl-email-fac" placeholder="compta@societe.com" maxlength="100"></div>

      <!-- MESSAGE SMS PERSONNALISÉ -->
      <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin:14px 0 10px">💬 Message SMS aux passagers</div>
      <div class="fld">
        <label>Message type pour ce client</label>
        <textarea id="cl-sms-template" rows="5" placeholder="Hello [prenom], I am [chauffeur], your driver for your transfer to [destination]. I am waiting for you at the meeting point. To reach me: [tel]" style="width:100%;background:var(--dark);border:1px solid var(--border2);border-radius:var(--r-sm);padding:10px 14px;color:var(--white);font-family:'DM Sans',sans-serif;font-size:12px;outline:none;resize:vertical;line-height:1.5" maxlength="2000"></textarea>
        <div style="font-size:10px;color:var(--muted);margin-top:4px">Variables : <strong>[prenom]</strong> = prénom passager, <strong>[chauffeur]</strong> = nom chauffeur, <strong>[destination]</strong> = arrivée, <strong>[tel]</strong> = tél chauffeur</div>
      </div>

      <!-- FACTURATION -->
      <div style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700;color:var(--gold);text-transform:uppercase;letter-spacing:1px;margin:14px 0 10px">💶 Facturation</div>
      <div class="fg3">
        <div class="fld"><label>Type</label>
          <select id="cl-type">
            <option value="corporate">🏢 Corporate</option>
            <option value="premium">⭐ Premium</option>
            <option value="standard">Standard</option>
          </select>
        </div>
        <div class="fld"><label>Mode facturation</label>
          <select id="cl-mode-fac">
            <option value="mensuel">Mensuel</option>
            <option value="hebdo">Hebdomadaire</option>
            <option value="course">Par course</option>
            <option value="prepaye">Prépayé</option>
          </select>
        </div>
        <div class="fld"><label>Délai paiement</label>
          <select id="cl-delai">
            <option value="30">30 jours</option>
            <option value="45">45 jours</option>
            <option value="60">60 jours</option>
            <option value="0">Immédiat</option>
          </select>
        </div>
      </div>
      <div class="fg2">
        <div class="fld"><label>Commission appliquée (%)</label><input type="number" id="cl-commission" placeholder="ex: 10" min="0" max="100"></div>
        <div class="fld"><label>Référence client interne</label><input type="text" id="cl-ref" placeholder="CLI-001" maxlength="200"></div>
      </div>
      <div class="fld"><label>Notes internes</label><textarea id="cl-notes" rows="2" placeholder="Informations importantes, conditions particulières..." maxlength="2000"></textarea></div>
    </div>
    <div class="mo-f">
      <button class="btn btn-ghost" onclick="closeMo('client')">Annuler</button>
      <button class="btn btn-p" onclick="saveClient()"><i class="fas fa-save"></i> Enregistrer</button>
    </div>
  </div>
</div>

<!-- TARIF -->
<div class="mo" id="mo-tarif">
  <div class="mo-box" style="width:560px">
    <div class="mo-h"><div class="mo-t"><i class="fas fa-tag" style="color:var(--gold)"></i> <span id="tf-title">Ajouter tarif</span></div><div class="mo-x" onclick="closeMo('tarif')"><i class="fas fa-times"></i></div></div>
    <div class="mo-b">
      <input type="hidden" id="tf-edit-id">
      <div class="fld"><label>Client *</label>
        <select id="tf-client"><option value="">— Choisir un client —</option></select>
      </div>
      <div class="fg2">
        <div class="fld"><label>Départ *</label><input type="text" id="tf-dep" placeholder="Ex: CDG" maxlength="200"></div>
        <div class="fld"><label>Arrivée *</label><input type="text" id="tf-arr" placeholder="Ex: Disneyland" maxlength="200"></div>
      </div>
      <div style="background:var(--blue-dim);border:1px solid rgba(91,156,246,0.2);border-radius:var(--r-sm);padding:10px 12px;margin-bottom:8px">
        <div style="font-size:11px;color:var(--blue);margin-bottom:6px"><i class="fas fa-map-marker-alt"></i> Tarif par département (optionnel) — détecté automatiquement depuis le code postal</div>
        <div class="fg2">
          <div class="fld"><label>Dép. départ</label><input type="text" id="tf-dept-dep" placeholder="Ex: 77" maxlength="3" style="text-align:center"></div>
          <div class="fld"><label>Dép. arrivée</label><input type="text" id="tf-dept-arr" placeholder="Ex: 75" maxlength="3" style="text-align:center"></div>
        </div>
      </div>
      <div class="fld"><label>Catégorie</label>
        <select id="tf-cat"><option value="cdg">CDG</option><option value="orly">Orly</option><option value="disney">Disneyland</option><option value="paris">Paris</option><option value="gare">Gare</option><option value="autre">Autre</option></select>
      </div>

      <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;color:var(--gold);margin:16px 0 10px;text-transform:uppercase;letter-spacing:1px">Prix par gamme — Client / Chauffeur</div>

      <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:8px;align-items:center;margin-bottom:8px">
        <div style="font-size:11px;color:var(--muted);font-weight:700"></div>
        <div style="font-size:11px;color:var(--muted);font-weight:700;text-align:center">Prix CLIENT (€)</div>
        <div style="font-size:11px;color:var(--green);font-weight:700;text-align:center">Prix CHAUFFEUR (€)</div>
      </div>
      <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:8px;align-items:center;margin-bottom:6px">
        <div style="font-size:12px;font-weight:600">🚗 Berline</div>
        <input type="number" id="tf-berline" placeholder="0" style="text-align:center">
        <input type="number" id="tf-ch-berline" placeholder="0" style="text-align:center">
      </div>
      <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:8px;align-items:center;margin-bottom:6px">
        <div style="font-size:12px;font-weight:600">🚐 Van</div>
        <input type="number" id="tf-van" placeholder="0" style="text-align:center">
        <input type="number" id="tf-ch-van" placeholder="0" style="text-align:center">
      </div>
      <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:8px;align-items:center;margin-bottom:6px">
        <div style="font-size:12px;font-weight:600">🚌 Sprinter</div>
        <input type="number" id="tf-sprinter" placeholder="0" style="text-align:center">
        <input type="number" id="tf-ch-sprinter" placeholder="0" style="text-align:center">
      </div>
      <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:8px;align-items:center;margin-bottom:6px">
        <div style="font-size:12px;font-weight:600">🚍 Bus</div>
        <input type="number" id="tf-bus" placeholder="0" style="text-align:center">
        <input type="number" id="tf-ch-bus" placeholder="0" style="text-align:center">
      </div>
      <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:8px;align-items:center;margin-bottom:6px">
        <div style="font-size:12px;font-weight:600">♿ Van PMR</div>
        <input type="number" id="tf-pmr" placeholder="0" style="text-align:center">
        <input type="number" id="tf-ch-pmr" placeholder="0" style="text-align:center">
      </div>
      <div style="display:grid;grid-template-columns:90px 1fr 1fr;gap:8px;align-items:center;margin-bottom:6px">
        <div style="font-size:12px;font-weight:600">🥂 Limousine</div>
        <input type="number" id="tf-limousine" placeholder="0" style="text-align:center">
        <input type="number" id="tf-ch-limousine" placeholder="0" style="text-align:center">
      </div>
      <div class="fld" style="margin-top:10px"><label>Supplément nuit TTC (€)</label><input type="number" id="tf-nuit" placeholder="0"></div>
      <div class="fld" style="margin-top:10px"><label>Prix minimum TTC (€) <span style="font-weight:400;color:var(--muted);font-size:11px">(plancher : la course ne descend pas en dessous)</span></label><input type="number" id="tf-min" placeholder="0"></div>
    </div>
    <div class="mo-f"><button class="btn btn-ghost" onclick="closeMo('tarif')">Annuler</button><button class="btn btn-p" onclick="saveTarif()"><i class="fas fa-save"></i> Enregistrer</button></div>
  </div>
</div>

<!-- ASSIGNER -->
<div class="mo" id="mo-assign">
  <div class="mo-box" style="width:380px">
    <div class="mo-h"><div class="mo-t"><i class="fas fa-user-check" style="color:var(--gold)"></i> Assigner chauffeur</div><div class="mo-x" onclick="closeMo('assign')"><i class="fas fa-times"></i></div></div>
    <div class="mo-b">
      <input type="hidden" id="assign-id">
      <div class="fld"><label>Chauffeur</label>
        <div class="drv-wrap">
          <input type="text" id="assign-drv-input" class="drv-input" placeholder="Rechercher un chauffeur..." autocomplete="off" oninput="filterDrv('assign-drv',this.value)" onfocus="openDrv('assign-drv')" onblur="setTimeout(()=>closeDrv('assign-drv'),200)" maxlength="200">
          <input type="hidden" id="assign-drv" value="">
          <div class="drv-drop" id="drv-drop-assign-drv"></div>
        </div>
      </div>
    </div>
    <div style="padding:0 16px 4px"><button onclick="genererLienExterne(document.getElementById('assign-id').value)" style="width:100%;background:#eff6ff;border:1px solid #93c5fd;border-radius:8px;padding:11px;color:#2563eb;font-size:13px;font-weight:700;cursor:pointer">🔗 Ou générer un lien pour un chauffeur externe</button></div>
    <div class="mo-f"><button class="btn btn-ghost" onclick="closeMo('assign')">Annuler</button><button class="btn btn-p" onclick="doAssign()"><i class="fas fa-check"></i> Assigner</button></div>
  </div>
</div>

<!-- DISPATCH ACCOUNT -->
<div class="mo" id="mo-dispatch-account">
  <div class="mo-box" style="width:400px">
    <div class="mo-h">
      <div class="mo-t"><i class="fas fa-user-tie" style="color:var(--gold)"></i> <span id="da-modal-title">Compte Dispatch</span></div>
      <div class="mo-x" onclick="closeMo('dispatch-account')"><i class="fas fa-times"></i></div>
    </div>
    <div class="mo-b">
      <input type="hidden" id="da-edit-id">
      <div class="fld"><label>Rôle</label>
        <select id="da-role">
          <option value="dispatch">📋 Dispatch</option>
          <option value="admin">👑 Administrateur</option>
        </select>
      </div>
      <div class="fld"><label>Identifiant *</label><input type="text" id="da-user" placeholder="dispatch01" maxlength="200"></div>
      <div class="fld"><label>Email * (pour connexion sécurisée)</label><input type="email" id="da-email" placeholder="sophie@mobilea.com" maxlength="100"></div>
      <div class="fld"><label>Nom complet</label><input type="text" id="da-nom" placeholder="Sophie Martin" maxlength="200"></div>
      <div class="fld">
        <label id="da-pass-label">Mot de passe *</label>
        <input type="password" id="da-pass" placeholder="Min. 6 caractères" maxlength="128">
        <div id="da-pass-hint" style="display:none;font-size:10px;color:var(--muted);margin-top:3px">Laisser vide pour ne pas changer le mot de passe</div>
      </div>
      <label style="display:flex;align-items:center;gap:10px;padding:12px;background:#fef2f2;border:1px solid #fca5a5;border-radius:var(--r-sm);cursor:pointer;margin-top:8px">
        <input type="checkbox" id="da-blocked" style="width:18px;height:18px;cursor:pointer;accent-color:#dc2626">
        <div>
          <div style="font-size:13px;font-weight:700;color:#dc2626">🚫 Bloquer l'accès</div>
          <div style="font-size:11px;color:#b91c1c">Ce dispatch ne pourra plus se connecter</div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:10px;padding:12px;background:#f0fdf4;border:1px solid #86efac;border-radius:var(--r-sm);cursor:pointer;margin-top:8px">
        <input type="checkbox" id="da-can-add-drivers" style="width:18px;height:18px;cursor:pointer;accent-color:#16a34a">
        <div>
          <div style="font-size:13px;font-weight:700;color:#16a34a">🚗 Peut ajouter des chauffeurs</div>
          <div style="font-size:11px;color:#15803d">Autorise ce dispatch à créer, modifier et archiver des chauffeurs</div>
        </div>
      </label>
      <label style="display:flex;align-items:center;gap:10px;padding:12px;background:#eff6ff;border:1px solid #93c5fd;border-radius:var(--r-sm);cursor:pointer;margin-top:8px">
        <input type="checkbox" id="da-can-assign-vans" style="width:18px;height:18px;cursor:pointer;accent-color:#2563eb">
        <div>
          <div style="font-size:13px;font-weight:700;color:#2563eb">🚐 Peut attribuer les véhicules</div>
          <div style="font-size:11px;color:#1d4ed8">Autorise ce dispatch à affecter un véhicule à un chauffeur et à saisir les heures</div>
        </div>
      </label>
    </div>
    <div class="mo-f">
      <button class="btn btn-ghost" onclick="closeMo('dispatch-account')">Annuler</button>
      <button class="btn btn-p" id="da-save-btn" onclick="saveDispatchAccount()"><i class="fas fa-save"></i> Créer</button>
    </div>
  </div>
</div>

<div class="conf-ov" id="conf-ov">
  <div class="conf-box">
    <i class="fas fa-exclamation-triangle"></i>
    <h3 id="conf-t">Confirmer</h3>
    <p id="conf-m">Cette action est irréversible.</p>
    <div class="conf-btns"><button class="btn btn-ghost" onclick="closeConf()">Annuler</button><button class="btn btn-d" id="conf-ok" onclick="doConfirm()">Confirmer</button></div>
  </div>
</div>

<div class="toast" id="toast"><i class="fas fa-check-circle"></i><span id="toast-msg"></span></div>

<script src="/app.js"></script>

<!-- ═══════════════════════════════════════════════════════
     MOBILEA — Module Paiement Stripe Elements
     ═══════════════════════════════════════════════════════ -->
<div id="mb-pay-overlay" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.55);z-index:9999;align-items:center;justify-content:center;">
  <div style="background:#fff;border-radius:16px;width:100%;max-width:420px;padding:1.5rem;position:relative;margin:1rem;">

    <!-- En-tête -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;">
      <h2 style="font-size:16px;font-weight:600;margin:0;">💳 Paiement en ligne</h2>
      <button onclick="closeMbPay()" style="background:none;border:none;font-size:22px;cursor:pointer;color:#666;line-height:1;">&times;</button>
    </div>

    <!-- Résumé course -->
    <div style="background:#f5f5f5;border-radius:8px;padding:10px 14px;display:flex;justify-content:space-between;font-size:13px;margin-bottom:1rem;">
      <span id="mb-pay-desc" style="color:#555;">Course</span>
      <span id="mb-pay-amt" style="font-weight:600;">—</span>
    </div>

    <!-- Apple Pay / Google Pay -->
    <div id="mb-payment-request-wrap" style="display:none;margin-bottom:12px;">
      <div id="mb-payment-request-btn"></div>
      <div style="display:flex;align-items:center;gap:8px;margin:12px 0;">
        <div style="flex:1;height:1px;background:#eee;"></div>
        <span style="font-size:11px;color:#999;">ou payer par carte</span>
        <div style="flex:1;height:1px;background:#eee;"></div>
      </div>
    </div>

    <!-- PayPal -->
    <div id="mb-paypal-wrap" style="margin-bottom:12px;">
      <div id="mb-paypal-btn"></div>
      <div style="display:flex;align-items:center;gap:8px;margin:12px 0;">
        <div style="flex:1;height:1px;background:#eee;"></div>
        <span style="font-size:11px;color:#999;">ou payer par carte</span>
        <div style="flex:1;height:1px;background:#eee;"></div>
      </div>
    </div>

    <!-- Carte bancaire -->
    <label style="font-size:12px;color:#666;display:block;margin-bottom:5px;">Carte bancaire</label>
    <div id="mb-card-element" style="border:1px solid #ddd;border-radius:8px;padding:11px 12px;background:#fff;"></div>
    <div id="mb-card-errors" style="color:#e53935;font-size:12px;margin-top:6px;min-height:18px;"></div>

    <button id="mb-pay-btn" onclick="submitMbPay()" style="width:100%;margin-top:14px;padding:12px;background:#c8a96e;color:#0f1117;border:none;border-radius:8px;font-size:14px;font-weight:600;cursor:pointer;">🔒 Payer <span id="mb-pay-btn-amt"></span></button>

    <p style="text-align:center;font-size:11px;color:#999;margin-top:8px;">Paiement sécurisé · Stripe PCI-DSS Level 1</p>

    <!-- Succès -->
    <div id="mb-pay-success" style="display:none;text-align:center;padding:1.5rem 0;">
      <div style="font-size:40px;margin-bottom:8px;">✅</div>
      <p style="font-size:15px;font-weight:600;margin-bottom:4px;">Paiement confirmé</p>
      <p id="mb-pay-success-msg" style="font-size:13px;color:#555;"></p>
      <button onclick="closeMbPay()" style="margin-top:14px;padding:8px 20px;border:1px solid #ddd;border-radius:8px;background:#f5f5f5;cursor:pointer;font-size:13px;">Fermer</button>
    </div>
  </div>
</div>

<script>
(function () {
  const STRIPE_PUBLIC_KEY = "pk_live_UvX0sGXQy0cn7zzNPlgepv9G00CCIwB4as";
  const WORKER_URL = "https://mobilea-stripe.mus-akdogan.workers.dev/create-payment-intent";
  // Exposé pour la page « Mes cartes » (réutilise la même clé publiable).
  try { window.MOBILEA_STRIPE_PK = STRIPE_PUBLIC_KEY; } catch(e){}
  // Jeton de la personne connectée : le Worker vérifie que la course lui
  // appartient et que le montant correspond au prix de la course.
  async function _stripeIdToken(){
    try { return (window.fbAuth && window.fbAuth.currentUser) ? await window.fbAuth.currentUser.getIdToken() : null; } catch(e){ return null; }
  }

  let stripe, cardElement, currentCourse = {};

  let paymentRequest = null;

  function initStripe() {
    if (stripe) return;
    stripe = Stripe(STRIPE_PUBLIC_KEY);
    const elements = stripe.elements();
    cardElement = elements.create("card", {
      style: { base: { fontSize: "15px", color: "#1a1a1a", fontFamily: "system-ui, sans-serif", "::placeholder": { color: "#aaa" } }, invalid: { color: "#e53935" } },
      hidePostalCode: true,
    });
    cardElement.mount("#mb-card-element");
    cardElement.on("change", (e) => { document.getElementById("mb-card-errors").textContent = e.error ? e.error.message : ""; });
  }

  async function initPaymentRequest(amount) {
    if(!stripe) stripe = Stripe(STRIPE_PUBLIC_KEY);

    paymentRequest = stripe.paymentRequest({
      country: 'FR',
      currency: 'eur',
      total: {
        label: currentCourse.desc || 'Course MOBILEA',
        amount: Math.round(amount * 100),
      },
      requestPayerName: true,
      requestPayerEmail: false,
    });

    const canMake = await paymentRequest.canMakePayment();
    const wrap = document.getElementById('mb-payment-request-wrap');
    const btnContainer = document.getElementById('mb-payment-request-btn');

    if(canMake) {
      // Apple Pay ou Google Pay disponible
      wrap.style.display = 'block';
      btnContainer.innerHTML = '';
      const prButton = stripe.elements().create('paymentRequestButton', {
        paymentRequest,
        style: {
          paymentRequestButton: {
            type: 'default',
            theme: 'dark',
            height: '48px',
          },
        },
      });
      prButton.mount('#mb-payment-request-btn');

      paymentRequest.on('paymentmethod', async (ev) => {
        try {
          const res = await fetch(WORKER_URL, {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken: await _stripeIdToken(), amount: currentCourse.amount, courseId: currentCourse.courseId, clientName: currentCourse.clientName }),
          });
          const data = await res.json();
          if(!res.ok) { ev.complete('fail'); throw new Error(data.error); }

          const { error, paymentIntent } = await stripe.confirmCardPayment(
            data.clientSecret,
            { payment_method: ev.paymentMethod.id },
            { handleActions: false }
          );

          if(error) { ev.complete('fail'); document.getElementById('mb-card-errors').textContent = error.message; return; }

          if(paymentIntent.status === 'requires_action') {
            const { error: actionError } = await stripe.confirmCardPayment(data.clientSecret);
            if(actionError) { ev.complete('fail'); return; }
          }

          ev.complete('success');
          await onPaymentSuccess(paymentIntent);
        } catch(err) {
          ev.complete('fail');
          document.getElementById('mb-card-errors').textContent = 'Erreur : ' + err.message;
        }
      });
    } else {
      wrap.style.display = 'none';
    }
  }

  function initPayPal(amount) {
    const container = document.getElementById('mb-paypal-btn');
    if(!container) return;
    container.innerHTML = ''; // Reset

    if(typeof paypal_sdk === 'undefined') {
      document.getElementById('mb-paypal-wrap').style.display = 'none';
      return;
    }

    document.getElementById('mb-paypal-wrap').style.display = 'block';

    paypal_sdk.Buttons({
      style: {
        layout: 'horizontal',
        color: 'gold',
        shape: 'rect',
        label: 'paypal',
        height: 44,
        tagline: false,
      },
      createOrder: async function(data, actions) {
        return actions.order.create({
          purchase_units: [{
            amount: {
              currency_code: 'EUR',
              value: currentCourse.amount.toFixed(2),
            },
            description: currentCourse.desc || 'Course MOBILEA',
            custom_id: currentCourse.courseId,
          }],
        });
      },
      onApprove: async function(data, actions) {
        const order = await actions.order.capture();
        // Mettre à jour la course dans Realtime Database (comme le reste de l'app)
        try {
          await fbUpdate('courses', currentCourse.courseId, {
            paiement_statut: 'payé',
            paypal_order_id: order.id,
            paiement_methode: 'paypal',
            paiement_date: new Date().toISOString(),
          });
        } catch(e) { console.warn('MAJ paiement:', e); }
        const fmt = new Intl.NumberFormat('fr-FR',{style:'currency',currency:'EUR'}).format(currentCourse.amount);
        document.getElementById('mb-pay-success-msg').textContent = fmt + ' · ' + currentCourse.courseId + ' · PayPal ✓';
        [...document.querySelectorAll('#mb-pay-overlay > div > *')].forEach(el => {
          if(el.id === 'mb-pay-success') el.style.display = 'block'; else el.style.display = 'none';
        });
        if(typeof loadAll==='function') loadAll();
        if(typeof currentCourse.onPaid === 'function') { try { currentCourse.onPaid(); } catch(e){} currentCourse.onPaid = null; }
      },
      onError: function(err) {
        document.getElementById('mb-card-errors').textContent = 'Erreur PayPal. Veuillez réessayer ou payer par carte.';
        console.error('PayPal error:', err);
      },
      onCancel: function() {
        document.getElementById('mb-card-errors').textContent = 'Paiement PayPal annulé.';
      },
    }).render('#mb-paypal-btn');
  }

  async function onPaymentSuccess(paymentIntent) {
    try {
      await fbUpdate('courses', currentCourse.courseId, {
        paiement_statut: 'payé',
        stripe_payment_intent: paymentIntent.id,
        paiement_methode: 'carte',
        paiement_date: new Date().toISOString(),
      });
    } catch(e) { console.warn('MAJ paiement:', e); }
    const fmt = new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(currentCourse.amount);
    document.getElementById("mb-pay-success-msg").textContent = fmt + " · " + currentCourse.courseId + " · " + paymentIntent.id.slice(0,16) + "…";
    [...document.querySelectorAll("#mb-pay-overlay > div > *")].forEach(el => {
      if (el.id === "mb-pay-success") el.style.display = "block"; else el.style.display = "none";
    });
    if(typeof loadAll==='function') loadAll();
    // Paiement confirmé → lancer l'envoi de la course au chauffeur si un
    // callback a été fourni (cas réservation avec paiement en ligne d'abord)
    if(typeof currentCourse.onPaid === 'function') { try { currentCourse.onPaid(); } catch(e){} currentCourse.onPaid = null; }
  }

  window.openStripePayment = function ({ courseId, clientName, amount, desc, onPaid, preferPaypal }) {
    currentCourse = { courseId, clientName, amount, desc, onPaid, preferPaypal };
    const fmt = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(amount);
    document.getElementById("mb-pay-desc").textContent = desc ?? courseId;
    document.getElementById("mb-pay-amt").textContent = fmt;
    document.getElementById("mb-pay-btn-amt").textContent = fmt;
    document.getElementById("mb-pay-btn").disabled = false;
    document.getElementById("mb-pay-btn").innerHTML = "🔒 Payer " + fmt;
    document.getElementById("mb-card-errors").textContent = "";
    document.getElementById("mb-pay-success").style.display = "none";
    [...document.querySelectorAll("#mb-pay-overlay > div > *")].forEach(el => {
      if (el.id === "mb-pay-success") el.style.display = "none";
      else el.style.removeProperty("display");
    });
    document.getElementById("mb-pay-overlay").style.display = "flex";
    setTimeout(async () => {
      initStripe();
      await initPaymentRequest(currentCourse.amount);
      initPayPal(currentCourse.amount);
    }, 50);
  };

  window.closeMbPay = function () {
    document.getElementById("mb-pay-overlay").style.display = "none";
    // Si le client ferme sans avoir payé (un callback onPaid est encore en
    // attente), la course reste créée mais "en attente de paiement" et n'est
    // PAS envoyée au chauffeur. On l'informe qu'il peut reprendre le paiement
    // depuis son espace (bouton "Payer maintenant" sur la course).
    if(currentCourse && typeof currentCourse.onPaid === 'function') {
      currentCourse.onPaid = null;
      showToast('Paiement non finalisé — reprenez-le depuis « Mon espace »', true);
      if(typeof loadAll==='function') loadAll();
    }
  };

  window.submitMbPay = async function () {
    const btn = document.getElementById("mb-pay-btn");
    btn.disabled = true; btn.textContent = "⏳ Traitement…";
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: await _stripeIdToken(), amount: currentCourse.amount, courseId: currentCourse.courseId, clientName: currentCourse.clientName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Erreur Worker");
      const { error, paymentIntent } = await stripe.confirmCardPayment(data.clientSecret, {
        payment_method: { card: cardElement, billing_details: { name: currentCourse.clientName } },
      });
      if (error) {
        document.getElementById("mb-card-errors").textContent = error.message;
        btn.disabled = false;
        btn.innerHTML = "🔒 Payer " + new Intl.NumberFormat("fr-FR",{style:"currency",currency:"EUR"}).format(currentCourse.amount);
        return;
      }
      if (paymentIntent.status === "succeeded") {
        await onPaymentSuccess(paymentIntent);
      }
    } catch (err) { document.getElementById("mb-card-errors").textContent = "Erreur : " + err.message; btn.disabled = false; }
  };
})();

// MOBILEA — toggle champ montant Stripe dans le modal réservation
document.addEventListener('change', function(e) {
  if(e.target && e.target.id === 'cb-paiement-ligne') {
    const wrap = document.getElementById('cb-prix-wrap');
    if(wrap) wrap.style.display = e.target.checked ? 'block' : 'none';
  }
});

// ═══════════════════════════════════════════════════════════
// MOBILEA — Google Places Autocomplete (style Uber)
// ═══════════════════════════════════════════════════════════

const PLACES_FIELDS = [
  'cb-dep', 'cb-arr',   // modal réservation dispatch
  'fc-dep', 'fc-arr',   // formulaire course admin
  'gn-dep', 'gn-arr',   // formulaire gérant "Nouveau transfert"
];

// Appelé par onload du script Google Maps
window.initPlacesAutocomplete = function() {
  if(typeof google === 'undefined' || !google.maps || !google.maps.places) return;

  // Attacher sur les champs déjà présents dans le DOM
  PLACES_FIELDS.forEach(attachPlaces);

  // MutationObserver — pour les champs dans les modals (ouverts après le chargement)
  const observer = new MutationObserver(function(mutations) {
    let needsCheck = false;
    mutations.forEach(m => { if(m.addedNodes.length || m.attributeName === 'style') needsCheck = true; });
    if(!needsCheck) return;
    PLACES_FIELDS.forEach(function(id) {
      const el = document.getElementById(id);
      if(el && !el.dataset.placesReady) attachPlaces(id);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
};

// Réattacher quand un modal s'ouvre (appelé par openMo existant)
const _origOpenMo = window.openMo;
window.openMo = function(n) {
  if(_origOpenMo) _origOpenMo(n);
  setTimeout(function() {
    if(typeof google !== 'undefined' && google.maps && google.maps.places) {
      PLACES_FIELDS.forEach(function(id) {
        const el = document.getElementById(id);
        if(el && !el.dataset.placesReady) attachPlaces(id);
      });
    }
  }, 150);
};

function attachPlaces(id) {
  const el = document.getElementById(id);
  if(!el || el.dataset.placesReady) return;

  // Vérifier que l'élément est bien dans le DOM et visible
  if(!document.contains(el)) return;

  el.dataset.placesReady = '1';

  // Empêcher le navigateur d'afficher ses propres suggestions
  el.setAttribute('autocomplete', 'off');
  
  // Au focus : s'assurer que le pac-container est enfant direct du body (pas du modal)
  el.addEventListener('focus', function() {
    setTimeout(function() {
      const pac = document.querySelector('.pac-container');
      if(pac && pac.parentElement !== document.body) {
        document.body.appendChild(pac);
      }
      if(pac) {
        pac.style.setProperty('z-index', '2147483647', 'important');
        pac.style.setProperty('pointer-events', 'auto', 'important');
      }
    }, 50);
  });

  const ac = new google.maps.places.Autocomplete(el, {
    fields: ['formatted_address', 'name', 'geometry'],
    types: ['geocode', 'establishment'],
    // Pas de restriction de pays — monde entier comme Uber
  });

  // Bias géographique vers Île-de-France (sans restreindre)
  const bounds = new google.maps.LatLngBounds(
    new google.maps.LatLng(48.1, 1.4),
    new google.maps.LatLng(49.2, 3.6)
  );
  ac.setBounds(bounds);

  // Forcer le z-index du pac-container après chaque frappe
  el.addEventListener('input', function() {
    // Si cet événement 'input' vient d'une sélection de suggestion, on ne
    // force PAS la réouverture du dropdown (sinon il reste affiché après le choix)
    if(el.dataset.suppressPac === '1') { el.dataset.suppressPac = ''; return; }
    // Saisie manuelle → les coordonnées mémorisées ne sont plus valides.
    el.dataset.lat = ''; el.dataset.lng = '';
    setTimeout(function() {
      document.querySelectorAll('.pac-container').forEach(function(pac) {
        if(pac.parentElement !== document.body) document.body.appendChild(pac);
        pac.style.setProperty('z-index', '2147483647', 'important');
        pac.style.setProperty('pointer-events', 'auto', 'important');
        pac.style.setProperty('display', 'block', 'important');
        pac.style.setProperty('visibility', 'visible', 'important');
      });
    }, 100);
  });

  // Sélection d'une suggestion
  ac.addListener('place_changed', function() {
    const place = ac.getPlace();
    // Mémoriser les coordonnées GPS du lieu choisi (pour le dispatch au plus
    // proche / calcul de distance), sur l'input lui-même.
    try {
      if(place.geometry && place.geometry.location){
        el.dataset.lat = String(place.geometry.location.lat());
        el.dataset.lng = String(place.geometry.location.lng());
      }
    } catch(e){}
    const addr = place.formatted_address || place.name || '';
    if(addr) {
      el.value = addr;
      // Empêche le listener 'input' ci-dessus de rouvrir le dropdown juste après la sélection
      el.dataset.suppressPac = '1';
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }
    // Fermer immédiatement la liste de suggestions
    document.querySelectorAll('.pac-container').forEach(function(pac) {
      pac.style.setProperty('display', 'none', 'important');
      pac.style.setProperty('visibility', 'hidden', 'important');
    });
    el.blur();
  });

  // Empêcher "Entrée" de soumettre le formulaire quand le dropdown est ouvert
  el.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') {
      const pac = document.querySelector('.pac-container');
      if(pac && pac.style.display !== 'none') e.preventDefault();
    }
  });

  // Filet de securite : quand on quitte le champ, masquer tout conteneur de
  // suggestions vide/residuel (evite la barre noire qui reste affichee).
  el.addEventListener('blur', function() {
    setTimeout(function() {
      document.querySelectorAll('.pac-container').forEach(function(pac) {
        if(!pac.querySelector('.pac-item')) {
          pac.style.setProperty('display', 'none', 'important');
        }
      });
    }, 250);
  });
}

// Style CSS pour le dropdown Places
(function() {
  const s = document.createElement('style');
  s.textContent = `
    .pac-container { background:#1a1d27!important; border:1px solid rgba(255,255,255,0.1)!important; border-radius:8px!important; box-shadow:0 8px 32px rgba(0,0,0,0.5)!important; font-family:'DM Sans',sans-serif!important; z-index:2147483647!important; margin-top:4px!important; pointer-events:auto!important; }
    /* Masquer le conteneur quand il est vide (evite une barre noire residuelle sous le champ) */
    .pac-container:empty { display:none!important; border:none!important; box-shadow:none!important; background:transparent!important; }
    .pac-container:not(:has(.pac-item)) { display:none!important; border:none!important; box-shadow:none!important; }
    .pac-container * { pointer-events:auto!important; }
    .pac-item { background:#1a1d27!important; border-top:1px solid rgba(255,255,255,0.05)!important; color:#ccc!important; padding:10px 14px!important; cursor:pointer!important; font-size:13px!important; }
    .pac-item:hover, .pac-item-selected { background:#2a2d3a!important; }
    .pac-item-query { color:#fff!important; font-size:13px!important; font-weight:500!important; }
    .pac-matched { color:var(--gold, #c8a96e)!important; font-weight:600!important; }
    .pac-icon { display:none!important; }
    .hdpi .pac-icon { display:none!important; }
    .pac-logo:after { display:none!important; }
  `;
  document.head.appendChild(s);
})();
</script>

<!-- Pont natif (Capacitor) : ne s'active que dans l'app native, ignoré en web -->
<script src="native-bridge.js"></script>


      <!-- IA TÉLÉPHONIQUE -->
      <style>
  /* IA Téléphonique — responsive compact */
  #page-aiphone .aip-wrap { padding: 14px; }
  #page-aiphone .aip-head { display:flex; flex-wrap:wrap; gap:12px; justify-content:space-between; align-items:flex-start;
    background:var(--card2,#141618); border:1px solid var(--border); border-radius:12px; padding:14px; margin-bottom:12px; }
  #page-aiphone .aip-head h2 { font-family:'Syne',sans-serif; font-size:16px; font-weight:800; color:var(--gold); margin:0; }
  #page-aiphone .aip-head p  { font-size:11.5px; color:var(--muted); margin:4px 0 0; line-height:1.4; }
  #page-aiphone .aip-ctrl { display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
  #page-aiphone .aip-toggle { border:0; border-radius:999px; padding:9px 14px; font-weight:800; font-size:12px; cursor:pointer; background:#2ecc8a; color:#111; }
  #page-aiphone .aip-pill { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; font-size:11px; font-weight:700; }
  #page-aiphone .aip-kpis { display:grid; grid-template-columns:repeat(4,1fr); gap:8px; margin-bottom:12px; }
  #page-aiphone .aip-kpi { padding:10px 12px; border-radius:10px; background:var(--card2,#141618); border:1px solid var(--border); }
  #page-aiphone .aip-kpi b { display:block; font-size:20px; font-weight:800; }
  #page-aiphone .aip-kpi span { font-size:10.5px; color:var(--muted); display:block; margin-top:2px; }
  #page-aiphone .aip-grid { display:grid; grid-template-columns:1.1fr .9fr; gap:12px; }
  #page-aiphone .aip-card { background:var(--card); border:1px solid var(--border); border-radius:12px; padding:14px; min-width:0; }
  #page-aiphone .aip-card h3 { margin:0 0 10px; font-size:14px; font-weight:800; }
  #page-aiphone .aip-card .fld input, #page-aiphone .aip-card .fld textarea, #page-aiphone .aip-card .fld select { font-size:13px; }
  #page-aiphone .aip-actions { display:flex; gap:6px; flex-wrap:wrap; margin-top:10px; }
  #page-aiphone .aip-actions .btn { font-size:11.5px; padding:7px 11px; }
  #page-aiphone #aip-log, #page-aiphone #aip-msg-log { max-height:220px; overflow:auto; }
  @media(max-width: 760px) {
    #page-aiphone .aip-head { flex-direction:column; }
    #page-aiphone .aip-ctrl { width:100%; }
    #page-aiphone .aip-kpis { grid-template-columns:repeat(2,1fr); }
    #page-aiphone .aip-grid { grid-template-columns:1fr; }
    #page-aiphone .aip-card { padding:12px; }
    #page-aiphone .sec { margin:0; }
  }
</style>
<div class="page" id="page-aiphone">
        <div class="sec aip-wrap" style="max-width:1180px;margin:0">
          <div class="sec-h"><div class="sec-t"><i class="fas fa-phone-volume"></i> IA Téléphonique</div></div>
          <div style="padding:12px">
            <div class="aip-head">
              <div style="min-width:0;flex:1">
                <h2>🤖 Assistant IA Deloitte MOBILEA</h2>
                <p>Appels, SMS et WhatsApp — Deloitte University uniquement. Regroupement auto, validation dispatch avant SMS.</p>
              </div>
              <div class="aip-ctrl">
                <button id="aip-toggle" class="aip-toggle" onclick="mobileaAiPhoneToggle()">IA ACTIVE</button>
                <div id="aip-status" class="aip-pill" style="background:rgba(148,163,184,.15);color:var(--muted)"><span style="width:8px;height:8px;border-radius:50%;background:var(--muted)"></span><span id="aip-status-text">Non configuré</span></div>
              </div>
            </div>
            <div class="aip-kpis">
              <div class="aip-kpi"><b id="aip-k-calls">0</b><span>Appels (90j)</span></div>
              <div class="aip-kpi"><b id="aip-k-reser">0</b><span>Demandes créées</span></div>
              <div class="aip-kpi"><b id="aip-k-hand">0</b><span>Transferts humain</span></div>
              <div class="aip-kpi"><b style="color:var(--orange,#f59e0b)" id="aip-k-pend">0</b><span>À valider</span></div>
            </div>
            <div class="aip-grid">
              <div class="aip-card">
                <h3>Configuration</h3>
                <div class="fg2">
                  <div class="fld"><label>URL du Worker IA</label><input id="aip-worker" placeholder="https://mobilea-ai-phone.mus-akdogan.workers.dev"></div>
                  <div class="fld"><label>Clé tableau de bord (DASHBOARD_SECRET)</label><input id="aip-key" type="password" autocomplete="off" placeholder="Secret admin configuré dans le Worker"></div>
                </div>
                <div class="fg2">
                  <div class="fld"><label>Numéro Twilio (affichage)</label><input id="aip-number" placeholder="+33 1 …"></div>
                  <div class="fld"><label>Numéro de transfert humain</label><input id="aip-handoff" placeholder="+33 …"></div>
                </div>
                <div class="aip-actions">
                  <button class="btn btn-p btn-sm" onclick="mobileaAiPhoneSave()"><i class="fas fa-save"></i> Enregistrer</button>
                  <button class="btn btn-sm" onclick="mobileaAiPhoneTest()"><i class="fas fa-plug"></i> Tester</button>
                  <button class="btn btn-ghost btn-sm" onclick="mobileaAiPhoneTestFare()"><i class="fas fa-calculator"></i> Tarif</button>
                  <button class="btn btn-ghost btn-sm" onclick="mobileaAiPhoneLoad()"><i class="fas fa-sync"></i> Refresh</button>
                </div>
                <div id="aip-msg" style="margin-top:10px;font-size:12px;color:var(--muted);min-height:16px"></div>
              </div>
              <div class="aip-card">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;gap:8px">
                  <h3 style="margin:0">💬 Messagerie Deloitte</h3>
                  <span style="font-size:11px;color:var(--muted)" id="aip-msg-count">—</span>
                </div>
                <div id="aip-msg-log" style="max-height:260px;overflow:auto;border:1px solid var(--border);border-radius:10px;padding:8px;margin-bottom:10px"><div style="color:var(--muted);font-size:12px">Chargement…</div></div>
                <div style="display:flex;gap:6px"><input id="aip-msg-to" placeholder="Numéro destinataire" style="flex:1;background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--white);font-size:12px"><select id="aip-msg-ch" style="background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--white);font-size:12px"><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option></select></div>
                <textarea id="aip-msg-txt" placeholder="Votre réponse…" style="width:100%;box-sizing:border-box;background:var(--dark);border:1px solid var(--border);border-radius:8px;padding:8px;color:var(--white);font-size:12px;margin-top:6px;min-height:60px"></textarea>
                <button class="btn btn-p btn-sm" style="margin-top:6px" onclick="mobileaAiSendMsg()"><i class="fas fa-paper-plane"></i> Envoyer</button>
                <hr style="border:none;border-top:1px solid var(--border);margin:14px 0">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                  <h3 style="margin:0;font-size:15px;font-weight:800">Derniers appels</h3>
                  <span style="font-size:11px;color:var(--muted)">90 j · auto 30 s</span>
                </div>
                <div id="aip-log" style="max-height:260px;overflow:auto"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
<script>
/* ─── Pile dispatch : propositions de changement émises par l'IA téléphonique ─── */
(function(){
  function cfg(){ try { return JSON.parse(localStorage.getItem('mobilea_aip_cfg_v1')||'{}'); } catch(e){ return {}; } }
  function H(){ return { 'x-mobilea-key': cfg().key||'' }; }
  function esc(x){ return String(x==null?'':x).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function fdt(iso){ if(!iso) return ''; try { return new Date(iso).toLocaleString('fr-FR',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}); } catch(e){ return iso; } }

  async function fbPatch(path, data){
    var token = (typeof getAuthToken==='function') ? await getAuthToken() : '';
    var u = FB_URL + '/' + path + '.json' + (token?('?auth='+token):'');
    var r = await fetch(u, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify(data) });
    if(!r.ok) throw new Error('fbPatch '+r.status);
    try { fbInvalidate(path.split('/')[0]); } catch(e){}
    return await r.json().catch(function(){return{};});
  }

  async function sendSmsViaWorker(to, message){
    var c = cfg(); if(!c.worker || !to) return { ok:false, error:'Worker non configuré ou numéro manquant' };
    try {
      var r = await fetch(c.worker + '/api/send-sms', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, H()), body: JSON.stringify({ to:to, message:message }) });
      return await r.json().catch(function(){return{ok:false,error:'reponse invalide'}});
    } catch(e){ return { ok:false, error:String(e&&e.message||e) }; }
  }

  window.aipPendingLoad = async function(){
    try {
      var list = await fbGet('pending_changes') || [];
      var pending = (Array.isArray(list)?list:[]).filter(function(x){ return x && x.statut==='a_valider'; });
      var wrap = document.getElementById('aip-pending-wrap'); if(!wrap) return;
      wrap.style.display = pending.length ? 'block' : 'none';
      var cnt = document.getElementById('aip-pending-count'); if(cnt) cnt.textContent = pending.length;
      var box = document.getElementById('aip-pending-list'); if(!box) return;
      if(!pending.length){ box.innerHTML=''; return; }
      box.innerHTML = pending.map(function(pc){
        var labels = { reschedule:'🕐 Changement d\'horaire', add_to_shared:'🚗 Rejoindre un transfert partagé', cancel:'🗑️ Annulation' };
        var who = (pc.requestedByName||pc.requestedByPhone||'Appelant') + (pc.requestedBySociete?' · '+pc.requestedBySociete:'');
        var dets = '';
        if(pc.type==='reschedule') dets = 'Course '+esc((pc.courseId||'').slice(0,6))+' → <b>'+esc(fdt(pc.newDatetime))+'</b>';
        else if(pc.type==='add_to_shared') dets = 'Ajouter au transfert <b>'+esc((pc.targetCourseId||'').slice(0,6))+'</b> ('+(pc.passengers||1)+' passager'+((pc.passengers||1)>1?'s':'')+')';
        else if(pc.type==='cancel') dets = 'Annuler la course '+esc((pc.courseId||'').slice(0,6));
        return '<div style="padding:12px;background:var(--card,#111);border:1px solid var(--border);border-radius:10px;display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap">'
          + '<div style="flex:1;min-width:220px">'
          +   '<div style="font-weight:700;font-size:13px">'+esc(labels[pc.type]||pc.type)+'</div>'
          +   '<div style="font-size:12px;color:var(--muted);margin:2px 0">'+esc(who)+' · '+esc(fdt(pc.createdAt))+'</div>'
          +   '<div style="font-size:12px">'+dets+'</div>'
          +   (pc.reason?'<div style="font-size:11px;color:var(--muted);margin-top:4px;font-style:italic">« '+esc(pc.reason)+' »</div>':'')
          + '</div>'
          + '<div style="display:flex;gap:6px;align-items:flex-start">'
          +   '<button class="btn btn-p btn-sm" onclick="aipPendingValidate(\''+pc._id+'\')"><i class="fas fa-check"></i> Valider</button>'
          +   '<button class="btn btn-ghost btn-sm" onclick="aipPendingReject(\''+pc._id+'\')"><i class="fas fa-times"></i> Refuser</button>'
          + '</div>'
          + '</div>';
      }).join('');
    } catch(e){ /* silencieux */ }
  };

  window.aipPendingValidate = async function(id){
    var all = await fbGet('pending_changes') || {};
    var pc = (Array.isArray(all)?all:[]).find(function(x){return x && x._id===id;});
    if(!pc){ showToast && showToast('Demande introuvable', true); return; }
    try {
      // 1) Appliquer la modification SUR la course concernée
      if(pc.type==='reschedule' && pc.courseId && pc.newDatetime){
        await fbUpdate('courses', pc.courseId, { datetime: pc.newDatetime, statutModifLe: new Date().toISOString(), modifParIa: true });
      }
      else if(pc.type==='add_to_shared' && pc.targetCourseId){
        var cs = await fbGet('courses') || [];
        var target = (Array.isArray(cs)?cs:[]).find(function(x){return x && x._id===pc.targetCourseId;});
        if(target){
          var newPax = (parseInt(target.pax,10)||1) + (parseInt(pc.passengers,10)||1);
          var cap = { berline:3, business:3, van:7 }[target.vehicule||'berline'] || 3;
          if(newPax > cap){ showToast && showToast('Capacité du véhicule dépassée ('+newPax+'/'+cap+')', true); return; }
          var passager = { prenom:(pc.requestedByName||'').split(' ')[0]||'', nom:(pc.requestedByName||'').split(' ').slice(1).join(' '), tel:pc.requestedByPhone||'', ajouteParIa:true };
          var passagers = Array.isArray(target.passagers)?target.passagers.slice():[];
          passagers.push(passager);
          await fbUpdate('courses', pc.targetCourseId, { pax: newPax, passagers: passagers, partageModifLe: new Date().toISOString(), modifParIa: true });
        }
      }
      else if(pc.type==='cancel' && pc.courseId){
        await fbUpdate('courses', pc.courseId, { statut:'annulee', annuleeLe:new Date().toISOString(), modifParIa:true });
      }
      // 2) Marquer la proposition validée
      await fbPatch('pending_changes/'+id, { statut:'validee', valideeLe:new Date().toISOString(), valideePar:(SESSION&&SESSION.name)||'dispatch' });
      // 3) Envoyer le SMS de confirmation
      var sms = '';
      if(pc.type==='reschedule') sms = 'MOBILEA : votre course est confirmée pour ' + (pc.newDatetime? new Date(pc.newDatetime).toLocaleString('fr-FR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}):'(horaire mis à jour)') + '. Un chauffeur vient vous chercher.';
      else if(pc.type==='add_to_shared') sms = 'MOBILEA : vous êtes bien ajouté(e) à notre transfert partagé. Un chauffeur vient vous chercher à l\'heure convenue. Détails à suivre.';
      else if(pc.type==='cancel') sms = 'MOBILEA : votre course est annulée comme demandé. À très vite.';
      if(sms && pc.requestedByPhone){
        var r = await sendSmsViaWorker(pc.requestedByPhone, sms);
        if(!r.ok){ showToast && showToast('Modif validée mais SMS KO : '+(r.error||'erreur'), true); }
        else { showToast && showToast('✓ Validée et SMS envoyé', false); }
      } else { showToast && showToast('✓ Validée (pas de SMS envoyé — numéro ou texte manquant)', false); }
      aipPendingLoad();
      if(typeof renderAll==='function') renderAll();
    } catch(e){ showToast && showToast('Erreur : '+(e&&e.message||e), true); }
  };

  window.aipPendingReject = async function(id){
    if(!confirm('Refuser cette demande ? Un SMS d\'excuses sera envoyé au client.')) return;
    var all = await fbGet('pending_changes') || {};
    var pc = (Array.isArray(all)?all:[]).find(function(x){return x && x._id===id;});
    if(!pc) return;
    try {
      await fbPatch('pending_changes/'+id, { statut:'refusee', refuseeLe:new Date().toISOString(), refuseePar:(SESSION&&SESSION.name)||'dispatch' });
      if(pc.requestedByPhone){
        var sms = 'MOBILEA : nous ne pouvons pas accepter cette modification. Un conseiller vous rappelle rapidement.';
        await sendSmsViaWorker(pc.requestedByPhone, sms);
      }
      aipPendingLoad();
      showToast && showToast('Demande refusée + SMS envoyé');
    } catch(e){ showToast && showToast('Erreur : '+(e&&e.message||e), true); }
  };

  // Rafraîchir toutes les 20 s quand on est sur la page Dispatch
  setInterval(function(){
    try {
      var p = document.getElementById('page-dispatch');
      if(p && p.classList.contains('on') && SESSION && (SESSION.role==='admin' || SESSION.role==='dispatch')) {
        aipPendingLoad();
      }
    } catch(e){}
  }, 20000);
  // Et à l'arrivée sur la page via gp()
  var _oldGp = window.gp;
  if(typeof _oldGp === 'function') {
    window.gp = function(name, btn){
      try { _oldGp(name, btn); } catch(e){}
      if(name==='dispatch') setTimeout(function(){ try { aipPendingLoad(); } catch(e){} }, 500);
    };
  }
})();
</script>
<script>
(function(){
  var KEY='mobilea_aip_cfg_v1';
  function cfg(){ try { return JSON.parse(localStorage.getItem(KEY)||'{}'); } catch(e){ return {}; } }
  function v(id){ var e=document.getElementById('aip-'+id); return e?String(e.value||'').trim():''; }
  function H(){ return { 'x-mobilea-key': cfg().key||'' }; }
  function esc(x){ return String(x==null?'':x).replace(/[&<>"']/g,function(c){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function setMsg(t,ok){ var m=document.getElementById('aip-msg'); if(m){ m.textContent=t||''; m.style.color = ok===true?'var(--green,#2ecc8a)':(ok===false?'var(--red,#e74c3c)':'var(--muted)'); } }
  function setStatus(label, color){
    var el=document.getElementById('aip-status'); var tx=document.getElementById('aip-status-text');
    if(!el||!tx) return;
    tx.textContent = label;
    el.style.background = 'rgba('+color+',.15)';
    el.style.color = 'rgb('+color+')';
    var dot = el.querySelector('span'); if(dot) dot.style.background = 'rgb('+color+')';
  }
  window.mobileaAiPhoneOpen = function(){
    var c=cfg();
    ['worker','key','number','handoff'].forEach(function(k){ var e=document.getElementById('aip-'+k); if(e&&c[k]!=null) e.value=c[k]; });
    mobileaAiPhoneLoad();
  };
  window.mobileaAiPhoneSave = function(){
    var c = { worker:(v('worker')||'').replace(/\/$/,''), key:v('key'), number:v('number'), handoff:v('handoff') };
    localStorage.setItem(KEY, JSON.stringify(c));
    setMsg('Configuration enregistrée sur cet appareil. Les secrets restent dans le Worker.', true);
    mobileaAiPhoneLoad();
  };
  window.mobileaAiPhoneTest = async function(){
    var c=cfg(); if(!c.worker){ setMsg("Renseignez d'abord l'URL du Worker.", false); return; }
    setMsg('Test en cours…');
    try {
      var r = await fetch(c.worker+'/api/config', { headers: H() });
      var d = await r.json().catch(function(){return{}});
      if(r.status===403){ setMsg('Accès refusé : vérifiez la clé tableau de bord.', false); setStatus('Clé invalide','231,76,60'); return; }
      if(!r.ok){ setMsg('Worker injoignable ('+r.status+').', false); setStatus('Injoignable','148,163,184'); return; }
      var missing=[];
      if(!d.configured) missing.push('OPENAI_API_KEY');
      if(!d.firebase)   missing.push('compte Firebase ia_robot');
      if(!d.twilioSig)  missing.push('TWILIO_AUTH_TOKEN (prod)');
      if(missing.length){ setMsg('Worker OK mais manque : '+missing.join(', ')+'.', false); setStatus('Configuration incomplète','245,158,11'); return; }
      setMsg('Connexion OK ✓ · modèle '+(d.model||'?')+' · tarif '+(d.fare?'oui':'non')+' · push '+(d.push?'oui':'non'), true);
      setStatus('Opérationnel','46,204,138');
    } catch(e){ setMsg("Impossible de joindre le Worker : "+(e&&e.message||e), false); setStatus('Hors ligne','148,163,184'); }
  };
  window.mobileaAiPhoneTestFare = async function(){
    var c=cfg(); if(!c.worker){ setMsg("Renseignez d'abord l'URL du Worker.", false); return; }
    setMsg('Test tarif CDG T2 → Disneyland en van…');
    try {
      var r = await fetch(c.worker+'/api/test-fare', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, H()), body: JSON.stringify({ pickup:'CDG Terminal 2E, Roissy', dropoff:'Disneyland Paris', vehicle:'van' }) });
      var d = await r.json().catch(function(){return{}});
      if(!r.ok){ setMsg('Erreur tarif : '+r.status+' '+(d.error||''), false); return; }
      setMsg('Tarif indicatif van : '+(d.price_eur?d.price_eur+' €':'(forfait minimum)')+' · '+(d.distance_km?d.distance_km+' km':'')+' '+(d.duration_min?'· '+d.duration_min+' min':''), true);
    } catch(e){ setMsg("Erreur réseau tarif : "+(e&&e.message||e), false); }
  };
  window.mobileaAiPhoneLoad = async function(){
    var c=cfg(); if(!c.worker){ setStatus('Non configuré','148,163,184'); return; }
    var logs=[];
    try {
      var r = await fetch(c.worker+'/api/calls', { headers: H() });
      if(r.ok){ var d = await r.json(); logs = d.calls || []; }
    } catch(e){}
    var el;
    el=document.getElementById('aip-k-calls'); if(el) el.textContent = logs.length;
    el=document.getElementById('aip-k-reser'); if(el) el.textContent = logs.filter(function(x){ return x.intent==='reservation'; }).length;
    el=document.getElementById('aip-k-hand');  if(el) el.textContent = logs.filter(function(x){ return x.intent==='handoff'; }).length;
    try {
      var pending = (window.D && window.D.courses || []).filter(function(co){ return co && co.source==='ia-telephonique' && co.statut==='a_confirmer'; }).length;
      el=document.getElementById('aip-k-pend'); if(el) el.textContent = pending;
    } catch(e) { el=document.getElementById('aip-k-pend'); if(el) el.textContent = '—'; }
    var box = document.getElementById('aip-log'); if(!box) return;
    if(!logs.length){ box.innerHTML = '<div style="color:var(--muted);font-size:12px">Aucun appel enregistré.</div>'; return; }
    box.innerHTML = logs.slice(0,30).map(function(x){
      var color = x.intent==='reservation' ? 'var(--green,#2ecc8a)' : x.intent==='handoff' ? 'var(--orange,#f59e0b)' : 'var(--muted)';
      var tag = x.intent==='reservation' ? '📝 demande créée' : x.intent==='handoff' ? '👤 transfert humain' : '💬 information';
      return '<div style="padding:11px 0;border-bottom:1px solid var(--border);font-size:12px">'
        + '<div style="display:flex;justify-content:space-between;gap:10px"><strong>'+esc(x.phone||'(numéro inconnu)')+'</strong><span style="color:'+color+'">'+tag+'</span></div>'
        + '<div style="color:var(--muted);margin-top:2px">'+esc(String(x.time||'').replace('T',' ').slice(0,16))+(x.booking?' · demande '+esc(x.booking):'')+'</div>'
        + (x.summary?'<div style="color:var(--muted);margin-top:4px;line-height:1.4">'+esc(x.summary)+'</div>':'')
        + '</div>';
    }).join('');
  };
  window.mobileaAiPhoneToggle = async function(){
    var c=cfg(); if(!c.worker){ setMsg("URL du Worker manquante.", false); return; }
    try {
      var cur = await fetch(c.worker+'/api/state', { headers: H() });
      var cd = await cur.json().catch(function(){return{};});
      var active = !(cd && cd.state && cd.state.ia_active===false); // default true
      var r = await fetch(c.worker+'/api/state', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, H()), body: JSON.stringify({ ia_active: !active }) });
      if(!r.ok){ setMsg('Échec bascule : '+r.status, false); return; }
      var nd = await r.json(); mobileaAiPhoneRenderToggle(nd && nd.state && nd.state.ia_active !== false);
      setMsg('IA ' + (nd.state.ia_active===false?'désactivée (OFF)':'activée (ON)'), true);
    } catch(e){ setMsg('Erreur : '+e.message, false); }
  };
  window.mobileaAiPhoneRenderToggle = function(active){
    var b=document.getElementById('aip-toggle'); if(!b) return;
    if(active){ b.textContent='IA ACTIVE'; b.style.background='#2ecc8a'; b.style.color='#111'; }
    else{       b.textContent='IA DÉSACTIVÉE'; b.style.background='#e74c3c'; b.style.color='#fff'; }
  };
  window.mobileaAiSendMsg = async function(){
    var c=cfg(); if(!c.worker){ setMsg("URL du Worker manquante.", false); return; }
    var to=document.getElementById('aip-msg-to').value.trim();
    var ch=document.getElementById('aip-msg-ch').value;
    var txt=document.getElementById('aip-msg-txt').value.trim();
    if(!to||!txt){ setMsg("Numéro et texte requis.", false); return; }
    setMsg('Envoi en cours…');
    try {
      var r = await fetch(c.worker+'/api/send-sms', { method:'POST', headers: Object.assign({'Content-Type':'application/json'}, H()), body: JSON.stringify({ to:to, message:txt, whatsapp: ch==='whatsapp' }) });
      var d = await r.json().catch(function(){return{};});
      if(!r.ok || !d.ok){ setMsg('Erreur Twilio : '+(d.error||r.status), false); return; }
      setMsg('Message envoyé ('+ch+') ✓', true);
      document.getElementById('aip-msg-txt').value='';
      mobileaAiLoadMessages();
    } catch(e){ setMsg('Erreur : '+e.message, false); }
  };
  window.mobileaAiLoadMessages = async function(){
    var c=cfg(); if(!c.worker) return;
    try {
      var r = await fetch(c.worker+'/api/messages', { headers: H() });
      if(!r.ok) return;
      var d = await r.json(); var msgs = d.messages || [];
      var box = document.getElementById('aip-msg-log'); if(!box) return;
      var el=document.getElementById('aip-msg-count'); if(el) el.textContent = msgs.length + ' messages';
      if(!msgs.length){ box.innerHTML='<div style="color:var(--muted);font-size:12px">Aucun message.</div>'; return; }
      box.innerHTML = msgs.slice(0,40).map(function(m){
        var inOut = m.direction==='in' ? '◀' : '▶';
        var color = m.direction==='in' ? 'var(--gold,#c8a96e)' : 'var(--muted)';
        var ico = m.channel==='whatsapp' ? '🟢 WA' : '✉️ SMS';
        var who = m.direction==='in' ? (m.from||'(inconnu)') : (m.to||'');
        return '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:12px">'
          + '<div style="display:flex;justify-content:space-between;gap:8px"><strong style="color:'+color+'">'+inOut+' '+esc(who)+'</strong><span style="color:var(--muted)">'+ico+' · '+esc(String(m.at||'').replace('T',' ').slice(0,16))+'</span></div>'
          + '<div style="color:var(--white);margin-top:3px;white-space:pre-wrap">'+esc(m.text||'')+'</div>'
          + '</div>';
      }).join('');
    } catch(e){}
  };
  // Hook : à l'ouverture de la page IA, charge aussi les messages + état IA
  var _oldOpen = window.mobileaAiPhoneOpen;
  window.mobileaAiPhoneOpen = function(){
    try { _oldOpen && _oldOpen(); } catch(e){}
    mobileaAiLoadMessages();
    try {
      var c=cfg(); if(c.worker) fetch(c.worker+'/api/state', { headers: H() }).then(function(r){return r.json();}).then(function(d){
        if(d && d.state) mobileaAiPhoneRenderToggle(d.state.ia_active !== false);
      }).catch(function(){});
    } catch(e){}
  };
  setInterval(function(){ var p=document.getElementById('page-aiphone'); if(p && p.classList.contains('on')) { mobileaAiPhoneLoad(); mobileaAiLoadMessages(); } }, 30000);
})();
</script>

<nav id="dp-bottom-nav" role="navigation" aria-label="Navigation chauffeur">
  <button class="dp-tab on" data-dpnav="mescourses" onclick="dpGoTab(this,'mescourses')"><i class="fas fa-location-arrow"></i><span>Live</span></button>
  <button class="dp-tab" data-dpnav="dispatch" onclick="dpGoTab(this,'dispatch')"><i class="fas fa-hand-paper"></i><span>À Prendre</span></button>
  <button class="dp-tab" data-dpnav="mescourses2" onclick="dpGoTab(this,'mescourses')"><i class="fas fa-calendar-check"></i><span>Mes Jobs</span></button>
  <button class="dp-tab" data-dpnav="revenus" onclick="dpGoTab(this,'revenus')"><i class="fas fa-euro-sign"></i><span>Finance</span></button>
  <button class="dp-tab" data-dpnav="parametres" onclick="dpGoTab(this,'parametres')"><i class="fas fa-user"></i><span>Mon espace</span></button>
</nav>
<script>
(function(){
  window.dpGoTab = function(el, page){
    try { document.querySelectorAll('#dp-bottom-nav .dp-tab').forEach(function(b){ b.classList.remove('on'); }); if(el) el.classList.add('on'); } catch(e){}
    try { if (typeof gp === 'function') gp(page); } catch(e){}
  };
})();
</script>
</body>
</html>
