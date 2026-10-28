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

  // Hook push natif (optionnel) : ton index.html appelle window.mobileaLinkPush()
  // pour lier les notifications au chauffeur connecté. En Capacitor, le push
  // passe par @capacitor/push-notifications (plugin natif). Ici on fournit un
  // point d'entrée neutre : il enregistre l'appareil au push si le plugin est
  // présent, sinon il ne fait rien (le push web OneSignal continue de marcher
  // dans la WebView). À enrichir plus tard si tu veux le push 100% natif.
  window.mobileaLinkPush = function () {
    try {
      var Push = (cap.Plugins && cap.Plugins.PushNotifications) || null;
      if (Push && typeof Push.register === "function") {
        Push.requestPermissions().then(function (res) {
          if (res && res.receive === "granted") { Push.register(); }
        }).catch(function () {});
      }
    } catch (e) { /* sans gravité : le push web reste actif */ }
  };
})();
