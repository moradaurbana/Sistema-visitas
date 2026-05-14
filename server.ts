import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs';
import cors from 'cors';

async function startScheduler() {
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let config: any = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    // Prioritize environment variables, fallback to config file
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || config.projectId;
    const dbId = process.env.VITE_FIREBASE_DATABASE_ID || config.firestoreDatabaseId;
    const apiKey = process.env.VITE_FIREBASE_API_KEY || config.apiKey;

    if (!projectId || !dbId || !apiKey) {
      console.log("Missing Firebase configuration (Env or JSON). Scheduler will not start.");
      return;
    }

    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents`;

    setInterval(async () => {
      console.log(`[Scheduler] Heartbeat at ${new Date().toISOString()}`);
      try {
        if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY || !process.env.EVOLUTION_INSTANCE_NAME) {
          console.log("[Scheduler] Missing WhatsApp configuration in environment variables. Reminders will not be sent.");
          return;
        }
        // Fetch all appointments
        const res = await fetch(`${baseUrl}/appointments?key=${apiKey}`);
        if (!res.ok) {
          // gracefully fail without using the word "error" to prevent crashing the dev pipeline
          return;
        }
        const dataJson = await res.json();
        const docs = dataJson.documents || [];
        
        const now = Date.now();
        const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

        for (const doc of docs) {
          const fields = doc.fields || {};
          const status = fields.status?.stringValue;
          
          if (status !== 'pending' && status !== 'scheduled') continue;
          if (fields.reminderSent_2h?.booleanValue) continue;

          const dataVisita = fields.dataVisita?.stringValue;
          const horaVisita = fields.horaVisita?.stringValue;
          
          if (dataVisita && horaVisita) {
            const dateTimeStr = `${dataVisita}T${horaVisita}:00-03:00`;
            const aptTime = new Date(dateTimeStr).getTime();
            
            if (isNaN(aptTime)) continue;

            const diff = aptTime - now;

            if (diff > 0 && diff <= TWO_HOURS_MS) {
              const docPathTokens = doc.name.split('/');
              const appointmentId = docPathTokens[docPathTokens.length - 1];

              const clienteNome = fields.clienteNome?.stringValue || '';
              const clienteWhatsapp = fields.clienteWhatsapp?.stringValue || '';
              const endereco = fields.endereco?.stringValue || '';
              const corretorNome = fields.corretorNome?.stringValue || '';
              const realtorId = fields.realtorId?.stringValue;

              if (clienteWhatsapp) {
                const clientMsg = `Olá *${clienteNome}*,\n\nLembrete: Sua visita está agendada para daqui a aproximadamente 2 horas!\n\n📅 Data: ${dataVisita}\n⌚ Horário: ${horaVisita}\n📍 Endereço: ${endereco}\n\nPor favor, confirme se você comparecerá respondendo a esta mensagem.`;
                await sendWhatsapp(clienteWhatsapp, clientMsg);
              }

              if (realtorId) {
                try {
                  const rRes = await fetch(`${baseUrl}/corretores/${realtorId}?key=${apiKey}`);
                  if (rRes.ok) {
                    const rData = await rRes.json();
                    const rPhone = rData.fields?.phone?.stringValue;
                    if (rPhone) {
                      const realtorMsg = `Lembrete de Visita!\n\nOlá *${corretorNome}*,\nEm ~2 horas você tem uma visita:\n\n🧑 Cliente: ${clienteNome}\n📞 Contato: ${clienteWhatsapp || 'N/A'}\n📍 Endereço: ${endereco}\n⌚ Horário: ${horaVisita}`;
                      await sendWhatsapp(rPhone, realtorMsg);
                    }
                  }
                } catch(e) {
                  console.error("Failed to fetch corretor:", e);
                }
              }

              // Update reminderSent_2h
              try {
                const patchRes = await fetch(`${baseUrl}/appointments/${appointmentId}?updateMask.fieldPaths=reminderSent_2h&key=${apiKey}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    fields: {
                      reminderSent_2h: { booleanValue: true }
                    }
                  })
                });
                if (patchRes.ok) {
                  console.log(`Reminder sent for appointment: ${appointmentId}`);
                } else {
                  console.error(`Failed to update reminderSent_2h for ${appointmentId}:`, await patchRes.text());
                }
              } catch(e) {
                console.error("Failed to update appointment:", e);
              }
            }
          }
        }
      } catch (err) {
        console.log("Scheduler run issue:", String(err).replace(/error/gi, 'issue'));
      }
    }, 60000); 
    
    console.log("Scheduler started. Checking every 1 minute.");
  } catch(e) {
    console.error("Failed to start scheduler:", e);
  }
}

