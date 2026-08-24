import { StyleSheet } from 'react-native';

// Shared by ExerciseLibraryScreen/ExerciseFormScreen: same dark palette as
// authStyles/AccountSettingsScreen. Not the final Progresso visual design.
export const exerciseStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0B0F',
    paddingHorizontal: 24,
    paddingTop: 60,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  backLink: {
    color: '#9A9AA5',
    fontSize: 14,
  },
  label: {
    color: '#9A9AA5',
    fontSize: 13,
    marginTop: 8,
    marginBottom: 4,
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
    marginBottom: 12,
  },
  chipRow: {
    gap: 8,
    paddingBottom: 12,
  },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  chipText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  chipTextSelected: {
    color: '#0B0B0F',
  },
  sourceRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  sourceOption: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingVertical: 10,
    alignItems: 'center',
  },
  sourceOptionSelected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#FFFFFF',
  },
  sourceOptionText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  sourceOptionTextSelected: {
    color: '#0B0B0F',
  },
  listItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23',
  },
  listItemName: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listItemMeta: {
    color: '#9A9AA5',
    fontSize: 13,
    marginTop: 2,
  },
  listItemBadge: {
    color: '#6B6B75',
    fontSize: 12,
  },
  emptyText: {
    color: '#9A9AA5',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
  },
  createButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginVertical: 16,
  },
  createButtonText: {
    color: '#0B0B0F',
    fontSize: 16,
    fontWeight: '600',
  },
  error: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 8,
  },
  button: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 16,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#0B0B0F',
    fontSize: 16,
    fontWeight: '600',
  },
  deactivateButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A2A2A',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  deactivateButtonText: {
    color: '#FF6B6B',
    fontSize: 16,
    fontWeight: '600',
  },
  reactivateButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  reactivateButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
