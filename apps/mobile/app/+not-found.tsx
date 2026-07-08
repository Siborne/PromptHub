import { Stack } from 'expo-router';
import { useTranslation } from 'react-i18next';

import { AppScreen } from '@/components/AppScreen';
import { AppText } from '@/components/AppText';

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <>
      <Stack.Screen options={{ title: t('common.notFound') }} />
      <AppScreen>
        <AppText variant="title">{t('common.notFound')}</AppText>
        <AppText variant="muted">{t('common.notFoundDescription')}</AppText>
      </AppScreen>
    </>
  );
}
