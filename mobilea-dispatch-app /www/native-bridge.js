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
    window.mobileaLinkPush = function () {
      try {
        var OneSignal = (cap.plugins && cap.plugins.OneSignal)
                     || (window.cordova && window.cordova.plugins && window.cordova.plugins.OneSignal)
                     || (window.plugins && window.plugins.OneSignal)
                     || window.OneSignal
                     || null;
        // Le plugin v5 expose parfois l'objet réel sous .default.
        if (OneSignal && OneSignal.default && typeof OneSignal.initialize !== 'function'
            && (typeof OneSignal.default.initialize === 'function' || OneSignal.default.Notifications)) {
          OneSignal = OneSignal.default;
        }
        if (!OneSignal) { return; }
        var APP_ID = "85e71302-1646-456d-9db4-a1875bb7d25c";
        var S = window.SESSION || {};
        // Le dispatch/admin est ciblé par un external_id "staff_<uid|role>" et
        // le tag role=staff (comme le fait déjà ton index.html côté web).
        var extId = S.uid ? ('staff_' + S.uid) : ('staff_' + (S.role || 'dispatch'));

        function doLogin() {
          try {
            if (OneSignal.login) { OneSignal.login(String(extId)); }
            else if (OneSignal.setExternalUserId) { OneSignal.setExternalUserId(String(extId)); }
            try {
              if (OneSignal.User && OneSignal.User.addTag) OneSignal.User.addTag('role', 'staff');
              else if (OneSignal.sendTag) OneSignal.sendTag('role', 'staff');
            } catch(e){}
          } catch (e) {}
        }

        if (!_osInit) {
          _osInit = true;
          try {
            if (typeof OneSignal.initialize === "function") {
              OneSignal.initialize(APP_ID);
              if (OneSignal.Notifications && OneSignal.Notifications.requestPermission) {
                try {
                  var pr = OneSignal.Notifications.requestPermission(true);
                  if (pr && pr.then) { pr.then(function(){ doLogin(); }).catch(function(){ doLogin(); }); }
                  else { setTimeout(doLogin, 1500); }
                } catch(e){ setTimeout(doLogin, 1500); }
              } else { setTimeout(doLogin, 1500); }
            } else if (typeof OneSignal.setAppId === "function") {
              OneSignal.setAppId(APP_ID);
              if (typeof OneSignal.promptForPushNotificationsWithUserResponse === "function") {
                OneSignal.promptForPushNotificationsWithUserResponse(function(){ doLogin(); });
              } else { setTimeout(doLogin, 1500); }
            }
          } catch (e) {}
        } else {
          doLogin();
        }
      } catch (e) { /* sans gravité : le push web reste actif */ }
    };
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){ initWhenReady(0); });
  } else {
    initWhenReady(0);
  }
})();
