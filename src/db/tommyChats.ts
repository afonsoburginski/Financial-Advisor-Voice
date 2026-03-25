import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "@tommy_chat_store_v1";

export type TommyConversation = {
  id: string;
  title: string;
  created_at: number;
  updated_at: number;
};

export type TommyMessageRow = {
  id: string;
  conversationId: string;
  role: "user" | "tommy";
  text: string;
  ts: number;
};

type Store = {
  version: 1;
  conversations: TommyConversation[];
  messages: TommyMessageRow[];
};

const DEFAULT_TITLE = "Nova conversa";

export function makeTommyId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

async function readStore(): Promise<Store> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { version: 1, conversations: [], messages: [] };
    }
    const parsed = JSON.parse(raw) as Store;
    if (!parsed.conversations || !parsed.messages) {
      return { version: 1, conversations: [], messages: [] };
    }
    return parsed;
  } catch {
    return { version: 1, conversations: [], messages: [] };
  }
}

async function writeStore(s: Store): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

/** Garante pelo menos uma conversa e devolve lista ordenada + id ativo sugerido */
export async function ensureTommyChats(): Promise<{
  conversations: TommyConversation[];
  activeId: string;
}> {
  const s = await readStore();
  if (s.conversations.length === 0) {
    const id = makeTommyId();
    const now = Date.now();
    s.conversations.push({
      id,
      title: DEFAULT_TITLE,
      created_at: now,
      updated_at: now,
    });
    await writeStore(s);
  }
  const sorted = [...s.conversations].sort((a, b) => b.updated_at - a.updated_at);
  return { conversations: sorted, activeId: sorted[0].id };
}

export async function listTommyConversations(): Promise<TommyConversation[]> {
  const s = await readStore();
  return [...s.conversations].sort((a, b) => b.updated_at - a.updated_at);
}

export async function createTommyConversation(): Promise<string> {
  const s = await readStore();
  const id = makeTommyId();
  const now = Date.now();
  s.conversations.push({
    id,
    title: DEFAULT_TITLE,
    created_at: now,
    updated_at: now,
  });
  await writeStore(s);
  return id;
}

export async function deleteTommyConversation(id: string): Promise<void> {
  const s = await readStore();
  s.conversations = s.conversations.filter((c) => c.id !== id);
  s.messages = s.messages.filter((m) => m.conversationId !== id);
  await writeStore(s);
}

export async function getTommyMessages(conversationId: string): Promise<TommyMessageRow[]> {
  const s = await readStore();
  return s.messages
    .filter((m) => m.conversationId === conversationId)
    .sort((a, b) => a.ts - b.ts);
}

export async function appendTommyMessage(
  conversationId: string,
  row: {
    id?: string;
    role: "user" | "tommy";
    text: string;
    ts: number;
  }
): Promise<TommyMessageRow> {
  const s = await readStore();
  const conv = s.conversations.find((c) => c.id === conversationId);
  if (!conv) {
    throw new Error("Conversa não encontrada");
  }

  const id = row.id ?? makeTommyId();
  const message: TommyMessageRow = {
    id,
    conversationId,
    role: row.role,
    text: row.text,
    ts: row.ts,
  };
  s.messages.push(message);
  conv.updated_at = row.ts;

  if (row.role === "user" && conv.title === DEFAULT_TITLE) {
    const t = row.text.trim().replace(/\s+/g, " ");
    conv.title = t.length <= 44 ? t || DEFAULT_TITLE : `${t.slice(0, 44)}…`;
  }

  await writeStore(s);
  return message;
}

export async function getOtherConversationIdAfterDelete(
  deletedId: string
): Promise<string | null> {
  const s = await readStore();
  const remaining = s.conversations.filter((c) => c.id !== deletedId);
  if (remaining.length === 0) return null;
  return [...remaining].sort((a, b) => b.updated_at - a.updated_at)[0].id;
}
