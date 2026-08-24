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
  label: {
    color: '#9A9AA5',
    fontSize: 13,
    marginTop: 8,
  },
  divider: {
    color: '#6B6B75',
    fontSize: 13,
    textAlign: 'center',
    marginVertical: 4,
  },
  oauthButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingVertical: 14,
    alignItems: 'center',
  },
  oauthButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  unitToggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  unitOption: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingVertical: 12,
    alignItems: 'center',
  },
  unitOptionSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  unitOptionText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  unitOptionTextSelected: {
    color: '#0B0B0F',
  },
  signOutButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A2A2A',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 24,
  },
  signOutButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
});
