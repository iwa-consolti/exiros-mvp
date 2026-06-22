package com.exiros.tracker

import android.Manifest
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Image
import androidx.compose.material.icons.filled.PhotoCamera
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.core.content.ContextCompat
import com.exiros.tracker.data.ActiveTripEntity
import com.exiros.tracker.data.ApiClient
import com.exiros.tracker.data.Destination
import com.exiros.tracker.data.DeviceId
import com.exiros.tracker.data.TripRepository
import com.exiros.tracker.data.TripResult
import com.exiros.tracker.service.TrackingService
import com.exiros.tracker.ui.BorderGray
import com.exiros.tracker.ui.ExirosBlue
import com.exiros.tracker.ui.ExirosError
import com.exiros.tracker.ui.ExirosNavy
import com.exiros.tracker.ui.ExirosTheme
import com.exiros.tracker.ui.Success
import com.exiros.tracker.ui.SurfaceWhite
import com.exiros.tracker.ui.TextPrimary
import com.exiros.tracker.ui.TextSecondary
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import java.util.UUID

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        val repo = TripRepository(applicationContext)
        setContent {
            ExirosTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    RootScreen(repo)
                }
            }
        }
    }
}

/**
 * Decide M2 (formulario) vs M3 (en ruta) leyendo el viaje activo de Room. Si existe una fila,
 * la app restaura M3 directamente al abrir, aunque el proceso se haya reiniciado (criterio 3.1).
 */
@Composable
private fun RootScreen(repo: TripRepository) {
    val context = LocalContext.current

    // Estado del permiso de ubicación (FINE basta para captura en primer plano en 3.1).
    var hasLocationPermission by remember {
        mutableStateOf(
            ContextCompat.checkSelfPermission(context, Manifest.permission.ACCESS_FINE_LOCATION) ==
                PackageManager.PERMISSION_GRANTED,
        )
    }
    val permissionLauncher = rememberLauncherForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions(),
    ) { result ->
        hasLocationPermission = result[Manifest.permission.ACCESS_FINE_LOCATION] == true ||
            result[Manifest.permission.ACCESS_COARSE_LOCATION] == true
    }
    // Pedimos ubicación + notificación (la notificación fija del servicio) + reconocimiento de
    // actividad (hibernación). El sistema ignora las que no apliquen a la versión.
    fun requestLocation() = permissionLauncher.launch(
        buildList {
            add(Manifest.permission.ACCESS_FINE_LOCATION)
            add(Manifest.permission.ACCESS_COARSE_LOCATION)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                add(Manifest.permission.POST_NOTIFICATIONS)
            }
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                add(Manifest.permission.ACTIVITY_RECOGNITION)
            }
        }.toTypedArray(),
    )

    // Gate de carga: evita el parpadeo del formulario antes de que Room emita el viaje activo.
    val tripFlow = remember(repo) { repo.activeTrip.map<ActiveTripEntity?, TripLoad> { TripLoad.Ready(it) } }
    val tripState by tripFlow.collectAsState(initial = TripLoad.Loading)

    // Arranca/detiene el servicio de rastreo según haya viaje activo y permiso. Sobrevive en 2º
    // plano por sí mismo; aquí solo lo encendemos/apagamos al entrar/salir de "En ruta".
    val ready = tripState as? TripLoad.Ready
    val hasActiveTrip = ready?.trip != null
    val readyNoTrip = ready != null && ready.trip == null
    LaunchedEffect(hasActiveTrip, hasLocationPermission, readyNoTrip) {
        when {
            hasActiveTrip && hasLocationPermission -> TrackingService.start(context)
            readyNoTrip -> TrackingService.stop(context)
        }
    }

    when (val s = tripState) {
        TripLoad.Loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            CircularProgressIndicator(color = ExirosBlue)
        }
        is TripLoad.Ready -> {
            val active = s.trip
            if (active == null) {
                // Al crear el viaje en M2, persistimos en Room → la app navega sola a M3.
                TripFormScreen(
                    onTripStarted = { trip, dest, providerName, folio ->
                        repo.startTrip(trip, dest, providerName, folio)
                        if (!hasLocationPermission) requestLocation()
                    },
                )
            } else {
                EnRutaScreen(
                    trip = active,
                    repo = repo,
                    hasLocationPermission = hasLocationPermission,
                    onRequestPermission = ::requestLocation,
                )
            }
        }
    }
}

/** Estado de carga del viaje activo (separa "aún no sé" de "no hay viaje"). */
private sealed interface TripLoad {
    data object Loading : TripLoad
    data class Ready(val trip: ActiveTripEntity?) : TripLoad
}

private val fieldShape = RoundedCornerShape(11.dp)

