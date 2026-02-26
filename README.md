# 🤖 Qwen AI Chat

A sleek, open-source chatbot powered by **Qwen2.5-Coder-14B-Instruct** — hosted free on Kaggle GPU, with a premium Next.js frontend deployable to Vercel.

> **Free GPU + Free Hosting = Your own AI chatbot at $0 cost.**

---

## ✨ Features

- 🧠 **Qwen2.5-Coder-14B** — powerful coding & general AI model
- ⚡ **Streaming responses** — tokens appear in real-time
- 🌙 **Premium dark UI** — glassmorphism, animations, responsive
- 🔑 **Bring your own API** — anyone can connect their own Kaggle backend
- 🚀 **One-click Vercel deploy** — no server management needed

---

## 🏗️ Architecture

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Vercel     │────▶│  Next.js API  │────▶│  Kaggle Notebook │
│  (Frontend)  │◀────│   (Proxy)     │◀────│  (LLM + ngrok)  │
└─────────────┘     └──────────────┘     └─────────────────┘
     Browser           Edge Runtime         T4 GPU / Free
```

---

## 🚀 Quick Start

### Step 1: Set Up the AI Backend on Kaggle

1. Go to [kaggle.com](https://www.kaggle.com) → **New Notebook**
2. Enable **GPU** (Settings → Accelerator → GPU T4 x2)
3. Enable **Internet** (Settings → Internet → On)
4. Paste this code into a notebook cell:

```python
# Cell 1: Install dependencies & download model
!pip uninstall -y llama-cpp-python
!pip install pyngrok openai huggingface_hub -q
!pip install llama-cpp-python[server] \
  --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121 \
  -q --no-cache-dir

from huggingface_hub import hf_hub_download

print("⏳ Downloading model...")
model_path = hf_hub_download(
    repo_id="Qwen/Qwen2.5-Coder-14B-Instruct-GGUF",
    filename="qwen2.5-coder-14b-instruct-q4_k_m.gguf",
    cache_dir="/kaggle/working/models"
)
print(f"✅ Model downloaded: {model_path}")
```

```python
# Cell 2: Start ngrok tunnel
from pyngrok import ngrok

NGROK_TOKEN = "YOUR_NGROK_TOKEN"  # Get free at https://ngrok.com
API_KEY = "your-secret-api-key"    # Choose any password

ngrok.set_auth_token(NGROK_TOKEN)
ngrok.kill()

public_url = ngrok.connect(8000)
public_url_str = str(public_url).replace('"', '')

print("=" * 60)
print(f"🌐 API URL: {public_url_str}/v1")
print(f"🔑 API KEY: {API_KEY}")
print("=" * 60)
```

```python
# Cell 3: Start the LLM server
import subprocess, os

server = subprocess.Popen([
    "python", "-m", "llama_cpp.server",
    "--model", model_path,
    "--host", "0.0.0.0",
    "--port", "8000",
    "--n_gpu_layers", "-1",
    "--n_ctx", "8192",
    "--chat_format", "chatml-function-calling",
    "--api_key", API_KEY,
],
    stdout=open("/tmp/llm_server.log", "w"),
    stderr=subprocess.STDOUT,
    env={**os.environ, "CUDA_VISIBLE_DEVICES": "0,1"}
)
print("⏳ Starting server... (30-60 seconds)")
```

```python
# Cell 4: Wait until ready
import requests, time

for i in range(60):
    try:
        r = requests.get(
            "http://localhost:8000/v1/models",
            headers={"Authorization": f"Bearer {API_KEY}"},
            timeout=5
        )
        if r.status_code == 200:
            print(f"\n✅ SERVER IS READY!")
            print(f"🌐 URL: {public_url_str}")
            print(f"🔑 Key: {API_KEY}")
            break
    except:
        pass
    print(f"   Loading... ({(i+1)*3}s)")
    time.sleep(3)
```

5. Copy the **ngrok URL** and **API Key** from the output

> 💡 **Get a free ngrok token** at [dashboard.ngrok.com/signup](https://dashboard.ngrok.com/signup)

---

### Step 2: Deploy the Frontend to Vercel

1. **Fork/clone** this repo and push to your GitHub
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → Import your repo
3. Click **Deploy** (no env vars needed — users enter their own keys)
4. Your chatbot is live! 🎉

---

### Step 3: Connect & Chat

1. Open your deployed Vercel site
2. Click **⚙️ Settings**
3. Paste your **ngrok URL** and **API Key**
4. Start chatting!

---

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run locally
npm run dev

# Build for production
npm run build
```

---

## 📁 Project Structure

```
chatbot/
├── src/app/
│   ├── api/chat/route.ts   # API proxy (streams to Kaggle)
│   ├── globals.css          # Dark theme + animations
│   ├── layout.tsx           # Root layout + SEO
│   └── page.tsx             # Chat UI + settings modal
├── .gitignore
├── package.json
└── README.md
```

---

## ❓ FAQ

**Q: The ngrok URL changed after I restarted the notebook?**
A: That's normal. Just open Settings (⚙️) and paste the new URL.

**Q: Can I use a different model?**
A: Yes! Change the `repo_id` and `filename` in Cell 1 to any GGUF model on HuggingFace.

**Q: How long does the Kaggle session last?**
A: Kaggle GPU sessions last up to 12 hours. After that, restart the notebook.

**Q: Is this truly free?**
A: Yes — Kaggle gives free GPU, Vercel gives free hosting, ngrok gives a free tunnel.

---

## 📜 License

MIT — use it however you want.
