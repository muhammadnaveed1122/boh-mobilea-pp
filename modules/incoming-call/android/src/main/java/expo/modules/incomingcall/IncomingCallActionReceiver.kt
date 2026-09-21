package expo.modules.incomingcall

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Decline button target. Runs even when the app process is dead: cancels the
 * notification (which stops the insistent ring/vibration) and re-broadcasts a
 * package-internal forward that the module's runtime receiver turns into an
 * `onDecline` JS event when a runtime is alive (so SIP can reject the INVITE).
 *
 * Deliberately does NOT start any activity — Android 12+ blocks activity
 * launches from notification-triggered receivers (trampoline restriction).
 */
class IncomingCallActionReceiver : BroadcastReceiver() {
  override fun onReceive(context: Context, intent: Intent) {
    if (intent.action != IncomingCallNotifier.ACTION_DECLINE) return
    val uuid = intent.getStringExtra(IncomingCallNotifier.EXTRA_UUID) ?: return

    IncomingCallNotifier.cancel(context, uuid)

    context.sendBroadcast(
      Intent(IncomingCallNotifier.ACTION_DECLINE_FORWARD)
        .setPackage(context.packageName)
        .putExtra(IncomingCallNotifier.EXTRA_UUID, uuid),
    )
  }
}
