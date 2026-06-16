# Native Android — Foundation (Scaffold + Domain Port) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up a buildable native Android (`android/`) Gradle project and port the PWA's pure-logic domain layer (code parsing, the 980-sticker checklist, the conservative 0-FP matcher, multi-frame confirmer, commit gate, scan session) to Kotlin with its full test suite passing — locking the 0-false-positive contract before any pixels or camera code.

**Architecture:** A standalone Gradle/AGP project beside the untouched PWA. Phase 1 is JVM-only: every module here is pure Kotlin with JUnit unit tests (`app/src/test`), no Android device/emulator/camera needed. The TypeScript domain modules (`src/domain/*`, `src/data/checklist.ts`) port almost 1:1; their vitest suites port to `kotlin.test`+JUnit and are the regression gate.

**Tech Stack:** Kotlin 2.0.21, AGP 8.9.1, Gradle 8.12 (cached), JDK 21 (mise), JUnit + `kotlin.test`. `minSdk 24`, `compileSdk 35`. Package `br.com.fiquemsabendo.figurinhas`.

---

## File structure (this plan)

```
android/
  settings.gradle.kts                 # root settings, :app module, repos
  build.gradle.kts                    # root, plugin versions via pluginManagement
  gradle.properties                   # AndroidX, JVM args, org.gradle.java.home (JDK 21)
  gradlew / gradlew.bat / gradle/wrapper/*   # Gradle 8.12 wrapper
  app/
    build.gradle.kts                  # android app module
    src/main/AndroidManifest.xml      # minimal (no components yet)
    src/main/java/br/com/fiquemsabendo/figurinhas/
      Config.kt                       # tunable constants (domain subset for now)
      domain/Model.kt                 # data classes + enums (ports types.ts)
      domain/Code.kt                  # normalizeCode/toDisplay/parseCode/levenshtein
      domain/Matching.kt              # extractCodes/matchCode/bestMatch/matchLines/matchAll
      domain/Confirm.kt               # Confirmer (multi-frame agreement)
      domain/CommitGate.kt            # allowCommit
      domain/Session.kt              # Session (read-only accumulator) + outcomeFor
      data/Checklist.kt               # RAW_TEAMS + ALBUM_GROUPS + build() → 980 entries
    src/test/java/br/com/fiquemsabendo/figurinhas/
      domain/CodeTest.kt
      data/ChecklistTest.kt
      domain/MatchingTest.kt
      domain/ConfirmTest.kt
      domain/CommitGateTest.kt
      domain/SessionTest.kt
```

**Subsequent plans (named here so decomposition is locked; each written when reached, each producing working/testable software):**
1. `native-android-recognizer` — `GlyphFeatures`, `GlyphEngine`, atlas pre-bake + `Atlas.kt`, `Locate`, `Rotate`, `prepForOcr`; golden-image tests.
2. `native-android-camera-capture` — `CameraFrameSource` (CameraX/Camera2Interop, YUV Y-plane), `AutoCapture`, `RecognizePipeline`; on-device bench.
3. `native-android-scan-screen` — Compose scan orchestration, fill-light/reticle/ROI; live Pixel tuning.
4. `native-android-screens-state` — Collection/Report/Settings/Onboarding/Nav, DataStore repos, backup, session persistence.
5. `native-android-fallback` — Tesseract4Android behind the seam; fine-tuned `.traineddata` follow-up.

---

## Task 1: Bootstrap the Gradle/Android scaffold

**Files:**
- Create: `android/settings.gradle.kts`, `android/build.gradle.kts`, `android/gradle.properties`, `android/app/build.gradle.kts`, `android/app/src/main/AndroidManifest.xml`
- Create (generated): `android/gradlew`, `android/gradlew.bat`, `android/gradle/wrapper/gradle-wrapper.jar`, `android/gradle/wrapper/gradle-wrapper.properties`

- [ ] **Step 1: Make a Gradle binary available (to generate the wrapper)**

Network is up and Gradle 8.12 is already cached. Install a matching Gradle once, just to bootstrap the wrapper:

Run:
```bash
mise use -g gradle@8.12 && gradle --version
```
Expected: prints `Gradle 8.12`. If `mise` can't resolve it, fall back to:
```bash
cd /tmp && curl -fsSLO https://services.gradle.org/distributions/gradle-8.12-bin.zip \
  && unzip -q gradle-8.12-bin.zip && export PATH="/tmp/gradle-8.12/bin:$PATH" && gradle --version
```

- [ ] **Step 2: Create `android/settings.gradle.kts`**

```kotlin
pluginManagement {
    repositories {
        google {
            content {
                includeGroupByRegex("com\\.android.*")
                includeGroupByRegex("com\\.google.*")
                includeGroupByRegex("androidx.*")
            }
        }
        mavenCentral()
        gradlePluginPortal()
    }
}
dependencyResolutionManagement {
    repositoriesMode.set(RepositoriesMode.FAIL_ON_PROJECT_REPOS)
    repositories {
        google()
        mavenCentral()
    }
}

rootProject.name = "TrocaFigurinhas"
include(":app")
```

- [ ] **Step 3: Create `android/build.gradle.kts` (root)**

```kotlin
plugins {
    id("com.android.application") version "8.9.1" apply false
    id("org.jetbrains.kotlin.android") version "2.0.21" apply false
}
```

- [ ] **Step 4: Create `android/gradle.properties`**

```properties
org.gradle.jvmargs=-Xmx2048m -Dfile.encoding=UTF-8
org.gradle.caching=true
android.useAndroidX=true
android.nonTransitiveRClass=true
kotlin.code.style=official
# AGP 8.9 needs JDK 17+; pin the mise-installed JDK 21 (the shimmed JDK 26 is too new).
# Adjust the path if your mise java install differs (`ls ~/.local/share/mise/installs/java`).
org.gradle.java.home=/home/vitor/.local/share/mise/installs/java/21.0.2
```

- [ ] **Step 5: Create `android/app/build.gradle.kts`**

```kotlin
plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "br.com.fiquemsabendo.figurinhas"
    compileSdk = 35

    defaultConfig {
        applicationId = "br.com.fiquemsabendo.figurinhas"
        minSdk = 24
        targetSdk = 35
        versionCode = 1
        versionName = "0.1.0"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        ndk { abiFilters += "arm64-v8a" }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    testImplementation(kotlin("test"))
    testImplementation("junit:junit:4.13.2")
}
```

- [ ] **Step 6: Create `android/app/src/main/AndroidManifest.xml`**

```xml
<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android">
    <!-- Components are added in the scan-screen/screens plans. Foundation is JVM-only. -->
    <application
        android:allowBackup="true"
        android:label="Troca Figurinhas"
        android:supportsRtl="true" />
</manifest>
```

- [ ] **Step 7: Generate the wrapper pinned to the cached Gradle 8.12**

Run (from `android/`):
```bash
cd android && gradle wrapper --gradle-version 8.12 --distribution-type all
```
Expected: creates `gradlew`, `gradlew.bat`, `gradle/wrapper/gradle-wrapper.jar`, and `gradle/wrapper/gradle-wrapper.properties` with `distributionUrl=...gradle-8.12-all.zip` (reuses the cached dist).

