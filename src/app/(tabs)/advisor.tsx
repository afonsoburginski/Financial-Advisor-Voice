import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Alert,
  Animated,
  Easing,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import { LinearGradient } from "expo-linear-gradient";
import { useFinanceController } from "@/controllers/useFinanceController";
import { useUserController } from "@/controllers/useUserController";
import Colors from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/layout";
import { formatCurrency } from "@/constants/finance";
import { USER_PROFILE } from "@/constants/userProfile";
import {
  appendTommyMessage,
  createTommyConversation,
  deleteTommyConversation,
  ensureTommyChats,
  getTommyMessages,
  listTommyConversations,
  type TommyConversation,
  type TommyMessageRow,
} from "@/db/tommyChats";
import {
  buildSystemPrompt,
  getOpenAIApiKey,
  getOpenAIModel,
  openaiChatCompletion,
  type ChatTurn,
  type FinanceAiSnapshot,
} from "@/services/openai";
import { transcribeAudio } from "@/services/whisper";
import TommyOrb, { type OrbAgentState } from "@/components/TommyOrb";

// ─── Types ──────────────────────────────────────────────────────────────────

/** idle → user not talking, not Tommy talking
 *  listening → recording user voice
 *  thinking → waiting for OpenAI
 *  speaking → Tommy is speaking via TTS */
