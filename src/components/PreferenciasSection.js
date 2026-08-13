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
          toast(e.message || 'No se pudieron cargar las preferencias.', 'error'),
        );
    }, [toast]),
  );

  const agregarPreferencia = async () => {
    const texto = prefNueva.trim();
    if (!texto) {
      toast('Escribí una preferencia.', 'info');
      return;
    }
    setAgregandoPref(true);
    try {
      await createUserPreference(texto);
      setPrefNueva('');
      const prefs = await listUserPreferences();
      setPreferencias(prefs);
      toast('Preferencia guardada.', 'success');
    } catch (e) {
      toast(e.message || 'No se pudo guardar la preferencia.', 'error');
    } finally {
      setAgregandoPref(false);
    }
  };

  const mejorar = async () => {
    const texto = prefNueva.trim();
    if (!texto) {
      toast('Escribí una preferencia para mejorar.', 'info');
      return;
    }
    setMejorando(true);
    try {
      const mejorada = await mejorarPreferencia(texto);
      setPrefNueva(mejorada);
      toast('Preferencia mejorada. Revisala y agregala cuando quieras.', 'success');
    } catch (e) {
      toast(e.message || 'No se pudo mejorar la preferencia.', 'error');
    } finally {
      setMejorando(false);
    }
  };

  const eliminarPreferencia = async (id) => {
    try {
      await deleteUserPreference(id);
      setPreferencias((prev) => prev.filter((p) => p.id !== id));
    } catch (e) {
      toast(e.message || 'No se pudo eliminar.', 'error');
    }
  };

  return (
    <Card>
      <SectionLabel>Preferencias de IA</SectionLabel>
      <Text style={styles.calcHint}>
        Escribí una preferencia o instrucción para la IA (datos, criterios o
        detalles tuyos, por ejemplo tu marca de galletas). Se usa como contexto
        adicional al interpretar tus comidas y nunca altera el formato de
        respuesta.
      </Text>
      <Input
        multiline
        value={prefNueva}
        onChangeText={setPrefNueva}
        placeholder="Ej: mis galletas integrales son de la marca X, 2 unidades = 80 kcal"
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
          Guardar
        </Button>
        <Button
          variant="primary"
          icon="sparkles-outline"
          onPress={mejorar}
          disabled={mejorando}
          loading={mejorando}
          style={styles.prefBtn}
        >
          Mejorar con IA
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
        <Text style={styles.prefVacio}>Todavía no guardaste preferencias.</Text>
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
