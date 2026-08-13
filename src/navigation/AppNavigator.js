import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Platform } from 'react-native';
import { colors, font, radius, spacing } from '../theme/colors';

import DashboardScreen from '../screens/DashboardScreen';
import RegistrarComidaScreen from '../screens/RegistrarComidaScreen';
import HistorialScreen from '../screens/HistorialScreen';
import PesoScreen from '../screens/PesoScreen';
import PerfilScreen from '../screens/PerfilScreen';

const Tab = createBottomTabNavigator();

const icons = {
  Hoy: ({ focused, color }) => (
    <Ionicons name={focused ? 'pie-chart' : 'pie-chart-outline'} size={22} color={color} />
  ),
  Comida: ({ focused, color }) => (
    <Ionicons name={focused ? 'fast-food' : 'fast-food-outline'} size={22} color={color} />
  ),
  Historial: ({ focused, color }) => (
    <Ionicons name={focused ? 'time' : 'time-outline'} size={22} color={color} />
  ),
  Peso: ({ focused, color }) => (
    <Ionicons name={focused ? 'scale' : 'scale-outline'} size={22} color={color} />
  ),
  Perfil: ({ focused, color }) => (
    <Ionicons name={focused ? 'person' : 'person-outline'} size={22} color={color} />
  ),
};

export default function AppNavigator() {
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerTitleAlign: 'center',
        headerStyle: {
          backgroundColor: colors.background,
          shadowOpacity: 0,
          elevation: 0,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        },
        headerTitleStyle: {
          fontSize: font.lg,
          fontWeight: font.weight.bold,
          color: colors.text,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: isWeb ? 6 : Math.max(insets.bottom, 6),
          height: isWeb ? 58 : 54 + Math.max(insets.bottom, 6),
        },
        tabBarLabelStyle: { fontSize: font.xs, fontWeight: font.weight.semibold },
        tabBarIcon: ({ focused, color }) => icons[route.name]({ focused, color }),
      })}
    >
      <Tab.Screen name="Hoy" component={DashboardScreen} />
      <Tab.Screen name="Comida" component={RegistrarComidaScreen} />
      <Tab.Screen name="Historial" component={HistorialScreen} />
      <Tab.Screen name="Peso" component={PesoScreen} />
      <Tab.Screen name="Perfil" component={PerfilScreen} />
    </Tab.Navigator>
  );
}