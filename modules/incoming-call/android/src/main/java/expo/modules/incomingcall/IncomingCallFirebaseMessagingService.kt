package expo.modules.incomingcall

import android.os.SystemClock
import android.util.Log
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage

/**
 * Cold-start ring, native-first. Rings the incoming-call UI DIRECTLY off the FCM
 * data push, without booting the React Native runtime + JS bundle — the slow
 * step that made a killed-app ring lag (see docs/calling/calling-coldstart-ring-latency.md).
 *
 * How this coexists with RNFirebase (the important bit):
 *
 *  - RNFirebase boots its headless JS task from its OWN c2dm broadcast receiver
 *    (`ReactNativeFirebaseMessagingReceiver`), NOT from a FirebaseMessagingService
 *    — its `MESSAGING_EVENT` service `onMessageReceived` is a documented no-op.
 *  - FCM dispatches a data message to exactly ONE `MESSAGING_EVENT` service, the
 *    highest-priority one. This service registers with a higher `android:priority`
 *    than RNFirebase's no-op service (see AndroidManifest), so THIS service wins
 *    and rings natively.
 *  - RNFirebase's independent receiver still fires and boots the JS headless task
 *    in parallel to handle the SIP INVITE + audio. The two paths do not compete.
 *
 * Both paths post the SAME notification (same uuid → same id); [IncomingCallNotifier]
 * dedupes by uuid so the later JS `show` does not restart the insistent ring.
 *
 * Timing logs (`[coldring]`) bracket the FCM→ring path so Step 0 of the doc — "is
 * the native fix even needed on a release build?" — can be measured on-device.
 */
class IncomingCallFirebaseMessagingService : FirebaseMessagingService() {
  override fun onMessageReceived(message: RemoteMessage) {
    val start = SystemClock.uptimeMillis()
    val data = message.data
    val type = data["type"]
    Log.d(TAG, "[coldring] onMessageReceived type=$type priority=${message.priority}")

    when (type) {
      "voip_incoming" -> {
        val uuid = data["uuid"].takeUnless { it.isNullOrBlank() } ?: run {
          Log.w(TAG, "[coldring] voip_incoming with no uuid — ignoring")
          return
        }
        val callerName = data["caller_name"].takeUnless { it.isNullOrBlank() } ?: "Incoming call"
        val handle = data["call_handle"].takeUnless { it.isNullOrBlank() } ?: "Incoming call"
        IncomingCallNotifier.show(applicationContext, uuid, callerName, handle)
        Log.d(TAG, "[coldring] ring posted in ${SystemClock.uptimeMillis() - start}ms uuid=$uuid")
      }

      "voip_cancel" -> {
        val uuid = data["uuid"]
        if (!uuid.isNullOrBlank()) IncomingCallNotifier.cancel(applicationContext, uuid)
        Log.d(TAG, "[coldring] voip_cancel handled uuid=$uuid")
      }

      // Not a call push — leave it to RNFirebase / the normal notifications path.
      else -> Log.d(TAG, "[coldring] non-call push ignored type=$type")
    }
  }

  companion object {
    private const val TAG = "IncomingCallFCM"
  }
}
