/*
 * native-bridge.js — Pont natif MOBILEA pour l'app Capacitor.
 *
 * Rôle : fournir window.MobileaNative.{startGPS, stopGPS, updateToken} que
 * ton index.html appelle déjà. Ici, ces fonctions pilotent le plugin
 * @capacitor-community/background-geolocation, qui suit la position même
 * écran éteint / app en arrière-plan (ce que @capacitor/geolocation ne fait
 * PAS — c'était la cause du GPS qui ne marchait pas).
 *
 * Ce fichier ne fait RIEN en web normal (hors app) : si Capacitor n'est pas
 * détecté, window.MobileaNative n'est pas défini, et ton index.html utilise
 * alors le GPS web habituel. Aucun effet de bord.
 *
 * À déployer : placer ce fichier à la racine de ton site (à côté de
 * index.html), pour que <script src="native-bridge.js"> le charge.
 */
(function () {
  // Bandeau de diagnostic visible à l'écran (temporaire) : montre si Capacitor
  // et le plugin GPS sont détectés dans l'app. À retirer une fois le GPS validé.
  // Attend que Capacitor soit injecté.
  function initWhenReady(tries) {
    var cap = window.Capacitor;
    if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) {
      if ((tries || 0) < 40) { setTimeout(function(){ initWhenReady((tries||0)+1); }, 250); return; }
      return;
    }
    setupBridge(cap);
  }

  function setupBridge(cap) {

  // Récupère le plugin de géoloc arrière-plan (nom exposé par le plugin
  // @capacitor-community/background-geolocation).
  function getBG() {
    return (cap.Plugins && cap.Plugins.BackgroundGeolocation)
        || window.BackgroundGeolocation
        || null;
  }

  var FB_URL = "https://simplycab-58808-default-rtdb.europe-west1.firebasedatabase.app";
  var MIN_INTERVAL_MS = 10000; // au plus une écriture toutes les 10 s

  var _chauffeurId = null;
  var _idToken = null;
  var _watcherId = null;
  var _lastSent = 0;

  // Écrit une position dans /chauffeurs/<id> via l'API REST Firebase.
  function pushPosition(lat, lng, acc, heading, speed) {
    if (!_chauffeurId || !_idToken) return;
    var now = Date.now();
    if (now - _lastSent < MIN_INTERVAL_MS) return;
    _lastSent = now;
    var url = FB_URL + "/chauffeurs/" + _chauffeurId + ".json?auth=" + encodeURIComponent(_idToken);
    var body = JSON.stringify({
      gps: {
        lat: lat, lng: lng, acc: Math.round(acc || 0),
        at: new Date().toISOString(),
        heading: (heading != null && !isNaN(heading)) ? Math.round(heading) : null,
        speed: (speed != null && !isNaN(speed)) ? Math.round(speed) : null
      },
      gpsActive: true
    });
    // fetch fonctionne dans la WebView Capacitor.
    fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: body })
      .catch(function () { /* perte réseau : on réessaiera au prochain point */ });
  }

  window.MobileaNative = {
    isNative: true,

    // Démarre le suivi GPS arrière-plan pour ce chauffeur.
    startGPS: function (chauffeurId, idToken) {
      _chauffeurId = chauffeurId;
      _idToken = idToken;
      var BG = getBG();
      if (!BG) { console.warn("[MobileaNative] plugin BackgroundGeolocation absent"); return; }

      // Si un watcher tourne déjà, on ne le double pas.
      if (_watcherId) return;

      BG.addWatcher(
        {
          // Message affiché dans la notification permanente (obligatoire).
          backgroundMessage: "Suivi de votre position pendant la course.",
          backgroundTitle: "MOBILEA — course en cours",
          requestPermissions: true,
          stale: false,
          distanceFilter: 20 // mètres entre deux points
        },
        function (location, error) {
          if (error) {
            if (error.code === "NOT_AUTHORIZED") {
              // L'utilisateur a refusé : on peut l'inviter à activer dans les réglages.
              if (window.confirm("MOBILEA a besoin de votre position pour le suivi des courses. Ouvrir les réglages ?")) {
                BG.openSettings();
              }
            }
            return;
          }
          if (location) {
            pushPosition(location.latitude, location.longitude, location.accuracy, location.bearing, location.speed);
          }
        }
      ).then(function (id) { _watcherId = id; });
    },

    // Arrête le suivi.
    stopGPS: function () {
      var BG = getBG();
      if (BG && _watcherId) {
        BG.removeWatcher({ id: _watcherId }).catch(function () {});
        _watcherId = null;
      }
    },

    // Rafraîchit le jeton Firebase (il expire ~1h ; la page le renvoie).
    updateToken: function (idToken) {
      _idToken = idToken;
    }
  };

  // Signale à la page qu'on est en natif (utile pour adapter l'UI si besoin).
  try { document.documentElement.setAttribute("data-mobilea-native", "1"); } catch (e) {}

  // Hook push natif (optionnel) : ton index.html appelle window.mobileaLinkPush()
  // pour lier les notifications au chauffeur connecté. En Capacitor, le push
  // passe par @capacitor/push-notifications (plugin natif). Ici on fournit un
  // point d'entrée neutre : il enregistre l'appareil au push si le plugin est
  // présent, sinon il ne fait rien (le push web OneSignal continue de marcher
  // dans la WebView). À enrichir plus tard si tu veux le push 100% natif.
  // Push natif iOS/Android via le plugin OneSignal (onesignal-cordova-plugin).
  // C'est LUI qui permet au chauffeur de recevoir les notifications de course
  // même app fermée. Le Web SDK OneSignal ne suffit pas dans une app native.
  // Appelé par index.html (window.mobileaLinkPush) une fois le chauffeur connu.
  var _osInit = false;
  window.mobileaLinkPush = function () {
    function pdiag(){} // diagnostic retiré (no-op)
    try {
      var OneSignal = (window.cordova && window.cordova.plugins && window.cordova.plugins.OneSignal)
                   || (window.plugins && window.plugins.OneSignal)
                   || null;
      if (!OneSignal && window.OneSignal) { OneSignal = window.OneSignal; }
      // Le plugin v5 expose parfois l'objet réel sous .default (module ES).
      if (OneSignal && OneSignal.default && typeof OneSignal.initialize !== 'function'
          && (typeof OneSignal.default.initialize === 'function' || typeof OneSignal.default.setAppId === 'function' || OneSignal.default.Notifications)) {
        OneSignal = OneSignal.default;
      }
      if (!OneSignal) { pdiag('plugin NATIF OneSignal ABSENT', false); return; }
      var APP_ID = "85e71302-1646-456d-9db4-a1875bb7d25c";
      var S = window.SESSION || {};
      var extId = S.chauffeurId || S.uid || null;

      function doLogin() {
        if (!extId) { pdiag('permission OK mais chauffeurId MANQUE', false); return; }
        try {
          if (OneSignal.login) { OneSignal.login(String(extId)); }
          else if (OneSignal.setExternalUserId) { OneSignal.setExternalUserId(String(extId)); }
          try {
            if (OneSignal.User && OneSignal.User.addTag) OneSignal.User.addTag('role', S.role || 'chauffeur');
            else if (OneSignal.sendTag) OneSignal.sendTag('role', S.role || 'chauffeur');
          } catch(e){}
          pdiag('login OK ext=' + String(extId).slice(0,8), true);
        } catch (e) { pdiag('login err: ' + e.message, false); }
      }

      if (!_osInit) {
        _osInit = true;
        try {
          if (typeof OneSignal.initialize === "function") {
            OneSignal.initialize(APP_ID);
            pdiag('init v5, demande permission...', true);
            // IMPORTANT : demander la permission PUIS faire le login quand elle
            // est accordee. login() avant la permission ne pose pas d'external_id.
            if (OneSignal.Notifications && OneSignal.Notifications.requestPermission) {
              try {
                var pr = OneSignal.Notifications.requestPermission(true);
                if (pr && pr.then) {
                  pr.then(function(acc){ pdiag('permission=' + acc, !!acc); doLogin(); })
                    .catch(function(e){ pdiag('perm err: ' + e, false); doLogin(); });
                } else { setTimeout(doLogin, 1500); }
              } catch(e) { setTimeout(doLogin, 1500); }
            } else { setTimeout(doLogin, 1500); }
          } else if (typeof OneSignal.setAppId === "function") {
            OneSignal.setAppId(APP_ID);
            pdiag('init v4, demande permission...', true);
            if (typeof OneSignal.promptForPushNotificationsWithUserResponse === "function") {
              OneSignal.promptForPushNotificationsWithUserResponse(function(acc){
                pdiag('permission(v4)=' + acc, !!acc); doLogin();
              });
            } else { setTimeout(doLogin, 1500); }
          } else {
            // Lister ce que l'objet expose pour identifier la bonne API.
            var methodes = [];
            try {
              for (var k in OneSignal) { methodes.push(k); }
              // aussi les méthodes du prototype
              var proto = Object.getPrototypeOf(OneSignal);
              if(proto) { Object.getOwnPropertyNames(proto).forEach(function(n){ if(methodes.indexOf(n)<0) methodes.push(n); }); }
            } catch(e){}
            pdiag('API inconnue. Dispo: ' + methodes.slice(0,12).join(','), false);
          }
        } catch (e) { pdiag('erreur init: ' + e.message, false); }
      } else {
        doLogin();
      }
    } catch (e) { /* sans gravité : le push web reste actif */ }
  };
  } // fin setupBridge

  // Démarrer la détection dès que le script est chargé.
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function(){ initWhenReady(0); });
  } else {
    initWhenReady(0);
  }
})();
