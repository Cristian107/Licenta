from datetime import datetime, timedelta
import secrets

from flask import Flask, jsonify, request

from database import (
    calculate_accuracy,
    calculate_kills_per_min,
    calculate_weapon_efficiency,
    close_db,
    get_db,
    init_db,
    row_to_dict,
    rows_to_dicts,
    verify_password,
)
from seed import seed_base_data


app = Flask(__name__)


@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET,POST,PATCH,DELETE,OPTIONS"
    return response


@app.teardown_appcontext
def teardown_db(error):
    close_db(error)


@app.before_request
def handle_options():
    if request.method == "OPTIONS":
        return ("", 204)


def bootstrap_database():
    init_db()
    with app.app_context():
        seed_base_data(get_db())


def ok(data=None, status=200):
    return jsonify(data if data is not None else {"ok": True}), status


def parse_int(value, default=0):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def parse_float(value, default=0.0):
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def is_admin_username(username):
    return "admin" in str(username or "").lower()


def role_for_account(row):
    if not row:
        return "player"

    return "admin" if is_admin_username(row["username"]) else row["role"]


def account_status(row):
    return "Banned" if int(row["is_banned"] or 0) else "Unbanned"


def create_auth_session(db, user_id):
    token = secrets.token_urlsafe(32)
    db.execute(
        "INSERT INTO auth_sessions (user_id, token, created_at) VALUES (?, ?, ?)",
        (user_id, token, datetime.utcnow().isoformat())
    )
    return token


def get_authenticated_user():
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header.removeprefix("Bearer ").strip()
    if not token:
        return None

    return get_db().execute(
        """
        SELECT u.*
        FROM auth_sessions s
        JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
        """,
        (token,)
    ).fetchone()


def require_authenticated_user():
    user = get_authenticated_user()
    if not user:
        return None, ok({"error": "Authentication required"}, 401)

    if int(user["is_banned"] or 0):
        return None, ok({"error": "Your account has been banned"}, 403)

    return user, None


def require_admin_user():
    user, error = require_authenticated_user()
    if error:
        return None, error

    if role_for_account(user) != "admin":
        return None, ok({"error": "Admin access required"}, 403)

    return user, None


def upsert_player(db, player_payload):
    username = (player_payload or {}).get("username", "player1").strip() or "player1"
    level = parse_int((player_payload or {}).get("level"), 1)
    existing = db.execute("SELECT * FROM players WHERE username = ?", (username,)).fetchone()

    if existing:
        db.execute("UPDATE players SET level = ? WHERE id = ?", (level, existing["id"]))
        return existing["id"]

    return db.execute(
        "INSERT INTO players (username, level, created_at) VALUES (?, ?, ?)",
        (username, level, datetime.utcnow().isoformat())
    ).lastrowid


def normalize_weapon_stats(weapon_stats):
    normalized = []
    for weapon in weapon_stats or []:
        shots_fired = parse_int(weapon.get("shots_fired"), 0)
        shots_hit = parse_int(weapon.get("shots_hit"), 0)
        kills = parse_int(weapon.get("kills"), 0)
        damage_dealt = parse_float(weapon.get("damage_dealt"), 0)
        usage_seconds = parse_int(weapon.get("usage_seconds"), 0)
        accuracy = calculate_accuracy(shots_hit, shots_fired)
        efficiency = calculate_weapon_efficiency(kills, accuracy, damage_dealt, usage_seconds)
        normalized.append({
            "weapon_name": weapon.get("weapon_name", "Unknown"),
            "kills": kills,
            "shots_fired": shots_fired,
            "shots_hit": shots_hit,
            "damage_dealt": damage_dealt,
            "usage_seconds": usage_seconds,
            "accuracy": accuracy,
            "efficiency": efficiency,
        })
    return normalized


