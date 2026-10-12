/**
 * API REST simulada no navegador: intercepta window.fetch para a URL base da API
 * da demo e responde com as mesmas rotas, formatos e erros de apps/api.
 */
import { db, DB_KEY, reloadFromStorage, save } from './db';
import { storeUpload } from './files';
import { badRequest, HttpError, qNum, qStr, requireRole, roleForbidden, unauthorized, type Req } from './http';
import {
  access,
  account,
  admin,
  ai,
  assessments,
  auth,
  chat,
  dashboard,
  exercises,
  goals,
  invites,
  notes,
  notifications,
  onRealtime,
  progress,
  publishRealtime,
  reports,
  schedule,
  sessions,
  students,
  subscriptions,
  toPublicUser,
  trainers,
  typeFromMime,
  userFromAccessToken,
  userOf,
  workouts,
} from './services';

type Result = unknown | { __status: number; body?: unknown };
type Handler = (req: Req) => Result | Promise<Result>;
interface Route {
  method: string;
  pattern: RegExp;
  keys: string[];
  handler: Handler;
  status?: number;
  public?: boolean;
}

const routes: Route[] = [];
function route(method: string, path: string, handler: Handler, opts: { status?: number; public?: boolean } = {}) {
  const keys: string[] = [];
  const pattern = new RegExp(
    `^${path.replace(/[.]/g, '\\.').replace(/:(\w+)/g, (_, k) => {
      keys.push(k);
      return '([^/]+)';
    })}$`,
  );
  routes.push({ method, pattern, keys, handler, ...opts });
}

let apiBase = '';
let appUrl = () => `${location.origin}${location.pathname}#`;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const uuidParam = (v: string) => {
  if (!UUID_RE.test(v)) throw badRequest(['Validation failed (uuid is expected)']);
  return v;
};
const page = (req: Req) => ({ page: Math.max(1, qNum(req, 'page') ?? 1), pageSize: Math.min(100, Math.max(1, qNum(req, 'pageSize') ?? 20)) });
const boolQ = (req: Req, k: string) => {
  const v = qStr(req, k);
  return v === undefined ? undefined : v === 'true';
};

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------
route('POST', '/auth/register', (r) => auth.register(r.body), { public: true });
route('POST', '/auth/login', (r) => {
  if (!r.body.email || !r.body.password) throw badRequest(['email must be an email', 'password should not be empty']);
  return auth.login(r.body.email, r.body.password);
}, { public: true, status: 200 });
route('POST', '/auth/social', () => {
  throw new HttpError(422, 'Login social indisponível na demonstração', 'SOCIAL_DISABLED');
}, { public: true, status: 200 });
route('POST', '/auth/refresh', (r) => auth.refresh(r.body.refreshToken), { public: true, status: 200 });
route('POST', '/auth/logout', (r) => auth.logout(r.body.refreshToken), { public: true, status: 204 });
route('POST', '/auth/forgot-password', (r) => auth.forgotPassword(r.body.email), { public: true, status: 204 });
route('POST', '/auth/reset-password', (r) => auth.resetPassword(r.body.token, r.body.password), { public: true, status: 204 });
route('POST', '/auth/change-password', (r) => auth.changePassword(requireRole(r).userId, r.body), { status: 204 });
route('GET', '/auth/me', (r) => toPublicUser(userOf(requireRole(r).userId)));

// ---------------------------------------------------------------------------
// Conta / arquivos
// ---------------------------------------------------------------------------
route('PATCH', '/account', (r) => {
  const u = userOf(requireRole(r).userId);
  for (const k of ['name', 'phone', 'avatarUrl', 'marketingOptIn'] as const) if (r.body[k] !== undefined) (u as any)[k] = r.body[k];
  return { id: u.id, name: u.name, phone: u.phone, avatarUrl: u.avatarUrl, marketingOptIn: u.marketingOptIn };
});
route('GET', '/account/export', (r) => account.export(requireRole(r).userId));
route('DELETE', '/account', (r) => account.delete(requireRole(r).userId, r.body.password), { status: 204 });
route('POST', '/files', async (r) => {
  requireRole(r);
  const folder = qStr(r, 'folder') ?? 'documents';
  if (!['avatars', 'exercises', 'chat', 'progress', 'documents'].includes(folder)) throw badRequest(['folder must be one of the following values']);
  const f = await storeUpload(r.form?.get('file') as File | null);
  return { id: f.id, url: f.url, storedUrl: f.url, mimeType: f.mimeType, sizeBytes: f.sizeBytes, key: `${folder}/${f.id}` };
});

