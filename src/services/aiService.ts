// Simple OpenRouter client to fetch celebrity suggestions as a fallback
// Requires env: VITE_OPENROUTER_API_KEY (client-side usage acceptable for hackathon/demo)

export interface CelebritySuggestion {
  name: string;
  style?: string;
  image?: string;
}

const OPENROUTER_URL = import.meta.env.VITE_OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1';
const OPENROUTER_MODEL = import.meta.env.VITE_OPENROUTER_MODEL || 'openai/gpt-4o-mini';

export async function getCelebritySuggestions(
  occasion: string,
  stylePreferences: string[],
  budgetRange: string
): Promise<CelebritySuggestion[]> {
  const apiKey = import.meta.env.VITE_OPENROUTER_API_KEY;
  if (!apiKey) {
    return [];
  }

  const prompt = `Suggest 6 Bollywood celebrity style muses for jewelry inspiration.
Occasion: ${occasion}
Styles: ${stylePreferences.join(', ')}
Budget: ${budgetRange}
Return JSON array with objects: {"name": string, "style": string}.`;

  const response = await fetch(`${OPENROUTER_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: OPENROUTER_MODEL,
      messages: [
        { role: 'system', content: 'You return concise JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.4,
    }),
  });

  if (!response.ok) {
    return [];
  }

  const data = await response.json();
  const text: string = data?.choices?.[0]?.message?.content || '[]';
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.filter(Boolean).map((c: any) => ({ name: String(c.name || c), style: c.style }));
    }
    return [];
  } catch {
    return [];
  }
}