def enrich_match(match):
    if not match:
        return None
    item = dict(match)
    item["coins_collected"] = int(item.get("coins_collected") or 0)
    item["player_health_end"] = round(float(item.get("player_health_end") or 0), 2)
    item["player_health_max"] = round(float(item.get("player_health_max") or 0), 2)
    item["kills_per_min"] = calculate_kills_per_min(item.get("enemies_killed"), item.get("duration_seconds"))
    item["duration_minutes"] = round(float(item.get("duration_seconds") or 0) / 60.0, 2)
    return item


def resolve_player_id(db, player_id):
    row = db.execute("SELECT id FROM players WHERE id = ?", (player_id,)).fetchone()
    if row:
        return row["id"]

    fallback = db.execute("SELECT id FROM players ORDER BY id ASC LIMIT 1").fetchone()
    return fallback["id"] if fallback else None


def resolve_player_id_for_user(db, username, role=None):
    player = db.execute("SELECT id FROM players WHERE username = ?", (username,)).fetchone()
    if player:
        return player["id"]

    return db.execute(
        "INSERT INTO players (username, level, created_at) VALUES (?, ?, ?)",
        (username, 1, datetime.utcnow().isoformat())
    ).lastrowid


def format_mmss(seconds):
    seconds = max(int(seconds or 0), 0)
    return f"{seconds // 60}:{seconds % 60:02d}"


def build_match_details(db, match_id):
    most_used = db.execute(
        """
        SELECT weapon_name, usage_seconds
        FROM weapon_stats
        WHERE match_id = ?
        ORDER BY usage_seconds DESC, damage_dealt DESC
        LIMIT 1
        """,
        (match_id,)
    ).fetchone()
    top_killer = db.execute(
        """
        SELECT weapon_name, kills
        FROM weapon_stats
        WHERE match_id = ?
        ORDER BY kills DESC, damage_dealt DESC
        LIMIT 1
        """,
        (match_id,)
    ).fetchone()
    match = db.execute("SELECT coins_collected FROM matches WHERE id = ?", (match_id,)).fetchone()

    most_used_seconds = most_used["usage_seconds"] if most_used else 0
    return {
        "most_used_weapon": most_used["weapon_name"] if most_used else "N/A",
        "most_used_weapon_seconds": most_used_seconds,
        "most_used_weapon_time": format_mmss(most_used_seconds),
        "top_kill_weapon": top_killer["weapon_name"] if top_killer else "N/A",
        "top_kill_weapon_kills": top_killer["kills"] if top_killer else 0,
        "coins_collected": int(match["coins_collected"] or 0) if match else 0,
    }


def prune_player_match_history(db, player_id, keep_count=10):
    db.execute(
        """
        DELETE FROM matches
        WHERE id IN (
            SELECT id
            FROM matches
            WHERE player_id = ?
            ORDER BY started_at DESC, id DESC
            LIMIT -1 OFFSET ?
        )
        """,
        (player_id, keep_count)
    )


def public_user(row):
    if not row:
        return None

    return {
        "id": row["id"],
        "username": row["username"],
        "role": role_for_account(row),
        "is_admin": role_for_account(row) == "admin",
        "is_banned": bool(row["is_banned"]),
        "status": account_status(row),
        "created_at": row["created_at"],
    }


@app.get("/api/health")
def health():
    return ok({"status": "ok", "service": "explorers-journal-api"})


@app.post("/api/auth/login")
def login():
    payload = request.get_json(silent=True) or {}
    username = str(payload.get("username", "")).strip()
    password = str(payload.get("password", ""))

    if not username or not password:
        return ok({"error": "Username and password are required"}, 400)

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    if not user or not verify_password(password, user["password_salt"], user["password_hash"]):
        return ok({"error": "Invalid username or password"}, 401)

    if int(user["is_banned"] or 0):
        return ok({"error": "Your account has been banned"}, 403)

    role = role_for_account(user)
    if role != user["role"]:
        db.execute("UPDATE users SET role = ? WHERE id = ?", (role, user["id"]))

    player_id = resolve_player_id_for_user(db, user["username"], role)
    token = create_auth_session(db, user["id"])
    db.commit()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    return ok({
        "user": public_user(user),
        "player_id": player_id,
        "token": token,
    })


