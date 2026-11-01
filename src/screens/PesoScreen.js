import { useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  View,
  ActivityIndicator,
  RefreshControl,
  useWindowDimensions,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import PesoChart from '../components/PesoChart';
import { Badge, Button, Card, ChipGroup, Container, EmptyState, Grid, GridItem, useResponsive } from '../components/ui';
import PeriodFilter, { periodRange } from '../components/PeriodFilter';
import ConfirmDialog from '../components/ConfirmDialog';
import { useToast } from '../components/Toast';
import { colors, font, radius, spacing } from '../theme/colors';
import {
  createWeightEntry,
  listWeightEntries,
  deleteWeightEntry,
  getUser,
} from '../services/api';
import { weightProgress } from '../utils/nutricion';

function formatFecha(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatHora(iso) {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatCorto(iso) {
  const d = new Date(iso);
  return `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}`;
}

const PAGE = 30;
const MAX_PUNTOS_CHART = 150;

const GOAL_LABEL = {
  lose: 'Losing weight',
  gain: 'Gaining weight',
  maintain: 'Maintaining',
};

const QUICK_DELTAS = [-0.5, -0.1, 0.1, 0.5];

function decimar(lista, max) {
  if (lista.length <= max) return lista;
  const step = (lista.length - 1) / (max - 1);
  const out = [];
  for (let i = 0; i < max; i++) out.push(lista[Math.round(i * step)]);
  return out;
}

export default function PesoScreen() {
  const { width } = useWindowDimensions();
  const { isDesktop } = useResponsive();
  const navigation = useNavigation();
  const [peso, setPeso] = useState('');
  const [entries, setEntries] = useState([]);
  const [allWeights, setAllWeights] = useState([]);
  const [lista, setLista] = useState([]);
  const [periodo, setPeriodo] = useState('30d');
  const [hasMore, setHasMore] = useState(false);
  const [cargando, setCargando] = useState(false);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [meta, setMeta] = useState(null);
  const [goalType, setGoalType] = useState('maintain');
  const [modo, setModo] = useState('dia');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [eliminando, setEliminando] = useState(null);
  const { showToast: toast } = useToast();

  const cargar = useCallback(async () => {
    setError(null);
    try {
      const { desde, hasta } = periodRange(periodo);
      const [user, pesos, page, todo] = await Promise.all([
        getUser(),
        listWeightEntries({ desde, hasta }),
        listWeightEntries({ desde, hasta, limit: PAGE, offset: 0, asc: false }),
        listWeightEntries(),
      ]);
      setEntries(pesos);
      setLista(page.data);
      setHasMore(page.hasMore);
      setAllWeights(todo);
      setMeta(user.meta_peso_kg != null ? Number(user.meta_peso_kg) : null);
      setGoalType(user.goal_type ?? 'maintain');
    } catch (e) {
      setError(e.message || 'Could not load your weight.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setCargando(false);
      setCargandoMas(false);
    }
  }, [periodo]);

  useFocusEffect(
    useCallback(() => {
      cargar();
    }, [cargar]),
  );

  const cambiarPeriodo = (p) => {
    if (p === periodo) return;
    setPeriodo(p);
    setCargando(true);
  };

  const cargarMas = async () => {
    setCargandoMas(true);
    try {
      const { desde, hasta } = periodRange(periodo);
      const page = await listWeightEntries({
        desde,
        hasta,
        limit: PAGE,
        offset: lista.length,
        asc: false,
      });
      setLista((prev) => [...prev, ...page.data]);
      setHasMore(page.hasMore);
    } catch (e) {
      toast(e.message || 'Could not load more entries.', 'error');
      setCargandoMas(false);
    }
  };

  const registrar = async () => {
    const valor = Number(String(peso).replace(',', '.'));
    if (!peso || !Number.isFinite(valor) || valor <= 0) {
      toast('Enter a valid weight.', 'info');
      return;
    }
    setSaving(true);
    try {
      await createWeightEntry({ pesoKg: valor, measuredAt: new Date() });
      setPeso('');
      await cargar();
      toast('Weight logged.', 'success');
    } catch (e) {
      toast(e.message || 'Could not save the weight.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const eliminar = (id) => setEliminando(id);

  const ejecutarEliminar = async () => {
    const id = eliminando;
    if (!id) return;
    try {
      await deleteWeightEntry(id);
      setEliminando(null);
      await cargar();
      toast('Entry deleted.', 'success');
    } catch (e) {
      toast(e.message || 'Could not delete the entry.', 'error');
      setEliminando(null);
    }
  };

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

  const chartData = (() => {
    if (modo === 'todos') {
      return decimar(
        entries.map((e) => ({
          value: Number(e.peso_kg),
          label: formatCorto(e.measured_at),
          ms: new Date(e.measured_at).getTime(),
          fechaTexto: `${formatFecha(e.measured_at)} · ${formatHora(e.measured_at)}`,
        })),
        MAX_PUNTOS_CHART,
      );
    }
    const grupos = new Map();
    for (const e of entries) {
      const key = new Date(e.measured_at).toDateString();
      if (!grupos.has(key)) grupos.set(key, []);
      grupos.get(key).push(e);
    }
    return decimar(
      [...grupos.entries()]
        .sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime())
        .map(([key, listaDia]) => {
          const prom =
            listaDia.reduce((s, e) => s + Number(e.peso_kg), 0) / listaDia.length;
          return {
            value: Number(prom.toFixed(2)),
            label: formatCorto(key),
            fechaTexto: listaDia.length > 1
              ? `${formatFecha(key)} · average of ${listaDia.length} entries`
              : `${formatFecha(key)} · ${formatHora(listaDia[0].measured_at)}`,
          };
        }),
      MAX_PUNTOS_CHART,
    );
  })();

  const chartWidth = (() => {
    const inner = isDesktop ? Math.min(width, 1120) : width;
    return Math.max(inner - spacing.md * 4 - 2, 200);
  })();

  const chartCard = (
    <Card>
      <ChipGroup
        options={[
          { value: 'dia', label: 'Daily average' },
          { value: 'todos', label: 'Every entry' },
        ]}
        value={modo}
        onChange={setModo}
      />
      <View style={styles.chartWrap}>
        <PesoChart
          data={chartData}
          meta={meta}
          width={chartWidth}
          height={230}
          color={colors.primary}
        />
      </View>
      {meta != null ? (
        <Text style={styles.metaTexto}>Dashed line: goal {meta} kg</Text>
      ) : null}
    </Card>
  );

  const firstWeight = allWeights.length > 0 ? allWeights[0] : null;
  const currentWeight = allWeights.length > 0 ? allWeights[allWeights.length - 1] : null;
  const progress = weightProgress({
    start: firstWeight?.peso_kg,
    current: currentWeight?.peso_kg,
    goal: meta,
    goalType,
  });
  const quickBase = currentWeight ? Number(currentWeight.peso_kg) : null;

  const transformCard = (
    <Card style={styles.transformCard}>
      <View style={styles.cardHeaderRow}>
        <Text style={styles.cardTitle}>Transformation</Text>
        <Badge tone={progress?.reached ? 'primary' : 'muted'}>
          {GOAL_LABEL[goalType] ?? GOAL_LABEL.maintain}
        </Badge>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>
            {firstWeight ? Number(firstWeight.peso_kg) : '—'}
            <Text style={styles.statUnit}> kg</Text>
          </Text>
          <Text style={styles.statLabel}>Start</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={[styles.statValue, styles.statValueCurrent]}>
            {currentWeight ? Number(currentWeight.peso_kg) : '—'}
            <Text style={styles.statUnit}> kg</Text>
          </Text>
          <Text style={styles.statLabel}>Current</Text>
        </View>
        <View style={styles.statBlock}>
          <Text style={styles.statValue}>
            {meta != null ? meta : '—'}
            <Text style={styles.statUnit}> kg</Text>
          </Text>
          <Text style={styles.statLabel}>Goal</Text>
        </View>
      </View>

      {progress ? (
        <>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress.pct * 100}%` }]} />
          </View>
          <Text style={styles.progressText}>
            {progress.reached
              ? 'Goal reached — keep it steady!'
              : `${progress.toGo} kg to go · ${Math.round(progress.pct * 100)}% of the way`}
          </Text>
        </>
      ) : (
        <Text style={styles.transformHint}>
          Set a goal weight to unlock your progress bar and the kg you still need to go.
        </Text>
      )}

      <TouchableOpacity
        style={styles.goalLink}
        onPress={() => navigation.navigate('Profile')}
        hitSlop={6}
      >
        <Ionicons name="create-outline" size={14} color={colors.primary} />
        <Text style={styles.goalLinkText}>
          {meta != null ? 'Edit goal in Profile' : 'Set a goal in Profile'}
        </Text>
      </TouchableOpacity>
    </Card>
  );

  const inputCard = (
    <Card style={styles.inputCard}>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          keyboardType="decimal-pad"
          placeholder="78.5"
          placeholderTextColor={colors.textMuted}
          value={peso}
          onChangeText={setPeso}
        />
        <Text style={styles.unidad}>kg</Text>
      </View>
      {quickBase != null ? (
        <View style={styles.quickRow}>
          <Text style={styles.quickLabel}>Quick fill</Text>
          {QUICK_DELTAS.map((delta) => {
            const value = Math.round((quickBase + delta) * 10) / 10;
            return (
              <TouchableOpacity
                key={delta}
                style={styles.quickChip}
                onPress={() => setPeso(String(value))}
              >
                <Text style={styles.quickChipText}>
                  {delta > 0 ? `+${delta}` : delta}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}
      <Button
        variant="primary"
        icon="add"
        onPress={registrar}
        disabled={saving}
        loading={saving}
      >
        Log weight
      </Button>
    </Card>
  );

  const registrosCard = lista.length > 0 ? (
    <View style={styles.lista}>
      <Text style={styles.listaTitulo}>Entries</Text>
      {lista.map((e) => (
        <Card key={e.id} style={styles.itemCard}>
          <View style={styles.itemInfo}>
            <Text style={styles.itemPeso}>{e.peso_kg} kg</Text>
            <Text style={styles.itemFecha}>
              {formatFecha(e.measured_at)} · {formatHora(e.measured_at)}
            </Text>
          </View>
          <TouchableOpacity onPress={() => eliminar(e.id)} hitSlop={8}>
            <Ionicons name="trash-outline" size={18} color={colors.danger} />
          </TouchableOpacity>
        </Card>
      ))}
      {hasMore ? (
        <Button
          variant="secondary"
          icon="chevron-down"
          onPress={cargarMas}
          loading={cargandoMas}
          disabled={cargandoMas}
          style={styles.masBtn}
        >
          Load more
        </Button>
      ) : null}
    </View>
  ) : null;

  return (
    <>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
      <Container>
        <Text style={styles.title}>Weight</Text>

        <PeriodFilter value={periodo} onChange={cambiarPeriodo} />

        {cargando ? (
          <ActivityIndicator style={styles.spinner} color={colors.primary} />
        ) : null}

        {periodo !== 'todo' && lista.length > 0 ? (
          <Text style={styles.contador}>
            Showing {lista.length} {lista.length === 1 ? 'entry' : 'entries'} in the selected period
          </Text>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {allWeights.length > 0 ? transformCard : null}

        {entries.length === 0 ? (
          <>
            {inputCard}
            <EmptyState
              icon="scale-outline"
              title="Log your first weight"
              hint="Your trend chart will show up here."
            />
          </>
        ) : isDesktop ? (
          <Grid cols={2}>
            <GridItem cols={1}>
              {chartCard}
            </GridItem>
            <GridItem cols={1}>
              {inputCard}
              {registrosCard}
            </GridItem>
          </Grid>
        ) : (
          <>
            {inputCard}
            {chartCard}
            {registrosCard}
          </>
        )}
      </Container>
      </ScrollView>

      <ConfirmDialog
        visible={eliminando != null}
        title="Delete entry"
        message="Remove this weight entry? This cannot be undone."
        loading={saving}
        onConfirm={ejecutarEliminar}
        onCancel={() => setEliminando(null)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background },
  content: { flexGrow: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: font.xl, fontWeight: '800', color: colors.text, marginBottom: spacing.md },
  contador: { fontSize: font.sm, color: colors.textMuted, marginBottom: spacing.md },
  spinner: { marginVertical: spacing.md },
  inputCard: { marginBottom: spacing.md },
  masBtn: { marginTop: spacing.sm },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  input: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: font.lg,
    fontWeight: '600',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  unidad: { fontSize: font.md, fontWeight: '700', color: colors.textMuted },
  error: { color: colors.danger, marginBottom: spacing.md },
  chartWrap: { alignItems: 'center', marginTop: spacing.md },
  metaTexto: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.sm, textAlign: 'center' },
  lista: { marginTop: spacing.lg },
  listaTitulo: { fontSize: font.md, fontWeight: '800', color: colors.text, marginBottom: spacing.sm },
  itemCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md, marginBottom: spacing.sm },
  itemInfo: { flex: 1 },
  itemPeso: { fontSize: font.md, fontWeight: '700', color: colors.text },
  itemFecha: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.xs },

  // Transformation card
  transformCard: { marginBottom: spacing.md },
  cardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  cardTitle: {
    fontSize: font.sm,
    fontWeight: font.weight.semibold,
    color: colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsRow: { flexDirection: 'row', alignItems: 'center', marginVertical: spacing.sm },
  statBlock: { flex: 1, alignItems: 'center' },
  statValue: { fontSize: font.xl, fontWeight: '800', color: colors.text },
  statValueCurrent: { color: colors.primaryDark },
  statUnit: { fontSize: font.sm, color: colors.textMuted, fontWeight: font.weight.medium },
  statLabel: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
    marginTop: spacing.sm,
  },
  progressFill: { height: 10, borderRadius: radius.pill, backgroundColor: colors.primary },
  progressText: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    textAlign: 'center',
  },
  transformHint: {
    fontSize: font.sm,
    color: colors.textMuted,
    marginTop: spacing.sm,
    lineHeight: 18,
  },
  goalLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginTop: spacing.md,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  goalLinkText: { fontSize: font.sm, fontWeight: '700', color: colors.primary },

  // Quick fill chips
  quickRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  quickLabel: { fontSize: font.xs, color: colors.textMuted, marginRight: spacing.xs },
  quickChip: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    ...(Platform.OS === 'web' ? { cursor: 'pointer' } : {}),
  },
  quickChipText: { fontSize: font.xs, fontWeight: '700', color: colors.text },
});
