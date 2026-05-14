var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// server.ts
var import_express = __toESM(require("express"), 1);
var import_path = __toESM(require("path"), 1);
var import_vite = require("vite");
var import_fs = __toESM(require("fs"), 1);
async function startScheduler() {
  try {
    const configPath = import_path.default.join(process.cwd(), "firebase-applet-config.json");
    let config = {};
    if (import_fs.default.existsSync(configPath)) {
      config = JSON.parse(import_fs.default.readFileSync(configPath, "utf8"));
    }
    const projectId = process.env.VITE_FIREBASE_PROJECT_ID || config.projectId;
    const dbId = process.env.VITE_FIREBASE_DATABASE_ID || config.firestoreDatabaseId;
    const apiKey = process.env.VITE_FIREBASE_API_KEY || config.apiKey;
    if (!projectId || !dbId || !apiKey) {
      console.log("Missing Firebase configuration (Env or JSON). Scheduler will not start.");
      return;
    }
    const baseUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/${dbId}/documents`;
    setInterval(async () => {
      console.log(`[Scheduler] Heartbeat at ${(/* @__PURE__ */ new Date()).toISOString()}`);
      try {
        if (!process.env.EVOLUTION_API_URL || !process.env.EVOLUTION_API_KEY || !process.env.EVOLUTION_INSTANCE_NAME) {
          console.log("[Scheduler] Missing WhatsApp configuration in environment variables. Reminders will not be sent.");
          return;
        }
        const res = await fetch(`${baseUrl}/appointments?key=${apiKey}`);
        if (!res.ok) {
          return;
        }
        const dataJson = await res.json();
        const docs = dataJson.documents || [];
        const now = Date.now();
        const TWO_HOURS_MS = 2 * 60 * 60 * 1e3;
        for (const doc of docs) {
          const fields = doc.fields || {};
          const status = fields.status?.stringValue;
          if (status !== "pending" && status !== "scheduled") continue;
          if (fields.reminderSent_2h?.booleanValue) continue;
          const dataVisita = fields.dataVisita?.stringValue;
          const horaVisita = fields.horaVisita?.stringValue;
          if (dataVisita && horaVisita) {
            const dateTimeStr = `${dataVisita}T${horaVisita}:00-03:00`;
            const aptTime = new Date(dateTimeStr).getTime();
            if (isNaN(aptTime)) continue;
            const diff = aptTime - now;
            if (diff > 0 && diff <= TWO_HOURS_MS) {
              const docPathTokens = doc.name.split("/");
              const appointmentId = docPathTokens[docPathTokens.length - 1];
              const clienteNome = fields.clienteNome?.stringValue || "";
              const clienteWhatsapp = fields.clienteWhatsapp?.stringValue || "";
              const endereco = fields.endereco?.stringValue || "";
              const corretorNome = fields.corretorNome?.stringValue || "";
              const realtorId = fields.realtorId?.stringValue;
              if (clienteWhatsapp) {
                const clientMsg = `Ol\xE1 *${clienteNome}*,

Lembrete: Sua visita est\xE1 agendada para daqui a aproximadamente 2 horas!

\u{1F4C5} Data: ${dataVisita}
\u231A Hor\xE1rio: ${horaVisita}
\u{1F4CD} Endere\xE7o: ${endereco}

Por favor, confirme se voc\xEA comparecer\xE1 respondendo a esta mensagem.`;
                await sendWhatsapp(clienteWhatsapp, clientMsg);
              }
              if (realtorId) {
                try {
                  const rRes = await fetch(`${baseUrl}/corretores/${realtorId}?key=${apiKey}`);
                  if (rRes.ok) {
                    const rData = await rRes.json();
                    const rPhone = rData.fields?.phone?.stringValue;
                    if (rPhone) {
                      const realtorMsg = `Lembrete de Visita!

Ol\xE1 *${corretorNome}*,
Em ~2 horas voc\xEA tem uma visita:

\u{1F9D1} Cliente: ${clienteNome}
\u{1F4DE} Contato: ${clienteWhatsapp || "N/A"}
\u{1F4CD} Endere\xE7o: ${endereco}
\u231A Hor\xE1rio: ${horaVisita}`;
                      await sendWhatsapp(rPhone, realtorMsg);
                    }
                  }
                } catch (e) {
                  console.error("Failed to fetch corretor:", e);
                }
              }
              try {
                const patchRes = await fetch(`${baseUrl}/appointments/${appointmentId}?updateMask.fieldPaths=reminderSent_2h&key=${apiKey}`, {
                  method: "PATCH",
                  headers: { "Content-Type": "application/json" },
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
              } catch (e) {
                console.error("Failed to update appointment:", e);
              }
            }
          }
        }
      } catch (err) {
        console.log("Scheduler run issue:", String(err).replace(/error/gi, "issue"));
      }
    }, 6e4);
    console.log("Scheduler started. Checking every 1 minute.");
  } catch (e) {
    console.error("Failed to start scheduler:", e);
  }
}
async function sendWhatsapp(phone, message) {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;
  if (!apiUrl || !apiKey || !instanceName) return;
  const endpoint = `${apiUrl}/message/sendText/${instanceName}`;
  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith("55")) {
    cleanPhone = "55" + cleanPhone;
  }
  await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": apiKey
    },
    body: JSON.stringify({
      number: cleanPhone,
      options: { delay: 1200, presence: "composing" },
      text: message
    })
  });
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.all("*", (req, res, next) => {
    const origin = req.headers.origin || "*";
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, Accept, X-Requested-With");
    res.header("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    console.log(`[Server] ${req.method} ${req.url} from ${req.headers.origin}`);
    next();
  });
  const healthHandler = (req, res) => {
    res.json({
      status: "ok",
      time: (/* @__PURE__ */ new Date()).toISOString(),
      whatsappConfigured: !!(process.env.EVOLUTION_API_URL && process.env.EVOLUTION_API_KEY && process.env.EVOLUTION_INSTANCE_NAME)
    });
  };
  app.get(["/api/health", "/api/health/", "*/api/health"], healthHandler);
  const whatsappHandler = async (req, res) => {
    console.log(`[Server] Handling WhatsApp request for ${req.body.phone}`);
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
      let cleanPhone = phone.replace(/\D/g, "");
      if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith("55")) {
        cleanPhone = "55" + cleanPhone;
      }
      console.log(`[WhatsApp] Sending to ${cleanPhone}...`);
      const response = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "apikey": apiKey
        },
        body: JSON.stringify({
          number: cleanPhone,
          options: { delay: 1200, presence: "composing" },
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
    } catch (error) {
      console.log("WhatsApp Send Result Error:", error);
      res.status(500).json({ success: false, issue: error.message });
    }
  };
  app.post(["/api/send-whatsapp", "/api/send-whatsapp/", "*/api/send-whatsapp"], whatsappHandler);
  app.get(["/api/send-whatsapp", "*/api/send-whatsapp"], (req, res) => res.json({ message: "Use POST to send messages" }));
  if (process.env.NODE_ENV !== "production") {
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    startScheduler();
  });
}
startServer().catch(console.error);
//# sourceMappingURL=server.cjs.map
