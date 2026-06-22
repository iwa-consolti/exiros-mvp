package com.exiros.tracker.service

import android.annotation.SuppressLint
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.google.android.gms.location.ActivityRecognition
import com.google.android.gms.location.ActivityTransition
import com.google.android.gms.location.ActivityTransitionRequest
import com.google.android.gms.location.ActivityTransitionResult
import com.google.android.gms.location.DetectedActivity

/**
 * Recibe transiciones de actividad y traduce "detenido (STILL)" ↔ "en marcha" en una orden de
 * hibernación para [TrackingService]. ⚠️ En emulador no hay sensores reales → estas transiciones
 * normalmente NO se disparan; el código es correcto pero su efecto solo se ve en un teléfono real.
 */
class ActivityTransitionReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (!ActivityTransitionResult.hasResult(intent)) return
        val result = ActivityTransitionResult.extractResult(intent) ?: return
        // El último evento manda: ¿el camión quedó detenido o en movimiento?
        val last = result.transitionEvents.lastOrNull() ?: return
        val still = last.activityType == DetectedActivity.STILL &&
            last.transitionType == ActivityTransition.ACTIVITY_TRANSITION_ENTER
        context.startService(
            Intent(context, TrackingService::class.java)
                .setAction(TrackingService.ACTION_ACTIVITY_UPDATE)
                .putExtra(TrackingService.EXTRA_STILL, still),
        )
    }

    companion object {
        private const val TAG = "ActivityTransition"
        private var pendingIntent: PendingIntent? = null

        /** Empieza a escuchar transiciones entre detenido y en marcha (requiere ACTIVITY_RECOGNITION). */
        @SuppressLint("MissingPermission")
        fun register(context: Context) {
            val transitions = listOf(
                transition(DetectedActivity.STILL, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
                transition(DetectedActivity.STILL, ActivityTransition.ACTIVITY_TRANSITION_EXIT),
                transition(DetectedActivity.IN_VEHICLE, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
                transition(DetectedActivity.ON_FOOT, ActivityTransition.ACTIVITY_TRANSITION_ENTER),
            )
            val pi = pendingIntent ?: PendingIntent.getBroadcast(
                context,
                0,
                Intent(context, ActivityTransitionReceiver::class.java),
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_MUTABLE,
            ).also { pendingIntent = it }
            runCatching {
                ActivityRecognition.getClient(context)
                    .requestActivityTransitionUpdates(ActivityTransitionRequest(transitions), pi)
            }.onFailure { Log.w(TAG, "No se pudieron registrar transiciones: ${it.message}") }
        }

        @SuppressLint("MissingPermission")
        fun unregister(context: Context) {
            val pi = pendingIntent ?: return
            runCatching { ActivityRecognition.getClient(context).removeActivityTransitionUpdates(pi) }
            pi.cancel()
            pendingIntent = null
        }

        private fun transition(activity: Int, type: Int) = ActivityTransition.Builder()
            .setActivityType(activity)
            .setActivityTransition(type)
            .build()
    }
}
