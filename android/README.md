# Troca Figurinhas — app nativo Android

Reescrita nativa (Kotlin + Jetpack Compose + CameraX) do PWA de leitura de figurinhas da Copa
2026. Mesmo produto e mesma lógica do PWA — a mesma estratégia de OCR, a mesma regra de **0 falsos
positivos** e o mesmo álbum de 980 figurinhas — mas com controle real da câmera e processamento
nativo. Veja o projeto/decisões em `../docs/superpowers/specs/2026-06-16-native-android-rewrite-design.md`.

## Por que nativo (resumo honesto)

O PWA já lia ~85 ms/passe; o gargalo real documentado era a **nitidez da captura**, não a latência
do OCR. O ganho do nativo vem de: **controle de foco/exposição** (CameraX + Camera2Interop →
figurinhas mais nítidas, o gargalo de verdade), o **plano Y (luma) do YUV é direto o cinza** que o
pipeline já usa (zero leitura RGBA por frame que o PWA pagava no canvas), e **computação nativa**
(kernels Kotlin em arrays primitivos, sem custo de wasm/JS).

## Como compilar e instalar

Requer o Android SDK (platform 35, build-tools 35) e **JDK 21** (a AGP não aceita o JDK 26 do
sistema — já fixado em `gradle.properties` via `org.gradle.java.home`). Ajuste o caminho do JDK e o
`sdk.dir` em `local.properties` se a sua máquina for diferente.

```bash
export JAVA_HOME=~/.local/share/mise/installs/java/21
./gradlew :app:assembleDebug        # gera app/build/outputs/apk/debug/app-debug.apk
./gradlew :app:testDebugUnitTest    # 146 testes de unidade (a lógica 0-FP, recognizer, etc.)

# Instalar no Pixel (ligue o aparelho via adb antes):
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

Toolchain fixado: Gradle 8.12, AGP 8.9.1, Kotlin 2.0.21, Compose BOM 2024.09, CameraX 1.5.0,
datastore-preferences 1.1.7, kotlinx-serialization 1.7.3, minSdk 24 / targetSdk 35, ABI arm64-v8a.

## Arquitetura (a ordem de leitura)

1. `ocr/ImageBuffer.kt` — `GrayImage` (o tipo único; o frame da câmera já chega como luma).
2. `camera/CameraFrameSource.kt` — CameraX Preview + ImageAnalysis; plano Y do YUV → `GrayImage`;
   trava de foco perto (Camera2Interop, **valor de dioptria a calibrar no aparelho**).
3. `ocr/AutoCapture.kt` — `frameDiff` + `CaptureTrigger` (parado → segura → DISPARA → travado
   quando leu; rearma e tenta de novo quando o burst não confirmou nada), modelo *push* (um frame
   por callback do CameraX).
4. `ocr/Locate.kt` — acha a pílula escura do código por FORMA (threshold adaptativo por imagem
   integral, componentes conexos, momentos, Otsu, NMS) + recorta/prepara o crop.
5. `ocr/GlyphFeatures.kt` + `GlyphEngine.kt` + `Atlas.kt` — o reconhecedor rápido: segmenta glifos,
   classifica por vizinho-mais-próximo contra o **atlas pré-assado** (`assets/glyph_atlas.bin`, 573
   templates, gerado em Chrome headless por `../scripts/export-atlas.mjs`). Mantém as travas de
   0-FP (margem de dígito, piso de cosseno, rejeição).
6. `ocr/RecognizePipeline.kt` — `recognizeFrameInOrder`: melhor-caixa-primeiro, glifo rápido +
   *seam* para o fallback lento (Tesseract — ainda `null`, ver abaixo).
7. `domain/*` — `Matching` (corrige no máximo 1 letra fina, nunca inventa), `Confirmer` (≥2 frames),
   `CommitGate` (cooldown), `Session`. **Tudo testado em JVM.**
8. `scan/ScanController.kt` + `scan/ScanViewModel.kt` — orquestração; `ui/` — telas Compose.

## O que falta — exige o aparelho (Pixel)

Tudo abaixo **compila** mas só pode ser validado/ajustado no celular real (não há emulador
configurado nem aparelho ligado durante a reescrita):

- **Validar a captura nitidez + 0-FP com figurinhas reais.** Esse é o ponto inteiro do nativo.
  Use figurinhas de verdade, à luz da tela (fill-light). Valide que NÃO há falso positivo.
- **Validar `LENS_FOCUS_DISTANCE`** em `CameraFrameSource`. O app usa o limite de foco perto
  anunciado pela câmera selecionada quando ele existe; no Pixel, confirme se isso deixa a figurinha
  mais nítida ou se é melhor focar um pouco mais longe. Câmeras frontais de foco fixo ficam sem trava
  manual.
- **Fallback Tesseract afinado** (decisão D5): hoje o *seam* `recognizeSlow` é `null` (pílulas que o
  glifo não lê com confiança viram *miss*, nunca palpite errado). Treinar um `.traineddata` na fonte
  fina com crops reais capturados do aparelho e ligar via Tesseract4Android.

## Debug no aparelho

O **Modo debug** fica em Ajustes e funciona também em builds comuns. Ele mostra fase da captura,
leituras cruas, fps, tempo do último OCR e permite salvar frames para inspeção:

```bash
adb pull /sdcard/Android/data/br.com.fiquemsabendo.figurinhas/files/debug ./captures/android
```

Os ícones do launcher já foram gerados a partir de `public/icons/icon.svg` em todos os mipmaps.

## Benchmark / atlas

- Reassar o atlas (se a fonte/atlas do PWA mudar): `node ../scripts/export-atlas.mjs`.
- Os benches do PWA continuam em `../scripts/bench.mjs` (validam mudanças não-específicas do
  use-case; nitidez/ROI/foco se validam **ao vivo no Pixel**, não no bench).
