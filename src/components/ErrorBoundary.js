import { Component } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors, font, radius, spacing } from '../theme/colors';

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  reiniciar = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.flex}>
        <View style={styles.card}>
          <Text style={styles.titulo}>Algo salió mal</Text>
          <ScrollView style={styles.msgScroll}>
            <Text style={styles.mensaje}>{String(this.state.error.message || this.state.error)}</Text>
          </ScrollView>
          <TouchableOpacity style={styles.btn} onPress={this.reiniciar}>
            <Text style={styles.btnText}>Reintentar</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  card: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    padding: spacing.lg,
    alignItems: 'stretch',
  },
  titulo: { fontSize: font.lg, fontWeight: '800', color: colors.danger, marginBottom: spacing.sm },
  msgScroll: { maxHeight: 220, marginBottom: spacing.md },
  mensaje: { fontSize: font.base, color: colors.text, fontFamily: 'monospace' },
  btn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  btnText: { color: colors.onPrimary, fontSize: font.base, fontWeight: '700' },
});
