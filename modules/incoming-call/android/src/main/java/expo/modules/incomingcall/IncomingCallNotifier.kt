package expo.modules.incomingcall

import android.app.KeyguardManager
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import android.os.SystemClock
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person

/**
 * The CallStyle ringing notification, decoupled from the Expo module so it can be
 * posted from EITHER path:
 *
 *  - JS (warm/backgrounded app) via [IncomingCallModule].show — the SIP/audio
 *    runtime is already booting, this is just the UI.
 *  - Native (cold-killed app) via [IncomingCallFirebaseMessagingService] — rings
 *    in ~tens of ms straight off the FCM data push, WITHOUT waiting for the React
 *    Native runtime + JS bundle to boot. JS still boots in parallel (RNFirebase's
 *    own headless task) to handle the SIP INVITE; see calling-coldstart-ring-latency.md.
 *
 * Everything here works from a bare [Context] — no react context, no JS. That is
 * the whole point: a killed-app ring must not wait on the JS bundle.
 *
 * Double-show guard: on a cold-killed call BOTH paths fire (native service +
 * RNFirebase headless JS a beat later). [show] dedupes by uuid within a short
 * window so the second call is a no-op and does not restart the insistent ring.
 */
object IncomingCallNotifier {
  const val ACTION_DECLINE = "expo.modules.incomingcall.DECLINE"
  const val ACTION_DECLINE_FORWARD = "expo.modules.incomingcall.DECLINE_FORWARD"
  const val EXTRA_UUID = "uuid"
  const val EXTRA_ANSWER_UUID = "incoming_call_answer_uuid"
  const val EXTRA_INCOMING_UUID = "incoming_call_launch_uuid"
  const val EXTRA_INCOMING_NAME = "incoming_call_launch_name"
  const val EXTRA_INCOMING_HANDLE = "incoming_call_launch_handle"
  const val CHANNEL_ID = "incoming-calls-v3"
  const val RING_SOUND_RES = "incoming_call"
  const val RING_TIMEOUT_MS = 60_000L

  private const val TAG = "IncomingCallNotifier"

  /** uuid -> uptimeMillis of its last show(), to dedupe the native+JS double-show. */
  private val recentShows = HashMap<String, Long>()
  private const val DEDUPE_WINDOW_MS = 5_000L

  /** Stable int id from the call uuid (NotificationManager needs an int). */
  fun notificationId(uuid: String): Int = uuid.hashCode()

  /**
   * Post (or refresh) the ringing notification. Idempotent within
   * [DEDUPE_WINDOW_MS] for a given uuid so the native path and the JS path do not
   * fight over the same insistent ring.
   */
  @Synchronized
  fun show(context: Context, uuid: String, callerName: String, handle: String) {
    val now = SystemClock.uptimeMillis()
    val last = recentShows[uuid]
    if (last != null && now - last < DEDUPE_WINDOW_MS) {
      Log.d(TAG, "show($uuid) deduped — shown ${now - last}ms ago")
      return
    }
    recentShows[uuid] = now
    pruneRecent(now)

    ensureChannel(context)
    val id = notificationId(uuid)
    val piFlags = PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE

    // Body tap / locked-screen full-screen takeover: open the app WITH the caller
    // extras so a cold-started JS runtime shows the ringing call screen immediately
    // (and skips the splash) instead of landing on home and waiting for the SIP
    // INVITE.
    val openIntent = launchIntent(context)
      .putExtra(EXTRA_INCOMING_UUID, uuid)
      .putExtra(EXTRA_INCOMING_NAME, callerName)
      .putExtra(EXTRA_INCOMING_HANDLE, handle)
    val openPi = PendingIntent.getActivity(context, id, openIntent, piFlags)

    val answerIntent = launchIntent(context).putExtra(EXTRA_ANSWER_UUID, uuid)
    val answerPi = PendingIntent.getActivity(context, id + 1, answerIntent, piFlags)

    val declineIntent = Intent(context, IncomingCallActionReceiver::class.java)
      .setAction(ACTION_DECLINE)
      .putExtra(EXTRA_UUID, uuid)
    val declinePi = PendingIntent.getBroadcast(context, id + 2, declineIntent, piFlags)

    val caller = Person.Builder()
      .setName(callerName.ifBlank { "Incoming call" })
      .setImportant(true)
      .build()

    val notification = NotificationCompat.Builder(context, CHANNEL_ID)
      .setSmallIcon(smallIconRes(context))
      .setContentTitle(callerName.ifBlank { "Incoming call" })
      .setContentText(handle)
      .setCategory(NotificationCompat.CATEGORY_CALL)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setPriority(NotificationCompat.PRIORITY_MAX) // pre-O heads-up
      .setSound(ringSoundUri(context)) // pre-O; O+ uses the channel sound
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(false)
      .addPerson(caller)
      .setStyle(NotificationCompat.CallStyle.forIncomingCall(caller, declinePi, answerPi))
      .setFullScreenIntent(openPi, true)
      .setContentIntent(openPi)
      .setTimeoutAfter(RING_TIMEOUT_MS)
      .build()

    // Loop ringtone + vibration until answered/declined/cancelled/timeout.
    notification.flags = notification.flags or Notification.FLAG_INSISTENT

    NotificationManagerCompat.from(context).notify(id, notification)
    Log.d(TAG, "show($uuid) posted notification id=$id")
  }

  fun cancel(context: Context, uuid: String) {
    recentShows.remove(uuid)
    NotificationManagerCompat.from(context).cancel(notificationId(uuid))
    Log.d(TAG, "cancel($uuid)")
  }

  private fun pruneRecent(now: Long) {
    val it = recentShows.entries.iterator()
    while (it.hasNext()) {
      if (now - it.next().value > DEDUPE_WINDOW_MS) it.remove()
    }
  }

  private fun ringSoundUri(context: Context): Uri =
    Uri.parse("android.resource://${context.packageName}/raw/$RING_SOUND_RES")

  private fun ensureChannel(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    if (manager.getNotificationChannel(CHANNEL_ID) != null) return
    val channel = NotificationChannel(
      CHANNEL_ID,
      "Incoming calls",
      NotificationManager.IMPORTANCE_HIGH,
    ).apply {
      lockscreenVisibility = Notification.VISIBILITY_PUBLIC
      enableVibration(true)
      vibrationPattern = longArrayOf(0, 400, 600, 400, 600)
      setSound(
        ringSoundUri(context),
        AudioAttributes.Builder()
          .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
          .setContentType(AudioAttributes.CONTENT_TYPE_MUSIC)
          .build(),
      )
    }
    manager.createNotificationChannel(channel)
  }

  private fun launchIntent(context: Context): Intent {
    val intent = requireNotNull(
      context.packageManager.getLaunchIntentForPackage(context.packageName),
    ) { "No launch intent for ${context.packageName}" }
    return intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
  }

  /** expo-notifications' white status-bar glyph if present, else the app icon. */
  private fun smallIconRes(context: Context): Int {
    val custom = context.resources.getIdentifier(
      "notification_icon",
      "drawable",
      context.packageName,
    )
    return if (custom != 0) custom else context.applicationInfo.icon
  }

  /** Keyguard state — used by the module's moveToBackIfLocked. */
  fun isKeyguardLocked(context: Context): Boolean {
    val keyguard = context.getSystemService(Context.KEYGUARD_SERVICE) as? KeyguardManager
    return keyguard?.isKeyguardLocked == true
  }
}
