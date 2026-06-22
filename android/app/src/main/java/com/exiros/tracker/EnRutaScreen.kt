package com.exiros.tracker

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.exiros.tracker.data.ActiveTripEntity
import com.exiros.tracker.data.TripRepository
import com.exiros.tracker.sync.SyncScheduler
import com.exiros.tracker.ui.BorderGray
import com.exiros.tracker.ui.ExirosBlue
import com.exiros.tracker.ui.ExirosError
import com.exiros.tracker.ui.ExirosNavy
import com.exiros.tracker.ui.Success
import com.exiros.tracker.ui.SurfaceWhite
import com.exiros.tracker.ui.TextPrimary
import com.exiros.tracker.ui.TextSecondary
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

private val cardShape = RoundedCornerShape(14.dp)
private val timeFmt = SimpleDateFormat("HH:mm:ss", Locale.getDefault())

/**
 * M3 "En ruta": estado restaurado desde Room. Mientras está visible y con permiso de
 * ubicación, captura fixes con FusedLocation y los encola. La supervivencia en 2º plano
 * (Foreground Service) es 3.2; el envío real de la cola es 3.3.
 */
@Composable
fun EnRutaScreen(
    trip: ActiveTripEntity,
    repo: TripRepository,
    hasLocationPermission: Boolean,
    onRequestPermission: () -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()

    val pointCount by repo.locationCount(trip.tripId).collectAsState(initial = 0)
    val lastPoint by repo.lastLocation(trip.tripId).collectAsState(initial = null)
    var note by remember { mutableStateOf<String?>(null) }

    // La captura ya no vive aquí: la hace TrackingService (3.2), que sobrevive en 2º plano.
    // Esta pantalla solo observa Room.

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        ExirosWordmark()

        // Chip de estado
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(
                modifier = Modifier
                    .size(10.dp)
                    .background(Success, CircleShape),
            )
            Spacer(Modifier.width(8.dp))
            Text("En ruta", color = ExirosNavy, fontSize = 20.sp, fontWeight = FontWeight.Bold)
        }

        // Datos del viaje (snapshot persistido)
        Surface(shape = cardShape, color = SurfaceWhite, border = BorderStroke(1.dp, BorderGray)) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                InfoRow("Proveedor", trip.providerName)
                InfoRow("Folio", trip.folio)
                InfoRow("Destino", trip.destinationName)
                InfoRow("Radio geocerca", "${trip.radiusMeters.toInt()} m")
            }
        }

        // Banner de permiso si falta
        if (!hasLocationPermission) {
            Surface(
                shape = cardShape,
                color = Color(0xFFFFF4F4),
                border = BorderStroke(1.dp, ExirosError),
            ) {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text(
                        "Falta permiso de ubicación: sin él no se rastrea la ruta.",
                        color = ExirosError,
                        fontSize = 14.sp,
                    )
                    Button(
                        onClick = onRequestPermission,
                        shape = cardShape,
                        colors = ButtonDefaults.buttonColors(containerColor = ExirosBlue),
                    ) { Text("Permitir ubicación") }
                }
            }
        }

        // Métricas de captura
        Surface(shape = cardShape, color = SurfaceWhite, border = BorderStroke(1.dp, BorderGray)) {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("Puntos en cola", color = TextSecondary, fontSize = 13.sp)
                Text("$pointCount", color = ExirosBlue, fontSize = 34.sp, fontWeight = FontWeight.Bold)
                val last = lastPoint
                if (last != null) {
                    Text(
                        "Último: ${"%.5f".format(last.lat)}, ${"%.5f".format(last.lng)}",
                        color = TextPrimary,
                        fontSize = 13.sp,
                    )
                    Text(
                        "±${last.accuracyMeters.toInt()} m · ${timeFmt.format(Date(last.recordedAt))}",
                        color = TextSecondary,
                        fontSize = 12.sp,
                    )
                } else if (hasLocationPermission) {
                    Text("Esperando el primer fix de ubicación…", color = TextSecondary, fontSize = 13.sp)
                }
            }
        }

        if (hasLocationPermission) {
            Text(
                "El rastreo sigue activo aunque cierres la app o apagues la pantalla.",
                color = TextSecondary,
                fontSize = 12.sp,
            )
        }

        // Afordancias de DEBUG: forzar el sync real (WorkManager) y reset local de prueba.
        if (BuildConfig.DEBUG) {
            OutlinedButton(
                onClick = {
                    SyncScheduler.syncNow(context)
                    note = "Sync encolado (WorkManager enviará el lote GZIP)"
                },
                shape = cardShape,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Sincronizar ahora (debug)") }

            OutlinedButton(
                onClick = { scope.launch { repo.endTrip() } },
                shape = cardShape,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Olvidar viaje — solo local (debug)") }
        }

        note?.let { Text(it, color = TextSecondary, fontSize = 13.sp) }
        Spacer(Modifier.height(4.dp))
    }
}

@Composable
private fun InfoRow(label: String, value: String) {
    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
        Text(label, color = TextSecondary, fontSize = 13.sp)
        Text(value, color = TextPrimary, fontSize = 14.sp, fontWeight = FontWeight.Medium)
    }
}
