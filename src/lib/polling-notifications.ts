// Polling-based notifications (works on Vercel)
// This is a temporary solution until you set up WebSockets on a separate server

import { useEffect, useState } from 'react';

export function useNotificationPolling(userId: string | undefined, interval = 10000) {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const fetchNotifications = async () => {
      try {
        const token = localStorage.getItem('token') || 
                      document.cookie.split('; ').find(row => row.startsWith('client-token='))?.split('=')[1];
        
        if (!token) {
          // No token, skip silently
          return;
        }
        
        const response = await fetch('/api/notifications', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unread_count || 0);
        } else if (response.status === 401) {
          // Unauthorized, stop polling
          return;
        }
      } catch (error) {
        // Silently fail - don't spam console
      }
    };

    // Fetch immediately
    fetchNotifications();

    // Then poll every interval
    const intervalId = setInterval(fetchNotifications, interval);

    return () => clearInterval(intervalId);
  }, [userId, interval]);

  return { notifications, unreadCount };
}

export function useChatPolling(conversationId: string | undefined, interval = 3000) {
  const [messages, setMessages] = useState<any[]>([]);
  const [lastMessageId, setLastMessageId] = useState<string | null>(null);

  useEffect(() => {
    if (!conversationId) return;

    const fetchMessages = async () => {
      try {
        const token = localStorage.getItem('token') || 
                      document.cookie.split('; ').find(row => row.startsWith('client-token='))?.split('=')[1];
        
        const url = lastMessageId 
          ? `/api/messages/conversations/${conversationId}/messages?after=${lastMessageId}`
          : `/api/messages/conversations/${conversationId}/messages`;

        const response = await fetch(url, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(prev => [...prev, ...data.messages]);
            setLastMessageId(data.messages[data.messages.length - 1].id);
          }
        }
      } catch (error) {
        console.error('Failed to fetch messages:', error);
      }
    };

    // Fetch immediately
    fetchMessages();

    // Then poll every interval
    const intervalId = setInterval(fetchMessages, interval);

    return () => clearInterval(intervalId);
  }, [conversationId, lastMessageId, interval]);

  return { messages, setMessages };
}
