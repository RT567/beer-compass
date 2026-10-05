// The background: looking through the side of a glass of lager. Amber, darker towards the edges of the
// glass, a couple of glass highlights, and bubbles rising: scattered ones plus a few steady streams from
// nucleation points at the bottom. Bubbles rise towards real "up", so tilting the phone tilts their path,
// and the light in the glass shifts a little with the tilt.
(function () {
  var canvas = document.getElementById("beer"), ctx = canvas.getContext("2d");
  var glass = document.createElement("canvas"), gctx = glass.getContext("2d"); // static layer, redrawn on resize
  var W = 0, H = 0, dpr = 1, SLIDE = 20;
  var bubbles = [], streams = [];
  var up = { x: 0, y: -1 }, upWant = { x: 0, y: -1 }; // screen-space direction bubbles rise in (canvas y is down)

  function rand(a, b) { return a + Math.random() * (b - a); }

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * dpr);
    glass.width = Math.round((W + 2 * SLIDE) * dpr); // wider than the screen so it can slide sideways
    canvas.height = glass.height = Math.round(H * dpr);
    drawGlass();
    var n = Math.round(W * H / 1500);
    bubbles = [];
    for (var i = 0; i < n; i++) bubbles.push(newBubble(true));
    streams = [];
    for (var s = 0, k = Math.min(8, Math.max(4, Math.round(W / 70))); s < k; s++) streams.push(newStream(rand(0, 1)));
  }

  function drawGlass() {
    var c = gctx;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#c98a1a"; c.fillRect(0, 0, W + 2 * SLIDE, H);
    c.translate(SLIDE, 0);
    var g = c.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#f9cf55");
    g.addColorStop(0.45, "#eeaa22");
    g.addColorStop(1, "#c4740a");
    c.fillStyle = g; c.fillRect(-SLIDE, 0, W + 2 * SLIDE, H);
    // the glass is round: darker at the sides
    var side = c.createLinearGradient(0, 0, W, 0);
    side.addColorStop(0, "rgba(110,50,0,.45)");
    side.addColorStop(0.3, "rgba(110,50,0,0)");
    side.addColorStop(0.7, "rgba(110,50,0,0)");
    side.addColorStop(1, "rgba(110,50,0,.5)");
    c.fillStyle = side; c.fillRect(-SLIDE, 0, W + 2 * SLIDE, H);
    // reflections on the glass
    band(0.1, 0.05, 0.22); band(0.17, 0.015, 0.3); band(0.86, 0.03, 0.12);
    function band(at, width, alpha) {
      var b = c.createLinearGradient((at - width) * W, 0, (at + width) * W, 0);
      b.addColorStop(0, "rgba(255,250,225,0)");
      b.addColorStop(0.5, "rgba(255,250,225," + alpha + ")");
      b.addColorStop(1, "rgba(255,250,225,0)");
      c.fillStyle = b; c.fillRect((at - width) * W, 0, width * 2 * W, H);
    }
  }

  // A nucleation point: a steady line of tiny bubbles. The point sways slowly left and right, so the line
  // curves a little, and after a while it dies and starts again somewhere else.
  function newStream(age) {
    var life = rand(12, 30);
    return {
      x: rand(0.06, 0.94) * W, sway: rand(4, 16), freq: rand(0.15, 0.5), phase: rand(0, 6.28),
      every: rand(0.04, 0.12), r: rand(0.7, 1.4), t: 0, age: age * life, life: life
    };
  }

  // Mostly tiny bubbles, a few big ones. Bigger bubbles rise faster and wobble more.
  function newBubble(anywhere, x, r) {
    r = r || Math.pow(Math.random(), 3) * 3.2 + 0.5;
    return {
      x: x != null ? x : rand(0, W),
      y: anywhere ? rand(0, H) : H + r + rand(0, 40),
      r: r, speed: 25 + r * 32 + rand(-8, 8),
      phase: rand(0, 6.28), wob: rand(0.2, 1) * r * 0.8, freq: rand(1.5, 4),
      a: Math.random() < 0.4 ? rand(0.25, 0.55) : 1 // fainter = further back in the glass
    };
  }

  function drawBubble(b, t) {
    var wob = Math.sin(b.phase + t * b.freq) * b.wob;
    var x = b.x + wob * -up.y, y = b.y + wob * up.x; // wobble sideways to the direction of travel
    ctx.globalAlpha = b.a;
    ctx.beginPath(); ctx.arc(x, y, b.r, 0, 6.2832);
    if (b.r < 1.2) { ctx.fillStyle = "rgba(255,248,215,.75)"; ctx.fill(); return; }
    ctx.fillStyle = "rgba(255,245,200,.22)"; ctx.fill();
    ctx.lineWidth = Math.max(0.6, b.r * 0.22); ctx.strokeStyle = "rgba(255,250,228,.75)"; ctx.stroke();
    ctx.beginPath(); ctx.arc(x - b.r * 0.35, y - b.r * 0.35, b.r * 0.28, 0, 6.2832);
    ctx.fillStyle = "rgba(255,255,255,.9)"; ctx.fill();
  }
  function drawBubbleAt(b, t) { drawBubble(b, t); ctx.globalAlpha = 1; }

  // Off the screen in the direction of travel? Respawn on the opposite side (bottom when upright).
  function offscreen(b) {
    var m = 10;
    return b.y < -m || b.y > H + m + 60 || b.x < -m - 60 || b.x > W + m + 60;
  }
  function respawn(b) {
    var nb = newBubble(false);
    // start just behind the edge the bubbles are coming from
    if (Math.abs(up.x) > Math.abs(up.y)) { nb.x = up.x > 0 ? -nb.r - rand(0, 40) : W + nb.r + rand(0, 40); nb.y = rand(0, H); }
    else { nb.y = up.y < 0 ? H + nb.r + rand(0, 40) : -nb.r - rand(0, 40); }
    return nb;
  }

  var last = 0, streamBubbles = [];
  function frame(now) {
    var t = now / 1000, dt = Math.min(0.05, last ? t - last : 0); last = t;
    up.x += (upWant.x - up.x) * 0.08; up.y += (upWant.y - up.y) * 0.08;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // the light in the glass slides a little with the tilt
    ctx.drawImage(glass, (up.x * SLIDE - SLIDE) * dpr, 0);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    for (var i = 0; i < bubbles.length; i++) {
      var b = bubbles[i];
      b.x += up.x * b.speed * dt; b.y += up.y * b.speed * dt;
      if (offscreen(b)) b = bubbles[i] = respawn(b);
      drawBubbleAt(b, t);
    }
    // nucleation streams
    for (var s = 0; s < streams.length; s++) {
      var st = streams[s];
      st.t += dt; st.age += dt;
      if (st.age > st.life) { st = streams[s] = newStream(0); continue; }
      if (st.t > st.every) {
        st.t = 0;
        var sx = st.x + Math.sin(st.phase + t * st.freq) * st.sway;
        streamBubbles.push(Object.assign(newBubble(false, sx, st.r * rand(0.8, 1.2)),
          { y: H + 2, wob: rand(0.3, 1.2), freq: rand(1, 2.5), a: 0.9 }));
      }
    }
    for (var j = streamBubbles.length - 1; j >= 0; j--) {
      var sb = streamBubbles[j];
      sb.x += up.x * sb.speed * dt; sb.y += up.y * sb.speed * dt;
      if (offscreen(sb)) { streamBubbles.splice(j, 1); continue; }
      drawBubbleAt(sb, t);
    }
    requestAnimationFrame(frame);
  }

  // Which way is up, in screen terms? From the phone's tilt (beta/gamma): world-up in device coordinates is
  // (-cosβ·sinγ, sinβ, cosβ·cosγ). Its on-screen part is where bubbles go. Lying flat it vanishes, so lean
  // back to plain "towards the top" then.
  function onTilt(e) {
    if (e.beta == null) return;
    var r = Math.PI / 180, b = e.beta * r, g = e.gamma * r;
    var ux = -Math.cos(b) * Math.sin(g), uy = Math.sin(b);
    var a = -((screen.orientation && screen.orientation.angle) || window.orientation || 0) * r; // landscape
    var sx = ux * Math.cos(a) - uy * Math.sin(a), sy = ux * Math.sin(a) + uy * Math.cos(a);
    var m = Math.hypot(sx, sy), w = Math.min(1, m / 0.5);
    sx = sx * w; sy = sy * w + (1 - w); // blend towards straight up when flat
    m = Math.hypot(sx, sy) || 1;
    upWant = { x: sx / m, y: -sy / m };
  }
  window.addEventListener("deviceorientation", onTilt);

  window.addEventListener("resize", resize);
  resize();
  requestAnimationFrame(frame);
})();
