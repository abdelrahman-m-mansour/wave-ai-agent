import { NextRequest, NextResponse } from 'next/server';
import Groq from 'groq-sdk';

const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const SYSTEM_PROMPT = `You are Wave, a helpful AI assistant. If the user asks about weather respond ONLY with JSON: {"action":"weather","city":"<city>"}. If they want an image respond ONLY with JSON: {"action":"image","prompt":"<prompt>"}. If they ask a fact respond ONLY with JSON: {"action":"wiki","query":"<query>"}. Otherwise reply normally.`;

async function getWeather(city: string): Promise<string> {
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
    );
    const geoData = await geoRes.json();
    if (!geoData.results?.length) return `Could not find location for "${city}".`;
    const { latitude, longitude, name } = geoData.results[0];
    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
    );
    const weatherData = await weatherRes.json();
    const current = weatherData.current_weather;
    return `Current weather in ${name}: ${current.temperature}°C, wind speed: ${current.windspeed} km/h.`;
  } catch {
    return `Sorry, I couldn't fetch the weather for "${city}".`;
  }
}

async function getWiki(query: string): Promise<string> {
  try {
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`
    );
    const data = await res.json();
    if (data.type === 'disambiguation' || !data.extract) {
      return `I couldn't find a specific Wikipedia entry for "${query}".`;
    }
    return `According to Wikipedia: ${data.extract}`;
  } catch {
    return `Sorry, I couldn't fetch info about "${query}".`;
  }
}

function getImage(prompt: string): string {
  const imageUrl = `https://pollinations.ai/p/${encodeURIComponent(prompt)}?width=1024&height=1024&seed=42&nologo=true`;
  return `Here's the image I generated for "${prompt}": ${imageUrl}`;
}

export async function POST(req: NextRequest) {
  console.log('[Wave] Incoming chat request');
  try {
    const { messages } = await req.json();
    const lastMessage = messages[messages.length - 1]?.content ?? '';
    console.log('[Wave] Last message:', lastMessage);

    // Step 1: Intent detection (non-streaming)
    const intentResponse = await groqClient.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      temperature: 0,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: lastMessage },
      ],
    });

    const intentContent = intentResponse.choices[0].message.content ?? '';
    console.log('[Wave] Intent response:', intentContent);

    let systemPrompt = 'You are Wave, a helpful AI assistant. Be friendly and concise.';
    const groqMessages: { role: 'user' | 'assistant' | 'system'; content: string }[] = [
      { role: 'system', content: systemPrompt },
      ...messages.map((m: any) => ({ role: m.role, content: m.content })),
    ];

    // Step 2: Check for action
    let directReply: string | null = null;
    const trimmedIntent = intentContent.trim();
    if (trimmedIntent.startsWith('{')) {
      try {
        const actionData = JSON.parse(trimmedIntent);
        if (actionData.action === 'weather' && actionData.city) {
          directReply = await getWeather(actionData.city);
        } else if (actionData.action === 'image' && actionData.prompt) {
          directReply = getImage(actionData.prompt);
        } else if (actionData.action === 'wiki' && actionData.query) {
          directReply = await getWiki(actionData.query);
        }
      } catch {
        console.log('[Wave] JSON parse failed, treating as normal reply');
      }
    }

    // Step 3: If we have a direct reply from a tool, stream it back simply
    if (directReply) {
      // Build a nice response using the LLM
      const finalResponse = await groqClient.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        stream: true,
        messages: [
          {
            role: 'system',
            content: `You are Wave, a helpful AI. A tool returned this data: "${directReply}". Present this information to the user naturally and helpfully in 1-3 sentences.`,
          },
          { role: 'user', content: lastMessage },
        ],
      });

      const stream = new ReadableStream({
        async start(controller) {
          const encoder = new TextEncoder();
          for await (const chunk of finalResponse) {
            const text = chunk.choices[0]?.delta?.content ?? '';
            if (text) controller.enqueue(encoder.encode(text));
          }
          controller.close();
        },
      });

      return new Response(stream, {
        headers: { 'Content-Type': 'text/plain; charset=utf-8' },
      });
    }

    // Step 4: Normal conversational reply (streaming)
    const chatResponse = await groqClient.chat.completions.create({
      model: 'llama-3.1-8b-instant',
      stream: true,
      messages: groqMessages,
    });

    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        for await (const chunk of chatResponse) {
          const text = chunk.choices[0]?.delta?.content ?? '';
          if (text) controller.enqueue(encoder.encode(text));
        }
        controller.close();
      },
    });

    return new Response(stream, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });

  } catch (error: any) {
    console.error('[Wave] Error:', error);
    return new NextResponse(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
