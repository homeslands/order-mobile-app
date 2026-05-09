import messaging from '@react-native-firebase/messaging'

// Must be registered at module level outside React for background/killed state.
// Firebase displays the notification automatically (notification field in payload).
// This handler keeps the background task alive so the delivery completes.
messaging().setBackgroundMessageHandler(async () => {})