// ---------------------------------------------------------------------------
// Professores / alunos / convites
// ---------------------------------------------------------------------------
route('GET', '/trainers/me', (r) => trainers.getMe(requireRole(r, 'TRAINER').trainerId!));
route('PATCH', '/trainers/me', (r) => trainers.updateMe(requireRole(r, 'TRAINER').trainerId!, r.body));
route('GET', '/students', (r) =>
  students.list(requireRole(r, 'TRAINER').trainerId!, {
    search: qStr(r, 'search'),
    status: qStr(r, 'status'),
    goal: qStr(r, 'goal'),
    level: qStr(r, 'level'),
    inactiveDays: qNum(r, 'inactiveDays'),
    sort: qStr(r, 'sort'),
  }),
);
route('POST', '/students', (r) => students.createManual(requireRole(r, 'TRAINER').trainerId!, r.body, appUrl(), apiBase));
route('GET', '/students/me', (r) => {
  const u = requireRole(r, 'STUDENT');
  return students.detail(u, u.studentId!);
});
route('PATCH', '/students/me', (r) => {
  const u = requireRole(r, 'STUDENT');
  return students.update(u, u.studentId!, r.body);
});
route('GET', '/students/:id', (r) => students.detail(requireRole(r, 'TRAINER', 'STUDENT'), uuidParam(r.params.id)));
route('PATCH', '/students/:id', (r) => students.update(requireRole(r, 'TRAINER', 'STUDENT'), uuidParam(r.params.id), r.body));
route('PATCH', '/students/:id/link', (r) => students.updateLink(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id), r.body));
route('GET', '/students/:id/workouts', (r) => workouts.forStudent(requireRole(r, 'TRAINER'), uuidParam(r.params.id)));
route('GET', '/students/:id/notes', (r) => notes.list(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id)));
route('POST', '/students/:id/notes', (r) => notes.create(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id), r.body.content, r.body.pinned));
route('PATCH', '/notes/:id', (r) => notes.update(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id), r.body));
route('DELETE', '/notes/:id', (r) => notes.remove(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id)), { status: 204 });

route('POST', '/invites', (r) => invites.create(requireRole(r, 'TRAINER').trainerId!, r.body, appUrl(), apiBase));
route('GET', '/invites', (r) => {
  const tid = requireRole(r, 'TRAINER').trainerId!;
  return db().invites.filter((i) => i.trainerId === tid);
});
route('POST', '/invites/accept', (r) => {
  const u = requireRole(r, 'STUDENT');
  if (!r.body.code || String(r.body.code).length < 4) throw badRequest(['code must be longer than or equal to 4 characters']);
  return invites.accept(u.studentId!, r.body.code);
});
route('GET', '/invites/:code/preview', (r) => invites.preview(decodeURIComponent(r.params.code)), { public: true });

// ---------------------------------------------------------------------------
// Exercícios e treinos
// ---------------------------------------------------------------------------
route('GET', '/exercises', (r) => exercises.list(requireRole(r), { scope: qStr(r, 'scope'), muscleGroup: qStr(r, 'muscleGroup'), search: qStr(r, 'search') }));
route('GET', '/exercises/:id', (r) => exercises.get(requireRole(r), uuidParam(r.params.id)));
route('POST', '/exercises', (r) => exercises.create(requireRole(r, 'TRAINER').trainerId!, r.body));
route('PATCH', '/exercises/:id', (r) => exercises.update(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id), r.body));
route('DELETE', '/exercises/:id', (r) => exercises.remove(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id)), { status: 204 });

