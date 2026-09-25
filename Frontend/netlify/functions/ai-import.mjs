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
REGLAS ESTRICTAS PARA TEXTO Y FÓRMULAS:
- El campo "enunciado" SIEMPRE debe ser un JSON string que contiene un arreglo de bloques.
- Separa texto normal y expresiones matemáticas en bloques distintos.
- Para texto normal usa {"tipo":"texto","contenido":"..."}.
- Para cualquier expresión matemática, variable con subíndice/superíndice, fracción, raíz, igualdad, desigualdad o unidad científica escrita con exponentes usa {"tipo":"latex","contenido":"..."}.
- NO escribas comandos LaTeX crudos dentro de un bloque de texto normal.
- Ejemplo correcto para: "El área A₁ = 20 cm² y el área A₂ = 400 cm². El auto pesa 4000 N.":
  [
    {"tipo":"texto","contenido":"El área "},
    {"tipo":"latex","contenido":"A_1 = 20\\,\\text{cm}^2"},
    {"tipo":"texto","contenido":" y el área "},
    {"tipo":"latex","contenido":"A_2 = 400\\,\\text{cm}^2"},
    {"tipo":"texto","contenido":". El auto pesa "},
    {"tipo":"latex","contenido":"4000\\,\\text{N}"},
    {"tipo":"texto","contenido":"."}
  ]
- Si aparece F₁, A₂, v², cm², m/s², ρ₀, √, fracciones, etc., conserva su notación matemática en LaTeX.
- No conviertas una fórmula a una descripción en palabras.

FIGURAS DEL ENUNCIADO:
- Si la pregunta contiene uno o más gráficos, diagramas o figuras necesarios para resolverla, agrega UN bloque {"tipo":"imagen","url":null,"descripcion":"..."} POR CADA figura distinta, en el orden en que aparecen.
- No combines dos gráficos diferentes en un solo bloque.

MUY IMPORTANTE para las alternativas A-E:
- Si lo que ves es una fórmula matemática, ecuación, desigualdad, fracción, símbolo o expresión escrita visualmente, NO la trates como imagen. Transcríbela a un bloque latex, por ejemplo [{"tipo":"latex","contenido":"\\rho_0 = \\frac{\\rho_1+\\rho_2}{2}"}].
- Si la alternativa es una figura real, diagrama, vector dibujado, gráfico, esquema u objeto visual que NO puede representarse fielmente como fórmula o texto, entonces sí devuelve un bloque de imagen pendiente de recorte, por ejemplo [{"tipo":"imagen","url":null,"descripcion":"alternativa gráfica A"}].
- No describas una figura con palabras si debe conservarse visualmente.
- Solo usa texto descriptivo cuando la alternativa realmente sea textual.
Conserva exactamente símbolos, subíndices, superíndices, unidades y fórmulas.
`;

  const requestBody = {
    contents: [{
      parts: [
        { text: prompt },
        { inline_data: { mime_type: mime, data: base64 } },
      ],
    }],
    generationConfig: { temperature: 0.1, responseMimeType: 'application/json' },
  };

  const callGemini = async (model) => {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': key,
        },
        body: JSON.stringify(requestBody),
      },
    );

    let payload = {};
    try {
      payload = await response.json();
    } catch {
      payload = {};
    }
    return { response, payload, model };
  };

  const isBusy = (response, payload) => {
    const message = String(payload?.error?.message || '').toLowerCase();
    return response.status === 429 ||
      response.status === 503 ||
      message.includes('high demand') ||
      message.includes('temporarily unavailable') ||
      message.includes('resource exhausted');
  };

  const result = await callGemini('gemini-3.5-flash-lite');
  const { response, payload } = result;

  if (!response.ok) {
    if (isBusy(response, payload)) {
      const error = new Error('GEMINI_BUSY');
      error.code = 'GEMINI_BUSY';
      throw error;
    }
    throw new Error(payload?.error?.message || 'Gemini no pudo analizar la imagen');
  }
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
    if (images.length > 1) return json({ error: 'Procesa una imagen por solicitud para evitar tiempos de espera.' }, 400);

    const preguntas = [];
    for (let i = 0; i < images.length; i += 1) {
      const image = images[i];
      // La imagen original se mantiene localmente en el navegador durante la revisión.
      // Esto evita gastar tiempo de la Function subiéndola a Cloudinary antes de llamar a Gemini.
      const q = await analyzeImage(image);
      preguntas.push({
        ...q,
        numero: i + 1,
        imagen_url: null,
        alternativas: Array.isArray(q.alternativas) ? q.alternativas : [],
      });
    }

    return json({ total_preguntas: preguntas.length, preguntas });
  } catch (error) {
    console.error(error);

    if (error?.code === 'GEMINI_BUSY' || error?.message === 'GEMINI_BUSY') {
      return json({
        code: 'GEMINI_BUSY',
        error: 'Gemini está temporalmente saturado. El sistema volverá a intentarlo automáticamente.'
      }, 503);
    }

    return json({ error: error instanceof Error ? error.message : 'Error procesando la solicitud' }, 500);
  }
};