@app.get("/api/players")
def get_players():
    rows = get_db().execute("SELECT * FROM players ORDER BY created_at DESC").fetchall()
    return ok({"players": rows_to_dicts(rows)})


@app.get("/api/players/<int:player_id>")
def get_player(player_id):
    db = get_db()
    player_id = resolve_player_id(db, player_id)
    if player_id is None:
        return ok({"error": "Player not found"}, 404)

    row = db.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
    if not row:
        return ok({"error": "Player not found"}, 404)
    return ok({"player": row_to_dict(row)})


@app.post("/api/players")
def create_player():
    payload = request.get_json(silent=True) or {}
    db = get_db()
    player_id = upsert_player(db, payload)
    db.commit()
    player = db.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
    return ok({"player": row_to_dict(player)}, 201)


def account_row_to_dict(row):
    item = public_user(row)
    item["status"] = account_status(row)
    return item


@app.get("/api/admin/accounts")
def admin_accounts():
    _, error = require_admin_user()
    if error:
        return error

    rows = get_db().execute("SELECT * FROM users ORDER BY username ASC").fetchall()
    return ok({"accounts": [account_row_to_dict(row) for row in rows]})


@app.patch("/api/admin/accounts/<int:user_id>")
def update_account_status(user_id):
    _, error = require_admin_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    is_banned = 1 if bool(payload.get("is_banned")) else 0
    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        return ok({"error": "Account not found"}, 404)

    db.execute("UPDATE users SET is_banned = ? WHERE id = ?", (is_banned, user_id))
    db.commit()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    return ok({"account": account_row_to_dict(user)})


@app.delete("/api/admin/accounts/<int:user_id>")
def delete_account(user_id):
    admin, error = require_admin_user()
    if error:
        return error

    db = get_db()
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        return ok({"error": "Account not found"}, 404)

    if user["id"] == admin["id"]:
        return ok({"error": "You cannot delete the account you are currently using"}, 400)

    username = user["username"]
    db.execute("DELETE FROM players WHERE username = ?", (username,))
    db.execute("DELETE FROM users WHERE id = ?", (user_id,))
    db.commit()
    return ok({"deleted": True, "account": account_row_to_dict(user)})


def serialize_comment(row):
    return {
        "id": row["id"],
        "post_id": row["post_id"],
        "body": row["body"],
        "created_at": row["created_at"],
        "author": row["username"],
        "author_role": role_for_account(row),
    }


def serialize_post(row, comments):
    return {
        "id": row["id"],
        "title": row["title"],
        "body": row["body"],
        "created_at": row["created_at"],
        "author": row["username"],
        "author_role": role_for_account(row),
        "comments": comments,
    }


@app.get("/api/discussions")
def get_discussions():
    _, error = require_authenticated_user()
    if error:
        return error

    db = get_db()
    posts = db.execute(
        """
        SELECT p.*, u.username, u.role, u.is_banned
        FROM discussion_posts p
        JOIN users u ON u.id = p.user_id
        ORDER BY p.created_at DESC
        """
    ).fetchall()

    serialized_posts = []
    for post in posts:
        comments = db.execute(
            """
            SELECT c.*, u.username, u.role, u.is_banned
            FROM discussion_comments c
            JOIN users u ON u.id = c.user_id
            WHERE c.post_id = ?
            ORDER BY c.created_at ASC
            """,
            (post["id"],)
        ).fetchall()
        serialized_posts.append(serialize_post(post, [serialize_comment(comment) for comment in comments]))

    return ok({"posts": serialized_posts})


@app.post("/api/discussions")
def create_discussion():
    user, error = require_authenticated_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    title = str(payload.get("title", "")).strip()
    body = str(payload.get("body", "")).strip()
    if not body:
        return ok({"error": "Message body is required"}, 400)

    if not title:
        title = body[:56] + ("..." if len(body) > 56 else "")

    db = get_db()
    post_id = db.execute(
        "INSERT INTO discussion_posts (user_id, title, body, created_at) VALUES (?, ?, ?, ?)",
        (user["id"], title, body, datetime.utcnow().isoformat())
    ).lastrowid
    db.commit()
    post = db.execute(
        """
        SELECT p.*, u.username, u.role, u.is_banned
        FROM discussion_posts p
        JOIN users u ON u.id = p.user_id
        WHERE p.id = ?
        """,
        (post_id,)
    ).fetchone()
    return ok({"post": serialize_post(post, [])}, 201)


