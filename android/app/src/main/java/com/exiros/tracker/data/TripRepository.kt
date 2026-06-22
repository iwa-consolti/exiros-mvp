package com.exiros.tracker.data

import android.content.Context
import kotlinx.coroutines.flow.Flow

/**
 * Única puerta a la persistencia local del viaje. La UI observa `activeTrip` (restaura M3
 * tras reinicio) y la captura de ubicación encola puntos vía [recordPoint].
 */
class TripRepository(context: Context) {
    private val dao = AppDatabase.get(context).tripDao()

    val activeTrip: Flow<ActiveTripEntity?> = dao.observeActiveTrip()

    /** Lectura puntual del viaje activo (la usa el servicio al arrancar). */
    suspend fun getActiveTrip(): ActiveTripEntity? = dao.getActiveTrip()

    fun locationCount(tripId: String): Flow<Int> = dao.observeLocationCount(tripId)

    fun lastLocation(tripId: String): Flow<LocationEntity?> = dao.observeLastLocation(tripId)

    /** Persiste el viaje recién creado y abre M3. El snapshot de geocerca viene del destino elegido. */
    suspend fun startTrip(
        trip: TripResult,
        destination: Destination,
        providerName: String,
        folio: String,
    ) {
        dao.upsertActiveTrip(
            ActiveTripEntity(
                tripId = trip.tripId,
                tripToken = trip.tripToken,
                status = trip.status,
                destinationName = destination.name,
                centerLat = destination.centerLat,
                centerLng = destination.centerLng,
                radiusMeters = destination.radiusMeters,
                providerName = providerName,
                folio = folio,
                createdAt = System.currentTimeMillis(),
            ),
        )
    }

    /** Encola un fix de FusedLocation. `sent=false` hasta que 3.3 lo suba por lotes. */
    suspend fun recordPoint(tripId: String, lat: Double, lng: Double, accuracyMeters: Double, recordedAt: Long) {
        dao.insertLocation(
            LocationEntity(
                tripId = tripId,
                lat = lat,
                lng = lng,
                accuracyMeters = accuracyMeters,
                recordedAt = recordedAt,
            ),
        )
    }

    suspend fun unsentLocations(tripId: String): List<LocationEntity> = dao.unsentLocations(tripId)

    suspend fun markSent(ids: List<Long>) = dao.markSent(ids)

    /** Cierra el viaje localmente (borra estado + permite volver a M2). El drenado real es 3.3+. */
    suspend fun endTrip() = dao.clearActiveTrip()
}
