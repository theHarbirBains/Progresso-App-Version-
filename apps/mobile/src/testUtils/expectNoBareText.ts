import { screen } from '@testing-library/react-native';

interface Node {
  type: string;
  props?: { testID?: string };
  children?: (Node | string)[] | null;
}

function findBareText(node: Node | string | null, parent: string | null, path: string): string[] {
  if (node === null) return [];
  if (typeof node === 'string') {
    return parent === 'Text' || parent === 'TextInput'
      ? []
      : [`${path} -> ${JSON.stringify(node)}`];
  }
  const here = `${path}/${node.type}${node.props?.testID ? `#${node.props.testID}` : ''}`;
  return (node.children ?? []).flatMap((child) => findBareText(child, node.type, here));
}

/**
 * React Native throws "Text strings must be rendered within a <Text>
 * component" on device when a string (even a lone space from `{' '}`) is a
 * direct child of a <View>. react-test-renderer does not enforce that rule,
 * so a plain render assertion passes while the app crashes -- this applies it
 * to whatever is currently rendered.
 */
export function expectNoBareText(): void {
  const json = screen.toJSON() as Node | Node[] | null;
  const roots = Array.isArray(json) ? json : [json];
  const offenders = roots.flatMap((root) => findBareText(root, null, ''));
  expect(offenders).toEqual([]);
}
