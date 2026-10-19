import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import { Icon, type IconName } from "../../presentation/components";
import { colors, fonts, size } from "../../presentation/theme/tokens";

/** Barra inferior: los tres destinos permanentes. Las pantallas de flujo (preparación, grabación, detalle) van por encima. */
export default function TabsLayout() {
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
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.line, borderTopWidth: size.hairline, height: 64, paddingTop: 6 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12, marginTop: 2 },
      }}
    >
      <Tabs.Screen name="index" options={tab("Hoy", "foot")} />
      <Tabs.Screen name="historial" options={tab("Historial", "history")} />
      <Tabs.Screen name="ajustes" options={tab("Ajustes", "settings")} />
    </Tabs>
  );
}
