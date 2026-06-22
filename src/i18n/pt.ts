// Portuguese (pt-BR) strings. Kept flat and plain so the UI reads naturally.
// Functions are used where a value needs interpolation.

export const pt = {
  appName: 'Troca Figurinhas',

  nav: {
    scan: 'Escanear',
    collection: 'Coleção',
    repeats: 'Repetidas',
    trade: 'Trocar',
    settings: 'Ajustes',
  },

  onboarding: {
    skip: 'Pular',
    back: 'Voltar',

    // Tela 1 — boas-vindas + a demonstração do valor (uma leitura ao vivo, em loop).
    welcomeTitle: 'Guardo ou é repetida?',
    welcomeText:
      'Mostre o verso da figurinha pra câmera e o app responde na hora. Sem digitar, sem internet.',
    namePlaceholder: 'Seu nome ou apelido',
    start: 'Bora!',
    // Textos do mini-demo (o veredito que pisca em loop).
    demoBackLabel: 'Verso',
    demoNeeded: 'GUARDAR',
    demoOwned: 'REPETIDA',

    // Tela 2 — de quem são as figurinhas.
    whoseTitle: (name: string) =>
      name ? `Bora, ${name}! Vai escanear de quem?` : 'Vai escanear figurinhas de quem?',
    whoseMine: 'As minhas',
    whoseMineSub: 'Ver o que eu guardo e o que é repetida',
    whoseOther: 'De outra pessoa',
    whoseOtherSub: 'Ver o que serve pra mim no maço da pessoa',

    // Tela 3 — tem a lista do que procura? (só quando é de outra pessoa)
    listTitle: 'Você tem a lista do que procura?',
    listText: 'Tipo aquela do grupo do WhatsApp. Eu guardo ela na sua lista do que falta.',
    listYes: 'Tenho a lista',
    listYesSub: 'Colo aqui o que eu procuro',
    listNo: 'Não tenho',
    listNoSub: 'Escaneio e vejo o que serve depois',

    // Tela 4 — colar a lista (reusa o parser de importação).
    pasteTitle: 'Cola o que você procura',
    pasteText: 'Cole a lista do WhatsApp (ou de outro app). Eu reconheço os códigos.',
    pastePlaceholder: 'Ex: BRA 3, 6, 10\nMEX 12\nARG 4, 9, 14…',
    pasteLoad: 'Pronto, é isso',
    pasteRecognized: (n: number) =>
      n === 1 ? '1 figurinha reconhecida ✓' : `${n} figurinhas reconhecidas ✓`,
    pasteNone: 'Não reconheci nenhuma ainda — confere o texto.',
    pasteSkip: 'Escanear sem lista',
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
    reading: 'Lendo…',
    slotLabel: 'Cole aqui',
    recentCap: 'Últimas leituras',
    recentNew: 'Nova',
    recentRep: 'Repetida',
    neededSub: 'Você ainda não tem essa',
    // Radar ribbon: a just-scanned spare serves saved friend(s). Lists up to 3 names in full; 4+
    // shows the first two then "+N" so the pill stays short.
    radarServes: (names: string[]) => {
      const who =
        names.length === 1
          ? names[0]
          : names.length <= 3
            ? `${names.slice(0, -1).join(', ')} e ${names[names.length - 1]}`
            : `${names[0]}, ${names[1]} e +${names.length - 2}`;
      return `serve pro ${who}`;
    },
    missWord: 'Não li',
    missSub: 'Não consegui ler o código. Aproxime e segure firme.',
    manualOpen: 'Digitar o código',
    manualCancel: 'Cancelar',
    // The "this read is wrong" escape on a GUARDAR/REPETIDA card: undoes the scan and
    // opens manual entry to type the right code.
    wrong: 'Não é essa?',
    wrongLabel: 'Marcar leitura como errada e digitar o código certo',
    discarded: 'Leitura descartada',
  },

  // "Conferir figurinhas" — point the camera at the OTHER person's pile while trading.
  conferir: {
    pageTitle: 'Conferir',
    pageSubtitle: 'Figurinhas do amigo',
    back: 'Voltar',
    holdStill: 'Mostre a figurinha do amigo',
    // The verdict (the hero): grab it (PEGA) vs skip (DEIXA), sub-line says for-whom.
    takeWord: 'PEGA!',
    takeMineSub: 'Você precisa dessa!',
    takeFriendsSub: 'Você já tem, mas ele precisa',
    skipWord: 'JÁ TENHO',
    skipSub: 'Pode deixar — você já tem e ninguém precisa',
    // Running tally as you sweep the pile + the save-to-album action.
    counterMine: 'pra você',
    counterFriends: 'pros amigos',
    save: (n: number) => (n === 1 ? 'Salvar 1 na coleção' : `Salvar ${n} na coleção`),
    saved: (n: number) =>
      n === 1 ? '1 figurinha salva na coleção! ✓' : `${n} figurinhas salvas na coleção! ✓`,
    // Per-item review before saving — scanning ≠ trading, so confirm which you actually took.
    reviewTitle: 'Pegou quais?',
    reviewSub: 'Marque só as que você pegou de verdade na troca. As outras ficam de fora.',
    reviewSave: (n: number) =>
      n === 0
        ? 'Salvar na coleção'
        : n === 1
          ? 'Salvar 1 na coleção'
          : `Salvar ${n} na coleção`,
    reviewCancel: 'Agora não',
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
    // Mixed session: the commit always saves the checked keepers AND every repeat, so the CTA
    // has to name both — otherwise it reads as if only the news (or only the repetidas) are saved.
    addBoth: (keepers: number, repeats: number) =>
      `Salvar ${keepers} ${keepers === 1 ? 'nova' : 'novas'} + ${repeats} ${
        repeats === 1 ? 'repetida' : 'repetidas'
      }`,
    // Secondary action (mixed sessions only): saves the checked keepers but NOT the repetidas.
    // Same verb as the primary ("Salvar") so the only contrast is the scope ("só as novas"); the
    // primary above already names the new count, so this stays count-free.
    addOnlyNew: 'Salvar só as novas',
    // Spelled out under that button so the user doesn't silently lose trade currency — the count
    // here is the decision-relevant one (how many repetidas won't be kept to trade).
    skipRepeatsNote: (repeats: number) =>
      repeats === 1
        ? 'A repetida não vai ser guardada pra trocar.'
        : `As ${repeats} repetidas não vão ser guardadas pra trocar.`,
    back: 'Voltar a escanear',
    added: 'Adicionadas à coleção!',
    repeatsSaved: 'Repetidas guardadas pra trocar!',
  },

  // The viral share-back from "Conferir do amigo": a QR/link of the pile you just scanned, so your
  // friend opens it and the stickers land in THEIR álbum + repetidas. (Receiver copy is the import half.)
  pile: {
    shareCta: '📲 Mandar a pilha pro amigo',
    shareTitle: 'Manda o álbum pro seu amigo! 📲',
    shareLead: (n: number) =>
      n === 1
        ? 'Você leu 1 figurinha da pilha dele. Ele abre esse código e ela já entra no álbum dele — do jeito mais rápido de começar.'
        : `Você leu ${n} figurinhas da pilha dele. Ele abre esse código e elas já entram no álbum dele — do jeito mais rápido de começar.`,
    qrAria: 'Código QR com as figurinhas escaneadas',
    qrHint: 'Peça pro seu amigo abrir a câmera e apontar pra esse código.',
    shareWhats: 'Mandar no WhatsApp',
    shareCopied: 'Link copiado!',
    shareFail: 'Não rolou compartilhar. Mostre o QR pro seu amigo.',
    close: 'Fechar',
    // Receiver half: a friend scanned my pile and sent me the link.
    importTitle: (name?: string) =>
      name ? `${name} escaneou suas figurinhas! 🎉` : 'Um amigo escaneou suas figurinhas! 🎉',
    importLead: (n: number) =>
      n === 1
        ? '1 figurinha que ele viu na sua pilha pode entrar no seu álbum e nas suas repetidas pra trocar.'
        : `${n} figurinhas que ele viu na sua pilha podem entrar no seu álbum e nas suas repetidas pra trocar.`,
    importAdd: (n: number) =>
      n === 1 ? 'Adicionar 1 ao meu álbum' : `Adicionar ${n} ao meu álbum`,
    importSkip: 'Agora não',
    importDoneTitle: 'Prontinho! 🎉',
    importDoneLead: 'Já estão no seu álbum e nas suas repetidas pra trocar.',
    importDoneCta: 'Ver minha coleção',
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
    importCta: 'Colar lista',
  },

  // Importar a lista de outro app (cola um texto do WhatsApp / outro álbum → vira coleção ou lista).
  importList: {
    title: 'Importar a lista',
    close: 'Fechar',
    lead: 'Cole a lista de figurinhas de outro app e diga se você tem ou se precisa delas.',
    bucketLabel: 'O que é essa lista',
    bucketHave: 'Tenho',
    bucketNeed: 'Preciso',
    placeholder: 'Cole aqui (ex: BRA 3, 6, 10\nMEX 12\nARG 4, 9, 14…)',
    pasteClipboard: 'Colar da área de transferência',
    load: 'Carregar lista',
    previewTitle: 'Confere antes de salvar',
    recognized: 'reconhecidas',
    destHave: '→ vão pra Minha coleção',
    destNeed: '→ vão pra lista do que você precisa',
    alreadyHad: (n: number) =>
      n === 1 ? '1 você já tinha (não conta de novo).' : `${n} você já tinha (não contam de novo).`,
    skipped: (n: number) =>
      n === 1 ? '1 não foi reconhecida e foi pulada.' : `${n} não foram reconhecidas e foram puladas.`,
    add: (n: number) => (n === 1 ? 'Adicionar 1' : `Adicionar ${n}`),
    nothingNew: 'Nada de novo pra adicionar',
    previewNone: 'Não achei nenhuma figurinha nessa lista. Confere o texto e tenta de novo.',
    back: 'Voltar e revisar',
    doneTitle: 'Pronto!',
    doneHave: (n: number) =>
      n === 1 ? '1 figurinha foi pra sua coleção.' : `${n} figurinhas foram pra sua coleção.`,
    doneNeed: (n: number) =>
      n === 1
        ? '1 figurinha foi pra lista do que você precisa.'
        : `${n} figurinhas foram pra lista do que você precisa.`,
    seeCollection: 'Ver a coleção',
    doneClose: 'Beleza!',
    another: 'Colar outra lista',
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

    // Entry to the "Conferir figurinhas" scanner (point the camera at the friend's pile).
    conferirCta: 'Conferir figurinhas do amigo',
    conferirHint: 'Aponte pras figurinhas dele e veja na hora o que pega.',

    // Empty state — the user hasn't scanned any duplicates yet.
    emptyEmoji: '🔁',
    emptyTitle: 'Monte sua lista de troca',
    emptyText:
      'Escaneie suas figurinhas. As repetidas (que você já tem) entram aqui automaticamente pra você trocar com a galera.',
    emptyButton: 'Escanear repetidas',

    // Sender — "minhas repetidas (p/ trocar)"
    myRepeatsTitle: 'Minhas repetidas',
    myRepeatsEm: '(p/ trocar)',
    // Owner has an album but hasn't scanned any spares yet (distinct from the friend-match giveCta,
    // which implies a counterparty already on screen).
    repeatsPromptTitle: 'Tem figurinhas repetidas?',
    repeatsPromptText: 'Escaneie as repetidas que você já tem pra montar sua lista de troca.',
    // Link into the manual repeats editor (the RepeatsScreen).
    editRepeats: 'Editar',

    // Sender — "o que eu preciso"
    needTitle: 'O que eu',
    needEm: 'preciso',
    // Link into the Coleção screen, where ticking owned stickers shrinks this list.
    editNeed: 'Editar',
    needEmpty: 'Você já tem todas as figurinhas! 🎉',
    // Per-group count in the grouped ledger: "faltam N" (preciso) / "tenho N" (repetidas).
    groupFaltam: (n: number) => (n === 1 ? 'falta 1' : `faltam ${n}`),
    groupTenho: (n: number) => (n === 1 ? 'tenho 1' : `tenho ${n}`),

    // Preview + actions
    previewTag: 'Prévia da mensagem',
    shareWhats: 'Enviar no WhatsApp',
    copied: 'Lista copiada!',
    copyFail: 'Não consegui copiar. Use “Enviar no WhatsApp”.',

    // One-time "your name" capture at the share moment, so every link goes signed ("Trocar com o Léo").
    namePromptTitle: 'Como te chamam?',
    namePromptText: 'Pra galera saber quem mandou a lista. Dá pra mudar depois nos Ajustes.',
    namePlaceholder: 'Seu nome ou apelido',
    namePromptSave: 'Salvar e enviar',
    namePromptSkip: 'Mandar sem nome',

    // QR Code — for trading in person: show it and the other person opens your list with the camera.
    // qrCta/qrCtaHint label the collapsed "Mostrar QR Code" tile in the top action cluster;
    // qrTag/qrHint label the QR itself once the tile is expanded.
    qrCta: 'Mostrar QR Code',
    qrTag: 'Trocar ao vivo',
    qrHint:
      'Tá trocando pessoalmente? Mostre este QR Code pra pessoa apontar a câmera e abrir sua lista na hora.',
    qrAria: 'QR Code com o link da sua lista de troca',

    // Receiver — a friend opened your shared link. The screen is now TAPPABLE: tap the friend's
    // spares you want ("quero") and the friend's needs you have ("tenho"), see a live scoreboard,
    // and respond with the combined trade. Names are optional (a link may carry none) → default
    // "seu amigo"; the titles template the name so a named link personalizes ("O que o Léo tem…").
    friendFallback: 'seu amigo',
    friendTradeTitle: (name: string) => `Trocar com ${name}`,
    friendGuide: 'Marca o que serve pra você.',
    friendHasTitle: (name: string) => `O que ${name} tem repetida`,
    friendNeedsTitle: (name: string) => `O que falta pro ${name}`,
    // Tappable chip states + the legend (meaning never by colour alone: ✓ + label + shape).
    chipWant: 'quero',
    chipHave: 'tenho',
    legendTap: 'toque',
    wantAll: 'Quero todas dele',
    clearSel: 'Limpar tudo',
    // Live scoreboard (session state only). Receive-only until you have something to give.
    scoreReceiveOnly: (p: number, name: string) => `Você quer ${p} do ${name}`,
    scoreTrade: (total: number) => `Dá pra trocar ${total}!`,
    scorePega: (p: number, d: number) => `Você pega ${p} · você dá ${d}`,
    respond: 'Responder no WhatsApp',
    // Honest post-commit conversion (shown only after the selections are actually saved).
    albumStarted: 'Seu álbum começou',
    backToMine: 'Ver minha lista',
    // A link with nothing to compare (name-only, or an album-complete sharer).
    emptyLinkTitle: 'Esse link tá vazio',
    emptyLinkText: 'Escaneie seu álbum e monte o seu pra trocar com a galera.',
    emptyLinkButton: 'Escanear meu álbum',

    // Save a friend's list (to find trades for them later) + the "Listas de amigos" section.
    saveFriendCta: 'Salvar lista',
    saveFriendTitle: 'De quem é essa lista?',
    saveFriendText: (n: number) =>
      n === 1 ? 'Salva 1 figurinha que ela precisa.' : `Salva ${n} figurinhas que ela precisa.`,
    saveFriendPlaceholder: 'Nome do amigo',
    saveFriendSave: 'Salvar amigo',
    saveFriendCancel: 'Cancelar',
    saveCollisionTitle: (name: string) => `Já tem um ${name}`,
    saveCollisionText: 'Quer atualizar a lista dele ou salvar como outra pessoa?',
    saveCollisionUpdate: (name: string) => `Atualizar a lista do ${name}`,
    saveCollisionNew: 'Salvar como outra pessoa',
    // After "Atualizar": celebrate the diff (what the friend found since the last list).
    updatedFoundTitle: (name: string, n: number) =>
      `${name} achou ${n === 1 ? '1 figurinha' : `${n} figurinhas`}! 🎉`,
    updatedTitle: (name: string) => `Lista do ${name} atualizada 🔄`,
    updatedText: (stillNeeds: number, giveCount: number) => {
      const base =
        stillNeeds === 0 ? 'Agora ele já tem tudo!' : `Ainda precisa de ${stillNeeds}.`;
      const give =
        giveCount > 0
          ? ` Você tem ${giveCount === 1 ? '1 repetida' : `${giveCount} repetidas`} pra dar pra ele!`
          : '';
      return base + give;
    },
    updatedSeeGive: 'Ver o que dar',
    updatedClose: 'Agora não',
    updatedOk: 'Beleza!',
    friendSaved: (name: string) => `Lista do ${name} salva! 👥`,
    friendsTitle: '👥 Listas de amigos',
    friendNeeds: (n: number) => (n === 1 ? 'precisa de 1' : `precisa de ${n}`),
    friendCanGive: (n: number) => (n === 1 ? 'você tem 1 pra dar' : `você tem ${n} pra dar`),
    friendGiveLabel: 'pra dar',
    // A saved friend whose whole list you've already given (needs → 0): a done state, never "precisa de 0".
    friendAllTraded: 'já tem tudo! ✅',

    // A saved friend's detail: what you can give them + "dei pro João" (trade-close).
    detailBack: 'Voltar',
    detailTitle: (name: string) => `O que você tem pro ${name}`,
    detailGiveTitle: (name: string) => `Você pode dar pro ${name} 🎁`,
    detailGiveGuide: 'Já deu? Toque pra tirar o que você não vai dar e confirme embaixo.',
    detailNothing: (name: string) => `Nenhuma das suas repetidas serve pro ${name} agora.`,
    detailScanCta: 'Escanear mais repetidas',
    detailStillNeeds: (name: string) => `O ${name} ainda precisa 📍`,
    detailGaveBtn: (n: number) => (n === 1 ? 'Dei essa!' : `Dei essas ${n}!`),
    detailDone: (name: string) => `Você já tem tudo que o ${name} precisava! 🎉`,
    gaveToFriend: (name: string, n: number) =>
      `Você deu ${n === 1 ? '1 figurinha' : `${n} figurinhas`} pro ${name}! 🤝`,

    // Arquivar: tuck a finished/inactive friend away (the list stays clean) — reversível.
    detailArchive: 'Arquivar',
    detailArchiveDone: (name: string) => `Arquivar o ${name}`,
    detailArchiveHint: 'Some da lista, mas dá pra trazer de volta quando quiser.',
    friendArchived: (name: string) => `${name} foi arquivado.`,
    friendUnarchived: (name: string) => `${name} voltou pra lista!`,
    archivedToggle: (n: number) => (n === 1 ? '1 arquivado' : `${n} arquivados`),
    unarchive: 'Trazer de volta',
    // Calm, neutral stat for a parked friend — not the active list's actionable "precisa de N".
    friendArchivedStat: (n: number) =>
      n === 0 ? 'lista completa' : `${n} ${n === 1 ? 'figurinha' : 'figurinhas'} na lista`,

    // Grouping (mirrors the album)
    albumGroup: (g: string) => `Grupo ${g}`,
    count: (n: number) => String(n),
  },

  install: {
    // iOS-only instructions sheet (Android installs via the native OS dialog, no sheet).
    title: 'Instale o app',
    bodyIos: 'No iPhone dá pra adicionar à tela inicial em 2 passos:',
    iosStep1: 'Toque em Compartilhar na barra do Safari',
    iosStep2: 'Escolha "Adicionar à Tela de Início"',
    gotIt: 'Entendi',
    close: 'Fechar',
    // Ajustes row (the only entry point — installing is opt-in, never auto-prompted)
    settingsRow: 'Instalar o app',
    settingsHint: 'Abra direto da tela inicial, como um aplicativo.',
    installed: 'App instalado',
    installedHint: 'Você já adicionou à tela inicial. 🎉',
  },

  settings: {
    title: 'Ajustes',
    nameLabel: 'Seu nome',
    namePlaceholder: 'Seu nome ou apelido',
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
    credit: 'Feito com 💚 por ',
    creditAuthor: 'Vitor Baptista',
    creditUrl: 'https://vitorbaptista.com',
  },
} as const;
