import { ServerRuntime } from "next"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  try {
    const json = await request.json()
    const { messages, chatSettings } = json

    const n8nWebhookUrl = process.env.NEXT_PUBLIC_OPENAI_APT_HOST;

    if (!n8nWebhookUrl) {
      throw new Error("n8n Webhook URL (NEXT_PUBLIC_OPENAI_APT_HOST) is not configured.")
    }

    const n8nPayload = {
      messages: messages,
      chatSettings: chatSettings
    }

    // Forward the request to your n8n workflow
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(n8nPayload)
    })
    
    // Check if the n8n response is OK
    if (!n8nResponse.ok) {
        const errorText = await n8nResponse.text();
        throw new Error(`n8n workflow returned an error: ${n8nResponse.status} ${errorText}`);
    }

    // Return the response from n8n directly back to the client
    return n8nResponse;

  } catch (error: any) {
    console.error("Error in /api/chat/openai route:", error)
    const errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500
    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
