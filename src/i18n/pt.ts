// Portuguese (pt-BR) strings. Kept flat and plain so the UI reads naturally.
// Functions are used where a value needs interpolation.

export const pt = {
  appName: 'Troca Figurinhas',

  nav: {
    scan: 'Escanear',
    collection: 'Coleção',
    trade: 'Trocar',
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
        text: 'Deixe o celular na mesa, de tela pra cima, e mostre o VERSO da figurinha pra câmera da frente — onde fica o codiguinho (ex: CIV 12). Dá pra trocar pra câmera de trás no botão.',
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
    cameraDenied: 'Não consegui acessar a câmera.',
    cameraDeniedHint: 'Toque em permitir a câmera nas configurações do navegador e tente de novo.',
    retry: 'Tentar de novo',
    startHint: 'Mostre o verso da figurinha',
    flipCamera: 'Virar câmera',
    cameraFront: 'Câmera frontal',
    cameraBack: 'Câmera traseira',
    pageTitle: 'Escanear',
    pageSubtitle: 'Verso da figurinha',
    holdStill: 'Mostre o verso e segure parado',
    slotLabel: 'Cole aqui',
    recentCap: 'Últimas leituras',
    recentNew: 'Nova',
    recentRep: 'Repetida',
    neededSub: 'Você ainda não tem essa',
    missWord: 'Não li',
    missSub: 'Não consegui ler o código. Aproxime e segure firme.',
    manualOpen: 'Digitar o código',
    manualCancel: 'Cancelar',
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
    // Repeats-only session (nothing new to keep): the CTA still has to commit the spares.
    saveRepeats: (n: number) =>
      n === 1 ? 'Guardar 1 repetida pra trocar' : `Guardar ${n} repetidas pra trocar`,
    back: 'Voltar a escanear',
    added: 'Adicionadas à coleção!',
    repeatsSaved: 'Repetidas guardadas pra trocar!',
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

  // The manual "Repetidas" editor — mirrors Coleção but toggles your tradeable spares.
  repeatsScreen: {
    title: 'Minhas repetidas',
    back: 'Voltar pra Trocar',
    hint: 'Toque numa figurinha pra marcar (ou tirar) uma repetida pra trocar.',
    count: (n: number) => (n === 1 ? '1 repetida' : `${n} repetidas`),
    searchPlaceholder: 'Buscar time ou código',
    // Per-team: how many repeats marked (blank when none, to keep the row calm).
    teamCount: (n: number) => (n === 0 ? '' : String(n)),
    onLabel: 'tem repetida',
    offLabel: 'sem repetida',
    noResults: 'Nenhum time encontrado.',
  },

  trade: {
    title: 'Trocar',
    repeatsBadge: (n: number) => (n === 1 ? '1 repetida' : `${n} repetidas`),

    // Empty state — the user hasn't scanned any duplicates yet.
    emptyEmoji: '🔁',
    emptyTitle: 'Monte sua lista de troca',
    emptyText:
      'Escaneie suas figurinhas. As repetidas (que você já tem) entram aqui automaticamente pra você trocar com a galera.',
    emptyButton: 'Escanear repetidas',

    // Sender — "minhas repetidas (p/ trocar)"
    myRepeatsTitle: 'Minhas repetidas',
    myRepeatsEm: '(p/ trocar)',
    removeRepeat: 'Já troquei',
    removeRepeatLabel: (display: string) => `Tirar ${display} da lista de troca`,
    // Owner has an album but hasn't scanned any spares yet (distinct from the friend-match giveCta,
    // which implies a counterparty already on screen).
    repeatsPromptTitle: 'Tem figurinhas repetidas?',
    repeatsPromptText: 'Escaneie as repetidas que você já tem pra montar sua lista de troca.',
    // Link into the manual repeats editor (the RepeatsScreen).
    editRepeats: 'Editar',

    // Sender — "o que eu preciso"
    needTitle: 'O que eu',
    needEm: 'preciso',
    faltaTag: 'Falta',
    needEmpty: 'Você já tem todas as figurinhas! 🎉',
    // Collapsed group row: "faltam N" (N = missing stickers in the group, up to 80).
    groupFaltam: (n: number) => (n === 1 ? 'falta 1' : `faltam ${n}`),

    // Preview + actions
    previewTag: 'Prévia da mensagem',
    shareWhats: 'Enviar no WhatsApp',
    copy: 'Copiar lista',
    copied: 'Lista copiada!',
    copyFail: 'Não consegui copiar. Use “Enviar no WhatsApp”.',

    // Receiver — a friend opened your shared link
    friendFallback: 'seu amigo',
    receiverHero: (friend: string) => `Trocas com ${friend}`,
    receiverWin: (n: number) =>
      n === 0
        ? 'Nada que sirva pra você agora.'
        : n === 1
          ? '1 figurinha serve pra você!'
          : `${n} figurinhas servem pra você!`,
    iCanGetTitle: 'Você pega',
    iCanGiveTitle: 'Você dá',
    iCanGetEmpty: 'Nada dessa lista que você precise.',
    iCanGiveEmpty: 'Você não tem repetidas que ele(a) precisa.',
    giveCtaTitle: 'Tem repetidas?',
    giveCtaText: 'Escaneie as suas pra ver o que você pode dar em troca.',
    giveCtaButton: 'Escanear repetidas',
    shareBack: 'Compartilhar minha lista',
    backToMine: 'Ver minha lista',

    // Grouping (mirrors the album)
    albumGroup: (g: string) => `Grupo ${g}`,
    count: (n: number) => String(n),
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
