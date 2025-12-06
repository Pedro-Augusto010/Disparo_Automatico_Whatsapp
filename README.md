# 📱 Integração WhatsApp + n8n + Node.js

Este projeto conecta o WhatsApp Web ao n8n para criar um fluxo automatizado de envio e recebimento de mensagens.
Ele permite:

Enviar mensagens automáticas via HTTP endpoint;

Receber respostas dos clientes no WhatsApp e armazená-las via Webhook no n8n;

Gerar fluxos automatizados de atendimento, feedback ou coleta de dados.

## 🧩 Arquitetura do Projeto 

Fluxo completo:

O n8n inicia um Webhook (/webhook/feedback-in);

O script Node.js com whatsapp-web.js monitora mensagens recebidas;

Cada mensagem é empacotada em JSON e enviada via POST para o Webhook do n8n;

O n8n processa e grava a resposta (por exemplo, salva em arquivo, banco ou planilha);

O mesmo script pode enviar mensagens automáticas via POST /send.

Exemplo de workflow no n8n

O fluxo segue aproximadamente este formato:

graph LR
A[Webhook: feedback-in] --> B[Edit Fields]
B --> C[Code (processar JSON)]
C --> D[Read/Write File]
D --> E[Merge]
E --> F[Code (armazenar)]
F --> G[Write File]

## 🚀 Instalação
1️⃣ Clonar o repositório
git clone https://github.com/seu-usuario/n8n-whatsapp-integration.git
cd n8n-whatsapp-integration

2️⃣ Instalar dependências
npm install


## Dependências principais:

whatsapp-web.js — controle do WhatsApp Web

express — servidor REST

body-parser — parser JSON

qrcode-terminal — exibe QR code no terminal

node-fetch — fallback para fetch

puppeteer — backend do navegador (caso necessário)

## ⚙️ Configuração

Edite o arquivo principal (por exemplo, index.js) e ajuste a variável:

const FEEDBACK_WEBHOOK_URL = 'http://127.0.0.1:5678/webhook/feedback-in';


⚠️ Use sempre a Production URL do seu Webhook no n8n (não a de teste).
Se o n8n estiver rodando em Docker, use http://host.docker.internal:5678/... ou o hostname da rede docker (http://n8n:5678/...).

## ▶️ Execução

Inicie o servidor:

node index.js


Será exibido um QR Code no terminal.
Escaneie com o WhatsApp em Aparelhos conectados > Conectar novo aparelho.

Quando aparecer:

✅ WhatsApp conectado e pronto!
🚀 Servidor em http://localhost:3000


o sistema está pronto.

📤 Envio de Mensagens

Você pode enviar mensagens com um POST simples:

curl -X POST http://localhost:3000/send \
  -H "Content-Type: application/json" \
  -d '{"phone":"5511999999999", "message":"Olá, tudo bem?"}'


Resposta esperada:

{ "ok": true, "id": "false_5511999999999@c.us_..." }

📥 Recebimento de Mensagens

Sempre que um cliente responder, o script envia um POST automático para o Webhook configurado no n8n.

Exemplo de payload recebido:

{
  "phone": "5511999999999",
  "text": "Sim, quero saber mais!",
  "timestamp": "2025-11-24T15:00:00.000Z",
  "from": "5511999999999@c.us",
  "to": "5511988888888@c.us",
  "type": "chat",
  "source": "message"
}

🛠️ Diagnóstico e Logs

Durante a execução, o script imprime eventos como:

[auth] ✅ Autenticado.
✅ WhatsApp conectado e pronto!
[message] from: 5511999999999@c.us body: "Oi!"
→ Webhook OK: 200


Se houver erro ao enviar para o webhook:

❌ Webhook não OK: 404 <vazio>
❌ Erro ao chamar webhook: connect ECONNREFUSED 127.0.0.1:5678


Verifique:

Se o workflow do n8n está ativo;

Se a URL é a production;

Se o script consegue acessar o host/porta do n8n.

## 🧱 Estrutura do Projeto
📦 n8n-whatsapp-integration/
├── index.js                 # Código principal (servidor e cliente WhatsApp)
├── package.json             # Dependências
├── README.md                # Este arquivo
└── .wwebjs_auth/            # Sessão autenticada do WhatsApp (criada automaticamente)
