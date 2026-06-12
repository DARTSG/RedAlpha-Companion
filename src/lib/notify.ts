/**
 * Cross-platform alert/confirm. React Native's Alert.alert is a SILENT NO-OP
 * on web, which swallows errors — always use these helpers instead.
 */
import { Alert, Platform } from 'react-native';

export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}

export function confirmDialog(title: string, message: string, onYes: () => void, yesLabel = 'OK'): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onYes();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: yesLabel, onPress: onYes },
  ]);
}
