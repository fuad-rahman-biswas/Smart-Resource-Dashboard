import os
import sqlite3
from pathlib import Path

DB_FILENAME = "resource_dashboard.db"


def get_db_path():
    """Return the full path to the SQLite database file."""
    return Path(__file__).resolve().parent / DB_FILENAME


def get_db_connection():
    """Open a SQLite connection and configure row factory."""
    conn = sqlite3.connect(get_db_path(), detect_types=sqlite3.PARSE_DECLTYPES)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database and create required tables if missing."""
    conn = get_db_connection()
    cursor = conn.cursor()

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS usage_readings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_type TEXT NOT NULL,
            value REAL NOT NULL,
            unit TEXT NOT NULL,
            timestamp DATETIME NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS alerts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            resource_type TEXT NOT NULL,
            severity TEXT NOT NULL,
            message TEXT NOT NULL,
            timestamp DATETIME NOT NULL
        )
        """
    )

    cursor.execute(
        """
        CREATE TABLE IF NOT EXISTS thresholds (
            resource_type TEXT PRIMARY KEY,
            limit_value REAL NOT NULL
        )
        """
    )

    conn.commit()
    return conn
