const express = require("express");
const bodyParser = require("body-parser");
const axios = require("axios");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());

// Verification Endpoint for Meta Webhook
app.get("/webhook", (req, res) => {
  const verify_token = process.env.VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === verify_token) {
      console.log("WEBHOOK_VERIFIED");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  }
});

// Webhook Receiver Endpoint
app.post("/webhook", async (req, res) => {
  const body = req.body;

  if (body.object && body.entry && body.entry[0].changes && body.entry[0].changes[0].value.messages) {
    const phone_number_id = body.entry[0].changes[0].value.metadata.phone_number_id;
    const from = body.entry[0].changes[0].value.messages[0].from;
    const msg_body = body.entry[0].changes[0].value.messages[0].text?.body;

    console.log(`Incoming message from ${from}: ${msg_body}`);

    // Send message to Dialogflow
    const dialogflowResponse = await axios.post(
      `https://dialogflow.googleapis.com/v2/projects/${process.env.DF_PROJECT_ID}/agent/sessions/${from}:detectIntent`,
      {
        queryInput: {
          text: {
            text: msg_body,
            languageCode: "en",
          },
        },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.DF_ACCESS_TOKEN}`,
        },
      }
    );

    const replyText = dialogflowResponse.data.queryResult.fulfillmentText;

    // Send reply back to WhatsApp user
    await axios.post(
      `https://graph.facebook.com/v19.0/${phone_number_id}/messages`,
      {
        messaging_product: "whatsapp",
        to: from,
        text: { body: replyText },
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
      }
    );
  }

  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Webhook server running on port ${PORT}`);
});
