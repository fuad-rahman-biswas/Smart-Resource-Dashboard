from datetime import datetime, timedelta
from database import get_db_connection


def _normalize_series(labels, raw_values):
    """Return a data list aligned to the requested labels."""
    return [round(raw_values.get(label, 0.0), 2) for label in labels]


def _build_daily_labels(end_time):
    """Create 24 hourly labels for the last 24 hours."""
    return [(end_time - timedelta(hours=hour)).strftime("%H:%M") for hour in reversed(range(24))]


def _build_weekly_labels(end_time):
    """Create 7 weekday labels for the last 7 days."""
    return [
        (end_time - timedelta(days=day)).strftime("%a")
        for day in reversed(range(7))
    ]


def _build_monthly_labels():
    """Create 4 weekly labels for a 4-week view."""
    return [f"Week {index + 1}" for index in range(4)]


def get_historical_data(resource_type, timeframe):
    """Return labels and data arrays for Chart.js based on the requested timeframe."""
    conn = get_db_connection()
    cursor = conn.cursor()

    # --- TIME ANCHOR FIX ---
    # Find the most recent timestamp in the database for this resource
    cursor.execute(
        "SELECT MAX(timestamp) as max_ts FROM usage_readings WHERE resource_type = ?",
        (resource_type,)
    )
    row = cursor.fetchone()

    # Anchor 'now' to the database's timeline instead of real-world UTC
    if row and row["max_ts"]:
        try:
            now = datetime.strptime(row["max_ts"], "%Y-%m-%d %H:%M:%S")
        except ValueError:
            now = datetime.utcnow()
    else:
        now = datetime.utcnow()
    # -----------------------

    if timeframe == "daily":
        start_time = now - timedelta(hours=24)
        labels = _build_daily_labels(now)
        cursor.execute(
            "SELECT value, timestamp FROM usage_readings "
            "WHERE resource_type = ? AND timestamp >= ? "
            "ORDER BY timestamp ASC",
            (resource_type, start_time.strftime("%Y-%m-%d %H:%M:%S")),
        )

        hourly_totals = {}
        hourly_counts = {}
        for row in cursor.fetchall():
            hour_label = datetime.strptime(
                row["timestamp"], "%Y-%m-%d %H:%M:%S").strftime("%H:%M")
            hourly_totals[hour_label] = hourly_totals.get(
                hour_label, 0.0) + row["value"]
            hourly_counts[hour_label] = hourly_counts.get(hour_label, 0) + 1

        averaged = {
            label: (hourly_totals[label] / hourly_counts[label])
            for label in hourly_totals
        }
        data = _normalize_series(labels, averaged)

    elif timeframe == "weekly":
        start_time = now - timedelta(days=7)
        labels = _build_weekly_labels(now)
        cursor.execute(
            "SELECT value, timestamp FROM usage_readings "
            "WHERE resource_type = ? AND timestamp >= ? "
            "ORDER BY timestamp ASC",
            (resource_type, start_time.strftime("%Y-%m-%d %H:%M:%S")),
        )

        daily_totals = {}
        for row in cursor.fetchall():
            day_label = datetime.strptime(
                row["timestamp"], "%Y-%m-%d %H:%M:%S").strftime("%a")
            daily_totals[day_label] = daily_totals.get(
                day_label, 0.0) + row["value"]

        data = _normalize_series(labels, daily_totals)

    elif timeframe == "monthly":
        start_time = now - timedelta(days=28)
        labels = _build_monthly_labels()
        cursor.execute(
            "SELECT value, timestamp FROM usage_readings "
            "WHERE resource_type = ? AND timestamp >= ? "
            "ORDER BY timestamp ASC",
            (resource_type, start_time.strftime("%Y-%m-%d %H:%M:%S")),
        )

        bucket_totals = {label: 0.0 for label in labels}
        bucket_counts = {label: 0 for label in labels}

        for row in cursor.fetchall():
            reading_time = datetime.strptime(
                row["timestamp"], "%Y-%m-%d %H:%M:%S")
            days_since_start = (reading_time.date() - start_time.date()).days
            bucket_index = min(days_since_start // 7, 3)
            bucket_label = labels[bucket_index]
            bucket_totals[bucket_label] += row["value"]
            bucket_counts[bucket_label] += 1

        averaged = {
            label: (bucket_totals[label] / bucket_counts[label])
            if bucket_counts[label] > 0 else 0.0
            for label in labels
        }
        data = _normalize_series(labels, averaged)

    else:
        raise ValueError(
            "Unsupported timeframe. Use 'daily', 'weekly', or 'monthly'.")

    conn.close()
    return {"labels": labels, "data": data}


def get_recent_alerts(limit=5):
    """Fetch the latest alerts from the database."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT resource_type, severity, message, timestamp "
        "FROM alerts ORDER BY timestamp DESC LIMIT ?",
        (limit,),
    )
    alerts = [dict(row) for row in cursor.fetchall()]
    conn.close()
    return alerts


def get_thresholds():
    """Fetch the saved resource thresholds as a resource-to-limit mapping."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT resource_type, limit_value FROM thresholds")
    thresholds = {
        row["resource_type"]: row["limit_value"]
        for row in cursor.fetchall()
    }
    conn.close()
    return thresholds


def update_threshold(resource_type, new_limit):
    """Insert or update a threshold for a given resource."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "INSERT OR REPLACE INTO thresholds (resource_type, limit_value) VALUES (?, ?)",
        (resource_type, float(new_limit)),
    )
    conn.commit()
    conn.close()
    return True
