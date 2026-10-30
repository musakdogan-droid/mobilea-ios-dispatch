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
  // Détecte l'environnement Capacitor.
  var cap = window.Capacitor;
  if (!cap || !cap.isNativePlatform || !cap.isNativePlatform()) {
    // Pas dans l'app native → on ne définit pas MobileaNative (GPS web utilisé).
    return;
  }

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

  // Hook push natif : relie l'app installee a OneSignal pour recevoir les
  // notifications ciblees sur l'utilisateur connecte.
  //
  // IMPORTANT : en Capacitor native, le OneSignal Web SDK (OneSignalDeferred)
  // ne marche PAS fiablement (pas de Service Worker iOS, pas d'APNs). Il faut
  // le plugin natif onesignal-cordova-plugin qui expose window.OneSignal avec
  // l'API v5+ (login / addTag / Notifications.requestPermission).
  //
  // Cette fonction est appelee par app.js juste apres le login (chauffeur,
  // dispatch ou client) et ecrit l'external_id qui permet au worker
  // mobilea-push de cibler cet appareil precis.
  // DIAG : affiche sur l'ecran un message pendant 5 sec (debug visuel).
  function diagShow(msg) {
    try {
      var d = document.createElement("div");
      d.textContent = "[OS] " + msg;
      d.style.cssText = "position:fixed;bottom:40px;left:10px;right:10px;background:#111;color:#0f0;padding:10px;border-radius:8px;z-index:999999;font:12px monospace;box-shadow:0 2px 8px rgba(0,0,0,.3);white-space:pre-wrap;word-break:break-all";
      document.body.appendChild(d);
      setTimeout(function(){ try{ d.remove(); }catch(e){} }, 7000);
    } catch(e){}
  }

  // Essaie plusieurs chemins possibles pour acceder au plugin OneSignal natif
  // (selon la version du plugin et la facon dont Capacitor l'expose).
  function findOneSignal() {
    try {
      if (window.OneSignal && (typeof window.OneSignal.login === "function" || typeof window.OneSignal.setExternalUserId === "function")) {
        return { os: window.OneSignal, path: "window.OneSignal" };
      }
      if (cap && cap.Plugins && cap.Plugins.OneSignal) {
        return { os: cap.Plugins.OneSignal, path: "Capacitor.Plugins.OneSignal" };
      }
      if (window.cordova && window.cordova.plugins && window.cordova.plugins.OneSignal) {
        return { os: window.cordova.plugins.OneSignal, path: "cordova.plugins.OneSignal" };
      }
      if (window.plugins && window.plugins.OneSignal) {
        return { os: window.plugins.OneSignal, path: "window.plugins.OneSignal" };
      }
    } catch(e){}
    return null;
  }

  // Extraire l'appId OneSignal de la config dejà presente dans le HTML.
  // Chaque app (Dispatch/Driver/Client) a son propre appId dans son index.html.
  function getOneSignalAppId() {
    try {
      var scripts = document.getElementsByTagName("script");
      for (var i = 0; i < scripts.length; i++) {
        var t = scripts[i].textContent || "";
        var m = t.match(/appId:\s*["']([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})["']/i);
        if (m) return m[1];
      }
    } catch(e){}
    return null;
  }

  var _oneSignalInitialized = false;

  window.mobileaLinkPush = function () {
    try {
      // Chercher le plugin OneSignal avec retry (il peut mettre 1-2s a se charger).
      var tries = 0;
      var findInterval = setInterval(function() {
        tries++;
        var found = findOneSignal();
        if (found) {
          clearInterval(findInterval);
          // ★ Initialiser OneSignal AVANT tout (requis par v5)
          if (!_oneSignalInitialized && typeof found.os.initialize === "function") {
            var appId = getOneSignalAppId();
            if (appId) {
              try {
                found.os.initialize(appId);
                _oneSignalInitialized = true;
                diagShow("OneSignal.initialize OK\nappId=" + appId.slice(0,8) + "...");
              } catch(e) { diagShow("OneSignal.initialize ERR: " + String(e)); }
            } else {
              diagShow("appId OneSignal introuvable dans le HTML — impossible d'initialiser");
            }
          }
          // Laisser 1 sec pour que l'init se propage avant login
          setTimeout(function(){ doLink(found.os, found.path); }, 1000);
          return;
        }
        if (tries > 20) {
          clearInterval(findInterval);
          diagShow("Plugin OneSignal introuvable apres 10s. APIs testees : window.OneSignal, Capacitor.Plugins.OneSignal, cordova.plugins.OneSignal");
          // Repli push-notifications standard
          var Push = (cap.Plugins && cap.Plugins.PushNotifications) || null;
          if (Push && typeof Push.register === "function") {
            Push.requestPermissions().then(function (res) {
              if (res && res.receive === "granted") { Push.register(); }
            }).catch(function () {});
          }
        }
      }, 500);
    } catch(e){ diagShow("mobileaLinkPush ERR: " + String(e)); }
  };

  function doLink(OS, foundPath) {
    try {
      diagShow("Plugin trouve : " + foundPath + "\nlogin=" + (typeof OS.login) + " setExternalUserId=" + (typeof OS.setExternalUserId));

      // Demander la permission si pas encore donnee.
      try {
        if (OS.Notifications && typeof OS.Notifications.requestPermission === "function") {
          OS.Notifications.requestPermission(true);
        } else if (typeof OS.promptForPushNotificationsWithUserResponse === "function") {
          OS.promptForPushNotificationsWithUserResponse(function(){});
        }
      } catch(e){}

      var S = window.SESSION || null;
      if (!S) { diagShow("SESSION absent, abandon"); return; }

      var externalId = null;
      var tagRole = null;
      if (S.role === "chauffeur" && S.chauffeurId) {
        externalId = String(S.chauffeurId); tagRole = "chauffeur";
      } else if (S.role === "admin" || S.role === "dispatch") {
        externalId = "staff_" + (S.uid || S.role); tagRole = "staff";
      } else if (S.role === "client") {
        externalId = String(S.clientUser || S.email || "").trim(); tagRole = "client";
      }

      if (!externalId) { diagShow("external_id vide (role=" + S.role + ")"); return; }

      // Appeler login / setExternalUserId
      var called = null;
      try {
        if (typeof OS.login === "function") {
          OS.login(externalId); called = "login";
        } else if (typeof OS.setExternalUserId === "function") {
          OS.setExternalUserId(externalId); called = "setExternalUserId";
        }
      } catch(e){ diagShow("login ERR: " + String(e)); }

      // Tags
      try {
        if (OS.User && typeof OS.User.addTag === "function") {
          OS.User.addTag("role", tagRole);
          var _s = (S.societe || "").trim().toLowerCase().slice(0, 40);
          if (_s) OS.User.addTag("societe", _s);
        } else if (typeof OS.sendTag === "function") {
          OS.sendTag("role", tagRole);
        }
      } catch(e){}

      diagShow("OneSignal lie\nAPI=" + called + "\nexternal_id=" + externalId + "\nrole=" + tagRole);
    } catch(e){ diagShow("doLink ERR: " + String(e)); }
  }
})();
