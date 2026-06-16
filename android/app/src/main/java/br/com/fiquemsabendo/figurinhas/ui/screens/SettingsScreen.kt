package br.com.fiquemsabendo.figurinhas.ui.screens

import android.net.Uri
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import br.com.fiquemsabendo.figurinhas.data.CollectionRepository
import br.com.fiquemsabendo.figurinhas.data.SettingsRepository
import br.com.fiquemsabendo.figurinhas.data.decodeBackup
import br.com.fiquemsabendo.figurinhas.data.encodeBackup
import br.com.fiquemsabendo.figurinhas.data.toSettings
import br.com.fiquemsabendo.figurinhas.i18n.Pt
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.time.OffsetDateTime
import java.util.Date
import java.util.Locale

// Ports src/ui/screens/SettingsScreen.tsx. Export/import use the Storage Access Framework instead of
// the PWA's <a download> / <input type=file>: CreateDocument writes a JSON backup, OpenDocument reads
// one. The rest matches: a sound toggle, "Ver tutorial de novo" (un-onboards), a danger "Apagar
// tudo" gated by an AlertDialog confirm, and a version + credit footer. ok/error feedback is a
// transient notice banner (the PWA's 3s settings-notice).

private const val APP_VERSION = "0.1.0"

@Composable
fun SettingsScreen(
    collection: CollectionRepository,
    settings: SettingsRepository,
    modifier: Modifier = Modifier,
) {
    val current by settings.settings.collectAsStateWithLifecycle()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    var notice by remember { mutableStateOf<Notice?>(null) }
    var confirmClear by remember { mutableStateOf(false) }

    // 3s auto-dismiss for the notice banner (mirrors the PWA's setTimeout(3000)).
    androidx.compose.runtime.LaunchedEffect(notice) {
        if (notice != null) {
            kotlinx.coroutines.delay(3000)
            notice = null
        }
    }

    // SAF: write the backup JSON to the user-picked location. The launcher only returns the Uri;
    // we build + serialize the backup and write it on an IO dispatcher.
    val exportLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.CreateDocument("application/json"),
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            runCatching {
                val text = encodeBackup(
                    owned = collection.export(),
                    settings = settings.settings.value,
                    exportedAt = nowIso(),
                )
                withContext(Dispatchers.IO) {
                    context.contentResolver.openOutputStream(uri)?.use { out ->
                        out.write(text.toByteArray(Charsets.UTF_8))
                    } ?: error("no output stream")
                }
            }.onFailure { notice = Notice(false, Pt.Settings.importInvalid) }
        }
    }

    // SAF: read a backup JSON, validate it, then replace the owned set + apply settings.
    val importLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.OpenDocument(),
    ) { uri: Uri? ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val result = runCatching {
                val text = withContext(Dispatchers.IO) {
                    context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
                        ?.toString(Charsets.UTF_8) ?: error("no input stream")
                }
                val backup = decodeBackup(text)
                require(backup.app == "troca-figurinhas" && backup.version == 1) { "invalid backup" }
                backup
            }
            result.onSuccess { backup ->
                collection.import(backup.owned)
                settings.set { backup.settings.toSettings() }
                notice = Notice(true, Pt.Settings.importDone)
            }.onFailure {
                notice = Notice(false, Pt.Settings.importInvalid)
            }
        }
    }

    LazyColumn(
        modifier = modifier.fillMaxWidth(),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        item {
            Text(
                text = Pt.Settings.title,
                style = MaterialTheme.typography.headlineMedium,
            )
        }

        notice?.let { n ->
            item {
                NoticeBanner(n)
            }
        }

        // Data group: export + import.
        item {
            SettingsGroup(title = Pt.Settings.data) {
                ActionRow(
                    emoji = "⬇️",
                    title = Pt.Settings.export,
                    hint = Pt.Settings.exportHint,
                    onClick = { exportLauncher.launch(defaultBackupName()) },
                )
                ActionRow(
                    emoji = "⬆️",
                    title = Pt.Settings.import,
                    hint = Pt.Settings.importHint,
                    onClick = { importLauncher.launch(arrayOf("application/json")) },
                )
            }
        }

        // Sound toggle + tutorial replay.
        item {
            SettingsGroup(title = null) {
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("🔊", fontSize = 22.sp)
                    Text(
                        text = Pt.Settings.sound,
                        fontWeight = FontWeight.SemiBold,
                        fontSize = 16.sp,
                        modifier = Modifier
                            .weight(1f)
                            .padding(start = 12.dp),
                    )
                    Switch(
                        checked = current.sound,
                        onCheckedChange = { settings.setSound(it) },
                    )
                }
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 14.dp, vertical = 12.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text("🐞", fontSize = 22.sp)
                    Column(
                        modifier = Modifier
                            .weight(1f)
                            .padding(start = 12.dp),
                    ) {
                        Text(text = Pt.Settings.debug, fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                        Text(
                            text = Pt.Settings.debugHint,
                            fontSize = 13.sp,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                    }
                    Switch(
                        checked = current.debug,
                        onCheckedChange = { settings.setDebug(it) },
                    )
                }
                ActionRow(
                    emoji = "📖",
                    title = Pt.Settings.tutorial,
                    hint = null,
                    onClick = { settings.setOnboarded(false) },
                )
            }
        }

        // Danger zone.
        item {
            SettingsGroup(title = Pt.Settings.danger) {
                ActionRow(
                    emoji = "🗑️",
                    title = Pt.Settings.clear,
                    hint = Pt.Settings.clearHint,
                    titleColor = MaterialTheme.colorScheme.error,
                    onClick = { confirmClear = true },
                )
            }
        }

        item {
            Column(
                modifier = Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = Pt.Settings.version(APP_VERSION),
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Text(
                    text = Pt.Settings.credit,
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(top = 4.dp),
                )
            }
        }
    }

    if (confirmClear) {
        AlertDialog(
            onDismissRequest = { confirmClear = false },
            title = { Text(Pt.Settings.clear) },
            text = { Text(Pt.Settings.clearConfirm) },
            confirmButton = {
                TextButton(onClick = {
                    confirmClear = false
                    collection.clear()
                    notice = Notice(true, Pt.Settings.clearDone)
                }) {
                    Text(Pt.Settings.clear, color = MaterialTheme.colorScheme.error)
                }
            },
            dismissButton = {
                TextButton(onClick = { confirmClear = false }) {
                    Text(Pt.Settings.cancel)
                }
            },
        )
    }
}

