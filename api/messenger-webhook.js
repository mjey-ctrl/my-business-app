// api/messenger-webhook.js
// Quick QC Messenger Bot — receives Facebook Messenger messages,
// asks Claude for a reply, and sends it back to the customer.

export default async function handler(req, res) {
  // ---------- STEP 1: Facebook webhook verification (GET request) ----------
  // Facebook calls this once when you register the webhook URL, to confirm
  // you own this endpoint. It sends a "challenge" value we must echo back.
  if (req.method === "GET") {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // This must match the "Verify Token" you type into the Facebook
    // webhook setup screen. Set it below as an environment variable.
    const VERIFY_TOKEN = process.env.FB_VERIFY_TOKEN;

    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("Webhook verified");
      return res.status(200).send(challenge);
    } else {
      return res.status(403).send("Verification failed");
    }
  }

  // ---------- STEP 2: Handling incoming messages (POST request) ----------
  if (req.method === "POST") {
    const body = req.body;

    // Facebook sends a "page" object for Page-related events (like messages)
    if (body.object === "page") {
      for (const entry of body.entry) {
        const webhookEvent = entry.messaging[0];
        const senderId = webhookEvent.sender.id;

        // Only respond to actual text messages (ignore read receipts, etc.)
        if (webhookEvent.message && webhookEvent.message.text) {
          const userText = webhookEvent.message.text;

          try {
            const replyText = await getClaudeReply(userText);
            await sendMessengerReply(senderId, replyText);
          } catch (err) {
            console.error("Error handling message:", err);
          }
        }
      }

      // Facebook expects a fast 200 OK to know we received the event
      return res.status(200).send("EVENT_RECEIVED");
    } else {
      return res.status(404).send("Not a page event");
    }
  }

  // Any other HTTP method isn't supported
  return res.status(405).send("Method not allowed");
}

// ---------- Helper: Ask Claude for a reply ----------
async function getClaudeReply(userText) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 300,
      system:
        "You are the friendly customer support assistant for Quick QC, a food cart business in Quezon City, Philippines. " +
        "Answer customer questions about the menu, orders, hours, and general inquiries warmly and concisely. " +
        "If you don't know something specific (like today's exact stock), let the customer know a team member will confirm shortly.",
      messages: [{ role: "user", content: userText }],
    }),
  });

  const data = await response.json();

  if (data?.content?.[0]?.text) {
    return data.content[0].text;
  }

  console.error("Unexpected Claude response:", JSON.stringify(data));
  return "Thanks for your message! Someone from our team will get back to you shortly.";
}

// ---------- Helper: Send a reply back through Messenger ----------
async function sendMessengerReply(recipientId, messageText) {
  const PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN;

  const response = await fetch(
    `https://graph.facebook.com/v21.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: messageText },
      }),
    }
  );

  const result = await response.json();
  if (result.error) {
    console.error("Error sending message:", result.error);
  }
  return result;
}
