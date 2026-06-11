import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Announcement } from '@/types';

// ---------------------------------------------------------------------------
// ANNOUNCEMENT PUSH NOTIFICATIONS
//
// This hook does three things:
//   1. Asks for notification permission and registers an Expo push token
//      (the value your backend would store and use to send pushes via the
//      Expo Push API: https://docs.expo.dev/push-notifications/overview/)
//   2. Configures how notifications are displayed while the app is open
//   3. Watches the announcements list and fires a *local* notification when a
//      new pinned announcement appears — this simulates what a real push
//      would feel like, using only the mock data, so you can demo the full
//      experience before the backend exists.
//
// To go live: send the registered push token to your backend, and have your
// backend call the Expo Push API whenever staff post a new announcement.
// Nothing in the UI needs to change — real pushes will simply arrive instead
// of (or alongside) the simulated local ones.
// ---------------------------------------------------------------------------

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device or properly configured emulator.');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.log('Notification permission was not granted.');
    return null;
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('announcements', {
      name: 'Announcements',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  try {
    const tokenResponse = await Notifications.getExpoPushTokenAsync();
    return tokenResponse.data; // send this to your backend & store against the user
  } catch (err) {
    console.log('Could not obtain Expo push token (expected in some simulators):', err);
    return null;
  }
}

/**
 * Fires a local notification for newly-seen pinned announcements. Pass in the
 * latest announcements list each time it refreshes; the hook tracks which IDs
 * it has already notified about (in-memory only — fine for a demo).
 */
export function useAnnouncementNotifications(announcements: Announcement[]) {
  const seenIds = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    registerForPushNotificationsAsync();
  }, []);

  useEffect(() => {
    if (announcements.length === 0) return;

    if (isFirstLoad.current) {
      // Don't notify retroactively for things that already existed on first load.
      announcements.forEach((a) => seenIds.current.add(a.id));
      isFirstLoad.current = false;
      return;
    }

    announcements
      .filter((a) => a.pinned && !seenIds.current.has(a.id))
      .forEach((a) => {
        seenIds.current.add(a.id);
        Notifications.scheduleNotificationAsync({
          content: {
            title: '📌 New announcement',
            body: a.title,
            data: { announcementId: a.id },
          },
          trigger: null, // fire immediately
        });
      });
  }, [announcements]);
}
