import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages, apiUrl, apiKey: clientApiKey } = await req.json();

    if (!apiUrl) {
      return new Response(
        JSON.stringify({
          error:
            "API URL not configured. Open Settings to set your ngrok URL and API Key.",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }

    const apiKey = clientApiKey || process.env.API_KEY || "";

    let baseUrl = apiUrl.replace(/\/+$/, "");
    if (!baseUrl.endsWith("/v1")) {
      baseUrl += "/v1";
    }

    // Abort if the upstream model server doesn't respond within 55 s
    const upstream = new AbortController();
    const upstreamTimeout = setTimeout(() => upstream.abort(), 55000);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "ngrok-skip-browser-warning": "true",
          "User-Agent": "QwenChatBot/1.0",
        },
        signal: upstream.signal,
        body: JSON.stringify({
          model: "qwen2.5-coder-14b-instruct",
          messages: [
            {
              role: "system",
              content:
                "You are a helpful AI assistant powered by Qwen2.5-Coder-14B. You are knowledgeable, concise, and friendly. Format your responses using markdown when appropriate.",
            },
            ...messages,
          ],
          max_tokens: 2048,
          temperature: 0.7,
          stream: true,
        }),
      });
    } catch (fetchErr: unknown) {
      clearTimeout(upstreamTimeout);
      const isTimeout =
        fetchErr instanceof DOMException && fetchErr.name === "AbortError";
      return new Response(
        JSON.stringify({
          error: isTimeout
            ? "Model server timed out (55 s). Make sure your Kaggle notebook is still running."
            : `Cannot reach the model server: ${
                fetchErr instanceof Error ? fetchErr.message : "unknown error"
              }`,
        }),
        { status: 504, headers: { "Content-Type": "application/json" } },
      );
    } finally {
      clearTimeout(upstreamTimeout);
    }

    if (!response.ok) {
      const errorText = await response.text();

      if (errorText.includes("<html") || errorText.includes("ngrok")) {
        return new Response(
          JSON.stringify({
            error:
              "Ngrok tunnel returned HTML instead of JSON. The tunnel may have expired — restart your Kaggle notebook.",
          }),
          { status: 502, headers: { "Content-Type": "application/json" } },
        );
      }

      return new Response(
        JSON.stringify({
          error: `API Error (${response.status}): ${errorText.substring(0, 200) || "Connection failed"}`,
        }),
        {
          status: response.status,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    // Check if we got HTML back (ngrok warning page on 200)
    const ct = response.headers.get("content-type") || "";
    if (ct.includes("text/html")) {
      return new Response(
        JSON.stringify({
          error:
            "Received HTML from ngrok instead of JSON. Restart your Kaggle notebook to get a fresh tunnel.",
        }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    const body = response.body;
    if (!body) {
      return new Response(
        JSON.stringify({ error: "No response body from model server." }),
        { status: 502, headers: { "Content-Type": "application/json" } },
      );
    }

    // Transform the upstream SSE into a clean text stream
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let streamDone = false;

    const stream = new ReadableStream({
      async pull(controller) {
        if (streamDone) {
          controller.close();
          return;
        }

        try {
          const { done, value } = await reader.read();

          if (done) {
            // Flush any remaining buffer
            if (buffer.trim()) {
              processBuffer(buffer, controller);
            }
            controller.close();
            return;
          }

          buffer += decoder.decode(value, { stream: true });

          // Process complete lines from the buffer
          const lines = buffer.split("\n");
          // Keep the last (possibly incomplete) line in the buffer
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            const data = trimmed.slice(6);
            if (data === "[DONE]") {
              // Model finished — close stream immediately instead of
              // waiting for the upstream HTTP connection to close
              // (ngrok / vLLM often keep the connection alive).
              streamDone = true;
              reader.cancel().catch(() => {});
              controller.close();
              return;
            }

            try {
              const parsed = JSON.parse(data);
              const token =
                parsed.choices?.[0]?.delta?.content ||
                parsed.choices?.[0]?.text ||
                "";
              if (token) {
                controller.enqueue(new TextEncoder().encode(token));
              }
            } catch {
              // Skip malformed JSON
            }
          }
        } catch (err) {
          if (!streamDone) {
            controller.error(err);
          }
        }
      },
      cancel() {
        reader.cancel();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error occurred";

    return new Response(
      JSON.stringify({
        error: `Cannot reach the model server: ${message}. Make sure your Kaggle notebook is running.`,
      }),
      { status: 503, headers: { "Content-Type": "application/json" } },
    );
  }
}

function processBuffer(
  buffer: string,
  controller: ReadableStreamDefaultController,
) {
  const lines = buffer.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith("data: ")) continue;
    const data = trimmed.slice(6);
    if (data === "[DONE]") continue;
    try {
      const parsed = JSON.parse(data);
      const token =
        parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || "";
      if (token) {
        controller.enqueue(new TextEncoder().encode(token));
      }
    } catch {
      // skip
    }
  }
}