route('GET', '/workouts', (r) =>
  workouts.list(requireRole(r, 'TRAINER').trainerId!, { templates: boolQ(r, 'templates'), studentId: qStr(r, 'studentId') }),
);
route('POST', '/workouts', (r) => workouts.create(requireRole(r, 'TRAINER').trainerId!, r.body));
route('GET', '/workouts/mine', (r) => workouts.forStudent(requireRole(r, 'STUDENT')));
route('GET', '/workouts/today', (r) => workouts.today(requireRole(r, 'STUDENT').studentId!));
route('GET', '/workouts/:id', (r) => workouts.get(requireRole(r), uuidParam(r.params.id)));
route('PUT', '/workouts/:id', (r) => workouts.update(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id), r.body));
route('DELETE', '/workouts/:id', (r) => workouts.remove(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id)), { status: 204 });
route('POST', '/workouts/:id/duplicate', (r) => workouts.duplicate(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id)));
route('POST', '/workouts/:id/assign', (r) => workouts.assign(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id), r.body));
route(
  'DELETE',
  '/workouts/:id/assign/:studentId',
  (r) => workouts.unassign(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id), uuidParam(r.params.studentId)),
  { status: 204 },
);

// ---------------------------------------------------------------------------
// Execução de treino e evolução
// ---------------------------------------------------------------------------
route('POST', '/sessions', (r) => sessions.start(requireRole(r, 'STUDENT').studentId!, r.body.workoutId));
route('GET', '/sessions', (r) =>
  sessions.history(requireRole(r, 'STUDENT', 'TRAINER'), { studentId: qStr(r, 'studentId'), from: qStr(r, 'from'), to: qStr(r, 'to'), ...page(r) }),
);
route('GET', '/sessions/active', (r) => sessions.active(requireRole(r, 'STUDENT').studentId!));
route('GET', '/sessions/:id', (r) => sessions.get(requireRole(r, 'STUDENT', 'TRAINER'), uuidParam(r.params.id)));
route('POST', '/sessions/:id/sets', (r) => sessions.logSet(requireRole(r, 'STUDENT').studentId!, uuidParam(r.params.id), r.body));
route(
  'DELETE',
  '/sessions/:id/sets/:setId',
  (r) => sessions.deleteSet(requireRole(r, 'STUDENT').studentId!, uuidParam(r.params.id), uuidParam(r.params.setId)),
  { status: 204 },
);
route('POST', '/sessions/:id/finish', (r) => sessions.finish(requireRole(r, 'STUDENT').studentId!, uuidParam(r.params.id), r.body));
route('POST', '/sessions/:id/abandon', (r) => sessions.abandon(requireRole(r, 'STUDENT').studentId!, uuidParam(r.params.id)), { status: 204 });

route('GET', '/progress/stats', (r) => progress.stats(requireRole(r, 'STUDENT', 'TRAINER'), qStr(r, 'studentId'), Math.min(52, Math.max(1, qNum(r, 'weeks') ?? 12))));
route('GET', '/progress/exercises', (r) => progress.exercises(requireRole(r, 'STUDENT', 'TRAINER'), qStr(r, 'studentId')));
route('GET', '/progress/exercises/:id', (r) => progress.exercise(requireRole(r, 'STUDENT', 'TRAINER'), uuidParam(r.params.id), qStr(r, 'studentId')));
route('GET', '/progress/body', (r) => progress.body(requireRole(r, 'STUDENT', 'TRAINER'), qStr(r, 'studentId')));

