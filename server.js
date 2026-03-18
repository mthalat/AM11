

  const express = require("express");
  const path = require("path");
  const fetch = (...args) => import("node-fetch").then(({default: fetch}) => fetch(...args));

  const app = express();

  app.use(express.json({limit:"10mb"}));
  app.use(express.static(path.join(__dirname, "public")));

  const GEMINI_KEY = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;

  // ----- IMAGE SCAN -----
  app.post("/api/fridge/scan", async (req,res)=>{
    try{
      const image = req.body.image;
      if(!image) return res.json({error:"No image"});

      const base64 = image.split(",")[1];
      const mimeMatch = image.match(/data:([^;]+);/);
      const mimeType = mimeMatch ? mimeMatch[1] : "image/jpeg";

      const prompt = `
  Look at this image carefully. List ALL food ingredients, vegetables, fruits, meats, dairy, or any edible items you can see.
  Return ONLY a valid JSON array of ingredient names in English. No markdown, no explanation, just the JSON array.
  Example: ["tomato","cucumber","cheese","milk"]
  If no food is visible, return: []
  `;

      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="+GEMINI_KEY,
        {
          method:"POST",
          headers:{ "Content-Type":"application/json"},
          body: JSON.stringify({
            contents:[{
              parts:[
                {text:prompt},
                {
                  inline_data:{
                    mime_type: mimeType,
                    data:base64
                  }
                }
              ]
            }],
            generationConfig:{
              temperature: 0.1,
              maxOutputTokens: 500
            }
          })
        }
      );

      const data = await r.json();
      
      if(data.error){
        console.error("Gemini API error:", data.error);
        return res.json({error: data.error.message, ingredients:[]});
      }

      let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
      
      // Remove markdown code blocks if present
      text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();
      
      // Extract JSON array from text
      const arrayMatch = text.match(/\[.*\]/s);
      if(arrayMatch) text = arrayMatch[0];

      let ingredients=[];
      try{
        ingredients = JSON.parse(text);
        if(!Array.isArray(ingredients)) ingredients = [];
      }catch{
        // fallback: extract words
        ingredients = text.replace(/[\[\]"]/g,"").split(",").map(x=>x.trim()).filter(x=>x.length>1);
      }

      res.json({ingredients});
    }catch(e){
      console.error("Scan error:", e);
      res.json({error:e.message, ingredients:[]});
    }
  });

  // ----- RECIPES -----
  app.post("/api/fridge/recipes", async (req,res)=>{
    try{
      const ingredients = req.body.ingredients || [];

      const prompt = `
      Create 3 cooking recipes using these ingredients:
      ${ingredients.join(", ")}

      Return JSON in this format:
      {
        "recipes":[
          {
            "title":"recipe name",
            "ingredients":["item1","item2"],
            "steps":["step1","step2"]
          }
        ]
      }
      `;

      const r = await fetch(
        "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key="+GEMINI_KEY,
        {
          method:"POST",
          headers:{ "Content-Type":"application/json"},
          body: JSON.stringify({
            contents:[{parts:[{text:prompt}]}]
          })
        }
      );

      const data = await r.json();
      let text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
      
      // Remove markdown code blocks if present
      text = text.replace(/```json\s*/gi, '').replace(/```\s*/gi, '').trim();

      let json;
      try{
        json = JSON.parse(text);
      }catch{
        json = {recipes:[]};
      }

      res.json(json);
    }catch(e){
      res.json({error:e.message});
    }
  });

  // fallback
  app.get("*",(req,res)=>{
    res.sendFile(path.join(__dirname,"public","index.html"));
  });

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, ()=>{
    console.log("Server running on port "+PORT);
  });
  