/** Marca "exiros" con la x en azul primario (acento corporativo). */
@Composable
fun ExirosWordmark() {
    Text(
        buildAnnotatedString {
            withStyle(SpanStyle(color = ExirosNavy)) { append("e") }
            withStyle(SpanStyle(color = ExirosBlue)) { append("x") }
            withStyle(SpanStyle(color = ExirosNavy)) { append("iros") }
        },
        fontSize = 26.sp,
        fontWeight = FontWeight.Bold,
    )
}

@Composable
private fun LabeledField(
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    capitalize: Boolean = false,
) {
    Column(modifier = modifier) {
        Text(
            label,
            color = TextSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        OutlinedTextField(
            value = value,
            onValueChange = onValueChange,
            singleLine = true,
            shape = fieldShape,
            modifier = Modifier.fillMaxWidth(),
            colors = OutlinedTextFieldDefaults.colors(
                focusedContainerColor = SurfaceWhite,
                unfocusedContainerColor = SurfaceWhite,
                focusedBorderColor = ExirosBlue,
                unfocusedBorderColor = BorderGray,
            ),
            keyboardOptions = if (capitalize) {
                KeyboardOptions(capitalization = KeyboardCapitalization.Characters)
            } else {
                KeyboardOptions.Default
            },
        )
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TripFormScreen(
    onTripStarted: suspend (trip: TripResult, destination: Destination, providerName: String, folio: String) -> Unit,
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val api = remember { ApiClient() }
    val deviceId = remember { DeviceId.get(context) }

    var providerNumber by remember { mutableStateOf(if (BuildConfig.DEBUG) "48213" else "") }
    var providerName by remember { mutableStateOf(if (BuildConfig.DEBUG) "Transporte del Norte SA de CV" else "") }
    var folio by remember { mutableStateOf(if (BuildConfig.DEBUG) "100294" else "") }
    var frontPlate by remember { mutableStateOf(if (BuildConfig.DEBUG) "ABC-12-34" else "") }
    var rearPlate by remember { mutableStateOf("") }

    var destinations by remember { mutableStateOf<List<Destination>>(emptyList()) }
    var selected by remember { mutableStateOf<Destination?>(null) }
    var dropdownOpen by remember { mutableStateOf(false) }

    var photoName by remember { mutableStateOf<String?>(null) }
    var photoBytes by remember { mutableStateOf<ByteArray?>(null) }
    var photoMime by remember { mutableStateOf("image/jpeg") }

    var clientRequestId by remember { mutableStateOf(UUID.randomUUID().toString()) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var isError by remember { mutableStateOf(false) }

    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri: Uri? ->
        if (uri != null) {
            photoMime = context.contentResolver.getType(uri) ?: "image/jpeg"
            photoBytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
            photoName = "carga.jpg"
        }
    }

    LaunchedEffect(Unit) {
        runCatching { api.fetchDestinations() }
            .onSuccess { list ->
                destinations = list
                if (BuildConfig.DEBUG) selected = list.firstOrNull()
            }
            .onFailure { message = "No se pudieron cargar destinos: ${it.message}"; isError = true }
        if (BuildConfig.DEBUG && photoBytes == null) {
            runCatching {
                context.resources.openRawResource(R.raw.sample_truck).use { it.readBytes() }
            }.onSuccess { photoBytes = it; photoMime = "image/jpeg"; photoName = "carga_48213.jpg" }
        }
    }

    fun setMsg(text: String, error: Boolean) {
        message = text; isError = error
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(20.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
        // Header de marca
        ExirosWordmark()
        Text(
            "Iniciar viaje",
            color = TextSecondary,
            fontSize = 15.sp,
            modifier = Modifier.padding(top = 0.dp),
        )

        LabeledField("Núm. de Proveedor", providerNumber, { providerNumber = it })
        LabeledField("Nombre de Proveedor", providerName, { providerName = it })
        LabeledField("Folio / Remito", folio, { folio = it })

        // Placas en una fila (dos columnas)
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            LabeledField(
                "Placa Delantera", frontPlate, { frontPlate = it.uppercase() },
                modifier = Modifier.weight(1f), capitalize = true,
            )
            LabeledField(
                "Placa Trasera (opcional)", rearPlate, { rearPlate = it.uppercase() },
                modifier = Modifier.weight(1f), capitalize = true,
            )
        }

        // Caja de foto de la carga
        PhotoBox(
            photoName = photoName,
            onClick = {
                photoPicker.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                )
            },
        )

        // Destino (label arriba + dropdown)
        Column {
            Text(
                "Destino",
                color = TextSecondary,
                fontSize = 13.sp,
                fontWeight = FontWeight.Medium,
                modifier = Modifier.padding(bottom = 4.dp),
            )
            ExposedDropdownMenuBox(
                expanded = dropdownOpen,
                onExpandedChange = { dropdownOpen = !dropdownOpen },
            ) {
                OutlinedTextField(
                    value = selected?.name ?: "",
                    onValueChange = {},
                    readOnly = true,
                    placeholder = { Text("Selecciona un destino") },
                    shape = fieldShape,
                    trailingIcon = {
                        ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownOpen)
                    },
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedContainerColor = SurfaceWhite,
                        unfocusedContainerColor = SurfaceWhite,
                        focusedBorderColor = ExirosBlue,
                        unfocusedBorderColor = BorderGray,
                    ),
                    modifier = Modifier.menuAnchor().fillMaxWidth(),
                )
                ExposedDropdownMenu(
                    expanded = dropdownOpen,
                    onDismissRequest = { dropdownOpen = false },
                ) {
                    destinations.forEach { dest ->
                        DropdownMenuItem(
                            text = { Text(dest.name) },
                            onClick = { selected = dest; dropdownOpen = false },
                        )
                    }
                }
            }
        }

        // Botón primario
        Button(
            onClick = {
                val photo = photoBytes
                when {
                    providerNumber.isBlank() || providerName.isBlank() ||
                        folio.isBlank() || frontPlate.isBlank() ->
                        setMsg("Completa los campos obligatorios", true)
                    selected == null -> setMsg("Elige un destino", true)
                    photo == null -> setMsg("Falta la foto de carga", true)
                    else -> {
                        busy = true
                        setMsg("", false)
                        scope.launch {
                            runCatching {
                                api.createTrip(
                                    providerNumber = providerNumber.trim(),
                                    providerName = providerName.trim(),
                                    folio = folio.trim(),
                                    frontPlate = frontPlate.trim(),
                                    rearPlate = rearPlate.trim().ifBlank { null },
                                    destinationId = selected!!.id,
                                    deviceId = deviceId,
                                    clientRequestId = clientRequestId,
                                    photoBytes = photo,
                                    photoFilename = photoName ?: "carga.jpg",
                                    photoMime = photoMime,
                                )
                            }.onSuccess { res ->
                                setMsg("Viaje creado ✓ ${res.status}", false)
                                clientRequestId = UUID.randomUUID().toString()
                                // Persistir en Room → RootScreen navega a M3 automáticamente.
                                onTripStarted(res, selected!!, providerName.trim(), folio.trim())
                            }.onFailure {
                                setMsg("Error: ${it.message}", true)
                            }
                            busy = false
                        }
                    }
                }
            },
            enabled = !busy,
            shape = fieldShape,
            colors = ButtonDefaults.buttonColors(containerColor = ExirosBlue),
            modifier = Modifier
                .fillMaxWidth()
                .height(56.dp),
        ) {
            Icon(Icons.Filled.PlayArrow, contentDescription = null)
            Spacer(Modifier.width(8.dp))
            Text(if (busy) "Enviando…" else "Iniciar viaje", fontWeight = FontWeight.SemiBold)
        }

        message?.takeIf { it.isNotBlank() }?.let {
            Text(it, color = if (isError) ExirosError else Success, fontSize = 14.sp)
        }
    }
}

