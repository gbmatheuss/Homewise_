# HomeWise — Portal Web Institucional & Checkout

> **Portal web oficial do ecossistema HomeWise — Sistema Inteligente de Monitoramento e Gestão de Consumo Residencial de Água e Energia (TCC).**

O portal apresenta o ecossistema HomeWise ao público, detalhando a proposta de valor, a instalação dos sensores IoT (YF-S201 e PZEM-004T), os planos de assinatura disponíveis, o fluxo comercial de aquisição (com autenticação e checkout simulado via PIX/Cartão integrados ao Firebase) e a equipe por trás do projeto.

---

## 📁 Estrutura de Arquivos e Organização

```
Homewise_/
├── css/
│   ├── auth.css              # Estilos do fluxo de login e criação de conta
│   └── style.css             # Folha de estilos global, temas escuro/claro e componentes
├── js/
│   ├── auth.js               # Autenticação Firebase (login, registro e recuperação)
│   ├── carrinho.js           # Checkout, validação de CPF/CEP, PIX simulado e Firestore
│   ├── firebase.js           # Inicialização do Firebase (homewise-65bb1), Auth e Firestore
│   └── script.js             # Menu mobile, tema dark/light, modais, FAQ e ciclo de planos
├── img/                      # Imagens do sistema, fotos da equipe e telas do app
├── hotsite/                  # Hotsite especial dedicado à equipe e bastidores
│   ├── hotindex.html         # Apresentação dos integrantes e história do projeto
│   ├── script.js             # Interações específicas do hotsite
│   └── style.css             # Estilos dedicados do hotsite (herda css/style.css)
├── index.html                # Página inicial (vitrine do aplicativo e destaques)
├── como-funciona.html        # Guia passo a passo da instalação e funcionamento
├── precos.html               # Planos (Básico, Plus, Premium) com ciclos mensal e anual (-15%)
├── carrinho.html             # Finalização de assinatura com PIX e Cartão
├── login.html                # Autenticação pré-checkout ou acesso do assinante
├── depoimentos.html          # Depoimentos e feedback de usuários reais
├── sobre.html                # Apresentação institucional da HomeWise
├── faq.html                  # Perguntas frequentes e canal de suporte via WhatsApp
├── inicio.html               # Redirecionamento canônico para index.html
├── .gitignore                # Arquivos e pastas ignorados no controle de versão
└── README.md                 # Documentação e guia do repositório
```

---

## 🚀 Páginas e Recursos

| Página | Arquivo | Descrição |
|---|---|---|
| **Início** | [`index.html`](index.html) | Hero com vitrine realista em molduras de smartphone com capturas do app, benefícios e CTA. |
| **Como Funciona** | [`como-funciona.html`](como-funciona.html) | As 4 etapas do sistema: instalação da central, conexão com o app, acompanhamento e economia. |
| **Preços** | [`precos.html`](precos.html) | Tabela comparativa dos planos **Básico** (R$ 19,90), **Plus** (R$ 29,90) e **Premium** (R$ 49,90), com seletor Mensal/Anual (-15%). |
| **Sua Conta** | [`login.html`](login.html) | Criação de conta e login com Firebase Auth para vincular a assinatura ao usuário. |
| **Carrinho** | [`carrinho.html`](carrinho.html) | Formulário de dados com preenchimento automático via CEP (ViaCEP) e simulação de PIX (QR Code e Copia e Cola) ou Cartão. |
| **Depoimentos** | [`depoimentos.html`](depoimentos.html) | Avaliações com fotos e relatos de economia doméstica. |
| **Sobre Nós** | [`sobre.html`](sobre.html) | Missão, visão, valores e links diretos para o hotsite da equipe. |
| **FAQ** | [`faq.html`](faq.html) | Respostas sanadas sobre instalação técnica, compatibilidade de sensores e botão de suporte direto no WhatsApp. |
| **Hotsite da Equipe** | [`hotsite/hotindex.html`](hotsite/hotindex.html) | Jornada acadêmica dos desenvolvedores e fundadores do HomeWise. |

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 Semântico**: Estrutura acessível com tags semânticas e conformidade W3C.
- **CSS3 Moderno**: Variáveis CSS (Custom Properties), suporte nativo a temas **Dark/Light**, Grid e Flexbox responsivos, animações sutis e microinterações.
- **JavaScript Moderno (ES6+)**: Módulos nativos (`import`/`export`), APIs assíncronas (`async`/`await`), integração com ViaCEP e manipulação limpa do DOM.
- **Firebase Platform (`homewise-65bb1`)**:
  - **Firebase Authentication**: Gerenciamento seguro de contas e persistência de sessão.
  - **Cloud Firestore**: Sincronização do status da assinatura com o aplicativo mobile (`usuarios/{uid}`).
- **Font Awesome 6**: Ícones vetoriais modernos.

---

## 💻 Como Executar Localmente

Como o projeto é construído com tecnologias web nativas e módulos ES (`type="module"`), recomenda-se rodar sob um servidor HTTP local para evitar restrições de CORS do protocolo `file://`:

### Opção 1: VS Code (Live Server) — Recomendado
1. Abra a pasta `Homewise_` no **Visual Studio Code**.
2. Instale a extensão **Live Server** (caso ainda não tenha).
3. Clique com o botão direito sobre [`index.html`](index.html) e selecione **"Open with Live Server"**.

### Opção 2: Python HTTP Server
```bash
python -m http.server 8000
```
Acesse `http://localhost:8000` no seu navegador.

### Opção 3: Node.js (npx serve)
```bash
npx serve .
```

---

## 🔒 Ambiente Acadêmico

Os pagamentos e planos exibidos neste portal constituem uma **demonstração acadêmica e comercial para o Trabalho de Conclusão de Curso (TCC)**. Não há transações financeiras reais nem cobranças em contas bancárias.

