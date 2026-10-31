import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { RuleIcon } from './RuleIcon.js';
import { THEMES, THEME_IDS, lookOf } from './themes.js';
import { texts } from '../../src/app/texts.js';

const stars = (count, total = 3) => '★'.repeat(count) + '☆'.repeat(total - count);

/** The level list: today's puzzle, then every stage with its levels. */
export function LevelsScreen({ model, theme, onPickLevel, onPickDaily, onClose, onSettings }) {
  const t = THEMES[theme];
  return (
    <View style={[styles.full, { backgroundColor: t.bottom }]}>
      <Header
        title={texts.levelsButton}
        theme={t}
        onClose={onClose}
        extra={
          <Pressable onPress={onSettings} hitSlop={10} accessibilityLabel="Settings">
            <Text style={[styles.headerIcon, { color: t.ink }]}>⚙</Text>
          </Pressable>
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
export function SettingsScreen({ settings, theme, onChange, onClose }) {
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
