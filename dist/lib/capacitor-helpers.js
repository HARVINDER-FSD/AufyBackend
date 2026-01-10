"use strict";
// Capacitor Native Features Helper
// Easy-to-use functions for native device features
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CapacitorHelpers = exports.getPlatform = exports.isNative = void 0;
exports.takePhoto = takePhoto;
exports.pickPhoto = pickPhoto;
exports.hapticLight = hapticLight;
exports.hapticMedium = hapticMedium;
exports.hapticHeavy = hapticHeavy;
exports.shareContent = shareContent;
exports.setStatusBarLight = setStatusBarLight;
exports.setStatusBarDark = setStatusBarDark;
exports.hideStatusBar = hideStatusBar;
exports.showStatusBar = showStatusBar;
exports.hideKeyboard = hideKeyboard;
exports.getNetworkStatus = getNetworkStatus;
exports.onAppStateChange = onAppStateChange;
exports.requestNotificationPermissions = requestNotificationPermissions;
exports.onPushNotificationReceived = onPushNotificationReceived;
exports.saveFile = saveFile;
exports.readFile = readFile;
exports.hideSplashScreen = hideSplashScreen;
const core_1 = require("@capacitor/core");
// Check if running as native app
const isNative = () => {
    return core_1.Capacitor.isNativePlatform();
};
exports.isNative = isNative;
// Check platform
const getPlatform = () => {
    return core_1.Capacitor.getPlatform(); // 'ios', 'android', or 'web'
};
exports.getPlatform = getPlatform;
// Camera
function takePhoto() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)()) {
            console.warn('Camera only available in native app');
            return null;
        }
        try {
            const { Camera } = yield Promise.resolve().then(() => __importStar(require('@capacitor/camera')));
            const photo = yield Camera.getPhoto({
                quality: 90,
                allowEditing: true,
                resultType: 'uri',
                source: 'camera'
            });
            return photo.webPath;
        }
        catch (error) {
            console.error('Camera error:', error);
            return null;
        }
    });
}
function pickPhoto() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)()) {
            console.warn('Photo picker only available in native app');
            return null;
        }
        try {
            const { Camera } = yield Promise.resolve().then(() => __importStar(require('@capacitor/camera')));
            const photo = yield Camera.getPhoto({
                quality: 90,
                allowEditing: true,
                resultType: 'uri',
                source: 'photos'
            });
            return photo.webPath;
        }
        catch (error) {
            console.error('Photo picker error:', error);
            return null;
        }
    });
}
// Haptics
function hapticLight() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)())
            return;
        try {
            const { Haptics, ImpactStyle } = yield Promise.resolve().then(() => __importStar(require('@capacitor/haptics')));
            yield Haptics.impact({ style: ImpactStyle.Light });
        }
        catch (error) {
            console.error('Haptics error:', error);
        }
    });
}
function hapticMedium() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)())
            return;
        try {
            const { Haptics, ImpactStyle } = yield Promise.resolve().then(() => __importStar(require('@capacitor/haptics')));
            yield Haptics.impact({ style: ImpactStyle.Medium });
        }
        catch (error) {
            console.error('Haptics error:', error);
        }
    });
}
function hapticHeavy() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)())
            return;
        try {
            const { Haptics, ImpactStyle } = yield Promise.resolve().then(() => __importStar(require('@capacitor/haptics')));
            yield Haptics.impact({ style: ImpactStyle.Heavy });
        }
        catch (error) {
            console.error('Haptics error:', error);
        }
    });
}
// Share
function shareContent(title, text, url) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)()) {
            // Fallback to Web Share API
            if (navigator.share) {
                try {
                    yield navigator.share({ title, text, url });
                    return true;
                }
                catch (error) {
                    console.error('Share error:', error);
                    return false;
                }
            }
            console.warn('Share not available');
            return false;
        }
        try {
            const { Share } = yield Promise.resolve().then(() => __importStar(require('@capacitor/share')));
            yield Share.share({ title, text, url });
            return true;
        }
        catch (error) {
            console.error('Share error:', error);
            return false;
        }
    });
}
// Status Bar
function setStatusBarLight() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)())
            return;
        try {
            const { StatusBar, Style } = yield Promise.resolve().then(() => __importStar(require('@capacitor/status-bar')));
            yield StatusBar.setStyle({ style: Style.Light });
        }
        catch (error) {
            console.error('Status bar error:', error);
        }
    });
}
function setStatusBarDark() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)())
            return;
        try {
            const { StatusBar, Style } = yield Promise.resolve().then(() => __importStar(require('@capacitor/status-bar')));
            yield StatusBar.setStyle({ style: Style.Dark });
        }
        catch (error) {
            console.error('Status bar error:', error);
        }
    });
}
function hideStatusBar() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)())
            return;
        try {
            const { StatusBar } = yield Promise.resolve().then(() => __importStar(require('@capacitor/status-bar')));
            yield StatusBar.hide();
        }
        catch (error) {
            console.error('Status bar error:', error);
        }
    });
}
function showStatusBar() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)())
            return;
        try {
            const { StatusBar } = yield Promise.resolve().then(() => __importStar(require('@capacitor/status-bar')));
            yield StatusBar.show();
        }
        catch (error) {
            console.error('Status bar error:', error);
        }
    });
}
// Keyboard
function hideKeyboard() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)())
            return;
        try {
            const { Keyboard } = yield Promise.resolve().then(() => __importStar(require('@capacitor/keyboard')));
            yield Keyboard.hide();
        }
        catch (error) {
            console.error('Keyboard error:', error);
        }
    });
}
// Network
function getNetworkStatus() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)()) {
            return { connected: navigator.onLine, connectionType: 'unknown' };
        }
        try {
            const { Network } = yield Promise.resolve().then(() => __importStar(require('@capacitor/network')));
            const status = yield Network.getStatus();
            return status;
        }
        catch (error) {
            console.error('Network error:', error);
            return { connected: true, connectionType: 'unknown' };
        }
    });
}
// App State
function onAppStateChange(callback) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)())
            return () => { };
        try {
            const { App } = yield Promise.resolve().then(() => __importStar(require('@capacitor/app')));
            const listener = yield App.addListener('appStateChange', ({ isActive }) => {
                callback(isActive);
            });
            return () => listener.remove();
        }
        catch (error) {
            console.error('App state error:', error);
            return () => { };
        }
    });
}
// Push Notifications
function requestNotificationPermissions() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)()) {
            console.warn('Push notifications only available in native app');
            return false;
        }
        try {
            const { PushNotifications } = yield Promise.resolve().then(() => __importStar(require('@capacitor/push-notifications')));
            const result = yield PushNotifications.requestPermissions();
            if (result.receive === 'granted') {
                yield PushNotifications.register();
                return true;
            }
            return false;
        }
        catch (error) {
            console.error('Notification permission error:', error);
            return false;
        }
    });
}
function onPushNotificationReceived(callback) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)())
            return () => { };
        try {
            const { PushNotifications } = yield Promise.resolve().then(() => __importStar(require('@capacitor/push-notifications')));
            const listener = yield PushNotifications.addListener('pushNotificationReceived', callback);
            return () => listener.remove();
        }
        catch (error) {
            console.error('Notification listener error:', error);
            return () => { };
        }
    });
}
// Filesystem
function saveFile(filename, data) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)()) {
            console.warn('Filesystem only available in native app');
            return false;
        }
        try {
            const { Filesystem, Directory } = yield Promise.resolve().then(() => __importStar(require('@capacitor/filesystem')));
            yield Filesystem.writeFile({
                path: filename,
                data: data,
                directory: Directory.Documents
            });
            return true;
        }
        catch (error) {
            console.error('Filesystem error:', error);
            return false;
        }
    });
}
function readFile(filename) {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)()) {
            console.warn('Filesystem only available in native app');
            return null;
        }
        try {
            const { Filesystem, Directory } = yield Promise.resolve().then(() => __importStar(require('@capacitor/filesystem')));
            const result = yield Filesystem.readFile({
                path: filename,
                directory: Directory.Documents
            });
            return result.data;
        }
        catch (error) {
            console.error('Filesystem error:', error);
            return null;
        }
    });
}
// Splash Screen
function hideSplashScreen() {
    return __awaiter(this, void 0, void 0, function* () {
        if (!(0, exports.isNative)())
            return;
        try {
            const { SplashScreen } = yield Promise.resolve().then(() => __importStar(require('@capacitor/splash-screen')));
            yield SplashScreen.hide();
        }
        catch (error) {
            console.error('Splash screen error:', error);
        }
    });
}
// Export all
exports.CapacitorHelpers = {
    isNative: exports.isNative,
    getPlatform: exports.getPlatform,
    takePhoto,
    pickPhoto,
    hapticLight,
    hapticMedium,
    hapticHeavy,
    shareContent,
    setStatusBarLight,
    setStatusBarDark,
    hideStatusBar,
    showStatusBar,
    hideKeyboard,
    getNetworkStatus,
    onAppStateChange,
    requestNotificationPermissions,
    onPushNotificationReceived,
    saveFile,
    readFile,
    hideSplashScreen
};