/** Caja "Foto de la Carga": borde verde + confirmación cuando hay foto (M2, S-04). */
@Composable
private fun PhotoBox(photoName: String?, onClick: () -> Unit) {
    val hasPhoto = photoName != null
    Column {
        Text(
            "Foto de la Carga",
            color = TextSecondary,
            fontSize = 13.sp,
            fontWeight = FontWeight.Medium,
            modifier = Modifier.padding(bottom = 4.dp),
        )
        Surface(
            shape = fieldShape,
            color = if (hasPhoto) Color(0xFFF0FAF3) else SurfaceWhite,
            border = BorderStroke(1.dp, if (hasPhoto) Success else BorderGray),
            modifier = Modifier
                .fillMaxWidth()
                .clickable(onClick = onClick),
        ) {
            Row(
                modifier = Modifier.padding(12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Box(
                    modifier = Modifier
                        .size(44.dp)
                        .background(Color(0xFFE5E9F0), RoundedCornerShape(8.dp)),
                    contentAlignment = Alignment.Center,
                ) {
                    Icon(
                        Icons.Filled.Image,
                        contentDescription = null,
                        tint = TextSecondary,
                    )
                }
                Column(modifier = Modifier.weight(1f)) {
                    if (hasPhoto) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Icon(
                                Icons.Filled.CheckCircle,
                                contentDescription = null,
                                tint = Success,
                                modifier = Modifier.size(18.dp),
                            )
                            Spacer(Modifier.width(6.dp))
                            Text("Foto agregada", color = Success, fontWeight = FontWeight.Medium)
                        }
                        Text(photoName!!, color = TextSecondary, fontSize = 12.sp)
                    } else {
                        Text("Toca para agregar la foto", color = TextPrimary)
                        Text("Obligatoria", color = TextSecondary, fontSize = 12.sp)
                    }
                }
                Icon(
                    Icons.Filled.PhotoCamera,
                    contentDescription = "Cambiar foto",
                    tint = ExirosBlue,
                )
            }
        }
    }
}
