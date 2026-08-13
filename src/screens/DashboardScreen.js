import { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Container, Card, SectionLabel } from '../components/ui';
import { colors, font, radius, spacing } from '../theme/colors';
import { listFoodEntries, listWeightEntries, getUser } from '../services/api';

export default function DashboardScreen() {
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

  return (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Container>
        <Card style={styles.hero}>
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
        </Card>

        <Text style={styles.faltan}>Restan {Math.max(0, Math.round(objetivo - consumidas))} kcal</Text>

        {ultimoPeso ? (
          <Card style={styles.rowCard}>
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
          </Card>
        ) : (
          <Card muted>
            <SectionLabel style={{ marginBottom: spacing.xs }}>Último peso</SectionLabel>
            <Text style={styles.pesoVacio}>
              Aún no registras pesajes. Andá a la pestaña Peso.
            </Text>
          </Card>
        )}

        {error ? (
          <Card style={{ borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft }}>
            <Text style={{ color: colors.danger }}>{error}</Text>
          </Card>
        ) : null}
      </Container>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  hero: { marginBottom: spacing.md },
  heroLabel: { fontSize: font.base, color: colors.textMuted, fontWeight: font.weight.medium },
  heroRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm, marginTop: spacing.xs },
  heroConsumidas: { fontSize: 52, fontWeight: '800', color: colors.text, lineHeight: 56 },
  heroUnidad: { fontSize: font.lg, color: colors.textMuted, fontWeight: font.weight.medium },
  bar: {
    height: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.primaryTrack,
    overflow: 'hidden',
    marginTop: spacing.md,
  },
  barFill: { height: 12, borderRadius: radius.pill, backgroundColor: colors.primary },
  meta: { fontSize: font.xs, color: colors.textMuted },
  metaValor: { fontSize: font.sm, fontWeight: font.weight.semibold, color: colors.text },
  barFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  faltan: {
    fontSize: font.base,
    color: colors.textMuted,
    textAlign: 'center',
    marginBottom: spacing.md,
    fontWeight: font.weight.medium,
  },
  rowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  iconCircle: {
    width: 40,
    height: 40,
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
});