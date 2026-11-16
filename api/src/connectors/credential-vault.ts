import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Env } from '../config/env.js';
import { Vault } from '../common/utils/crypto.js';
import type { ChannelCredentials } from './channel-connector.js';

/** 채널 계정 정보·결제 빌링키 암·복호화 (CREDENTIALS_KEY) */
@Injectable()
export class CredentialVault {
  private readonly vault: Vault;

  constructor(config: ConfigService<Env, true>) {
    this.vault = new Vault(config.get('CREDENTIALS_KEY', { infer: true }));
  }

  seal(creds: ChannelCredentials): string {
    return this.vault.encrypt(JSON.stringify(creds));
  }

  open(sealed: string): ChannelCredentials {
    return JSON.parse(this.vault.decrypt(sealed)) as ChannelCredentials;
  }

  /** PG 빌링키 등 그 밖의 비밀 값 */
  sealText(plain: string): string {
    return this.vault.encrypt(plain);
  }

  openText(sealed: string): string {
    return this.vault.decrypt(sealed);
  }
}
