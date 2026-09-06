import { StyleSheet } from 'react-native';

// Scoped to WelcomeScreen only, same original dark palette as
// authStyles.ts/signUpStyles.ts (#0B0B0F/#17171C/#2A2A32/#FFFFFF/#9A9AA5) --
// deliberately not the newer Dashboard "Dark + Electric" tokens, since the
// global theme isn't being locked in yet. Kept independent from
// signUpStyles.ts on purpose, matching this repo's existing
// one-stylesheet-per-screen convention.
export const welcomeStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 24,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    color: '#9A9AA5',
    fontSize: 16,
    textAlign: 'center',
  },
  features: {
    gap: 16,
    marginBottom: 44,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: '#17171C',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingVertical: 16,
    paddingHorizontal: 16,
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1F1F26',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonText: {
    color: '#0B0B0F',
    fontSize: 16,
    fontWeight: '700',
  },
});
