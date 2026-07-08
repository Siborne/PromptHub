import { SymbolView } from "expo-symbols";
import { type ComponentProps, type PropsWithChildren, useMemo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText } from "@/components/AppText";
import { useThemePalette, type ThemePalette } from "@/theme/colors";

type SymbolName = ComponentProps<typeof SymbolView>["name"];

const ROW_ACTION_SYMBOLS: Record<
  NonNullable<WorkItemRowProps["action"]>,
  SymbolName
> = {
  download: { ios: "arrow.down.to.line", android: "download", web: "download" },
  installed: { ios: "checkmark", android: "check", web: "check" },
  more: { ios: "ellipsis", android: "more_horiz", web: "more_horiz" },
};

interface WorkbenchHeaderProps {
  eyebrow: string;
  meta?: string;
  title: string;
  description: string;
  onAction?: () => void;
}

interface MetricCardProps {
  label: string;
  tone?: "default" | "accent" | "success";
  value: string;
}

interface WorkItemRowProps {
  accent?: string;
  action?: "download" | "installed" | "more";
  chips?: string[];
  description: string;
  favorite?: boolean;
  meta?: string;
  source?: string;
  symbol: SymbolName;
  title: string;
  onPress?: () => void;
}

export function WorkbenchHeader({
  description,
  eyebrow,
  meta,
  title,
  onAction,
}: WorkbenchHeaderProps) {
  const palette = useThemePalette();
  const styles = useStyles(palette);

  return (
    <View style={styles.header}>
      <View style={styles.headerTop}>
        <View style={styles.headerCopy}>
          <AppText variant="caption" style={styles.headerEyebrow}>{eyebrow.toUpperCase()}</AppText>
          <AppText variant="display" style={styles.headerTitle}>{title}</AppText>
        </View>
        <View style={styles.headerActions}>
          {meta ? (
            <View style={styles.headerMeta}>
              <AppText variant="mono" style={{ color: palette.muted }}>{meta}</AppText>
            </View>
          ) : null}
          <Pressable style={styles.headerAction} onPress={onAction}>
            <SymbolView
              name={{ ios: "plus", android: "add", web: "add" }}
              size={24}
              tintColor={palette.accent}
              weight="semibold"
            />
          </Pressable>
        </View>
      </View>
      <AppText variant="muted" style={styles.headerDescription}>
        {description}
      </AppText>
    </View>
  );
}

export function SearchDock({ placeholder }: { placeholder: string }) {
  const palette = useThemePalette();
  const styles = useStyles(palette);

  return (
    <View style={styles.searchDock}>
      <SymbolView
        name={{ ios: "magnifyingglass", android: "search", web: "search" }}
        size={20}
        tintColor={palette.muted}
        weight="medium"
      />
      <AppText variant="muted" style={styles.searchText}>
        {placeholder}
      </AppText>
      <Pressable style={styles.searchFilter}>
        <SymbolView
          name={{
            ios: "line.3.horizontal.decrease",
            android: "tune",
            web: "tune",
          }}
          size={18}
          tintColor={palette.accent}
          weight="medium"
        />
      </Pressable>
    </View>
  );
}