route('GET', '/assessments', (r) => assessments.list(requireRole(r, 'TRAINER', 'STUDENT'), qStr(r, 'studentId'), qStr(r, 'status')));
route('POST', '/assessments', (r) => assessments.create(requireRole(r, 'TRAINER', 'STUDENT'), r.body));
route('POST', '/assessments/schedule', (r) => assessments.schedule(requireRole(r, 'TRAINER').trainerId!, r.body));
route('GET', '/assessments/compare', (r) => {
  const u = requireRole(r, 'TRAINER', 'STUDENT');
  return assessments.compare(u, uuidParam(qStr(r, 'before') ?? ''), uuidParam(qStr(r, 'after') ?? ''));
});
route('GET', '/assessments/:id', (r) => assessments.get(requireRole(r, 'TRAINER', 'STUDENT'), uuidParam(r.params.id)));
route('PATCH', '/assessments/:id', (r) => assessments.update(requireRole(r, 'TRAINER', 'STUDENT'), uuidParam(r.params.id), r.body));
route('DELETE', '/assessments/:id', (r) => assessments.remove(requireRole(r, 'TRAINER', 'STUDENT'), uuidParam(r.params.id)), { status: 204 });
route('POST', '/assessments/:id/photos', async (r) => {
  const u = requireRole(r, 'TRAINER', 'STUDENT');
  const id = uuidParam(r.params.id);
  const angle = qStr(r, 'angle') ?? '';
  if (!['FRONT', 'BACK', 'RIGHT', 'LEFT'].includes(angle)) throw badRequest(['angle must be one of the following values: FRONT, BACK, RIGHT, LEFT']);
  assessments.getOwned(u, id, true);
  const f = await storeUpload(r.form?.get('file') as File | null, /^image\//);
  return assessments.addPhoto(u, id, angle, f.url);
});

route('GET', '/goals', (r) => goals.list(requireRole(r, 'TRAINER', 'STUDENT'), qStr(r, 'studentId'), qStr(r, 'status')));
route('POST', '/goals', (r) => goals.create(requireRole(r, 'TRAINER').trainerId!, r.body));
route('PATCH', '/goals/:id', (r) => goals.update(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id), r.body));
route('DELETE', '/goals/:id', (r) => goals.remove(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id)), { status: 204 });

// ---------------------------------------------------------------------------
// Agenda
// ---------------------------------------------------------------------------
route('GET', '/appointments', (r) => {
  const u = requireRole(r, 'TRAINER', 'STUDENT');
  const from = new Date(qStr(r, 'from') ?? '');
  const to = new Date(qStr(r, 'to') ?? '');
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) throw badRequest(['from must be a valid ISO 8601 date string', 'to must be a valid ISO 8601 date string']);
  return schedule.list(u, from, to);
});
route('POST', '/appointments', (r) => schedule.create(requireRole(r, 'TRAINER').trainerId!, r.body));
route('POST', '/appointments/slots', (r) => schedule.createSlots(requireRole(r, 'TRAINER').trainerId!, r.body));
route('POST', '/appointments/request', (r) => schedule.request(requireRole(r, 'STUDENT'), r.body));
route('POST', '/appointments/:id/book', (r) => schedule.book(requireRole(r, 'STUDENT').studentId!, uuidParam(r.params.id), r.body.reason));
route('POST', '/appointments/:id/confirm', (r) => schedule.confirm(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id)));
route('POST', '/appointments/:id/reschedule', (r) => schedule.reschedule(requireRole(r, 'TRAINER', 'STUDENT'), uuidParam(r.params.id), r.body));
route('POST', '/appointments/:id/cancel', (r) => schedule.cancel(requireRole(r, 'TRAINER', 'STUDENT'), uuidParam(r.params.id), r.body.reason));
route('POST', '/appointments/:id/complete', (r) => schedule.complete(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id)));
route('DELETE', '/appointments/:id', (r) => schedule.remove(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id)), { status: 204 });

// ---------------------------------------------------------------------------
// Chat e notificações
// ---------------------------------------------------------------------------
route('GET', '/conversations', (r) => chat.conversations(requireRole(r, 'TRAINER', 'STUDENT')));
route('POST', '/conversations/question', (r) => {
  const u = requireRole(r, 'STUDENT');
  if (!String(r.body.content ?? '').trim()) throw badRequest(['content must be longer than or equal to 1 characters']);
  return chat.askQuestion(u, r.body.content);
});
route('GET', '/conversations/:id/messages', (r) =>
  chat.messages(requireRole(r, 'TRAINER', 'STUDENT'), uuidParam(r.params.id), qStr(r, 'before'), qNum(r, 'limit') ?? 30),
);
route('POST', '/conversations/:id/messages', (r) => chat.send(requireRole(r, 'TRAINER', 'STUDENT'), uuidParam(r.params.id), r.body));
route('POST', '/conversations/:id/attachments', async (r) => {
  const u = requireRole(r, 'TRAINER', 'STUDENT');
  const id = uuidParam(r.params.id);
  access.assertConversationMember(u, id);
  const file = r.form?.get('file') as File | null;
  const f = await storeUpload(file);
  const content = r.form?.get('content');
  return chat.send(u, id, {
    type: typeFromMime(f.mimeType),
    content: typeof content === 'string' ? content : undefined,
    attachmentUrl: f.url,
    attachmentName: file?.name,
    attachmentMime: f.mimeType,
  });
});
route('POST', '/conversations/:id/read', (r) => chat.markRead(requireRole(r, 'TRAINER', 'STUDENT'), uuidParam(r.params.id)));

