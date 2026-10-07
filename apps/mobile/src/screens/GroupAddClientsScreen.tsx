import { useCallback, useEffect, useMemo, useState } from 'react';
import { SectionList, StyleSheet, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useAuth } from '../auth/AuthProvider';
import { AppCard } from '../design/AppCard';
import { AppHeader } from '../design/AppHeader';
import { PrimaryButton } from '../design/Button';
import { EmptyState } from '../design/EmptyState';
import { ErrorState } from '../design/ErrorState';
import { ListRow } from '../design/ListRow';
import { LoadingState } from '../design/LoadingState';
import { Screen } from '../design/Screen';
import { Text } from '../design/Text';
import { TextInput } from '../design/TextInput';
import { colors, spacing, typeScale, widgetGap } from '../design/theme';
import {
  addClientToGroup,
  getGroup,
  getTrainerStatus,
  listTrainerClients,
  type TrainerClient,
} from '../lib/api';
import type { RootStackScreenProps } from '../navigation/types';
import { useProgressTheme } from '../progress/useProgressTheme';
import {
  clientName,
  filterClientsByName,
  groupClientsByLetter,
  pickableClients,
  type ClientSection,
} from '../trainer/clientPicker';
import { trainerClientStatusLabel } from '../trainer/trainerLabels';

type Props = RootStackScreenProps<'GroupAddClients'>;

/**
 * Adds several of a trainer's clients to a group at once. Built for long lists: the
 * clients are sorted by name, grouped by letter with the A–Z rail, and filtered by a
 * search that matches anywhere in the name. Nothing is added until the button is pressed.
 */
export function GroupAddClientsScreen({ navigation, route }: Props) {
  const { groupId } = route.params;
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const { theme } = useProgressTheme();

  const [clients, setClients] = useState<TrainerClient[] | null>(null);
  const [inGroup, setInGroup] = useState<Set<string>>(new Set());
  const [isTrainer, setIsTrainer] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    if (!accessToken) return;
    setError(null);
    try {
      const [status, group] = await Promise.all([
        getTrainerStatus(accessToken),
        getGroup(accessToken, groupId),
      ]);
      setIsTrainer(status.isTrainer);
      setInGroup(new Set(group.members.map((member) => member.userId)));
      setClients(status.isTrainer ? await listTrainerClients(accessToken) : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load your clients');
    }
  }, [accessToken, groupId]);

  useEffect(() => {
    void load();
  }, [load]);

  const pickable = useMemo(() => pickableClients(clients ?? [], inGroup), [clients, inGroup]);
  const filtered = useMemo(() => filterClientsByName(pickable, query), [pickable, query]);
  const sections = useMemo(() => groupClientsByLetter(filtered), [filtered]);

  function toggle(clientId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(clientId)) next.delete(clientId);
      else next.add(clientId);
      return next;
    });
  }

  async function addSelected() {
    if (!accessToken || adding || selected.size === 0) return;
    setAdding(true);
    setError(null);
    const remaining: string[] = [];
    let failure: string | null = null;
    for (const clientId of selected) {
      try {
        await addClientToGroup(accessToken, groupId, clientId);
      } catch (err) {
        remaining.push(clientId);
        failure = err instanceof Error ? err.message : 'Could not add a client';
      }
    }
    setAdding(false);
    if (failure) {
      setSelected(new Set(remaining));
      setError(`Some clients were not added: ${failure}`);
      return;
    }
    navigation.goBack();
  }

  const selectedCount = selected.size;

  return (
    <Screen
      scroll={false}
      padded={false}
      header={
        <AppHeader
          title="Add Clients"
          subtitle={clients ? `${pickable.length} available` : undefined}
          onBack={() => navigation.goBack()}
          testID="group-add-clients-header"
        />
      }
    >
      <View style={styles.body}>
        {error ? <ErrorState testID="group-add-clients-error" message={error} /> : null}

        {!clients && !error ? <LoadingState testID="group-add-clients-loading" /> : null}

        {clients && !isTrainer ? (
          <EmptyState
            testID="group-add-clients-not-trainer"
            title="Clients need a Trainer subscription"
            description="Your clients appear here once trainer mode is on for your account."
          />
        ) : null}

        {clients && isTrainer && pickable.length === 0 ? (
          <EmptyState
            testID="group-add-clients-none"
            title={clients.length === 0 ? 'No clients yet' : 'Everyone is already in this group'}
            description={
              clients.length === 0
                ? 'Add clients from the Clients screen to bring them in.'
                : undefined
            }
          />
        ) : null}

        {clients && isTrainer && pickable.length > 0 ? (
          <>
            <AppCard testID="group-add-clients-search" style={styles.search}>
              <TextInput
                testID="group-add-clients-search-input"
                label="Find a client"
                value={query}
                onChangeText={(text) => {
                  setQuery(text);
                }}
                autoCapitalize="words"
                placeholder="Type a name"
              />
              <Text style={styles.count}>
                {filtered.length === pickable.length
                  ? `${pickable.length} clients`
                  : `${filtered.length} of ${pickable.length} match`}
              </Text>
            </AppCard>

            <View style={styles.listWrap}>
              {sections.length === 0 ? (
                <Text style={styles.muted}>No client has that name.</Text>
              ) : (
                <SectionList
                  testID="group-add-clients-list"
                  sections={sections}
                  keyExtractor={(client) => client.clientId ?? clientName(client)}
                  keyboardShouldPersistTaps="handled"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={styles.listContent}
                  renderSectionHeader={({ section }) => (
                    <Text style={[styles.letter, { color: theme.accent }]}>{section.letter}</Text>
                  )}
                  renderItem={({ item, index, section }) => {
                    const id = item.clientId as string;
                    const checked = selected.has(id);
                    return (
                      <ListRow
                        testID={`group-add-client-row-${id}`}
                        title={clientName(item)}
                        subtitle={trainerClientStatusLabel(item)}
                        divider={index > 0 || section.data.length > 0}
                        onPress={() => toggle(id)}
                        accessibilityLabel={`${clientName(item)}${checked ? ', selected' : ''}`}
                        trailing={
                          <Feather
                            name={checked ? 'check-circle' : 'circle'}
                            size={22}
                            color={checked ? theme.accent : colors.textMuted}
                          />
                        }
                      />
                    );
                  }}
                />
              )}
            </View>

            <View style={styles.footer}>
              <PrimaryButton
                testID="group-add-clients-submit"
                label={
                  selectedCount === 0 ? 'Select clients to add' : `Add ${selectedCount} to Group`
                }
                onPress={() => void addSelected()}
                disabled={selectedCount === 0 || adding}
                loading={adding}
                accentColor={theme.accent}
                onAccentColor={theme.onAccent}
              />
            </View>
          </>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    paddingHorizontal: spacing.xxl,
    gap: widgetGap,
  },
  search: {
    gap: spacing.sm,
  },
  count: {
    ...typeScale.caption,
    color: colors.textMuted,
  },
  listWrap: {
    flex: 1,
    flexDirection: 'row',
  },
  listContent: {
    paddingRight: spacing.xl,
    paddingBottom: spacing.xl,
  },
  letter: {
    ...typeScale.sectionHeading,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  footer: {
    paddingVertical: spacing.md,
  },
  muted: {
    ...typeScale.secondary,
    color: colors.textMuted,
    paddingVertical: spacing.lg,
  },
});
