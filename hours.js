// Tiny OpenStreetMap opening_hours parser. Handles the forms Sydney venues actually use:
// "Mo-Th 12:00-22:00; Fr,Sa 12:00-02:00; Su off", "24/7", wrap-around day ranges (Su-Th),
// past-midnight closes, "," used instead of ";" between rules. Anything fancier (months, dates,
// sunset, comments) returns null and the caller falls back to guessed hours.
// Result: list of [start, end) intervals in minutes of the week, Monday 00:00 = 0. An interval may
// run past the end of Sunday (end > 10080); isOpen() wraps it back to Monday.
(function (exports) {
  var DAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
  var DAY = "(?:Mo|Tu|We|Th|Fr|Sa|Su|PH|SH)(?:\\s*-\\s*(?:Mo|Tu|We|Th|Fr|Sa|Su))?";
  var RULE = new RegExp("^(" + DAY + "(?:\\s*,\\s*" + DAY + ")*)?\\s*(.*)$");
  var WEEK = 7 * 1440;

  // "Fr,Sa" / "Su-Th" / "Su,PH" -> [4,5] / [6,0,1,2,3] / [6]. Holidays are ignored.
  function expandDays(str) {
    var out = [];
    str.split(/\s*,\s*/).forEach(function (tok) {
      var ends = tok.split(/\s*-\s*/), a = DAYS.indexOf(ends[0]), b = DAYS.indexOf(ends[1] || ends[0]);
      if (a < 0) return;
      for (var d = a; ; d = (d + 1) % 7) { if (out.indexOf(d) < 0) out.push(d); if (d === b) break; }
    });
    return out;
  }

  function parseTimes(str) {
    var times = [];
    var parts = str.split(/\s*,\s*/);
    for (var i = 0; i < parts.length; i++) {
      var m = parts[i].match(/^(\d\d?):(\d\d)\s*-\s*(\d\d?):(\d\d)\+?$/);
      var open = parts[i].match(/^(\d\d?):(\d\d)\+$/); // "18:00+" = open-ended; call it four hours
      if (!m && !open) return null;
      var start = +(m || open)[1] * 60 + +(m || open)[2];
      var end = m ? +m[3] * 60 + +m[4] : start + 240;
      if (end <= start) end += 1440;
      times.push([start, end]);
    }
    return times;
  }

  function parseHours(s) {
    if (!s) return null;
    s = s.trim();
    if (s === "24/7") return [[0, WEEK]];
    // "Mo-Fr 10:00-24:00, Sa-Su 10:00-22:00": a comma after a time that starts a new day list is a rule break.
    s = s.replace(/(\d|off|closed)\s*,\s*(?=(?:Mo|Tu|We|Th|Fr|Sa|Su|PH)\b)/g, "$1;");
    var week = [null, null, null, null, null, null, null], any = false;
    var rules = s.split(/\s*(?:;|\|\|)\s*/).filter(Boolean);
    for (var i = 0; i < rules.length; i++) {
      var m = rules[i].match(RULE), dayPart = m[1], rest = m[2].trim();
      var days = dayPart ? expandDays(dayPart) : [0, 1, 2, 3, 4, 5, 6];
      if (dayPart && !days.length) continue; // "PH off" and friends
      var times;
      if (/^(off|closed)$/i.test(rest)) times = [];
      else if (rest === "") { if (!dayPart) return null; times = [[0, 1440]]; } // "Mo-Fr" alone = all day
      else if (!(times = parseTimes(rest))) return null;
      // A later rule replaces earlier ones for the days it names (OSM semantics).
      days.forEach(function (d) { week[d] = times; });
      any = true;
    }
    if (!any) return null;
    var out = [];
    week.forEach(function (times, d) {
      (times || []).forEach(function (t) { out.push([d * 1440 + t[0], d * 1440 + t[1]]); });
    });
    return out;
  }

  function minuteOfWeek(date) {
    return ((date.getDay() + 6) % 7) * 1440 + date.getHours() * 60 + date.getMinutes();
  }

  function isOpen(intervals, date) {
    var m = minuteOfWeek(date);
    for (var i = 0; i < intervals.length; i++) {
      var a = intervals[i][0], b = intervals[i][1];
      if ((m >= a && m < b) || (m + WEEK >= a && m + WEEK < b)) return true;
    }
    return false;
  }

  // When OSM has no (usable) hours, guess from what kind of place it is.
  var GUESS = {
    pub: "Mo-Th 10:00-24:00; Fr,Sa 10:00-01:00; Su 10:00-22:00",
    bar: "Mo-Th 16:00-24:00; Fr,Sa 16:00-02:00; Su 15:00-22:00",
    nightclub: "Th-Sa 21:00-03:00",
    biergarten: "Mo-Su 12:00-22:00",
    brewery: "We-Su 12:00-22:00",
    bottleshop: "Mo-Sa 09:00-21:00; Su 10:00-20:00"
  };

  exports.parseHours = parseHours;
  exports.isOpen = isOpen;
  exports.GUESS = GUESS;
})(typeof module !== "undefined" ? module.exports : (window.Hours = {}));
