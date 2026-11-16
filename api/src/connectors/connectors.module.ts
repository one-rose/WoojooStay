import { Global, Module } from '@nestjs/common';
import { ChannelConnector } from './channel-connector.js';
import { CompetitorSource, SampleCompetitorSource } from './competitor-source.js';
import { CredentialVault } from './credential-vault.js';
import { SampleChannelConnector } from './sample-connector.js';

/** 지금은 모든 채널이 예시 연결을 쓴다. 실제 연결이 생기면 채널별로 바꿔 끼운다. */
@Global()
@Module({
  providers: [
    { provide: CompetitorSource, useClass: SampleCompetitorSource },

    CredentialVault,
    SampleChannelConnector,
    { provide: ChannelConnector, useExisting: SampleChannelConnector },
  ],
  exports: [CompetitorSource, CredentialVault, ChannelConnector, SampleChannelConnector],
})
export class ConnectorsModule {}
