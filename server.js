// server.js

const fs = require('fs');
const path = require('path');
const { Client, LocalAuth } = require('whatsapp-web.js');
const express = require('express');
const bodyParser = require('body-parser');
const qrcode = require('qrcode-terminal');


const fetch = global.fetch || ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));

const app = express();
app.use(bodyParser.json());

// ---------- CONFIG ----------

const FEEDBACK_WEBHOOK_URL = 'http://127.0.0.1:5678/webhook/feedback-in';
// ----------------------------

// ---------- RASTREIO DE NÚMEROS QUE RECEBERAM DISPARO ----------
const trackedPhones = new Map();


function markAsTracked(digits) {
  trackedPhones.set(digits, Date.now());
  console.log('[track] número marcado como rastreado:', digits);
}

function isTracked(digits) {
  const info = trackedPhones.get(digits);
  if (!info) return false;


  const maxAgeMs = 7 * 24 * 60 * 60 * 1000;
  if (Date.now() - info > maxAgeMs) {
    console.log('[track] expirou rastreio para:', digits);
    trackedPhones.delete(digits);
    return false;
  }
  return true;
}
// ----------------------------------------------------------------

function pickBrowserExecutable() {
  const candidates = [
   
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',

    'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
    
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  ];
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) return p;
    } catch (_) {}
  }
  return null; 
}

const executablePath = pickBrowserExecutable();
if (executablePath) {
  console.log('[browser] Usando executável:', executablePath);
} else {
  console.log('[browser] Nenhum Chrome/Edge encontrado. Usarei o Chromium do Puppeteer (requer "npm i puppeteer").');
}


const client = new Client({
  authStrategy: new LocalAuth(),
  puppeteer: {
    headless: true, 
    executablePath: executablePath || undefined,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-gpu',
      '--no-zygote',
      '--disable-dev-shm-usage',
      '--disable-extensions',
      '--disable-features=Translate',
      '--no-first-run',
      '--no-default-browser-check',
      '--lang=pt-BR',
    ],
  },
});


client.on('qr', qr => {
  console.log('\n[QR] Escaneie (WhatsApp > Aparelhos conectados > Conectar novo aparelho):');
  qrcode.generate(qr, { small: true });
});
client.on('loading_screen', (pct, msg) => console.log(`[loading] ${pct}% ${msg}`));
client.on('authenticated', () => console.log('[auth]  Autenticado.'));
client.on('auth_failure', m => console.error(' Falha de autenticação:', m));
client.on('ready', () => console.log(' WhatsApp conectado e pronto!'));
client.on('change_state', s => console.log('[state]', s));
client.on('disconnected', r => console.warn(' Desconectado:', r));

console.log('[init] Inicializando cliente WhatsApp...');
client.initialize();

// Endpoints utilitários
app.get('/health', (_req, res) => res.json({ ok: true }));
app.get('/state', async (_req, res) => {
  try {
    const state = await client.getState();
    res.json({ state });
  } catch (err) {
    res.status(503).json({ state: 'UNKNOWN', error: err.message });
  }
});

// ---------- FUNÇÃO PARA CHAMAR O WEBHOOK DO N8N ----------
async function postToWebhook(payload) {
  try {
    const resp = await fetch(FEEDBACK_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify(payload),
    });
    const txt = await resp.text().catch(() => '');
    console.log(`→ Webhook status: ${resp.status} body: ${txt || '<vazio>'}`);
  } catch (e) {
    console.error('Erro ao chamar webhook:', e.message);
  }
}

// ---------- RECEBIMENTO: APENAS RESPOSTAS DE NÚMEROS RASTREADOS ----------
client.on('message', async (msg) => {
  try {
    console.log('[message] from:', msg.from, 'to:', msg.to, 'fromMe:', msg.fromMe, 'type:', msg.type, 'body:', JSON.stringify(msg.body));

    if (msg.fromMe) return;


    const phoneDigits = String(msg.from || '').replace(/\D/g, '');


    if (!isTracked(phoneDigits)) {
      console.log('[skip] mensagem de número NÃO rastreado:', phoneDigits);
      return;
    }

    const payload = {
      phone: phoneDigits,
      text: msg.body || '',
      timestamp: new Date((msg.timestamp || Date.now()) * 1000).toISOString(),
      from: msg.from,
      to: msg.to,
      type: msg.type || 'chat',
      source: 'message', 
    };

    await postToWebhook(payload);
  } catch (e) {
    console.error('Erro no handler message:', e.message);
  }
});

// ---------- ENVIO: ENDPOINT PARA O N8N DISPARAR MENSAGENS ----------
app.post('/send', async (req, res) => {
  console.log('DEBUG /send body:', req.body);
  try {
    const { phone, message } = req.body || {};
    if (!phone || !message) {
      return res.status(400).json({ ok: false, error: 'Campos "phone" e "message" são obrigatórios.' });
    }

    // Mantém somente dígitos do telefone
    const digits = String(phone).replace(/\D/g, '');
    if (!/^\d{10,15}$/.test(digits)) {
      return res.status(400).json({ ok: false, error: 'Telefone inválido. Use 55+DDD+numero, somente dígitos.' });
    }

    const state = await client.getState().catch(() => 'DISCONNECTED');
    if (state !== 'CONNECTED' && state !== 'OPENING') {
      return res.status(503).json({ ok: false, error: `WhatsApp não está pronto (state=${state}).` });
    }

    const jid = `${digits}@c.us`;
    const sent = await client.sendMessage(jid, String(message));
    console.log(`→ Mensagem enviada para ${digits}`);

    // Marca esse número como "aguardando resposta"
    markAsTracked(digits);

    res.json({ ok: true, id: sent?.id?._serialized || sent?.id?.id || null });
  } catch (e) {
    console.error('Erro /send:', e);
    res.status(500).json({ ok: false, error: e?.message || String(e) });
  }
});

app.listen(3000, () => console.log(' Servidor em http://localhost:3000'));
