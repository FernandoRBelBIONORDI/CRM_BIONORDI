import Groq from 'groq-sdk';

function getClient() {
  return new Groq({ apiKey: process.env.GROQ_API_KEY || '' });
}

async function generateJSON(prompt: string, temperature = 0): Promise<any> {
  const client = getClient();
  const res = await client.chat.completions.create({
    model: 'llama-3.1-8b-instant',
    temperature,
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: 'Responde ÚNICAMENTE con JSON válido, sin texto adicional ni markdown.',
      },
      { role: 'user', content: prompt },
    ],
  });
  const text = res.choices[0].message.content?.trim() || '{}';
  return JSON.parse(text);
}

export async function enrichLead(data: any) {
  const prompt = `
Eres un analista de datos biomédicos. Analiza la siguiente empresa y estima su potencial para servicios de mantenimiento de transductores de ultrasonido y equipo médico.

DATOS:
${JSON.stringify(data, null, 2)}

Responde en JSON con exactamente estas claves:
{
  "tipo_especialidad_medica": "string",
  "tiene_equipo_ultrasonido": "sí" o "probable" o "no",
  "tamano_estimado": "consultorio" o "clinica_p" o "clinica_m" o "hospital",
  "nivel_socioeconomico_zona": "AB" o "C+" o "C" o "D+",
  "score_potencial_biomed": número entre 1 y 10,
  "razon_score": "string breve"
}
  `;
  try {
    return await generateJSON(prompt, 0);
  } catch (e) {
    console.error('Error enrichLead:', e);
    return null;
  }
}

export async function generateScripts(contextData: any) {
  const prompt = `
Eres un asistente de ventas especializado en servicios biomédicos en México.

CONTEXTO DE BIONORDI:
- Empresa: Bionordi, Ciudad de México
- Servicios: Reparación de transductores de ultrasonido, mantenimiento de equipo médico
- Diferenciadores: Ingenieros biomédicos certificados, entrega en 5-7 días hábiles, garantía de 12 meses
- Zonas: CDMX, EDOMEX, Querétaro, Puebla
- Representante: ${contextData.representante || ''}

LEAD:
- Empresa: ${contextData.empresa}
- Médico/Decisor: ${contextData.medico || '(desconocido)'}
- Especialidad: ${contextData.nicho || 'Salud'}
- Ciudad: ${contextData.ciudad || 'CDMX'}
- Tamaño: ${contextData.tamano || 'Clínica'}
- Notas: ${contextData.notas || 'Sin notas'}

Genera 3 mensajes de WhatsApp para prospectar este lead. Máximo 4 líneas cada uno, termina con pregunta suave, español mexicano natural, sin revelar precio.

Versión 1 — PROFESIONAL: tono formal, menciona certificación y garantía 12 meses.
Versión 2 — DIRECTO: máximo 3 líneas, va al punto, genera curiosidad.
Versión 3 — PROBLEMA-SOLUCIÓN: abre con el dolor (equipo fuera de servicio = ingresos perdidos).

Responde en JSON con exactamente estas claves:
{
  "profesional": "...",
  "directo": "...",
  "problema_solucion": "..."
}
  `;
  try {
    return await generateJSON(prompt, 0.7);
  } catch (e) {
    console.error('Error generateScripts:', e);
    return null;
  }
}
