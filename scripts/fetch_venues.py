#!/usr/bin/env python3
"""Download every place in Greater Sydney where you can buy a drink from OpenStreetMap
(Overpass API) and write data/venues.json for the compass.

Run from the repo root: python3 scripts/fetch_venues.py
Output rows: [lat, lon, kind, opening_hours or "", name or ""], lat/lon rounded to 5 dp (~1 m).
Data © OpenStreetMap contributors, ODbL.
"""
import json, sys, time, urllib.parse, urllib.request

BBOX = "-34.25,150.50,-33.40,151.40"  # south, west, north, east: Greater Sydney incl. Blue Mtns foothills
QUERY = f"""[out:json][timeout:180][bbox:{BBOX}];
(
  nwr["amenity"~"^(pub|bar|biergarten|nightclub)$"];
  nwr["shop"~"^(alcohol|wine)$"];
  nwr["craft"="brewery"];
);
out center tags;"""
SERVERS = ["https://overpass-api.de/api/interpreter", "https://overpass.private.coffee/api/interpreter"]
# Overpass refuses some generic/fake user agents with 406, so say who we are.
UA = "beer-compass/1.0 (https://rt567.github.io/beer-compass/)"


def fetch():
    url_q = urllib.parse.urlencode({"data": QUERY})
    for server in SERVERS:
        try:
            req = urllib.request.Request(f"{server}?{url_q}", headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=240) as res:
                return json.load(res)["elements"]
        except Exception as e:
            print(f"{server}: {e}", file=sys.stderr)
            time.sleep(5)
    sys.exit("all Overpass servers failed")


def kind(tags):
    if tags.get("amenity") in ("pub", "bar", "biergarten", "nightclub"):
        return tags["amenity"]
    if tags.get("shop") in ("alcohol", "wine"):
        return "bottleshop"
    return "brewery"


def main():
    rows = []
    for e in fetch():
        tags = e.get("tags", {})
        lat = e.get("lat", e.get("center", {}).get("lat"))
        lon = e.get("lon", e.get("center", {}).get("lon"))
        if lat is None or tags.get("access") == "private" or tags.get("opening_hours") in ("closed", "off"):
            continue
        rows.append([round(lat, 5), round(lon, 5), kind(tags), tags.get("opening_hours", ""), tags.get("name", "")])
    rows.sort()
    with open("data/venues.json", "w") as f:
        json.dump({"fetched": time.strftime("%Y-%m-%d"), "source": "© OpenStreetMap contributors (ODbL)", "venues": rows},
                  f, ensure_ascii=False, separators=(",", ":"))
    print(f"{len(rows)} venues, {sum(1 for r in rows if r[3])} with opening_hours")


if __name__ == "__main__":
    main()
