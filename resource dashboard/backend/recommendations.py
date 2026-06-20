def get_tips(resource_type):
    """Return static energy optimization tips for the requested resource."""
    resource_type = (resource_type or "").strip().lower()

    tips = {
        "electricity": [
            "Shift HVAC loads to off-peak hours to reduce peak demand charges.",
            "Audit standby power — idle equipment often draws 8–12% of total consumption.",
            "Replace older lighting with LEDs for up to 60% energy savings."
        ],
        "water": [
            "Fix leaks promptly — a small drip can waste hundreds of liters per day.",
            "Install low-flow fixtures and reuse cooling water where possible.",
            "Irrigate early in the morning to minimize evaporation losses."
        ],
        "fuel": [
            "Keep engines tuned and tires inflated to improve fuel efficiency.",
            "Avoid prolonged idling by switching off generators and vehicles when idle.",
            "Schedule route planning to minimize stop-and-go driving and reduce fuel use."
        ]
    }

    return tips.get(resource_type, [])
