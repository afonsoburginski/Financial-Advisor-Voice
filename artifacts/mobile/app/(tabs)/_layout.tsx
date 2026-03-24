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
        <Label>Início</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="advisor">
        <Icon sf={{ default: "sparkles", selected: "sparkles" }} />
        <Label>Tommy</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="agenda">
        <Icon sf={{ default: "checklist", selected: "checklist" }} />
        <Label>Agenda</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="history">
        <Icon sf={{ default: "clock.arrow.circlepath", selected: "clock.arrow.circlepath" }} />
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
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Início",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="chart.line.uptrend.xyaxis" tintColor={color} size={size - 2} />
            ) : (
              <MaterialCommunityIcons name="chart-line" size={size - 2} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="advisor"
        options={{
          title: "Tommy",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="sparkles" tintColor={color} size={size - 2} />
            ) : (
              <MaterialCommunityIcons name="creation" size={size - 2} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="agenda"
        options={{
          title: "Agenda",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="checklist" tintColor={color} size={size - 2} />
            ) : (
              <Feather name="check-square" size={size - 2} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: "Histórico",
          tabBarIcon: ({ color, size }) =>
            isIOS ? (
              <SymbolView name="clock.arrow.circlepath" tintColor={color} size={size - 2} />
            ) : (
              <Feather name="clock" size={size - 2} color={color} />
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
