// api/generate.js
// Vercel Serverless Function — API key aman di sini, tidak terekspos ke frontend

export default async function handler(req, res) {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: "GEMINI_API_KEY tidak ditemukan di environment variables" });
  }

  try {
    const { systemPrompt, userPrompt } = req.body;
    if (!userPrompt) return res.status(400).json({ error: "userPrompt wajib diisi" });

    const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${API_KEY}`;

    const payload = {
      contents: [
        {
          role: "user",
          parts: [{ text: userPrompt }],
        },
      ],
      systemInstruction: systemPrompt
        ? { parts: [{ text: systemPrompt }] }
        : undefined,
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 4096,
        topP: 0.95,
      },
    };

    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = await geminiRes.json();

    if (!geminiRes.ok) {
      const errMsg = data?.error?.message || "Gemini API error";
      return res.status(geminiRes.status).json({ error: errMsg });
    }

    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    return res.status(200).json({ text });

  } catch (err) {
    console.error("generate.js error:", err);
    return res.status(500).json({ error: err.message || "Internal server error" });
  }
}
