import { PlusIcon } from "lucide-react";
import { useTranslation } from "react-i18next";

import { Button } from "../ui";
import { ContextMenu } from "../ui/ContextMenu";

interface AgentProviderWorkbenchActionsProps {
  busy: boolean;
  onAdd(): void;
  onImport?: () => void;
}

export interface AgentProviderContextMenuPosition {
  x: number;
  y: number;
}

export function AgentProviderToolbarActions({
  busy,
  onAdd,
  onImport,
}: AgentProviderWorkbenchActionsProps) {
  const { t } = useTranslation();
  const actions = [
    ...(onImport
      ? [
          {
            label: t("agents.providerProfiles.sourceImport.open"),
            onClick: onImport,
          },
        ]
      : []),
    {
      label: t("agents.providerProfiles.addCustom"),
      onClick: onAdd,
    },
  ];

  return actions.map((action) => (
    <Button
      key={action.label}
      size="sm"
      variant="secondary"
      className="w-full min-w-0"
      aria-label={action.label}
      title={action.label}
      onClick={action.onClick}
      disabled={busy}
    >
      <PlusIcon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 truncate">{action.label}</span>
    </Button>
  ));
}

export function AgentProviderContextMenu({
  busy,
  position,
  onAdd,
  onImport,
  onClose,
}: AgentProviderWorkbenchActionsProps & {
  position: AgentProviderContextMenuPosition | null;
  onClose(): void;
}) {
  const { t } = useTranslation();
  if (!position) return null;

  return (
    <ContextMenu
      x={position.x}
      y={position.y}
      onClose={onClose}
      items={[
        ...(onImport
          ? [
              {
                label: t("agents.providerProfiles.sourceImport.open"),
                icon: <PlusIcon className="h-4 w-4" />,
                onClick: onImport,
                disabled: busy,
              },
            ]
          : []),
        {
          label: t("agents.providerProfiles.addCustom"),
          icon: <PlusIcon className="h-4 w-4" />,
          onClick: onAdd,
          disabled: busy,
        },
      ]}
    />
  );
}
