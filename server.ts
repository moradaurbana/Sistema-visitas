import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';

/**
 * Agenda Moderna - Backend Server v1.3.5
 * Definitively fixed for Production and Development
 */

console.log(`[Startup] Initializing Agenda Moderna Backend...`);
console.log(`[Startup] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[Startup] CWD: ${process.cwd()}`);

const isProd = process.env.NODE_ENV === "production" || fs.existsSync(path.join(process.cwd(), 'dist/index.html'));

async function sendDirectWhatsapp(phone: string, message: string) {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

  if (!apiUrl || !apiKey || !instanceName) {
    console.error("[Scheduler] WhatsApp config missing");
    return;
  }

  let cleanPhone = phone.replace(/\D/g, '');
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith('55')) {
    cleanPhone = '55' + cleanPhone;
  }

  try {
    const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'apikey': apiKey },
      body: JSON.stringify({
        number: cleanPhone,
        options: { delay: 1200, presence: 'composing' },
        text: message
      })
    });
    console.log(`[Scheduler] WhatsApp Send Status: ${res.status}`);
  } catch(e) {
    console.error("[Scheduler] WhatsApp Send Error:", e);
  }
}

async function startScheduler() {
  console.log("[Scheduler] Starting...");
  try {
    const configPath = path.join(process.cwd(), 'firebase-applet-config.json');
    let config: any = {};
    if (fs.existsSync(configPath)) {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    }
    
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || config.projectId;
    const dbId = process.env.VITE_FIREBASE_DATABASE_ID || config.firestoreDatabaseId;
    const apiKey = process.env.VITE_FIREBASE_API_KEY || config.apiKey;

    if (!projectId || !dbId || !apiKey) {
      console.log("[Scheduler] FireBase config not found. Scheduler sleeping.");
      return;
    }

    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents`;

    setInterval(async () => {
      try {
        if (!process.env.EVOLUTION_API_URL) return;
        
        const res = await fetch(`${baseUrl}/appointments?key=${apiKey}`);
        if (!res.ok) return;

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
              const cleanPhone = (fields.clienteWhatsapp?.stringValue || '').replace(/\D/g, '');
              const endereco = fields.endereco?.stringValue || '';
              const realtorId = fields.realtorId?.stringValue;

              if (cleanPhone) {
                const clientMsg = `Olá *${clienteNome}*,\n\nLembrete: Sua visita está agendada para daqui a aproximadamente 2 horas!\n\n📅 Data: ${dataVisita}\n⌚ Horário: ${horaVisita}\n📍 Endereço: ${endereco}`;
                await sendDirectWhatsapp(cleanPhone, clientMsg);
              }

              if (realtorId) {
                try {
                  const rRes = await fetch(`${baseUrl}/corretores/${realtorId}?key=${apiKey}`);
                  if (rRes.ok) {
                    const rData = await rRes.json();
                    const rPhone = (rData.fields?.phone?.stringValue || rData.fields?.whatsapp?.stringValue || '').replace(/\D/g, '');
                    if (rPhone) {
                      const realtorMsg = `Lembrete!\nVocê tem uma visita em ~2h:\n\n🧑 Cliente: ${clienteNome}\n📍 Endereço: ${endereco}\n⌚ Horário: ${horaVisita}`;
                      await sendDirectWhatsapp(rPhone, realtorMsg);
                    }
                  }
                } catch(e) {}
              }

              await fetch(`${baseUrl}/appointments/${appointmentId}?updateMask.fieldPaths=reminderSent_2h&key=${apiKey}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: { reminderSent_2h: { booleanValue: true } } })
              });
            }
          }
        }
      } catch (err) {}
    }, 60000); 
    
    console.log("[Scheduler] Active.");
  } catch(e) {
    console.error("[Scheduler] Init Error:", e);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  // 1. STANDARD CORS MIDDLEWARE
  app.use(cors({
    origin: '*', // Allows all origins
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
    allowedHeaders: ['Origin', 'X-Requested-With', 'Content-Type', 'Accept', 'Authorization', 'apikey']
  }));
  
  app.use(express.json());

  // Log all non-options requests
  app.use((req, res, next) => {
    if (req.method !== 'OPTIONS') {
      console.log(`[REQ] ${req.method} ${req.url}`);
    } else {
       console.log(`[OPTIONS] ${req.url}`);
    }
    next();
  });

  // Test route for CORS
  app.get('/api/test-cors', (req, res) => res.json({ success: true, message: "CORS is working" }));

  // 2. PRIMARY API ROUTES - BEFORE STATIC FILES
  app.get('/health', (req, res) => res.json({ status: "alive", v: "1.3.9", prod: isProd }));
  app.get('/api/health', (req, res) => res.json({ status: "alive", api: true }));
  
  app.post('/api/send-whatsapp', async (req, res) => {
    const { phone, message } = req.body;
    console.log(`[API] send-whatsapp processing: ${phone}`);
    
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME;

    if (!phone || !message || !apiUrl || !apiKey || !instanceName) {
      console.error("[API] Config missing in environment");
      return res.status(400).json({ success: false, error: "Servidor não configurado corretamente." });
    }

    try {
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

      const responseText = await response.text();
      let responseData;
      try { responseData = JSON.parse(responseText); } catch(e) { responseData = responseText; }
      
      console.log(`[API] Evolution API Response: ${response.status}`);
      res.status(response.status).json({ success: response.ok, data: responseData });
    } catch (error: any) {
      console.error("[API] Internal Proxy Error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });

  // 3. STATIC ASSETS & SPA FALLBACK
  const distPath = path.join(process.cwd(), "dist");

  if (isProd) {
    console.log(`[Server] Production Mode: Serving dist folder`);
    app.use(express.static(distPath));
    
    // SPA Fallback for any non-API route
    app.get('*', (req, res, next) => {
      // Safety check: don't serve index.html for missed /api requests
      if (req.url.startsWith('/api/')) return next();

      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Frontend assets not found.");
      }
    });
  } else {
    console.log("[Server] Development Mode: Starting Vite Middleware");
    try {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa'
      });
      app.use(vite.middlewares);
    } catch(e) {
      console.error("[Server] Critical: Failed to start Vite", e);
    }
  }

  // Final 404 for truly unhandled routes (likely missed API calls)
  app.use((req, res) => {
    res.status(404).json({ error: "Route not found", path: req.url });
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Agenda Moderna v1.3.8 active on port ${PORT}`);
    startScheduler();
  });
}

startServer().catch(err => {
  console.error("[Server] CRITICAL BOOT ERROR:", err);
});
