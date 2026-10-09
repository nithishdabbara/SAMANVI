"""ASGI entry point (uvicorn server:app).  The sprint blueprint is registered once, inside app.py."""
from asgiref.wsgi import WsgiToAsgi
from app import app as flask_app

app = WsgiToAsgi(flask_app)
