const WebSocket = require('ws');
require('dotenv').config();

const apiKey = process.env.VITE_GEMINI_API_KEY || "AQ.Ab8RN6LwxHINJJYY9dadlpq-d-PU_3ur6AiOe9tbehb-lju3yA";
const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

console.log("Conectando a:", url.replace(apiKey, "HIDDEN_KEY"));
const ws = new WebSocket(url);

ws.on('open', () => {
    console.log("WS ABIERTO. Enviando Setup...");
    ws.send(JSON.stringify({
        setup: {
            model: "models/gemini-2.0-flash-exp",
            generationConfig: {
                responseModalities: ["AUDIO"]
            },
            systemInstruction: {
                parts: [{ text: "Eres un asistente de prueba. Di Hola mundo." }]
            }
        }
    }));

    setTimeout(() => {
        console.log("Enviando mensaje cliente...");
        ws.send(JSON.stringify({
            clientContent: {
                turns: [{ role: "user", parts: [{ text: "Hola!" }] }],
                turnComplete: true
            }
        }));
    }, 1000);
});

ws.on('message', (data) => {
    try {
        const msg = JSON.parse(data.toString());
        if (msg.serverContent) {
             console.log("RECIBIDO SERVER CONTENT:", JSON.stringify(msg.serverContent).substring(0, 100) + "...");
        } else {
             console.log("RECIBIDO:", data.toString().substring(0, 100));
        }
    } catch(e) {
        console.log("RECIBIDO BINARY/OTRO:", data);
    }
});

ws.on('error', (e) => console.log("ERROR:", e));
ws.on('close', (code, reason) => console.log("CLOSED:", code, reason.toString()));

setTimeout(() => {
    console.log("Cerrando prueba.");
    ws.close();
    process.exit(0);
}, 5000);
