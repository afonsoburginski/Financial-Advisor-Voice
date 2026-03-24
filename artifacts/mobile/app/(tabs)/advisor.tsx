import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Animated,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import Colors from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/layout";
import { useFinanceViewModel } from "@/viewmodels/useFinanceViewModel";
import { useUserViewModel } from "@/viewmodels/useUserViewModel";
import { FINANCE, calcularImpactoSandero, formatCurrency } from "@/constants/finance";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentState = "idle" | "listening" | "thinking" | "speaking";
type MsgRole = "user" | "tommy";
interface Msg { id: string; role: MsgRole; text: string; ts: number }

// ─── Arc Reactor Orb ─────────────────────────────────────────────────────────

function TommyOrb({ state }: { state: AgentState }) {
  const pulse = useRef(new Animated.Value(1)).current;
  const glow = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (state === "idle") {
      Animated.parallel([
        Animated.timing(pulse, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(glow, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 1, duration: 900, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
          Animated.timing(glow, { toValue: 0.4, duration: 900, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state]);

  const colors: Record<AgentState, string> = {
    idle: Colors.textFaint,
    listening: Colors.negative,
    thinking: Colors.money,
    speaking: Colors.accent,
  };

  const c = colors[state];
  const glowOpacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.2] });

  return (
    <View style={orb.wrap}>
      {/* Outer glow */}
      <Animated.View
        style={[orb.glowRing, { borderColor: c, backgroundColor: c, opacity: glowOpacity }]}
      />
      {/* Ring 3 */}
      <Animated.View
        style={[orb.ring3, { borderColor: c, opacity: 0.12, transform: [{ scale: pulse }] }]}
      />
      {/* Ring 2 */}
      <Animated.View
        style={[orb.ring2, { borderColor: c, opacity: 0.25, transform: [{ scale: pulse }] }]}
      />
      {/* Ring 1 */}
      <Animated.View
        style={[orb.ring1, { borderColor: c, opacity: 0.5, transform: [{ scale: pulse }] }]}
      />
      {/* Core */}
      <View style={[orb.core, { borderColor: c, borderWidth: state === "idle" ? 1 : 1.5 }]}>
        <View style={[orb.coreDot, { backgroundColor: c }]} />
      </View>
    </View>
  );
}

const orb = StyleSheet.create({
  wrap: { width: 100, height: 100, alignItems: "center", justifyContent: "center" },
  glowRing: {
    position: "absolute", width: 100, height: 100, borderRadius: 50,
    borderWidth: 0,
  },
  ring3: {
    position: "absolute", width: 96, height: 96, borderRadius: 48,
    borderWidth: 1,
  },
  ring2: {
    position: "absolute", width: 72, height: 72, borderRadius: 36,
    borderWidth: 1,
  },
  ring1: {
    position: "absolute", width: 52, height: 52, borderRadius: 26,
    borderWidth: 1,
  },
  core: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  coreDot: { width: 8, height: 8, borderRadius: 4 },
});

// ─── Wave Bars ────────────────────────────────────────────────────────────────

function WaveBars({ active }: { active: boolean }) {
  const bars = Array.from({ length: 5 });
  const anims = useRef(bars.map(() => new Animated.Value(0.2))).current;

  useEffect(() => {
    if (!active) {
      anims.forEach((a) =>
        Animated.timing(a, { toValue: 0.2, duration: 200, useNativeDriver: true }).start()
      );
      return;
    }
    let running = true;
    anims.forEach((a, i) => {
      const tick = () => {
        if (!running) return;
        Animated.sequence([
          Animated.timing(a, { toValue: 0.3 + Math.random() * 0.7, duration: 200 + Math.random() * 300, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0.15 + Math.random() * 0.35, duration: 150 + Math.random() * 200, useNativeDriver: true }),
        ]).start(({ finished }) => { if (finished) tick(); });
      };
      setTimeout(tick, i * 60);
    });
    return () => { running = false; };
  }, [active]);

  if (!active) return null;

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, height: 24, marginTop: 8 }}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={{
            width: 3, height: 20, borderRadius: 1.5,
            backgroundColor: Colors.accent,
            transform: [{ scaleY: a }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Message Bubble ───────────────────────────────────────────────────────────

function Bubble({ msg }: { msg: Msg }) {
  const isUser = msg.role === "user";
  return (
    <View style={[bbl.wrap, isUser ? bbl.wrapUser : bbl.wrapTommy]}>
      {!isUser && <Text style={bbl.fromLabel}>TOMMY</Text>}
      <Text style={[bbl.text, isUser ? bbl.textUser : bbl.textTommy]}>{msg.text}</Text>
    </View>
  );
}

const bbl = StyleSheet.create({
  wrap: { maxWidth: "80%", gap: 4 },
  wrapUser: { alignSelf: "flex-end" },
  wrapTommy: { alignSelf: "flex-start" },
  fromLabel: {
    fontSize: 8, fontFamily: "Inter_600SemiBold",
    color: Colors.accent, letterSpacing: 2, marginLeft: 2,
  },
  text: {
    fontSize: 14, fontFamily: "Inter_400Regular",
    lineHeight: 21, borderRadius: 16, padding: 12,
  },
  textUser: {
    color: Colors.text, backgroundColor: Colors.accentSoft,
    borderWidth: 1, borderColor: Colors.accentBorder,
    fontFamily: "Inter_400Regular",
    textAlign: "right",
  },
  textTommy: {
    color: Colors.textSub, backgroundColor: Colors.surface,
    borderWidth: 1, borderColor: Colors.lineMedium,
  },
});

// ─── Advisor logic ────────────────────────────────────────────────────────────

function processar(
  text: string,
  sobraMensal: number,
  nome: string
): { reply: string; valor?: number; titulo?: string; categoria?: string } {
  const low = text.toLowerCase();
  const m = text.match(/r\$\s*([\d.,]+)/i);
  const val = m ? parseFloat(m[1].replace(/\./g, "").replace(",", ".")) : null;

  if (val && val > 0) {
    const dias = calcularImpactoSandero(val);
    const nova = sobraMensal - val;
    let cat = "Outros";
    if (/comida|aliment|restauran|mercearia|lanche/.test(low)) cat = "Alimentação";
    else if (/saude|médic|remédio|hospital|farmácia|dentist/.test(low)) cat = "Saúde";
    else if (/lazer|cinema|bar|passeio|jogo|streaming/.test(low)) cat = "Lazer";
    else if (/roupa|vest|calçado|tênis|moda/.test(low)) cat = "Vestuário";
    else if (/uber|ônibus|transporte|carro|gasolina|posto/.test(low)) cat = "Transporte";
    else if (/curso|educação|estudo|livro|faculdade/.test(low)) cat = "Educação";
    else if (/celular|tecnolog|notebook|computador|gadget/.test(low)) cat = "Tecnologia";

    const tituloRaw = text.replace(/r\$\s*[\d.,]+/i, "").trim().slice(0, 60) || text.slice(0, 60);
    const reply =
      `Registrado. ${formatCurrency(val)} → atrasa o ${FINANCE.META_SANDERO.nome} em ${dias} dia${dias !== 1 ? "s" : ""}. ` +
      (nova >= 0
        ? `Sobra ajustada: ${formatCurrency(nova)}.`
        : `Atenção, ${nome}: ultrapassa a sobra em ${formatCurrency(Math.abs(nova))}.`);
    return { reply, valor: val, titulo: tituloRaw, categoria: cat };
  }

  if (/sobra|saldo|quanto (tenho|tenho disponível|posso gastar)/.test(low))
    return { reply: `Sua sobra atual é ${formatCurrency(sobraMensal)}, ${nome}. Com esse ritmo o ${FINANCE.META_SANDERO.nome} fica em ~${Math.ceil(FINANCE.META_SANDERO.valor / sobraMensal)} meses.` };
  if (/meta|sandero|carro|veículo/.test(low))
    return { reply: `Meta: ${formatCurrency(FINANCE.META_SANDERO.valor)} à vista. Faltam ~${Math.ceil(FINANCE.META_SANDERO.valor / sobraMensal)} meses guardando tudo. Com as isenções você economiza no IOF.` };
  if (/agenda|tarefa|pendente|lembrete/.test(low))
    return { reply: `Confira a aba Agenda para suas tarefas. Quer que eu registre algo novo agora?` };
  if (/custo|fixo|gasto|despesa/.test(low))
    return { reply: `Seus custos fixos somam ${formatCurrency(FINANCE.TOTAL_CUSTOS_FIXOS)}. O maior é aluguel/condomínio (${formatCurrency(FINANCE.CUSTOS_FIXOS.aluguel)}). Quer analisar algum item específico?` };
  if (/olá|oi|ei|bom dia|boa tarde|boa noite|tudo bem|como vai/.test(low))
    return { reply: `Tudo funcionando aqui. Pronto para ajudar, ${nome}. Finanças, agenda, decisões — como prefere começar?` };
  if (/obrigad|valeu|thanks/.test(low))
    return { reply: `Disponha, ${nome}.` };
  if (/quem.*você|o que.*você|o que.*tommy/.test(low))
    return { reply: `Sou Tommy, seu advisor pessoal. Monitoro suas finanças, agenda e te ajudo em decisões. Funciono como um Jarvis pessoal — só que voltado para sua vida real.` };
  if (/renda|salário|pagamento/.test(low))
    return { reply: `Renda mensal líquida confirmada. VA incluído. Todos os detalhes estão no seu dashboard.` };

  return { reply: `Pode ser mais específico, ${nome}? Estou aqui para finanças, planejamento, decisões e agenda.` };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

const STATE_LABELS: Record<AgentState, string> = {
  idle: "em espera",
  listening: "ouvindo",
  thinking: "processando",
  speaking: "respondendo",
};

export default function AdvisorScreen() {
  const insets = useSafeAreaInsets();
  const { sobraMensal, createDecisao } = useFinanceViewModel();
  const { greeting, nome } = useUserViewModel();
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);

  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + TAB_BAR_HEIGHT;

  const addMsg = (role: MsgRole, text: string) => {
    const msg: Msg = { id: `${Date.now()}-${Math.random()}`, role, text, ts: Date.now() };
    setMsgs((p) => [...p, msg]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
  };

  const reply = useCallback(
    async (text: string) => {
      addMsg("user", text);
      setAgentState("thinking");
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 300));

      const { reply: replyText, valor, titulo, categoria } = processar(text, sobraMensal, nome);
      addMsg("tommy", replyText);
      setAgentState("speaking");

      if (valor && titulo && categoria) {
        createDecisao({ titulo, valor, categoria });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

      Speech.speak(replyText, {
        language: "pt-BR",
        rate: 0.9,
        onDone: () => setAgentState("idle"),
        onStopped: () => setAgentState("idle"),
      });
    },
    [sobraMensal, createDecisao, nome]
  );

  const handleMic = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Tommy", "Gravação de voz disponível no app nativo.");
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (agentState === "listening") {
      setAgentState("thinking");
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }
      await reply("Qual minha sobra mensal atual?");
      return;
    }
    if (agentState !== "idle") {
      Speech.stop();
      setAgentState("idle");
      return;
    }

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permissão", "Precisamos do microfone."); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setAgentState("listening");
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar gravação.");
    }
  }, [agentState, reply]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    Keyboard.dismiss();
    await reply(text);
  }, [input, reply]);

  const isActive = agentState !== "idle";

  return (
    <KeyboardAvoidingView
      style={[s.container]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={bottomPad}
    >
      {/* ── Top: Greeting + Orb ─────────────────────────────── */}
      <View style={[s.heroArea, { paddingTop: topPad + 8 }]}>
        <View style={s.greetRow}>
          <View>
            <Text style={s.greetText}>{greeting()}</Text>
            <Text style={s.greetSub}>Tommy  ·  {STATE_LABELS[agentState]}</Text>
          </View>
          <View style={s.stateChip}>
            <View style={[s.stateDot, { backgroundColor: isActive ? Colors.accent : Colors.textFaint }]} />
            <Text style={[s.stateText, { color: isActive ? Colors.accent : Colors.textFaint }]}>
              {agentState === "idle" ? "online" : agentState}
            </Text>
          </View>
        </View>

        {/* Orb */}
        <TommyOrb state={agentState} />
        <WaveBars active={isActive} />
      </View>

      {/* ── Messages ────────────────────────────────────────── */}
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyWrap}>
            <Text style={s.emptyTitle}>Como posso ajudar?</Text>
            <Text style={s.emptySub}>Pergunte sobre finanças, agenda,{"\n"}decisões ou qualquer planejamento.</Text>
            <View style={s.suggestRow}>
              {["Qual minha sobra?", "Status do Sandero", "Registrar gasto"].map((q) => (
                <Pressable
                  key={q}
                  style={s.suggestChip}
                  onPress={() => reply(q)}
                >
                  <Text style={s.suggestText}>{q}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        }
        renderItem={({ item }) => <Bubble msg={item} />}
      />

      {/* ── Input bar ─────────────────────────────────────── */}
      <View style={[s.bar, { paddingBottom: bottomPad + 8 }]}>
        <TextInput
          style={s.input}
          placeholder="Pergunte ao Tommy..."
          placeholderTextColor={Colors.textFaint}
          value={input}
          onChangeText={setInput}
          returnKeyType="send"
          onSubmitEditing={handleSend}
          editable={agentState === "idle" || agentState === "speaking"}
          multiline={false}
        />
        {input.length > 0 ? (
          <Pressable onPress={handleSend} style={[s.iconBtn, { backgroundColor: Colors.accent }]}>
            <Feather name="send" size={16} color={Colors.bg} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleMic}
            style={[
              s.iconBtn,
              agentState === "listening" && { backgroundColor: Colors.negative },
              agentState === "thinking" && { backgroundColor: Colors.surface },
              agentState === "speaking" && { backgroundColor: Colors.accentSoft, borderWidth: 1, borderColor: Colors.accentBorder },
              agentState === "idle" && { backgroundColor: Colors.accent },
            ]}
          >
            <Feather
              name={agentState === "listening" ? "square" : agentState !== "idle" ? "x" : "mic"}
              size={16}
              color={agentState === "thinking" ? Colors.textFaint : Colors.bg}
            />
          </Pressable>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  heroArea: {
    alignItems: "center",
    paddingHorizontal: 24,
    paddingBottom: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  greetRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    width: "100%",
  },
  greetText: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    letterSpacing: -0.4,
  },
  greetSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 3,
    letterSpacing: 0.3,
  },
  stateChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.surface,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.lineMedium,
  },
  stateDot: { width: 6, height: 6, borderRadius: 3 },
  stateText: { fontSize: 10, fontFamily: "Inter_500Medium", letterSpacing: 0.3 },

  list: { flex: 1 },
  listContent: {
    flexGrow: 1,
    justifyContent: "flex-end",
    padding: 20,
    gap: 14,
    paddingBottom: 12,
  },

  emptyWrap: { paddingVertical: 20, alignItems: "center", gap: 10 },
  emptyTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.textSub },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center", lineHeight: 20 },
  suggestRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 8 },
  suggestChip: {
    paddingHorizontal: 12, paddingVertical: 7,
    borderRadius: 100, borderWidth: 1, borderColor: Colors.accentBorder,
    backgroundColor: Colors.accentGlow,
  },
  suggestText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.accent },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.lineStrong,
    minHeight: 46,
  },
  iconBtn: {
    width: 44, height: 44, borderRadius: 22,
    alignItems: "center", justifyContent: "center",
    flexShrink: 0,
  },
});
