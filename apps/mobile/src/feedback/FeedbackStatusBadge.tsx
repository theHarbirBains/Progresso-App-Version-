import { Badge } from '../design/Badge';
import { colors } from '../design/theme';
import { useAppTheme } from '../theme/appThemeContext';
import { STATUS_LABELS, isActiveStatus, type FeedbackStatus } from './feedbackLabels';

/** A submission's status as a small badge: in the accent while it's being worked on, quiet otherwise. */
export function FeedbackStatusBadge({
  status,
  testID,
}: {
  status: FeedbackStatus;
  testID?: string;
}) {
  const { accent } = useAppTheme();
  const active = isActiveStatus(status);
  return (
    <Badge
      testID={testID}
      label={STATUS_LABELS[status]}
      color={
        active ? accent.accent : status === 'declined' ? colors.textMuted : colors.textSecondary
      }
      backgroundColor={active ? accent.accentBg : colors.surfaceRaised}
    />
  );
}
