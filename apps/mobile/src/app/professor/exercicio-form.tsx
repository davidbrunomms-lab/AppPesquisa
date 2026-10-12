import { MUSCLE_GROUP_LABELS, type Exercise, type MuscleGroup } from '@personalpro/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { ExerciseMedia } from '@/components/Media';
import { Button, Chips, Input, Loading, Row, Screen, Section, T } from '@/components/ui';
import { useApi, useInvalidate } from '@/features/hooks';
import { confirm, notify, notifyError } from '@/lib/alert';
import { api, uploadFile } from '@/lib/api';
import { pickFromLibrary } from '@/lib/media';

const GROUPS = (Object.keys(MUSCLE_GROUP_LABELS) as MuscleGroup[]).map((k) => ({ value: k, label: MUSCLE_GROUP_LABELS[k] }));

/** Exercício personalizado do professor, com upload de imagem/vídeo (POST /files?folder=exercises). */
export default function ExerciseFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const invalidate = useInvalidate();
  const existing = useApi<Exercise>(['exercise', id], id ? `/exercises/${id}` : null);
  const [name, setName] = useState('');
  const [group, setGroup] = useState<MuscleGroup | null>(null);
  const [equipment, setEquipment] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [mistakes, setMistakes] = useState('');
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState<'image' | 'video' | null>(null);
  const [saving, setSaving] = useState(false);
  const [hydrated, setHydrated] = useState(!id);

  useEffect(() => {
    if (!existing.data || hydrated) return;
    const e = existing.data;
    setName(e.name);
    setGroup(e.muscleGroup);
    setEquipment(e.equipment ?? '');
    setDescription(e.description ?? '');
    setInstructions(e.instructions.join('\n'));
    setMistakes(e.commonMistakes.join('\n'));
    setImageUrl(e.imageUrl);
    setVideoUrl(e.videoUrl);
    setHydrated(true);
  }, [existing.data, hydrated]);

  const upload = async (kind: 'image' | 'video') => {
    const file = await pickFromLibrary(kind === 'image' ? 'images' : 'videos');
    if (!file) return;
    setUploading(kind);
    try {
      const res = await uploadFile(file, 'exercises');
      if (kind === 'image') setImageUrl(res.url);
      else setVideoUrl(res.url);
    } catch (e) {
      notifyError(e, 'Falha no upload');
    } finally {
      setUploading(null);
    }
  };

  const lines = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean);

  const save = async () => {
    if (name.trim().length < 2) return notify('Informe o nome do exercício');
    if (!group) return notify('Selecione o grupo muscular');
    const body = {
      name: name.trim(),
      muscleGroup: group,
      equipment: equipment.trim() || undefined,
      description: description.trim() || undefined,
      instructions: lines(instructions),
      commonMistakes: lines(mistakes),
      imageUrl: imageUrl ?? undefined,
      videoUrl: videoUrl ?? undefined,
    };
    setSaving(true);
    try {
      if (id) await api.patch(`/exercises/${id}`, body);
      else await api.post('/exercises', body);
      await invalidate(['exercises'], ['exercise', id]);
      router.back();
    } catch (e) {
      notifyError(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id || !(await confirm('Excluir exercício', 'Excluir este exercício personalizado?', { confirmText: 'Excluir', destructive: true }))) return;
    try {
      await api.delete(`/exercises/${id}`);
      await invalidate(['exercises']);
      router.back();
    } catch (e) {
      notifyError(e);
    }
  };

  if (!hydrated)
    return (
      <Screen title="Exercício" back>
        <Loading />
      </Screen>
    );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Screen title={id ? 'Editar exercício' : 'Novo exercício'} back footer={<Button title="Salvar exercício" icon="check" size="lg" onPress={save} loading={saving} />}>
        <Input label="Nome" value={name} onChangeText={setName} placeholder="Ex.: Remada unilateral no cabo" />
        <Chips label="Grupo muscular" options={GROUPS} value={group} onChange={setGroup} />
        <Input label="Equipamento" value={equipment} onChangeText={setEquipment} placeholder="Ex.: Polia baixa" />
        <Input label="Descrição" value={description} onChangeText={setDescription} multiline />
        <Input label="Instruções (uma por linha)" value={instructions} onChangeText={setInstructions} multiline />
        <Input label="Erros comuns (um por linha)" value={mistakes} onChangeText={setMistakes} multiline />
        <Section title="Mídia" style={{ marginTop: 8 }}>
          {imageUrl || videoUrl ? <ExerciseMedia imageUrl={imageUrl} videoUrl={videoUrl} height={200} /> : null}
          <Row gap={10} style={{ marginTop: 12 }}>
            <View style={{ flex: 1 }}>
              <Button title={imageUrl ? 'Trocar imagem' : 'Enviar imagem'} icon="image" variant="secondary" size="sm" onPress={() => upload('image')} loading={uploading === 'image'} />
            </View>
            <View style={{ flex: 1 }}>
              <Button title={videoUrl ? 'Trocar vídeo' : 'Enviar vídeo'} icon="video" variant="secondary" size="sm" onPress={() => upload('video')} loading={uploading === 'video'} />
            </View>
          </Row>
          <T variant="small" tone="muted" style={{ marginTop: 6 }}>
            Imagens até 15 MB · vídeos até 150 MB (MP4/MOV).
          </T>
        </Section>
        {id ? <Button title="Excluir exercício" icon="trash" variant="ghost" onPress={remove} style={{ marginTop: 16 }} /> : null}
      </Screen>
    </KeyboardAvoidingView>
  );
}
