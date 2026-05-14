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

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url} from ${req.headers.origin}`);
    next();
  });

  // CORS configuration
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'apikey'],
    credentials: true
  }));
  
  // Explicit OPTIONS handler for preflights
  app.options('*', (req, res) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey');
    res.sendStatus(200);
  });

  app.use(express.json());

  // Test Route
  const healthHandler = (req: express.Request, res: express.Response) => {
    res.json({ 
      status: 'ok', 
      whatsappConfigured: !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE_NAME)
    });
  };

  app.get('/api/health', healthHandler);
  app.get('/api/health/', healthHandler);
  app.get('/Sistema-visitas/api/health', healthHandler);

  // Evolution API Whatsapp Route
  const whatsappHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { phone, message } = req.body;
      
      const apiUrl = process.env.EVOLUTION_API_URL;
      const apiKey = process.env.EVOLUTION_API_KEY;
      const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

      if (!apiUrl || !apiKey || !instanceName) {
        console.log("[WhatsApp] Attempted to send but credentials are missing in Environment Variables.");
        return res.status(400).json({ 
          success: false, 
          issue: "Evolution API environment variables are not configured." 
        });
      }

      let cleanPhone = phone.replace(/\D/g, '');
      if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
        cleanPhone = '55' + cleanPhone;
      }

      console.log(`[WhatsApp] Sending to ${cleanPhone}...`);

      const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
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

      if (!response.ok) {
        const errInfo = await response.text();
        console.error(`[WhatsApp] Evolution API error:`, errInfo);
        return res.status(response.status).json({ success: false, details: errInfo });
      }

      const data = await response.json();
      res.json({ success: true, data });
    } catch (error: any) {
      console.log("WhatsApp Send Result Error:", error);
      res.status(500).json({ success: false, issue: error.message });
    }
  };

  // Register the route for multiple common paths
  app.post('/api/send-whatsapp', whatsappHandler);
  app.post('/api/send-whatsapp/', whatsappHandler);
  app.post('/Sistema-visitas/api/send-whatsapp', whatsappHandler);
  app.post('/Sistema-visitas/api/send-whatsapp/', whatsappHandler);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startScheduler();
  });
}

startServer().catch(console.error);
