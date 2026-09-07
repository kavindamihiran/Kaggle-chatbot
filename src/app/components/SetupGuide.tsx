"use client";

import CodeCell from "./CodeCell";
import { IconClose, IconExternal } from "./Icons";

const CELL_1 = `# Cell 1 — install dependencies & download the model
!pip uninstall -y llama-cpp-python
!pip install pyngrok openai huggingface_hub -q
!pip install llama-cpp-python[server] --extra-index-url https://abetlen.github.io/llama-cpp-python/whl/cu121 -q --no-cache-dir

from huggingface_hub import hf_hub_download

print("Downloading model...")
model_path = hf_hub_download(
    repo_id="Qwen/Qwen2.5-Coder-14B-Instruct-GGUF",
    filename="qwen2.5-coder-14b-instruct-q4_k_m.gguf",
    cache_dir="/kaggle/working/models"
)
print("Model downloaded:", model_path)`;

const CELL_2 = `# Cell 2 — open the ngrok tunnel
from pyngrok import ngrok

NGROK_TOKEN = "YOUR_NGROK_TOKEN"   # free at ngrok.com
API_KEY = "your-secret-api-key"    # any password you choose

ngrok.set_auth_token(NGROK_TOKEN)
ngrok.kill()

public_url = ngrok.connect(8000)
public_url_str = str(public_url).replace('"', '')

print("=" * 60)
print("API URL:", public_url_str)
print("API KEY:", API_KEY)
print("=" * 60)`;

const CELL_3 = `# Cell 3 — start the model server
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
print("Starting server... (30-60 seconds)")`;

const CELL_4 = `# Cell 4 — wait until the server answers
import requests, time

for i in range(60):
    try:
        r = requests.get(
            "http://localhost:8000/v1/models",
            headers={"Authorization": "Bearer " + API_KEY},
            timeout=5
        )
        if r.status_code == 200:
            print("SERVER IS READY")
            print("URL:", public_url_str)
            print("Key:", API_KEY)
            break
    except Exception:
        pass
    print("Loading... (" + str((i + 1) * 3) + "s)")
    time.sleep(3)`;

export default function SetupGuide({
  onClose,
  onOpenSettings,
}: {
  onClose: () => void;
  onOpenSettings: () => void;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal modal-wide"
        role="dialog"
        aria-modal="true"
        aria-label="Kaggle setup guide"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-head">
          <div>
            <h2>Run the model on Kaggle</h2>
            <p className="modal-desc">
              Kaggle gives you a free T4 GPU for up to 12 hours a session. You
              run the model there and point this chat at it — nothing to install
              locally.
            </p>
          </div>
          <button className="icon-btn ghost" onClick={onClose} aria-label="Close guide">
            <IconClose />
          </button>
        </header>

        <div className="guide-body">
          <section className="guide-step">
            <span className="step-num">1</span>
            <div className="step-body">
              <h3>Get an ngrok token</h3>
              <p>
                ngrok exposes the notebook&apos;s local server as a public URL.
                Sign up free and copy the authtoken from your dashboard.
              </p>
              <a
                className="link-out"
                href="https://dashboard.ngrok.com/signup"
                target="_blank"
                rel="noopener noreferrer"
              >
                dashboard.ngrok.com/signup <IconExternal />
              </a>
            </div>
          </section>

          <section className="guide-step">
            <span className="step-num">2</span>
            <div className="step-body">
              <h3>Create the notebook</h3>
              <p>
                On Kaggle, open <strong>Create → New Notebook</strong>, then in
                the right-hand panel set:
              </p>
              <ul className="step-list">
                <li>
                  <strong>Accelerator</strong> → GPU T4 x2
                </li>
                <li>
                  <strong>Internet</strong> → On (needed to download the model
                  and open the tunnel)
                </li>
              </ul>
              <p className="note">
                Internet access requires a phone-verified Kaggle account — verify
                under Settings if the toggle is greyed out.
              </p>
              <a
                className="link-out"
                href="https://www.kaggle.com/code"
                target="_blank"
                rel="noopener noreferrer"
              >
                kaggle.com/code <IconExternal />
              </a>
            </div>
          </section>

          <section className="guide-step">
            <span className="step-num">3</span>
            <div className="step-body">
              <h3>Run these four cells in order</h3>
              <p>
                Paste each into its own cell. Set <code>NGROK_TOKEN</code> and
                pick your own <code>API_KEY</code> in cell 2 before running it.
              </p>
              <CodeCell label="Cell 1 · install & download" code={CELL_1} />
              <CodeCell label="Cell 2 · tunnel" code={CELL_2} />
              <CodeCell label="Cell 3 · start server" code={CELL_3} />
              <CodeCell label="Cell 4 · health check" code={CELL_4} />
            </div>
          </section>

          <section className="guide-step">
            <span className="step-num">4</span>
            <div className="step-body">
              <h3>Connect this chat</h3>
              <p>
                Cell 4 prints the ngrok URL and your key once the server is
                ready. Paste both into Settings and save — they are stored in
                your browser only, and <code>/v1</code> is appended for you.
              </p>
              <button className="btn btn-primary" onClick={onOpenSettings}>
                Open settings
              </button>
            </div>
          </section>

          <section className="guide-faq">
            <h3>Good to know</h3>
            <dl>
              <div>
                <dt>The URL changed after a restart</dt>
                <dd>
                  Expected — a free ngrok tunnel gets a new URL each run. Paste
                  the new one into Settings.
                </dd>
              </div>
              <div>
                <dt>The session ended</dt>
                <dd>
                  Kaggle GPU sessions stop after ~12 hours, and idle notebooks
                  shut down sooner. Re-run the cells to bring it back.
                </dd>
              </div>
              <div>
                <dt>Using a different model</dt>
                <dd>
                  Change <code>repo_id</code> and <code>filename</code> in cell 1
                  to any GGUF model on Hugging Face that fits in GPU memory.
                </dd>
              </div>
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}
