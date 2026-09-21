/**
 * `react-native-webrtc` ships untyped TypeScript sources (its `react-native`
 * entry points at `src/`), and `src/Logger.ts` imports the untyped `debug`
 * package. We import that Logger in `webrtc-bootstrap.ts` to mute the library's
 * `rn-webrtc:*:DEBUG` console spam, which drags `debug` into the type graph.
 * This shim covers only the surface `Logger.ts` touches — no dependency added.
 */
declare module 'debug' {
  const debug: debug.Debug;
  export = debug;

  namespace debug {
    interface Debug {
      (namespace: string): Debugger;
      enable(namespaces: string): void;
      disable(): string;
    }

    interface Debugger {
      (...args: unknown[]): void;
      log: (...args: unknown[]) => void;
    }
  }
}
