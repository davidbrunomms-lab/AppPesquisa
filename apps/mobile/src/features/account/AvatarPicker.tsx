import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { Avatar } from '@/components/ui';
import { useAuth } from '@/features/auth/AuthContext';
import { useInvalidate } from '@/features/hooks';
import { notifyError } from '@/lib/alert';
import { api, uploadFile } from '@/lib/api';
import { pickFromLibrary } from '@/lib/media';
import { useTheme } from '@/theme';

/** Foto de perfil: upload em POST /files?folder=avatars e PATCH /account { avatarUrl }. */
export function AvatarPicker({ size = 84, onUploaded }: { size?: number; onUploaded?: (url: string) => Promise<void> | void }) {
  const { user, refreshUser } = useAuth();
  const { colors } = useTheme();
  const invalidate = useInvalidate();
  const [busy, setBusy] = useState(false);
  const change = async () => {
    const file = await pickFromLibrary('images', { square: true });
    if (!file) return;
    setBusy(true);
    try {
      const uploaded = await uploadFile(file, 'avatars');
      if (onUploaded) await onUploaded(uploaded.url);
      else await api.patch('/account', { avatarUrl: uploaded.url });
      await refreshUser();
      await invalidate(['me'], ['trainer'], ['dashboard']);
    } catch (e) {
      notifyError(e, 'Não foi possível trocar a foto');
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable onPress={change} accessibilityLabel="Trocar foto de perfil" style={{ alignSelf: 'center' }}>
      <Avatar name={user?.name} url={user?.avatarUrl} size={size} />
      <View
        style={{
          position: 'absolute',
          right: -2,
          bottom: -2,
          width: 30,
          height: 30,
          borderRadius: 15,
          backgroundColor: colors.accent,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 3,
          borderColor: colors.background,
        }}
      >
        {busy ? <ActivityIndicator size="small" color={colors.onAccent} /> : <Icon name="camera" size={14} color={colors.onAccent} />}
      </View>
    </Pressable>
  );
}
