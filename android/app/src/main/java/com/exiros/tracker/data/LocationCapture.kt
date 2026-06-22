package com.exiros.tracker.data

import android.annotation.SuppressLint
import android.content.Context
import android.location.Location
import android.os.Looper
import com.google.android.gms.location.CurrentLocationRequest
import com.google.android.gms.location.LocationCallback
import com.google.android.gms.location.LocationRequest
import com.google.android.gms.location.LocationResult
import com.google.android.gms.location.LocationServices
import com.google.android.gms.location.Priority

/** Un fix de ubicación fusionado (GPS+WiFi+celular). */
data class Fix(val lat: Double, val lng: Double, val accuracyMeters: Double, val recordedAt: Long)

/** Cadencia de captura: cada cuánto pedir fix y cuánto debe moverse el camión para registrar uno. */
data class CaptureConfig(val intervalMs: Long, val minDistanceMeters: Float)

/**
 * Captura con FusedLocation. Desde 3.2 vive dentro del [com.exiros.tracker.service.TrackingService]
 * (sobrevive en 2º plano). HIGH_ACCURACY usa el GPS (lo que el emulador alimenta con `geo fix`).
 * El `minUpdateDistanceMeters` (distance filter) evita acumular puntos con el camión detenido.
 */
class LocationCapture(context: Context) {
    private val client = LocationServices.getFusedLocationProviderClient(context)
    private var callback: LocationCallback? = null

    @SuppressLint("MissingPermission")
    fun start(config: CaptureConfig, onFix: (Fix) -> Unit) {
        stop() // re-suscribe con la nueva config (p.ej. al entrar/salir de hibernación)
        val request = LocationRequest.Builder(Priority.PRIORITY_HIGH_ACCURACY, config.intervalMs)
            .setMinUpdateIntervalMillis(config.intervalMs)
            .setMinUpdateDistanceMeters(config.minDistanceMeters)
            .build()
        val cb = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { emit(it, onFix) }
            }
        }
        callback = cb
        client.requestLocationUpdates(request, cb, Looper.getMainLooper())

        // Semilla: primer fix inmediato (la suscripción periódica puede tardar el 1er ciclo).
        val current = CurrentLocationRequest.Builder()
            .setPriority(Priority.PRIORITY_HIGH_ACCURACY)
            .build()
        client.getCurrentLocation(current, null).addOnSuccessListener { loc ->
            if (loc != null && callback != null) emit(loc, onFix)
        }
    }

    private fun emit(loc: Location, onFix: (Fix) -> Unit) {
        onFix(
            Fix(
                lat = loc.latitude,
                lng = loc.longitude,
                accuracyMeters = if (loc.hasAccuracy()) loc.accuracy.toDouble() else DEFAULT_ACCURACY,
                recordedAt = if (loc.time > 0) loc.time else System.currentTimeMillis(),
            ),
        )
    }

    fun stop() {
        callback?.let { client.removeLocationUpdates(it) }
        callback = null
    }

    companion object {
        const val DEFAULT_ACCURACY = 9999.0
        // Camión en marcha: fix frecuente, registra si se movió ≥25 m.
        val MOVING = CaptureConfig(intervalMs = 5_000L, minDistanceMeters = 25f)
        // Hibernación (detenido): fix espaciado para ahorrar batería.
        val HIBERNATING = CaptureConfig(intervalMs = 60_000L, minDistanceMeters = 50f)
    }
}