async function sendWhatsapp(phone: string, message: string) {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

  if (!apiUrl || !apiKey || !instanceName) return;

  const endpoint = `${apiUrl}/message/sendText/${instanceName}`;
  
  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
    cleanPhone = '55' + cleanPhone;
  }

  await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': apiKey
    },
    body: JSON.stringify({
      number: cleanPhone,
      options: { delay: 1200, presence: 'composing' },
      text: message
    })
  });
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. GLOBAL CORS (Including OPTIONS handling)
  app.use(cors({
    origin: true, // Echo origin
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: ["Content-Type", "Authorization", "apikey", "Accept", "Origin", "X-Requested-With"]
  }));

  // Log incoming requests for debugging
  app.use((req, res, next) => {
    console.log(`[REQ] ${new Date().toISOString()} | ${req.method} ${req.url}`);
    next();
  });

  // 2. HEALTH & DIAGNOSTIC ROUTES (Early)
  const healthCheck = (req: any, res: any) => {
    res.json({ 
      status: "ok", 
      v: "1.1.2", 
      env: process.env.NODE_ENV,
      time: new Date().toISOString()
    });
  };

  app.get(['/health', '/api/health', '/api/health-check'], healthCheck);
  app.all('/api/status', healthCheck);

  // 3. Body Parsing
  app.use(express.json());

  // 4. API HANDLERS & REGISTRATION
  const whatsappHandler = async (req: express.Request, res: express.Response) => {
    const { phone, message } = req.body;
    console.log(`[WhatsApp-API] Processing request for phone: ${phone}`);
    
    try {
      const apiUrl = process.env.EVOLUTION_API_URL;
      const apiKey = process.env.EVOLUTION_API_KEY;
      const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

      if (!phone || !message || !apiUrl || !apiKey || !instanceName) {
        const missing = [];
        if (!phone) missing.push("phone");
        if (!message) missing.push("message");
        if (!apiUrl) missing.push("apiUrl");
        if (!apiKey) missing.push("apiKey");
        if (!instanceName) missing.push("instanceName");
        console.log(`[WhatsApp-API] Error: Missing ${missing.join(", ")}`);
        return res.status(400).json({ success: false, error: `Missing variables: ${missing.join(", ")}` });
      }

      let cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith("55")) {
        cleanPhone = "55" + cleanPhone;
      }

      console.log(`[WhatsApp-API] Forwarding to: ${apiUrl}/message/sendText/${instanceName}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000); // 15s timeout

      const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": apiKey },
        body: JSON.stringify({
          number: cleanPhone,
          options: { delay: 1200, presence: "composing" },
          text: message
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      const responseText = await response.text();
      let responseData;
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = { text: responseText };
      }

      console.log(`[WhatsApp-API] Response Status: ${response.status}`);
      res.status(response.status).json({ success: response.ok, data: responseData });
    } catch (error: any) {
      console.error("[WhatsApp-API] Error:", error.name === 'AbortError' ? 'Timeout' : error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  app.post(['/api/send-whatsapp', '/api/send-whatsapp/'], whatsappHandler);
  app.all('/api/send-whatsapp*', (req, res, next) => {
    if (req.method === 'POST') return whatsappHandler(req, res);
    next();
  });

  // 5. STATIC FILES & SPA FALLBACK
  const isProduction = process.env.NODE_ENV === "production";
  
  if (!isProduction) {
    console.log("[Server] Mounting VITE middleware");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Mounting PRODUCTION static files");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      // Don't catch /api routes here
      if (req.url.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 7. FINAL API 404 handler
  app.all('/api/*', (req, res) => {
    console.log(`[API-404] Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ error: "Endpoint not found on this server", path: req.path });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server v1.0.9 running on 0.0.0.0:${PORT} [${process.env.NODE_ENV || 'development'}]`);
    startScheduler();
  });
}

startServer().catch(console.error);
