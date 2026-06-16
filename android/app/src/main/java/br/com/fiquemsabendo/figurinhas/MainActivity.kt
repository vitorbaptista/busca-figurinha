package br.com.fiquemsabendo.figurinhas

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.viewmodel.compose.viewModel
import br.com.fiquemsabendo.figurinhas.data.CollectionRepository
import br.com.fiquemsabendo.figurinhas.data.SettingsRepository
import br.com.fiquemsabendo.figurinhas.data.collectionDataStore
import br.com.fiquemsabendo.figurinhas.data.settingsDataStore
import br.com.fiquemsabendo.figurinhas.domain.SessionReport
import br.com.fiquemsabendo.figurinhas.scan.ScanViewModel
import br.com.fiquemsabendo.figurinhas.ui.BottomNav
import br.com.fiquemsabendo.figurinhas.ui.Screen
import br.com.fiquemsabendo.figurinhas.ui.screens.CollectionScreen
import br.com.fiquemsabendo.figurinhas.ui.screens.OnboardingScreen
import br.com.fiquemsabendo.figurinhas.ui.screens.ReportScreen
import br.com.fiquemsabendo.figurinhas.ui.screens.ScanScreen
import br.com.fiquemsabendo.figurinhas.ui.screens.SettingsScreen
import br.com.fiquemsabendo.figurinhas.ui.theme.AppTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

// The app shell — ports src/app.tsx's screen/nav state machine + onboarding gate + report flow.
// The SCAN tab hosts the real [ScanScreen] (camera + ScanViewModel); finishSession→report builds the
// end-of-scan report, and report→onCommitted commits the keepers and resets the in-progress session.
class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            AppTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    App()
                }
            }
        }
    }
}

@Composable
private fun App() {
    val context = LocalContext.current

    // Build the repositories ONCE. They need a CoroutineScope for their hot StateFlows; we own a
    // scope tied to this composition and cancel it on dispose (the DataStores themselves are process
    // singletons via the *DataStore delegates, so this is the same persisted data the ScanViewModel
    // reads — see the judgment notes).
    val repoScope = remember { CoroutineScope(SupervisorJob() + Dispatchers.Default) }
    val collection = remember { CollectionRepository(context.applicationContext.collectionDataStore, repoScope) }
    val settings = remember { SettingsRepository(context.applicationContext.settingsDataStore, repoScope) }
    DisposableEffect(Unit) {
        onDispose { repoScope.cancel() }
    }

    val settingsState by settings.settings.collectAsStateWithLifecycle()

    // The scan loop's ViewModel — owns the recognizer + live decision state. Built via its factory
    // so it survives recompositions (and config changes) and shares the same persisted DataStores.
    val scanViewModel: ScanViewModel = viewModel(factory = ScanViewModel.factory(context))

    var screen by remember { mutableStateOf(Screen.SCAN) }
    // The report the scan flow hands to the report screen. Built from the ScanViewModel's accumulated
    // session when the user taps "Terminar".
    var report by remember { mutableStateOf<SessionReport?>(null) }

    // Onboarding gate: show the intro over everything until the user is onboarded.
    if (!settingsState.onboarded) {
        OnboardingScreen(onDone = { settings.setOnboarded(true) })
        return
    }

    Scaffold(
        bottomBar = {
            BottomNav(
                current = screen,
                onNavigate = { screen = it },
            )
        },
    ) { padding ->
        Box(modifier = Modifier.padding(padding)) {
            when (screen) {
                Screen.SCAN -> ScanScreen(
                    viewModel = scanViewModel,
                    settings = settings,
                    // Build the end-of-session report from the live session, then show the report.
                    onFinish = {
                        report = scanViewModel.finishSession()
                        screen = Screen.REPORT
                    },
                )

                Screen.REPORT -> {
                    val r = report
                    if (r == null) {
                        // No report in flight (e.g. navigated here directly) → fall back to scan.
                        screen = Screen.SCAN
                    } else {
                        ReportScreen(
                            report = r,
                            collection = collection,
                            onCommitted = {
                                // The keepers are now in the collection — discard the in-progress
                                // session so the next scan starts clean (counters/recent reset too).
                                scanViewModel.resetSession()
                                report = null
                                screen = Screen.COLLECTION
                            },
                            onBack = { screen = Screen.SCAN },
                        )
                    }
                }

                Screen.COLLECTION -> CollectionScreen(collection = collection)

                Screen.SETTINGS -> SettingsScreen(collection = collection, settings = settings)
            }
        }
    }
}