route('GET', '/notifications', (r) => {
  const u = requireRole(r);
  const p = page(r);
  return notifications.list(u.userId, p.page, p.pageSize, boolQ(r, 'unread'));
});
route('POST', '/notifications/read-all', (r) => notifications.markAllRead(requireRole(r).userId), { status: 204 });
route('POST', '/notifications/:id/read', (r) => notifications.markRead(requireRole(r).userId, uuidParam(r.params.id)), { status: 204 });

// ---------------------------------------------------------------------------
// IA, relatórios, dashboards
// ---------------------------------------------------------------------------
route('GET', '/ai/suggestions', (r) => ai.list(requireRole(r, 'TRAINER').trainerId!, qStr(r, 'status'), qStr(r, 'studentId')));
route('POST', '/ai/analyze', (r) => {
  const tid = requireRole(r, 'TRAINER').trainerId!;
  const sid = qStr(r, 'studentId');
  return sid ? ai.analyzeStudent(tid, sid) : ai.analyzeTrainer(tid);
});
route('POST', '/ai/suggestions/:id/approve', (r) => ai.approve(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id)));
route('POST', '/ai/suggestions/:id/reject', (r) => ai.reject(requireRole(r, 'TRAINER').trainerId!, uuidParam(r.params.id)));

route('GET', '/reports/weekly', (r) => reports.list(requireRole(r, 'TRAINER', 'STUDENT'), qStr(r, 'studentId')));
route('POST', '/reports/weekly', (r) => {
  const tid = requireRole(r, 'TRAINER').trainerId!;
  if (!r.body.studentId) throw badRequest(['studentId must be a UUID']);
  return reports.generate(tid, r.body.studentId, r.body.weekStart);
});

route('GET', '/dashboard/trainer', (r) => dashboard.trainer(requireRole(r, 'TRAINER').trainerId!));
route('GET', '/dashboard/student', (r) => dashboard.student(requireRole(r, 'STUDENT').studentId!));

// ---------------------------------------------------------------------------
// Assinaturas e admin
// ---------------------------------------------------------------------------
route('GET', '/plans', () => subscriptions.listPlans(), { public: true });
route('GET', '/subscriptions/me', (r) => subscriptions.getForTrainer(requireRole(r, 'TRAINER').trainerId!));
route('POST', '/subscriptions/checkout', (r) => {
  const tid = requireRole(r, 'TRAINER').trainerId!;
  if (!r.body.planCode) throw badRequest(['planCode must be a string']);
  return subscriptions.checkout(tid, r.body.planCode);
});
route('POST', '/subscriptions/cancel', (r) => subscriptions.cancel(requireRole(r, 'TRAINER').trainerId!));

const adminOnly = (r: Req) => requireRole(r, 'ADMIN');
route('GET', '/admin/metrics', (r) => (adminOnly(r), admin.metrics()));
route('GET', '/admin/users', (r) => (adminOnly(r), admin.users({ role: qStr(r, 'role'), search: qStr(r, 'search'), ...page(r) })));
route('GET', '/admin/subscriptions', (r) => (adminOnly(r), admin.subscriptions(qStr(r, 'status'))));
route('POST', '/admin/subscriptions/:id/payments', (r) => {
  adminOnly(r);
  const amount = Number(r.body.amountCents);
  if (!Number.isInteger(amount) || amount < 1) throw badRequest(['amountCents must not be less than 1']);
  return admin.registerManualPayment(uuidParam(r.params.id), amount);
});
route('GET', '/admin/plans', (r) => (adminOnly(r), admin.plans()));
route('POST', '/admin/plans', (r) => {
  adminOnly(r);
  admin.validatePlan(r.body, false);
  return admin.createPlan(r.body);
});
route('PATCH', '/admin/plans/:id', (r) => {
  adminOnly(r);
  admin.validatePlan(r.body, true);
  return admin.updatePlan(uuidParam(r.params.id), r.body);
});

