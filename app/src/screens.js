import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { RuleIcon } from './RuleIcon.js';
import { THEMES, THEME_IDS, lookOf } from './themes.js';
import { texts } from '../../src/app/texts.js';

const stars = (count, total = 3) => '★'.repeat(count) + '☆'.repeat(total - count);

/** The level list: today's puzzle, then every stage with its levels. */
export function LevelsScreen({
  model,
  theme,
  onPickLevel,
  onPickDaily,
  onClose,
  onSettings,
  onLeaderboard,
  onEditor,
  onFinished
}) {
  const t = THEMES[theme];
  return (
    <View style={[styles.full, { backgroundColor: t.bottom }]}>
      <Header
        title={texts.levelsButton}
        theme={t}
        onClose={onClose}
        extra={
          <>
            {onLeaderboard ? (
              <Pressable
                onPress={onLeaderboard}
                hitSlop={10}
                accessibilityLabel={texts.leaderboardTitle}
              >
                <Text style={[styles.headerIcon, { color: t.ink }]}>🏆</Text>
              </Pressable>
            ) : null}
            <Pressable onPress={onSettings} hitSlop={10} accessibilityLabel="Settings">
              <Text style={[styles.headerIcon, { color: t.ink }]}>⚙</Text>
            </Pressable>
          </>
        }
      />
      <ScrollView contentContainerStyle={styles.scroll}>
        {model.daily ? (
          <Pressable
            style={[styles.card, { backgroundColor: t.panel, borderColor: t.line }]}
            onPress={onPickDaily}
          >
            <View style={{ flex: 1 }}>
              <Text style={[styles.cardTitle, { color: t.ink }]}>{model.daily.title}</Text>
              <Text style={[styles.cardNote, { color: t.muted }]}>{model.daily.date}</Text>
              {model.daily.result ? (
                <Text style={[styles.cardNote, { color: t.muted }]}>
                  {model.daily.result.text} {stars(model.daily.result.stars)}
                </Text>
              ) : null}
              {model.daily.streak ? (
                <Text style={[styles.cardNote, { color: t.muted }]}>{model.daily.streak}</Text>
              ) : null}
            </View>
            <Text style={[styles.pill, { backgroundColor: t.accent, color: t.accentInk }]}>
              {model.daily.action}
            </Text>
          </Pressable>
        ) : null}

        {model.finished ? <ModelCard card={model.finished} theme={t} onPress={onFinished} /> : null}
        {model.editor && onEditor ? (
          <ModelCard card={model.editor} theme={t} onPress={onEditor} />
        ) : null}

        {model.chapters.map((chapter) => (
          <View key={chapter.id} style={styles.chapter}>
            <View style={styles.chapterHead}>
              <Text style={[styles.chapterName, { color: t.ink }]}>{chapter.name}</Text>
              <Text style={[styles.cardNote, { color: t.muted }]}>{chapter.progress}</Text>
            </View>
            <Text style={[styles.cardNote, { color: t.muted }]}>{chapter.detail}</Text>
            <View style={styles.grid}>
              {chapter.levels.map((tile) => (
                <LevelTile
                  key={tile.level}
                  tile={tile}
                  color={t.stages[chapter.id] ?? t.accent}
                  theme={t}
                  onPress={() => onPickLevel(tile.level)}
                />
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

function ModelCard({ card, theme, onPress }) {
  return (
    <Pressable
      style={[styles.card, { backgroundColor: theme.panel, borderColor: theme.line }]}
      onPress={onPress}
    >
      <View style={{ flex: 1 }}>
        <Text style={[styles.cardTitle, { color: theme.ink }]}>{card.title}</Text>
        <Text style={[styles.cardNote, { color: theme.muted }]}>{card.text}</Text>
      </View>
      <Text style={[styles.pill, { backgroundColor: theme.accent, color: theme.accentInk }]}>
        {card.action}
      </Text>
    </Pressable>
  );
}

function LevelTile({ tile, color, theme, onPress }) {
  const locked = tile.state === 'locked';
  const solved = tile.state === 'solved';
  return (
    <Pressable
      disabled={locked}
      onPress={onPress}
      accessibilityLabel={tile.label}
      style={[
        styles.tile,
        solved ? { backgroundColor: color } : { borderColor: locked ? theme.line : color },
        tile.playing && { borderColor: theme.ink, borderWidth: 3 },
        locked && { opacity: 0.4 }
      ]}
    >
      <Text style={[styles.tileNumber, { color: solved ? '#0b1430' : theme.ink }]}>
        {tile.level}
      </Text>
      {solved && tile.stars > 0 ? (
        <Text style={styles.tileStars}>{'★'.repeat(tile.stars)}</Text>
      ) : null}
      {locked ? <Text style={[styles.tileStars, { color: theme.muted }]}>🔒</Text> : null}
    </Pressable>
  );
}

/** What a level brings, or everything about the level from the info button. */
export function RulesModal({ model, theme, onClose }) {
  const t = THEMES[theme];
  return (
    <View style={styles.overlay}>
      <View style={[styles.dialog, { backgroundColor: t.panel }]}>
        <Text style={[styles.dialogTitle, { color: t.ink }]}>{model.title}</Text>
        <ScrollView style={{ maxHeight: 420 }}>
          {model.rules.map((rule) => (
            <View key={rule.id} style={styles.ruleRow}>
              <RuleIcon rule={rule.id} look={lookOf(theme)} />
              <View style={[styles.rule, { flex: 1 }]}>
                <Text style={[styles.ruleName, { color: t.ink }]}>{rule.name}</Text>
                <Text style={[styles.ruleText, { color: t.muted }]}>{rule.text}</Text>
              </View>
            </View>
          ))}
          {model.info && model.stars ? (
            <View style={styles.rule}>
              {model.stars.map((row) => (
                <Text key={row.stars} style={[styles.ruleText, { color: t.muted }]}>
                  {stars(row.stars)} {row.text}
                </Text>
              ))}
            </View>
          ) : model.info && model.starsPending ? (
            <Text style={[styles.ruleText, { color: t.muted }]}>{model.starsPending}</Text>
          ) : null}
          {model.info && model.supplies?.length
            ? model.supplies.map((line) => (
                <Text key={line} style={[styles.ruleText, { color: t.muted }]}>
                  {line}
                </Text>
              ))
            : null}
        </ScrollView>
        <Pressable style={[styles.primary, { backgroundColor: t.accent }]} onPress={onClose}>
          <Text style={[styles.primaryText, { color: t.accentInk }]}>{model.action}</Text>
        </Pressable>
      </View>
    </View>
  );
}

/** Theme, sounds, vibration, symbols and language. */
export function SettingsScreen({ settings, theme, onChange, onClose, account }) {
  const t = THEMES[theme];
  return (
    <View style={[styles.full, { backgroundColor: t.bottom }]}>
      <Header title="Settings" theme={t} onClose={onClose} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Group title="Language" theme={t}>
          {[
            ['en', 'English'],
            ['tr', 'Türkçe']
          ].map(([id, label]) => (
            <Choice
              key={id}
              label={label}
              selected={settings.language === id}
              theme={t}
              onPress={() => onChange({ language: id })}
            />
          ))}
        </Group>
        <Group title="Theme" theme={t}>
          {THEME_IDS.map((id) => (
            <Choice
              key={id}
              label={THEMES[id].name}
              selected={settings.theme === id}
              theme={t}
              swatch={[
                THEMES[id].look.palette[0],
                THEMES[id].look.palette[1],
                THEMES[id].look.palette[2]
              ]}
              onPress={() => onChange({ theme: id })}
            />
          ))}
        </Group>
        <SwitchRow
          label="Sounds"
          value={settings.sound}
          theme={t}
          onValueChange={(sound) => onChange({ sound })}
        />
        <SwitchRow
          label="Vibration"
          value={settings.haptics}
          theme={t}
          onValueChange={(haptics) => onChange({ haptics })}
        />
        {account ? <AccountSection account={account} theme={t} /> : null}
        <SwitchRow
          label="Add symbols to colors"
          note="Draws a shape on every color, if they are hard to tell apart."
          value={settings.symbols}
          theme={t}
          onValueChange={(symbols) => onChange({ symbols })}
        />
      </ScrollView>
    </View>
  );
}

function Header({ title, theme, onClose, extra }) {
  return (
    <View style={styles.header}>
      <Text style={[styles.headerTitle, { color: theme.ink }]}>{title}</Text>
      <View style={styles.headerActions}>
        {extra}
        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
          <Text style={[styles.headerIcon, { color: theme.ink }]}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Group({ title, theme, children }) {
  return (
    <View style={{ gap: 8 }}>
      <Text style={[styles.groupTitle, { color: theme.muted }]}>{title.toUpperCase()}</Text>
      {children}
    </View>
  );
}

function Choice({ label, selected, theme, swatch, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choice,
        { backgroundColor: theme.panel, borderColor: selected ? theme.accent : theme.line }
      ]}
    >
      <Text style={[styles.radio, { color: selected ? theme.accent : theme.muted }]}>
        {selected ? '◉' : '○'}
      </Text>
      <Text style={[styles.choiceLabel, { color: theme.ink }]}>{label}</Text>
      {swatch ? (
        <View style={styles.swatch}>
          {swatch.map((color) => (
            <View key={color} style={[styles.swatchDot, { backgroundColor: color }]} />
          ))}
        </View>
      ) : null}
    </Pressable>
  );
}

function SwitchRow({ label, note, value, theme, onValueChange }) {
  return (
    <View style={{ gap: 4 }}>
      <View style={styles.switchRow}>
        <Text style={[styles.choiceLabel, { color: theme.ink }]}>{label}</Text>
        <Switch value={value} onValueChange={onValueChange} trackColor={{ true: theme.accent }} />
      </View>
      {note ? <Text style={[styles.cardNote, { color: theme.muted }]}>{note}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  finishMark: { fontSize: 52, fontWeight: '800' },
  finishStats: { flexDirection: 'row', gap: 32, marginVertical: 8 },
  finishNumber: { fontSize: 22, fontWeight: '800' },
  account: { gap: 10, padding: 16, borderRadius: 16, borderWidth: 1 },
  accountActions: { flexDirection: 'row', justifyContent: 'space-between' },
  accountLink: { fontWeight: '700' },
  accountError: { color: '#ef4444', fontSize: 13 },
  google: {
    backgroundColor: '#ffffff',
    paddingVertical: 12,
    borderRadius: 22,
    alignItems: 'center'
  },
  googleText: { color: '#1f1f1f', fontWeight: '700' },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1
  },
  rank: { width: 22, fontWeight: '800' },
  who: { flex: 1, fontWeight: '700' },
  points: { fontWeight: '800' },
  full: { ...StyleSheet.absoluteFillObject },
  scroll: { padding: 16, gap: 18, paddingBottom: 48 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 14
  },
  headerTitle: { fontSize: 26, fontWeight: '800' },
  headerActions: { flexDirection: 'row', gap: 18, alignItems: 'center' },
  headerIcon: { fontSize: 22 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    borderRadius: 18,
    borderWidth: 1
  },
  cardTitle: { fontSize: 18, fontWeight: '800' },
  cardNote: { fontSize: 13 },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    overflow: 'hidden',
    fontWeight: '800'
  },
  chapter: { gap: 6 },
  chapterHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  chapterName: { fontSize: 20, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 6 },
  tile: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center'
  },
  tileNumber: { fontSize: 17, fontWeight: '800' },
  tileStars: { fontSize: 9, color: '#0b1430' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5,3,20,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24
  },
  dialog: { width: '100%', maxWidth: 420, borderRadius: 24, padding: 22, gap: 14 },
  dialogTitle: { fontSize: 24, fontWeight: '800' },
  rule: { gap: 4, marginBottom: 12 },
  ruleRow: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  ruleName: { fontSize: 17, fontWeight: '800' },
  ruleText: { fontSize: 15, lineHeight: 21 },
  primary: { paddingVertical: 14, borderRadius: 22, alignItems: 'center' },
  primaryText: { fontWeight: '800', fontSize: 16 },
  groupTitle: { fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  choice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: 16,
    borderWidth: 2
  },
  radio: { fontSize: 18 },
  choiceLabel: { fontSize: 16, fontWeight: '700', flex: 1 },
  swatch: { flexDirection: 'row', gap: 4 },
  swatchDot: { width: 14, height: 14, borderRadius: 7 },
  switchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 6
  }
});

/** Sign in with Google, pick a username, and see how the sync is doing. */
function AccountSection({ account, theme }) {
  const [name, setName] = useState('');
  const { state, sync, message } = account;
  const signedIn = state.user !== null;
  const needsName = state.status === 'needsName';
  return (
    <Group title={texts.accountTitle ?? 'Account'} theme={theme}>
      <View style={[styles.account, { backgroundColor: theme.panel, borderColor: theme.line }]}>
        {!signedIn ? (
          <>
            <Text style={[styles.cardNote, { color: theme.muted }]}>{texts.accountSignedOut}</Text>
            <Pressable
              disabled={state.status === 'signingIn' || !account.available}
              style={[
                styles.google,
                (state.status === 'signingIn' || !account.available) && { opacity: 0.5 }
              ]}
              onPress={account.onSignIn}
            >
              <Text style={styles.googleText}>
                {account.available
                  ? 'Sign in with Google'
                  : 'Google sign-in is not set up in this build'}
              </Text>
            </Pressable>
          </>
        ) : (
          <>
            <Text style={[styles.choiceLabel, { color: theme.ink }]}>
              {state.username
                ? texts.accountSignedInAs(`@${state.username}`)
                : texts.accountSignedIn}
            </Text>
            <Pressable onPress={account.onRetry}>
              <Text
                style={[styles.cardNote, { color: sync === 'failed' ? '#ef4444' : theme.muted }]}
              >
                {needsName ? texts.accountNeedsName : texts.accountSyncStatus(sync)}
              </Text>
            </Pressable>
            {needsName ? (
              <View style={{ gap: 8 }}>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                  placeholder="username"
                  placeholderTextColor={theme.muted}
                  style={[styles.input, { color: theme.ink, borderColor: theme.line }]}
                />
                <Pressable
                  style={[styles.primary, { backgroundColor: theme.accent }]}
                  onPress={() => account.onSaveName(name)}
                >
                  <Text style={[styles.primaryText, { color: theme.accentInk }]}>Save</Text>
                </Pressable>
              </View>
            ) : null}
            <View style={styles.accountActions}>
              <Pressable onPress={account.onSignOut}>
                <Text style={[styles.accountLink, { color: theme.ink }]}>Sign out</Text>
              </Pressable>
              <Pressable onPress={account.onDelete}>
                <Text style={[styles.accountLink, { color: '#ef4444' }]}>Delete my account</Text>
              </Pressable>
            </View>
          </>
        )}
        {message || state.error ? (
          <Text style={styles.accountError}>{message ?? texts.accountError(state.error)}</Text>
        ) : null}
      </View>
    </Group>
  );
}

/** Today's result and the day's ranking, or the player's own days without an account. */
export function LeaderboardScreen({ data, theme, onPlayDaily, onSignIn, onClose }) {
  const t = THEMES[theme];
  const view = data?.view;
  return (
    <View style={[styles.full, { backgroundColor: t.bottom }]}>
      <Header title={texts.leaderboardTitle} theme={t} onClose={onClose} />
      <ScrollView contentContainerStyle={styles.scroll}>
        {!view ? (
          <Text style={[styles.cardNote, { color: t.muted }]}>…</Text>
        ) : (
          <>
            <View style={[styles.account, { backgroundColor: t.panel, borderColor: t.line }]}>
              {view.today ? (
                <Text style={[styles.choiceLabel, { color: t.ink }]}>
                  {texts.dailyToday(view.today.moves, view.today.seconds, view.today.score)}{' '}
                  {stars(view.today.stars)}
                </Text>
              ) : (
                <>
                  <Text style={[styles.cardNote, { color: t.muted }]}>{texts.dailyNotSolved}</Text>
                  <Pressable
                    style={[styles.primary, { backgroundColor: t.accent }]}
                    onPress={onPlayDaily}
                  >
                    <Text style={[styles.primaryText, { color: t.accentInk }]}>
                      {texts.playDaily}
                    </Text>
                  </Pressable>
                </>
              )}
              {view.streak > 0 ? (
                <Text style={[styles.cardNote, { color: t.muted }]}>
                  {texts.dailyStreak(view.streak)}
                </Text>
              ) : null}
            </View>

            {view.online && !data.username ? (
              <View style={[styles.account, { backgroundColor: t.panel, borderColor: t.line }]}>
                <Text style={[styles.cardNote, { color: t.muted }]}>
                  {data.signedIn ? texts.leaderboardNeedsName : texts.leaderboardSignIn}
                </Text>
                <Pressable
                  style={[styles.primary, { backgroundColor: t.accent }]}
                  onPress={onSignIn}
                >
                  <Text style={[styles.primaryText, { color: t.accentInk }]}>
                    {data.signedIn ? texts.pickUsername : texts.signInToRank}
                  </Text>
                </Pressable>
              </View>
            ) : null}

            {view.online ? (
              <Group title={texts.leaderboardTop} theme={t}>
                {view.failed ? (
                  <Text style={[styles.cardNote, { color: t.muted }]}>
                    {texts.leaderboardFailed}
                  </Text>
                ) : view.top.length === 0 ? (
                  <Text style={[styles.cardNote, { color: t.muted }]}>
                    {texts.leaderboardEmpty}
                  </Text>
                ) : (
                  <>
                    {view.rank !== null ? (
                      <Text style={[styles.choiceLabel, { color: t.accent }]}>
                        {texts.leaderboardMyRank(view.rank)}
                      </Text>
                    ) : null}
                    {view.top.map((row, index) => (
                      <View
                        key={`${row.name}-${index}`}
                        style={[styles.scoreRow, { backgroundColor: t.panel, borderColor: t.line }]}
                      >
                        <Text style={[styles.rank, { color: t.muted }]}>{index + 1}</Text>
                        <Text style={[styles.who, { color: t.ink }]} numberOfLines={1}>
                          {row.name}
                        </Text>
                        <Text style={[styles.cardNote, { color: t.muted }]}>
                          {texts.attemptMoves(row.moves)} · {texts.duration(row.seconds)}
                        </Text>
                        <Text style={[styles.points, { color: t.accent }]}>
                          {texts.points(row.score)}
                        </Text>
                      </View>
                    ))}
                    <Text style={[styles.cardNote, { color: t.muted }]}>
                      {texts.leaderboardHow}
                    </Text>
                  </>
                )}
              </Group>
            ) : (
              <Group title={texts.dailyHistory} theme={t}>
                {view.history.length === 0 ? (
                  <Text style={[styles.cardNote, { color: t.muted }]}>{texts.dailyNoHistory}</Text>
                ) : (
                  view.history.map((row) => (
                    <View
                      key={row.day}
                      style={[styles.scoreRow, { backgroundColor: t.panel, borderColor: t.line }]}
                    >
                      <Text style={[styles.who, { color: t.ink }]}>{texts.dailyDate(row.day)}</Text>
                      <Text style={[styles.cardNote, { color: t.muted }]}>
                        {texts.attemptMoves(row.moves)} · {texts.duration(row.seconds)}
                      </Text>
                      <Text style={{ color: t.star }}>{stars(row.stars)}</Text>
                    </View>
                  ))
                )}
                <Text style={[styles.cardNote, { color: t.muted }]}>
                  {texts.leaderboardLocalOnly}
                </Text>
              </Group>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

/** What a player gets for finishing every level. */
export function FinishScreen({ summary, theme, onShare, onLevels, onClose }) {
  const t = THEMES[theme];
  return (
    <View style={styles.overlay}>
      <View style={[styles.dialog, { backgroundColor: t.panel, alignItems: 'center' }]}>
        <Text style={styles.finishMark}>
          {[
            ['W', '#ef4444'],
            ['a', '#fb923c'],
            ['s', '#fde047'],
            ['o', '#22c55e'],
            ['r', '#38bdf8'],
            ['t', '#6366f1'],
            ['y', '#d946ef']
          ].map(([letter, color]) => (
            <Text key={letter + color} style={{ color }}>
              {letter}
            </Text>
          ))}
        </Text>
        <Text style={[styles.dialogTitle, { color: t.ink }]}>{texts.finishTitle}</Text>
        <Text style={[styles.cardNote, { color: t.muted }]}>{texts.finishText(summary.total)}</Text>
        <View style={styles.finishStats}>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.cardNote, { color: t.muted }]}>{texts.finishStars}</Text>
            <Text style={[styles.finishNumber, { color: t.ink }]}>
              {summary.stars} / {summary.maxStars}
            </Text>
          </View>
          <View style={{ alignItems: 'center' }}>
            <Text style={[styles.cardNote, { color: t.muted }]}>{texts.finishPerfect}</Text>
            <Text style={[styles.finishNumber, { color: t.ink }]}>
              {summary.perfect} / {summary.total}
            </Text>
          </View>
        </View>
        <Pressable
          style={[styles.primary, { backgroundColor: t.accent, alignSelf: 'stretch' }]}
          onPress={onShare}
        >
          <Text style={[styles.primaryText, { color: t.accentInk }]}>{texts.finishShare}</Text>
        </Pressable>
        <Pressable onPress={onLevels}>
          <Text style={[styles.accountLink, { color: t.ink }]}>{texts.finishLevels}</Text>
        </Pressable>
        <Pressable onPress={onClose} hitSlop={10}>
          <Text style={[styles.cardNote, { color: t.muted }]}>✕</Text>
        </Pressable>
      </View>
    </View>
  );
}
