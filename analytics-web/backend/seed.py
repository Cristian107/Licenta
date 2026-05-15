from datetime import datetime

from database import hash_password


CLEANUP_META_KEY = "demo_matches_removed_v3"
DEFAULT_USERS = [
    ("player1", "player1", "player"),
    ("player2", "player2", "player"),
    ("player3", "player3", "player"),
    ("player4", "player4", "player"),
    ("admin1", "admin1", "admin"),
    ("admin2", "admin2", "admin"),
]


def role_for_username(username, fallback="player"):
    return "admin" if "admin" in str(username or "").lower() else fallback


def ensure_default_users(db):
    for username, password, role in DEFAULT_USERS:
        role = role_for_username(username, role)
        salt, password_hash = hash_password(password)
        existing = db.execute("SELECT id FROM users WHERE username = ?", (username,)).fetchone()
        if existing:
            db.execute(
                "UPDATE users SET password_hash = ?, password_salt = ?, role = ? WHERE id = ?",
                (password_hash, salt, role, existing["id"])
            )
            continue

        db.execute(
            "INSERT INTO users (username, password_hash, password_salt, role, created_at) VALUES (?, ?, ?, ?, ?)",
            (username, password_hash, salt, role, datetime.utcnow().isoformat())
        )


def ensure_player_rows(db):
    legacy = db.execute("SELECT id FROM players WHERE username = ?", ("PlayerOne",)).fetchone()
    if legacy:
        db.execute("UPDATE players SET username = ?, level = ? WHERE id = ?", ("player1", 1, legacy["id"]))

    for username, _, _ in DEFAULT_USERS:
        player = db.execute("SELECT id FROM players WHERE username = ?", (username,)).fetchone()
        if player:
            continue

        db.execute(
            "INSERT INTO players (username, level, created_at) VALUES (?, ?, ?)",
            (username, 1, datetime.utcnow().isoformat())
        )


def remove_demo_matches_once(db):
    done = db.execute("SELECT value FROM app_meta WHERE key = ?", (CLEANUP_META_KEY,)).fetchone()
    if done:
        return

    db.execute("DELETE FROM kill_events")
    db.execute("DELETE FROM weapon_stats")
    db.execute("DELETE FROM matches")
    db.execute("DELETE FROM sqlite_sequence WHERE name IN ('kill_events', 'weapon_stats', 'matches')")
    db.execute("INSERT OR REPLACE INTO app_meta (key, value) VALUES (?, ?)", (CLEANUP_META_KEY, datetime.utcnow().isoformat()))


def seed_base_data(db):
    ensure_default_users(db)
    ensure_player_rows(db)
    remove_demo_matches_once(db)
    db.commit()
