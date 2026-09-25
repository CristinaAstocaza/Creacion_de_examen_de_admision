import crypto from 'node:crypto';

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8' },
});

const stripFence = (text = '') => text.trim()
  .replace(/^\`\`\`(?:json)?\s*/i, '')
  .replace(/\s*\`\`\`$/i, '');

async function uploadCloudinary(dataUrl, folder = 'examenes_admi/demo') {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;
  if (!cloudName || !apiKey || !apiSecret) return dataUrl;

  const timestamp = Math.floor(Date.now() / 1000);
  const toSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
  const signature = crypto.createHash('sha1').update(toSign).digest('hex');

  const form = new FormData();
  form.append('file', dataUrl);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('folder', folder);
  form.append('signature', signature);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: 'POST',
    body: form,
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error?.message || 'No se pudo subir la imagen a Cloudinary');
  return body.secure_url;
}

async function analyzeImage(image) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error('Falta configurar GEMINI_API_KEY en Netlify');

  const base64 = String(image.data || '').replace(/^data:[^;]+;base64,/, '');
  const mime = image.type || 'image/jpeg';

  const prompt = `
Analiza esta imagen de UNA pregunta de examen de admisión. Extrae fielmente el enunciado y las alternativas.
No indiques ni inventes la respuesta correcta.
Devuelve SOLO JSON válido, sin markdown, con esta estructura:
{
  "numero": 1,
  "enunciado": "[{\\\"tipo\\\":\\\"texto\\\",\\\"contenido\\\":\\\"...\\\"}]",
  "dificultad": "MEDIO",
  "area_tematica": "...",
  "tipo_bloque": "pregunta",
  "posible_incompleta": false,
  "confianza_extraccion": 95,
  "alternativas": [
    {"letra":"A","contenido_texto":"[{\\\"tipo\\\":\\\"texto\\\",\\\"contenido\\\":\\\"...\\\"}]","tipo":"texto"},
    {"letra":"B","contenido_texto":"...","tipo":"texto"},
    {"letra":"C","contenido_texto":"...","tipo":"texto"},
    {"letra":"D","contenido_texto":"...","tipo":"texto"},
    {"letra":"E","contenido_texto":"...","tipo":"texto"}
  ]
}
Para fórmulas usa bloques { "tipo":"latex", "contenido":"..." }. Para una imagen o gráfico necesario usa un bloque { "tipo":"imagen", "url":null, "descripcion":"..." }.
Conserva exactamente símbolos, subíndices, superíndices y fórmulas.
`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(key)}`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mime, data: base64 } },
          ],
        }],
        generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
      }),
    },
  );

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || 'Gemini no pudo analizar la imagen');
  const text = payload?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  const parsed = JSON.parse(stripFence(text));
  return parsed;
}

export default async (request) => {
  if (request.method !== 'POST') return json({ error: 'Método no permitido' }, 405);

  try {
    const body = await request.json();

    if (body.action === 'upload') {
      const url = await uploadCloudinary(body.data, 'examenes_admi/recortes');
      return json({ url });
    }

    const images = Array.isArray(body.images) ? body.images : [];
    if (!images.length) return json({ error: 'No se recibieron imágenes' }, 400);
    if (images.length > 5) return json({ error: 'Máximo 5 imágenes por lote' }, 400);

    const preguntas = [];
    for (let i = 0; i < images.length; i += 1) {
      const image = images[i];
      const sourceUrl = await uploadCloudinary(image.data, 'examenes_admi/originales');
      const q = await analyzeImage(image);
      preguntas.push({
        ...q,
        numero: q.numero || i + 1,
        imagen_url: sourceUrl,
        alternativas: Array.isArray(q.alternativas) ? q.alternativas : [],
      });
    }

    return json({ total_preguntas: preguntas.length, preguntas });
  } catch (error) {
    console.error(error);
    return json({ error: error instanceof Error ? error.message : 'Error procesando la solicitud' }, 500);
  }
};
