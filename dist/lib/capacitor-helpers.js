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
async function takePhoto() {
    if (!(0, exports.isNative)()) {
        console.warn('Camera only available in native app');
        return null;
    }
    try {
        const { Camera } = await Promise.resolve().then(() => __importStar(require('@capacitor/camera')));
        const photo = await Camera.getPhoto({
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
}
async function pickPhoto() {
    if (!(0, exports.isNative)()) {
        console.warn('Photo picker only available in native app');
        return null;
    }
    try {
        const { Camera } = await Promise.resolve().then(() => __importStar(require('@capacitor/camera')));
        const photo = await Camera.getPhoto({
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
}
// Haptics
async function hapticLight() {
    if (!(0, exports.isNative)())
        return;
    try {
        const { Haptics, ImpactStyle } = await Promise.resolve().then(() => __importStar(require('@capacitor/haptics')));
        await Haptics.impact({ style: ImpactStyle.Light });
    }
    catch (error) {
        console.error('Haptics error:', error);
    }
}
async function hapticMedium() {
    if (!(0, exports.isNative)())
        return;
    try {
        const { Haptics, ImpactStyle } = await Promise.resolve().then(() => __importStar(require('@capacitor/haptics')));
        await Haptics.impact({ style: ImpactStyle.Medium });
    }
    catch (error) {
        console.error('Haptics error:', error);
    }
}
async function hapticHeavy() {
    if (!(0, exports.isNative)())
        return;
    try {
        const { Haptics, ImpactStyle } = await Promise.resolve().then(() => __importStar(require('@capacitor/haptics')));
        await Haptics.impact({ style: ImpactStyle.Heavy });
    }
    catch (error) {
        console.error('Haptics error:', error);
    }
}
// Share
async function shareContent(title, text, url) {
    if (!(0, exports.isNative)()) {
        // Fallback to Web Share API
        if (navigator.share) {
            try {
                await navigator.share({ title, text, url });
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
        const { Share } = await Promise.resolve().then(() => __importStar(require('@capacitor/share')));
        await Share.share({ title, text, url });
        return true;
    }
    catch (error) {
        console.error('Share error:', error);
        return false;
    }
}
// Status Bar
async function setStatusBarLight() {
    if (!(0, exports.isNative)())
        return;
    try {
        const { StatusBar, Style } = await Promise.resolve().then(() => __importStar(require('@capacitor/status-bar')));
        await StatusBar.setStyle({ style: Style.Light });
    }
    catch (error) {
        console.error('Status bar error:', error);
    }
}
async function setStatusBarDark() {
    if (!(0, exports.isNative)())
        return;
    try {
        const { StatusBar, Style } = await Promise.resolve().then(() => __importStar(require('@capacitor/status-bar')));
        await StatusBar.setStyle({ style: Style.Dark });
    }
    catch (error) {
        console.error('Status bar error:', error);
    }
}
async function hideStatusBar() {
    if (!(0, exports.isNative)())
        return;
    try {
        const { StatusBar } = await Promise.resolve().then(() => __importStar(require('@capacitor/status-bar')));
        await StatusBar.hide();
    }
    catch (error) {
        console.error('Status bar error:', error);
    }
}
async function showStatusBar() {
    if (!(0, exports.isNative)())
        return;
    try {
        const { StatusBar } = await Promise.resolve().then(() => __importStar(require('@capacitor/status-bar')));
        await StatusBar.show();
    }
    catch (error) {
        console.error('Status bar error:', error);
    }
}
// Keyboard
async function hideKeyboard() {
    if (!(0, exports.isNative)())
        return;
    try {
        const { Keyboard } = await Promise.resolve().then(() => __importStar(require('@capacitor/keyboard')));
        await Keyboard.hide();
    }
    catch (error) {
        console.error('Keyboard error:', error);
    }
}
// Network
async function getNetworkStatus() {
    if (!(0, exports.isNative)()) {
        return { connected: navigator.onLine, connectionType: 'unknown' };
    }
    try {
        const { Network } = await Promise.resolve().then(() => __importStar(require('@capacitor/network')));
        const status = await Network.getStatus();
        return status;
    }
    catch (error) {
        console.error('Network error:', error);
        return { connected: true, connectionType: 'unknown' };
    }
}
// App State
async function onAppStateChange(callback) {
    if (!(0, exports.isNative)())
        return () => { };
    try {
        const { App } = await Promise.resolve().then(() => __importStar(require('@capacitor/app')));
        const listener = await App.addListener('appStateChange', ({ isActive }) => {
            callback(isActive);
        });
        return () => listener.remove();
    }
    catch (error) {
        console.error('App state error:', error);
        return () => { };
    }
}
// Push Notifications
async function requestNotificationPermissions() {
    if (!(0, exports.isNative)()) {
        console.warn('Push notifications only available in native app');
        return false;
    }
    try {
        const { PushNotifications } = await Promise.resolve().then(() => __importStar(require('@capacitor/push-notifications')));
        const result = await PushNotifications.requestPermissions();
        if (result.receive === 'granted') {
            await PushNotifications.register();
            return true;
        }
        return false;
    }
    catch (error) {
        console.error('Notification permission error:', error);
        return false;
    }
}
async function onPushNotificationReceived(callback) {
    if (!(0, exports.isNative)())
        return () => { };
    try {
        const { PushNotifications } = await Promise.resolve().then(() => __importStar(require('@capacitor/push-notifications')));
        const listener = await PushNotifications.addListener('pushNotificationReceived', callback);
        return () => listener.remove();
    }
    catch (error) {
        console.error('Notification listener error:', error);
        return () => { };
    }
}
// Filesystem
async function saveFile(filename, data) {
    if (!(0, exports.isNative)()) {
        console.warn('Filesystem only available in native app');
        return false;
    }
    try {
        const { Filesystem, Directory } = await Promise.resolve().then(() => __importStar(require('@capacitor/filesystem')));
        await Filesystem.writeFile({
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
}
async function readFile(filename) {
    if (!(0, exports.isNative)()) {
        console.warn('Filesystem only available in native app');
        return null;
    }
    try {
        const { Filesystem, Directory } = await Promise.resolve().then(() => __importStar(require('@capacitor/filesystem')));
        const result = await Filesystem.readFile({
            path: filename,
            directory: Directory.Documents
        });
        return result.data;
    }
    catch (error) {
        console.error('Filesystem error:', error);
        return null;
    }
}
// Splash Screen
async function hideSplashScreen() {
    if (!(0, exports.isNative)())
        return;
    try {
        const { SplashScreen } = await Promise.resolve().then(() => __importStar(require('@capacitor/splash-screen')));
        await SplashScreen.hide();
    }
    catch (error) {
        console.error('Splash screen error:', error);
    }
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
