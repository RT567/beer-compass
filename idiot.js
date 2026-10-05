// The joke: right after the real "wants to use your location" prompt, a fake system prompt asks if you're an
// idiot. Yes and No both just close it. It's styled like the platform's own permission prompt: an iOS alert on
// iPhone/iPad, a Chrome-style dialog everywhere else. app.js fires "located" once the location prompt is done.
// Bonus: on iOS the tap on Yes/No bubbles to app.js's document click handler, which unlocks the compass.
(function () {
  var ios = /iP(hone|ad|od)/.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS says it's a Mac
  var host = location.hostname || "rt567.github.io";
  if (host === "127.0.0.1" || host === "localhost") host = "rt567.github.io";

  var css = document.createElement("style");
  css.textContent =
    "#idiot{position:fixed;inset:0;z-index:10;display:flex;align-items:center;justify-content:center;" +
    "background:rgba(0,0,0,.2);font-family:-apple-system,system-ui,sans-serif;animation:idiot-in .2s ease-out}" +
    "@keyframes idiot-in{from{opacity:0}}" +
    "#idiot button{font:inherit;background:none;border:0;cursor:pointer;-webkit-tap-highlight-color:transparent}" +
    // iOS alert
    ".ios-alert{width:270px;border-radius:14px;overflow:hidden;background:rgba(242,242,242,.82);color:#000;" +
    "-webkit-backdrop-filter:blur(20px) saturate(1.8);backdrop-filter:blur(20px) saturate(1.8);text-align:center;" +
    "animation:ios-pop .25s cubic-bezier(.2,1.2,.4,1)}" +
    "@keyframes ios-pop{from{transform:scale(1.15);opacity:0}}" +
    ".ios-alert h2{font-size:17px;font-weight:600;line-height:1.3;margin:0;padding:19px 16px 20px}" +
    ".ios-alert .row{display:flex;border-top:.5px solid rgba(60,60,67,.3)}" +
    ".ios-alert button{flex:1;font-size:17px;color:#007aff;padding:11px 0;line-height:22px}" +
    ".ios-alert button+button{border-left:.5px solid rgba(60,60,67,.3)}" +
    ".ios-alert button:active{background:rgba(0,0,0,.08)}" +
    "@media (prefers-color-scheme:dark){.ios-alert{background:rgba(37,37,37,.82);color:#fff}" +
    ".ios-alert .row,.ios-alert button+button{border-color:rgba(84,84,88,.6)}.ios-alert button{color:#0a84ff}}" +
    // Chrome-style dialog
    ".chrome-prompt{width:min(320px,calc(100vw - 48px));background:#fff;color:#1f1f1f;border-radius:16px;" +
    "padding:20px 20px 12px;box-shadow:0 4px 16px rgba(0,0,0,.25);font-family:Roboto,system-ui,sans-serif}" +
    ".chrome-prompt p{margin:0 0 18px;font-size:16px;line-height:1.4}" +
    ".chrome-prompt .row{display:flex;justify-content:flex-end;gap:8px}" +
    ".chrome-prompt button{color:#0b57d0;font-size:14px;font-weight:500;padding:10px 12px;border-radius:20px}" +
    ".chrome-prompt button:active{background:rgba(11,87,208,.1)}" +
    "@media (prefers-color-scheme:dark){.chrome-prompt{background:#2d2f31;color:#e3e3e3}.chrome-prompt button{color:#a8c7fa}}";
  document.head.appendChild(css);

  function show() {
    var el = document.createElement("div");
    el.id = "idiot";
    el.setAttribute("role", "alertdialog");
    el.innerHTML = ios
      ? '<div class="ios-alert"><h2>“' + host + '” Would Like to Know If You’re an Idiot</h2>' +
        '<div class="row"><button>No</button><button>Yes</button></div></div>'
      : '<div class="chrome-prompt"><p>' + host + " wants to know if you’re an idiot</p>" +
        '<div class="row"><button>No</button><button>Yes</button></div></div>';
    el.addEventListener("click", function (e) { if (e.target.tagName === "BUTTON") el.remove(); });
    document.body.appendChild(el);
  }

  var shown = false;
  window.addEventListener("located", function () {
    if (shown) return;
    shown = true;
    setTimeout(show, 700);
  });
})();
