import os
import sys
import nest_asyncio
import uvicorn
from pyngrok import ngrok

# 1. Locate and set working directory
if os.path.exists("/content/app"):
    project_dir = "/content"
else:
    subdirs = [os.path.join("/content", d) for d in os.listdir("/content") if os.path.isdir(os.path.join("/content", d))]
    project_dir = next((d for d in subdirs if os.path.exists(os.path.join(d, "app"))), "/content")

print(f"📁 Working Directory set to: {project_dir}")
os.chdir(project_dir)
if project_dir not in sys.path:
    sys.path.insert(0, project_dir)

# 2. Patch asyncio event loop for Colab/Jupyter
nest_asyncio.apply()

# 3. Authenticate & launch Ngrok tunnel (token via env var - never hardcode)
NGROK_AUTHTOKEN = os.getenv("NGROK_AUTHTOKEN", "YOUR_NGROK_AUTHTOKEN")
if NGROK_AUTHTOKEN and NGROK_AUTHTOKEN != "YOUR_NGROK_AUTHTOKEN":
    ngrok.set_auth_token(NGROK_AUTHTOKEN)

port = 8000
public_url = ngrok.connect(port)

print("\n" + "="*60)
print(f"🚀 LIVE AI SERVICE URL: {public_url.public_url}")
print(f"📄 SWAGGER DOCUMENTATION: {public_url.public_url}/docs")
print("="*60 + "\n")

# 4. Boot Uvicorn Server using Jupyter-compatible event loop attachment
config = uvicorn.Config("app.main:app", host="0.0.0.0", port=port, reload=False)
server = uvicorn.Server(config)

await server.serve()