private data class Notice(val ok: Boolean, val text: String)

@Composable
private fun NoticeBanner(notice: Notice) {
    val bg = if (notice.ok) br.com.fiquemsabendo.figurinhas.ui.theme.AppTheme.colors.keepContainer
    else br.com.fiquemsabendo.figurinhas.ui.theme.AppTheme.colors.repeatContainer
    val fg = if (notice.ok) br.com.fiquemsabendo.figurinhas.ui.theme.AppTheme.colors.keep
    else br.com.fiquemsabendo.figurinhas.ui.theme.AppTheme.colors.repeat
    Surface(
        modifier = Modifier.fillMaxWidth(),
        color = bg,
        shape = RoundedCornerShape(12.dp),
    ) {
        Text(
            text = notice.text,
            color = fg,
            fontWeight = FontWeight.SemiBold,
            modifier = Modifier.padding(14.dp),
        )
    }
}

@Composable
private fun SettingsGroup(
    title: String?,
    content: @Composable () -> Unit,
) {
    Column(modifier = Modifier.fillMaxWidth()) {
        if (title != null) {
            Text(
                text = title,
                style = MaterialTheme.typography.titleMedium,
                modifier = Modifier.padding(bottom = 8.dp, start = 2.dp),
            )
        }
        Surface(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.surface,
            shape = RoundedCornerShape(14.dp),
            tonalElevation = 1.dp,
        ) {
            Column { content() }
        }
    }
}

@Composable
private fun ActionRow(
    emoji: String,
    title: String,
    hint: String?,
    titleColor: Color = Color.Unspecified,
    onClick: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 14.dp, vertical = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(emoji, fontSize = 22.sp)
        Column(
            modifier = Modifier
                .weight(1f)
                .padding(start = 12.dp),
        ) {
            Text(
                text = title,
                fontWeight = FontWeight.SemiBold,
                fontSize = 16.sp,
                color = titleColor,
            )
            if (hint != null) {
                Text(
                    text = hint,
                    fontSize = 13.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        }
    }
}

/** ISO-8601 timestamp for the backup's exportedAt (mirrors new Date().toISOString()). */
private fun nowIso(): String =
    if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
        OffsetDateTime.now().toString()
    } else {
        SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss'Z'", Locale.US).format(Date())
    }

/** Default suggested file name: troca-figurinhas-<yyyy-MM-dd>.json (mirrors the PWA download name). */
private fun defaultBackupName(): String {
    val date = SimpleDateFormat("yyyy-MM-dd", Locale.US).format(Date())
    return "troca-figurinhas-$date.json"
}
