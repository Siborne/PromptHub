import { beforeEach, describe, expect, it } from 'vitest';
import { getRuntimeCapabilities } from '../../../desktop/src/renderer/runtime';

describe('web desktop runtime capability parity', () => {
  beforeEach(() => {
    Reflect.set(window, '__PROMPTHUB_WEB__', true);
  });

  it('does not advertise Desktop-owned skill surfaces in web runtime', () => {
    expect(getRuntimeCapabilities()).toMatchObject({
      agentManagement: true,
      appUpdate: false,
      dataRecovery: false,
      desktopWindowControls: false,
      skillDistribution: false,
      skillFileEditing: false,
      skillLocalScan: false,
      skillPlatformIntegration: false,
      skillStore: false,
    });
  });
});
