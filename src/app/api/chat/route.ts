import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { messages, apiUrl, apiKey: clientApiKey } = await req.json();

    if (!apiUrl) {
      return NextResponse.json(
        { error: "API URL not configured. Open Settings to set your ngrok URL and API Key." },
        { status: 400 }
      );
    }

    // Use client-provided key first, then fall back to server env variable
    const apiKey = clientApiKey || process.env.API_KEY || "";

    // Clean up the URL - ensure it ends with /v1
    let baseUrl = apiUrl.replace(/\/+$/, "");
    if (!baseUrl.endsWith("/v1")) {
      baseUrl += "/v1";
    }

    const endpoint = `${baseUrl}/chat/completions`;

    // First, try a non-streaming request for reliability
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        "ngrok-skip-browser-warning": "true",
        "User-Agent": "QwenChatBot/1.0",
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
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error:", response.status, errorText.substring(0, 500));

      // Check if ngrok returned its HTML warning page
      if (errorText.includes("ngrok") && errorText.includes("html")) {
        return NextResponse.json(
          { error: "Ngrok tunnel returned an HTML page instead of JSON. The tunnel may have expired — restart your Kaggle notebook." },
          { status: 502 }
        );
      }

      return NextResponse.json(
        { error: `API Error (${response.status}): ${errorText.substring(0, 200) || "Failed to connect to model server"}` },
        { status: response.status }
      );
    }

    const contentType = response.headers.get("content-type") || "";

    // If we got HTML back instead of JSON (ngrok warning page)
    if (contentType.includes("text/html")) {
      return NextResponse.json(
        { error: "Received HTML instead of JSON from the API. The ngrok tunnel may have expired — restart your Kaggle notebook." },
        { status: 502 }
      );
    }

    const data = await response.json();

    // Extract the assistant's reply
    const content = data?.choices?.[0]?.message?.content;

    if (!content) {
      console.error("Unexpected API response shape:", JSON.stringify(data).substring(0, 500));
      return NextResponse.json(
        { error: "The model returned an unexpected response format. Check if your Kaggle server is running." },
        { status: 500 }
      );
    }

    return NextResponse.json({ content });
  } catch (error) {
    console.error("Chat API error:", error);
    const message =
      error instanceof Error ? error.message : "Unknown error";

    if (message.includes("fetch failed") || message.includes("ECONNREFUSED")) {
      return NextResponse.json(
        { error: "Cannot reach the model server. Make sure your Kaggle notebook is running and the ngrok URL is correct." },
        { status: 503 }
      );
    }

    return NextResponse.json(
      { error: `Server error: ${message}` },
      { status: 500 }
    );
  }
}
