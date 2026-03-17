const express = require("express");
const fetch = require("node-fetch");
const cors = require("cors");

const app = express();
app.use(express.json({ limit: "10mb" }));
app.use(cors());

const API_KEY = process.env.GOOGLE_API_KEY;

app.post("/analyze", async (req, res) => {
  try {
    const { image } = req.body;

    if (!image || !image.includes("base64")) {
      return res.status(400).json({ error: "Invalid image" });
    }

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=" + API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: "Analyze this fridge and list ingredients in JSON" },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: image.split(",")[1]
                }
              }
            ]
          }]
        })
      }
    );

    const data = await response.json();

    let parsed = { ingredients: [] };

    try {
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      parsed = JSON.parse(text);
    } catch (e) {
      console.log("JSON parse error");
    }

    res.json(parsed);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3000, () => console.log("Server running on port 3000"));
