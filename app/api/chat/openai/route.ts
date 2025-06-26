import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai" // Keep for stream handling if needed, but the source will change
import { ServerRuntime } from "next"
// import OpenAI from "openai" // We will NOT directly use the OpenAI client here anymore
// import { ChatCompletionCreateParamsBase } from "openai/resources/chat/completions.mjs" // Not directly needed

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  try {
    const profile = await getServerProfile()

    // We still need the API key for n8n's internal OpenAI calls, so this check is good
    checkApiKey(profile.openai_api_key, "OpenAI")

    // --- MODIFICATION START ---

    // Get the n8n webhook URL from environment variables
    // This assumes your NEXT_PUBLIC_OPENAI_APT_HOST now contains the FULL n8n webhook URL
    // e.g., https://n8n.iron-giant.com/webhook/your-unique-id
    const n8nWebhookUrl = process.env.NEXT_PUBLIC_OPENAI_APT_HOST

    if (!n8nWebhookUrl) {
      throw new Error("n8n Webhook URL (NEXT_PUBLIC_OPENAI_APT_HOST) is not configured.")
    }

    // Prepare the payload for your n8n webhook
    // Your n8n webhook expects a 'messages' array in the body
    const n8nPayload = {
      messages: messages // Directly pass the messages array to n8n
      // You might also want to pass chatSettings if your n8n workflow uses them
      // chatSettings: chatSettings
    }

    // Make a fetch request to your n8n webhook URL
    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Pass the OpenAI API Key from the profile to n8n if n8n requires it
        // (your n8n HTTP Request node uses "Predefined Credential", so this might not be strictly necessary here,
        // but it's good practice or if you later switch n8n to expect it in headers)
        "Authorization": `Bearer ${profile.openai_api_key}`
      },
      body: JSON.stringify(n8nPayload)
    })

    // Check if the n8n response was successful
    if (!n8nResponse.ok) {
      const errorData = await n8nResponse.json()
      throw new Error(`n8n Workflow Error: ${errorData.errorMessage || n8nResponse.statusText}`)
    }

    // Assuming your n8n webhook responds with a JSON object containing 'answer' or similar.
    // Your n8n workflow's Webhook Response node currently outputs the content directly.
    // Let's adjust this to read the n8n response correctly.

    // If your n8n webhook response is plain text (from Webhook Response option 1):
    // const responseText = await n8nResponse.text();
    // return new Response(responseText, { status: 200, headers: { 'Content-Type': 'text/plain' } });

    // If your n8n webhook response is a JSON object like {"answer": "..."} (from Webhook Response option 2):
    const n8nJson = await n8nResponse.json();
    const assistantContent = n8nJson.answer; // Assuming your n8n webhook sends {"answer": "..."}

    // Create a mock stream to align with StreamingTextResponse, if the UI expects it
    // Or just return a plain JSON response
    // For now, let's return a simple Response as it's not a direct OpenAI stream
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

    // --- MODIFICATION END ---

  } catch (error: any) {
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "OpenAI API Key not found. Please set it in your profile settings."
    } else if (errorMessage.toLowerCase().includes("incorrect api key")) {
      errorMessage =
        "OpenAI API Key is incorrect. Please fix it in your profile settings."
    } else if (errorMessage.toLowerCase().includes("n8n workflow error")) {
      // Catch specific n8n errors
      errorMessage = `Backend Workflow Error: ${errorMessage}`
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
