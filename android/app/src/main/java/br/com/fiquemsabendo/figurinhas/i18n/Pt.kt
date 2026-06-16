package br.com.fiquemsabendo.figurinhas.i18n

// Portuguese (pt-BR) strings — ports src/i18n/pt.ts VERBATIM. Kept as nested objects with
// functions for the interpolated values, mirroring the PWA. Every user-facing string in the app
// MUST come from here (the README/CHANGELOG/this file aside, code itself is not user-facing).

object Pt {
    const val appName = "Troca Figurinhas"

    object Nav {
        const val scan = "Escanear"
        const val collection = "Coleção"
        const val settings = "Ajustes"
    }

    object Onboarding {
        /** One intro slide: emoji + title + body text. */
        data class Slide(val emoji: String, val title: String, val text: String)

        val slides: List<Slide> = listOf(
            Slide(
                emoji = "📸",
                title = "Escaneie e descubra",
                text = "Mostre cada figurinha pra câmera e o app diz na hora se você precisa ou se é repetida.",
            ),
            Slide(
                emoji = "🔃",
                title = "Mostre o verso",
                text = "Deixe o celular na mesa, de tela pra cima, e mostre o VERSO da figurinha pra câmera da frente — onde fica o codiguinho (ex: CIV 12). Dá pra trocar pra câmera de trás no botão.",
            ),
            Slide(
                emoji = "🟢",
                title = "Verde guarda, vermelho não",
                text = "Verde = você precisa, GUARDAR! Vermelho = você já tem, é repetida.",
            ),
        )

        const val next = "Próximo"
        const val start = "Começar"
        const val skip = "Pular"
    }

    object Scan {
        fun preparing(pct: Int) = "Preparando o leitor… $pct%"
        const val ocrUnavailable = "Não consegui baixar o leitor. Conecte à internet uma vez, ou toque em \"Digitar código\"."
        const val finish = "Terminar"
        const val needed = "GUARDAR"
        const val owned = "REPETIDA"
        const val neededHint = "Você precisa!"
        const val ownedHint = "Você já tem"
        const val tryAgain = "Tente de novo"
        const val keep = "guardar"
        const val have = "já tem"
        fun multiTitle(n: Int) = if (n == 1) "figurinha encontrada" else "figurinhas encontradas"
        fun multiNeeded(n: Int) = if (n == 1) "1 pra guardar" else "$n pra guardar"
        const val multiNoneNeeded = "todas repetidas"

        object Counters {
            const val new = "novas"
            const val repeated = "repetidas"
        }

        const val recent = "Últimas"
        const val manualEntry = "Digitar código"
        const val manualPlaceholder = "Ex: CIV 12"
        const val manualConfirm = "Verificar"
        const val cameraDenied = "Não consegui acessar a câmera."
        const val cameraDeniedHint = "Toque em permitir a câmera nas configurações do app e tente de novo."
        const val retry = "Tentar de novo"
        const val startHint = "Aproxime o código da caixa"
        const val flipCamera = "Virar câmera"
        const val cameraFront = "Câmera frontal"
        const val cameraBack = "Câmera traseira"
    }

    object Report {
        const val title = "Resumo do escaneamento"
        const val scanned = "escaneadas"
        const val toKeep = "pra guardar"
        const val keepersSection = "Pra guardar (você precisa)"
        const val keepersEmpty = "Nenhuma figurinha nova nesse escaneamento."
        fun repeatsSection(n: Int) = "Repetidas (você já tem) · $n"
        fun unknownsNote(n: Int) =
            if (n == 1) "1 figurinha não foi reconhecida." else "$n figurinhas não foram reconhecidas."
        const val toggleAll = "Marcar todas"
        const val toggleNone = "Desmarcar todas"
        fun add(n: Int) =
            if (n == 1) "Adicionar 1 à coleção" else "Adicionar $n à coleção"
        const val addEmpty = "Adicionar à coleção"
        const val back = "Voltar a escanear"
        const val added = "Adicionadas à coleção!"
    }

    object Collection {
        const val title = "Minha coleção"
        fun progress(owned: Int, total: Int) = "$owned / $total"
        const val complete = "Coleção completa! 🎉"
        const val searchPlaceholder = "Buscar time ou código"
        fun teamProgress(owned: Int, total: Int) = "$owned/$total"
        const val noResults = "Nenhum time encontrado."
        const val inCollection = "na coleção"
        const val missing = "falta"
        /** "Grupo X" header before the first team of each World Cup group (mirrors `Grupo {group}`). */
        fun group(group: String) = "Grupo $group"
    }

    object Settings {
        const val title = "Ajustes"
        const val data = "Meus dados"
        const val export = "Exportar coleção"
        const val exportHint = "Baixa um arquivo de backup com a sua coleção."
        const val import = "Importar coleção"
        const val importHint = "Carrega um arquivo de backup salvo antes."
        const val importInvalid = "Esse arquivo não é um backup válido do Troca Figurinhas."
        const val importDone = "Coleção importada com sucesso!"
        const val sound = "Som ao escanear"
        const val debug = "Modo debug"
        const val debugHint = "Mostra o que o leitor está enxergando (códigos, fps, frames)."
        const val tutorial = "Ver tutorial de novo"
        const val danger = "Zona de perigo"
        const val clear = "Apagar tudo"
        const val clearHint = "Remove toda a sua coleção. Não dá pra desfazer."
        const val clearConfirm = "Apagar TODA a coleção? Isso não pode ser desfeito."
        const val clearDone = "Coleção apagada."
        const val cancel = "Cancelar"
        fun version(v: String) = "Versão $v"
        const val credit = "Feito com 💚 para a galera trocadora."
    }
}
