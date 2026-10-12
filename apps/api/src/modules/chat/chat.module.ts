import { Module } from '@nestjs/common';
import { ChatGateway } from './application/chat.gateway';
import { ChatService } from './application/chat.service';
import { ChatController } from './presentation/chat.controller';

@Module({ controllers: [ChatController], providers: [ChatService, ChatGateway] })
export class ChatModule {}
