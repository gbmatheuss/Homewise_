# HomeWise — Portal Web Institucional & Checkout

> **Portal web oficial do ecossistema HomeWise — Sistema Inteligente de Monitoramento e Gestão de Consumo Residencial de Água e Energia (TCC).**

O portal apresenta o ecossistema HomeWise ao público, detalhando a proposta de valor, a instalação dos sensores IoT (YF-S201 e PZEM-004T), os planos de assinatura propostos, um fluxo de aquisição demonstrativo (autenticação Firebase e checkout via PIX/Cartão que apenas simula o pagamento, sem cobrança e sem ativar ou cancelar assinaturas) e a equipe por trás do projeto.

O **aplicativo HomeWise** (mobile) é um projeto separado; este repositório contém apenas o site institucional e o hotsite.

---

## 📁 Estrutura de Arquivos e Organização

```
Homewise_/
├── css/
│   ├── auth.css              # Estilos do fluxo de login e criação de conta
│   ├── motion.css            # Abertura, cabeçalho compacto, parallax e entradas da página inicial
│   └── style.css             # Folha de estilos global, temas escuro/claro e componentes
├── js/
│   ├── auth.js               # Autenticação Firebase (login, registro e recuperação)
│   ├── carrinho.js           # Checkout demonstrativo: dados fictícios, PIX/cartão simulados, leitura do status da assinatura
│   ├── firebase.js           # Inicialização do Firebase (homewise-65bb1), Auth e Firestore
│   ├── motion-boot.js        # Tema, modo de animação (segue o movimento reduzido do sistema) e abertura a cada carregamento
│   ├── motion.js             # Abertura reversível pela rolagem e animações de todas as páginas e do hotsite
│   └── script.js             # Menu mobile, tema dark/light, modais, FAQ e ciclo de planos
├── img/                      # Imagens do sistema, fotos da equipe e telas do app
├── hotsite/                  # Hotsite especial dedicado à equipe e bastidores
│   ├── hotindex.html         # Apresentação dos integrantes e história do projeto
│   └── style.css             # Estilos dedicados do hotsite (herda css/style.css)
├── index.html                # Página inicial (vitrine do aplicativo e destaques)
├── como-funciona.html        # Guia passo a passo da instalação e funcionamento
├── precos.html               # Planos (Básico, Plus, Premium) com ciclos mensal e anual (-15%)
├── carrinho.html             # Checkout demonstrativo (simulação de PIX e Cartão, sem cobrança)
├── login.html                # Autenticação pré-checkout
├── depoimentos.html          # Depoimentos ilustrativos (não são avaliações de clientes)
├── sobre.html                # Apresentação institucional da HomeWise
├── faq.html                  # Perguntas frequentes
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
| **Sua Conta** | [`login.html`](login.html) | Criação de conta e login com Firebase Authentication antes do checkout demonstrativo. |
| **Carrinho** | [`carrinho.html`](carrinho.html) | Checkout demonstrativo: dados pessoais e endereço fictícios e fixos, simulação de PIX (QR Code e Copia e Cola ilustrativos) ou de cartão de teste, e exibição da situação atual da assinatura (somente leitura). Não há cobrança nem consultas externas de CEP. |
| **Depoimentos** | [`depoimentos.html`](depoimentos.html) | Depoimentos **ilustrativos**, elaborados para demonstrar a proposta do projeto; não são avaliações de clientes. |
| **Sobre Nós** | [`sobre.html`](sobre.html) | Apresentação da proposta, da equipe e link para o hotsite. |
| **FAQ** | [`faq.html`](faq.html) | Perguntas sobre instalação, sensores compatíveis, dados e planos demonstrativos. |
| **Hotsite da Equipe** | [`hotsite/hotindex.html`](hotsite/hotindex.html) | Jornada acadêmica dos desenvolvedores e fundadores do HomeWise. |

---

## 🛠️ Tecnologias Utilizadas

- **HTML5 Semântico**: Estrutura com tags semânticas e atributos de acessibilidade (ARIA).
- **CSS3 Moderno**: Variáveis CSS (Custom Properties), suporte nativo a temas **Dark/Light**, Grid e Flexbox responsivos, animações e microinterações (com versão reduzida quando o sistema pede menos movimento).
- **JavaScript Moderno (ES6+)**: Módulos nativos (`import`/`export`), APIs assíncronas (`async`/`await`) e manipulação do DOM.
- **Firebase Platform (`homewise-65bb1`)**:
  - **Firebase Authentication**: Criação de contas, login, recuperação de senha e persistência de sessão.
  - **Cloud Firestore**: leitura do perfil e do status da assinatura compartilhados com o aplicativo mobile (`usuarios/{uid}`). O site não grava plano nem status da assinatura: ativar ou cancelar exige confirmação de pagamento em um backend, que este projeto ainda não possui.
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

**Estado atual (o que ainda não está implementado):**

- **Checkout demonstrativo:** a simulação não ativa, não altera e não cancela assinaturas, e não grava dados no Firestore. Os dados pessoais e o endereço do formulário são fictícios e fixos; o cartão de teste é validado apenas no navegador e apagado ao concluir.
- **Contratação real de planos:** depende de uma integração de pagamento com confirmação em um backend (por exemplo, Cloud Functions e um gateway), que ainda não existe.
- **Regras de segurança do Firebase:** ainda **não foram auditadas**. Antes de um uso real, elas precisam impedir que o próprio cliente grave campos de assinatura (`plano`, `status_assinatura`) em `usuarios/{uid}`.
- **Depoimentos:** são ilustrativos.
- **Download do TCC e do aplicativo:** ainda não disponíveis nas páginas.

