import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Input, SectionLabel } from './ui';
import { useToast } from './Toast';
import { colors, font, radius, spacing } from '../theme/colors';
import {
  listUserPreferences,
  createUserPreference,
  deleteUserPreference,
  mejorarPreferencia,
} from '../services/api';

export default function PreferenciasSection() {
  const [preferencias, setPreferencias] = useState([]);
  const [prefNueva, setPrefNueva] = useState('');
  const [mejorando, setMejorando] = useState(false);
  const [agregandoPref, setAgregandoPref] = useState(false);
  const { showToast: toast } = useToast();

  useFocusEffect(
    useCallback(() => {
      listUserPreferences()
        .then(setPreferencias)
        .catch((e) =>
          toast(e.message || 'Could not load your preferences.', 'error'),
        );
    }, [toast]),
  );

  const agregarPreferencia = async () => {
    const texto = prefNueva.trim();
    if (!texto) {
      toast('Write a preference first.', 'info');
      return;
    }
    setAgregandoPref(true);
    try {
      await createUserPreference(texto);
      setPrefNueva('');
      const prefs = await listUserPreferences();
      setPreferencias(prefs);
      toast('Preference saved.', 'success');
    } catch (e) {
      toast(e.message || 'Could not save the preference.', 'error');
    } finally {
      setAgregandoPref(false);
    }
  };

  const mejorar = async () => {
    const texto = prefNueva.trim();
    if (!texto) {
      toast('Write a preference to improve first.', 'info');
      return;
    }
    setMejorando(true);
    try {
      const mejorada = await mejorarPreferencia(texto);
      setPrefNueva(mejorada);
      toast('Preference improved. Review it and save when ready.', 'success');
    } catch (e) {
      toast(e.message || 'Could not improve the preference.', 'error');
    } finally {
      setMejorando(false);
    }
  };

  const eliminarPreferencia = async (id) => {
    try {
      await deleteUserPreference(id);
      setPreferencias((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      toast(e.message || 'Could not delete the preference.', 'error');
    }
  };

  return (
    <Card>
      <SectionLabel>AI preferences</SectionLabel>
      <Text style={styles.calcHint}>
        Write a preference or instruction for the AI (facts, criteria or personal
        details, for example the brand of your cookies). It is used as extra
        context when interpreting your meals and never changes the response
        format.
      </Text>
      <Input
        multiline
        value={prefNueva}
        onChangeText={setPrefNueva}
        placeholder="e.g. my whole-wheat cookies are brand X, 2 units = 80 kcal"
        style={styles.prefInput}
      />
      <View style={styles.prefActions}>
        <Button
          variant="secondary"
          icon="add"
          onPress={agregarPreferencia}
          disabled={agregandoPref}
          loading={agregandoPref}
          style={styles.prefBtn}
        >
          Save
        </Button>
        <Button
          variant="primary"
          icon="sparkles-outline"
          onPress={mejorar}
          disabled={mejorando}
          loading={mejorando}
          style={styles.prefBtn}
        >
          Improve with AI
        </Button>
      </View>
      {preferencias.length > 0 ? (
        <View style={styles.prefLista}>
          {preferencias.map((p) => (
            <View key={p.id} style={styles.prefItem}>
              <Text style={styles.prefTexto}>{p.texto}</Text>
              <TouchableOpacity onPress={() => eliminarPreferencia(p.id)} hitSlop={8}>
                <Ionicons name="trash-outline" size={18} color={colors.danger} />
              </TouchableOpacity>
            </View>
          ))}
        </View>
      ) : (
        <Text style={styles.prefVacio}>No preferences saved yet.</Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  calcHint: { fontSize: font.base, color: colors.textMuted, marginBottom: spacing.md },
  prefInput: { minHeight: 88, textAlignVertical: 'top' },
  prefActions: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.md },
  prefBtn: { flex: 1 },
  prefLista: { marginTop: spacing.md },
  prefItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    marginBottom: spacing.xs,
  },
  prefTexto: { flex: 1, fontSize: font.base, color: colors.text },
  prefVacio: { fontSize: font.sm, color: colors.textMuted, marginTop: spacing.md },
});
