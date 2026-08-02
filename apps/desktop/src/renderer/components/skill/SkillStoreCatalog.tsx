import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer, type VirtualItem } from "@tanstack/react-virtual";
import type { RegistrySkill } from "@prompthub/shared/types";
import { SkillStoreCard } from "./SkillStoreCard";
import { getRegistrySkillSelectionId } from "./skill-store-identifiers";

const STORE_GRID_GAP_PX = 12;
const STORE_GRID_ROW_HEIGHT_PX = 118;
const STORE_GRID_HEADER_HEIGHT_PX = 36;
const STORE_GRID_BOTTOM_GUTTER_PX = 24;
const STORE_CATALOG_VIRTUALIZE_THRESHOLD = 240;

type StoreCatalogRow =
  | {
      type: "section";
      key: string;
      label: string;
      count: number;
      tone: "installed" | "available";
    }
  | {
      type: "skills";
      key: string;
      skills: RegistrySkill[];
      installed: boolean;
      startIndex: number;
    };

interface SkillStoreCatalogProps {
  availableLabel: string;
  batchMode: boolean;
  hasPotentialUpdate: (skill: RegistrySkill) => boolean;
  importedLabel: string;
  installed: RegistrySkill[];
  installingSourceIds: Record<string, true>;
  isSkillInstalled: (skill: RegistrySkill) => boolean;
  onOpenSkillDetail: (skill: RegistrySkill) => void;
  onQuickInstall: (skill: RegistrySkill, event: React.MouseEvent) => void;
  onSelectSkill: (sourceId: string) => void;
  onToggleBatchSelection: (skill: RegistrySkill) => void;
  recommended: RegistrySkill[];
  scrollRef: React.RefObject<HTMLDivElement>;
  selectedSourceIds: Set<string>;
  storeLabel: string;
  storeTone: "official" | "community" | "git" | "local";
}

type CardGridProps = Omit<
  SkillStoreCatalogProps,
  "availableLabel" | "importedLabel" | "installed" | "recommended" | "scrollRef"
> & { installed: boolean; skills: RegistrySkill[]; startIndex: number };

function getStoreGridColumns(width: number): number {
  if (width >= 1200) return 4;
  if (width >= 760) return 3;
  if (width >= 640) return 2;
  return 1;
}

function appendStoreSectionRows(
  rows: StoreCatalogRow[],
  columns: number,
  key: string,
  label: string,
  skills: RegistrySkill[],
  installed: boolean,
) {
  if (skills.length === 0) return;
  rows.push({
    type: "section",
    key: `${key}-header`,
    label,
    count: skills.length,
    tone: installed ? "installed" : "available",
  });
  for (let index = 0; index < skills.length; index += columns) {
    const rowSkills = skills.slice(index, index + columns);
    rows.push({
      type: "skills",
      key: `${key}-${index}-${rowSkills.map(getRegistrySkillSelectionId).join("|")}`,
      skills: rowSkills,
      installed,
      startIndex: index,
    });
  }
}

function buildStoreCatalogRows(props: SkillStoreCatalogProps, columns: number) {
  const rows: StoreCatalogRow[] = [];
  appendStoreSectionRows(
    rows,
    columns,
    "installed",
    props.importedLabel,
    props.installed,
    true,
  );
  appendStoreSectionRows(
    rows,
    columns,
    "available",
    props.availableLabel,
    props.recommended,
    false,
  );
  return rows;
}

function SkillStoreCardGrid({
  installed,
  skills,
  startIndex,
  ...props
}: CardGridProps) {
  return skills.map((skill, itemIndex) => (
    <SkillStoreCard
      key={getRegistrySkillSelectionId(skill)}
      skill={skill}
      isInstalled={installed || props.isSkillInstalled(skill)}
      hasUpdate={installed ? props.hasPotentialUpdate(skill) : undefined}
      index={startIndex + itemIndex}
      batchMode={props.batchMode}
      isSelected={props.selectedSourceIds.has(
        getRegistrySkillSelectionId(skill),
      )}
      storeLabel={props.storeLabel}
      storeTone={props.storeTone}
      installingSourceIds={props.installingSourceIds}
      onOpenDetail={props.onOpenSkillDetail}
      onQuickInstall={installed ? undefined : props.onQuickInstall}
      onClick={() =>
        props.batchMode
          ? props.onToggleBatchSelection(skill)
          : props.onSelectSkill(getRegistrySkillSelectionId(skill))
      }
    />
  ));
}

