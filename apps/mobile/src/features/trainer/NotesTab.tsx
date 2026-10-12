import type { TrainerNote } from '@personalpro/shared';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Button, Card, Checkbox, EmptyState, Input, QueryState, Row, T } from '@/components/ui';
import { useApi, useInvalidate } from '@/features/hooks';
import { confirm, notifyError } from '@/lib/alert';
import { api } from '@/lib/api';
import { timeAgo } from '@/lib/format';
import { useTheme } from '@/theme';

/** Anotações privadas do professor (nunca visíveis ao aluno). */
export function NotesTab({ studentId }: { studentId: string }) {
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const q = useApi<TrainerNote[]>(['notes', studentId], `/students/${studentId}/notes`);
  const [content, setContent] = useState('');
  const [pinned, setPinned] = useState(false);
  const [editing, setEditing] = useState<TrainerNote | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      if (editing) await api.patch(`/notes/${editing.id}`, { content: content.trim(), pinned });
      else await api.post(`/students/${studentId}/notes`, { content: content.trim(), pinned });
      setContent('');
      setPinned(false);
      setEditing(null);
      await invalidate(['notes', studentId]);
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  const togglePin = async (n: TrainerNote) => {
    try {
      await api.patch(`/notes/${n.id}`, { pinned: !n.pinned });
      await invalidate(['notes', studentId]);
    } catch (e) {
      notifyError(e);
    }
  };

  const remove = async (n: TrainerNote) => {
    if (!(await confirm('Excluir anotação', 'Esta ação não pode ser desfeita.', { confirmText: 'Excluir', destructive: true }))) return;
    try {
      await api.delete(`/notes/${n.id}`);
      await invalidate(['notes', studentId]);
    } catch (e) {
      notifyError(e);
    }
  };

  const notes = [...(q.data ?? [])].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.updatedAt.localeCompare(a.updatedAt));

  return (
    <View>
      <Card style={{ marginBottom: 14 }}>
        <Row gap={8} style={{ marginBottom: 8 }}>
          <Icon name="lock" size={16} color={colors.textMuted} />
          <T variant="small" tone="muted">
            Visível apenas para você
          </T>
        </Row>
        <Input value={content} onChangeText={setContent} placeholder="Ex.: sente dor no ombro direito em supino" multiline />
        <Checkbox checked={pinned} onChange={setPinned}>
          <T variant="small">Fixar no topo</T>
        </Checkbox>
        <Row gap={10}>
          {editing ? (
            <View style={{ flex: 1 }}>
              <Button
                title="Cancelar"
                variant="secondary"
                onPress={() => {
                  setEditing(null);
                  setContent('');
                  setPinned(false);
                }}
              />
            </View>
          ) : null}
          <View style={{ flex: 1 }}>
            <Button title={editing ? 'Salvar alteração' : 'Adicionar anotação'} icon="check" onPress={save} loading={saving} disabled={!content.trim()} />
          </View>
        </Row>
      </Card>
      <QueryState query={q}>
        {notes.length ? (
          <View style={{ gap: 10 }}>
            {notes.map((n) => (
              <Card key={n.id} style={n.pinned ? { borderColor: colors.accent, borderWidth: 1 } : undefined}>
                <T>{n.content}</T>
                <Row justify="space-between" style={{ marginTop: 10 }}>
                  <T variant="small" tone="muted">
                    {timeAgo(n.updatedAt)}
                  </T>
                  <Row gap={16}>
                    <Pressable onPress={() => togglePin(n)} hitSlop={8} accessibilityLabel={n.pinned ? 'Desafixar' : 'Fixar'}>
                      <Icon name="bookmark" size={18} color={n.pinned ? colors.accent : colors.textMuted} />
                    </Pressable>
                    <Pressable
                      onPress={() => {
                        setEditing(n);
                        setContent(n.content);
                        setPinned(n.pinned);
                      }}
                      hitSlop={8}
                      accessibilityLabel="Editar"
                    >
                      <Icon name="edit" size={18} color={colors.textMuted} />
                    </Pressable>
                    <Pressable onPress={() => remove(n)} hitSlop={8} accessibilityLabel="Excluir">
                      <Icon name="trash" size={18} color={colors.textMuted} />
                    </Pressable>
                  </Row>
                </Row>
              </Card>
            ))}
          </View>
        ) : (
          <EmptyState icon="edit" title="Sem anotações" message="Registre observações privadas sobre o aluno." />
        )}
      </QueryState>
    </View>
  );
}
