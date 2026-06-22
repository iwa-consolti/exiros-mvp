package com.exiros.tracker

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.compose.setContent
import androidx.activity.result.PickVisualMediaRequest
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import com.exiros.tracker.data.ApiClient
import com.exiros.tracker.data.Destination
import com.exiros.tracker.data.DeviceId
import kotlinx.coroutines.launch
import java.util.UUID

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContent {
            MaterialTheme {
                Surface(modifier = Modifier.fillMaxSize()) {
                    TripFormScreen()
                }
            }
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun TripFormScreen() {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val api = remember { ApiClient() }
    val deviceId = remember { DeviceId.get(context) }

    // Campos del formulario (M2). Sembrados con ejemplo solo en debug.
    var providerNumber by remember { mutableStateOf(if (BuildConfig.DEBUG) "PRV-001" else "") }
    var providerName by remember { mutableStateOf(if (BuildConfig.DEBUG) "Chatarras del Norte SA" else "") }
    var folio by remember { mutableStateOf(if (BuildConfig.DEBUG) "FOL-${(1000..9999).random()}" else "") }
    var frontPlate by remember { mutableStateOf(if (BuildConfig.DEBUG) "ABC-1234" else "") }
    var rearPlate by remember { mutableStateOf(if (BuildConfig.DEBUG) "XYZ-9876" else "") }

    var destinations by remember { mutableStateOf<List<Destination>>(emptyList()) }
    var selected by remember { mutableStateOf<Destination?>(null) }
    var dropdownOpen by remember { mutableStateOf(false) }

    var photoUri by remember { mutableStateOf<Uri?>(null) }
    var photoBytes by remember { mutableStateOf<ByteArray?>(null) }
    var photoMime by remember { mutableStateOf("image/jpeg") }

    var clientRequestId by remember { mutableStateOf(UUID.randomUUID().toString()) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var lastTrip by remember { mutableStateOf<com.exiros.tracker.data.TripResult?>(null) }

    val photoPicker = rememberLauncherForActivityResult(
        ActivityResultContracts.PickVisualMedia()
    ) { uri ->
        if (uri != null) {
            photoUri = uri
            photoMime = context.contentResolver.getType(uri) ?: "image/jpeg"
            photoBytes = context.contentResolver.openInputStream(uri)?.use { it.readBytes() }
        }
    }

    // Cargar destinos al entrar; en debug, preseleccionar y cargar foto de muestra.
    LaunchedEffect(Unit) {
        runCatching { api.fetchDestinations() }
            .onSuccess { list ->
                destinations = list
                if (BuildConfig.DEBUG) selected = list.firstOrNull()
            }
            .onFailure { message = "No se pudieron cargar destinos: ${it.message}" }
        if (BuildConfig.DEBUG && photoBytes == null) {
            runCatching {
                context.resources.openRawResource(R.raw.sample_truck).use { it.readBytes() }
            }.onSuccess { photoBytes = it; photoMime = "image/jpeg" }
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Text("Iniciar viaje", style = MaterialTheme.typography.headlineSmall)

        OutlinedTextField(
            value = providerNumber, onValueChange = { providerNumber = it },
            label = { Text("Número de proveedor") },
            singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = providerName, onValueChange = { providerName = it },
            label = { Text("Nombre de proveedor") },
            singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = folio, onValueChange = { folio = it },
            label = { Text("Folio") },
            singleLine = true, modifier = Modifier.fillMaxWidth(),
        )
        OutlinedTextField(
            value = frontPlate, onValueChange = { frontPlate = it.uppercase() },
            label = { Text("Placa delantera") },
            singleLine = true, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
        )
        OutlinedTextField(
            value = rearPlate, onValueChange = { rearPlate = it.uppercase() },
            label = { Text("Placa trasera (opcional)") },
            singleLine = true, modifier = Modifier.fillMaxWidth(),
            keyboardOptions = KeyboardOptions(capitalization = KeyboardCapitalization.Characters),
        )

        // Dropdown de destinos
        ExposedDropdownMenuBox(
            expanded = dropdownOpen,
            onExpandedChange = { dropdownOpen = !dropdownOpen },
        ) {
            OutlinedTextField(
                value = selected?.name ?: "",
                onValueChange = {},
                readOnly = true,
                label = { Text("Destino") },
                trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = dropdownOpen) },
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

        Button(
            onClick = {
                photoPicker.launch(
                    PickVisualMediaRequest(ActivityResultContracts.PickVisualMedia.ImageOnly)
                )
            },
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (photoBytes != null) "Foto lista ✓ (cambiar)" else "Tomar / elegir foto")
        }

        Button(
            onClick = {
                val photo = photoBytes
                when {
                    providerNumber.isBlank() || providerName.isBlank() ||
                        folio.isBlank() || frontPlate.isBlank() ->
                        message = "Completa los campos obligatorios"
                    selected == null -> message = "Elige un destino"
                    photo == null -> message = "Falta la foto de carga"
                    else -> {
                        busy = true
                        message = null
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
                                    photoFilename = "carga.jpg",
                                    photoMime = photoMime,
                                )
                            }.onSuccess { res ->
                                lastTrip = res
                                message = "Viaje creado ✓ ${res.status} (id ${res.tripId.take(8)}…)"
                                clientRequestId = UUID.randomUUID().toString()
                            }.onFailure {
                                message = "Error: ${it.message}"
                            }
                            busy = false
                        }
                    }
                }
            },
            enabled = !busy,
            modifier = Modifier.fillMaxWidth(),
        ) {
            Text(if (busy) "Enviando…" else "Iniciar viaje")
        }

        // Bala trazadora (Slice 0): tras crear el viaje, manda 1 coord hardcodeada.
        lastTrip?.let { trip ->
            Button(
                onClick = {
                    busy = true
                    scope.launch {
                        runCatching {
                            api.sendLocation(
                                tripId = trip.tripId,
                                tripToken = trip.tripToken,
                                lat = 25.6700,
                                lng = -100.3000,
                                accuracyMeters = 12.0,
                            )
                        }.onSuccess {
                            message = "Ubicación enviada ✓ (25.6700, -100.3000)"
                        }.onFailure {
                            message = "Error al enviar ubicación: ${it.message}"
                        }
                        busy = false
                    }
                },
                enabled = !busy,
                modifier = Modifier.fillMaxWidth(),
            ) {
                Text("Enviar ubicación de prueba (bala trazadora)")
            }
        }

        message?.let { Text(it, style = MaterialTheme.typography.bodyMedium) }
    }
}
