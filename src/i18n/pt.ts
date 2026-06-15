// Portuguese (pt-BR) strings. Kept flat and plain so the UI reads naturally.
// Functions are used where a value needs interpolation.

export const pt = {
  appName: 'Troca Figurinhas',

  nav: {
    scan: 'Escanear',
    collection: 'Coleção',
    settings: 'Ajustes',
  },

  onboarding: {
    slides: [
      {
        emoji: '📸',
        title: 'Escaneie e descubra',
        text: 'Mostre cada figurinha pra câmera e o app diz na hora se você precisa ou se é repetida.',
      },
      {
        emoji: '🔃',
        title: 'Mostre o verso',
        text: 'Deixe o celular num apoio, com a câmera virada para a mesa. Passe o VERSO da figurinha, onde fica o codiguinho (ex: CIV 12).',
      },
      {
        emoji: '🟢',
        title: 'Verde guarda, vermelho não',
        text: 'Verde = você precisa, GUARDAR! Vermelho = você já tem, é repetida.',
      },
    ],
    next: 'Próximo',
    start: 'Começar',
    skip: 'Pular',
  },

  scan: {
    preparing: (pct: number) => `Preparando o leitor… ${pct}%`,
    analyzing: 'Lendo a figurinha…',
    ocrUnavailable: 'Não consegui baixar o leitor. Conecte à internet uma vez, ou toque em "Digitar código".',
    finish: 'Terminar',
    needed: 'GUARDAR',
    owned: 'REPETIDA',
    neededHint: 'Você precisa!',
    ownedHint: 'Você já tem',
    tryAgain: 'Tente de novo',
    keep: 'guardar',
    have: 'já tem',
    multiTitle: (n: number) => (n === 1 ? 'figurinha encontrada' : 'figurinhas encontradas'),
    multiNeeded: (n: number) => (n === 1 ? '1 pra guardar' : `${n} pra guardar`),
    multiNoneNeeded: 'todas repetidas',
    counters: { new: 'novas', repeated: 'repetidas' },
    recent: 'Últimas',
    manualEntry: 'Digitar código',
    manualPlaceholder: 'Ex: CIV 12',
    manualConfirm: 'Verificar',
    sendPhoto: 'Enviar foto',
    cameraDenied: 'Não consegui acessar a câmera.',
    cameraDeniedHint: 'Toque em permitir a câmera nas configurações do navegador e tente de novo.',
    retry: 'Tentar de novo',
    startHint: 'Aponte para o verso da figurinha',
  },

  report: {
    title: 'Resumo do escaneamento',
    scanned: 'escaneadas',
    toKeep: 'pra guardar',
    keepersSection: 'Pra guardar (você precisa)',
    keepersEmpty: 'Nenhuma figurinha nova nesse escaneamento.',
    repeatsSection: (n: number) => `Repetidas (você já tem) · ${n}`,
    unknownsNote: (n: number) =>
      n === 1 ? '1 figurinha não foi reconhecida.' : `${n} figurinhas não foram reconhecidas.`,
    toggleAll: 'Marcar todas',
    toggleNone: 'Desmarcar todas',
    add: (n: number) =>
      n === 1 ? 'Adicionar 1 à coleção' : `Adicionar ${n} à coleção`,
    addEmpty: 'Adicionar à coleção',
    back: 'Voltar a escanear',
    added: 'Adicionadas à coleção!',
  },

  collection: {
    title: 'Minha coleção',
    progress: (owned: number, total: number) => `${owned} / ${total}`,
    complete: 'Coleção completa! 🎉',
    searchPlaceholder: 'Buscar time ou código',
    teamProgress: (owned: number, total: number) => `${owned}/${total}`,
    noResults: 'Nenhum time encontrado.',
    inCollection: 'na coleção',
    missing: 'falta',
  },

  settings: {
    title: 'Ajustes',
    data: 'Meus dados',
    export: 'Exportar coleção',
    exportHint: 'Baixa um arquivo de backup com a sua coleção.',
    import: 'Importar coleção',
    importHint: 'Carrega um arquivo de backup salvo antes.',
    importInvalid: 'Esse arquivo não é um backup válido do Troca Figurinhas.',
    importDone: 'Coleção importada com sucesso!',
    sound: 'Som ao escanear',
    tutorial: 'Ver tutorial de novo',
    danger: 'Zona de perigo',
    clear: 'Apagar tudo',
    clearHint: 'Remove toda a sua coleção. Não dá pra desfazer.',
    clearConfirm: 'Apagar TODA a coleção? Isso não pode ser desfeito.',
    clearDone: 'Coleção apagada.',
    version: (v: string) => `Versão ${v}`,
    credit: 'Feito com 💚 para a galera trocadora.',
  },
} as const;
