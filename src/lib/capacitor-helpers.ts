// Capacitor Native Features Helper
// Easy-to-use functions for native device features

import { Capacitor } from '@capacitor/core'

// Check if running as native app
export const isNative = () => {
  return Capacitor.isNativePlatform()
}

// Check platform
export const getPlatform = () => {
  return Capacitor.getPlatform() // 'ios', 'android', or 'web'
}

// Camera
export async function takePhoto() {
  if (!isNative()) {
    console.warn('Camera only available in native app')
    return null
  }

  try {
    const { Camera } = await import('@capacitor/camera')
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: 'uri',
      source: 'camera'
    })
    return photo.webPath
  } catch (error) {
    console.error('Camera error:', error)
    return null
  }
}

export async function pickPhoto() {
  if (!isNative()) {
    console.warn('Photo picker only available in native app')
    return null
  }

  try {
    const { Camera } = await import('@capacitor/camera')
    const photo = await Camera.getPhoto({
      quality: 90,
      allowEditing: true,
      resultType: 'uri',
      source: 'photos'
    })
    return photo.webPath
  } catch (error) {
    console.error('Photo picker error:', error)
    return null
  }
}

// Haptics
export async function hapticLight() {
  if (!isNative()) return

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Light })
  } catch (error) {
    console.error('Haptics error:', error)
  }
}

export async function hapticMedium() {
  if (!isNative()) return

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Medium })
  } catch (error) {
    console.error('Haptics error:', error)
  }
}

export async function hapticHeavy() {
  if (!isNative()) return

  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics')
    await Haptics.impact({ style: ImpactStyle.Heavy })
  } catch (error) {
    console.error('Haptics error:', error)
  }
}

// Share
export async function shareContent(title: string, text: string, url?: string) {
  if (!isNative()) {
    // Fallback to Web Share API
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return true
      } catch (error) {
        console.error('Share error:', error)
        return false
      }
    }
    console.warn('Share not available')
    return false
  }

  try {
    const { Share } = await import('@capacitor/share')
    await Share.share({ title, text, url })
    return true
  } catch (error) {
    console.error('Share error:', error)
    return false
  }
}

// Status Bar
export async function setStatusBarLight() {
  if (!isNative()) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Light })
  } catch (error) {
    console.error('Status bar error:', error)
  }
}

export async function setStatusBarDark() {
  if (!isNative()) return

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar')
    await StatusBar.setStyle({ style: Style.Dark })
  } catch (error) {
    console.error('Status bar error:', error)
  }
}

export async function hideStatusBar() {
  if (!isNative()) return

  try {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.hide()
  } catch (error) {
    console.error('Status bar error:', error)
  }
}

export async function showStatusBar() {
  if (!isNative()) return

  try {
    const { StatusBar } = await import('@capacitor/status-bar')
    await StatusBar.show()
  } catch (error) {
    console.error('Status bar error:', error)
  }
}

// Keyboard
export async function hideKeyboard() {
  if (!isNative()) return

  try {
    const { Keyboard } = await import('@capacitor/keyboard')
    await Keyboard.hide()
  } catch (error) {
    console.error('Keyboard error:', error)
  }
}

// Network
export async function getNetworkStatus() {
  if (!isNative()) {
    return { connected: navigator.onLine, connectionType: 'unknown' }
  }

  try {
    const { Network } = await import('@capacitor/network')
    const status = await Network.getStatus()
    return status
  } catch (error) {
    console.error('Network error:', error)
    return { connected: true, connectionType: 'unknown' }
  }
}

// App State
export async function onAppStateChange(callback: (isActive: boolean) => void) {
  if (!isNative()) return () => {}

  try {
    const { App } = await import('@capacitor/app')
    const listener = await App.addListener('appStateChange', ({ isActive }) => {
      callback(isActive)
    })
    return () => listener.remove()
  } catch (error) {
    console.error('App state error:', error)
    return () => {}
  }
}

// Push Notifications
export async function requestNotificationPermissions() {
  if (!isNative()) {
    console.warn('Push notifications only available in native app')
    return false
  }

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const result = await PushNotifications.requestPermissions()
    
    if (result.receive === 'granted') {
      await PushNotifications.register()
      return true
    }
    return false
  } catch (error) {
    console.error('Notification permission error:', error)
    return false
  }
}

export async function onPushNotificationReceived(callback: (notification: any) => void) {
  if (!isNative()) return () => {}

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const listener = await PushNotifications.addListener(
      'pushNotificationReceived',
      callback
    )
    return () => listener.remove()
  } catch (error) {
    console.error('Notification listener error:', error)
    return () => {}
  }
}

// Filesystem
export async function saveFile(filename: string, data: string) {
  if (!isNative()) {
    console.warn('Filesystem only available in native app')
    return false
  }

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    await Filesystem.writeFile({
      path: filename,
      data: data,
      directory: Directory.Documents
    })
    return true
  } catch (error) {
    console.error('Filesystem error:', error)
    return false
  }
}

export async function readFile(filename: string) {
  if (!isNative()) {
    console.warn('Filesystem only available in native app')
    return null
  }

  try {
    const { Filesystem, Directory } = await import('@capacitor/filesystem')
    const result = await Filesystem.readFile({
      path: filename,
      directory: Directory.Documents
    })
    return result.data
  } catch (error) {
    console.error('Filesystem error:', error)
    return null
  }
}

// Splash Screen
export async function hideSplashScreen() {
  if (!isNative()) return

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen')
    await SplashScreen.hide()
  } catch (error) {
    console.error('Splash screen error:', error)
  }
}

// Export all
export const CapacitorHelpers = {
  isNative,
  getPlatform,
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
}