@app.post("/api/discussions/<int:post_id>/comments")
def create_discussion_comment(post_id):
    user, error = require_authenticated_user()
    if error:
        return error

    payload = request.get_json(silent=True) or {}
    body = str(payload.get("body", "")).strip()
    if not body:
        return ok({"error": "Comment body is required"}, 400)

    db = get_db()
    post = db.execute("SELECT id FROM discussion_posts WHERE id = ?", (post_id,)).fetchone()
    if not post:
        return ok({"error": "Post not found"}, 404)

    comment_id = db.execute(
        "INSERT INTO discussion_comments (post_id, user_id, body, created_at) VALUES (?, ?, ?, ?)",
        (post_id, user["id"], body, datetime.utcnow().isoformat())
    ).lastrowid
    db.commit()
    comment = db.execute(
        """
        SELECT c.*, u.username, u.role, u.is_banned
        FROM discussion_comments c
        JOIN users u ON u.id = c.user_id
        WHERE c.id = ?
        """,
        (comment_id,)
    ).fetchone()
    return ok({"comment": serialize_comment(comment)}, 201)


@app.post("/api/matches")
def create_match():
    payload = request.get_json(silent=True) or {}
    player_payload = payload.get("player", {})
    match_payload = payload.get("match", {})
    weapon_payload = payload.get("weapon_stats", [])
    kill_payload = payload.get("kill_events", [])

    db = get_db()
    player_id = upsert_player(db, player_payload)

    duration = parse_int(match_payload.get("duration_seconds"), 0)
    shots_fired = parse_int(match_payload.get("shots_fired"), 0)
    shots_hit = parse_int(match_payload.get("shots_hit"), 0)
    ended_at = datetime.utcnow()
    started_at = ended_at - timedelta(seconds=max(duration, 0))
    accuracy = calculate_accuracy(shots_hit, shots_fired)

    match_id = db.execute(
        """
        INSERT INTO matches (
            player_id, level_name, result, score, duration_seconds,
            enemies_killed, damage_dealt, damage_taken, player_health_end,
            player_health_max, coins_collected, shots_fired, shots_hit,
            accuracy, started_at, ended_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            player_id,
            match_payload.get("level_name", "Unknown Level"),
            match_payload.get("result", "Unknown"),
            parse_int(match_payload.get("score"), 0),
            duration,
            parse_int(match_payload.get("enemies_killed"), 0),
            parse_float(match_payload.get("damage_dealt"), 0),
            parse_float(match_payload.get("damage_taken"), 0),
            parse_float(match_payload.get("player_health_end"), 0),
            parse_float(match_payload.get("player_health_max"), 0),
            parse_int(match_payload.get("coins_collected"), 0),
            shots_fired,
            shots_hit,
            accuracy,
            started_at.isoformat(),
            ended_at.isoformat(),
        )
    ).lastrowid

    for weapon in normalize_weapon_stats(weapon_payload):
        db.execute(
            """
            INSERT INTO weapon_stats (
                match_id, weapon_name, kills, shots_fired, shots_hit,
                damage_dealt, usage_seconds, accuracy, efficiency
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                match_id, weapon["weapon_name"], weapon["kills"], weapon["shots_fired"],
                weapon["shots_hit"], weapon["damage_dealt"], weapon["usage_seconds"],
                weapon["accuracy"], weapon["efficiency"],
            )
        )

    for event in kill_payload:
        db.execute(
            """
            INSERT INTO kill_events (match_id, enemy_type, weapon_name, time_seconds, score_awarded)
            VALUES (?, ?, ?, ?, ?)
            """,
            (
                match_id,
                event.get("enemy_type", "Unknown"),
                event.get("weapon_name", "Unknown"),
                parse_int(event.get("time_seconds"), 0),
                parse_int(event.get("score_awarded"), 0),
            )
        )

    prune_player_match_history(db, player_id)
    db.commit()
    return ok({"match_id": match_id, "player_id": player_id, "accuracy": accuracy}, 201)


