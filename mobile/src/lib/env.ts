// Runtime environment helpers.
//
// Expo Go (the "StoreClient" execution environment) does NOT bundle third-party
// native modules such as @stripe/stripe-react-native. Importing those modules at
// module-eval time crashes the app inside Expo Go. Use IS_EXPO_GO to gate any
// code path that touches a native module that isn't part of the Expo Go runtime,
// and load such modules lazily via require() only when this is false.
import Constants, { ExecutionEnvironment } from "expo-constants";

export const IS_EXPO_GO =
  Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
