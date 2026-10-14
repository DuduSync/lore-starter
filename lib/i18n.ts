export type Lang = "en" | "pt";

export interface Strings {
  loading: string;
  setupIntroA: string;
  setupIntroB: string;
  apiKeyLabel: string;
  show: string;
  hide: string;
  systemLabel: string;
  start: string;
  connecting: string;
  noKey: string;
  invalidKey: string;
  noCredits: string;
  weeklyLimit: string;
  apiError: string;
  connectionFailed: string;
  creditsWord: string;
  creditsTitle: string;
  usedThisWeek: string;
  systemBtn: string;
  newChat: string;
  disconnect: string;
  emptyTitle: string;
  emptyHint: string;
  composerPlaceholder: string;
  send: string;
  stop: string;
  systemPlaceholder: string;
  langTitle: string;
}

const STRINGS: Record<Lang, Strings> = {
  en: {
    loading: "Loading...",
    setupIntroA: "A tiny open-source chat UI for ",
    setupIntroB: ". Paste your API key to start. It stays in this browser.",
    apiKeyLabel: "API key",
    show: "Show",
    hide: "Hide",
    systemLabel: "System prompt (optional)",
    start: "Start chatting",
    connecting: "Connecting...",
    noKey: "No key yet? Create one at",
    invalidKey: "Invalid API key. Double check it and try again.",
    noCredits: "Not enough credits. Top up your account at loreapi.online.",
    weeklyLimit:
      "Weekly credit limit reached. Your credits renew Sunday at 00:00 (BRT).",
    apiError: "LoreAPI error",
    connectionFailed: "Connection failed. Check your internet and try again.",
    creditsWord: "credits",
    creditsTitle: "Credits left on your LoreAPI account",
    usedThisWeek: "Used this week: ${v}",
    systemBtn: "System",
    newChat: "New chat",
    disconnect: "Disconnect",
    emptyTitle: "Start a story",
    emptyHint:
      'Try: "You wake up in a neon-lit alley of Neo São Paulo. What do you do?"',
    composerPlaceholder: "Write your message...",
    send: "Send",
    stop: "Stop",
    systemPlaceholder: "System prompt",
    langTitle: "Mudar para português (BR)",
  },
  pt: {
    loading: "Carregando...",
    setupIntroA: "Uma interface de chat open source para a ",
    setupIntroB:
      ". Cole sua chave de API para começar. Ela fica só no seu navegador.",
    apiKeyLabel: "Chave de API",
    show: "Mostrar",
    hide: "Ocultar",
    systemLabel: "Prompt de sistema (opcional)",
    start: "Começar a conversar",
    connecting: "Conectando...",
    noKey: "Ainda não tem chave? Crie uma em",
    invalidKey: "Chave de API inválida. Confira e tente de novo.",
    noCredits:
      "Sem créditos suficientes. Recarregue sua conta em loreapi.online.",
    weeklyLimit:
      "Limite semanal de créditos atingido. Os créditos renovam domingo às 00:00 (BRT).",
    apiError: "Erro na LoreAPI",
    connectionFailed:
      "Falha de conexão. Verifique sua internet e tente de novo.",
    creditsWord: "créditos",
    creditsTitle: "Créditos restantes na sua conta LoreAPI",
    usedThisWeek: "Usado esta semana: ${v}",
    systemBtn: "Sistema",
    newChat: "Novo chat",
    disconnect: "Desconectar",
    emptyTitle: "Comece uma história",
    emptyHint:
      'Tenta: "Você acorda num beco de neon em Neo São Paulo. O que você faz?"',
    composerPlaceholder: "Escreva sua mensagem...",
    send: "Enviar",
    stop: "Parar",
    systemPlaceholder: "Prompt de sistema",
    langTitle: "Switch to English",
  },
};

export function getStrings(lang: Lang): Strings {
  return STRINGS[lang];
}

export function detectLang(): Lang {
  if (typeof navigator !== "undefined") {
    const nav = (
      navigator.language ||
      (navigator.languages && navigator.languages[0]) ||
      ""
    ).toLowerCase();
    if (nav.startsWith("pt")) return "pt";
  }
  return "en";
}
