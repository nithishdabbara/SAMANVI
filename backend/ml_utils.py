# ml_utils.py

CRITICAL_KEYWORDS = [
    'fire', 'flood', 'collapse', 'gas leak', 'explosion',
    'injury', 'bleeding', 'unconscious', 'emergency',
    'electric shock', 'short circuit', 'wire burst',
    'manhole open', 'road cave', 'building crack', 'burst',
    'accident', 'blocked', 'broken wire', 'loose wire',
    'live wire', 'hanging wire', 'wire'
]

HIGH_KEYWORDS = [
    'broken', 'dangerous', 'urgent', 'leak',
    'dark', 'unsafe', 'attack',
    'stray dog', 'pothole', 'overflow', 'smells', 'dead'
]

LOW_KEYWORDS = [
    'minor', 'small', 'little', 'slight', 'faded',
    'request', 'suggestion', 'when possible'
]

def predict_urgency(text):
    text_lower = text.lower()

    if any(w in text_lower for w in CRITICAL_KEYWORDS):
        return {"level": "Critical", "confidence": 95}
    if any(w in text_lower for w in HIGH_KEYWORDS):
        return {"level": "High", "confidence": 80}
    if any(w in text_lower for w in LOW_KEYWORDS):
        return {"level": "Low", "confidence": 70}
    return {"level": "Medium", "confidence": 65}