export function SegmentPills({
  active,
  items,
}: {
  active: string;
  items: string[];
}) {
  const palette = useThemePalette();
  const styles = useStyles(palette);

  return (
    <View style={styles.pillRow}>
      {items.map((item) => (
        <Pressable
          key={item}
          style={[styles.pill, item === active ? styles.pillActive : undefined]}
        >
          <AppText
            variant="caption"
            style={[
              styles.pillText,
              item === active ? styles.pillTextActive : undefined
            ]}
          >
            {item}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

export function MetricGrid({ children }: PropsWithChildren) {
  const palette = useThemePalette();
  const styles = useStyles(palette);
  return <View style={styles.metricGrid}>{children}</View>;
}

export function MetricCard({
  label,
  tone = "default",
  value,
}: MetricCardProps) {
  const palette = useThemePalette();
  const styles = useStyles(palette);

  return (
    <View style={styles.metricCard}>
      <AppText variant="caption" style={{ color: palette.subtle, fontWeight: "500", marginBottom: 4 }}>
        {label}
      </AppText>
      <AppText variant="title" style={{ color: tone === 'accent' ? palette.accent : tone === 'success' ? palette.success : palette.text }}>
        {value}
      </AppText>
    </View>
  );
}

export function WorkPanel({
  children,
  label,
}: PropsWithChildren<{ label: string }>) {
  const palette = useThemePalette();
  const styles = useStyles(palette);

  return (
    <View style={styles.panelContainer}>
      <AppText variant="subtitle" style={styles.panelHeaderLabel}>{label}</AppText>
      <View style={styles.panel}>
        {children}
      </View>
    </View>
  );
}

export function WorkItemRow({
  accent,
  action = "more",
  chips = [],
  description,
  favorite = false,
  meta,
  source,
  symbol,
  title,
  onPress,
}: WorkItemRowProps) {
  const palette = useThemePalette();
  const styles = useStyles(palette);
  const actionName = ROW_ACTION_SYMBOLS[action];
  const activeAccent = accent || palette.accent;

  return (
    <Pressable style={({ pressed }) => [styles.workRow, pressed ? { opacity: 0.7 } : undefined]} onPress={onPress}>
      <View style={[styles.workIcon, { backgroundColor: activeAccent + '20' }]}>
        <SymbolView name={symbol} size={22} tintColor={activeAccent} weight="medium" />
      </View>
      <View style={styles.workCopy}>
        <View style={styles.workTitleLine}>
          <AppText variant="subtitle" style={styles.workTitle} numberOfLines={1}>
            {title}
          </AppText>
          {meta ? <AppText variant="mono" style={styles.workMetaText}>{meta}</AppText> : null}
        </View>
        <AppText variant="muted" numberOfLines={2} style={styles.workDesc}>
          {description}
        </AppText>
        <View style={styles.workMetaLine}>
          {source ? <AppText variant="caption" style={{ color: palette.subtle }}>{source}</AppText> : null}
          {chips.slice(0, 3).map((chip) => (
            <View key={chip} style={styles.chip}>
              <AppText variant="mono" style={{ color: palette.muted, fontSize: 11 }}>{chip}</AppText>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.trailingActions}>
        {favorite ? (
          <SymbolView
            name={{ ios: "star.fill", android: "star", web: "star" }}
            size={18}
            tintColor={palette.warning}
          />
        ) : null}
        <Pressable style={styles.rowAction}>
          <SymbolView
            name={actionName}
            size={20}
            tintColor={action === "installed" ? palette.success : palette.muted}
          />
        </Pressable>
      </View>
    </Pressable>
  );
}

function useStyles(palette: ThemePalette) {
  return useMemo(() => StyleSheet.create({
    header: {
      gap: 8,
      paddingBottom: 16,
      paddingTop: 12,
    },
    headerTop: {
      alignItems: "center",
      flexDirection: "row",
      justifyContent: "space-between",
    },
    headerCopy: {
      flex: 1,
      gap: 2,
    },
    headerEyebrow: {
      color: palette.subtle,
      fontWeight: '600',
      letterSpacing: 0.5,
      fontSize: 12,
    },
    headerTitle: {
      fontSize: 34,
      fontWeight: "800",
      letterSpacing: 0.25,
      color: palette.text,
    },
    headerActions: {
      alignItems: "center",
      flexDirection: "row",
      gap: 12,
    },
    headerMeta: {
      backgroundColor: palette.backgroundRaised,
      borderRadius: 16,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    headerAction: {
      alignItems: "center",
      backgroundColor: palette.surfacePressed,
      borderRadius: 16, // iOS squircle look
      height: 40,
      justifyContent: "center",
      width: 40,
    },
    headerDescription: {
      maxWidth: "90%",
      fontSize: 16,
      lineHeight: 22,
      color: palette.muted,
      marginTop: 4,
    },
    searchDock: {
      alignItems: "center",
      backgroundColor: palette.surfacePressed,
      borderRadius: 12, // iOS search bar radius
      flexDirection: "row",
      gap: 10,
      minHeight: 44,
      paddingHorizontal: 14,
      marginBottom: 16,
    },
    searchText: {
      flex: 1,
      fontSize: 17,
      color: palette.text,
    },
    searchFilter: {
      alignItems: "center",
      height: 28,
      justifyContent: "center",
      width: 28,
    },
    pillRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginBottom: 20,
    },
    pill: {
      backgroundColor: palette.backgroundRaised,
      borderRadius: 16,
      paddingHorizontal: 16,
      paddingVertical: 8,
    },
    pillActive: {
      backgroundColor: palette.text,
    },
    pillText: {
      color: palette.text,
      fontWeight: "500",
      fontSize: 14,
    },
    pillTextActive: {
      color: palette.background, // Invert color for active
      fontWeight: "600",
    },
    metricGrid: {
      flexDirection: "row",
      gap: 12,
      marginBottom: 24,
    },
    metricCard: {
      backgroundColor: palette.surface,
      borderRadius: 20, // Modern iOS widget radius
      flex: 1,
      padding: 16,
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.04,
      shadowRadius: 12,
      elevation: 2,
    },
    panelContainer: {
      gap: 12,
      marginBottom: 24,
    },
    panelHeaderLabel: {
      fontSize: 20,
      fontWeight: "700",
      color: palette.text,
      paddingHorizontal: 4,
    },
    panel: {
      backgroundColor: palette.surface,
      borderRadius: 20,
      overflow: 'hidden',
      shadowColor: palette.shadow,
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.03,
      shadowRadius: 8,
      elevation: 1,
    },
    workRow: {
      alignItems: "flex-start", // align top like iOS lists
      backgroundColor: palette.surface,
      flexDirection: "row",
      gap: 14,
      padding: 16,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: palette.border,
    },
    workIcon: {
      alignItems: "center",
      borderRadius: 12,
      height: 44,
      justifyContent: "center",
      width: 44,
    },
    workCopy: {
      flex: 1,
      gap: 4,
    },
    workTitle: {
      flex: 1,
      fontSize: 17,
      fontWeight: "600",
      color: palette.text,
    },
    workTitleLine: {
      alignItems: "center",
      flexDirection: "row",
      gap: 8,
      height: 22,
    },
    workDesc: {
      fontSize: 15,
      lineHeight: 20,
      color: palette.muted,
    },
    workMetaLine: {
      alignItems: "center",
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 4,
    },
    workMetaText: {
      color: palette.subtle,
      fontSize: 13,
    },
    chip: {
      backgroundColor: palette.backgroundRaised,
      borderRadius: 6,
      paddingHorizontal: 6,
      paddingVertical: 2,
    },
    trailingActions: {
      alignItems: "flex-end",
      justifyContent: "space-between",
      height: "100%",
      paddingVertical: 2,
      gap: 12,
    },
    rowAction: {
      alignItems: "center",
      height: 24,
      justifyContent: "center",
      width: 24,
    },
  }), [palette]);
}
