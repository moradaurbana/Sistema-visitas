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
  app.get("/health", (req, res) => res.json({ status: "alive", v: "1.1.0" }));
  app.get("/api/health", (req, res) => res.json({ status: "alive", api: true, v: "1.1.0" }));
  app.use((req, res, next) => {
    console.log(`[REQ] ${(/* @__PURE__ */ new Date()).toISOString()} | ${req.method} ${req.url}`);
    const origin = req.headers.origin || "*";
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, HEAD");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, apikey, Accept, Origin, X-Requested-With");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });
  app.use(import_express.default.json());
  const healthCheck = (req, res) => {
    res.json({
      status: "ok",
      v: "1.1.0",
      env: process.env.NODE_ENV,
      time: (/* @__PURE__ */ new Date()).toISOString(),
      url: req.url
    });
  };
  app.all("/api", (req, res) => {
    res.json({
      message: "Agenda Moderna API",
      endpoints: ["/api/health", "/api/send-whatsapp", "/health"],
      v: "1.1.1"
    });
  });
  app.get("/api/health-check", healthCheck);
  app.get("/api/status", healthCheck);
  const whatsappHandler = async (req, res) => {
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
      const timeoutId = setTimeout(() => controller.abort(), 15e3);
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
    } catch (error) {
      console.error("[WhatsApp-API] Error:", error.name === "AbortError" ? "Timeout" : error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  };
  app.post(["/api/send-whatsapp", "/api/send-whatsapp/"], whatsappHandler);
  app.post(/.*\/api\/send-whatsapp\/?$/, whatsappHandler);
  const isProduction = process.env.NODE_ENV === "production";
  if (!isProduction) {
    console.log("[Server] Mounting VITE middleware");
    const vite = await (0, import_vite.createServer)({
      server: { middlewareMode: true },
      appType: "spa"
    });
    app.use(vite.middlewares);
  } else {
    console.log("[Server] Mounting PRODUCTION static files");
    const distPath = import_path.default.join(process.cwd(), "dist");
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.url.startsWith("/api/")) return next();
      res.sendFile(import_path.default.join(distPath, "index.html"));
    });
  }
  app.all("/api/*", (req, res) => {
    console.log(`[API-404] Route not found: ${req.method} ${req.url}`);
    res.status(404).json({ error: "Endpoint not found on this server", path: req.path });
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server v1.0.9 running on 0.0.0.0:${PORT} [${process.env.NODE_ENV || "development"}]`);
    startScheduler();
  });
}
startServer().catch(console.error);
//# sourceMappingURL=server.cjs.map
