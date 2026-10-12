import { Injectable } from '@nestjs/common';
import { LinkStatus, TrainerStudent } from '@prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { AuthUser } from '../auth/auth-user';
import { ForbiddenError, NotFoundError } from '../errors/domain-errors';

const VISIBLE_LINK_STATUSES: LinkStatus[] = [LinkStatus.ACTIVE, LinkStatus.PENDING];

/**
 * Isolamento multi-tenant. Regras:
 *  - Aluno acessa somente os próprios dados.
 *  - Professor acessa somente alunos vinculados (trainer_students ativo/pendente).
 *  - Admin não acessa dados de alunos por esta via (apenas métricas agregadas).
 */
@Injectable()
export class AccessPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  async assertTrainerCanAccessStudent(trainerId: string, studentId: string): Promise<TrainerStudent> {
    const link = await this.prisma.trainerStudent.findUnique({
      where: { trainerId_studentId: { trainerId, studentId } },
    });
    if (!link || !VISIBLE_LINK_STATUSES.includes(link.status)) {
      // 404 em vez de 403 para não revelar a existência do aluno em outro tenant
      throw new NotFoundError('Aluno');
    }
    return link;
  }

  /** Inclui vínculos inativos (histórico): usado em leituras do professor sobre ex-alunos. */
  async assertTrainerHasLink(trainerId: string, studentId: string): Promise<TrainerStudent> {
    const link = await this.prisma.trainerStudent.findUnique({
      where: { trainerId_studentId: { trainerId, studentId } },
    });
    if (!link) throw new NotFoundError('Aluno');
    return link;
  }

  /**
   * Resolve o aluno-alvo de uma requisição:
   *  - aluno: sempre ele mesmo (ignora/valida studentId informado);
   *  - professor: studentId obrigatório e vinculado.
   */
  async resolveStudentId(user: AuthUser, studentId?: string | null): Promise<string> {
    if (user.role === 'STUDENT') {
      if (!user.studentId) throw new ForbiddenError('Perfil de aluno não encontrado');
      if (studentId && studentId !== user.studentId) throw new NotFoundError('Aluno');
      return user.studentId;
    }
    if (user.role === 'TRAINER') {
      if (!studentId) throw new ForbiddenError('Informe o aluno (studentId)');
      await this.assertTrainerCanAccessStudent(this.requireTrainer(user), studentId);
      return studentId;
    }
    throw new ForbiddenError();
  }

  requireTrainer(user: AuthUser): string {
    if (user.role !== 'TRAINER' || !user.trainerId) throw new ForbiddenError('Apenas professores');
    return user.trainerId;
  }

  requireStudent(user: AuthUser): string {
    if (user.role !== 'STUDENT' || !user.studentId) throw new ForbiddenError('Apenas alunos');
    return user.studentId;
  }

  /** Professor principal (vínculo ativo mais recente) do aluno. */
  async primaryLinkForStudent(studentId: string): Promise<TrainerStudent | null> {
    return this.prisma.trainerStudent.findFirst({
      where: { studentId, status: LinkStatus.ACTIVE },
      orderBy: { startedAt: 'desc' },
    });
  }

  /** Verifica se o usuário participa da conversa (vínculo). */
  async assertConversationMember(user: AuthUser, trainerStudentId: string): Promise<TrainerStudent> {
    const link = await this.prisma.trainerStudent.findUnique({ where: { id: trainerStudentId } });
    const isMember =
      link &&
      ((user.role === 'TRAINER' && link.trainerId === user.trainerId) ||
        (user.role === 'STUDENT' && link.studentId === user.studentId));
    if (!link || !isMember) throw new NotFoundError('Conversa');
    return link;
  }
}
