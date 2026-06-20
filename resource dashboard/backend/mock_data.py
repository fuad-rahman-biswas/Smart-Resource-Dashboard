import math
import random
from datetime import datetime, timedelta

from database import init_db, get_db_connection


def _clear_existing_data(conn):
    """Remove any existing mock rows before inserting new sample data."""
    cursor = conn.cursor()
    cursor.execute("DELETE FROM usage_readings")
    cursor.execute("DELETE FROM alerts")
    cursor.execute("DELETE FROM thresholds")
    conn.commit()


def _seed_thresholds(conn):
    """Insert default threshold values for each tracked resource."""
    thresholds = [
        ("electricity", 450.0),
        ("water", 170.0),
        ("fuel", 180.0),
    ]
    cursor = conn.cursor()
    cursor.executemany(
        "INSERT INTO thresholds (resource_type, limit_value) VALUES (?, ?)",
        thresholds,
    )
    conn.commit()


def _time_of_day_multiplier(hour, peaks, base_level=0.35):
    """
    Smooth daily curve built from overlapping bell-shaped peaks.
    hour: 0-23.5 (fractional hours allowed)
    peaks: list of (peak_hour, width, height) tuples
    base_level: minimum multiplier so values never collapse to ~0
    """
    total = base_level
    for peak_hour, width, height in peaks:
        # wrap-around distance on a 24h clock
        diff = min(abs(hour - peak_hour), 24 - abs(hour - peak_hour))
        total += height * math.exp(-(diff ** 2) / (2 * width ** 2))
    return total


def _seed_usage_readings(conn):
    """Generate realistic usage readings for the last 30 days.

    Each resource follows a smooth time-of-day curve (so e.g. electricity
    is naturally low overnight and high in the evening, not random noise
    bouncing off zero) plus a slow autocorrelated drift (today's value is
    close to the previous reading, not independent each time) plus rare,
    clearly-distinct spikes.
    """
    now = datetime.utcnow()

    resources = {
        "electricity": {
            "unit": "kWh",
            "base": 6.0,
            # evening peak (cooking/AC/lights) + smaller morning peak
            "peaks": [(20, 3.0, 1.8), (8, 2.0, 0.6)],
            "noise_pct": 0.10,      # noise as % of that interval's expected value
            # how much previous reading pulls the next one (0-1)
            "drift_strength": 0.6,
            "spike_chance": 0.025,
            "spike_multiplier": (2.2, 3.5),
        },
        "water": {
            "unit": "L",
            "base": 3.0,
            # morning shower/cooking peak + evening peak
            "peaks": [(7, 1.5, 1.6), (19, 1.5, 1.0)],
            "noise_pct": 0.12,
            "drift_strength": 0.5,
            "spike_chance": 0.02,
            "spike_multiplier": (2.5, 4.0),
        },
        "fuel": {
            "unit": "L",
            "base": 2.5,
            # commute-shaped: morning + evening peaks, near-zero overnight
            "peaks": [(8, 1.5, 2.2), (18, 1.5, 1.8)],
            "noise_pct": 0.15,
            "drift_strength": 0.4,
            "spike_chance": 0.015,
            "spike_multiplier": (2.5, 4.0),
        },
    }

    interval_hours = 1  # finer resolution so the daily curve is visible, not jagged
    total_intervals = 30 * 24 // interval_hours

    # build oldest -> newest so drift/autocorrelation flows forward in time naturally
    timestamps = [
        now - timedelta(hours=(total_intervals - 1 - i) * interval_hours)
        for i in range(total_intervals)
    ]

    values = []
    last_value = {r: cfg["base"] for r, cfg in resources.items()}

    for timestamp in timestamps:
        hour = timestamp.hour + timestamp.minute / 60.0
        formatted_ts = timestamp.strftime("%Y-%m-%d %H:%M:%S")

        for resource_type, config in resources.items():
            expected = config["base"] * \
                _time_of_day_multiplier(hour, config["peaks"])

            # pull this reading toward the time-of-day curve, but keep some
            # memory of the previous reading so it doesn't jump around
            target = (
                config["drift_strength"] * last_value[resource_type]
                + (1 - config["drift_strength"]) * expected
            )

            noise = random.gauss(0, expected * config["noise_pct"])
            value = target + noise

            is_spike = random.random() < config["spike_chance"]
            if is_spike:
                value = expected * random.uniform(*config["spike_multiplier"])

            # gentle floor, never exactly 0
            value = max(value, config["base"] * 0.15)
            value = round(value, 2)

            values.append((resource_type, value, config["unit"], formatted_ts))
            last_value[resource_type] = value

    cursor = conn.cursor()
    cursor.executemany(
        "INSERT INTO usage_readings (resource_type, value, unit, timestamp) VALUES (?, ?, ?, ?)",
        values,
    )
    conn.commit()


def _seed_alerts(conn):
    """Insert sample alerts with timestamps that look recent."""
    now = datetime.utcnow()
    alerts = [
        (
            "electricity",
            "high",
            "Crossed 450 kWh threshold — 5.2% over limit.",
            (now - timedelta(hours=2)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "water",
            "warning",
            "Water usage entering elevated range for the cooling loop.",
            (now - timedelta(hours=6)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "fuel",
            "warning",
            "Backup generator fuel draw is 14% higher than yesterday.",
            (now - timedelta(days=1, hours=3)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
        (
            "electricity",
            "high",
            "Sudden electricity spike detected in Building A distribution bus.",
            (now - timedelta(days=2, hours=5)).strftime("%Y-%m-%d %H:%M:%S"),
        ),
    ]

    cursor = conn.cursor()
    cursor.executemany(
        "INSERT INTO alerts (resource_type, severity, message, timestamp) VALUES (?, ?, ?, ?)",
        alerts,
    )
    conn.commit()


def populate_mock_data():
    """Initialize the SQLite database and insert mock sample data."""
    conn = init_db()
    _clear_existing_data(conn)
    _seed_thresholds(conn)
    _seed_usage_readings(conn)
    _seed_alerts(conn)
    conn.close()


if __name__ == "__main__":
    populate_mock_data()
    print("Mock database populated in resource_dashboard.db")
