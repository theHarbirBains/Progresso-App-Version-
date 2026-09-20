import { useEffect, useState } from 'react';
import { Image, type StyleProp, type TextStyle } from 'react-native';
import { Text } from './Text';
import { Feather } from '@expo/vector-icons';

interface Props {
  /** The profile picture URL, or null/undefined to show the existing fallback. */
  uri?: string | null;
  /** Pre-computed initial letter (e.g. displayName's first char) shown when there's no picture. Null falls back to the person icon. */
  initial: string | null;
  /** Exact pixel size of the square/circular image -- every call site passes its own existing avatar container's size so the fallback path renders identically to before. */
  size: number;
  iconSize: number;
  iconColor: string;
  initialStyle?: StyleProp<TextStyle>;
  testID?: string;
}

// Shared by every place a profile picture (or its fallback) is shown
// (ProfileScreen, DashboardScreen, AccountCategory) -- decides only what
// renders INSIDE an existing avatar container (image vs. initial-letter
// text vs. person icon); background color, border, and outer layout stay
// exactly as each call site already had them. Falls back to the
// initial/icon if the image fails to load (a deleted/missing remote file),
// rather than showing a broken image.
export function Avatar({ uri, initial, size, iconSize, iconColor, initialStyle, testID }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (uri && !failed) {
    return (
      <Image
        testID={testID}
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        accessibilityRole="image"
        accessibilityLabel="Profile picture"
        onError={() => setFailed(true)}
      />
    );
  }

  if (initial) {
    return (
      <Text testID={testID} style={initialStyle}>
        {initial}
      </Text>
    );
  }

  return <Feather testID={testID} name="user" size={iconSize} color={iconColor} />;
}
