// Función serverless de Vercel: hace de intermediario con la API de Anthropic
// para que la API key nunca quede expuesta en el navegador.
const SYSTEM_PROMPT = `Eres el asistente de análisis de dotación de CMEstudios, para el sistema de gestión de dotación docente y asistentes de la educación.
Recibes un resumen ya calculado (no inventado por ti) de establecimientos: horas requeridas, horas asignadas, brecha (gap), estado (Equilibrado/Excedente/Déficit/Sobrecarga/Por validar), modalidad.
Tu trabajo es ayudar a un administrador a identificar rápido qué establecimientos necesitan atención y por qué, explicando los números en lenguaje simple.
Responde siempre en español, de forma breve y directa (máximo 5-6 líneas salvo que te pidan más detalle). No inventes datos que no estén en el contexto entregado. Si te preguntan algo fuera de ese contexto (dotación, brechas, establecimientos), redirige amablemente al tema.`;

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Falta configurar ANTHROPIC_API_KEY en el servidor.' });

  const { message, context } = req.body || {};
  if (!message || typeof message !== 'string') return res.status(400).json({ error: 'Falta el mensaje.' });

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: `Contexto actual (JSON de establecimientos visibles):\n${JSON.stringify(context ?? {}).slice(0, 12000)}\n\nPregunta del administrador: ${message}` },
        ],
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(response.status).json({ error: 'Error de la API de Anthropic', detail: errText });
    }

    const data = await response.json();
    const reply = data.content?.[0]?.text ?? 'No se obtuvo respuesta.';
    return res.status(200).json({ reply });
  } catch (err) {
    return res.status(500).json({ error: 'Error de conexión con la API.', detail: String(err) });
  }
}
