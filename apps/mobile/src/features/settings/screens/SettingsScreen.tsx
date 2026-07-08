import { useTranslation } from 'react-i18next';

import { AppScreen } from '@/components/AppScreen';
import {
  MetricCard,
  MetricGrid,
  SegmentPills,
  WorkbenchHeader,
  WorkItemRow,
  WorkPanel,
} from '@/components/WorkbenchChrome';
import { mobileCapabilities } from '@/platform/mobileCapabilities';
import { useThemePalette } from '@/theme/colors';

export function SettingsScreen() {
  const { t } = useTranslation();
  const palette = useThemePalette();

  return (
    <AppScreen>
      <WorkbenchHeader
        description={t('settings.subtitle')}
        eyebrow={t('common.system')}
        title={t('settings.title')}
      />

      <SegmentPills
        active="Android"
        items={['Android', 'iOS', t('settings.sync'), t('settings.files')]}
      />

      <MetricGrid>
        <MetricCard label={t('settings.metrics.storage')} value={mobileCapabilities.durableStorage} />
        <MetricCard label={t('settings.metrics.files')} value={mobileCapabilities.canPickDocuments ? 'ON' : 'OFF'} />
        <MetricCard label={t('settings.metrics.share')} value={mobileCapabilities.canShareFiles ? 'ON' : 'OFF'} />
      </MetricGrid>

      <WorkPanel label={t('settings.platform')}>
        <WorkItemRow
          accent={palette.accentSoft}
          description={t('settings.platformCopy')}
          meta="Expo 57"
          symbol={{ ios: 'iphone', android: 'smartphone', web: 'smartphone' }}
          title={mobileCapabilities.primaryTarget}
        />
        <WorkItemRow
          accent={palette.surfacePressed}
          description={t('settings.dataCopy')}
          meta="SQLite"
          symbol={{ ios: 'externaldrive', android: 'database', web: 'database' }}
          title={t('settings.dataLayer')}
        />
      </WorkPanel>
    </AppScreen>
  );
}
