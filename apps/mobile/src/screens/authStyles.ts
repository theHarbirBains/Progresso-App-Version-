import { StyleSheet } from 'react-native';

// Shared by SignInScreen/SignUpScreen: same form layout, same dark palette
// as the rest of the Phase 0 shell. Not the final Progresso visual design.
export const authStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#17171C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A32',
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#0B0B0F',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#FF6B6B',
    fontSize: 14,
  },
  info: {
    color: '#9A9AA5',
    fontSize: 14,
  },
  link: {
    color: '#9A9AA5',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 20,
  },
});
