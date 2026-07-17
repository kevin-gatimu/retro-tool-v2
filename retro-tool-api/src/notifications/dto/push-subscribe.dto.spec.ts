import { pushSubscribeSchema } from './push-subscribe.dto';

describe('pushSubscribeSchema', () => {
  it('accepts a well-formed subscription', () => {
    const result = pushSubscribeSchema.safeParse({
      endpoint: 'https://push.example.com/abc123',
      p256dh: 'key-material',
      auth: 'auth-secret',
    });
    expect(result.success).toBe(true);
  });

  it('rejects a non-URL endpoint', () => {
    const result = pushSubscribeSchema.safeParse({
      endpoint: 'not-a-url',
      p256dh: 'key-material',
      auth: 'auth-secret',
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty key fields', () => {
    const result = pushSubscribeSchema.safeParse({
      endpoint: 'https://push.example.com/abc123',
      p256dh: '',
      auth: '',
    });
    expect(result.success).toBe(false);
  });
});
