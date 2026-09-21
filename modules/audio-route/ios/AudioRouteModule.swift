import AVKit
import ExpoModulesCore

/// iOS audio-output control for the call screen.
///
/// InCallManager can only force the speaker on/off on iOS, and the system
/// `AVRoutePickerView` sheet changes the route without telling JS. That left JS
/// blind: when CallKit (`RNCallKeep configureAudioSession`) or the WebRTC audio
/// unit re-set the session category at connect time, the category change
/// cancelled the user's speaker/Bluetooth override and nothing could restore it.
///
/// This module closes the loop:
///   * `getRouteState` / `onAudioRouteChanged` — what the live route actually is,
///     plus the system's own reason for each change (`categoryChange` is the
///     reconfiguration that steals the route; `oldDeviceUnavailable` means the
///     hardware itself went away).
///   * `setRoute` — force earpiece / speaker / Bluetooth / wired from JS.
///   * `ensureCallCategory` — keep PlayAndRecord + Bluetooth options in place, so
///     a Bluetooth port stays eligible after another layer resets the category.
public class AudioRouteModule: Module {
  private var routeObserver: NSObjectProtocol?

  public func definition() -> ModuleDefinition {
    Name("AudioRoutePicker")

    Events("onAudioRouteChanged")

    // Route state crosses the bridge as a JSON string — one primitive type, no
    // dictionary-conversion surprises in either direction.
    Function("getRouteState") { () -> String in
      AudioRouteModule.routeStateJson(reason: "poll")
    }

    // Force an output. Returns the resulting route state so the caller can see
    // immediately whether the request actually took.
    AsyncFunction("setRoute") { (route: String) -> String in
      AudioRouteModule.applyRoute(route)
      return AudioRouteModule.routeStateJson(reason: "after-setRoute")
    }

    // Re-assert the in-call category/options without changing the route.
    AsyncFunction("ensureCallCategory") { () -> String in
      AudioRouteModule.ensureCallCategory()
      return AudioRouteModule.routeStateJson(reason: "after-ensureCategory")
    }

    OnStartObserving {
      self.routeObserver = NotificationCenter.default.addObserver(
        forName: AVAudioSession.routeChangeNotification,
        object: nil,
        queue: nil
      ) { [weak self] notification in
        guard let self else { return }
        let rawReason =
          notification.userInfo?[AVAudioSessionRouteChangeReasonKey] as? UInt ?? 0
        self.sendEvent(
          "onAudioRouteChanged",
          ["json": AudioRouteModule.routeStateJson(reason: AudioRouteModule.reasonName(rawReason))]
        )
      }
    }

    OnStopObserving {
      if let observer = self.routeObserver {
        NotificationCenter.default.removeObserver(observer)
        self.routeObserver = nil
      }
    }

    View(AudioRoutePickerView.self) {
      Prop("tintColor") { (view: AudioRoutePickerView, color: UIColor?) in
        view.picker.tintColor = color
      }
      Prop("activeTintColor") { (view: AudioRoutePickerView, color: UIColor?) in
        view.picker.activeTintColor = color
      }
    }
  }

  // MARK: - route keys (must match the JS `AudioRoute` enum)

  private static let earpiece = "EARPIECE"
  private static let speaker = "SPEAKER_PHONE"
  private static let bluetooth = "BLUETOOTH"
  private static let wired = "WIRED_HEADSET"

  private static func routeStateJson(reason: String) -> String {
    let payload: [String: Any] = [
      "reason": reason,
      "selected": currentRoute(),
      "available": availableRoutes(),
    ]
    guard let data = try? JSONSerialization.data(withJSONObject: payload),
      let json = String(data: data, encoding: .utf8)
    else {
      return "{\"reason\":\"\(reason)\",\"selected\":\"\(earpiece)\",\"available\":[]}"
    }
    return json
  }

  private static func currentRoute() -> String {
    let session = AVAudioSession.sharedInstance()
    for output in session.currentRoute.outputs {
      switch output.portType {
      case .builtInSpeaker: return speaker
      case .builtInReceiver: return earpiece
      case .bluetoothHFP, .bluetoothA2DP, .bluetoothLE: return bluetooth
      case .headphones, .headsetMic, .usbAudio: return wired
      default: continue
      }
    }
    return earpiece
  }

