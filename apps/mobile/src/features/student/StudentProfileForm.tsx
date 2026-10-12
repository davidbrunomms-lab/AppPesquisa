import {
  SEX_LABELS,
  TRAINING_GOAL_LABELS,
  TRAINING_LEVEL_LABELS,
  type Sex,
  type StudentProfile,
  type TrainingGoal,
  type TrainingLevel,
} from '@personalpro/shared';
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Chips, Input, Row } from '@/components/ui';
import { notify } from '@/lib/alert';
import { isoDateOnly, isoToBrDate, numToText, parseBrDate, parseNum } from '@/lib/format';

export interface StudentProfilePayload {
  name?: string;
  email?: string;
  phone?: string;
  birthDate?: string;
  sex?: Sex;
  heightCm?: number;
  initialWeightKg?: number;
  currentWeightKg?: number;
  goal?: TrainingGoal;
  level?: TrainingLevel;
  weeklyFrequency?: number;
  gymName?: string;
  gymCity?: string;
}

const opts = <K extends string>(labels: Record<K, string>) => (Object.keys(labels) as K[]).map((k) => ({ value: k, label: labels[k] }));

/** Formulário de perfil do aluno (PATCH /students/me, PATCH /students/:id, POST /students). */
export function StudentProfileForm({
  initial,
  withEmail,
  submitLabel = 'Salvar',
  onSubmit,
}: {
  initial?: Partial<StudentProfile> | null;
  withEmail?: boolean;
  submitLabel?: string;
  onSubmit: (data: StudentProfilePayload) => Promise<void>;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [birth, setBirth] = useState(isoToBrDate(isoDateOnly(initial?.birthDate ?? null)));
  const [sex, setSex] = useState<Sex | null>(initial?.sex ?? null);
  const [height, setHeight] = useState(numToText(initial?.heightCm));
  const [initialW, setInitialW] = useState(numToText(initial?.initialWeightKg));
  const [currentW, setCurrentW] = useState(numToText(initial?.currentWeightKg));
  const [goal, setGoal] = useState<TrainingGoal | null>(initial?.goal ?? null);
  const [level, setLevel] = useState<TrainingLevel | null>(initial?.level ?? 'BEGINNER');
  const [freq, setFreq] = useState<number | null>(initial?.weeklyFrequency ?? 3);
  const [gymName, setGymName] = useState(initial?.gym?.name ?? '');
  const [gymCity, setGymCity] = useState(initial?.gym?.city ?? '');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const birthDate = birth.trim() ? parseBrDate(birth) : undefined;
    if (birth.trim() && !birthDate) {
      notify('Data inválida', 'Use o formato dd/mm/aaaa.');
      return;
    }
    if (withEmail && !/^\S+@\S+\.\S+$/.test(email.trim())) {
      notify('E-mail inválido');
      return;
    }
    const data: StudentProfilePayload = {
      name: name.trim() || undefined,
      phone: phone.trim() || undefined,
      birthDate: birthDate ?? undefined,
      sex: sex ?? undefined,
      heightCm: parseNum(height),
      initialWeightKg: parseNum(initialW),
      currentWeightKg: parseNum(currentW),
      goal: goal ?? undefined,
      level: level ?? undefined,
      weeklyFrequency: freq ?? undefined,
      gymName: gymName.trim() || undefined,
      gymCity: gymCity.trim() || undefined,
    };
    if (withEmail) data.email = email.trim().toLowerCase();
    setLoading(true);
    try {
      await onSubmit(data);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View>
      <Input label="Nome completo" value={name} onChangeText={setName} icon="user" />
      {withEmail ? <Input label="E-mail" value={email} onChangeText={setEmail} icon="mail" autoCapitalize="none" keyboardType="email-address" /> : null}
      <Input label="Telefone (WhatsApp)" value={phone} onChangeText={setPhone} icon="phone" keyboardType="phone-pad" placeholder="+55 11 99999-0000" />
      <Input label="Data de nascimento" value={birth} onChangeText={setBirth} icon="calendar" placeholder="dd/mm/aaaa" keyboardType="numbers-and-punctuation" />
      <Chips label="Sexo" options={opts(SEX_LABELS)} value={sex} onChange={setSex} allowClear />
      <Row gap={10} align="flex-start">
        <View style={{ flex: 1 }}>
          <Input label="Altura" value={height} onChangeText={setHeight} keyboardType="decimal-pad" suffix="cm" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Peso inicial" value={initialW} onChangeText={setInitialW} keyboardType="decimal-pad" suffix="kg" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Peso atual" value={currentW} onChangeText={setCurrentW} keyboardType="decimal-pad" suffix="kg" />
        </View>
      </Row>
      <Chips label="Objetivo" options={opts(TRAINING_GOAL_LABELS)} value={goal} onChange={setGoal} allowClear />
      <Chips label="Nível" options={opts(TRAINING_LEVEL_LABELS)} value={level} onChange={setLevel} />
      <Chips label="Frequência semanal" options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: n, label: `${n}x` }))} value={freq} onChange={setFreq} />
      <Row gap={10} align="flex-start">
        <View style={{ flex: 2 }}>
          <Input label="Academia" value={gymName} onChangeText={setGymName} icon="map-pin" />
        </View>
        <View style={{ flex: 1 }}>
          <Input label="Cidade" value={gymCity} onChangeText={setGymCity} />
        </View>
      </Row>
      <Button title={submitLabel} onPress={submit} loading={loading} size="lg" />
    </View>
  );
}
