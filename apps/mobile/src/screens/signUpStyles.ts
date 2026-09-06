import { StyleSheet } from 'react-native';

// Scoped to SignUpScreen only -- deliberately NOT authStyles.ts, since that
// file is shared by SignIn/ForgotPassword/ResetPassword and this task is
// explicitly scoped to Create Account alone. Same original dark palette as
// authStyles.ts (#0B0B0F/#17171C/#2A2A32/#FFFFFF/#9A9AA5/#FF6B6B) --
// deliberately not the newer Dashboard "Dark + Electric" tokens, since the
// global theme isn't being locked in yet.
export const signUpStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0B0F',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 20,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 26,
    fontWeight: '700',
    marginBottom: 6,
  },
  subtitle: {
    color: '#9A9AA5',
    fontSize: 15,
    textAlign: 'center',
  },
  field: {
    marginBottom: 16,
  },
  label: {
    color: '#9A9AA5',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#17171C',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A32',
  },
  inputRowFocused: {
    borderColor: '#4A4A55',
  },
  inputRowError: {
    borderColor: '#5A2E2E',
  },
  input: {
    flex: 1,
    color: '#FFFFFF',
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 16,
  },
  visibilityToggle: {
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  fieldError: {
    color: '#FF6B6B',
    fontSize: 13,
    marginTop: 6,
  },
  formError: {
    color: '#FF6B6B',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    minHeight: 52,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#0B0B0F',
    fontSize: 16,
    fontWeight: '700',
  },
  footer: {
    alignItems: 'center',
    marginTop: 28,
  },
  footerText: {
    color: '#9A9AA5',
    fontSize: 14,
    marginBottom: 4,
  },
  footerLink: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  confirmationTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  confirmationText: {
    color: '#9A9AA5',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
});
