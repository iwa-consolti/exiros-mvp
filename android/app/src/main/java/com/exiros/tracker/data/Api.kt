package com.exiros.tracker.data

import com.exiros.tracker.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/** Destino del catálogo (para el dropdown de M2). */
data class Destination(val id: String, val name: String)

/** Respuesta de POST /api/mobile/trips. */
data class TripResult(val tripId: String, val tripToken: String, val status: String)

private val JSON = "application/json".toMediaType()

/** Cliente HTTP del espacio mobile (X-App-Key). Una instancia, reutilizable. */
class ApiClient {
    private val client = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(20, TimeUnit.SECONDS)
        .build()

    private val base = BuildConfig.API_BASE_URL

    /** GET catálogo activo de destinos. */
    suspend fun fetchDestinations(): List<Destination> = withContext(Dispatchers.IO) {
        val req = Request.Builder()
            .url("$base/api/mobile/destinations")
            .header("x-app-key", BuildConfig.APP_KEY)
            .get()
            .build()
        client.newCall(req).execute().use { res ->
            val body = res.body?.string().orEmpty()
            if (!res.isSuccessful) error("destinos HTTP ${res.code}: $body")
            val arr = JSONArray(body)
            (0 until arr.length()).map { i ->
                val o = arr.getJSONObject(i)
                Destination(o.getString("id"), o.getString("name"))
            }
        }
    }

    /** POST multipart: 7 campos + foto. Devuelve el viaje creado o lanza con el detalle. */
    suspend fun createTrip(
        providerNumber: String,
        providerName: String,
        folio: String,
        frontPlate: String,
        rearPlate: String?,
        destinationId: String,
        deviceId: String,
        clientRequestId: String,
        photoBytes: ByteArray,
        photoFilename: String,
        photoMime: String,
    ): TripResult = withContext(Dispatchers.IO) {
        val builder = MultipartBody.Builder().setType(MultipartBody.FORM)
            .addFormDataPart("providerNumber", providerNumber)
            .addFormDataPart("providerName", providerName)
            .addFormDataPart("folio", folio)
            .addFormDataPart("frontPlate", frontPlate)
            .addFormDataPart("destinationId", destinationId)
            .addFormDataPart("deviceId", deviceId)
            .addFormDataPart("clientRequestId", clientRequestId)
            .addFormDataPart(
                "photo",
                photoFilename,
                photoBytes.toRequestBody(photoMime.toMediaType()),
            )
        if (!rearPlate.isNullOrBlank()) builder.addFormDataPart("rearPlate", rearPlate)

        val req = Request.Builder()
            .url("$base/api/mobile/trips")
            .header("x-app-key", BuildConfig.APP_KEY)
            .post(builder.build())
            .build()

        client.newCall(req).execute().use { res ->
            val body = res.body?.string().orEmpty()
            if (!res.isSuccessful) error("trip HTTP ${res.code}: $body")
            val o = JSONObject(body)
            TripResult(
                tripId = o.getString("tripId"),
                tripToken = o.getString("tripToken"),
                status = o.getString("status"),
            )
        }
    }

    /**
     * Bala trazadora (Slice 0): manda 1 punto al viaje usando el tripToken (Bearer).
     * 3.4 reemplazará esto por envío por lotes GZIP con idempotencia.
     */
    suspend fun sendLocation(
        tripId: String,
        tripToken: String,
        lat: Double,
        lng: Double,
        accuracyMeters: Double,
    ): Unit = withContext(Dispatchers.IO) {
        val payload = JSONObject()
            .put("lat", lat)
            .put("lng", lng)
            .put("accuracyMeters", accuracyMeters)
            .put("recordedAt", java.time.Instant.now().toString())
            .toString()
        val req = Request.Builder()
            .url("$base/api/mobile/trips/$tripId/locations")
            .header("Authorization", "Bearer $tripToken")
            .post(payload.toRequestBody(JSON))
            .build()
        client.newCall(req).execute().use { res ->
            val body = res.body?.string().orEmpty()
            if (!res.isSuccessful) error("location HTTP ${res.code}: $body")
        }
    }
}