function StaticCatalogSection({
  installed,
  label,
  skills,
  ...props
}: CardGridProps & { label: string }) {
  if (skills.length === 0) return null;
  return (
    <section>
      <div className="mb-4 flex items-center gap-2">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
          {label}
        </h3>
        <span
          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${installed ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"}`}
        >
          {skills.length}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <SkillStoreCardGrid
          {...props}
          installed={installed}
          skills={skills}
          startIndex={0}
        />
      </div>
    </section>
  );
}

function StaticSkillStoreCatalog(props: SkillStoreCatalogProps) {
  return (
    <div className="space-y-8">
      <StaticCatalogSection
        {...props}
        installed={true}
        label={props.importedLabel}
        skills={props.installed}
        startIndex={0}
      />
      <StaticCatalogSection
        {...props}
        installed={false}
        label={props.availableLabel}
        skills={props.recommended}
        startIndex={0}
      />
    </div>
  );
}

function useCatalogMeasurements(
  scrollRef: React.RefObject<HTMLDivElement>,
  catalogRef: React.RefObject<HTMLDivElement>,
) {
  const [measurements, setMeasurements] = useState({ width: 0, margin: 0 });
  useEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    const update = () =>
      setMeasurements({
        width: Math.max(0, node.clientWidth || window.innerWidth || 1024),
        margin: catalogRef.current?.offsetTop ?? 0,
      });
    update();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [catalogRef, scrollRef]);
  return measurements;
}

function VirtualSectionHeader({
  row,
}: {
  row: Extract<StoreCatalogRow, { type: "section" }>;
}) {
  return (
    <div className="flex items-center gap-2">
      <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
        {row.label}
      </h3>
      <span
        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${row.tone === "installed" ? "bg-green-500/10 text-green-500" : "bg-primary/10 text-primary"}`}
      >
        {row.count}
      </span>
    </div>
  );
}

function VirtualCatalogRow({
  columns,
  row,
  virtualRow,
  ...props
}: CardGridProps & {
  columns: number;
  measureElement: (node: Element | null) => void;
  row: StoreCatalogRow;
  scrollMargin: number;
  virtualRow: VirtualItem;
}) {
  return (
    <div
      data-index={virtualRow.index}
      data-testid="skill-store-virtual-row"
      ref={props.measureElement}
      className="absolute left-0 right-0"
      style={{
        top: 0,
        transform: `translateY(${virtualRow.start - props.scrollMargin}px)`,
      }}
    >
      {row.type === "section" ? (
        <VirtualSectionHeader row={row} />
      ) : (
        <div
          className="grid"
          style={{
            gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
            gap: `${STORE_GRID_GAP_PX}px`,
          }}
        >
          <SkillStoreCardGrid
            {...props}
            installed={row.installed}
            skills={row.skills}
            startIndex={row.startIndex}
          />
        </div>
      )}
    </div>
  );
}

interface VirtualCatalogProps extends SkillStoreCatalogProps {
  catalogRef: React.RefObject<HTMLDivElement>;
  columns: number;
  rows: StoreCatalogRow[];
  scrollMargin: number;
}

function VirtualizedSkillStoreCatalog(props: VirtualCatalogProps) {
  const rowVirtualizer = useVirtualizer({
    count: props.rows.length,
    getScrollElement: () => props.scrollRef.current,
    scrollMargin: props.scrollMargin,
    estimateSize: (index) =>
      props.rows[index]?.type === "section"
        ? STORE_GRID_HEADER_HEIGHT_PX
        : STORE_GRID_ROW_HEIGHT_PX + STORE_GRID_GAP_PX,
    overscan: 5,
    getItemKey: (index) => props.rows[index]?.key ?? `store-row-${index}`,
  });
  return (
    <div
      ref={props.catalogRef}
      className="relative w-full"
      data-testid="skill-store-virtual-catalog"
      style={{
        height: `${rowVirtualizer.getTotalSize() + STORE_GRID_BOTTOM_GUTTER_PX}px`,
      }}
    >
      {rowVirtualizer.getVirtualItems().map((virtualRow) => {
        const row = props.rows[virtualRow.index];
        return row ? (
          <VirtualCatalogRow
            key={virtualRow.key}
            {...props}
            installed={false}
            measureElement={rowVirtualizer.measureElement}
            skills={[]}
            startIndex={0}
            row={row}
            virtualRow={virtualRow}
          />
        ) : null;
      })}
    </div>
  );
}

function SkillStoreCatalogView(props: SkillStoreCatalogProps) {
  const catalogRef = useRef<HTMLDivElement | null>(null);
  const { width, margin } = useCatalogMeasurements(props.scrollRef, catalogRef);
  const columns = useMemo(() => getStoreGridColumns(width || 1024), [width]);
  const rows = useMemo(
    () => buildStoreCatalogRows(props, columns),
    [
      columns,
      props.availableLabel,
      props.importedLabel,
      props.installed,
      props.recommended,
    ],
  );
  if (
    props.installed.length + props.recommended.length <=
    STORE_CATALOG_VIRTUALIZE_THRESHOLD
  ) {
    return <StaticSkillStoreCatalog {...props} />;
  }
  return (
    <VirtualizedSkillStoreCatalog
      {...props}
      catalogRef={catalogRef}
      columns={columns}
      rows={rows}
      scrollMargin={margin}
    />
  );
}

export const SkillStoreCatalog = memo(SkillStoreCatalogView);
