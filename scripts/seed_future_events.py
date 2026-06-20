#!/usr/bin/env python3
"""
Additive seed: creates FUTURE sport events (plus applications, approvals,
rejections, pending requests and comments) against a running API so every
feature can be exercised. Non-destructive — it only adds rows.

Usage:
    python seed_future_events.py            # create future events + flows
    python seed_future_events.py --rate     # submit ratings for the back-dated event

The script talks to the API at BASE (default http://localhost:5000).
All seeded users share the password 'Password123!'.
"""
import json
import random
import sys
import urllib.request
import urllib.error
from datetime import datetime, timedelta, timezone

BASE = "http://localhost:5000"
PASSWORD = "Password123!"
random.seed(2026)

# (id, email) of usable regular users in the DB
USERS = [f"user{i}@sportactivityorganizer.com" for i in range(2, 31)]

# sportId -> nice title fragment
SPORTS = {
    1: "Фудбал", 2: "Кошарка", 3: "Одбојка", 4: "Тенис", 5: "Пинг-понг",
    6: "Ракомет", 7: "Пливање", 8: "Трчање", 9: "Велосипедизам", 10: "Бадминтон",
}
SKILLS = [None, "Beginner", "Intermediate", "Advanced"]

# Real-ish locations across North Macedonia for map / radius / distance testing
LOCATIONS = [
    ("СЦ Борис Трајковски, Скопје", 41.9870, 21.4030),
    ("Градски парк, Скопје", 42.0027, 21.4180),
    ("Сала Јане Сандански, Скопје", 42.0050, 21.4600),
    ("Аеродром, Скопје", 41.9870, 21.4650),
    ("Кале, Скопје", 42.0010, 21.4330),
    ("Маврово езеро", 41.6880, 20.7560),
    ("Општина Тетово, центар", 42.0100, 20.9710),
    ("Спортски центар Битола", 41.0290, 21.3340),
    ("Плоштад, Охрид", 41.1170, 20.8010),
    ("Куманово, градски стадион", 42.1320, 21.7140),
]

TITLES = [
    "{s} викенд дружење", "Утрински {s} #{n}", "Вечерен {s} меч",
    "{s} за почетници", "{s} лига аматери", "Брз {s} натпревар",
    "{s} тренинг сесија", "Опен {s} ден",
]
DESCRIPTIONS = [
    "Дојдете да играме во опуштена атмосфера. Сите нивоа добредојдени!",
    "Бараме уште неколку играчи за да го комплетираме теренот.",
    "Редовно неделно дружење — добра екипа и фер игра загарантирани.",
    "Понесете спортска опрема и добро расположение. Се гледаме!",
    "Идеално за вежбање и запознавање нови луѓе со исти интереси.",
]
COMMENTS = [
    "Супер, се пријавувам! Кој носи топка?",
    "Дали има паркинг во близина?",
    "Јас доаѓам со уште двајца другари.",
    "Може ли да почнеме 15 мин подоцна?",
    "Одлична иницијатива, се гледаме таму!",
    "Каква е прогнозата, играме и при дожд?",
]


def req(method, path, token=None, body=None):
    url = BASE + path
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, method=method)
    r.add_header("Content-Type", "application/json")
    if token:
        r.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(r, timeout=30) as resp:
            raw = resp.read().decode()
            return resp.status, (json.loads(raw) if raw else None)
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()[:200]


def login(email):
    st, data = req("POST", "/api/auth/login", body={"email": email, "password": PASSWORD})
    if st != 200:
        return None
    return data["accessToken"]


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S")


def create_event(token, sport_id, when, skill, loc):
    addr, lat, lng = loc
    s = SPORTS[sport_id]
    title = random.choice(TITLES).format(s=s, n=random.randint(1, 99))
    body = {
        "sportId": sport_id,
        "title": title,
        "description": random.choice(DESCRIPTIONS),
        "eventDate": iso(when),
        "durationMinutes": random.choice([60, 90, 120]),
        "locationAddress": addr,
        "locationLat": lat + random.uniform(-0.01, 0.01),
        "locationLng": lng + random.uniform(-0.01, 0.01),
        "maxParticipants": random.choice([6, 8, 10, 12, 14]),
        "minSkillLevel": skill,
    }
    st, data = req("POST", "/api/events", token=token, body=body)
    return (data["id"], title) if st in (200, 201) else (None, f"ERR {st}: {data}")