@app.get("/api/matches")
def get_matches():
    rows = get_db().execute(
        """
        SELECT m.*, p.username
        FROM matches m
        JOIN players p ON p.id = m.player_id
        ORDER BY m.started_at DESC
        """
    ).fetchall()
    return ok({"matches": [enrich_match(row) for row in rows]})


@app.get("/api/matches/<int:match_id>")
def get_match(match_id):
    db = get_db()
    match = db.execute(
        """
        SELECT m.*, p.username, p.level AS player_level
        FROM matches m
        JOIN players p ON p.id = m.player_id
        WHERE m.id = ?
        """,
        (match_id,)
    ).fetchone()
    if not match:
        return ok({"error": "Match not found"}, 404)

    weapons = db.execute("SELECT * FROM weapon_stats WHERE match_id = ? ORDER BY damage_dealt DESC", (match_id,)).fetchall()
    kills = db.execute("SELECT * FROM kill_events WHERE match_id = ? ORDER BY time_seconds ASC", (match_id,)).fetchall()
    return ok({
        "match": enrich_match(match),
        "weapon_stats": rows_to_dicts(weapons),
        "kill_events": rows_to_dicts(kills),
        "details": build_match_details(db, match_id),
    })


@app.get("/api/players/<int:player_id>/overview")
def player_overview(player_id):
    db = get_db()
    player_id = resolve_player_id(db, player_id)
    if player_id is None:
        return ok({"error": "Player not found"}, 404)

    player = db.execute("SELECT * FROM players WHERE id = ?", (player_id,)).fetchone()
    if not player:
        return ok({"error": "Player not found"}, 404)

    totals = db.execute(
        """
        SELECT
            COUNT(*) AS total_matches,
            COALESCE(SUM(score), 0) AS total_score,
            COALESCE(MAX(score), 0) AS high_score,
            COALESCE(SUM(enemies_killed), 0) AS total_kills,
            COALESCE(SUM(damage_dealt), 0) AS total_damage_dealt,
            COALESCE(SUM(coins_collected), 0) AS total_coins_collected,
            COALESCE(AVG(accuracy), 0) AS average_accuracy,
            COALESCE(AVG(duration_seconds), 0) AS average_duration,
            COALESCE(AVG(score), 0) AS average_score
        FROM matches
        WHERE player_id = ?
        """,
        (player_id,)
    ).fetchone()

    last_match = db.execute("SELECT * FROM matches WHERE player_id = ? ORDER BY started_at DESC LIMIT 1", (player_id,)).fetchone()
    weapon = db.execute(
        """
        SELECT ws.weapon_name, SUM(ws.usage_seconds) AS total_usage
        FROM weapon_stats ws
        JOIN matches m ON m.id = ws.match_id
        WHERE m.player_id = ?
        GROUP BY ws.weapon_name
        ORDER BY total_usage DESC
        LIMIT 1
        """,
        (player_id,)
    ).fetchone()

    comparison_rows = db.execute(
        """
        SELECT id, score, started_at
        FROM (
            SELECT id, score, started_at
            FROM matches
            WHERE player_id = ?
            ORDER BY started_at DESC
            LIMIT 8
        )
        ORDER BY started_at ASC
        """,
        (player_id,)
    ).fetchall()

    total = row_to_dict(totals)
    total["average_accuracy"] = round(total["average_accuracy"], 2)
    total["average_duration"] = round(total["average_duration"], 0)
    total["average_score"] = round(total["average_score"], 2)
    average_score = total["average_score"]
    last_score = comparison_rows[-1]["score"] if comparison_rows else 0
    performance = [
        {
            "label": f"#{index}",
            "last_match_score": last_score,
            "average_score": average_score,
        }
        for index, _ in enumerate(comparison_rows, start=1)
    ]
    if not performance:
        performance = [{"label": "No matches", "last_match_score": 0, "average_score": 0}]
    return ok({
        "player": row_to_dict(player),
        "totals": total,
        "last_match": enrich_match(last_match),
        "most_used_weapon": weapon["weapon_name"] if weapon else "N/A",
        "performance_comparison": performance,
    })


