import { Stack } from 'expo-router';

export default function PromptsLayout() {
  return (
    <Stack>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[id]"
        options={{
          headerShown: true,
          title: 'Prompt',
          headerBackTitle: 'Back'
        }}
      />
      <Stack.Screen
        name="edit"
        options={{
          presentation: 'modal',
          headerShown: true,
          title: 'Edit Prompt'
        }}
      />
    </Stack>
  );
}
