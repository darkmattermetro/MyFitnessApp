import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Container, Grid, GridItem, useResponsive } from '../components/ui';
import { colors, font, radius, spacing } from '../theme/colors';
import { listFoodEntries, listWeightEntries, getUser } from '../services/api';

export default function DashboardScreen() {
  const { isDesktop } = useResponsive();
  const [consumidas, setConsumidas] = useState(0);
  const [objetivo, setObjetivo] = useState(2000);
  const [ultimoPeso, setUltimoPeso] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const [entries, pesos, user] = await Promise.all([
        listFoodEntries(),
        listWeightEntries(),
        getUser(),
      ]);
      if (user.objetivo_kcal) setObjetivo(Number(user.objetivo_kcal));
      const hoy = new Date().toDateString();
      const deHoy = entries.filter(
        (e) => new Date(e.fecha).toDateString() === hoy,
      );
      setConsumidas(deHoy.reduce((s, e) => s + (Number(e.total_kcal) || 0), 0));
      setUltimoPeso(pesos.length > 0 ? pesos[pesos.length - 1] : null);
    } catch (e) {
      setError(e.message || 'No se pudo cargar el panel.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const onRefresh = () => {
    setRefreshing(true);
    cargar();
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  const porcentaje = Math.min(consumidas / objetivo, 1);

  const heroCard = (
    <LinearGradient
      colors={colors.primaryGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <Text style={styles.heroLabel}>Calorías de hoy</Text>
      <View style={styles.heroRow}>
        <Text style={styles.heroConsumidas}>{Math.round(consumidas)}</Text>
        <Text style={styles.heroUnidad}>kcal</Text>
      </View>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${porcentaje * 100}%` }]} />
      </View>
      <View style={styles.barFooter}>
        <Text style={styles.meta}>Meta</Text>
        <Text style={styles.metaValor}>{objetivo} kcal</Text>
      </View>
      <Text style={styles.faltan}>
        Restan {Math.max(0, Math.round(objetivo - consumidas))} kcal
      </Text>
    </LinearGradient>
  );

  const pesoCard = ultimoPeso ? (
    <View style={[styles.rowCard, styles.cardBase]}>
      <View style={styles.iconCircle}>
        <Ionicons name="scale-outline" size={20} color={colors.primary} />
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.pesoLabel}>Último peso</Text>
        <Text style={styles.pesoValue}>
          {ultimoPeso.peso_kg} <Text style={styles.pesoUnidad}>kg</Text>
        </Text>
      </View>
      <Text style={styles.pesoFecha}>
        {new Date(ultimoPeso.measured_at).toLocaleDateString('es-CO')}
      </Text>
    </View>
  ) : (
    <View style={[styles.cardBase, styles.cardMuted]}>
      <Text style={styles.cardTitle}>Último peso</Text>
      <Text style={styles.pesoVacio}>
        Aún no registras pesajes. Andá a la pestaña Peso.
      </Text>
    </View>
  );

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
        <Container>
          <Text style={styles.title}>Hoy</Text>
          {isDesktop ? (
            <Grid cols={2}>
            <GridItem cols={2}>{heroCard}</GridItem>
            <GridItem cols={2}>{pesoCard}</GridItem>
          </Grid>
        ) : (
          <>
            {heroCard}
            <View style={{ height: spacing.md }} />
            {pesoCard}
          </>
        )}

        {error ? (
          <View style={[styles.cardBase, styles.errorCard]}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </Container>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: {
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  heroLabel: { fontSize: font.base, color: 'rgba(255,255,255,0.85)', fontWeight: font.weight.medium },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs },
  heroConsumidas: { fontSize: 56, fontWeight: '800', color: colors.white, lineHeight: 60 },
  heroUnidad: { fontSize: font.lg, color: 'rgba(255,255,255,0.85)', fontWeight: font.weight.medium },
  bar: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.22)',
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  barFill: { height: 12, borderRadius: radius.pill, backgroundColor: colors.white },
  meta: { fontSize: font.xs, color: 'rgba(255,255,255,0.75)' },
  metaValor: { fontSize: font.sm, fontWeight: font.weight.semibold, color: colors.white },
  barFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  faltan: {
    fontSize: font.base,
    color: 'rgba(255,255,255,0.9)',
    marginTop: spacing.md,
    fontWeight: font.weight.semibold,
  },
  cardBase: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.md,
    ...(Platform.OS === 'web'
      ? { boxShadow: '0 1px 2px rgba(16,24,40,0.05), 0 8px 24px rgba(16,24,40,0.06)' }
      : { elevation: 2, shadowColor: '#0F172A', shadowOpacity: 0.05, shadowRadius: 8, shadowOffset: { width: 0, height: 2 } }),
  },
  cardMuted: { backgroundColor: colors.surfaceMuted },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  cardTitle: {
    fontSize: font.sm,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowInfo: { flex: 1, marginLeft: spacing.md },
  pesoLabel: { fontSize: font.sm, color: colors.textMuted },
  pesoValue: { fontSize: font.xl, fontWeight: font.weight.bold, color: colors.text },
  pesoUnidad: { fontSize: font.base, color: colors.textMuted, fontWeight: font.weight.medium },
  pesoFecha: { fontSize: font.sm, color: colors.textMuted },
  pesoVacio: { fontSize: font.base, color: colors.textMuted },
  errorCard: { borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft, marginTop: spacing.md },
  errorText: { color: colors.danger },
});