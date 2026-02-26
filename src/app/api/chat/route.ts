import { NextRequest } from "next/server";

export const runtime = "edge";

export async function POST(req: NextRequest) {
  try {
    const { messages, apiUrl } = await req.json();

    if (!apiUrl) {
      return new Response(
        JSON.stringify({ error: "API URL not configured. Open Settings to set your ngrok URL." }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const apiKey = process.env.API_KEY || "my-secret-key-kavinda@kaglle";

    // Clean up the URL - ensure it ends with /v1
    let baseUrl = apiUrl.replace(/\/+$/, "");
    if (!baseUrl.endsWith("/v1")) {
      baseUrl += "/v1";
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
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

    if (!response.ok) {
      const errorText = await response.text();
      return new Response(
        JSON.stringify({
          error: `API Error (${response.status}): ${errorText || "Failed to connect to model server"}`,
        }),
        { status: response.status, headers: { "Content-Type": "application/json" } }
      );
    }

    // Stream the response back
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split("\n").filter((line) => line.trim() !== "");

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const data = line.slice(6);
                if (data === "[DONE]") {
                  controller.enqueue(encoder.encode("data: [DONE]\n\n"));
                  continue;
                }
                try {
                  const parsed = JSON.parse(data);
                  const content = parsed.choices?.[0]?.delta?.content || "";
                  if (content) {
                    controller.enqueue(
                      encoder.encode(`data: ${JSON.stringify({ content })}\n\n`)
                    );
                  }
                } catch {
                  // Skip malformed JSON chunks
                }
              }
            }
          }
        } catch (err) {
          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({ error: "Stream interrupted" })}\n\n`
            )
          );
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: "Failed to connect to the model server. Make sure your Kaggle notebook is running.",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