type AgentState = "idle" | "listening" | "thinking" | "speaking";
type ViewMode = "voice" | "chat";
type MsgRole = "user" | "tommy";
interface Msg {
  id: string;
  role: MsgRole;
  text: string;
  ts: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function rowToMsg(r: TommyMessageRow): Msg {
  return { id: r.id, role: r.role, text: r.text, ts: r.ts };
}

function fallbackTommySnapshot(): FinanceAiSnapshot {
  return {
    nomeTratamento: USER_PROFILE.nomeTratamento,
    salarioBruto: 0,
    salarioLiquido: 0,
    valeAlimentacaoMes: 0,
    totalFixos: 0,
    metaTitulo: "",
    metaValor: 0,
    economizadoMeta: 0,
    sobraMensal: 0,
    receitasMes: 0,
    gastosMes: 0,
    resumoUltimasLinhas: "",
  };
}

type LocalReplyCtx = {
  sobraMensal: number;
  fixosSum: number;
  metaTitulo: string;
  metaValor: number;
  calcDias: (valor: number) => number;
};

function processar(
  text: string,
  nome: string,
  ctx: LocalReplyCtx
): { reply: string; valor?: number; titulo?: string; categoria?: string } {
  const low = text.toLowerCase();
  const m = text.match(/r\$\s*([\d.,]+)/i);
  const val = m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : null;
  const metaNome = ctx.metaTitulo.trim() || "sua meta";

  if (val && val > 0) {
    const dias = ctx.calcDias(val);
    const nova = ctx.sobraMensal - val;
    let cat = "Outros";
    if (/comida|aliment|restauran|mercearia|lanche/.test(low)) cat = "Alimentação";
    else if (/saude|médic|remédio|hospital|farmácia|dentist/.test(low)) cat = "Saúde";
    else if (/lazer|cinema|bar|passeio|jogo|streaming/.test(low)) cat = "Lazer";
    else if (/roupa|vest|calçado|tênis|moda/.test(low)) cat = "Vestuário";
    else if (/uber|ônibus|transporte|carro|gasolina|posto/.test(low)) cat = "Transporte";
    else if (/curso|educação|estudo|livro|faculdade/.test(low)) cat = "Educação";
    else if (/celular|tecnolog|notebook|computador|gadget/.test(low)) cat = "Tecnologia";
    const tituloRaw =
      text.replace(/r\$\s*[\d.,]+/i, "").trim().slice(0, 60) || text.slice(0, 60);
    const reply =
      `Registrado. ${formatCurrency(val)} → ~${dias} dia${dias !== 1 ? "s" : ""} equiv. (${metaNome}). ` +
      (nova >= 0
        ? `Sobra ajustada: ${formatCurrency(nova)}.`
        : `Atenção: ultrapassa a sobra em ${formatCurrency(Math.abs(nova))}.`);
    return { reply, valor: val, titulo: tituloRaw, categoria: cat };
  }
  if (/sobra|saldo|quanto (tenho|tenho disponível|posso gastar)/.test(low)) {
    const meses =
      ctx.sobraMensal > 0 && ctx.metaValor > 0
        ? Math.ceil(ctx.metaValor / ctx.sobraMensal)
        : null;
    return {
      reply:
        `Sobra mensal estimada: ${formatCurrency(ctx.sobraMensal)}.` +
        (meses ? ` ~${meses} meses para "${metaNome}".` : " Configura rendimento e fixos no Painel."),
    };
  }
  if (/meta|sandero|carro|veículo/.test(low)) {
    if (ctx.metaValor <= 0)
      return { reply: `Sem meta definida no Painel. Abre o Painel → detalhes e define o objetivo.` };
    const meses = ctx.sobraMensal > 0 ? Math.ceil(ctx.metaValor / ctx.sobraMensal) : null;
    return {
      reply:
        `Meta "${metaNome}": ${formatCurrency(ctx.metaValor)}.` +
        (meses ? ` Estima-se ~${meses} meses guardando a sobra mensal.` : ` Ajusta rendimento no Painel para calcular prazo.`),
    };
  }
  if (/agenda|tarefa|pendente|lembrete/.test(low))
    return { reply: `No Painel vês tarefas pendentes e agenda completa.` };
  if (/custo|fixo|gasto|despesa/.test(low))
    return { reply: `Custos fixos: ${formatCurrency(ctx.fixosSum)}. Variáveis vêm do histórico e extratos.` };
  if (/olá|oi|ei|bom dia|boa tarde|boa noite|tudo bem|como vai/.test(low))
    return { reply: `Tudo certo! Posso ajudar com finanças, carreira ou a mudança — o que precisas?` };
  if (/obrigad|valeu|thanks/.test(low)) return { reply: `Disponha, ${nome}.` };
  if (/quem.*você|o que.*você|o que.*tommy/.test(low))
    return { reply: `Sou o Tommy, teu assistente de finanças e vida. Faz uma pergunta!` };
  if (/renda|salário|pagamento/.test(low))
    return { reply: `Rendimento e movimentos estão no Painel. Diz um valor em R$ e estimo o impacto.` };
  return { reply: `Podes ser mais específico, ${nome}? Fala de finanças, meta, carreira ou organização.` };
}

const SUGGESTIONS = [
  "Qual minha sobra mensal?",
  "Como está a minha meta?",
  "Registrar gasto R$ 120 lanche",
  "Resumo fixos e gastos do mês",
];

// ─── State config ────────────────────────────────────────────────────────────

const STATE_LABELS: Record<AgentState, string> = {
  idle: "Toca para falar",
  listening: "Ouvindo… toca para parar",
  thinking: "Pensando…",
  speaking: "Tommy está falando…",
};

const STATUS_COLORS: Record<AgentState, string> = {
  idle: Colors.textMuted,
  listening: "#10D9A0",
  thinking: Colors.accentLight,
  speaking: "#E879F9",
};

function agentToOrb(s: AgentState): OrbAgentState {
  if (s === "speaking") return "talking";
  return s;
}

// ─── Typing Indicator ─────────────────────────────────────────────────────────

function TypingDots() {
  const dots = [
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
    useRef(new Animated.Value(0)).current,
  ];

  useEffect(() => {
    const anims = dots.map((d, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(d, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(d, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
          Animated.delay(330),
        ])
      )
    );
    Animated.parallel(anims).start();
    return () => anims.forEach((a) => a.stop());
  }, []);

  return (
    <View style={td.row}>
      <TommyOrb state="thinking" size={22} />
      <Text style={td.label}>Tommy</Text>
      <View style={td.dots}>
        {dots.map((d, i) => (
          <Animated.View
            key={i}
            style={[
              td.dot,
              {
                opacity: d,
                transform: [{ translateY: d.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }],
              },
            ]}
          />
        ))}
      </View>
    </View>
  );
}

const td = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 20, paddingVertical: 14, backgroundColor: Colors.chatAssistantBand },
  label: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.accent, letterSpacing: 1.2 },
  dots: { flexDirection: "row", gap: 5, alignItems: "center" },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: Colors.accentLight },
});

// ─── Chat Row ────────────────────────────────────────────────────────────────

