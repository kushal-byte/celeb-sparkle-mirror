import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { occasion, stylePreferences, budgetRange } = await req.json();
    const OPENROUTER_API_KEY = Deno.env.get('VITE_OPENROUTER_API_KEY');

    if (!OPENROUTER_API_KEY) {
      throw new Error('OPENROUTER_API_KEY is not configured');
    }

    const prompt = `Based on the following customer preferences, suggest 3-4 celebrities whose jewelry style would match:
- Occasion: ${occasion}
- Style Preferences: ${JSON.stringify(stylePreferences)}
- Budget Range: ${budgetRange}

Return ONLY a JSON array with celebrity names who are known for their jewelry style. Format: ["Celebrity 1", "Celebrity 2", "Celebrity 3"]`;

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://evoljewels.com',
        'X-Title': 'Evol Jewels Kiosk'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenRouter API error:', response.status, errorText);
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    let celebrities: string[];
    try {
      celebrities = JSON.parse(aiResponse);
    } catch {
      celebrities = ['Zendaya', 'Rihanna', 'Blake Lively', 'Beyonce'];
    }

    return new Response(
      JSON.stringify({ celebrities }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in match-celebrity function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
