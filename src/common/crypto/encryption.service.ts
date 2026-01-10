import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor(private readonly configService: ConfigService) {
    const rawKey = this.configService.get<string>('ENCRYPTION_KEY');
    if (!rawKey) {
      throw new Error('ENCRYPTION_KEY is not set');
    }
    this.key = this.parseKey(rawKey);
    if (this.key.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 32 bytes');
    }
  }

  encrypt(value: string) {
    const iv = randomBytes(12);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(value ?? '', 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return {
      cipherText: encrypted.toString('base64'),
      iv: iv.toString('base64'),
      tag: tag.toString('base64'),
    };
  }

  decrypt(payload: { cipherText: string; iv: string; tag: string }) {
    if (!payload.cipherText || !payload.iv || !payload.tag) {
      return '';
    }
    const decipher = createDecipheriv(
      this.algorithm,
      this.key,
      Buffer.from(payload.iv, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.cipherText, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  private parseKey(rawKey: string) {
    if (/^[0-9a-fA-F]{64}$/.test(rawKey)) {
      return Buffer.from(rawKey, 'hex');
    }

    const base64 = Buffer.from(rawKey, 'base64');
    if (base64.length === 32) {
      return base64;
    }

    return Buffer.from(rawKey, 'utf8');
  }
}
