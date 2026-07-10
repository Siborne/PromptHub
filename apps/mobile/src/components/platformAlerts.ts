import { Alert, Platform } from "react-native";

interface ConfirmationOptions {
  cancelLabel: string;
  confirmLabel: string;
  message: string;
  onConfirm: () => void;
  title: string;
}

function formatWebMessage(title: string, message: string): string {
  return `${title}\n\n${message}`;
}

export function showPlatformAlert(title: string, message: string): void {
  if (Platform.OS === "web") {
    globalThis.alert(formatWebMessage(title, message));
    return;
  }
  Alert.alert(title, message);
}

export function showPlatformConfirmation({
  cancelLabel,
  confirmLabel,
  message,
  onConfirm,
  title,
}: ConfirmationOptions): void {
  if (Platform.OS === "web") {
    if (globalThis.confirm(formatWebMessage(title, message))) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: cancelLabel, style: "cancel" },
    { text: confirmLabel, style: "destructive", onPress: onConfirm },
  ]);
}
