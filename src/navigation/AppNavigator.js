import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform, StyleSheet, View } from 'react-native';
import { font, radius, spacing } from '../theme/colors';
import { useTheme, useThemedStyles } from '../theme/ThemeContext';

import DashboardScreen from '../screens/DashboardScreen';
import RegistrarComidaScreen from '../screens/RegistrarComidaScreen';
import HistorialScreen from '../screens/HistorialScreen';
import WorkoutScreen from '../screens/WorkoutScreen';
import PesoScreen from '../screens/PesoScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Tab = createBottomTabNavigator();

const IS_WEB = Platform.OS === 'web';

const iconName = (base, focused) => (focused ? base : `${base}-outline`);

const icons = {
  Today: ({ focused, color }) => (
    <Ionicons name={iconName('pie-chart', focused)} size={22} color={color} />
  ),
  Food: ({ focused, color }) => (
    <Ionicons name={iconName('fast-food', focused)} size={22} color={color} />
  ),
  History: ({ focused, color }) => (
    <Ionicons name={iconName('time', focused)} size={22} color={color} />
  ),
  Train: ({ focused, color }) => (
    <Ionicons name={iconName('barbell', focused)} size={22} color={color} />
  ),
  Weight: ({ focused, color }) => (
    <Ionicons name={iconName('scale', focused)} size={22} color={color} />
  ),
  Profile: ({ focused, color }) => (
    <Ionicons name={iconName('person', focused)} size={22} color={color} />
  ),
};

export default function AppNavigator() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useThemedStyles(makeStyles);

  return (
    <View style={{ flex: 1, paddingTop: IS_WEB ? 0 : insets.top }}>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
          tabBarIcon: ({ focused, color }) => icons[route.name]({ focused, color }),
          ...(IS_WEB
            ? {
                tabBarPosition: 'left',
                tabBarVariant: 'material',
                tabBarLabelPosition: 'beside-icon',
                tabBarStyle: styles.sidebar,
                tabBarItemStyle: styles.sidebarItem,
                tabBarLabelStyle: styles.sidebarLabel,
                tabBarActiveBackgroundColor: colors.primarySoft,
                tabBarInactiveBackgroundColor: 'transparent',
                sceneStyle: styles.scene,
              }
            : {
                tabBarStyle: {
                  backgroundColor: colors.surface,
                  borderTopColor: colors.border,
                  paddingBottom: Math.max(insets.bottom, 6),
                  height: 54 + Math.max(insets.bottom, 6),
                },
                tabBarLabelStyle: { fontSize: font.xs, fontWeight: font.weight.semibold },
              }),
        })}
      >
        <Tab.Screen name="Today" component={DashboardScreen} />
        <Tab.Screen name="Food" component={RegistrarComidaScreen} />
        <Tab.Screen name="History" component={HistorialScreen} />
        <Tab.Screen name="Train" component={WorkoutScreen} />
        <Tab.Screen name="Weight" component={PesoScreen} />
        <Tab.Screen name="Profile" component={PerfilScreen} />
      </Tab.Navigator>
    </View>
  );
}

const makeStyles = (colors) => StyleSheet.create({
  sidebar: {
    width: 232,
    backgroundColor: colors.surface,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  sidebarItem: {
    borderRadius: radius.md,
    marginBottom: spacing.xs,
    justifyContent: 'flex-start',
    paddingHorizontal: spacing.sm,
    height: 48,
  },
  sidebarLabel: {
    fontSize: font.md,
    fontWeight: font.weight.semibold,
    marginLeft: spacing.sm,
  },
  scene: {
    backgroundColor: colors.background,
  },
});
