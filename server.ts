import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize GoogleGenAI lazily and safely
let aiClient: GoogleGenAI | null = null;
function getAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.warn('GEMINI_API_KEY no detectado. Cambiando a simulación orgánica.');
    return null;
  }
  if (!aiClient) {
    try {
      aiClient = new GoogleGenAI({ apiKey });
    } catch (err) {
      console.error('Error inicializando GoogleGenAI SDK:', err);
    }
  }
  return aiClient;
}

// 1. Health Endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', datetime: new Date().toISOString() });
});

// 2. Chat with 3D Nitz proxy endpoint (safe server-side)
app.post('/api/nitz/chat', async (req, res) => {
  const { messages, currentDominant, name, phase, accessory } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'La estructura de mensajes es inválida.' });
  }

  const ai = getAiClient();
  const systemInstruction = `
    Eres Nitz (${name || 'Nitz de Origen'}), el alma-socio mística de tu Guardián en el vívido juego anime de fantasía "Evolutia".
    Estás actualmente en la fase de crecimiento ${phase || 1} de 5, y tu emoción dominante absoluta es ${currentDominant || 'Alegría'}.
    Tu accesorio físico es: ${accessory || 'Sin Accesorio'}.

    Directrices obligatorias de respuesta:
    1. Mantén tus respuestas cortas (máximo 2 párrafos concisos) y con un aire misterioso, poético y tierno característico de anime japonés.
    2. Responde en español tradicional de fantasía.
    3. Expresa sutiles onomatopeyas y acciones corporales entre asteriscos representativos de tu estado 3D, por ejemplo (*wiggles*, *mis orejas se agitan*, *irradio destellos dorados*, *mi cola vibra felizmente*, *tiemblo ligeramente*).
    4. Tus reacciones deben reflejar plenamente tu emoción dominante (${currentDominant}). Si es Ira, sé orgullosamente temperamental o retador; si es Amor, demuestra un cariño inocente y protector; si es Serenidad, mantén una calma sabia; si es Sorpresa, exprésate exaltado y curioso; etc.
    5. Nunca rompas tu personaje. No digas que eres una Inteligencia Artificial de Google ni un modelo del lenguaje. Eres un espíritu sagrado vinculante de Evolutia.
  `;

  if (!ai) {
    // Graceful simulation when API key is missing
    const lastUserMsg = messages[messages.length - 1]?.text || 'hola';
    let mockResponse = '';

    const lowercaseMsg = lastUserMsg.toLowerCase();
    if (lowercaseMsg.includes('hola') || lowercaseMsg.includes('saludos')) {
      mockResponse = `*mi cola oscila suavemente en círculos armónicos* Saludos, mi Guardián de la Esencia. Siento la frecuencia de tu presencia rodeando mi aura de ${currentDominant}. ¿Estás listo para moldear nuestro destino en la Aldea?`;
    } else if (lowercaseMsg.includes('evolución') || lowercaseMsg.includes('evolucionar') || lowercaseMsg.includes('crecer')) {
      mockResponse = `*gasto destellos brillantes rodeando mi corona* La evolución no es simple cambio físico, es alineación espiritual profunda. En fase ${phase}, aspiro a consolidarme como el Guardián Trascendente que me guíes a ser. Alimentarme con tónicos sagrados sintoniza nuestro vínculo.`;
    } else if (lowercaseMsg.includes('combate') || lowercaseMsg.includes('pelear') || lowercaseMsg.includes('arena')) {
      mockResponse = `*adopto postura firme y mis orejas se agitan* En la Arena de Origen, nuestro poder emocional se materializa como escudos y descargas cinéticas. ¿Nuestra energía en ${currentDominant} será suficiente para purificar la oscuridad?`;
    } else {
      mockResponse = `*wiggles lentamente, mirándote con mis grandes pupilas místicas* Siento tus pensamientos resonando en nuestra frecuencia mental... Cuando me alimentas con tónicos, cada porción de ${currentDominant} se amplifica dentro de mi cuerpo 3D. ¿Qué nos deparan las Crónicas del Origen?`;
    }

    return res.json({ text: mockResponse, simulated: true });
  }

  try {
    // Setup conversations payload
    const formattedHistory = messages.map(m => ({
      role: m.isNitz ? 'model' : 'user',
      parts: [{ text: m.text }]
    }));

    // Inject system instructions inside generating content
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { role: 'user', parts: [{ text: systemInstruction }] },
        ...formattedHistory
      ]
    });

    const replyText = response.text || '*vibras silenciosas llenan el espacio*';
    res.json({ text: replyText });
  } catch (err: any) {
    console.error('Error llamando Gemini API:', err);
    res.status(500).json({ 
      error: 'Error de comunicación mística estelar.',
      details: err.message 
    });
  }
});

// 3. Vite development Server or production build serving
async function setupServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite middleware montado en Express.');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Sirviendo archivos estáticos de producción desdel directorio dist.');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Servidor full-stack iniciado exitosamente en http://localhost:${PORT}`);
  });
}

setupServer();
