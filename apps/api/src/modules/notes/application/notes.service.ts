import { Injectable } from '@nestjs/common';
import { TrainerNote } from '@prisma/client';
import { AccessPolicyService } from '../../../common/access/access-policy.service';
import { EncryptionService } from '../../../common/crypto/encryption.service';
import { NotFoundError } from '../../../common/errors/domain-errors';
import { PrismaService } from '../../../infrastructure/prisma/prisma.service';

/**
 * Anotações privadas do professor sobre o aluno (ex.: "Relatou desconforto no ombro").
 * Visíveis apenas ao professor autor e criptografadas em repouso (AES-256-GCM).
 */
@Injectable()
export class NotesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AccessPolicyService,
    private readonly encryption: EncryptionService,
  ) {}

  private serialize(note: TrainerNote) {
    return { ...note, content: this.encryption.decrypt(note.content) };
  }

  async list(trainerId: string, studentId: string) {
    await this.access.assertTrainerHasLink(trainerId, studentId);
    const notes = await this.prisma.trainerNote.findMany({
      where: { trainerId, studentId },
      orderBy: [{ pinned: 'desc' }, { createdAt: 'desc' }],
    });
    return notes.map((n) => this.serialize(n));
  }

  async create(trainerId: string, studentId: string, content: string, pinned = false) {
    await this.access.assertTrainerHasLink(trainerId, studentId);
    const note = await this.prisma.trainerNote.create({
      data: { trainerId, studentId, content: this.encryption.encrypt(content.trim()), pinned },
    });
    return this.serialize(note);
  }

  async update(trainerId: string, id: string, data: { content?: string; pinned?: boolean }) {
    await this.own(trainerId, id);
    const note = await this.prisma.trainerNote.update({
      where: { id },
      data: { content: data.content ? this.encryption.encrypt(data.content.trim()) : undefined, pinned: data.pinned },
    });
    return this.serialize(note);
  }

  async remove(trainerId: string, id: string) {
    await this.own(trainerId, id);
    await this.prisma.trainerNote.delete({ where: { id } });
  }

  private async own(trainerId: string, id: string) {
    const note = await this.prisma.trainerNote.findFirst({ where: { id, trainerId } });
    if (!note) throw new NotFoundError('Anotação');
    return note;
  }
}
