from flask import Flask, jsonify, request
from flask_cors import CORS

import database
import models

app = Flask(__name__)

# Enable Cross-Origin Resource Sharing so port 5500 can talk to port 5000
CORS(app)

# ─── ENDPOINTS ───────────────────────────────────────────


@app.route('/api/thresholds', methods=['GET', 'POST'])
def thresholds():
    """
    GET returns saved thresholds.
    POST accepts: {"resource_type": "electricity", "new_limit": 500}
    """
    if request.method == 'GET':
        return jsonify(models.get_thresholds())

    data = request.get_json()

    # 1. Validate that the required data was sent
    if not data or 'resource_type' not in data or 'new_limit' not in data:
        return jsonify({"error": "Missing 'resource_type' or 'new_limit' in request"}), 400

    resource_type = data['resource_type']
    new_limit = data['new_limit']

    try:
        # 2. Call the function from your models layer
        # (Assuming update_threshold is in models.py. Adjust the import namespace if it's in database.py)
        success = models.update_threshold(resource_type, new_limit)

        if success:
            return jsonify({"message": f"Threshold for {resource_type} updated successfully to {new_limit}."}), 200
        else:
            return jsonify({"error": "Failed to update threshold in the database."}), 500

    except ValueError:
        return jsonify({"error": "Invalid limit value. Must be a numeric value."}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route('/api/dashboard', methods=['GET'])
def get_dashboard_data():
    """
    Returns the daily, weekly, and monthly chart data from SQLite.
    """
    response = {
        "daily": models.get_historical_data("electricity", "daily"),
        "weekly": models.get_historical_data("electricity", "weekly"),
        "monthly": models.get_historical_data("electricity", "monthly"),
    }

    # Build combined response for all resources using the same timeframe structure
    response = {
        "daily": {
            "labels": response["daily"]["labels"],
            "electricity": response["daily"]["data"],
            "water": models.get_historical_data("water", "daily")["data"],
            "fuel": models.get_historical_data("fuel", "daily")["data"],
        },
        "weekly": {
            "labels": response["weekly"]["labels"],
            "electricity": response["weekly"]["data"],
            "water": models.get_historical_data("water", "weekly")["data"],
            "fuel": models.get_historical_data("fuel", "weekly")["data"],
        },
        "monthly": {
            "labels": response["monthly"]["labels"],
            "electricity": response["monthly"]["data"],
            "water": models.get_historical_data("water", "monthly")["data"],
            "fuel": models.get_historical_data("fuel", "monthly")["data"],
        }
    }

    return jsonify(response)


@app.route('/api/alerts', methods=['GET'])
def get_alerts():
    """
    Returns the most recent system alerts from SQLite.
    """
    alerts = models.get_recent_alerts(limit=5)
    return jsonify(alerts)


# ─── RUN SERVER ──────────────────────────────────────────

if __name__ == '__main__':
    # Ensure database tables exist before serving requests
    database.init_db()
    app.run(debug=True, port=5000)
