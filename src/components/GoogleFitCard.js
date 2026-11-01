import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from './ui';
import { colors, font, radius, spacing } from '../theme/colors';
import {
  isConfigured,
  getClientIds,
  loadTokens,
  saveTokens,
  clearTokens,
  getLastSync,
  syncSteps,
} from '../services/googleFit';
import { useToast } from './Toast';

export default function GoogleFitCard() {
  const toast = useToast();
  const [tokens, setTokens] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const ids = getClientIds();
  const [request, response, promptAsync] = Google.useAuthRequest({
    scopes: ['https://www.googleapis.com/auth/fitness.activity.read'],
    clientId: ids.web,
    androidClientId: ids.android,
    iosClientId: ids.ios,
  });

  useEffect(() => {
    (async () => {
      setTokens(await loadTokens());
      setLastSync(await getLastSync());
    })();
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token, refresh_token, expires_in } = response.params || {};
      if (access_token) {
        const next = {
          access_token,
          refresh_token,
          expires_at: Date.now() + (Number(expires_in) || 3600) * 1000,
        };
        saveTokens(next).then(() => setTokens(next));
        toast.showToast('Google Fit connected');
      }
    } else if (response?.type === 'error') {
      toast.showToast(response.error?.message || 'Could not connect Google Fit');
    }
  }, [response]);

  if (!isConfigured()) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>Google Fit</Text>
        <Text style={styles.hint}>
          Not configured. Add EXPO_PUBLIC_GOOGLE_FIT_WEB_CLIENT_ID (and the
          Android/iOS variants) to your .env and rebuild to enable step sync.
        </Text>
      </Card>
    );
  }

  const connected = !!tokens?.access_token;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const res = await syncSteps(7);
      setLastSync(res.lastSync);
      toast.showToast(`Synced ${res.updated} day(s) of steps`);
    } catch (e) {
      toast.showToast(e.message || 'Sync failed');
    } finally {
      setSyncing(false);
    }
  };

  const handleDisconnect = async () => {
    setLoading(true);
    try {
      await clearTokens();
      setTokens(null);
      setLastSync(null);
      toast.showToast('Google Fit disconnected');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="fitness-outline" size={20} color={colors.primary} />
        <Text style={styles.title}>Google Fit</Text>
        <View
          style={[
            styles.badge,
            { backgroundColor: connected ? colors.primarySoft : colors.surfaceMuted },
          ]}
        >
          <Text
            style={[
              styles.badgeText,
              { color: connected ? colors.primaryDark : colors.textMuted },
            ]}
          >
            {connected ? 'Connected' : 'Not connected'}
          </Text>
        </View>
      </View>

      <Text style={styles.hint}>
        {connected
          ? 'Import your step counts from Google Fit into the Today screen. Manual entries are kept when they are higher.'
          : 'Connect your Google account to import step counts automatically.'}
      </Text>

      {lastSync ? (
        <Text style={styles.meta}>Last sync: {new Date(lastSync).toLocaleString()}</Text>
      ) : null}

      <View style={styles.actions}>
        {!connected ? (
          <Button
            variant="primary"
            icon="link-outline"
            onPress={() => promptAsync()}
            disabled={!request}
          >
            Connect Google Fit
          </Button>
        ) : (
          <>
            <Button
              variant="primary"
              icon="sync-outline"
              onPress={handleSync}
              loading={syncing}
              disabled={syncing}
            >
              Sync steps (7 days)
            </Button>
            <Button
              variant="ghost"
              icon="unlink-outline"
              onPress={handleDisconnect}
              loading={loading}
              disabled={loading}
            >
              Disconnect
            </Button>
          </>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: font.base,
    fontWeight: '700',
    color: colors.text,
  },
  badge: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
  },
  badgeText: { fontSize: font.xs, fontWeight: '700' },
  hint: {
    fontSize: font.sm,
    color: colors.textMuted,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  meta: { fontSize: font.xs, color: colors.textMuted, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
});
