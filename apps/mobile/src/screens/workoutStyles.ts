import { StyleSheet } from 'react-native';

// Shared by the Phase 3 workout screens: same dark palette as authStyles/
// exerciseStyles. Not the final Progresso visual design.
export const workoutStyles = StyleSheet.create({
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
  numberInput: {
    backgroundColor: '#17171C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A32',
    color: '#FFFFFF',
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    textAlign: 'center',
    width: 64,
  },
  banner: {
    backgroundColor: '#17171C',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A32',
    padding: 14,
    marginBottom: 16,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 8,
  },
  listItem: {
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1D1D23',
  },
  listItemTitle: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  listItemMeta: {
    color: '#9A9AA5',
    fontSize: 13,
    marginTop: 2,
  },
  emptyText: {
    color: '#9A9AA5',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 32,
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
  secondaryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  error: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 8,
  },
  info: {
    color: '#9A9AA5',
    fontSize: 14,
    marginBottom: 8,
  },
  card: {
    backgroundColor: '#17171C',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#2A2A32',
    padding: 14,
    marginBottom: 14,
  },
  cardTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  cardMeta: {
    color: '#9A9AA5',
    fontSize: 13,
    marginTop: 2,
  },
  cardMetaHighlight: {
    color: '#FFD166',
    fontSize: 13,
    marginTop: 4,
    fontWeight: '600',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#1D1D23',
  },
  setIndexText: {
    color: '#6B6B75',
    fontSize: 14,
    width: 20,
  },
  foodLogInfo: {
    flex: 1,
  },
  setUnitText: {
    color: '#9A9AA5',
    fontSize: 13,
  },
  setDeleteText: {
    color: '#FF6B6B',
    fontSize: 13,
    marginLeft: 'auto',
  },
  addSetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingTop: 10,
  },
  addSetButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addSetButtonText: {
    color: '#0B0B0F',
    fontSize: 14,
    fontWeight: '600',
  },
  removeExerciseText: {
    color: '#FF6B6B',
    fontSize: 13,
  },
  reorderRow: {
    flexDirection: 'row',
    gap: 12,
  },
  reorderButtonText: {
    color: '#9A9AA5',
    fontSize: 13,
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
});
