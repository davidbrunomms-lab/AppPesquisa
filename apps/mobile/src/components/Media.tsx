import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Pressable, View } from 'react-native';
import { absoluteUrl } from '@/lib/config';
import { formatDuration } from '@personalpro/shared';
import { useTheme } from '@/theme';
import { Icon } from './Icon';
import { T } from './ui';

export function VideoPlayer({ uri, height = 220, rounded = true }: { uri: string; height?: number; rounded?: boolean }) {
  const player = useVideoPlayer(absoluteUrl(uri) ?? uri, (p) => {
    p.loop = true;
    p.muted = true;
  });
  return (
    <View style={{ borderRadius: rounded ? 16 : 0, overflow: 'hidden', backgroundColor: '#000' }}>
      <VideoView player={player} style={{ width: '100%', height }} nativeControls contentFit="contain" />
    </View>
  );
}

/** Mídia do exercício: vídeo (expo-video) se existir, senão imagem, senão placeholder. */
export function ExerciseMedia({
  imageUrl,
  videoUrl,
  height = 200,
}: {
  imageUrl?: string | null;
  videoUrl?: string | null;
  height?: number;
}) {
  const { colors, radius } = useTheme();
  if (videoUrl) return <VideoPlayer uri={videoUrl} height={height} />;
  const img = absoluteUrl(imageUrl);
  if (img) {
    return (
      <Image
        source={{ uri: img }}
        style={{ width: '100%', height, borderRadius: radius.lg, backgroundColor: colors.surfaceMuted }}
        contentFit="cover"
        transition={200}
      />
    );
  }
  return (
    <View
      style={{
        height: Math.min(height, 140),
        borderRadius: radius.lg,
        backgroundColor: colors.surfaceMuted,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
      }}
    >
      <Icon name="dumbbell" size={36} color={colors.textMuted} />
      <T variant="small" tone="muted">
        Sem mídia cadastrada
      </T>
    </View>
  );
}

export function AudioPlayerBubble({ uri, tint }: { uri: string; tint: string }) {
  const player = useAudioPlayer(absoluteUrl(uri) ?? uri);
  const status = useAudioPlayerStatus(player);
  const toggle = () => {
    if (status.playing) player.pause();
    else {
      if (status.didJustFinish || (status.duration > 0 && status.currentTime >= status.duration - 0.2)) void player.seekTo(0);
      player.play();
    }
  };
  const pct = status.duration > 0 ? Math.min(100, (status.currentTime / status.duration) * 100) : 0;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 180 }}>
      <Pressable onPress={toggle} accessibilityLabel={status.playing ? 'Pausar áudio' : 'Reproduzir áudio'} hitSlop={8}>
        <Icon name={status.playing ? 'pause' : 'play'} color={tint} size={22} filled />
      </Pressable>
      <View style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: `${tint}33` }}>
        <View style={{ width: `${pct}%`, height: 4, borderRadius: 2, backgroundColor: tint }} />
      </View>
      <T variant="small" style={{ color: tint }}>
        {formatDuration(Math.round(status.playing ? status.currentTime : status.duration || 0))}
      </T>
    </View>
  );
}
