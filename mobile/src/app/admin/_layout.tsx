// Native Studio (admin) route group. These screens live OUTSIDE the viewer tabs
// and are gated to admin emails by <AdminScaffold/> on each screen. The stack
// has no header of its own - each screen renders its own back bar. A
// SafeAreaProvider is provided here because this group sits outside the tabs
// layout (which had its own provider).

import React from "react";
import { View } from "react-native";
import { Stack } from "expo-router";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors } from "../../lib/theme";

export default function AdminLayout() {
  return (
    <SafeAreaProvider>
      <SafeAreaShell />
    </SafeAreaProvider>
  );
}

function SafeAreaShell() {
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {/* Routes are file-based; listed explicitly so the group is clear. The
            Team screen (owner-only) is gated by <AdminScaffold require="team">. */}
        <Stack.Screen name="index" />
        <Stack.Screen name="schedule" />
        <Stack.Screen name="tips" />
        <Stack.Screen name="costs" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="team" />
      </Stack>
    </View>
  );
}
