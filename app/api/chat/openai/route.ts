import { checkApiKey, getServerProfile } from "@/lib/server/server-chat-helpers"
import { ChatSettings } from "@/types"
import { OpenAIStream, StreamingTextResponse } from "ai"
import { ServerRuntime } from "next"

export const runtime: ServerRuntime = "edge"

export async function POST(request: Request) {
  const json = await request.json()
  const { chatSettings, messages } = json as {
    chatSettings: ChatSettings
    messages: any[]
  }

  console.log("ROUTE: Received POST request to /api/chat/openai"); // LOG 1
  console.log("ROUTE: Chat Settings:", chatSettings); // LOG 2
  console.log("ROUTE: Messages:", messages); // LOG 3

  try {
    const profile = await getServerProfile()
    console.log("ROUTE: Server Profile obtained:", profile); // LOG 4

    // checkApiKey(profile.openai_api_key, "OpenAI") // Keep this commented for now
    console.log("ROUTE: API Key check bypassed."); // LOG 5

    const n8nWebhookUrl = process.env.NEXT_PUBLIC_OPENAI_APT_HOST
    console.log("ROUTE: n8n Webhook URL:", n8nWebhookUrl); // LOG 6

    if (!n8nWebhookUrl) {
      throw new Error("n8n Webhook URL (NEXT_PUBLIC_OPENAI_APT_HOST) is not configured.")
    }

    const n8nPayload = {
      messages: messages
    }
    console.log("ROUTE: n8n Payload:", JSON.stringify(n8nPayload)); // LOG 7

    const n8nResponse = await fetch(n8nWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(n8nPayload)
    })
    console.log("ROUTE: n8n Response status:", n8nResponse.status); // LOG 8

    if (!n8nResponse.ok) {
      const errorData = await n8nResponse.json()
      console.error("ROUTE: n8n Response Error Data:", errorData); // LOG 9
      throw new Error(`n8n Workflow Error: ${errorData.errorMessage || n8nResponse.statusText}`)
    }

    const n8nJson = await n8nResponse.json();
    console.log("ROUTE: n8n JSON Response:", n8nJson); // LOG 10
    const assistantContent = n8nJson.answer;

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
    console.error("ROUTE: Caught error in API route:", error.message); // LOG 11
    let errorMessage = error.message || "An unexpected error occurred"
    const errorCode = error.status || 500

    if (errorMessage.toLowerCase().includes("api key not found")) {
      errorMessage =
        "OpenAI API Key not found. Please set it in your profile settings."
    } else if (errorMessage.toLowerCase().includes("incorrect api key")) {
      errorMessage =
        "OpenAI API Key is incorrect. Please fix it in your profile settings."
    } else if (errorMessage.toLowerCase().includes("backend workflow error")) {
      errorMessage = `Backend Workflow Error: ${errorMessage}`
    }

    return new Response(JSON.stringify({ message: errorMessage }), {
      status: errorCode
    })
  }
}
