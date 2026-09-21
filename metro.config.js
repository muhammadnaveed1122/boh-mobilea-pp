const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs', 'cjs'];
config.resolver.unstable_enableSymlinks = true;

// react-native-webrtc@124 imports `event-target-shim/index`, but event-target-shim@6
// only lists `.`/`./es5`/`./umd` in its exports map — so package-exports resolution
// warns and falls back. Both subpaths resolve to the same module with the same named
// exports, so redirect the deep import to the package root to silence the warning.
const TSLIB_ESM = require.resolve('tslib/tslib.es6.js');

// echarts' ESM build does `import { __extends } from "tslib"`. Metro runs with package
// exports on but an empty condition list, so neither the `import` nor `module` condition
// in tslib's exports map matches and it falls through to `"default": "./tslib.js"` — the
// UMD build, which has no real ESM named exports. The helpers then come back undefined
// ("Cannot read property '__extends' of undefined") the moment a chart is imported.
// tslib.es6.js is the genuine ESM build with named exports; point at it directly.
const originalResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'event-target-shim/index') {
    return context.resolveRequest(context, 'event-target-shim', platform);
  }
  if (moduleName === 'tslib') {
    // Resolve to the file directly rather than via context.resolveRequest: echarts ships its
    // own nested tslib whose exports map does not list this subpath, so going through the
    // resolver logs an "not listed in the exports" warning on every bundle. The helpers are
    // identical across copies, so pointing every importer at the hoisted ESM build is safe.
    return { type: 'sourceFile', filePath: TSLIB_ESM };
  }
  return originalResolveRequest
    ? originalResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
