import { useEffect, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import * as Google from 'expo-auth-session/providers/google';
import { Ionicons } from '@expo/vector-icons';
import { Button, Card } from './ui';
import { colors, font, radius, spacing } from '../theme/colors';
import {
  isConfigured,
  getClientIds,
  getConfigurationMessage,
  loadTokens,
  saveTokens,
  clearTokens,
  getLastSync,
  getActivitySummary,
  syncSteps,
} from '../services/googleFit';
import { useToast } from './Toast';

export default function GoogleFitCard() {
  const toast = useToast();
  const [tokens, setTokens] = useState(null);
  const [lastSync, setLastSync] = useState(null);
  const [activitySummary, setActivitySummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [storageReady, setStorageReady] = useState(false);
  const ids = getClientIds();
  const configured = isConfigured();
  const redirectUri = Platform.OS === 'web' && typeof window !== 'undefined'
    ? window.location.origin
    : undefined;

  // Always call hooks unconditionally. Google.useAuthRequest throws when the
  // platform client ID is missing, so it lives in a child mounted only when
  // configuration is valid.
  useEffect(() => {
    let active = true;
    Promise.all([loadTokens(), getLastSync(), getActivitySummary()])
      .then(([storedTokens, syncDate, summary]) => {
        if (active) {
          setTokens(storedTokens);
          setLastSync(syncDate);
          setActivitySummary(summary);
        }
      })
      .catch(() => {
        if (active) toast.showToast('Could not load the Google Fit connection.');
      })
      .finally(() => {
        if (active) setStorageReady(true);
      });
    return () => { active = false; };
  }, [toast]);

  if (!configured) {
    return (
      <Card style={styles.card}>
        <View style={styles.header}>
          <Ionicons name="fitness-outline" size={20} color={colors.primary} />
          <Text style={styles.title}>Google Fit</Text>
          <Text style={styles.badgeText}>Not configured</Text>
        </View>
        <Text style={styles.hint}>{getConfigurationMessage()}</Text>
      </Card>
    );
  }

  if (!storageReady) {
    return (
      <Card style={styles.card}>
        <Text style={styles.title}>Google Fit</Text>
        <Text style={styles.hint}>Checking your saved connection…</Text>
      </Card>
    );
  }

  return (
    <GoogleFitConnection
      ids={ids}
      redirectUri={redirectUri}
      tokens={tokens}
      setTokens={setTokens}
      lastSync={lastSync}
      setLastSync={setLastSync}
      activitySummary={activitySummary}
      setActivitySummary={setActivitySummary}
      loading={loading}
      setLoading={setLoading}
      syncing={syncing}
      setSyncing={setSyncing}
      toast={toast}
    />
  );
}

function GoogleFitConnection({
  ids,
  redirectUri,
  tokens,
  setTokens,
  lastSync,
  setLastSync,
  activitySummary,
  setActivitySummary,
  loading,
  setLoading,
  syncing,
  setSyncing,
  toast,
}) {
  const [request, response, promptAsync] = Google.useAuthRequest({
    scopes: ['https://www.googleapis.com/auth/fitness.activity.read'],
    webClientId: ids.web,
    androidClientId: ids.android,
    iosClientId: ids.ios,
    ...(redirectUri ? { redirectUri } : {}),
    selectAccount: true,
  });

  useEffect(() => {
    if (response?.type === 'success') {
      const accessToken = response.authentication?.accessToken || response.params?.access_token;
      if (!accessToken) {
        toast.showToast('Google connected without a step access token. Try connecting again.');
        return;
      }
      const next = {
        access_token: accessToken,
        refresh_token: response.authentication?.refreshToken || response.params?.refresh_token || null,
        expires_at: Date.now() + (Number(response.authentication?.expiresIn || response.params?.expires_in) || 3600) * 1000,
      };
      saveTokens(next)
        .then(() => {
          setTokens(next);
          toast.showToast('Google Fit connected. Sync to import your recent activity.');
        })
        .catch(() => toast.showToast('Google connected, but the connection could not be saved.'));
    } else if (response?.type === 'error') {
      toast.showToast(response.error?.message || 'Could not connect your Google account.');
    }
  }, [response, setTokens, toast]);

  useEffect(() => {
    if (!tokens?.access_token) return undefined;
    let active = true;
    (async () => {
      try {
        const previousSync = await getLastSync();
        const age = previousSync ? Date.now() - new Date(previousSync).getTime() : Infinity;
        if (age < 24 * 60 * 60 * 1000) return;
        setSyncing(true);
        const result = await syncSteps(7);
        if (active) {
          setLastSync(result.lastSync);
          setActivitySummary(result.activity || []);
        }
      } catch (error) {
        if (active) {
          if (/expired|connect google fit first/i.test(error.message || '')) {
            setTokens(null);
            setLastSync(null);
            setActivitySummary([]);
          }
          toast.showToast(error.message || 'Automatic activity sync failed.');
        }
      } finally {
        if (active) setSyncing(false);
      }
    })();
    return () => { active = false; };
  }, [tokens?.access_token, setLastSync, setSyncing, toast]);

  const connected = Boolean(tokens?.access_token);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncSteps(7);
      setLastSync(result.lastSync);
      setActivitySummary(result.activity || []);
      if (result.imported === 0) {
        toast.showToast('Google returned no activity data for the last 7 days. Check Fit sync and account permissions.');
      } else if (result.updated === 0) {
        toast.showToast(`Retrieved activity for ${result.imported} day(s). Saved step counts were unchanged.`);
      } else {
        toast.showToast(`Retrieved activity for ${result.imported} day(s) and updated steps for ${result.updated} day(s).`);
      }
    } catch (error) {
      if (/expired|connect google fit first/i.test(error.message || '')) {
        setTokens(null);
        setLastSync(null);
        setActivitySummary([]);
      }
      toast.showToast(error.message || 'Step sync failed. Reconnect Google Fit and try again.');
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
      toast.showToast('Google Fit disconnected.');
    } catch {
      toast.showToast('Could not remove the saved Google connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Ionicons name="fitness-outline" size={20} color={colors.primary} />
        <Text style={styles.title}>Google Fit</Text>
        <View style={[styles.badge, { backgroundColor: connected ? colors.primarySoft : colors.surfaceMuted }]}>
          <Text style={[styles.badgeText, { color: connected ? colors.primaryDark : colors.textMuted }]}>
            {connected ? 'Connected' : 'Not connected'}
          </Text>
        </View>
      </View>

      <Text style={styles.hint}>
        {connected
        ? 'Import daily activity for the last 7 days. Open Profile to sync automatically once a day, or sync now. Higher saved step counts are kept.'
          : 'Connect the Google account that receives your fitness data, then sync from this card.'}
      </Text>

      {lastSync ? <Text style={styles.meta}>Last sync: {new Date(lastSync).toLocaleString()}</Text> : null}
      {activitySummary.length > 0 ? (
        <View style={styles.summary}>
          <Text style={styles.summaryTitle}>Last 7 days</Text>
          <View style={styles.summaryGrid}>
            <SummaryMetric label="Steps" value={formatMetric(sumMetric(activitySummary, 'steps'))} />
            <SummaryMetric label="Distance" value={`${(sumMetric(activitySummary, 'distanceMeters') / 1000).toFixed(1)} km`} />
            <SummaryMetric label="Calories burned" value={`${formatMetric(sumMetric(activitySummary, 'caloriesBurned'))} kcal`} />
            <SummaryMetric label="Move Minutes" value={formatMetric(sumMetric(activitySummary, 'moveMinutes'))} />
            <SummaryMetric label="Heart Points" value={formatMetric(sumMetric(activitySummary, 'heartPoints'))} />
          </View>
          <Text style={styles.meta}>Calories include energy burned at rest when reported by Google Fit.</Text>
        </View>
      ) : null}
      <Text style={styles.legacyHint}>
        This connection uses Google’s legacy Fit API; Google announced its deprecation for 2026, so access depends on your Google project.
      </Text>

      <View style={styles.actions}>
        {!connected ? (
          <Button
            variant="primary"
            icon="link-outline"
            onPress={() => promptAsync()}
            disabled={!request || loading}
            loading={loading}
          >
            Connect Google Fit
          </Button>
        ) : (
          <>
            <Button variant="primary" icon="sync-outline" onPress={handleSync} loading={syncing} disabled={syncing}>
              Sync activity (7 days)
            </Button>
            <Button variant="ghost" icon="unlink-outline" onPress={handleDisconnect} loading={loading} disabled={loading}>
              Disconnect
            </Button>
          </>
        )}
      </View>
    </Card>
  );
}

function sumMetric(rows, key) {
  return rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
}

function formatMetric(value) {
  return Math.round(value).toLocaleString();
}

function SummaryMetric({ label, value }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>{value}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  title: { flex: 1, fontSize: font.base, fontWeight: '700', color: colors.text },
  badge: { borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badgeText: { fontSize: font.xs, fontWeight: '700', color: colors.textMuted },
  hint: { fontSize: font.sm, color: colors.textMuted, lineHeight: 18, marginBottom: spacing.sm },
  meta: { fontSize: font.xs, color: colors.textMuted, marginBottom: spacing.sm },
  summary: { borderRadius: radius.md, backgroundColor: colors.surfaceMuted, padding: spacing.sm, marginBottom: spacing.sm },
  summaryTitle: { fontSize: font.sm, fontWeight: '700', color: colors.text, marginBottom: spacing.sm },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.md },
  metric: { width: '33.33%', paddingRight: spacing.xs },
  metricValue: { fontSize: font.md, fontWeight: '800', color: colors.text },
  metricLabel: { fontSize: font.xs, color: colors.textMuted, marginTop: 2 },
  legacyHint: { fontSize: font.xs, lineHeight: 16, color: colors.warning, marginBottom: spacing.sm },
  actions: { gap: spacing.sm },
});
