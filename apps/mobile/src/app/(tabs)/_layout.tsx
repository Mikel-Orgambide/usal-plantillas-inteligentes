import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Icon, type IconName } from "../../presentation/components";
import { colors, fonts, size } from "../../presentation/theme/tokens";

/** Barra inferior: Historial · Hoy · Ajustes (cuenta, plantillas, respaldo, demostración). Respeta el área de gestos de Android. Las pantallas de flujo van por encima. */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  type TabOptions = ComponentProps<typeof Tabs.Screen>["options"];
  const tab = (title: string, icon: IconName): TabOptions => ({
    title,
    tabBarIcon: ({ color }) => <Icon name={icon} size={22} color={String(color)} />,
  });
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
          borderTopWidth: size.hairline,
          height: 64 + insets.bottom,
          paddingTop: 8,
          paddingBottom: insets.bottom + 8,
        },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
      }}
    >
      <Tabs.Screen name="historial" options={{ ...tab("Historial", "history"), popToTopOnBlur: true }} />
      <Tabs.Screen name="index" options={tab("Hoy", "foot")} />
      <Tabs.Screen name="mas" options={tab("Ajustes", "more")} />
    </Tabs>
  );
}