  /// Earpiece + speaker always exist on a phone; Bluetooth / wired only when the
  /// hardware is connected. Inputs are the reliable signal for HFP headsets,
  /// outputs for listen-only devices (A2DP, plain headphones).
  private static func availableRoutes() -> [String] {
    let session = AVAudioSession.sharedInstance()
    var routes: [String] = [earpiece, speaker]
    func add(_ route: String) {
      if !routes.contains(route) { routes.append(route) }
    }
    for input in session.availableInputs ?? [] {
      switch input.portType {
      case .bluetoothHFP, .bluetoothLE: add(bluetooth)
      case .headsetMic, .usbAudio: add(wired)
      default: break
      }
    }
    for output in session.currentRoute.outputs {
      switch output.portType {
      case .bluetoothHFP, .bluetoothA2DP, .bluetoothLE: add(bluetooth)
      case .headphones, .headsetMic, .usbAudio: add(wired)
      default: break
      }
    }
    return routes
  }

  /// PlayAndRecord + VoiceChat with the Bluetooth options. Another layer
  /// (InCallManager `start()` sets options 0) can drop the Bluetooth options and
  /// make an HFP headset disappear from `availableInputs` entirely.
  private static func ensureCallCategory() {
    let session = AVAudioSession.sharedInstance()
    let wanted: AVAudioSession.CategoryOptions = [.allowBluetooth, .allowBluetoothA2DP]
    if session.category == .playAndRecord && session.categoryOptions.contains(wanted) {
      return
    }
    do {
      try session.setCategory(.playAndRecord, mode: .voiceChat, options: wanted)
    } catch {
      NSLog("[AudioRoute] ensureCallCategory failed: %@", error.localizedDescription)
    }
  }

  private static func applyRoute(_ route: String) {
    let session = AVAudioSession.sharedInstance()
    ensureCallCategory()
    do {
      if route == speaker {
        // A Bluetooth input keeps ownership of the route, so drop back to the
        // built-in mic before overriding the output to the loudspeaker.
        preferInput(port(of: [.builtInMic]))
        try session.overrideOutputAudioPort(.speaker)
      } else if route == bluetooth {
        try session.overrideOutputAudioPort(.none)
        preferInput(port(of: [.bluetoothHFP, .bluetoothLE]))
      } else if route == wired {
        try session.overrideOutputAudioPort(.none)
        preferInput(port(of: [.headsetMic, .usbAudio]))
      } else {
        try session.overrideOutputAudioPort(.none)
        preferInput(port(of: [.builtInMic]))
      }
    } catch {
      NSLog("[AudioRoute] setRoute(%@) failed: %@", route, error.localizedDescription)
    }
  }

  private static func preferInput(_ input: AVAudioSessionPortDescription?) {
    guard let input = input else { return }
    do {
      try AVAudioSession.sharedInstance().setPreferredInput(input)
    } catch {
      NSLog(
        "[AudioRoute] setPreferredInput(%@) failed: %@",
        input.portType.rawValue,
        error.localizedDescription
      )
    }
  }

  private static func port(of types: [AVAudioSession.Port]) -> AVAudioSessionPortDescription? {
    return AVAudioSession.sharedInstance().availableInputs?.first { types.contains($0.portType) }
  }

  /// Why the route changed. `categoryChange` / `override` means some layer
  /// reconfigured the session, possibly out from under the user's pick.
  private static func reasonName(_ raw: UInt) -> String {
    switch AVAudioSession.RouteChangeReason(rawValue: raw) {
    case .newDeviceAvailable: return "newDeviceAvailable"
    case .oldDeviceUnavailable: return "oldDeviceUnavailable"
    case .categoryChange: return "categoryChange"
    case .override: return "override"
    case .wakeFromSleep: return "wakeFromSleep"
    case .noSuitableRouteForCategory: return "noSuitableRouteForCategory"
    case .routeConfigurationChange: return "routeConfigurationChange"
    case .unknown: return "unknown"
    default: return "raw(\(raw))"
    }
  }
}

class AudioRoutePickerView: ExpoView {
  let picker = AVRoutePickerView()

  required init(appContext: AppContext? = nil) {
    super.init(appContext: appContext)
    // Audio call — do not bias the picker toward video/AirPlay screens.
    picker.prioritizesVideoDevices = false
    picker.translatesAutoresizingMaskIntoConstraints = false
    addSubview(picker)
    NSLayoutConstraint.activate([
      picker.leadingAnchor.constraint(equalTo: leadingAnchor),
      picker.trailingAnchor.constraint(equalTo: trailingAnchor),
      picker.topAnchor.constraint(equalTo: topAnchor),
      picker.bottomAnchor.constraint(equalTo: bottomAnchor),
    ])
  }
}
