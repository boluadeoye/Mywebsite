// /api/forge.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Only POST requests are allowed' });
  }

  try {
    const { character, setting, conflict } = req.body;

    const prompt = `
      You are a creative partner for a writer. Generate a rich, narrative logline for a story.
      The user has provided the following core elements:
      - Character Archetype: "${character}"
      - Setting: "${setting}"
      - Core Conflict: "${conflict}"

      Based on these elements, do the following:
      1.  Create a compelling logline that intelligently weaves these elements together.
      2.  Generate a "Sensory Palette" for the setting with three distinct details for Sight, Sound, and Smell.
      3.  Suggest a powerful "Internal Conflict" for the character that is related to the core conflict.
      4.  Ensure the tone is professional, creative, and inspiring. A 60% focus should be on Nigerian literary themes and contexts where appropriate.

      Return ONLY a JSON object with the following structure: { "logline": "...", "sensory_palette": { "sight": "...", "sound": "...", "smell": "..." }, "internal_conflict": "..." }
    `;

    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
    });

    if (!aiResponse.ok) {
      throw new Error('The AI brain is not responding. Please try again.');
    }

    const aiData = await aiResponse.json();
    const aiText = aiData.candidates[0].content.parts[0].text;
    
    const cleanJsonText = aiText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    res.status(200).json(JSON.parse(cleanJsonText));

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'An error occurred while forging the idea.' });
  }
}
