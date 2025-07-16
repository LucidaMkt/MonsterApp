# Histórico de Conversas e Implementações - MonsterApp Extension

Este documento registra o progresso, decisões e implementações realizadas na extensão MonsterApp, conforme as interações com o usuário.

## 1. Objetivo Inicial: Otimização com Arquitetura de Agentes (15 de Julho de 2025)

**Visão:** Transformar a extensão em uma plataforma com agentes de IA especializados (social media, design, copywriting, análise e pesquisa), utilizando Gemini para pesquisa/leitura de página e ChatGPT para criação de copy/imagens.

**Análise Inicial da Extensão Existente:**
- `manifest.json`: Permissões e scripts essenciais (`activeTab`, `storage`, `scripting`).
- `content.js`: Extração de dados básicos de perfil do Instagram/Facebook.
- `popup.js`: Lógica de interface, comunicação com `content.js` e backend externo.
- `backend/main.py`: API FastAPI com endpoints para Gemini (`/api/gemini/generate_text`) e OpenAI (`/api/openai/generate_text`), e um endpoint `/generate-seo-copy`.

**Plano de Ação Inicial:**
1. Refatorar o Backend (`backend/main.py`) para novos endpoints de agentes.
2. Atualizar o Frontend (`popup.js`, `popup.html`) para interagir com os novos endpoints.
3. Melhorar a "leitura" da página (`content.js`) para extrair mais dados.

## 2. Implementação da Arquitetura de Agentes (15 de Julho de 2025)

**Backend (`backend/main.py`):**
- **Agente de Copywriting (ChatGPT):** Endpoint `/gerar-copy-social-media` (renomeado de `/generate-seo-copy`), utilizando `gpt-4o`.
- **Agente de Pesquisa (Gemini):** Novo endpoint `/pesquisar-hashtags` para gerar hashtags relevantes.
- **Agente de Design (DALL-E):** Novo endpoint `/gerar-imagem` para criar imagens com base em descrições.
- Novos modelos Pydantic (`GenerateCopyRequest`, `HashtagResearchRequest`, `GenerateImageRequest`) para cada agente.

**Frontend (`popup.js`, `popup.html`):**
- `popup.html`: Estrutura de abas para "Content", "Image", "Hashtags".
- `popup.js`: Conexão dos botões aos novos endpoints do backend.

## 3. Implementação do Modelo Freemium e Funcionalidades PRO (15 de Julho de 2025)

**Plano de Monetização:**
- **Plano Gratuito:** Limite de uso diário para agentes.
- **Plano Profissional (PRO):** Uso ilimitado e acesso a funcionalidades avançadas.

**Fase 1: Autenticação de Usuário**
- **Backend (`backend/main.py`):**
    - Adição de banco de dados SQLite (`monsterapp.db`).
    - Criação do modelo `User` (email, google_id, plan, stripe_customer_id).
    - Implementação de autenticação JWT (`SECRET_KEY`, `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES`).
    - Endpoint `/auth/google` para login (simulado, com placeholder para validação real).
    - Endpoint `/users/me` para obter dados do usuário logado.
- **Frontend (`popup.html`, `popup.js`, `background.js`):**
    - `popup.html`: Adição de tela de login com botão "Login com Google".
    - `popup.js`: Lógica para exibir tela de login/conteúdo principal, iniciar OAuth, enviar token para backend, salvar token JWT.
    - `background.js`: Ajustes na função `initiateOAuth` para focar no fluxo Google.

**Fase 2: Lógica de Planos e Pagamentos**
- **Backend (`backend/main.py`):**
    - Tabela `ApiUsage` para registrar o uso dos agentes.
    - Função `check_and_log_usage` para aplicar limites de uso para usuários "free" e registrar todas as chamadas.
    - Integração com Stripe: Adição de `stripe` ao `requirements.txt`, configuração de `STRIPE_SECRET_KEY`.
    - Endpoint `/create-checkout-session` para iniciar o checkout do Stripe.
- **Frontend (`popup.html`, `popup.js`):**
    - `popup.html`: Adição de botão "Upgrade to Pro".
    - `popup.js`: Lógica para chamar `/create-checkout-session` e redirecionar para o Stripe.

**Fase 3: Funcionalidades PRO**
- **Análise de Concorrentes (Agente Gemini):**
    - `popup.html`: Nova aba "Competitor Analysis" com campos de entrada.
    - `popup.js`: Lógica para coletar dados e chamar `/analyze-competitor-profile`.
    - `backend/main.py`: Modelo `CompetitorAnalysisRequest`, endpoint `/analyze-competitor-profile` com lógica Gemini e proteção PRO.
- **Sugestão de Tópicos de Conteúdo (Agente Gemini):**
    - `popup.html`: Botão "Suggest Topics" na aba "Content Generator".
    - `popup.js`: Lógica para coletar dados e chamar `/suggest-content-topics`.
    - `backend/main.py`: Modelo `SuggestTopicsRequest`, endpoint `/suggest-content-topics` com lógica Gemini e proteção PRO.
- **Geração de Variações de Copy (Agente ChatGPT):**
    - `popup.html`: Botão "Generate Variations" na aba "Content Generator".
    - `popup.js`: Lógica para coletar copy e chamar `/generate-copy-variations`.
    - `backend/main.py`: Modelo `GenerateCopyVariationsRequest`, endpoint `/generate-copy-variations` com lógica ChatGPT e proteção PRO.

## 4. Melhorias de UI/UX (15 de Julho de 2025)

- **Remoção da Seção "Developer":**
    - `popup.html`: Botão de navegação e conteúdo da aba "Developer Tools" removidos.
    - `popup.js`: Referências e event listeners relacionados removidos.
    - `background.js`: Referências a funcionalidades de "Developer Tools" removidas.
- **Diagramação e Contraste:**
    - `popup.css`: Paleta de cores revisada para melhor contraste (tema escuro), ajustes de `font-size`, `line-height`, `padding`, `margin` para melhor legibilidade e espaçamento.
    - `popup.html`: Remoção do texto "MonsterApp" do cabeçalho, mantendo apenas o logo.

## 5. Correções de Erros Recentes (15 de Julho de 2025)

- **`popup.js`:**
    - Corrigido `Uncaught SyntaxError: Identifier 'generatedVariationsOutput' has already been declared` (declaração duplicada de variáveis).
    - Corrigidos `ReferenceError: appState is not defined` e `ReferenceError: callApi is not defined` (problemas de escopo e ordem de declaração de variáveis/funções).
- **`backend/requirements.txt`:**
    - Atualizada a versão do `pysqlite3-binary` para `0.5.4` para resolver erro de deploy no Render.
    - Atualizada a versão do `passlib` para `1.7.4` (removendo `[bcrypt]`) para resolver erro de deploy no Render.

---

**Próximos Passos Sugeridos:**

- **Testes Completos:** Testar todas as funcionalidades da extensão (frontend e backend).
- **Configuração Real do Stripe:** Atualizar `PRICE_ID` no `popup.js` e configurar produtos/preços no painel do Stripe.
- **Webhooks do Stripe:** Implementar endpoint de webhook no backend para processar pagamentos e atualizar planos automaticamente.
- **Validação Real do Token Google:** Implementar a validação real do token do Google no `backend/main.py` (atualmente simulada).
