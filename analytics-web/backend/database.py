import os
import hashlib
import hmac
import secrets
import sqlite3
from flask import g

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATABASE_PATH = os.path.join(BASE_DIR, "game_analytics.db")
SCHEMA_PATH = os.path.join(BASE_DIR, "schema.sql")
PASSWORD_ITERATIONS = 120_000


def get_db():
    if "db" not in g:
        connection = sqlite3.connect(DATABASE_PATH)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        g.db = connection
    return g.db


def close_db(error=None):
    connection = g.pop("db", None)
    if connection is not None:
        connection.close()


def init_db():
    os.makedirs(BASE_DIR, exist_ok=True)
    with sqlite3.connect(DATABASE_PATH) as connection:
        with open(SCHEMA_PATH, "r", encoding="utf-8") as schema_file:
            connection.executescript(schema_file.read())
        ensure_column(connection, "matches", "coins_collected", "INTEGER NOT NULL DEFAULT 0")
        ensure_column(connection, "matches", "player_health_end", "REAL NOT NULL DEFAULT 0")
        ensure_column(connection, "matches", "player_health_max", "REAL NOT NULL DEFAULT 0")
        ensure_column(connection, "users", "is_banned", "INTEGER NOT NULL DEFAULT 0")


def ensure_column(connection, table, column, definition):
    columns = [row[1] for row in connection.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in columns:
        connection.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")


def row_to_dict(row):
    return dict(row) if row is not None else None


def rows_to_dicts(rows):
    return [row_to_dict(row) for row in rows]


def calculate_accuracy(shots_hit, shots_fired):
    shots_hit = int(shots_hit or 0)
    shots_fired = int(shots_fired or 0)
    if shots_fired <= 0:
        return 0.0
    return round((shots_hit / shots_fired) * 100.0, 2)


def calculate_kills_per_min(enemies_killed, duration_seconds):
    minutes = max(float(duration_seconds or 0) / 60.0, 0.01)
    return round(float(enemies_killed or 0) / minutes, 2)


def calculate_weapon_efficiency(kills, accuracy, damage_dealt, usage_seconds):
    usage_minutes = max(float(usage_seconds or 0) / 60.0, 0.25)
    kill_pressure = float(kills or 0) / usage_minutes * 18.0
    accuracy_score = float(accuracy or 0) * 0.35
    damage_score = min(float(damage_dealt or 0) / max(float(usage_seconds or 1), 1.0) * 1.25, 35.0)
    return round(min(kill_pressure + accuracy_score + damage_score, 100.0), 2)


def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac(
        "sha256",
        str(password or "").encode("utf-8"),
        salt.encode("utf-8"),
        PASSWORD_ITERATIONS,
    ).hex()
    return salt, digest


def verify_password(password, salt, expected_hash):
    _, digest = hash_password(password, salt)
    return hmac.compare_digest(digest, expected_hash or "")