- [ ] **Step 8: Verify the project configures and an (empty) test task runs**

Run (from `android/`):
```bash
./gradlew :app:testDebugUnitTest --offline 2>&1 | tail -20 || ./gradlew :app:testDebugUnitTest 2>&1 | tail -20
```
Expected: `BUILD SUCCESSFUL` (no tests yet — the task is up-to-date / no-source). If it fails fetching AGP/Kotlin, drop `--offline` for the first run so Gradle resolves from Google Maven (reachable), then offline works thereafter.

- [ ] **Step 9: Commit**

```bash
cd /home/vitor/Projetos/figurinhas-app/.claude/worktrees/dapper-weaving-harp
git add android/ && git commit -m "chore(android): scaffold Gradle/AGP project (JVM build green)"
```

---

## Task 2: Domain model + Config (ports `types.ts`)

**Files:**
- Create: `android/app/src/main/java/br/com/fiquemsabendo/figurinhas/domain/Model.kt`
- Create: `android/app/src/main/java/br/com/fiquemsabendo/figurinhas/Config.kt`

These are pure data declarations consumed by every later task; no test of their own (they're exercised by Tasks 3–8).

- [ ] **Step 1: Create `Model.kt`**

```kotlin
package br.com.fiquemsabendo.figurinhas.domain

// Shared contracts for the whole app. Pure types only — ports src/types.ts.

enum class StickerType { TEAM, PLAYER, SPECIAL }

/** One sticker in the album, keyed by its printed back code. */
data class ChecklistEntry(
    val code: String,       // canonical: uppercase, no spaces. "CIV12", "FWC1", "00"
    val display: String,    // human form. "CIV 12", "FWC 1", "00"
    val teamCode: String,   // grouping key. "CIV", "FWC"
    val teamName: String,   // pt-BR section name. "Costa do Marfim", "Especiais"
    val number: Int,        // number within the team (0 for the "00" logo)
    val type: StickerType,
)

data class TeamGroup(
    val teamCode: String,
    val teamName: String,
    val entries: List<ChecklistEntry>, // ordered by number
    val group: String? = null,         // World Cup group A–L; null for "FWC"
)

data class Checklist(
    val entries: List<ChecklistEntry>,
    val byCode: Map<String, ChecklistEntry>, // O(1) lookup + fuzzy-match candidate keys
    val teams: List<TeamGroup>,              // display order
    val total: Int,
)

data class ParsedCode(
    val teamCode: String,  // "" for pure-number codes like "00"
    val number: Int,
    val canonical: String,
)

enum class MatchStatus { EXACT, CORRECTED, UNKNOWN }

data class MatchResult(
    val raw: String,             // normalized raw OCR token matched against
    val status: MatchStatus,
    val entry: ChecklistEntry?,  // matched entry, or null when unknown
    val distance: Int,           // 0 exact, >=1 corrected, -1 unknown
)

enum class ScanOutcome { NEEDED, OWNED, UNKNOWN }

data class ScanRecord(
    val raw: String,
    val code: String?,   // canonical code when matched, else null
    val outcome: ScanOutcome,
    val ts: Long,
)

data class SessionReport(
    val scannedCount: Int,
    val keepers: List<ChecklistEntry>, // deduped needed
    val repeats: List<ChecklistEntry>, // deduped owned
    val unknowns: List<String>,        // deduped raw tokens that matched nothing
)
```

- [ ] **Step 2: Create `Config.kt`**

```kotlin
package br.com.fiquemsabendo.figurinhas

// Tunable constants in one place (mirrors src/config.ts). Only the domain-relevant subset
// exists now; the OCR/capture/detect knobs are added in the recognizer/capture plans.
object Config {
    object Match {
        /** Max Levenshtein distance for an OCR token to snap to a real code. */
        const val MAX_DISTANCE = 1
        /** Frames of one hold that must agree before a code commits (the 0-FP guard). */
        const val CONFIRMATIONS = 2
    }
    object Capture {
        /** Min ms between two consecutive committed captures (same-sticker re-arm guard). */
        const val MIN_RECAPTURE_MS = 250L
    }
}
```

- [ ] **Step 3: Verify it compiles**

Run (from `android/`): `./gradlew :app:compileDebugKotlin`
Expected: `BUILD SUCCESSFUL`.

- [ ] **Step 4: Commit**

```bash
git add android/app/src/main/java && git commit -m "feat(domain): port model types + Config"
```

---

## Task 3: `Code.kt` — string normalization, parsing, edit distance (ports `code.ts`)

**Files:**
- Create: `android/app/src/main/java/br/com/fiquemsabendo/figurinhas/domain/Code.kt`
- Test: `android/app/src/test/java/br/com/fiquemsabendo/figurinhas/domain/CodeTest.kt`

- [ ] **Step 1: Write the failing test (ports `code.test.ts`)**

```kotlin
package br.com.fiquemsabendo.figurinhas.domain

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull

class CodeTest {
    @Test fun normalize_uppercases_and_strips() {
        assertEquals("CIV12", normalizeCode("civ 12"))
        assertEquals("C1V12", normalizeCode("c1v-12"))
        assertEquals("FWC1", normalizeCode("  fwc_1  "))
        assertEquals("00", normalizeCode("00"))
    }

    @Test fun normalize_empty_for_junk() {
        assertEquals("", normalizeCode("--- ."))
    }

    @Test fun toDisplay_inserts_space() {
        assertEquals("CIV 12", toDisplay("CIV12"))
        assertEquals("FWC 1", toDisplay("FWC1"))
    }

    @Test fun toDisplay_leaves_pure_and_irregular() {
        assertEquals("00", toDisplay("00"))
        assertEquals("FWC", toDisplay("FWC"))
        assertEquals("C1V12", toDisplay("C1V12"))
    }

    @Test fun parse_splits_prefix_and_number() {
        assertEquals(ParsedCode("CIV", 12, "CIV12"), parseCode("CIV12"))
        assertEquals(ParsedCode("CIV", 12, "CIV12"), parseCode("civ 12"))
        assertEquals(ParsedCode("FWC", 1, "FWC1"), parseCode("FWC1"))
    }

    @Test fun parse_pure_number_logo() {
        assertEquals(ParsedCode("", 0, "00"), parseCode("00"))
    }

    @Test fun parse_null_without_trailing_digits() {
        assertNull(parseCode("CIV"))
        assertNull(parseCode(""))
        assertNull(parseCode("AB12C"))
    }

    @Test fun levenshtein_basics() {
        assertEquals(0, levenshtein("CIV12", "CIV12"))
        assertEquals(1, levenshtein("C1V12", "CIV12"))   // substitution
        assertEquals(1, levenshtein("CIV2", "CIV12"))    // insertion
        assertEquals(1, levenshtein("CIV123", "CIV12"))  // deletion
        assertEquals(0, levenshtein("", ""))
        assertEquals(3, levenshtein("", "ABC"))
        assertEquals(3, levenshtein("ABC", ""))
        assertEquals(levenshtein("EGY4", "EGYA"), levenshtein("EGYA", "EGY4"))
        assertEquals(5, levenshtein("ZZZ99", "CIV12"))
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :app:testDebugUnitTest --tests "*.CodeTest"`
Expected: FAIL — `normalizeCode`/`toDisplay`/`parseCode`/`levenshtein` unresolved.

- [ ] **Step 3: Write `Code.kt`**

```kotlin
package br.com.fiquemsabendo.figurinhas.domain

// Pure helpers for the printed sticker codes (e.g. "CIV 12", "FWC 1", "00"). Ports code.ts.

private val NON_ALNUM = Regex("[^A-Z0-9]")
private val DISPLAY_RE = Regex("^([A-Z]+)(\\d+)$")
private val PARSE_RE = Regex("^([A-Z]*)(\\d+)$")

/** Uppercase and strip everything except A-Z and 0-9. "civ 12" -> "CIV12". */
fun normalizeCode(raw: String): String = raw.uppercase().replace(NON_ALNUM, "")

/** Insert a single space between a letters prefix and a digits suffix; else unchanged. */
fun toDisplay(code: String): String {
    val m = DISPLAY_RE.matchEntire(code) ?: return code
    return "${m.groupValues[1]} ${m.groupValues[2]}"
}

/** Normalize then split into a letter prefix + trailing integer; null when no digits. */
fun parseCode(raw: String): ParsedCode? {
    val canonical = normalizeCode(raw)
    val m = PARSE_RE.matchEntire(canonical) ?: return null
    return ParsedCode(m.groupValues[1], m.groupValues[2].toInt(), canonical)
}

/** Standard Levenshtein edit distance (insert/delete/substitute = 1). */
fun levenshtein(a: String, b: String): Int {
    if (a == b) return 0
    if (a.isEmpty()) return b.length
    if (b.isEmpty()) return a.length
    var prev = IntArray(b.length + 1) { it }
    for (i in 1..a.length) {
        val curr = IntArray(b.length + 1)
        curr[0] = i
        for (j in 1..b.length) {
            val cost = if (a[i - 1] == b[j - 1]) 0 else 1
            curr[j] = minOf(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost)
        }
        prev = curr
    }
    return prev[b.length]
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew :app:testDebugUnitTest --tests "*.CodeTest"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add android/app/src/main/java android/app/src/test && git commit -m "feat(domain): port Code (normalize/parse/levenshtein)"
```

---

## Task 4: `Checklist.kt` — the 980-sticker album (ports `checklist.ts`)

**Files:**
- Create: `android/app/src/main/java/br/com/fiquemsabendo/figurinhas/data/Checklist.kt`
- Test: `android/app/src/test/java/br/com/fiquemsabendo/figurinhas/data/ChecklistTest.kt`

- [ ] **Step 1: Write the failing test**

```kotlin
package br.com.fiquemsabendo.figurinhas.data

import br.com.fiquemsabendo.figurinhas.domain.StickerType
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

class ChecklistTest {
    @Test fun has_980_entries() {
        assertEquals(980, checklist.total)
        assertEquals(980, checklist.entries.size)
    }

    @Test fun has_48_teams_plus_specials() {
        assertEquals(49, checklist.teams.size) // 48 teams + 1 Especiais
    }

    @Test fun known_codes_resolve_with_pt_names() {
        assertEquals("Costa do Marfim", checklist.byCode["CIV12"]?.teamName)
        assertEquals("Egito", checklist.byCode["EGY4"]?.teamName)
        assertEquals("CIV 12", checklist.byCode["CIV12"]?.display)
    }

    @Test fun logo_and_specials_present() {
        assertNotNull(checklist.byCode["00"])
        assertEquals(StickerType.SPECIAL, checklist.byCode["00"]?.type)
        assertNotNull(checklist.byCode["FWC19"])
        assertNull(checklist.byCode["FWC20"]) // specials are 00 + FWC1..19
    }

    @Test fun teams_are_in_album_group_order_A_first() {
        // Group A starts with MEX; specials are last.
        assertEquals("MEX", checklist.teams.first().teamCode)
        assertEquals("FWC", checklist.teams.last().teamCode)
        assertEquals("A", checklist.teams.first().group)
    }

    @Test fun every_team_has_20() {
        val teamGroups = checklist.teams.filter { it.teamCode != "FWC" }
        assertEquals(48, teamGroups.size)
        assertTrue(teamGroups.all { it.entries.size == 20 })
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :app:testDebugUnitTest --tests "*.ChecklistTest"`
Expected: FAIL — `checklist` unresolved.

- [ ] **Step 3: Write `Checklist.kt`**

```kotlin
package br.com.fiquemsabendo.figurinhas.data

import br.com.fiquemsabendo.figurinhas.domain.Checklist
import br.com.fiquemsabendo.figurinhas.domain.ChecklistEntry
import br.com.fiquemsabendo.figurinhas.domain.StickerType
import br.com.fiquemsabendo.figurinhas.domain.TeamGroup
import java.text.Collator
import java.util.Locale

// Official Panini FIFA World Cup 2026 album: 48 teams × 20 + 20 special "FWC" = 980.
// Ports src/data/checklist.ts (names pt-BR). Edit here to correct data.

private data class RawTeam(val code: String, val name: String, val count: Int)

private val RAW_TEAMS: List<RawTeam> = listOf(
    RawTeam("ALG", "Argélia", 20),
    RawTeam("ARG", "Argentina", 20),
    RawTeam("AUS", "Austrália", 20),
    RawTeam("AUT", "Áustria", 20),
    RawTeam("BEL", "Bélgica", 20),
    RawTeam("BIH", "Bósnia e Herzegovina", 20),
    RawTeam("BRA", "Brasil", 20),
    RawTeam("CAN", "Canadá", 20),
    RawTeam("CPV", "Cabo Verde", 20),
    RawTeam("COL", "Colômbia", 20),
    RawTeam("COD", "Congo (RD)", 20),
    RawTeam("CRO", "Croácia", 20),
    RawTeam("CUW", "Curaçao", 20),
    RawTeam("CZE", "Tchéquia", 20),
    RawTeam("ECU", "Equador", 20),
    RawTeam("EGY", "Egito", 20),
    RawTeam("ENG", "Inglaterra", 20),
    RawTeam("FRA", "França", 20),
    RawTeam("GER", "Alemanha", 20),
    RawTeam("GHA", "Gana", 20),
    RawTeam("HAI", "Haiti", 20),
    RawTeam("IRN", "Irã", 20),
    RawTeam("IRQ", "Iraque", 20),
    RawTeam("CIV", "Costa do Marfim", 20),
    RawTeam("JPN", "Japão", 20),
    RawTeam("JOR", "Jordânia", 20),
    RawTeam("MEX", "México", 20),
    RawTeam("MAR", "Marrocos", 20),
    RawTeam("NED", "Países Baixos", 20),
    RawTeam("NZL", "Nova Zelândia", 20),
    RawTeam("NOR", "Noruega", 20),
    RawTeam("PAN", "Panamá", 20),
    RawTeam("PAR", "Paraguai", 20),
    RawTeam("POR", "Portugal", 20),
    RawTeam("QAT", "Catar", 20),
    RawTeam("KSA", "Arábia Saudita", 20),
    RawTeam("SCO", "Escócia", 20),
    RawTeam("SEN", "Senegal", 20),
    RawTeam("RSA", "África do Sul", 20),
    RawTeam("KOR", "Coreia do Sul", 20),
    RawTeam("ESP", "Espanha", 20),
    RawTeam("SWE", "Suécia", 20),
    RawTeam("SUI", "Suíça", 20),
    RawTeam("TUN", "Tunísia", 20),
    RawTeam("TUR", "Turquia", 20),
    RawTeam("URU", "Uruguai", 20),
    RawTeam("USA", "Estados Unidos", 20),
    RawTeam("UZB", "Uzbequistão", 20),
)

// Album order: teams laid out by 2026 World Cup GROUP (A→L), each group in printed order.
private data class AlbumGroup(val group: String, val codes: List<String>)

private val ALBUM_GROUPS: List<AlbumGroup> = listOf(
    AlbumGroup("A", listOf("MEX", "RSA", "KOR", "CZE")),
    AlbumGroup("B", listOf("CAN", "BIH", "QAT", "SUI")),
    AlbumGroup("C", listOf("BRA", "MAR", "HAI", "SCO")),
    AlbumGroup("D", listOf("USA", "PAR", "AUS", "TUR")),
    AlbumGroup("E", listOf("GER", "CUW", "CIV", "ECU")),
    AlbumGroup("F", listOf("NED", "JPN", "SWE", "TUN")),
    AlbumGroup("G", listOf("BEL", "EGY", "IRN", "NZL")),
    AlbumGroup("H", listOf("ESP", "CPV", "KSA", "URU")),
    AlbumGroup("I", listOf("FRA", "SEN", "IRQ", "NOR")),
    AlbumGroup("J", listOf("ARG", "ALG", "AUT", "JOR")),
    AlbumGroup("K", listOf("POR", "COD", "UZB", "COL")),
    AlbumGroup("L", listOf("ENG", "CRO", "GHA", "PAN")),
)

private const val SPECIAL_NAME = "Especiais"
private const val SPECIAL_CODE = "FWC"

private fun teamEntries(team: RawTeam): List<ChecklistEntry> =
    (1..team.count).map { n ->
        ChecklistEntry(
            code = "${team.code}$n",
            display = "${team.code} $n",
            teamCode = team.code,
            teamName = team.name,
            number = n,
            type = if (n == 1) StickerType.TEAM else StickerType.PLAYER,
        )
    }

private fun specialEntries(): List<ChecklistEntry> {
    val out = mutableListOf(
        ChecklistEntry("00", "00", SPECIAL_CODE, SPECIAL_NAME, 0, StickerType.SPECIAL),
    )
    for (n in 1..19) {
        out.add(
            ChecklistEntry("$SPECIAL_CODE$n", "$SPECIAL_CODE $n", SPECIAL_CODE, SPECIAL_NAME, n, StickerType.SPECIAL),
        )
    }
    return out
}

private fun build(): Checklist {
    val byTeamCode = RAW_TEAMS.associateBy { it.code }
    val teamGroups = mutableListOf<TeamGroup>()
    for (ag in ALBUM_GROUPS) {
        for (code in ag.codes) {
            val t = byTeamCode[code] ?: continue // data guard
            teamGroups.add(TeamGroup(t.code, t.name, teamEntries(t), ag.group))
        }
    }
    // Safety net: any team missing from ALBUM_GROUPS still appears (alphabetically by pt name).
    val placed = teamGroups.map { it.teamCode }.toSet()
    val collator = Collator.getInstance(Locale("pt", "BR"))
    RAW_TEAMS.filter { it.code !in placed }
        .sortedWith(compareBy(collator) { it.name })
        .forEach { teamGroups.add(TeamGroup(it.code, it.name, teamEntries(it))) }

    val specials = TeamGroup(SPECIAL_CODE, SPECIAL_NAME, specialEntries())
    val teams = teamGroups + specials
    val entries = teams.flatMap { it.entries }
    val byCode = entries.associateBy { it.code }
    return Checklist(entries, byCode, teams, entries.size)
}

val checklist: Checklist = build()
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew :app:testDebugUnitTest --tests "*.ChecklistTest"`
Expected: PASS (total = 980, 49 team groups, album order).

- [ ] **Step 5: Commit**

```bash
git add android/app/src && git commit -m "feat(data): port 980-sticker checklist (album group order)"
```

---

## Task 5: `Matching.kt` — the conservative 0-FP matcher (ports `matching.ts`)

**Files:**
- Create: `android/app/src/main/java/br/com/fiquemsabendo/figurinhas/domain/Matching.kt`
- Test: `android/app/src/test/java/br/com/fiquemsabendo/figurinhas/domain/MatchingTest.kt`

This is the correctness heart: it must **never invent a code**. Corrections require a single unambiguous candidate; ties → unknown; only thin letters (I/J/L/T) are ever inserted/removed.

- [ ] **Step 1: Write the failing test (ports `matching.test.ts`)**

```kotlin
package br.com.fiquemsabendo.figurinhas.domain

import br.com.fiquemsabendo.figurinhas.data.checklist
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

class MatchingTest {
    /** Tiny synthetic checklist from canonical codes for focused tests. */
    private fun makeChecklist(codes: List<String>): Checklist {
        val re = Regex("^([A-Z]*)(\\d+)$")
        val entries = codes.map { code ->
            val m = re.matchEntire(code)!!
            ChecklistEntry(
                code = code,
                display = if (m.groupValues[1].isNotEmpty()) "${m.groupValues[1]} ${m.groupValues[2]}" else code,
                teamCode = m.groupValues[1].ifEmpty { "FWC" },
                teamName = m.groupValues[1].ifEmpty { "Especiais" },
                number = m.groupValues[2].toInt(),
                type = StickerType.PLAYER,
            )
        }
        return Checklist(entries, entries.associateBy { it.code }, emptyList(), entries.size)
    }

    // ---- extractCodes ----
    @Test fun extract_pulls_code_from_noisy_text() {
        assertTrue("CIV12" in extractCodes("FIFA WORLD CUP 2026 CIV 12"))
    }
    @Test fun extract_no_space() { assertTrue("EGY4" in extractCodes("panini EGY4 ©2026")) }
    @Test fun extract_case_insensitive() { assertEquals(listOf("CIV12"), extractCodes("civ 12")) }
    @Test fun extract_dedupes_first_seen() {
        assertEquals(listOf("CIV12", "EGY4"), extractCodes("CIV 12 noise CIV12 more EGY4"))
    }
    @Test fun extract_logo_but_not_stray_zero() {
        assertTrue("00" in extractCodes("panini 00 logo"))
        assertEquals(emptyList(), extractCodes("only a 0 here"))
    }
    @Test fun extract_no_decoy_from_adjacent_words() {
        assertTrue("CUP202" !in extractCodes("FIFA WORLD CUP 2026"))
        assertTrue("NINI00" !in extractCodes("panini 00 logo"))
    }
    @Test fun extract_empty_when_none() { assertEquals(emptyList(), extractCodes("just some words")) }
    @Test fun extract_multiline_noise_allowed() {
        val codes = extractCodes("FIFA WORLD CUP 2026\nCIV 12\nMade in Italy\nFWC 1")
        assertTrue("CIV12" in codes); assertTrue("FWC1" in codes)
    }
    @Test fun extract_clean_no_decoys() {
        assertEquals(listOf("CIV12", "FWC1"), extractCodes("back of sticker\nCIV 12\nFWC 1"))
    }

    // ---- matchCode ----
    private val list = makeChecklist(listOf("CIV12", "EGY4", "FWC1", "00"))

    @Test fun match_exact() {
        val r = matchCode("CIV12", list)
        assertEquals(MatchStatus.EXACT, r.status); assertEquals(0, r.distance)
        assertEquals("CIV12", r.entry?.code); assertEquals("CIV12", r.raw)
    }
    @Test fun match_one_edit() {
        val r = matchCode("C1V12", list)
        assertEquals(MatchStatus.CORRECTED, r.status); assertEquals(1, r.distance)
        assertEquals("CIV12", r.entry?.code)
    }
    @Test fun match_letter_for_digit() {
        val r = matchCode("EGYA", list) // 'A' read instead of '4'
        assertEquals(MatchStatus.CORRECTED, r.status); assertEquals("EGY4", r.entry?.code); assertEquals(1, r.distance)
    }
    @Test fun match_unknown_when_far() {
        val r = matchCode("ZZZ99", list)
        assertEquals(MatchStatus.UNKNOWN, r.status); assertNull(r.entry); assertEquals(-1, r.distance); assertEquals("ZZZ99", r.raw)
    }
    @Test fun match_respects_maxDistance() {
        assertEquals(MatchStatus.UNKNOWN, matchCode("CXX12", list, 1).status)
        assertEquals(MatchStatus.CORRECTED, matchCode("CXX12", list, 2).status)
    }
    @Test fun match_prefers_equal_length_on_tie() {
        val tie = makeChecklist(listOf("FWC1", "FWC11"))
        assertEquals("FWC11", matchCode("FWC12", tie, 1).entry?.code)
    }
    @Test fun match_unique_or_reject() {
        assertEquals("CIV12", matchCode("GIV12", checklist).entry?.code)
        assertEquals(MatchStatus.UNKNOWN, matchCode("EGYA", checklist).status)
        assertEquals(MatchStatus.UNKNOWN, matchCode("SE3", checklist).status)
    }
    @Test fun match_restores_thin_letter_only_when_unambiguous() {
        assertEquals("CIV12", matchCode("CV12", checklist).entry?.code)
        assertEquals(MatchStatus.UNKNOWN, matchCode("C1V12", checklist).status)
        val onlyBold = makeChecklist(listOf("CPV12"))
        assertEquals(MatchStatus.UNKNOWN, matchCode("CV12", onlyBold).status)
    }
    @Test fun match_real_checklist() {
        assertEquals(MatchStatus.EXACT, matchCode("CIV12", checklist).status)
        assertEquals(MatchStatus.EXACT, matchCode("00", checklist).status)
        assertEquals("CIV12", matchCode("GIV12", checklist).entry?.code)
        assertEquals(MatchStatus.UNKNOWN, matchCode("C1V12", checklist).status)
    }

    // ---- bestMatchFromText ----
    @Test fun best_null_when_no_codes() { assertNull(bestMatchFromText("no codes here", checklist)) }
    @Test fun best_prefers_exact() {
        val r = bestMatchFromText("garbage CIV12 EGY4", checklist)
        assertEquals(MatchStatus.EXACT, r?.status); assertEquals("CIV12", r?.entry?.code)
    }
    @Test fun best_falls_back_to_correction() {
        val l = makeChecklist(listOf("CIV12"))
        val r = bestMatchFromText("noise CIW12 more", l)
        assertEquals(MatchStatus.CORRECTED, r?.status); assertEquals("CIV12", r?.entry?.code)
    }
    @Test fun best_unknown_first_token() {
        val l = makeChecklist(listOf("CIV12"))
        val r = bestMatchFromText("ZZZ99 then WWW88", l)
        assertEquals(MatchStatus.UNKNOWN, r?.status); assertEquals("ZZZ99", r?.raw)
    }
    @Test fun best_reads_multiline_back() {
        val r = bestMatchFromText("FIFA WORLD CUP 2026\nCIV 12\n© Panini", checklist)
        assertEquals("CIV12", r?.entry?.code)
    }

    // ---- matchAllFromText ----
    @Test fun all_resolves_each_distinct() {
        val results = matchAllFromText("FIFA WORLD CUP 2026 CIV 12\nEGY 4\nBRA 5\nFWC 1", checklist)
        assertEquals(listOf("CIV12", "EGY4", "BRA5", "FWC1"), results.map { it.entry?.code })
        assertTrue(results.all { it.entry != null })
    }
    @Test fun all_dedupes_and_drops_noise() {
        assertEquals(listOf("CIV12", "EGY4"), matchAllFromText("CIV12 CIV 12 ZZZ99 EGY4", checklist).map { it.entry?.code })
    }
    @Test fun all_empty_when_none() { assertEquals(emptyList(), matchAllFromText("just some words", checklist)) }

    // ---- matchLines ----
    @Test fun lines_one_per_line() {
        assertEquals(listOf("CIV12", "EGY4", "BRA5"), matchLines("CIV 12\nEGY 4\nBRA 5", checklist).map { it.entry?.code })
    }
    @Test fun lines_skips_long_legal_text() {
        val text = "CIV 12\nESTE CROMO E PARTE NID 9 INTEGRANTE DO ALBUM OFICIAL"
        assertEquals(listOf("CIV12"), matchLines(text, checklist).map { it.entry?.code })
    }
    @Test fun lines_dedupes_and_ignores_blank_unknown() {
        assertEquals(listOf("EGY4"), matchLines("EGY 4\n\nEGY 4\nZZZ 99", checklist).map { it.entry?.code })
    }
    @Test fun lines_tolerates_noise_on_short_line() {
        assertEquals(listOf("EGY4"), matchLines("EGY 4 7", checklist).map { it.entry?.code })
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :app:testDebugUnitTest --tests "*.MatchingTest"`
Expected: FAIL — matching functions unresolved.

- [ ] **Step 3: Write `Matching.kt`**

```kotlin
package br.com.fiquemsabendo.figurinhas.domain

import br.com.fiquemsabendo.figurinhas.Config

// Turns noisy OCR text into checklist matches. Conservative: never invents a code. Ports matching.ts.

private val CODE_RE = Regex("\\b[A-Z]{2,4}\\s?\\d{1,3}\\b", RegexOption.IGNORE_CASE)
private val LOGO_RE = Regex("\\b00\\b")

/** Pull candidate code tokens out of arbitrary OCR text (letter+number codes plus "00"). */
fun extractCodes(text: String): List<String> {
    val tokens = ArrayList<String>()
    for (m in CODE_RE.findAll(text)) tokens.add(m.value)
    for (m in LOGO_RE.findAll(text)) tokens.add(m.value)
    val seen = LinkedHashSet<String>()
    for (token in tokens) {
        val code = normalizeCode(token)
        if (code.isNotEmpty()) seen.add(code)
    }
    return seen.toList()
}

/** Tokens shorter than this are too ambiguous to auto-correct; only exact matches accepted. */
private const val MIN_CORRECT_LEN = 4

/** Thin vertical-stroke letters the OCR reliably DROPS (never a bold letter). */
private val DROPPABLE_LETTERS = setOf('I', 'J', 'L', 'T')

/** If [longer] becomes [shorter] by removing exactly one char, return it; else null. */
private fun singleRemovedChar(longer: String, shorter: String): Char? {
    if (longer.length != shorter.length + 1) return null
    var i = 0
    while (i < shorter.length && longer[i] == shorter[i]) i++
    if (longer.substring(i + 1) != shorter.substring(i)) return null
    return longer[i]
}

/** Match a single raw token against the checklist (exact, else unique nearest). */
fun matchCode(raw: String, list: Checklist, maxDistance: Int = Config.Match.MAX_DISTANCE): MatchResult {
    val normalized = normalizeCode(raw)

    list.byCode[normalized]?.let {
        return MatchResult(normalized, MatchStatus.EXACT, it, 0)
    }
    if (normalized.length < MIN_CORRECT_LEN) {
        return MatchResult(normalized, MatchStatus.UNKNOWN, null, -1)
    }

    var bestEntry: ChecklistEntry? = null
    var bestDistance = Int.MAX_VALUE
    var tieAtBest = 0
    fun consider(entry: ChecklistEntry, distance: Int) {
        if (distance < bestDistance) {
            bestEntry = entry; bestDistance = distance; tieAtBest = 1
        } else if (distance == bestDistance) {
            tieAtBest++
        }
    }

    for (entry in list.entries) {
        val code = entry.code
        when {
            code.length == normalized.length -> {
                val d = levenshtein(normalized, code)
                if (d <= maxDistance) consider(entry, d)
            }
            code.length == normalized.length + 1 -> {
                val dropped = singleRemovedChar(code, normalized)
                if (dropped != null && dropped in DROPPABLE_LETTERS) consider(entry, 1)
            }
            code.length + 1 == normalized.length -> {
                val added = singleRemovedChar(normalized, code)
                if (added != null && added in DROPPABLE_LETTERS) consider(entry, 1)
            }
        }
    }

    val be = bestEntry
    return if (be != null && tieAtBest == 1) {
        MatchResult(normalized, MatchStatus.CORRECTED, be, bestDistance)
    } else {
        MatchResult(normalized, MatchStatus.UNKNOWN, null, -1)
    }
}

/** Best match across every code found in a block of OCR text; null when none present. */
fun bestMatchFromText(text: String, list: Checklist, maxDistance: Int = Config.Match.MAX_DISTANCE): MatchResult? {
    val codes = extractCodes(text)
    if (codes.isEmpty()) return null
    var best: MatchResult? = null
    for (code in codes) {
        val result = matchCode(code, list, maxDistance)
        if (result.status == MatchStatus.EXACT) return result
        val b = best
        if (b == null) { best = result; continue }
        if (b.status == MatchStatus.UNKNOWN && result.status == MatchStatus.CORRECTED) best = result
        else if (result.status == MatchStatus.CORRECTED && result.distance < b.distance) best = result
    }
    return best
}

/** Match a block where each line is one located code-box crop (one result per unique entry). */
fun matchLines(text: String, list: Checklist, maxDistance: Int = Config.Match.MAX_DISTANCE): List<MatchResult> {
    val seen = LinkedHashSet<String>()
    val results = ArrayList<MatchResult>()
    for (line in text.split("\n")) {
        val norm = normalizeCode(line)
        if (norm.length < 2 || norm.length > 8) continue
        val m = bestMatchFromText(line, list, maxDistance)
        val e = m?.entry
        if (e != null && seen.add(e.code)) results.add(m)
    }
    return results
}

/** Match EVERY distinct code found (several backs in view); one result per unique entry. */
fun matchAllFromText(text: String, list: Checklist, maxDistance: Int = Config.Match.MAX_DISTANCE): List<MatchResult> {
    val seen = LinkedHashSet<String>()
    val results = ArrayList<MatchResult>()
    for (code in extractCodes(text)) {
        val result = matchCode(code, list, maxDistance)
        val e = result.entry ?: continue
        if (seen.add(e.code)) results.add(result)
    }
    return results
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew :app:testDebugUnitTest --tests "*.MatchingTest"`
Expected: PASS (all extract/match/best/all/lines cases, including the thin-letter recovery + ambiguity rejections).

- [ ] **Step 5: Commit**

```bash
git add android/app/src && git commit -m "feat(domain): port conservative 0-FP matcher (thin-letter recovery)"
```

---

## Task 6: `Confirm.kt` — multi-frame agreement (ports `confirm.ts`)

**Files:**
- Create: `android/app/src/main/java/br/com/fiquemsabendo/figurinhas/domain/Confirm.kt`
- Test: `android/app/src/test/java/br/com/fiquemsabendo/figurinhas/domain/ConfirmTest.kt`

- [ ] **Step 1: Write the failing test (ports `confirm.test.ts`)**

```kotlin
package br.com.fiquemsabendo.figurinhas.domain

import kotlin.test.Test
import kotlin.test.assertEquals

class ConfirmTest {
    @Test fun commits_after_threshold_sightings() {
        val c = Confirmer(2)
        assertEquals(emptyList(), c.add(listOf("CIV12")))
        assertEquals(listOf("CIV12"), c.add(listOf("CIV12")))
    }
    @Test fun confirms_each_code_once() {
        val c = Confirmer(2)
        c.add(listOf("EGY4"))
        assertEquals(listOf("EGY4"), c.add(listOf("EGY4")))
        assertEquals(emptyList(), c.add(listOf("EGY4")))
    }
    @Test fun counts_once_per_frame() {
        val c = Confirmer(2)
        assertEquals(emptyList(), c.add(listOf("CIV12", "CIV12")))
        assertEquals(listOf("CIV12"), c.add(listOf("CIV12")))
    }
    @Test fun drops_one_off_slip() {
        val c = Confirmer(2)
        c.add(listOf("EGY4"))
        assertEquals(listOf("EGY4"), c.add(listOf("EGY4", "EGY6")))
    }
    @Test fun confirms_several_held_together() {
        val c = Confirmer(2)
        c.add(listOf("CIV12", "EGY4"))
        assertEquals(listOf("CIV12", "EGY4"), c.add(listOf("CIV12", "EGY4")).sorted())
    }
    @Test fun threshold_one_confirms_immediately() {
        val c = Confirmer(1)
        assertEquals(listOf("AUT4"), c.add(listOf("AUT4")))
    }
    @Test fun tracks_committed_count() {
        val c = Confirmer(2)
        assertEquals(0, c.committedCount())
        c.add(listOf("CIV12", "EGY4"))
        assertEquals(0, c.committedCount())
        c.add(listOf("CIV12")); assertEquals(1, c.committedCount())
        c.add(listOf("EGY4")); assertEquals(2, c.committedCount())
    }
    @Test fun reset_forgets_evidence() {
        val c = Confirmer(2)
        c.add(listOf("CIV12"))
        c.reset()
        assertEquals(emptyList(), c.add(listOf("CIV12")))
        assertEquals(listOf("CIV12"), c.add(listOf("CIV12")))
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :app:testDebugUnitTest --tests "*.ConfirmTest"`
Expected: FAIL — `Confirmer` unresolved.

- [ ] **Step 3: Write `Confirm.kt`**

```kotlin
package br.com.fiquemsabendo.figurinhas.domain

// Multi-frame agreement: commit a code only once it's seen on >= threshold frames of one hold.
// A transient one-frame slip never repeats, so it never reaches the threshold. Ports confirm.ts.
class Confirmer(private val threshold: Int) {
    private val counts = HashMap<String, Int>()
    private val committed = LinkedHashSet<String>()

    /** Record one frame's resolved codes; return those that crossed the threshold THIS frame. */
    fun add(codes: Iterable<String>): List<String> {
        val seenThisFrame = codes.toHashSet() // a code counts once per frame
        val newly = ArrayList<String>()
        for (code in seenThisFrame) {
            if (code in committed) continue
            val next = (counts[code] ?: 0) + 1
            counts[code] = next
            if (next >= threshold) { committed.add(code); newly.add(code) }
        }
        return newly
    }

    fun committedCount(): Int = committed.size

    fun reset() { counts.clear(); committed.clear() }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew :app:testDebugUnitTest --tests "*.ConfirmTest"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add android/app/src && git commit -m "feat(domain): port multi-frame confirmer"
```

---

## Task 7: `CommitGate.kt` — same-sticker re-arm guard (ports `commitGate.ts`)

**Files:**
- Create: `android/app/src/main/java/br/com/fiquemsabendo/figurinhas/domain/CommitGate.kt`
- Test: `android/app/src/test/java/br/com/fiquemsabendo/figurinhas/domain/CommitGateTest.kt`

- [ ] **Step 1: Write the failing test (ports `commitGate.test.ts`)**

```kotlin
package br.com.fiquemsabendo.figurinhas.domain

import kotlin.test.Test
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class CommitGateTest {
    private val min = 500L

    @Test fun allows_first_commit_after_cooldown() {
        assertTrue(allowCommit(CommitGateState(lastCommitAt = 0, committedThisBurst = false), 600, min))
    }
    @Test fun rejects_fresh_hold_too_soon() {
        assertFalse(allowCommit(CommitGateState(lastCommitAt = 1000, committedThisBurst = false), 1120, min))
    }
    @Test fun allows_co_present_in_same_burst() {
        assertTrue(allowCommit(CommitGateState(lastCommitAt = 1000, committedThisBurst = true), 1120, min))
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :app:testDebugUnitTest --tests "*.CommitGateTest"`
Expected: FAIL — `allowCommit`/`CommitGateState` unresolved.

- [ ] **Step 3: Write `CommitGate.kt`**

```kotlin
package br.com.fiquemsabendo.figurinhas.domain

// The commit cooldown gates only a burst's FIRST commit (rejecting a same-sticker re-arm between
// separate holds); co-present stickers in the SAME hold commit freely. Ports commitGate.ts.

data class CommitGateState(
    val lastCommitAt: Long,        // when the last capture committed (epoch ms)
    val committedThisBurst: Boolean, // has the current burst already committed? reset per burst
)

/** Decide whether a freshly-confirmed commit batch may post given the cooldown. */
fun allowCommit(state: CommitGateState, now: Long, minRecaptureMs: Long): Boolean {
    if (state.committedThisBurst) return true // co-present sticker in the same hold — never gated
    return now - state.lastCommitAt >= minRecaptureMs
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew :app:testDebugUnitTest --tests "*.CommitGateTest"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add android/app/src && git commit -m "feat(domain): port commit gate"
```

---

## Task 8: `Session.kt` — read-only scan accumulator + report (ports `session.ts`)

**Files:**
- Create: `android/app/src/main/java/br/com/fiquemsabendo/figurinhas/domain/Session.kt`
- Test: `android/app/src/test/java/br/com/fiquemsabendo/figurinhas/domain/SessionTest.kt`

The session records what the camera saw; it never changes the collection. The report dedupes into
keepers/repeats/unknowns and sorts entries by pt-BR team name then number.

- [ ] **Step 1: Write the failing test (ports `session.test.ts`)**

```kotlin
package br.com.fiquemsabendo.figurinhas.domain

import br.com.fiquemsabendo.figurinhas.data.checklist
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class SessionTest {
    private fun entry(code: String) = checklist.byCode[code] ?: error("test setup: unknown $code")
    private fun exact(code: String) = MatchResult(code, MatchStatus.EXACT, entry(code), 0)
    private fun unknown(raw: String) = MatchResult(raw, MatchStatus.UNKNOWN, null, -1)

    @Test fun outcome_unknown_without_entry() {
        assertEquals(ScanOutcome.UNKNOWN, outcomeFor(unknown("ZZZ99"), false))
        assertEquals(ScanOutcome.UNKNOWN, outcomeFor(unknown("ZZZ99"), true))
    }
    @Test fun outcome_owned_and_needed() {
        assertEquals(ScanOutcome.OWNED, outcomeFor(exact("CIV12"), true))
        assertEquals(ScanOutcome.NEEDED, outcomeFor(exact("CIV12"), false))
    }

    @Test fun starts_empty() {
        val s = Session()
        assertTrue(s.isEmpty()); assertEquals(emptyList(), s.records())
    }
    @Test fun records_each_add() {
        val s = Session(now = { 42L })
        val rec = s.add(exact("CIV12"), false)
        assertEquals("CIV12", rec.raw); assertEquals("CIV12", rec.code)
        assertEquals(ScanOutcome.NEEDED, rec.outcome); assertEquals(42L, rec.ts)
        assertFalse(s.isEmpty()); assertEquals(1, s.records().size)
    }
    @Test fun stores_null_code_for_unknown() {
        val rec = Session().add(unknown("ZZZ99"), false)
        assertNull(rec.code); assertEquals(ScanOutcome.UNKNOWN, rec.outcome)
    }
    @Test fun records_returns_copy() {
        val s = Session()
        s.add(exact("CIV12"), false)
        val copy = s.records().toMutableList()
        copy.add(copy[0])
        assertEquals(1, s.records().size)
    }
    @Test fun clear_empties() {
        val s = Session(); s.add(exact("CIV12"), false); s.clear()
        assertTrue(s.isEmpty())
    }
    @Test fun seeds_from_initial() {
        val s = Session(initial = listOf(ScanRecord("CIV12", "CIV12", ScanOutcome.NEEDED, 1)))
        assertEquals(1, s.records().size)
    }
    @Test fun toJSON_mirrors_records() {
        val s = Session(); s.add(exact("CIV12"), false)
        assertEquals(s.records(), s.toJSON())
    }

    @Test fun report_dedupes_keepers_and_repeats() {
        val s = Session()
        s.add(exact("CIV12"), false); s.add(exact("CIV12"), false)
        s.add(exact("EGY4"), true); s.add(exact("EGY4"), true)
        val r = s.report(checklist)
        assertEquals(4, r.scannedCount)
        assertEquals(listOf("CIV12"), r.keepers.map { it.code })
        assertEquals(listOf("EGY4"), r.repeats.map { it.code })
    }
    @Test fun report_dedupes_unknowns() {
        val s = Session()
        s.add(unknown("ZZZ99"), false); s.add(unknown("ZZZ99"), false); s.add(unknown("WWW88"), false)
        assertEquals(listOf("ZZZ99", "WWW88"), s.report(checklist).unknowns)
    }
    @Test fun report_sorts_by_pt_team_then_number() {
        val s = Session()
        s.add(exact("BRA1"), false); s.add(exact("CIV1"), false)
        s.add(exact("ARG2"), false); s.add(exact("ARG1"), false)
        assertEquals(listOf("ARG1", "ARG2", "BRA1", "CIV1"), s.report(checklist).keepers.map { it.code })
    }
    @Test fun report_routes_buckets() {
        val s = Session()
        s.add(exact("CIV12"), false); s.add(exact("EGY4"), true); s.add(unknown("ZZZ99"), false)
        val r = s.report(checklist)
        assertEquals(listOf("CIV12"), r.keepers.map { it.code })
        assertEquals(listOf("EGY4"), r.repeats.map { it.code })
        assertEquals(listOf("ZZZ99"), r.unknowns)
    }
}
```

- [ ] **Step 2: Run to verify it fails**

Run: `./gradlew :app:testDebugUnitTest --tests "*.SessionTest"`
Expected: FAIL — `Session`/`outcomeFor` unresolved.

- [ ] **Step 3: Write `Session.kt`**

```kotlin
package br.com.fiquemsabendo.figurinhas.domain

import java.text.Collator
import java.util.Locale

// A scanning session is read-only over the collection: it just records what the camera saw.
// The report dedupes records into keepers/repeats/unknowns. Ports session.ts.

/** Classify a scan: unknown when unmatched, else owned/needed by the collection. */
fun outcomeFor(match: MatchResult, owned: Boolean): ScanOutcome {
    if (match.entry == null || match.status == MatchStatus.UNKNOWN) return ScanOutcome.UNKNOWN
    return if (owned) ScanOutcome.OWNED else ScanOutcome.NEEDED
}

class Session(
    initial: List<ScanRecord> = emptyList(),
    private val now: () -> Long = { System.currentTimeMillis() },
) {
    private val records = ArrayList(initial)
    private val collator = Collator.getInstance(Locale("pt", "BR"))

    fun add(match: MatchResult, owned: Boolean): ScanRecord {
        val record = ScanRecord(
            raw = match.raw,
            code = match.entry?.code,
            outcome = outcomeFor(match, owned),
            ts = now(),
        )
        records.add(record)
        return record
    }

    fun records(): List<ScanRecord> = records.toList()
    fun isEmpty(): Boolean = records.isEmpty()
    fun clear() { records.clear() }
    fun toJSON(): List<ScanRecord> = records.toList()

    fun report(checklist: Checklist): SessionReport {
        val keeperCodes = LinkedHashSet<String>()
        val repeatCodes = LinkedHashSet<String>()
        val unknownRaws = LinkedHashSet<String>()
        for (r in records) {
            when {
                r.outcome == ScanOutcome.NEEDED && r.code != null -> keeperCodes.add(r.code)
                r.outcome == ScanOutcome.OWNED && r.code != null -> repeatCodes.add(r.code)
                r.outcome == ScanOutcome.UNKNOWN -> unknownRaws.add(r.raw)
            }
        }
        val byTeamThenNumber = Comparator<ChecklistEntry> { a, b ->
            val c = collator.compare(a.teamName, b.teamName)
            if (c != 0) c else a.number - b.number
        }
        fun toEntries(codes: Set<String>): List<ChecklistEntry> =
            codes.mapNotNull { checklist.byCode[it] }.sortedWith(byTeamThenNumber)

        return SessionReport(
            scannedCount = records.size,
            keepers = toEntries(keeperCodes),
            repeats = toEntries(repeatCodes),
            unknowns = unknownRaws.toList(),
        )
    }
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `./gradlew :app:testDebugUnitTest --tests "*.SessionTest"`
Expected: PASS.

- [ ] **Step 5: Run the FULL suite and commit**

Run: `./gradlew :app:testDebugUnitTest`
Expected: `BUILD SUCCESSFUL` — every domain test green (Code, Checklist, Matching, Confirm, CommitGate, Session).

```bash
git add android/app/src && git commit -m "feat(domain): port read-only scan session + report; full domain suite green"
```

---

## Self-review

**Spec coverage (against `2026-06-16-native-android-rewrite-design.md`):**
- §3 stack/build → Task 1 (Gradle 8.12, AGP 8.9.1, Kotlin 2.0.21, JDK 21, minSdk 24, arm64). ✓
- §4 module map (domain + checklist rows) → Tasks 2–8. ✓
- §5 0-FP contract layers 1–4: `matchCode` non-guessing (Task 5), `Confirmer` (Task 6), `commitGate` (Task 7) ported with their tests; layer-1 recognizer gates belong to the recognizer plan (noted). ✓
- §10 checklist 980 / groups A–L / specials → Task 4. ✓
- §13 build order steps 1–2 (scaffold + pure domain) → this plan; steps 3–8 → named follow-on plans. ✓
- Out of this plan by design: recognizer, camera, UI, DataStore, Tesseract (their own plans). Not gaps.

**Placeholder scan:** none — every code/test step has complete content; no TBD/TODO/"add error handling".

**Type consistency:** `ChecklistEntry`/`MatchResult`/`MatchStatus`/`ScanOutcome`/`ScanRecord`/`SessionReport`/`Checklist`/`TeamGroup`/`ParsedCode`/`StickerType` defined once in `Model.kt` (Task 2) and used identically in Tasks 3–8. `Config.Match.MAX_DISTANCE` used as the default in `matchCode`/`bestMatchFromText`/`matchLines`/`matchAllFromText`. `Confirmer`, `allowCommit`/`CommitGateState`, `Session`/`outcomeFor`, `normalizeCode`/`levenshtein` names match across tasks and their tests.
