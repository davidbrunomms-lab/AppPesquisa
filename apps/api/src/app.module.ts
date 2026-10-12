import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AccessModule } from './common/access/access.module';
import { AuditModule } from './common/audit/audit.service';
import { JwtAuthGuard } from './common/auth/jwt-auth.guard';
import { RolesGuard } from './common/auth/roles.guard';
import { CryptoModule } from './common/crypto/crypto.module';
import { DomainErrorFilter } from './common/errors/domain-error.filter';
import { ConfigModule } from './config/config.module';
import { InfrastructureModule } from './infrastructure/infrastructure.module';
import { PrismaModule } from './infrastructure/prisma/prisma.module';
import { AccountModule } from './modules/account/account.module';
import { AssessmentsModule } from './modules/assessments/assessments.module';
import { ExercisesModule } from './modules/exercises/exercises.module';
import { FilesModule } from './modules/files/files.module';
import { GoalsModule } from './modules/goals/goals.module';
import { ProgressModule } from './modules/progress/progress.module';
import { SessionsModule } from './modules/sessions/sessions.module';
import { StudentsModule } from './modules/students/students.module';
import { TrainersModule } from './modules/trainers/trainers.module';
import { WorkoutsModule } from './modules/workouts/workouts.module';
import { AdminModule } from './modules/admin/admin.module';
import { AiModule } from './modules/ai/ai.module';
import { ChatModule } from './modules/chat/chat.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { JobsModule } from './modules/jobs/jobs.module';
import { NotesModule } from './modules/notes/notes.module';
import { ReportsModule } from './modules/reports/reports.module';
import { AgendaModule } from './modules/schedule/agenda.module';
import { AuthModule } from './modules/auth/auth.module';
import { InvitesModule } from './modules/invites/invites.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    CryptoModule,
    AuditModule,
    AccessModule,
    InfrastructureModule,
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 300 }]),
    NotificationsModule,
    SubscriptionsModule,
    InvitesModule,
    AuthModule,
    AccountModule,
    AssessmentsModule,
    ExercisesModule,
    FilesModule,
    GoalsModule,
    ProgressModule,
    SessionsModule,
    StudentsModule,
    TrainersModule,
    WorkoutsModule,
    AdminModule,
    AiModule,
    ChatModule,
    DashboardModule,
    JobsModule,
    NotesModule,
    ReportsModule,
    AgendaModule,
  ],
  providers: [
    // Ordem: rate limit → autenticação JWT → autorização por perfil
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: DomainErrorFilter },
  ],
})
export class AppModule {}