function ChatRow({ msg }: { msg: Msg }) {
  if (msg.role === "user") {
    return (
      <View style={cr.rowUser}>
        <LinearGradient
          colors={["rgba(124,110,250,0.28)", "rgba(79,70,229,0.18)"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={cr.bubbleUser}
        >
          <Text style={cr.textUser}>{msg.text}</Text>
        </LinearGradient>
      </View>
    );
  }
  return (
    <View style={cr.rowAssistant}>
      <View style={cr.assistantHeader}>
        <TommyOrb state="idle" size={22} />
        <Text style={cr.assistantLabel}>Tommy</Text>
      </View>
      <Text style={cr.textAssistant}>{msg.text}</Text>
    </View>
  );
}

const cr = StyleSheet.create({
  rowUser: { flexDirection: "row", justifyContent: "flex-end", paddingHorizontal: 16, paddingVertical: 6 },
  bubbleUser: {
    maxWidth: "85%",
    borderRadius: 22,
    borderBottomRightRadius: 6,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
  },
  textUser: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text, lineHeight: 22 },
  rowAssistant: {
    width: "100%",
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: Colors.chatAssistantBand,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.chatBorder,
    gap: 8,
  },
  assistantHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  assistantLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", color: Colors.accent, letterSpacing: 1.2 },
  textAssistant: { fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text, lineHeight: 24 },
});

// ─── Conversation date ────────────────────────────────────────────────────────

function formatConvDate(ts: number): string {
  return new Date(ts).toLocaleString("pt-BR", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

// ─── Voice Controls ──────────────────────────────────────────────────────────

function VoiceControls({
  isMuted,
  onToggleMute,
  onEndCall
}: {
  isMuted: boolean;
  onToggleMute: () => void;
  onEndCall: () => void;
}) {
  return (
    <View style={vc.container}>
      <View style={vc.btnWrap}>
        <Pressable
          onPress={onToggleMute}
          style={({ pressed }) => [vc.btn, vc.btnHold, pressed && { opacity: 0.7 }]}
        >
          <Feather name={isMuted ? "play" : "pause"} size={26} color="#fff" />
        </Pressable>
        <Text style={vc.label}>{isMuted ? "Retomar" : "Pausar"}</Text>
      </View>

      <View style={vc.btnWrap}>
        <Pressable
          onPress={onEndCall}
          style={({ pressed }) => [vc.btn, vc.btnEnd, pressed && { opacity: 0.7 }]}
        >
          <Feather name="x" size={30} color="#fff" />
        </Pressable>
        <Text style={vc.label}>Encerrar</Text>
      </View>
    </View>
  );
}

const vc = StyleSheet.create({
  container: {
    flexDirection: "row",
    gap: 48,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  btnWrap: {
    alignItems: "center",
    gap: 12,
  },
  btn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  btnHold: {
    backgroundColor: "rgba(255,255,255,0.15)",
  },
  btnEnd: {
    backgroundColor: "#d32f2f",
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: "rgba(255,255,255,0.8)",
  },
});

// ─── Voice Transcript Bubble ─────────────────────────────────────────────────

function TranscriptBubble({ text, role }: { text: string; role: MsgRole }) {
  return (
    <Animated.View style={[vtb.wrap, role === "tommy" ? vtb.assistant : vtb.user]}>
      <Text style={[vtb.text, role === "tommy" ? vtb.assistantText : vtb.userText]} numberOfLines={4}>
        {text}
      </Text>
    </Animated.View>
  );
}

const vtb = StyleSheet.create({
  wrap: { borderRadius: 18, paddingVertical: 10, paddingHorizontal: 16, maxWidth: "80%", marginTop: 12 },
  user: { alignSelf: "flex-end", backgroundColor: "rgba(124,110,250,0.22)", borderColor: Colors.accentBorder, borderWidth: 1 },
  assistant: { alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.06)", borderColor: Colors.lineStrong, borderWidth: 1 },
  text: { fontSize: 15, lineHeight: 22 },
  userText: { fontFamily: "Inter_400Regular", color: Colors.text },
  assistantText: { fontFamily: "Inter_400Regular", color: Colors.textSub },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function AdvisorScreen() {
  const {
    sobraMensal,
    createDecisao,
    tommySnapshot,
    fixosSum,
    settings,
    calcularImpactoSandero,
  } = useFinanceController();
  const { nome, greeting } = useUserController();
  const insets = useSafeAreaInsets();
  const activeConvIdRef = useRef<string | null>(null);

  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [viewMode, setViewMode] = useState<ViewMode>("voice");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [lastTranscript, setLastTranscript] = useState<string>("");
  const [lastTommyReply, setLastTommyReply] = useState<string>("");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [conversations, setConversations] = useState<TommyConversation[]>([]);
  const [activeConvId, setActiveConvId] = useState<string | null>(null);
  const [storeReady, setStoreReady] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [isMuted, setIsMuted] = useState(false);

  const listRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSpokenRef = useRef(false);
  const inputBorderAnim = useRef(new Animated.Value(0)).current;

  const topPad = insets.top + (Platform.OS === "web" ? 8 : 0);
  const bottomPad = insets.bottom + TAB_BAR_HEIGHT;
  const drawerBottomPad = insets.bottom + 16;

  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { conversations: list, activeId } = await ensureTommyChats();
        if (cancelled) return;
        setConversations(list);
        setActiveConvId(activeId);
        const rows = await getTommyMessages(activeId);
        if (cancelled) return;
        setMsgs(rows.map(rowToMsg));
      } finally { if (!cancelled) setStoreReady(true); }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    Animated.timing(inputBorderAnim, {
      toValue: inputFocused ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [inputFocused]);

  const borderColor = inputBorderAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.chatBorder, Colors.accentBorder],
  });

  const refreshConvos = useCallback(async () => {
    setConversations(await listTommyConversations());
  }, []);

  const openConv = useCallback(async (id: string) => {
    setActiveConvId(id);
    const rows = await getTommyMessages(id);
    setMsgs(rows.map(rowToMsg));
    setSidebarOpen(false);
    Haptics.selectionAsync();
  }, []);

  const handleNewChat = useCallback(async () => {
    const id = await createTommyConversation();
    await refreshConvos();
    setActiveConvId(id);
    setMsgs([]);
    setSidebarOpen(false);
    setLastTranscript("");
    setLastTommyReply("");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [refreshConvos]);

  const handleDeleteConv = useCallback((item: TommyConversation) => {
    Alert.alert("Apagar conversa", `Remover "${item.title}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          const wasActive = activeConvIdRef.current === item.id;
          await deleteTommyConversation(item.id);
          let next = await listTommyConversations();
          if (next.length === 0) {
            await createTommyConversation();
            next = await listTommyConversations();
          }
          setConversations(next);
          if (wasActive) {
            const nid = next[0].id;
            setActiveConvId(nid);
            const rows = await getTommyMessages(nid);
            setMsgs(rows.map(rowToMsg));
          }
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        },
      },
    ]);
  }, []);

  // ─── Core reply logic ────────────────────────────────────────────────────

  const replyToText = useCallback(
    async (text: string) => {
      const convId = activeConvIdRef.current;
      if (!convId || !storeReady) return;

      const userMsg: Msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        role: "user",
        text,
        ts: Date.now(),
      };
      try { await appendTommyMessage(convId, { id: userMsg.id, role: "user", text, ts: userMsg.ts }); }
      catch { return; }

      const nextThread = [...msgs, userMsg];
      setMsgs(nextThread);
      await refreshConvos();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

      setAgentState("thinking");

      const snap = tommySnapshot ?? fallbackTommySnapshot();
      const side = processar(text, nome, {
        sobraMensal,
        fixosSum,
        metaTitulo: settings?.meta_titulo ?? "",
        metaValor: settings?.meta_valor ?? 0,
        calcDias: calcularImpactoSandero,
      });

      const apiKey = getOpenAIApiKey();
      let replyText: string;
      if (apiKey) {
        const historySlice: ChatTurn[] = nextThread.slice(-20).map((m) => ({
          role: m.role === "tommy" ? "assistant" : "user",
          content: m.text,
        }));
        try {
          replyText = await openaiChatCompletion({
            apiKey,
            model: getOpenAIModel(),
            systemPrompt: buildSystemPrompt(snap),
            messages: historySlice,
          });
        } catch { replyText = side.reply; }
      } else {
        await new Promise((r) => setTimeout(r, 200));
        replyText = side.reply;
      }

      const tommyMsg: Msg = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        role: "tommy",
        text: replyText,
        ts: Date.now(),
      };
      try { await appendTommyMessage(convId, { id: tommyMsg.id, role: "tommy", text: replyText, ts: tommyMsg.ts }); }
      catch { /**/ }

      setMsgs((p) => [...p, tommyMsg]);
      await refreshConvos();
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);

      // Show latest exchanges in voice mode
      setLastTranscript(text);
      setLastTommyReply(replyText);

      if (side.valor && side.titulo && side.categoria) {
        createDecisao({ titulo: side.titulo, valor: side.valor, categoria: side.categoria });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

      setAgentState("speaking");
      Speech.speak(replyText, {
        language: "pt-BR",
        rate: 0.92,
        onDone: () => setAgentState("idle"),
        onStopped: () => setAgentState("idle"),
      });
    },
    [msgs, sobraMensal, createDecisao, nome, storeReady, refreshConvos, settings, fixosSum, tommySnapshot, calcularImpactoSandero]
  );

  // ─── Voice Activity Detection (VAD) ──────────────────────────────────────────

  const stopAndTranscribe = useCallback(async () => {
    if (silenceTimerRef.current) {
      clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }

    const rec = recordingRef.current;
    if (!rec) return;

    setAgentState("thinking");
    let uri: string | null = null;
    try {
      await rec.stopAndUnloadAsync();
      uri = rec.getURI() ?? null;
    } catch { /**/ } finally {
      recordingRef.current = null;
    }

    if (!uri) {
      setAgentState("idle");
      return;
    }

    const apiKey = getOpenAIApiKey();
    if (!apiKey) {
      await replyToText("Qual minha sobra mensal atual?");
      return;
    }

    const transcript = await transcribeAudio(uri, apiKey);
    if (!transcript || transcript.trim().length < 2) {
      setAgentState("idle");
      return;
    }

    await replyToText(transcript);
  }, [replyToText]);

  const startVADRecording = useCallback(async () => {
    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") return;
      
      if (Platform.OS !== "web") {
        await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      }
      const { recording } = await Audio.Recording.createAsync({
        ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
        isMeteringEnabled: true,
      });

      recordingRef.current = recording;
      hasSpokenRef.current = false;
      setAgentState("listening");

      recording.setOnRecordingStatusUpdate((st) => {
        if (!st.isRecording) return;
        const db = st.metering ?? -100;

        if (db > -35) { // User is speaking
          hasSpokenRef.current = true;
          if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
          }
        } else if (db < -45 && hasSpokenRef.current) { // Silence detected after speech
          if (!silenceTimerRef.current) {
            silenceTimerRef.current = setTimeout(() => {
              stopAndTranscribe();
            }, 1500);
          }
        }
      });
    } catch {
      console.log("VAD Error");
    }
  }, [stopAndTranscribe]);

  // Auto VAD Loop
  useEffect(() => {
    let mounted = true;
    if (viewMode === "voice" && agentState === "idle" && !isMuted) {
      setTimeout(() => { if (mounted) startVADRecording(); }, 400);
    } else if (isMuted && agentState === "listening") {
      // cancel recording if muted
      const rec = recordingRef.current;
      if (rec) {
        rec.stopAndUnloadAsync().catch(() => {}).finally(() => {
          recordingRef.current = null;
          if (mounted) setAgentState("idle");
        });
      }
    }
    return () => { mounted = false; };
  }, [viewMode, agentState, isMuted, startVADRecording]);

  const toggleMute = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (agentState === "speaking") {
      Speech.stop();
      setAgentState("idle");
      return;
    }
    setIsMuted((prev) => !prev);
  }, [agentState]);

  const endVoiceMode = useCallback(async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (agentState === "speaking") {
      Speech.stop();
    }
    setAgentState("idle");
    setViewMode("chat");
  }, [agentState]);

  // ─── Chat send ───────────────────────────────────────────────────────────

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    Keyboard.dismiss();
    await replyToText(text);
  }, [input, replyToText]);

  // ─── Misc ────────────────────────────────────────────────────────────────

  const listBottom = bottomPad + 100;
  const activeTitle = conversations.find((x) => x.id === activeConvId)?.title ?? "Tommy";
  const orbState = agentToOrb(agentState);
  const statusLabel = STATE_LABELS[agentState];
  const statusColor = STATUS_COLORS[agentState];

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <View style={c.screen}>
      {/* ── Header ── */}
      <View style={[c.header, { paddingTop: topPad + 10 }]}>
        <Pressable onPress={() => setSidebarOpen(true)} style={({ pressed }) => [c.headerIcon, pressed && { opacity: 0.65 }]} hitSlop={12}>
          <Feather name="menu" size={22} color={Colors.text} />
        </Pressable>

        <View style={c.headerCenter}>
          <View style={c.headerTitleRow}>
            <View style={c.headerOrbWrap}>
              <TommyOrb state={orbState} size={26} />
            </View>
            <Text style={c.headerTitle} numberOfLines={1}>{activeTitle}</Text>
          </View>
          <Text style={[c.headerSub, { color: statusColor }]} numberOfLines={1}>
            {greeting()} · {statusLabel}
          </Text>
        </View>

        {/* Mode toggle */}
        <Pressable
          onPress={() => setViewMode(viewMode === "voice" ? "chat" : "voice")}
          style={({ pressed }) => [c.modeToggle, pressed && { opacity: 0.7 }]}
          hitSlop={12}
        >
          <Feather name={viewMode === "voice" ? "message-square" : "mic"} size={20} color={Colors.textSub} />
        </Pressable>
      </View>

      {/* ══════════════════════════════════════════════════ */}
      {/*  VOICE CALL MODE                                   */}
      {/* ══════════════════════════════════════════════════ */}
      {viewMode === "voice" && (
        <View style={[StyleSheet.absoluteFill, { zIndex: 10, elevation: 10, backgroundColor: Colors.bg }]}>
          {/* Full-bleed aura background */}
          <TommyOrb variant="fullscreen" state={orbState} />
          
          <View style={[c.voiceScreen, { paddingTop: topPad + 10, paddingBottom: bottomPad + 10 }]}>
            {/* Header inside voice mode */}
            <View style={{ width: "100%", alignItems: "flex-end", paddingRight: 10, paddingTop: 10 }}>
              <Pressable
                onPress={endVoiceMode}
                style={({ pressed }) => [c.modeToggle, pressed && { opacity: 0.7 }, { backgroundColor: "rgba(255,255,255,0.08)", borderRadius: 20 }]}
                hitSlop={12}
              >
                <Feather name="message-square" size={18} color="rgba(255,255,255,0.7)" />
              </Pressable>
            </View>

            <View style={{ flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center' }}>
              {/* Live transcript bubbles float in the center */}
              {lastTranscript.length > 0 && (
                <TranscriptBubble text={lastTranscript} role="user" />
              )}
              {lastTommyReply.length > 0 && agentState !== "thinking" && (
                <TranscriptBubble text={lastTommyReply} role="tommy" />
              )}
            </View>

            {/* Bottom Controls Area */}
            <View style={{ width: '100%', alignItems: 'center', paddingBottom: 20 }}>
              {/* Status */}
              <Text style={[c.voiceStatus, { color: statusColor, textShadowColor: "rgba(0,0,0,0.6)", textShadowOffset: {width:0,height:1}, textShadowRadius: 6 }]}>
                {statusLabel}
              </Text>

              {/* Removed suggestions badges component (c.suggestRow) per user request */}

              {/* Call Controls */}
              <View style={c.micArea}>
                <VoiceControls isMuted={isMuted} onToggleMute={toggleMute} onEndCall={endVoiceMode} />
              </View>
            </View>
          </View>
        </View>
      )}

      {/* ══════════════════════════════════════════════════ */}
      {/*  CHAT MODE                                         */}
      {/* ══════════════════════════════════════════════════ */}
      {viewMode === "chat" && (
        <KeyboardAvoidingView style={c.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <FlatList
            ref={listRef}
            data={msgs}
            keyExtractor={(m) => m.id}
            style={c.list}
            contentContainerStyle={[
              c.listContent,
              msgs.length === 0 ? c.listEmpty : { paddingBottom: listBottom },
            ]}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={c.heroWrap}>
                <TommyOrb state={orbState} size={130} />
                <Text style={c.heroTitle}>Olá{nome ? `, ${nome}` : ""}!</Text>
                <Text style={c.heroBody}>Escreve uma mensagem ou volta ao modo de voz para conversar em tempo real.</Text>
                <View style={c.suggestGrid}>
                  {SUGGESTIONS.map((q) => (
                    <Pressable
                      key={q}
                      style={({ pressed }) => [c.suggestCard, pressed && { opacity: 0.75 }]}
                      disabled={agentState === "thinking" || !storeReady}
                      onPress={() => replyToText(q)}
                    >
                      <LinearGradient
                        colors={["rgba(124,110,250,0.1)", "rgba(79,70,229,0.04)"]}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
                        style={c.suggestCardInner}
                      >
                        <Text style={c.suggestCardText}>{q}</Text>
                      </LinearGradient>
                    </Pressable>
                  ))}
                </View>
              </View>
            }
            renderItem={({ item }) => <ChatRow msg={item} />}
            ListFooterComponent={agentState === "thinking" ? <TypingDots /> : null}
          />

          {/* Composer */}
          <Animated.View style={[c.composerWrap, { paddingBottom: bottomPad + 10, borderColor }]}>
            <BlurView intensity={Platform.OS === "ios" ? 60 : 0} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={c.composer}>
              {/* Mic toggle in chat too */}
              <Pressable
                onPress={toggleMute}
                style={({ pressed }) => [c.iconGhost, pressed && { opacity: 0.7 }]}
              >
                <Feather
                  name={isMuted ? "mic-off" : "mic"}
                  size={20}
                  color={isMuted ? Colors.negative : Colors.accent}
                />
              </Pressable>
              <TextInput
                style={c.input}
                placeholder="Mensagem para o Tommy…"
                placeholderTextColor={Colors.textFaint}
                value={input}
                onChangeText={setInput}
                returnKeyType="default"
                blurOnSubmit={false}
                editable={(agentState === "idle" || agentState === "speaking") && storeReady}
                multiline
                maxLength={2000}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
              />
              <View style={c.composerActions}>
                <Pressable
                  onPress={handleSend}
                  disabled={!input.trim() || agentState === "thinking" || !storeReady}
                  style={({ pressed }) => [
                    c.sendFab,
                    (!input.trim() || agentState === "thinking" || !storeReady) && { opacity: 0.35 },
                    pressed && { opacity: 0.85 },
                  ]}
                >
                  <LinearGradient colors={[Colors.accentLight, Colors.accent]} style={c.sendFabGrad}>
                    <Feather name="arrow-up" size={20} color="#fff" />
                  </LinearGradient>
                </Pressable>
              </View>
            </View>
          </Animated.View>
        </KeyboardAvoidingView>
      )}

      {/* ── Sidebar Modal ── */}
      <Modal visible={sidebarOpen} animationType="fade" transparent onRequestClose={() => setSidebarOpen(false)}>
        <View style={c.drawerRoot}>
          <View style={[c.drawerPanel, { paddingTop: insets.top + 12, paddingBottom: drawerBottomPad }]}>
            <View style={c.drawerHeader}>
              <View style={c.drawerHeaderLeft}>
                <TommyOrb state={orbState} size={32} />
                <Text style={c.drawerTitle}>Conversas</Text>
              </View>
              <Pressable onPress={() => setSidebarOpen(false)} hitSlop={12}>
                <Feather name="x" size={22} color={Colors.textMuted} />
              </Pressable>
            </View>

            <Pressable style={c.newChatBtn} onPress={handleNewChat}>
              <LinearGradient colors={[Colors.accentLight, Colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={c.newChatBtnGrad}>
                <Feather name="edit-3" size={18} color="#fff" />
                <Text style={c.newChatBtnText}>Nova conversa</Text>
              </LinearGradient>
            </Pressable>

            <FlatList
              data={conversations}
              keyExtractor={(item) => item.id}
              contentContainerStyle={c.drawerList}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const selected = item.id === activeConvId;
                return (
                  <View style={[c.convRow, selected && c.convRowSelected]}>
                    <Pressable onPress={() => openConv(item.id)} style={c.convRowBody}>
                      <Text style={c.convTitle} numberOfLines={2}>{item.title}</Text>
                      <Text style={c.convMeta}>{formatConvDate(item.updated_at)}</Text>
                    </Pressable>
                    <Pressable onPress={() => handleDeleteConv(item)} hitSlop={10} style={c.convTrash}>
                      <Feather name="trash-2" size={16} color={Colors.textFaint} />
                    </Pressable>
                  </View>
                );
              }}
              ListEmptyComponent={<Text style={c.drawerEmpty}>Nenhuma conversa guardada.</Text>}
            />
            <Text style={c.drawerHint}>Histórico local. Apagar o app remove os dados.</Text>
          </View>
          <Pressable style={c.drawerBackdrop} onPress={() => setSidebarOpen(false)} />
        </View>
      </Modal>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const c = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  flex: { flex: 1 },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.chatBorder,
    backgroundColor: Colors.bg,
    gap: 8,
    zIndex: 10,
  },
  headerIcon: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { flex: 1, gap: 3 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerOrbWrap: { marginRight: -2 },
  headerTitle: { fontSize: 17, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.2 },
  headerSub: { fontSize: 12, fontFamily: "Inter_400Regular" },
  modeToggle: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  // Voice mode
  voiceScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  voiceOrbArea: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 0,
    width: "100%",
  },
  voiceStatus: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    textAlign: "center",
    marginBottom: 20,
  },
  suggestRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 24,
    width: "100%",
    justifyContent: "center",
  },
  chipBtn: {
    flex: 1,
    maxWidth: 160,
    backgroundColor: "rgba(124,110,250,0.1)",
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSub,
    textAlign: "center",
    lineHeight: 17,
  },
  micArea: { alignItems: "center", gap: 12, marginBottom: 8 },
  micHint: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center" },

  // Chat mode list
  list: { flex: 1 },
  listContent: { paddingTop: 8 },
  listEmpty: { flexGrow: 1 },

  heroWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 80,
    gap: 16,
    minHeight: 420,
  },
  heroTitle: { fontSize: 24, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5, textAlign: "center" },
  heroBody: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textSub, lineHeight: 21, textAlign: "center", maxWidth: 300 },
  suggestGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 8, width: "100%" },
  suggestCard: { width: "48%", flexGrow: 1, minWidth: "46%", borderRadius: 16, borderWidth: 1, borderColor: Colors.accentBorder, overflow: "hidden" },
  suggestCardInner: { paddingVertical: 14, paddingHorizontal: 14 },
  suggestCardText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSub, lineHeight: 18 },

  // Composer
  composerWrap: {
    paddingHorizontal: 14,
    paddingTop: 10,
    borderTopWidth: 1,
    backgroundColor: Colors.bg,
    overflow: "hidden",
  },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    backgroundColor: Colors.composerBg,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: Colors.chatBorder,
    paddingLeft: 8,
    paddingRight: 8,
    paddingVertical: 8,
    gap: 4,
  },
  input: { flex: 1, fontSize: 16, fontFamily: "Inter_400Regular", color: Colors.text, maxHeight: 120, paddingVertical: 8, lineHeight: 22, paddingHorizontal: 8 },
  composerActions: { flexDirection: "row", alignItems: "center", gap: 4, paddingBottom: 2 },
  iconGhost: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  sendFab: { width: 40, height: 40, borderRadius: 20, overflow: "hidden" },
  sendFabGrad: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },

  // Drawer
  drawerRoot: { flex: 1, flexDirection: "row" },
  drawerBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.55)" },
  drawerPanel: { width: "88%", maxWidth: 340, backgroundColor: Colors.surface, borderRightWidth: 1, borderRightColor: Colors.lineStrong },
  drawerHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingBottom: 14 },
  drawerHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  drawerTitle: { fontSize: 20, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.3 },
  newChatBtn: { marginHorizontal: 16, marginBottom: 16, borderRadius: 14, overflow: "hidden" },
  newChatBtnGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14 },
  newChatBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: "#fff" },
  drawerList: { paddingHorizontal: 12, paddingBottom: 12, gap: 6 },
  convRow: { flexDirection: "row", alignItems: "center", paddingVertical: 12, paddingHorizontal: 12, borderRadius: 12, backgroundColor: Colors.overlay, borderWidth: 1, borderColor: Colors.line, gap: 8 },
  convRowSelected: { borderColor: Colors.accentBorder, backgroundColor: Colors.accentSoft },
  convRowBody: { flex: 1, gap: 4 },
  convTitle: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.text, lineHeight: 20 },
  convMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  convTrash: { padding: 8 },
  drawerEmpty: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", paddingVertical: 24 },
  drawerHint: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textFaint, paddingHorizontal: 18, lineHeight: 16 },
});
