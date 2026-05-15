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
var import_fs = __toESM(require("fs"), 1);
console.log(`[Startup] Initializing Agenda Moderna Backend...`);
console.log(`[Startup] NODE_ENV: ${process.env.NODE_ENV}`);
console.log(`[Startup] CWD: ${process.cwd()}`);
var isProd = process.env.NODE_ENV === "production" || import_fs.default.existsSync(import_path.default.join(process.cwd(), "dist/index.html"));
async function sendDirectWhatsapp(phone, message) {
  const apiUrl = process.env.EVOLUTION_API_URL;
  const apiKey = process.env.EVOLUTION_API_KEY;
  const instanceName = process.env.EVOLUTION_INSTANCE_NAME;
  if (!apiUrl || !apiKey || !instanceName) {
    console.error("[Scheduler] WhatsApp config missing");
    return;
  }
  let cleanPhone = phone.replace(/\D/g, "");
  if (cleanPhone.length >= 10 && cleanPhone.length <= 11 && !cleanPhone.startsWith("55")) {
    cleanPhone = "55" + cleanPhone;
  }
  try {
    const res = await fetch(`${apiUrl}/message/sendText/${instanceName}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": apiKey },
      body: JSON.stringify({
        number: cleanPhone,
        options: { delay: 1200, presence: "composing" },
        text: message
      })
    });
    console.log(`[Scheduler] WhatsApp Send Status: ${res.status}`);
  } catch (e) {
    console.error("[Scheduler] WhatsApp Send Error:", e);
  }
}
async function startScheduler() {
  console.log("[Scheduler] Starting...");
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
              const cleanPhone = (fields.clienteWhatsapp?.stringValue || "").replace(/\D/g, "");
              const endereco = fields.endereco?.stringValue || "";
              const realtorId = fields.realtorId?.stringValue;
              if (cleanPhone) {
                const clientMsg = `Ol\xE1 *${clienteNome}*,

Lembrete: Sua visita est\xE1 agendada para daqui a aproximadamente 2 horas!

\u{1F4C5} Data: ${dataVisita}
\u231A Hor\xE1rio: ${horaVisita}
\u{1F4CD} Endere\xE7o: ${endereco}`;
                await sendDirectWhatsapp(cleanPhone, clientMsg);
              }
              if (realtorId) {
                try {
                  const rRes = await fetch(`${baseUrl}/corretores/${realtorId}?key=${apiKey}`);
                  if (rRes.ok) {
                    const rData = await rRes.json();
                    const rPhone = (rData.fields?.phone?.stringValue || rData.fields?.whatsapp?.stringValue || "").replace(/\D/g, "");
                    if (rPhone) {
                      const realtorMsg = `Lembrete!
Voc\xEA tem uma visita em ~2h:

\u{1F9D1} Cliente: ${clienteNome}
\u{1F4CD} Endere\xE7o: ${endereco}
\u231A Hor\xE1rio: ${horaVisita}`;
                      await sendDirectWhatsapp(rPhone, realtorMsg);
                    }
                  }
                } catch (e) {
                }
              }
              await fetch(`${baseUrl}/appointments/${appointmentId}?updateMask.fieldPaths=reminderSent_2h&key=${apiKey}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ fields: { reminderSent_2h: { booleanValue: true } } })
              });
            }
          }
        }
      } catch (err) {
      }
    }, 6e4);
    console.log("[Scheduler] Active.");
  } catch (e) {
    console.error("[Scheduler] Init Error:", e);
  }
}
async function startServer() {
  const app = (0, import_express.default)();
  const PORT = 3e3;
  app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS, PATCH");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization, apikey");
    res.header("Access-Control-Max-Age", "86400");
    if (req.method === "OPTIONS") {
      return res.status(200).end();
    }
    next();
  });
  app.use(import_express.default.json());
  app.use((req, res, next) => {
    if (req.method !== "OPTIONS") {
      console.log(`[REQ] ${req.method} ${req.url}`);
    } else {
      console.log(`[OPTIONS] ${req.url}`);
    }
    next();
  });
  app.get("/api/test-cors", (req, res) => res.json({ success: true, message: "CORS is working" }));
  app.get("/health", (req, res) => res.json({ status: "alive", v: "1.3.9", prod: isProd }));
  app.get("/api/health", (req, res) => res.json({ status: "alive", api: true }));
  app.post("/api/send-whatsapp", async (req, res) => {
    const { phone, message } = req.body;
    console.log(`[API] send-whatsapp processing: ${phone}`);
    const apiUrl = process.env.EVOLUTION_API_URL;
    const apiKey = process.env.EVOLUTION_API_KEY;
    const instanceName = process.env.EVOLUTION_INSTANCE_NAME;
    if (!phone || !message || !apiUrl || !apiKey || !instanceName) {
      console.error("[API] Config missing in environment");
      return res.status(400).json({ success: false, error: "Servidor n\xE3o configurado corretamente." });
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
      try {
        responseData = JSON.parse(responseText);
      } catch (e) {
        responseData = responseText;
      }
      console.log(`[API] Evolution API Response: ${response.status}`);
      res.status(response.status).json({ success: response.ok, data: responseData });
    } catch (error) {
      console.error("[API] Internal Proxy Error:", error.message);
      res.status(500).json({ success: false, error: error.message });
    }
  });
  const distPath = import_path.default.join(process.cwd(), "dist");
  if (isProd) {
    console.log(`[Server] Production Mode: Serving dist folder`);
    app.use(import_express.default.static(distPath));
    app.get("*", (req, res, next) => {
      if (req.url.startsWith("/api/")) return next();
      const indexPath = import_path.default.join(distPath, "index.html");
      if (import_fs.default.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send("Frontend assets not found.");
      }
    });
  } else {
    console.log("[Server] Development Mode: Starting Vite Middleware");
    try {
      const { createServer: createViteServer } = await import("vite");
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      app.use(vite.middlewares);
    } catch (e) {
      console.error("[Server] Critical: Failed to start Vite", e);
    }
  }
  app.use((req, res) => {
    res.status(404).json({ error: "Route not found", path: req.url });
  });
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Agenda Moderna v1.3.8 active on port ${PORT}`);
    startScheduler();
  });
}
startServer().catch((err) => {
  console.error("[Server] CRITICAL BOOT ERROR:", err);
});
//# sourceMappingURL=server.cjs.map
