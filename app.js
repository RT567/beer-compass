// Beer Compass: the arrow points at the nearest place that's open and sells alcohol. No distance, no name.
// Venues: data/venues.json (OpenStreetMap, Greater Sydney, see scripts/fetch_venues.py).
// URL flags for testing: ?at=-33.87,151.21 fakes your position, ?debug shows the target's name and distance,
// ?arrow=needle|soft|line picks the arrow style.
(function () {
  var DECLINATION = 12.8; // magnetic north is ~12.8° east of true north across Sydney (WMM, 2026)
  var params = new URLSearchParams(location.search);
  var debug = params.has("debug");
  var fakeAt = (params.get("at") || "").split(",").map(Number);

  var arrow = document.getElementById("arrow");
  if (params.get("arrow")) arrow.setAttribute("data-style", params.get("arrow"));
  // The page shows nothing but the arrow. With ?debug a status line says what it's pointing at and why.
  var status = null;
  if (debug) { status = document.createElement("div"); status.id = "status"; document.body.appendChild(status); }

  var venues = null;  // [{lat, lon, kind, name, hours: intervals, guessed}]
  var pos = null;     // {lat, lon}
  var heading = null; // degrees clockwise from true north that the top of the screen faces
  var target = null;
  var shown = 0;      // arrow angle currently drawn (smoothed)

  function say(msg) { if (status) status.textContent = msg || ""; }

  // ---- venues ------------------------------------------------------------------------------------
  fetch("data/venues.json")
    .then(function (r) { return r.json(); })
    .then(function (j) {
      venues = j.venues.map(function (v) {
        var hours = Hours.parseHours(v[3]), guessed = !hours;
        if (guessed) hours = Hours.parseHours(Hours.GUESS[v[2]]);
        return { lat: v[0], lon: v[1], kind: v[2], raw: v[3], name: v[4], hours: hours, guessed: guessed };
      });
      pick();
    })
    .catch(function () { say("couldn’t load the pubs"); });

  function distance(a, b) { // metres, haversine
    var R = 6371000, r = Math.PI / 180;
    var dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  function bearing(a, b) { // degrees clockwise from true north
    var r = Math.PI / 180, la1 = a.lat * r, la2 = b.lat * r, dLon = (b.lon - a.lon) * r;
    var y = Math.sin(dLon) * Math.cos(la2);
    var x = Math.cos(la1) * Math.sin(la2) - Math.sin(la1) * Math.cos(la2) * Math.cos(dLon);
    return (Math.atan2(y, x) / r + 360) % 360;
  }

  // Re-run on every position fix and every 30 s, so a place that just shut drops out.
  function pick() {
    if (!venues || !pos) return;
    var now = new Date(), best = null, bestD = Infinity;
    for (var i = 0; i < venues.length; i++) {
      var v = venues[i];
      if (!Hours.isOpen(v.hours, now)) continue;
      var d = distance(pos, v);
      if (d < bestD) { bestD = d; best = v; }
    }
    target = best;
    if (!target) say("nothing open");
    else say((target.name || "(no name)") + " · " + target.kind + " · " + Math.round(bestD) + " m · " +
      (target.guessed ? "guessed hours" : target.raw) + (heading == null ? " · no compass" : ""));
  }
  setInterval(pick, 30000);

  // ---- location ----------------------------------------------------------------------------------
  // "located" = the location prompt is out of the way (answered either way); idiot.js waits for it.
  var announced = false;
  function located() { if (!announced) { announced = true; window.dispatchEvent(new Event("located")); } }

  var watching = false;
  function startLocation() {
    if (watching) return;
    watching = true;
    if (fakeAt.length === 2 && !isNaN(fakeAt[0]) && !isNaN(fakeAt[1])) {
      pos = { lat: fakeAt[0], lon: fakeAt[1] }; pick(); setTimeout(located, 500); return;
    }
    if (!navigator.geolocation) { say("no location on this device"); return; }
    navigator.geolocation.watchPosition(function (p) {
      pos = { lat: p.coords.latitude, lon: p.coords.longitude };
      pick(); located();
    }, function (err) {
      watching = false; located();
      say(err.code === 1 ? "location blocked" : "can’t find you");
    }, { enableHighAccuracy: true, maximumAge: 5000 });
  }

  // ---- compass -----------------------------------------------------------------------------------
  function screenAngle() {
    var a = screen.orientation && screen.orientation.angle;
    return typeof a === "number" ? a : (window.orientation || 0);
  }

  // Android/W3C: heading of the screen's top edge from alpha/beta/gamma. The device's y axis (top edge)
  // goes vertical when the phone is held upright, so add the -z axis (out of the back) too: whichever of the
  // two is more horizontal dominates, and they point the same way in between.
  function headingFromEuler(alpha, beta, gamma) {
    var r = Math.PI / 180, sA = Math.sin(alpha * r), cA = Math.cos(alpha * r);
    var sB = Math.sin(beta * r), cB = Math.cos(beta * r), sG = Math.sin(gamma * r), cG = Math.cos(gamma * r);
    var east = -sA * cB - cA * sG - sA * sB * cG;
    var north = cA * cB - sA * sG + cA * sB * cG;
    return (Math.atan2(east, north) / r + 360) % 360;
  }

  var gotAbsolute = false, compassMissing = false;
  function setMagnetic(h) {
    var first = heading == null;
    heading = (h + DECLINATION + screenAngle() + 360) % 360;
    if (first) pick();
  }
  function onAbsolute(e) {
    if (e.alpha == null) return;
    gotAbsolute = true;
    setMagnetic(headingFromEuler(e.alpha, e.beta, e.gamma));
  }
  function onOrientation(e) {
    if (typeof e.webkitCompassHeading === "number" && e.webkitCompassHeading >= 0) setMagnetic(e.webkitCompassHeading); // iOS
    else if (e.absolute && !gotAbsolute && e.alpha != null) setMagnetic(headingFromEuler(e.alpha, e.beta, e.gamma)); // Firefox
  }
  var listening = false;
  function listen() {
    if (listening) return;
    listening = true;
    window.addEventListener("deviceorientationabsolute", onAbsolute);
    window.addEventListener("deviceorientation", onOrientation);
  }
  // No heading 1.5 s after we were allowed one: this device has no compass (laptops).
  function expectCompass() {
    setTimeout(function () { if (heading == null) { compassMissing = true; pick(); } }, 1500);
  }

  // iOS (and recent Chrome) only hand out compass data after a tap + "Allow", so the first tap anywhere asks.
  // Listen from the start anyway: browsers that don't gate it send headings straight away.
  var needsTap = typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function";
  document.addEventListener("click", function () {
    if (needsTap && heading == null) {
      DeviceOrientationEvent.requestPermission()
        .then(function (state) { if (state === "granted") expectCompass(); else { compassMissing = true; pick(); } })
        .catch(function () { compassMissing = true; pick(); });
    }
    startLocation(); // retry if location failed earlier
  });

  listen();
  if (!needsTap) expectCompass();
  startLocation();

  // ---- draw --------------------------------------------------------------------------------------
  // Desktop testing: without a compass, the arrow keys turn a pretend heading.
  window.addEventListener("keydown", function (e) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    if (!compassMissing && heading != null && !debug) return;
    heading = ((heading || 0) + (e.key === "ArrowRight" ? 10 : -10) + 360) % 360;
  });

  // Faded arrow = nothing to point at yet, or (iPhone) waiting for the first tap to unlock the compass.
  function frame() {
    if (target && pos && !(needsTap && heading == null && !compassMissing)) {
      var want = bearing(pos, target) - (heading || 0);
      var diff = ((want - shown) % 360 + 540) % 360 - 180; // shortest way round
      shown += diff * 0.15;
      arrow.style.transform = "rotate(" + shown.toFixed(1) + "deg)";
      arrow.classList.remove("idle");
    } else arrow.classList.add("idle");
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
