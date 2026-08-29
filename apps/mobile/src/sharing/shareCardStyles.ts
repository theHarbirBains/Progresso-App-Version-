import { StyleSheet } from 'react-native';

// Deliberately simple -- functional sharing infrastructure, not the final
// Progresso visual design. Reuses the same dark palette as workoutStyles.ts
// (#0B0B0F background, #17171C surface, #FFD166 highlight accent) so the
// card doesn't look out of place next to the rest of the app. The later
// design phase is expected to replace this file's contents wholesale.
export const shareCardStyles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0B0B0F',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 24,
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
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    color: '#FF6B6B',
    fontSize: 14,
    marginBottom: 12,
    textAlign: 'center',
  },
  retryButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  cardWrapper: {
    alignItems: 'center',
    marginVertical: 12,
  },
  // 9:16 -- the same aspect ratio the card is captured at (1080x1920), just
  // rendered at a screen-friendly width. The preview IS the captured view,
  // not a separate representation of it.
  card: {
    width: 320,
    aspectRatio: 1080 / 1920,
    backgroundColor: '#0B0B0F',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#2A2A32',
    padding: 20,
    justifyContent: 'space-between',
  },
  wordmark: {
    color: '#9A9AA5',
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 3,
  },
  cardTop: {
    gap: 4,
  },
  workoutName: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '700',
    marginTop: 12,
  },
  workoutDate: {
    color: '#9A9AA5',
    fontSize: 13,
  },
  musclesTrained: {
    color: '#9A9AA5',
    fontSize: 13,
    marginTop: 2,
  },
  topSetsSection: {
    marginTop: 18,
    gap: 8,
  },
  sectionLabel: {
    color: '#6B6B75',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 2,
  },
  topSetRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  topSetExercise: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flexShrink: 1,
    paddingRight: 8,
  },
  topSetValue: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  prSection: {
    marginTop: 16,
    gap: 4,
  },
  prLine: {
    color: '#FFD166',
    fontSize: 13,
    fontWeight: '700',
  },
  footer: {
    color: '#9A9AA5',
    fontSize: 12,
    marginTop: 16,
  },
  actions: {
    marginTop: 20,
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.5,
  },
  actionButtonText: {
    color: '#0B0B0F',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryActionButton: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#2A2A32',
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryActionButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  statusText: {
    color: '#9A9AA5',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  savedText: {
    color: '#7CE0A6',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
  actionError: {
    color: '#FF6B6B',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 8,
  },
});
