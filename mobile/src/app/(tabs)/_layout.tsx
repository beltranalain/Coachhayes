// Shared shell for the four sections. The mockup uses a FLOATING TOP-LEFT MENU,
// not a bottom tab bar — so the Tabs navigator's bar is hidden (display:none) and
// navigation is driven by the hamburger + FloatingMenuOverlay. Every screen shows
// the same branded header (logo + wordmark) and can open the same menu.

import React from "react";
import { View } from "react-native";
import { Tabs } from "expo-router";
import { useSafeAreaInsets, SafeAreaProvider } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";
import { ScreenHeader } from "../../components/ScreenHeader";
import { MenuProvider, FloatingMenuOverlay } from "../../components/FloatingMenu";
import { BrandingProvider } from "../../lib/branding";

export default function TabsLayout() {
  return (
    <SafeAreaProvider>
      <BrandingProvider>
        <MenuProvider>
          <SafeAreaWrapper />
        </MenuProvider>
      </BrandingProvider>
    </SafeAreaProvider>
  );
}

function SafeAreaWrapper() {
  const insets = useSafeAreaInsets();
  // Header sits below the status bar; anchor the floating menu just under it.
  const headerBottom = insets.top + 56;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <ScreenHeader />
      <Tabs
        screenOptions={{
          headerShown: false,
          sceneStyle: { backgroundColor: colors.bg },
          // Hide the default bottom tab bar — navigation is via the floating menu.
          tabBarStyle: { display: "none" },
        }}
      >
        <Tabs.Screen name="index" options={{ title: "Home" }} />
        <Tabs.Screen name="rankings" options={{ title: "Rankings" }} />
        <Tabs.Screen name="community" options={{ title: "Community" }} />
        <Tabs.Screen name="live" options={{ title: "Live" }} />
        <Tabs.Screen name="blog" options={{ title: "Blog" }} />
        <Tabs.Screen name="membership" options={{ title: "Membership" }} />
      </Tabs>

      {/* Floating menu overlay, rendered above the screens. */}
      <FloatingMenuOverlay topInset={headerBottom} />
    </View>
  );
}
