import { useState } from 'react';
import { View, type StyleProp, type TextStyle } from 'react-native';
import { TextButton } from '../../design/Button';
import { Text } from '../../design/Text';
import { leadSentence } from './display';

/**
 * Its first sentence, and the rest a tap away (More / Less) -- the pages stay short, and nothing
 * the source says is cut. Several paragraphs (Health Canada's notes) show the first's first
 * sentence; More shows them all.
 */
export function MoreText({
  paragraphs,
  style,
  label = 'More',
  testID,
}: {
  paragraphs: string[];
  style: StyleProp<TextStyle>;
  /** What the tap says while it's short ("More", "Health Canada’s notes"). */
  label?: string;
  testID: string;
}) {
  const [open, setOpen] = useState(false);
  if (paragraphs.length === 0) return null;
  const { lead, rest } = leadSentence(paragraphs[0]);
  const hasMore = rest !== null || paragraphs.length > 1;
  return (
    <View testID={testID}>
      {open ? (
        paragraphs.map((paragraph, index) => (
          <Text key={index} style={style}>
            {paragraph}
          </Text>
        ))
      ) : (
        <Text style={style}>{lead}</Text>
      )}
      {hasMore ? (
        <TextButton
          testID={`${testID}-more`}
          label={open ? 'Less' : label}
          accessibilityLabel={open ? 'Show less' : `${label}: read it all`}
          onPress={() => setOpen((value) => !value)}
        />
      ) : null}
    </View>
  );
}
