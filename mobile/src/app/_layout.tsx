import "react-native-gesture-handler";
import React, { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { View, ActivityIndicator } from "react-native";
import * as SplashScreen from "expo-splash-screen";
import { useFonts as useAnton, Anton_400Regular } from "@expo-google-fonts/anton";
import {
  useFonts as useInter,
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from "@expo-google-fonts/inter";

import { AuthProvider } from "../lib/auth";
import { STRIPE_PUBLISHABLE_KEY } from "../lib/config";
import { colors } from "../lib/theme";
import { IS_EXPO_GO } from "../lib/env";

SplashScreen.preventAutoHideAsync().catch(() => {});

// Expo Go does not bundle @stripe/stripe-react-native, so importing it there
// crashes the app. In dev/standalone builds we lazily require StripeProvider and
// wrap the tree; in Expo Go we render a passthrough with no Stripe context.
function StripeGate({ children }: { children: React.ReactNode }) {
  if (IS_EXPO_GO) return <>{children}</>;
  const StripeProvider = require("@stripe/stripe-react-native").StripeProvider;
  return (
    <StripeProvider
      publishableKey={STRIPE_PUBLISHABLE_KEY}
      merchantIdentifier="merchant.com.yourstudio.app"
    >
      {children}
    </StripeProvider>
  );
}

export default function RootLayout() {
  const [antonLoaded] = useAnton({ Anton_400Regular });
  const [interLoaded] = useInter({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const ready = antonLoaded && interLoaded;

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: "center", justifyContent: "center" }}>
        <ActivityIndicator color={colors.amber} />
      </View>
    );
  }

  return (
    <StripeGate>
      <AuthProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="signin" options={{ presentation: "modal" }} />
          <Stack.Screen name="join" options={{ presentation: "modal" }} />
          <Stack.Screen name="studio" options={{ presentation: "modal" }} />
          <Stack.Screen name="admin" />
        </Stack>
      </AuthProvider>
    </StripeGate>
  );
}
