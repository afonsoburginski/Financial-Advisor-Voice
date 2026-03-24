import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import Colors from "@/constants/colors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "chart.line.uptrend.xyaxis", selected: "chart.line.uptrend.xyaxis" }} />
        <Label>Dashboard</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="voice">
        <Icon sf={{ default: "waveform", selected: "waveform" }} />
        <Label>Voz</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: "list.bullet", selected: "list.bullet" }} />
        <Label>Histórico</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : Colors.bg,
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: Colors.lineStrong,
          elevation: 0,
          ...(isWeb ? { height: 84 } : {}),
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={60} tint="dark" style={StyleSheet.absoluteFill} />
          ) : isWeb ? (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: Colors.bg }]} />
          ) : null,
        tabBarLabelStyle: {
          fontFamily: "Inter_500Medium",
          fontSize: 10,
          letterSpacing: 0.3,
        },
        tabBarIconStyle: { marginTop: 2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="chart.line.uptrend.xyaxis" tintColor={color} size={size - 2} />
            ) : (
              <MaterialCommunityIcons name="chart-line" size={size - 2} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="voice"
        options={{
          title: "Voz",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="waveform" tintColor={color} size={size - 2} />
            ) : (
              <Feather name="mic" size={size - 2} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Histórico",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="list.bullet" tintColor={color} size={size - 2} />
            ) : (
              <Feather name="list" size={size - 2} color={color} />
            ),
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) {
    return <NativeTabLayout />;
  }
  return <ClassicTabLayout />;
}
