# Base de Conhecimento TI — Sistema completo

Sistema de base de conhecimento com IA gratuita para equipes de suporte técnico.
Os técnicos fazem perguntas em linguagem natural e recebem respostas geradas a partir
das documentações, relatórios e notas cadastradas pela equipe.

## Estrutura

```
projeto-kb/
├── kb-server/    # Servidor central: documentos, busca e IA (roda em UMA máquina)
└── kb-desktop/   # App desktop: instalado no computador de CADA técnico
```

## Arquitetura

- O **servidor** roda numa máquina sempre ligada da empresa (ou VM na nuvem). Guarda os
  documentos e o histórico num banco SQLite, faz a busca full-text e chama a IA.
- O **app desktop** (Electron, funciona em Windows/macOS/Linux) se conecta ao servidor
  pela rede. Na primeira execução, o técnico informa o endereço do servidor uma vez.
- A **IA é gratuita**: usa o Groq (padrão) ou o Gemini, ambos com cota gratuita
  generosa e cadastro sem cartão de crédito.

---

## PASSO A PASSO

### Parte 1 — Obter a chave de IA gratuita (5 minutos)

1. Acesse **console.groq.com** e crie uma conta (gratuito, sem cartão).
2. No menu, vá em **API Keys** → **Create API Key**.
3. Dê um nome (ex: `kb-ti`) e copie a chave gerada (começa com `gsk_...`).
   Ela só aparece uma vez — guarde num lugar seguro.

*(Alternativa: se preferir o Gemini do Google, crie a chave em aistudio.google.com
e no `.env` use `AI_PROVIDER=gemini` e `GEMINI_API_KEY=...`)*

### Parte 2 — Subir o servidor central

Na máquina que será o servidor (precisa ter o Node.js 18+ instalado — nodejs.org):

```bash
cd kb-server
npm install

# Configurar a chave de IA
cp .env.example .env
# Abra o .env num editor e cole sua chave do Groq na linha GROQ_API_KEY=

npm start
```

Você verá: `✅ Servidor da Base de Conhecimento rodando na porta 3000`

**Descubra o IP desta máquina na rede** (os técnicos vão usar esse endereço):
- Windows: `ipconfig` → "Endereço IPv4" (ex: 192.168.1.50)
- Linux/macOS: `ip addr` ou `ifconfig`

Teste no navegador de outro computador da rede: `http://IP_DO_SERVIDOR:3000/api/status`
— deve aparecer `{"ok":true,...}`. Se não abrir, libere a porta 3000 no firewall do servidor.

**Para deixar rodando permanentemente** (recomendado):
```bash
npm install -g pm2
pm2 start src/server.js --name kb-server
pm2 save
pm2 startup   # siga a instrução exibida para iniciar junto com o sistema
```

### Parte 3 — Rodar o app desktop (modo desenvolvimento)

No seu computador (também precisa do Node.js):

```bash
cd kb-desktop
npm install
npm start
```

O app abre numa janela própria. Na primeira execução ele leva você para
**Configurações** → digite o endereço do servidor (ex: `http://192.168.1.50:3000`),
clique em **Testar conexão** e depois em **Salvar**.

### Parte 4 — Gerar os instaladores para a equipe

Quando estiver satisfeito com o app, gere os instaladores:

```bash
cd kb-desktop

npm run build:win     # gera .exe   (rode num Windows)
npm run build:mac     # gera .dmg   (rode num macOS)
npm run build:linux   # gera .AppImage e .deb (rode num Linux)
```

Os instaladores ficam na pasta `kb-desktop/dist/`. Distribua para os técnicos —
cada um instala normalmente, abre o app e configura o endereço do servidor uma vez.

> Observação: o electron-builder gera o instalador da plataforma em que você está.
> Para gerar o .exe você roda o build num Windows, para o .dmg num macOS, etc.

### Parte 5 — Usar no dia a dia

1. Na aba **Documentos**, cadastre as documentações: cada problema/solução vira um
   documento com título, categoria (ex: nome do sistema) e conteúdo detalhado.
2. Na aba **Perguntar**, o técnico digita a dúvida em linguagem natural.
3. O sistema busca os documentos mais relevantes e a IA monta a resposta **apenas
   com base neles**, citando as fontes.
4. A aba **Histórico** mostra tudo que já foi perguntado — útil para identificar
   dúvidas recorrentes que merecem documentação melhor.

---

## Dicas de conteúdo

A qualidade das respostas depende diretamente da qualidade dos documentos. Bons documentos têm:
- **Título específico**: "Sistema Atlas — erro 504 ao gerar boleto" (bom) vs "Erro no Atlas" (ruim)
- **Contexto + solução**: descreva o sintoma, a causa e o passo a passo da correção
- **Um problema por documento**: melhor 10 documentos curtos que 1 gigante

## Limites do plano gratuito

O Groq tem limite de requisições por minuto/dia no plano gratuito (suficiente para uma
equipe pequena/média de suporte). Se um dia atingirem o limite com frequência, dá para
trocar por outro provedor mudando 2 linhas no `.env` do servidor — o app desktop não
precisa de nenhuma alteração.
