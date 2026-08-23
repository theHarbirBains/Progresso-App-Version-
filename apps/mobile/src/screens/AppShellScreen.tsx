import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';

// Placeholder authenticated shell for Phase 0 — proves sign-in works end to
// end. The real dashboard is a later milestone.
export function AppShellScreen() {
  const { user, signOut } = useAuth();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Progresso</Text>
      <Text testID="app-shell-email" style={styles.subtitle}>
        Signed in as {user?.email}
      </Text>

      <TouchableOpacity testID="sign-out-button" style={styles.button} onPress={() => signOut()}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
  },
  subtitle: {
    color: '#9A9AA5',
    fontSize: 14,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  buttonText: {
    color: '#0B0B0F',
    fontSize: 16,
    fontWeight: '600',
  },
});
