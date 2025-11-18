// Capacitor Push Notifications & Local Notifications
import { PushNotifications, Token, PushNotificationSchema, ActionPerformed } from '@capacitor/push-notifications'
import { LocalNotifications } from '@capacitor/local-notifications'
import { Badge } from '@capacitor/badge'
import { Capacitor } from '@capacitor/core'

export interface NotificationPayload {
  title: string
  body: string
  data?: {
    type: 'message' | 'like' | 'comment' | 'follow'
    conversationId?: string
    postId?: string
    userId?: string
    [key: string]: any
  }
}

class CapacitorNotificationService {
  private isInitialized = false
  private fcmToken: string | null = null
  private unreadCount = 0

  // Check if running on native platform
  isNative(): boolean {
    return Capacitor.isNativePlatform()
  }

  // Initialize push notifications
  async initialize() {
    if (this.isInitialized) return
    if (!this.isNative()) {
      console.log('📱 Not on native platform, using web notifications')
      await this.initializeWebNotifications()
      return
    }

    try {
      // Request permission
      const permission = await PushNotifications.requestPermissions()
      
      if (permission.receive === 'granted') {
        await PushNotifications.register()
        console.log('✅ Push notifications registered')
      } else {
        console.warn('⚠️ Push notification permission denied')
      }

      // Listen for registration
      await PushNotifications.addListener('registration', (token: Token) => {
        this.fcmToken = token.value
        console.log('📱 FCM Token:', token.value)
        // Send token to your backend
        this.sendTokenToBackend(token.value)
      })

      // Listen for registration errors
      await PushNotifications.addListener('registrationError', (error: any) => {
        console.error('❌ Push notification registration error:', error)
      })

      // Listen for push notifications received
      await PushNotifications.addListener(
        'pushNotificationReceived',
        (notification: PushNotificationSchema) => {
          console.log('📨 Push notification received:', notification)
          this.handleNotificationReceived(notification)
        }
      )

      // Listen for notification actions
      await PushNotifications.addListener(
        'pushNotificationActionPerformed',
        (notification: ActionPerformed) => {
          console.log('👆 Notification action performed:', notification)
          this.handleNotificationAction(notification)
        }
      )

      // Initialize local notifications
      await LocalNotifications.requestPermissions()

      this.isInitialized = true
    } catch (error) {
      console.error('❌ Error initializing notifications:', error)
    }
  }

  // Initialize web notifications (fallback)
  async initializeWebNotifications() {
    if (!('Notification' in window)) {
      console.warn('⚠️ Browser does not support notifications')
      return
    }

    if (Notification.permission === 'default') {
      const permission = await Notification.requestPermission()
      console.log('🔔 Web notification permission:', permission)
    }
  }

  // Send FCM token to backend
  async sendTokenToBackend(token: string) {
    try {
      const response = await fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ fcmToken: token })
      })
      
      if (response.ok) {
        console.log('✅ FCM token registered with backend')
      }
    } catch (error) {
      console.error('❌ Error sending token to backend:', error)
    }
  }

  // Handle notification received (app in foreground)
  handleNotificationReceived(notification: PushNotificationSchema) {
    const { title, body, data } = notification

    // Show local notification
    this.showLocalNotification({
      title: title || 'New notification',
      body: body || '',
      data: data as any
    })

    // Update badge count
    if (data?.type === 'message') {
      this.incrementBadge()
    }

    // Trigger custom event for UI updates
    window.dispatchEvent(new CustomEvent('notification-received', {
      detail: { title, body, data }
    }))
  }

  // Handle notification action (user tapped notification)
  handleNotificationAction(action: ActionPerformed) {
    const { notification } = action
    const data = notification.data

    // Navigate based on notification type
    if (data?.type === 'message' && data?.conversationId) {
      window.location.href = `/messages?conversation=${data.conversationId}`
    } else if (data?.type === 'like' && data?.postId) {
      window.location.href = `/posts/${data.postId}`
    } else if (data?.type === 'comment' && data?.postId) {
      window.location.href = `/posts/${data.postId}`
    } else if (data?.type === 'follow' && data?.userId) {
      window.location.href = `/profile/${data.userId}`
    }

    // Clear badge when opening app
    this.clearBadge()
  }

  // Show local notification
  async showLocalNotification(payload: NotificationPayload) {
    try {
      if (this.isNative()) {
        await LocalNotifications.schedule({
          notifications: [
            {
              title: payload.title,
              body: payload.body,
              id: Date.now(),
              extra: payload.data,
              sound: 'default',
              smallIcon: 'ic_stat_icon_config_sample',
              iconColor: '#2dd4bf'
            }
          ]
        })
      } else {
        // Web notification
        if (Notification.permission === 'granted') {
          new Notification(payload.title, {
            body: payload.body,
            icon: '/anufy-icon.svg',
            badge: '/anufy-icon.svg',
            data: payload.data,
            tag: payload.data?.conversationId || 'notification'
          })
        }
      }
    } catch (error) {
      console.error('❌ Error showing local notification:', error)
    }
  }

  // Update badge count
  async setBadge(count: number) {
    this.unreadCount = count
    
    try {
      if (this.isNative()) {
        await Badge.set({ count })
      } else {
        // Web badge API
        if ('setAppBadge' in navigator) {
          await (navigator as any).setAppBadge(count)
        }
      }
    } catch (error) {
      console.error('❌ Error setting badge:', error)
    }
  }

  // Increment badge
  async incrementBadge() {
    await this.setBadge(this.unreadCount + 1)
  }

  // Clear badge
  async clearBadge() {
    await this.setBadge(0)
  }

  // Get current badge count
  getBadgeCount(): number {
    return this.unreadCount
  }

  // Get FCM token
  getToken(): string | null {
    return this.fcmToken
  }

  // Cleanup
  async cleanup() {
    if (this.isNative()) {
      await PushNotifications.removeAllListeners()
      await LocalNotifications.removeAllListeners()
    }
    this.isInitialized = false
  }
}

// Export singleton instance
export const notificationService = new CapacitorNotificationService()
