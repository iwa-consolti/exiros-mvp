package com.exiros.tracker.sync

import android.content.Context
import android.util.Log
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.exiros.tracker.data.ApiClient
import com.exiros.tracker.data.TripRepository
import java.util.UUID

/**
 * Drena la cola de Room enviándola por lotes GZIP al backend (3.3 → 3.4). Lo dispara
 * WorkManager (periódico cada ~15 min + on-demand). El `batchId` se deriva de los ids de los
 * puntos → un reintento del MISMO lote produce el mismo batchId y el backend lo ignora
 * (idempotencia). Sólo marca `sent` tras un envío exitoso.
 */
class SyncWorker(context: Context, params: WorkerParameters) :
    CoroutineWorker(context, params) {

    override suspend fun doWork(): Result {
        val repo = TripRepository(applicationContext)
        val trip = repo.getActiveTrip() ?: return Result.success() // sin viaje, nada que enviar
        val pending = repo.unsentLocations(trip.tripId)
        if (pending.isEmpty()) return Result.success()

        // Idempotencia: batchId estable para el mismo conjunto de puntos (sobrevive a reintentos).
        val seed = "${trip.tripId}:" + pending.joinToString(",") { it.id.toString() }
        val batchId = UUID.nameUUIDFromBytes(seed.toByteArray()).toString()

        return try {
            ApiClient().sendBatch(trip.tripId, trip.tripToken, batchId, pending)
            repo.markSent(pending.map { it.id })
            Log.i(TAG, "Lote enviado: ${pending.size} puntos (batch $batchId)")
            Result.success()
        } catch (e: Exception) {
            Log.w(TAG, "Fallo al enviar lote, se reintentará: ${e.message}")
            Result.retry()
        }
    }

    private companion object {
        const val TAG = "SyncWorker"
    }
}
