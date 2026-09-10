/*
 * native-bridge.js — Pont natif MOBILEA DISPATCH.
 *
 * Le dispatch ne roule pas : PAS de GPS en arrière-plan. On garde uniquement
 * les NOTIFICATIONS (OneSignal natif) pour recevoir les nouvelles demandes et
 * les alertes de zone, même app fermée.
 *
 * En web normal (hors app), ce fichier ne fait rien.
 */
(function () {
  function initWhenReady(tries) {
    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) {
      if ((tries || 0) < 40) { setTimeout(function(){ initWhenReady((tries||0)+1); }, 250); }
      return;
    }
    setupBridge(cap);
  }

  function setupBridge(cap) {
    // Signale à la page qu'on est en natif.
    try { document.documentElement.setAttribute("data-mobilea-native", "1"); } catch (e) {}

    // Le dispatch n'a pas de GPS : on expose MobileaNative avec des GPS no-op,
    // pour que l'index.html ne plante pas s'il appelle startGPS/stopGPS.
    window.MobileaNative = {
      isNative: true,
      startGPS: function(){ /* pas de GPS côté dispatch */ },
      stopGPS: function(){ /* pas de GPS côté dispatch */ },
      updateToken: function(){ /* rien */ }
    };

    // ── NOTIFICATIONS (OneSignal natif) ──────────────────────────────────
    var _osInit = false;

    // Initialiser OneSignal DÈS LE LANCEMENT (pas seulement après connexion).
    // Sinon iOS abandonne la demande de token push (« Apns Delegate Never
    // Fired »). Le login (external_id) se fera plus tard via mobileaLinkPush.
    (function initOneSignalNow(){
      try {
        var OS = (window.cordova && window.cordova.plugins && window.cordova.plugins.OneSignal)
               || (window.plugins && window.plugins.OneSignal)
               || window.OneSignal || null;
        if (OS && OS.default && typeof OS.initialize !== 'function'
            && (typeof OS.default.initialize === 'function' || OS.default.Notifications)) { OS = OS.default; }
        if (!OS) { setTimeout(initOneSignalNow, 400); return; }
        if (_osInit) return;
        _osInit = true;
        var APP_ID = "df716aa7-cc78-46f1-84ef-f95dc420d4b0";
        if (typeof OS.initialize === "function") {
          OS.initialize(APP_ID);
          if (OS.Notifications && OS.Notifications.requestPermission) {
            try { OS.Notifications.requestPermission(true); } catch(e){}
          }
        } else if (typeof OS.setAppId === "function") {
          OS.setAppId(APP_ID);
          if (OS.promptForPushNotificationsWithUserResponse) {
            try { OS.promptForPushNotificationsWithUserResponse(); } catch(e){}
          }
        }
      } catch(e){}
    })();

    window.mobileaLinkPush = function () {
      function pdiag(){} // diagnostic retiré (no-op) — les notifications marchent
      try {
        var OneSignal = (window.cordova && window.cordova.plugins && window.cordova.plugins.OneSignal)
                     || (window.plugins && window.plugins.OneSignal)
                     || window.OneSignal
                     || null;
        // Le plugin v5 expose parfois l'objet réel sous .default.
        if (OneSignal && OneSignal.default && typeof OneSignal.initialize !== 'function'
            && (typeof OneSignal.default.initialize === 'function' || OneSignal.default.Notifications)) {
          OneSignal = OneSignal.default;
        }
        if (!OneSignal) { pdiag('plugin OneSignal ABSENT', false); return; }
        var APP_ID = "df716aa7-cc78-46f1-84ef-f95dc420d4b0";
        var S = window.SESSION || {};
        var extId = S.uid ? ('staff_' + S.uid) : ('staff_' + (S.role || 'dispatch'));

        function doLogin() {
          try {
            if (OneSignal.login) { OneSignal.login(String(extId)); }
            else if (OneSignal.setExternalUserId) { OneSignal.setExternalUserId(String(extId)); }
            try {
              if (OneSignal.User && OneSignal.User.addTag) OneSignal.User.addTag('role', 'staff');
              else if (OneSignal.sendTag) OneSignal.sendTag('role', 'staff');
            } catch(e){}
            pdiag('login OK staff ' + String(extId).slice(0,10), true);
          } catch (e) { pdiag('login err: ' + e.message, false); }
        }

        if (!_osInit) {
          _osInit = true;
          try {
            if (typeof OneSignal.initialize === "function") {
              OneSignal.initialize(APP_ID);
              pdiag('init v5, demande permission...', true);
              if (OneSignal.Notifications && OneSignal.Notifications.requestPermission) {
                try {
                  var pr = OneSignal.Notifications.requestPermission(true);
                  if (pr && pr.then) { pr.then(function(acc){ pdiag('permission='+acc, !!acc); doLogin(); }).catch(function(){ doLogin(); }); }
                  else { setTimeout(doLogin, 1500); }
                } catch(e){ setTimeout(doLogin, 1500); }
              } else { setTimeout(doLogin, 1500); }
            } else if (typeof OneSignal.setAppId === "function") {
              OneSignal.setAppId(APP_ID);
              pdiag('init v4, demande permission...', true);
              if (typeof OneSignal.promptForPushNotificationsWithUserResponse === "function") {
                OneSignal.promptForPushNotificationsWithUserResponse(function(){ doLogin(); });
              } else { setTimeout(doLogin, 1500); }
            } else {
              var methodes = [];
              try { for (var k in OneSignal) { methodes.push(k); } } catch(e){}
              pdiag('API inconnue. Dispo: ' + methodes.slice(0,12).join(','), false);
            }
          } catch (e) { pdiag('erreur init: ' + e.message, false); }
        } else {
          doLogin();
        }
      } catch (e) { /* sans gravité */ }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){ initWhenReady(0); });
  } else {
    initWhenReady(0);
  }
})();
