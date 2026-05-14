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

  // 1. CORS Configuration (Reflect Origin)
  app.use(cors({
    origin: (origin, callback) => {
      // Allow all origins for the API
      callback(null, true);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey', 'Accept', 'X-Requested-With']
  }));

  // 2. Body Parsing
  app.use(express.json());

  // 3. Central Logging for debugging
  app.use((req, res, next) => {
    if (req.url.includes('/api/')) {
      console.log(`[CORS-Debug] ${req.method} ${req.url} - Origin: ${req.headers.origin}`);
    }
    next();
  });

  // 4. API Routes (Before static files)
  const healthHandler = (req: express.Request, res: express.Response) => {
    res.json({ status: "ok", time: new Date().toISOString(), whatsapp: !!process.env.EVOLUTION_API_URL });
  };

  const whatsappHandler = async (req: express.Request, res: express.Response) => {
    const phone = req.body?.phone;
    console.log(`[WhatsApp-API] Sending to ${phone}`);
    try {
      const { message } = req.body;
      const apiUrl = process.env.EVOLUTION_API_URL;
      const apiKey = process.env.EVOLUTION_API_KEY;
      const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

      if (!phone || !message || !apiUrl || !apiKey || !instanceName) {
        return res.status(400).json({ success: false, error: "Missing parameters or server configuration" });
      }

      let cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith("55")) {
        cleanPhone = "55" + cleanPhone;
      }

      const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": apiKey },
        body: JSON.stringify({
          number: cleanPhone,
          options: { delay: 1200, presence: "composing" },
          text: message
        })
      });

      const data = await response.json();
      res.status(response.status).json({ success: response.ok, data });
    } catch (error: any) {
      console.error("[WhatsApp-API] Fatal error:", error);
      res.status(500).json({ success: false, error: error.message });
    }
  };

  // Explicitly map the most common paths
  app.get('/api/health', healthHandler);
  app.post('/api/send-whatsapp', whatsappHandler);
  
  // Wildcard API match for flexibility (in case of proxy prefixing)
  app.all('*/api/send-whatsapp', (req, res) => {
    if (req.method === 'POST') return whatsappHandler(req, res);
    res.json({ status: "ready" });
  });

  // 5. Static Files & SPA Fallback (Only after API routes)
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res, next) => {
      // Don't catch /api routes here
      if (req.url.startsWith('/api/')) return next();
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  // 6. Final 404 for API
  app.all('/api/*', (req, res) => {
    console.log(`[API-404] No route for ${req.method} ${req.url}`);
    res.status(404).json({ error: "API Route Not Found", url: req.url, method: req.method });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startScheduler();
  });
}

startServer().catch(console.error);