// ---------------------------------------------------------------------------
// Despacho
// ---------------------------------------------------------------------------

const json = (status: number, body: unknown) =>
  new Response(body === undefined ? null : JSON.stringify(body), {
    status,
    headers: body === undefined ? {} : { 'Content-Type': 'application/json; charset=utf-8' },
  });

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Converte Date → ISO e remove valores não serializáveis (como o JSON real). */
const clone = (v: unknown) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

export async function handle(method: string, url: URL, init: RequestInit | undefined, headers: Headers): Promise<Response> {
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const candidates = routes.filter((r) => r.pattern.test(path));
  const match = candidates.find((r) => r.method === method);
  await delay(40 + Math.random() * 90);
  if (!match) {
    if (candidates.length) return json(404, { statusCode: 404, message: `Cannot ${method} ${path}`, error: 'Not Found' });
    return json(404, { statusCode: 404, message: `Cannot ${method} ${path}`, error: 'Not Found' });
  }
  const m = match.pattern.exec(path)!;
  const params: Record<string, string> = {};
  match.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));

  let body: Record<string, any> = {};
  let form: FormData | null = null;
  const raw = init?.body;
  if (raw instanceof FormData) form = raw;
  else if (typeof raw === 'string' && raw) {
    try {
      body = JSON.parse(raw);
    } catch {
      return json(400, { statusCode: 400, message: 'Unexpected token in JSON', error: 'Bad Request' });
    }
  }

  const token = headers.get('Authorization')?.replace(/^Bearer\s+/i, '') ?? null;
  const user = userFromAccessToken(token);
  const req: Req = { method, path, query: url.searchParams, body: body ?? {}, form, user, params };

  try {
    if (!match.public && !user) throw unauthorized(token ? 'Token inválido ou expirado' : 'Não autenticado');
    const result = await match.handler(req);
    if (method !== 'GET' || path === '/goals' || path.startsWith('/dashboard')) save();
    const status = match.status ?? (method === 'POST' ? 201 : 200);
    if (status === 204) return json(204, undefined);
    return json(status, clone(result) ?? null);
  } catch (err) {
    if (method !== 'GET') save();
    if (err instanceof HttpError) return json(err.status, err.body);
    console.warn('[demo api] erro inesperado', err);
    return json(500, { statusCode: 500, message: 'Erro interno' });
  }
}

// ---------------------------------------------------------------------------
// Instalação: override de window.fetch + sincronização entre abas
// ---------------------------------------------------------------------------

let channel: BroadcastChannel | null = null;
let applyingRemote = false;

export function installMockApi(base: string) {
  apiBase = base.replace(/\/$/, '');
  const original = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const href = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!href.startsWith(apiBase)) return original(input as RequestInfo, init);
    const url = new URL(href);
    const method = (init?.method ?? (input instanceof Request ? input.method : 'GET')).toUpperCase();
    const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
    return handle(method, url, init, headers);
  };
  db();

  try {
    window.addEventListener('storage', (e) => {
      if (e.key === DB_KEY) reloadFromStorage();
    });
  } catch {
    /* ignore */
  }
  try {
    channel = new BroadcastChannel('personalpro-demo');
    channel.onmessage = (e) => {
      if (e.data?.type === 'realtime') {
        reloadFromStorage();
        applyingRemote = true;
        try {
          publishRealtime(e.data.event);
        } finally {
          applyingRemote = false;
        }
      }
    };
    onRealtime((event) => {
      if (!applyingRemote) channel?.postMessage({ type: 'realtime', event: clone(event) });
    });
  } catch {
    channel = null;
  }
}

export function setAppUrlResolver(fn: () => string) {
  appUrl = fn;
}

export { roleForbidden };
