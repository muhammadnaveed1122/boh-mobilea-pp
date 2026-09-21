package expo.modules.incomingcall

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * JS binding for the incoming-call ring. The actual notification (CallStyle,
 * full-screen, insistent ringtone) lives in [IncomingCallNotifier] so it can be
 * posted from a bare Context — this module is the warm/JS-alive entry point; the
 * cold-killed entry point is [IncomingCallFirebaseMessagingService].
 *
 * WhatsApp/Telegram-grade incoming-call notification, built on the platform
 * `Notification.CallStyle` (Android 12+; androidx renders equivalent action
 * buttons on older versions). What JS libraries (notifee & co.) cannot do today:
 *
 *  - CallStyle ranks as a REAL call: top of the shade, big Answer/Decline
 *    buttons, shown on the always-on display, not swipe-dismissable.
 *  - `FLAG_INSISTENT` loops the ringtone + vibration until resolved.
 *  - `fullScreenIntent` takes over the screen when the device is locked /
 *    screen off (MainActivity has showWhenLocked + turnScreenOn).
 *
 * Answer = PendingIntent.getActivity launching MainActivity DIRECTLY with
 * answer extras (Android 12+ forbids activity launches from notification
 * broadcast receivers — "notification trampolines"). A warm activity receives
 * it via OnNewIntent → `onAnswer` event; a cold start reads-and-clears the
 * extras via `consumeAnswerIntent()` once JS boots.
 *
 * Decline = broadcast to [IncomingCallActionReceiver]: cancels the
 * notification (kills the ring) and, if a JS runtime is alive, forwards an
 * `onDecline` event so SIP can reject. From a killed app there is no SIP
 * session to reject — the device just goes quiet and the caller times out.
 *
 * The ring sound is the app's res/raw/incoming_call (bundled by the
 * expo-notifications config plugin from assets/sounds/incoming_call.wav).
 */
class IncomingCallModule : Module() {
  private var declineForwarder: BroadcastReceiver? = null

  private val context: Context
    get() = requireNotNull(appContext.reactContext)

  override fun definition() = ModuleDefinition {
    Name("IncomingCall")

    Events(EVENT_ANSWER, EVENT_DECLINE)

    OnCreate {
      val forwarder = object : BroadcastReceiver() {
        override fun onReceive(ctx: Context?, intent: Intent?) {
          val uuid = intent?.getStringExtra(IncomingCallNotifier.EXTRA_UUID) ?: return
          sendEvent(EVENT_DECLINE, mapOf("uuid" to uuid))
        }
      }
      val filter = IntentFilter(IncomingCallNotifier.ACTION_DECLINE_FORWARD)
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        context.registerReceiver(forwarder, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        context.registerReceiver(forwarder, filter)
      }
      declineForwarder = forwarder
    }

    OnDestroy {
      declineForwarder?.let { runCatching { context.unregisterReceiver(it) } }
      declineForwarder = null
    }

    // Answer pressed while the activity is already alive (foregrounded or
    // backgrounded): MainActivity is singleTask, so the launch lands here.
    OnNewIntent { intent ->
      val uuid = consumeAnswerExtra(intent)
      if (uuid != null) sendEvent(EVENT_ANSWER, mapOf("uuid" to uuid))
    }

    // Live USE_FULL_SCREEN_INTENT grant state. Android 14+ (API 34) gates this
    // permission behind a user toggle in Settings; below 34 it is granted at
    // install, so report true. Lets JS avoid re-prompting a user who already
    // granted it (the AsyncStorage "prompted once" flag alone can't tell).
    Function("canUseFullScreenIntent") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.UPSIDE_DOWN_CAKE) return@Function true
      val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.canUseFullScreenIntent()
    }

    AsyncFunction("show") { uuid: String, callerName: String, handle: String ->
      IncomingCallNotifier.show(context, uuid, callerName, handle)
    }

    AsyncFunction("cancel") { uuid: String ->
      IncomingCallNotifier.cancel(context, uuid)
    }

    // When a call ends, if MainActivity is only showing because it was launched
    // OVER the lock screen for that call (showWhenLocked), send it to the back so
    // the device returns to the lock screen instead of stranding the user on the
    // app's home screen. No-op when the device is unlocked (user is genuinely in
    // the app). Returns true if the app was sent to the background.
    Function("moveToBackIfLocked") {
      val activity = appContext.currentActivity ?: return@Function false
      val locked = IncomingCallNotifier.isKeyguardLocked(context)
      if (locked) activity.moveTaskToBack(true)
      locked
    }

    // Cold-start path: the Answer action launched MainActivity before any JS
    // runtime existed. Read-and-clear the extras once the app boots; returns
    // the call uuid or null.
    Function("consumeAnswerIntent") {
      val intent = appContext.currentActivity?.intent ?: return@Function null
      consumeAnswerExtra(intent)
    }

    // Cold-start path for the full-screen / body-tap launch (locked-screen
    // takeover): MainActivity was launched by the incoming-call notification
    // itself, NOT by the Answer button. Read-and-clear the caller extras so JS
    // can show the ringing call screen immediately (and skip the splash) instead
    // of booting to home and waiting for the SIP INVITE. Returns null when this
    // launch was not an incoming-call launch.
    Function("consumeIncomingLaunch") {
      val intent = appContext.currentActivity?.intent ?: return@Function null
      val uuid = intent.getStringExtra(IncomingCallNotifier.EXTRA_INCOMING_UUID)
        ?: return@Function null
      val name = intent.getStringExtra(IncomingCallNotifier.EXTRA_INCOMING_NAME)
      val handle = intent.getStringExtra(IncomingCallNotifier.EXTRA_INCOMING_HANDLE)
      intent.removeExtra(IncomingCallNotifier.EXTRA_INCOMING_UUID)
      intent.removeExtra(IncomingCallNotifier.EXTRA_INCOMING_NAME)
      intent.removeExtra(IncomingCallNotifier.EXTRA_INCOMING_HANDLE)
      mapOf("uuid" to uuid, "name" to name, "handle" to handle)
    }
  }

  /** Read-and-clear so a re-mount/re-check never replays the same answer. */
  private fun consumeAnswerExtra(intent: Intent): String? {
    val uuid = intent.getStringExtra(IncomingCallNotifier.EXTRA_ANSWER_UUID) ?: return null
    intent.removeExtra(IncomingCallNotifier.EXTRA_ANSWER_UUID)
    return uuid
  }

  companion object {
    const val EVENT_ANSWER = "onAnswer"
    const val EVENT_DECLINE = "onDecline"
  }
}