def main_seed():
    now = datetime.now(timezone.utc)
    tokens = {}
    for e in USERS:
        t = login(e)
        if t:
            tokens[e] = t
    print(f"Logged in {len(tokens)}/{len(USERS)} users")

    organizers = USERS[:10]
    created = []

    # 16 future events spread over the next 1..30 days
    for i in range(16):
        org = organizers[i % len(organizers)]
        otoken = tokens[org]
        sport = random.choice(list(SPORTS))
        when = now + timedelta(days=random.randint(1, 30),
                               hours=random.randint(0, 10))
        skill = random.choice(SKILLS)
        loc = LOCATIONS[i % len(LOCATIONS)]
        eid, title = create_event(otoken, sport, when, skill, loc)
        if not eid:
            print("  create failed:", title)
            continue
        created.append((eid, org))
        print(f"[{eid}] {title}  (org={org}, in {(when-now).days}d)")

        # last-minute flag on a couple
        if i % 7 == 0:
            req("POST", f"/api/events/{eid}/last-minute", token=otoken)

        # applicants: 4-8 other users
        pool = [u for u in USERS if u != org and u in tokens]
        applicants = random.sample(pool, random.randint(4, 8))
        app_ids = {}
        for u in applicants:
            st, data = req("POST", f"/api/events/{eid}/applications", token=tokens[u])
            if st in (200, 201) and isinstance(data, dict):
                app_ids[u] = data["id"]

        # organizer decisions: approve most, reject one, leave 1-2 pending
        decided = list(app_ids.items())
        random.shuffle(decided)
        approved = []
        for idx, (u, aid) in enumerate(decided):
            if idx == 0 and len(decided) > 3:
                req("POST", f"/api/events/{eid}/applications/{aid}/reject", token=otoken)
            elif idx <= 2:
                pass  # leave pending
            else:
                st, _ = req("POST", f"/api/events/{eid}/applications/{aid}/approve", token=otoken)
                if st == 200:
                    approved.append(u)

        # comments from organizer + approved participants
        commenters = [org] + approved
        for u in random.sample(commenters, min(len(commenters), random.randint(2, 4))):
            req("POST", f"/api/events/{eid}/comments", token=tokens[u],
                body={"content": random.choice(COMMENTS)})

    print(f"\nCreated {len(created)} future events.")

    # ---- one event destined to become 'completed' for rating tests ----
    org = organizers[0]
    eid, title = create_event(tokens[org], 1, now + timedelta(days=2), "Intermediate",
                              LOCATIONS[0])
    raters = []
    if eid:
        pool = [u for u in USERS if u != org and u in tokens]
        for u in random.sample(pool, 4):
            st, data = req("POST", f"/api/events/{eid}/applications", token=tokens[u])
            if st in (200, 201) and isinstance(data, dict):
                st2, _ = req("POST", f"/api/events/{eid}/applications/{data['id']}/approve",
                             token=tokens[org])
                if st2 == 200:
                    raters.append(u)
    print("\nRATING_EVENT_ID=", eid)
    print("RATING_ORG=", org)
    print("RATING_PARTICIPANTS=", ",".join(raters))


def rate(event_id):
    """Submit event + participant ratings for a (now back-dated, completed) event."""
    org = sys.argv[3]
    participants = sys.argv[4].split(",") if len(sys.argv) > 4 else []
    otoken = login(org)
    # participants rate the event
    for u in participants:
        t = login(u)
        st, data = req("POST", f"/api/events/{event_id}/ratings", token=t,
                       body={"rating": random.randint(3, 5),
                             "comment": random.choice(
                                 ["Одлична организација!", "Супер екипа, ќе дојдам пак.",
                                  "Фер игра, се забавував.", "Малку доцневме со старт, инаку топ."])})
        print(f"  event-rating by {u}: {st}")
    # organizer rates participants
    for u in participants:
        # need participant id -> use ratable-participants endpoint
        st, data = req("GET", f"/api/events/{event_id}/ratings/ratable-participants", token=otoken)
        if st == 200 and isinstance(data, list):
            for p in data:
                req("POST", f"/api/events/{event_id}/ratings/participants", token=otoken,
                    body={"participantId": p["userId"], "rating": random.randint(3, 5),
                          "comment": "Добар играч и фер однос."})
            break
    print("Participant ratings submitted.")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "--rate":
        rate(int(sys.argv[2]))
    else:
        main_seed()
