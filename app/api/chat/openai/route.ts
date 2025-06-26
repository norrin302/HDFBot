import { ServerRuntime } from "next"
// Remove these imports as we won't use them directly here anymore:
// import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
// import { ChatSettings } from "@/types"
// import { OpenAIStream, StreamingTextResponse } from "ai"
// import OpenAI from "openai"
// import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: any // Relax type for now as chatSettings might not be fully passed
    messages: any[]
  }

  console.log("ROUTE: Received POST request to /api/chat/openai");
  console.log("ROUTE: Chat Settings (incoming):", JSON.stringify(chatSettings));
  console.log("ROUTE: Messages (incoming):", JSON.stringify(messages));

  try {
    const n8nWebhookUrl = process.env.NEXT_PUBLIC_OPENAI_APT_HOST;
    console.log("ROUTE: n8n Webhook URL:", n8nWebhookUrl);

    if (!n8nWebhookUrl) {
      console.error("ROUTE: n8n Webhook URL (NEXT_PUBLIC_OPENAI_APT_HOST) is not configured.");
      return new Response(JSON.stringify({ message: "Backend URL not configured." }), { status: 500 });
    }

    const n8nPayload = {
      messages: messages
      // You can also pass chatSettings if your n8n workflow needs them later for model selection etc.
      // chatSettings: chatSettings
    }
    console.log("ROUTE: n8n Payload being sent:", JSON.stringify(n8nPayload));

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // If n8n's webhook node required an API key in the header, you'd add it here,
        // but your n8n HTTP Request node uses a "Predefined Credential" for OpenAI,
        // so this should not be needed for the call *to n8n*.
        // "Authorization": `Bearer ${process.env.OPENAI_API_KEY}` // Only if n8n itself checks this header
      },
      body: JSON.stringify(n8nPayload)
    })

    console.log("ROUTE: Received response from n8n. Status:", n8nResponse.status);

    if (!n8nResponse.ok) {
      const errorText = await n8nResponse.text(); // Get raw text to avoid JSON parsing errors
      console.error("ROUTE: n8n Response not OK. Text:", errorText);
      return new Response(JSON.stringify({ message: `Backend Workflow Error: ${n8nResponse.status} - ${errorText.substring(0, 200)}...` }), { status: n8nResponse.status });
    }

    const n8nJson = await n8nResponse.json();
    console.log("ROUTE: n8n Parsed JSON Response:", n8nJson);

    // Your n8n webhook response is {"answer": "..."}
    const assistantContent = n8nJson.answer;

    if (assistantContent === undefined) {
      console.error("ROUTE: n8n response did not contain 'answer' field:", n8nJson);
      return new Response(JSON.stringify({ message: "Unexpected response format from backend." }), { status: 500 });
    }

    // Return the response in a format the chatbot UI expects
    return new Response(JSON.stringify({
        choices: [{
            message: {
                role: "assistant",
                content: assistantContent
            }
        }]
    }), {
        status: 200,
        headers: {
            "Content-Type": "application/json"
        }
    });

  } catch (error: any) {
    console.error("ROUTE: Caught critical error in API route:", error);
    return new Response(JSON.stringify({ message: `Internal Server Error: ${error.message || "Unknown error"}` }), {
      status: 500
    })
  }
}
