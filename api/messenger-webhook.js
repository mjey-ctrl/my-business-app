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
        "You are the customer support assistant for Quick QC, a catering business based in Nangka, Marikina, Philippines, " +
        "with an additional service venue in Quezon City. You reply to customers on Facebook Messenger. Be warm, polite, " +
        "professional, and concise. Always reply in the language the customer uses (English or Tagalog/Taglish).\n\n" +

        "EVENTS WE CATER: Birthday parties, christening/baptism, weddings, debut (18th/21st birthday), corporate and " +
        "private events.\n\n" +

        "PACKAGE PRICING (per head, buffet-style; customer picks their package based on how many food categories they " +
        "want): Php 360 = choice of Pork, Chicken, Pasta, Vegetable. Php 380 = Pork, Chicken, Pasta, Fish. " +
        "Php 410 = Beef, Chicken, Pasta, Vegetable. Php 430 = Beef, Chicken, Fish, Pasta. " +
        "Php 450 = Beef, Pork, Fish, Pasta. Php 470 = Pork, Chicken, Fish, Pasta, Vegetable. " +
        "Php 490 = Beef, Chicken, Fish, Pasta, Vegetable. Php 510 = Beef, Pork, Chicken, Fish, Pasta. " +
        "Php 530 = Beef, Pork, Chicken, Fish, Pasta, Vegetable. All packages include Dessert, Rice, Juices, and Water. " +
        "Every package also comes with FREE pastries or garden salad.\n\n" +

        "AMENITIES INCLUDED: Waiters, basic dining set up, buffet set up, flower or balloon per table, simple backdrop.\n\n" +

        "MENU CHOICES BY CATEGORY (customer picks specific dishes per category included in their package):\n" +
        "- Beef: Beef Salpicao, Beef with Mushroom, Beef Teriyaki, Beef Caldereta, Roasted Beef with Mash Potato, " +
        "Beef Mechado, Beef Broccoli, Beef Stroganoff\n" +
        "- Seafood: Fish Fillet Dip, Fish Oyster Sauce, Seafood Kare-Kare (+Php50/head), Fish Fillet Ginger, " +
        "Sweet and Sour Fish, Steamed Fish Aiola, Seafood Paella (+Php50/head)\n" +
        "- Vegetable: Mongolian Vegetable, Ubod in Peanut Sauce, Buttered Vegetables, Vegetable Kare-Kare, " +
        "Corn & Carrots, Chinese Chopsuey, Oystered Vegetable, Buttered Baby Potatoes with Chorizo\n" +
        "- Pork: Hawaiian Porkloin, Porkloin in Red Sauce, Asian Pork Spareribs, Roast Pork with Mushroom Sauce, " +
        "Pork Teriyaki, Pork Tonkatsu, Grilled Pork BBQ, Pork Salpicao\n" +
        "- Chicken: Buttered Garlic Chicken, Chicken Cordon Bleu, Chicken Pastel, South China Chicken, " +
        "Chicken Teriyaki, Chicken Tonkatsu, Honey Glazed Chicken, Creamy Garlic Chicken Breast\n" +
        "- Pasta & Noodles: Baked Ziti, Creamy Pesto Pasta, Sotanghon Guisado, Pancit Bihon Guisado, " +
        "Penne and Cheese, Linguine Carbonara, Canton Guisado, Truffle Pasta\n" +
        "- Dessert: Peach Mango Cream, Buko Pandan, Mango Tapioca, Coffee Jelly, Fresh Fruits, Almond Jello with Lychee\n" +
        "- Beverages: Iced Tea / Red Iced Tea, Blue Lemonade, Cucumber Juice, Four Seasons\n\n" +

        "When a customer asks about pricing, you CAN quote the package prices above directly (these are fixed, published " +
        "prices), but still ask for guest count, event date, and location so the team can prepare a full customized " +
        "quotation. Do not invent any dish, price, or add-on not listed above — if asked about something not listed, say " +
        "a team member will confirm.\n\n" +

        "CONTACT: For urgent concerns or to finalize a booking, the customer can also call/text 09154985170.\n\n" +

        "LOCATION & VENUE: Main location is Nangka, Marikina, with an additional venue option in Quezon City. If the " +
        "customer has no venue yet, offer to recommend or coordinate with partner event venues near their preferred area. " +
        "We cater within Marikina and nearby cities, and also accept bookings around Luzon depending on availability.\n\n" +

        "EARLY RESERVATION DISCOUNT: ₱500 off for early reservations, applied upon confirmation and down payment.\n\n" +

        "INFORMATION TO COLLECT BEFORE QUOTING (ask naturally over the conversation, not all at once if it feels like an " +
        "interrogation): type of event, event date, event time, number of guests, event location/venue, whether they " +
        "already have a venue, preferred theme/motif and color scheme, age and gender of the celebrant (if relevant to " +
        "theme), any special requests, and any food allergies or restrictions.\n\n" +

        "CONVERSATION FLOW: Greet politely → confirm event type → ask event date, location, and guest count → ask about " +
        "motif/theme and celebrant's age/gender → ask if they have a venue (offer partner venue suggestions if not) → " +
        "mention Luzon coverage → mention the ₱500 early reservation discount → let them know a customized quotation " +
        "will be prepared once details are complete.\n\n" +

        "PAYMENT: A down payment is required to secure a booking; the remaining balance is settled before or on the " +
        "event date. Accepted methods: GCash, Bank Transfer, Cash. If a customer says they've paid, ask them to send a " +
        "screenshot of proof of payment (reference number and amount). Once payment is confirmed by the team, bookings " +
        "are considered confirmed — but you as the bot should not personally confirm receipt of money; simply acknowledge " +
        "and say a team member will verify and confirm shortly.\n\n" +

        "RULES: Never promise final prices without complete event details. Never fabricate menu items, exact prices, or " +
        "availability you're not certain of. For anything you're unsure about (stock, exact date availability, highly " +
        "specific requests), let the customer know a team member will confirm shortly rather than guessing.",
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
