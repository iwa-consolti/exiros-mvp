package com.exiros.tracker.service

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat
import androidx.core.content.ContextCompat
import com.exiros.tracker.BuildConfig
import com.exiros.tracker.MainActivity
import com.exiros.tracker.R
import com.exiros.tracker.data.CaptureConfig
import com.exiros.tracker.data.LocationCapture
import com.exiros.tracker.data.TripRepository
import com.exiros.tracker.sync.SyncScheduler
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.delay
import kotlinx.coroutines.isActive
import kotlinx.coroutines.launch

/**
 * Mantiene el rastreo vivo con la app en 2º plano o la pantalla apagada (Foreground Service
 * tipado `location`, Android 14). Aloja [LocationCapture] (antes vivía en la pantalla M3) y
 * escribe cada fix en Room. Cambia entre cadencia normal e hibernación según las transiciones
 * de actividad que le manda [ActivityTransitionReceiver].
 */
class TrackingService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private lateinit var repo: TripRepository
    private lateinit var capture: LocationCapture

    private var tripId: String? = null
    private var hibernating = false

    override fun onCreate() {
        super.onCreate()
        repo = TripRepository(applicationContext)
        capture = LocationCapture(applicationContext)
        createChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_STOP -> {
                stopTracking()
                return START_NOT_STICKY
            }
            ACTION_ACTIVITY_UPDATE -> {
                applyHibernation(intent.getBooleanExtra(EXTRA_STILL, false))
                return START_STICKY
            }
        }

        // ACTION_START o reinicio del sistema (intent nulo con START_STICKY).
        // Android 14 exige startForeground en los primeros segundos, ANTES de cualquier espera.
        startForegroundNow(getString(R.string.tracking_starting))
        ActivityTransitionReceiver.register(this)
        SyncScheduler.schedulePeriodic(this) // envío por lotes cada ~15 min mientras dure el viaje
        startDebugSyncLoop() // en debug, sube cada 30 s para poder ver el movimiento en pruebas
        startCapture()
        return START_STICKY
    }

    /** Lee el viaje activo y arranca la captura. Si ya no hay viaje, se detiene. */
    private fun startCapture() {
        scope.launch {
            val trip = repo.getActiveTrip()
            if (trip == null) {
                stopTracking()
                return@launch
            }
            tripId = trip.tripId
            updateNotification(getString(R.string.tracking_active, trip.destinationName))
            capture.start(if (hibernating) LocationCapture.HIBERNATING else LocationCapture.MOVING) { fix ->
                val id = tripId ?: return@start
                scope.launch {
                    repo.recordPoint(id, fix.lat, fix.lng, fix.accuracyMeters, fix.recordedAt)
                }
            }
        }
    }

    /** Solo DEBUG: fuerza un sync cada 30 s para ver el camión moverse en pruebas. En release
     *  manda el WorkManager periódico (15 min). */
    private fun startDebugSyncLoop() {
        if (!BuildConfig.DEBUG) return
        scope.launch {
            while (isActive) {
                delay(DEBUG_SYNC_MS)
                SyncScheduler.syncNow(this@TrackingService)
            }
        }
    }

    /** Cambia la cadencia según el camión esté detenido (STILL) o en marcha. */
    private fun applyHibernation(still: Boolean) {
        if (still == hibernating) return
        hibernating = still
        val id = tripId ?: return
        val config: CaptureConfig =
            if (still) LocationCapture.HIBERNATING else LocationCapture.MOVING
        capture.start(config) { fix ->
            scope.launch { repo.recordPoint(id, fix.lat, fix.lng, fix.accuracyMeters, fix.recordedAt) }
        }
        val trip = getString(R.string.tracking_active_state, if (still) "detenido" else "en marcha")
        updateNotification(trip)
    }

    private fun stopTracking() {
        capture.stop()
        ActivityTransitionReceiver.unregister(this)
        SyncScheduler.cancel(this)
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    override fun onDestroy() {
        capture.stop()
        ActivityTransitionReceiver.unregister(this)
        scope.cancel()
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // --- Notificación ---

    private fun startForegroundNow(text: String) {
        val type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION
        } else {
            0
        }
        ServiceCompat.startForeground(this, NOTIF_ID, buildNotification(text), type)
    }

    private fun updateNotification(text: String) {
        val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification(text))
    }

    private fun buildNotification(text: String): Notification {
        val open = PendingIntent.getActivity(
            this,
            0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_IMMUTABLE,
        )
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle(getString(R.string.tracking_title))
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation)
            .setOngoing(true)
            .setContentIntent(open)
            .setForegroundServiceBehavior(NotificationCompat.FOREGROUND_SERVICE_IMMEDIATE)
            .build()
    }

    private fun createChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                getString(R.string.tracking_channel),
                NotificationManager.IMPORTANCE_LOW,
            )
            val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            nm.createNotificationChannel(channel)
        }
    }

    companion object {
        private const val CHANNEL_ID = "tracking"
        private const val NOTIF_ID = 1
        private const val DEBUG_SYNC_MS = 30_000L // solo debug: sube cada 30 s en pruebas

        const val ACTION_START = "com.exiros.tracker.START"
        const val ACTION_STOP = "com.exiros.tracker.STOP"
        const val ACTION_ACTIVITY_UPDATE = "com.exiros.tracker.ACTIVITY_UPDATE"
        const val EXTRA_STILL = "still"

        fun start(context: Context) {
            val intent = Intent(context, TrackingService::class.java).setAction(ACTION_START)
            ContextCompat.startForegroundService(context, intent)
        }

        fun stop(context: Context) {
            val intent = Intent(context, TrackingService::class.java).setAction(ACTION_STOP)
            context.startService(intent)
        }
    }
}