@app.get("/api/players/<int:player_id>/match-history")
def player_match_history(player_id):
    db = get_db()
    player_id = resolve_player_id(db, player_id)
    if player_id is None:
        return ok({"matches": []})

    prune_player_match_history(db, player_id)
    db.commit()

    rows = db.execute(
        """
        SELECT *
        FROM matches
        WHERE player_id = ?
        ORDER BY started_at DESC
        LIMIT 10
        """,
        (player_id,)
    ).fetchall()
    matches = []
    for row in rows:
        item = enrich_match(row)
        item["details"] = build_match_details(db, item["id"])
        matches.append(item)

    return ok({"matches": matches})


@app.get("/api/players/<int:player_id>/individual-performance/<int:match_id>")
def individual_performance(player_id, match_id):
    db = get_db()
    player_id = resolve_player_id(db, player_id)
    if player_id is None:
        return ok({"error": "Player not found"}, 404)

    match = db.execute("SELECT * FROM matches WHERE id = ? AND player_id = ?", (match_id, player_id)).fetchone()
    if not match:
        return ok({"error": "Match not found"}, 404)

    weapons = rows_to_dicts(db.execute("SELECT * FROM weapon_stats WHERE match_id = ? ORDER BY usage_seconds DESC", (match_id,)).fetchall())
    kills = rows_to_dicts(db.execute("SELECT * FROM kill_events WHERE match_id = ? ORDER BY time_seconds ASC", (match_id,)).fetchall())
    total_usage = max(sum(item["usage_seconds"] for item in weapons), 1)

    for weapon in weapons:
        weapon["usage_percent"] = round((weapon["usage_seconds"] / total_usage) * 100.0, 2)

    bins = build_kill_distribution(kills)
    accuracy_progression = build_accuracy_progression(match)
    radar = build_radar(match)

    return ok({
        "match": enrich_match(match),
        "weapon_stats": weapons,
        "kill_distribution": bins,
        "accuracy_progression": accuracy_progression,
        "performance_metrics": radar,
    })


@app.get("/api/leaderboard")
def leaderboard():
    rows = get_db().execute(
        """
        SELECT
            p.id AS player_id,
            p.username,
            p.level,
            COUNT(m.id) AS matches_played,
            COALESCE(SUM(m.score), 0) AS total_score,
            COALESCE(MAX(m.score), 0) AS high_score,
            COALESCE(SUM(m.enemies_killed), 0) AS kills,
            COALESCE(AVG(m.accuracy), 0) AS average_accuracy
        FROM players p
        LEFT JOIN matches m ON m.player_id = p.id
        GROUP BY p.id
        ORDER BY total_score DESC, high_score DESC
        LIMIT 10
        """
    ).fetchall()
    entries = []
    for index, row in enumerate(rows, start=1):
        item = row_to_dict(row)
        item["rank"] = index
        item["average_accuracy"] = round(item["average_accuracy"], 2)
        entries.append(item)
    return ok({"leaderboard": entries})


@app.get("/api/weapons/arsenal/<int:player_id>")
def weapon_arsenal(player_id):
    db = get_db()
    player_id = resolve_player_id(db, player_id)
    if player_id is None:
        return ok({"arsenal": []})

    rows = rows_to_dicts(db.execute(
        """
        SELECT
            ws.weapon_name,
            COALESCE(SUM(ws.kills), 0) AS kills,
            COALESCE(SUM(ws.shots_fired), 0) AS shots_fired,
            COALESCE(SUM(ws.shots_hit), 0) AS shots_hit,
            COALESCE(SUM(ws.damage_dealt), 0) AS damage_dealt,
            COALESCE(SUM(ws.usage_seconds), 0) AS usage_seconds,
            COALESCE(AVG(ws.efficiency), 0) AS efficiency
        FROM weapon_stats ws
        JOIN matches m ON m.id = ws.match_id
        WHERE m.player_id = ?
        GROUP BY ws.weapon_name
        """,
        (player_id,)
    ).fetchall())

    by_name = {row["weapon_name"]: row for row in rows}
    default_weapons = ["Pistol", "Machine Gun", "Shotgun", "Burst Rifle", "Laser Gun", "Rocket Launcher"]
    arsenal = []
    for weapon in default_weapons:
        item = by_name.get(weapon, {
            "weapon_name": weapon,
            "kills": 0,
            "shots_fired": 0,
            "shots_hit": 0,
            "damage_dealt": 0,
            "usage_seconds": 0,
            "efficiency": 0,
        })
        item["accuracy"] = calculate_accuracy(item["shots_hit"], item["shots_fired"])
        item["raw_efficiency"] = round(min(item["efficiency"], 100), 2)
        arsenal.append(item)

    efficiency_total = sum(float(item["raw_efficiency"] or 0) for item in arsenal)
    if efficiency_total > 0:
        remaining = 100.0
        for index, item in enumerate(arsenal):
            if index == len(arsenal) - 1:
                share = round(max(remaining, 0), 2)
            else:
                share = round((float(item["raw_efficiency"] or 0) / efficiency_total) * 100.0, 2)
                remaining = round(remaining - share, 2)
            item["efficiency_share"] = share
            item["mastery"] = share
    else:
        for item in arsenal:
            item["efficiency_share"] = 0
            item["mastery"] = 0

    return ok({"arsenal": arsenal})


def build_kill_distribution(kill_events):
    labels = ["0-3", "3-6", "6-9", "9-12", "12-15", "15-18"]
    bins = [{"interval": label, "kills": 0} for label in labels]
    for event in kill_events:
        minute = float(event["time_seconds"] or 0) / 60.0
        index = min(int(minute // 3), len(bins) - 1)
        bins[index]["kills"] += 1
    return bins


def build_accuracy_progression(match):
    final_accuracy = float(match["accuracy"] or 0)
    return [
        {"time": "0m", "accuracy": round(max(final_accuracy - 12, 35), 2)},
        {"time": "3m", "accuracy": round(max(final_accuracy - 7, 40), 2)},
        {"time": "6m", "accuracy": round(max(final_accuracy - 3, 45), 2)},
        {"time": "9m", "accuracy": round(min(final_accuracy + 1, 98), 2)},
        {"time": "12m", "accuracy": round(min(final_accuracy + 3, 98), 2)},
        {"time": "15m", "accuracy": round(final_accuracy, 2)},
    ]


def build_radar(match):
    accuracy = float(match["accuracy"] or 0)
    kills_per_min = calculate_kills_per_min(match["enemies_killed"], match["duration_seconds"])
    health_end = float(match["player_health_end"] or 0)
    health_max = float(match["player_health_max"] or 0)
    if health_max > 0:
        survival = max(0, min((health_end / health_max) * 100.0, 100))
    else:
        survival = max(0, 100 - float(match["damage_taken"] or 0) / 16.0)
    objective = 92 if match["result"] == "Victory" else 54
    score_per_minute = float(match["score"] or 0) / max(float(match["duration_seconds"] or 1) / 60.0, 1)
    efficiency = min(score_per_minute * 7.0, 100)
    coins_collected = int(match["coins_collected"] or 0)
    exploration = min((coins_collected / 10.0) * 100.0, 100)
    return [
        {"metric": "Accuracy", "value": round(accuracy, 2)},
        {"metric": "Aggression", "value": round(min(kills_per_min * 24, 100), 2)},
        {"metric": "Survival", "value": round(survival, 2)},
        {"metric": "Objective", "value": objective},
        {"metric": "Exploration", "value": round(exploration, 2)},
        {"metric": "Efficiency", "value": round(efficiency, 2)},
    ]


if __name__ == "__main__":
    bootstrap_database()
    app.run(host="127.0.0.1", port=5000, debug=True)
