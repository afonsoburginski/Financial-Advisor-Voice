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
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import Colors from "@/constants/colors";
import { useFinanceViewModel } from "@/viewmodels/useFinanceViewModel";
import { FINANCE, calcularImpactoSandero, formatCurrency } from "@/constants/finance";

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentState = "idle" | "listening" | "thinking" | "speaking";
type MsgRole = "user" | "tommy";
interface Msg { id: string; role: MsgRole; text: string }

// ─── WaveBar ─────────────────────────────────────────────────────────────────

function WaveBar({ active, delay }: { active: boolean; delay: number }) {
  const h = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    if (!active) {
      Animated.timing(h, { toValue: 0.15, duration: 250, useNativeDriver: true }).start();
      return;
    }
    let running = true;
    const tick = () => {
      if (!running) return;
      Animated.sequence([
        Animated.timing(h, {
          toValue: 0.2 + Math.random() * 0.75,
          duration: 250 + Math.random() * 300,
          useNativeDriver: true,
        }),
        Animated.timing(h, {
          toValue: 0.15 + Math.random() * 0.35,
          duration: 200 + Math.random() * 250,
          useNativeDriver: true,
        }),
      ]).start(({ finished }) => { if (finished) tick(); });
    };
    const t = setTimeout(tick, delay);
    return () => { running = false; clearTimeout(t); };
  }, [active]);

  const color = active ? Colors.accent : Colors.textFaint;
  return (
    <Animated.View
      style={[s.waveBar, { backgroundColor: color, transform: [{ scaleY: h }] }]}
    />
  );
}

// ─── Orb ─────────────────────────────────────────────────────────────────────

function Orb({ state }: { state: AgentState }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === "idle") { pulse.setValue(1); return; }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.07, duration: 850, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 850, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state]);

  const colors: Record<AgentState, string> = {
    idle: Colors.textFaint,
    listening: Colors.accent,
    thinking: Colors.money,
    speaking: Colors.positive,
  };
  const labels: Record<AgentState, string> = {
    idle: "toque para falar",
    listening: "ouvindo...",
    thinking: "pensando...",
    speaking: "respondendo",
  };
  const c = colors[state];

  return (
    <View style={s.orbWrap}>
      <Animated.View style={[s.orbRing2, { borderColor: c, opacity: 0.1, transform: [{ scale: pulse }] }]} />
      <Animated.View style={[s.orbRing1, { borderColor: c, opacity: 0.2, transform: [{ scale: pulse }] }]} />
      <View style={[s.orbCore, { borderColor: c, borderWidth: state === "idle" ? 1 : 1.5 }]}>
        <MaterialCommunityIcons name="creation" size={22} color={c} />
      </View>
      <Text style={[s.orbLabel, { color: state === "idle" ? Colors.textMuted : Colors.textSub }]}>
        {labels[state]}
      </Text>
    </View>
  );
}

// ─── Advisor logic ────────────────────────────────────────────────────────────

function processar(
  text: string,
  sobraMensal: number
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

    const beforeVal = low.split(/r\$/i)[0].trim();
    const titulo = beforeVal.slice(-50) || text.slice(0, 50);
    const reply =
      `${formatCurrency(val)} → atrasa seu Sandero em ${dias} dias. ` +
      (nova >= 0
        ? `Sobra ajustada: ${formatCurrency(nova)}.`
        : `Atenção: ultrapassa sua sobra em ${formatCurrency(Math.abs(nova))}.`);
    return { reply, valor: val, titulo, categoria: cat };
  }

  if (/sobra|saldo|quanto tenho|disponível/.test(low))
    return { reply: `Sua sobra mensal estimada é ${formatCurrency(sobraMensal)}. Com ela, o Sandero fica em ~${Math.ceil(FINANCE.META_SANDERO.valor / sobraMensal)} meses guardando tudo.` };
  if (/sandero|meta|carro/.test(low))
    return { reply: `Meta: ${formatCurrency(FINANCE.META_SANDERO.valor)} à vista. Com ${formatCurrency(sobraMensal)}/mês → ${Math.ceil(FINANCE.META_SANDERO.valor / sobraMensal)} meses. Com isenção de IOF você economiza mais.` };
  if (/pcd|ipva|iof|isençã|benefício/.test(low))
    return { reply: "Como PCD (visão monocular) você tem isenção de IPVA e IOF. Isso reduz o custo total do Sandero e de outros veículos." };
  if (/custo|fixo|gasto/.test(low))
    return { reply: `Custos fixos: ${formatCurrency(FINANCE.TOTAL_CUSTOS_FIXOS)}. O maior é aluguel: ${formatCurrency(FINANCE.CUSTOS_FIXOS.aluguel)}.` };
  if (/agenda|tarefa|lembrete/.test(low))
    return { reply: "Para gerenciar tarefas e agenda, acesse a aba Agenda. Posso ajudar a planejar qualquer coisa por aqui!" };
  if (/olá|oi|bom dia|boa tarde|boa noite|tudo bem/.test(low))
    return { reply: "Olá! Sou o Tommy, seu advisor pessoal. Posso ajudar com finanças, planejamento, decisões e agenda. O que precisa?" };
  if (/plano|planejamento|plan/.test(low))
    return { reply: "Para planejamento, me conta mais: é algo financeiro, de tempo ou de vida? Pode ser específico — aqui é confidencial." };

  return { reply: "Pode me contar mais detalhes? Estou aqui para ajudar com finanças, planejamento, decisões e muito mais." };
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AdvisorScreen() {
  const insets = useSafeAreaInsets();
  const { sobraMensal, createDecisao } = useFinanceViewModel();
  const [agentState, setAgentState] = useState<AgentState>("idle");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const webTop = Platform.OS === "web" ? 67 : 0;

  const addMsg = (role: MsgRole, text: string) => {
    setMsgs((p) => [...p, { id: `${Date.now()}-${Math.random()}`, role, text }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
  };

  const reply = useCallback(
    async (text: string) => {
      addMsg("user", text);
      setAgentState("thinking");
      await new Promise((r) => setTimeout(r, 500));

      const { reply: replyText, valor, titulo, categoria } = processar(text, sobraMensal);
      addMsg("tommy", replyText);
      setAgentState("speaking");

      if (valor && titulo && categoria) {
        createDecisao({ titulo, valor, categoria });
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

      Speech.speak(replyText, {
        language: "pt-BR",
        rate: 0.92,
        onDone: () => setAgentState("idle"),
        onStopped: () => setAgentState("idle"),
      });
    },
    [sobraMensal, createDecisao]
  );

  const handleMic = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Tommy", "Gravação disponível no app nativo. Use o texto abaixo.");
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

    if (agentState !== "idle") { Speech.stop(); setAgentState("idle"); return; }

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

  const isWaveActive = agentState === "listening" || agentState === "speaking";
  const micIcon = agentState === "listening" ? "square" : agentState !== "idle" ? "x" : "mic";

  return (
    <KeyboardAvoidingView
      style={[s.container, { paddingTop: insets.top + webTop }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Agent area */}
      <View style={s.agentArea}>
        <Orb state={agentState} />
        <View style={s.waveRow}>
          {Array.from({ length: 9 }).map((_, i) => (
            <WaveBar key={i} active={isWaveActive} delay={i * 55} />
          ))}
        </View>
      </View>

      {/* Transcript */}
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        style={s.list}
        contentContainerStyle={s.listContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={s.emptyHint}>
            Fale com o Tommy sobre finanças, planejamento,{"\n"}decisões e agenda.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[s.bubble, item.role === "user" ? s.bubbleUser : s.bubbleTommy]}>
            <Text style={[s.bubbleText, item.role === "user" ? s.bubbleTextUser : s.bubbleTextTommy]}>
              {item.text}
            </Text>
          </View>
        )}
      />

      {/* Input bar */}
      <View style={[s.bar, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8) }]}>
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
          <Pressable onPress={handleSend} style={[s.actionBtn, { backgroundColor: Colors.accent }]}>
            <Feather name="send" size={16} color={Colors.bg} />
          </Pressable>
        ) : (
          <Pressable
            onPress={handleMic}
            style={[
              s.actionBtn,
              agentState === "listening" && { backgroundColor: Colors.negative },
              agentState === "thinking" && { backgroundColor: Colors.surface },
              agentState === "speaking" && { backgroundColor: Colors.warning + "33" },
              agentState === "idle" && { backgroundColor: Colors.accent },
            ]}
          >
            <Feather
              name={micIcon}
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

  agentArea: { alignItems: "center", paddingVertical: 28, gap: 24 },

  orbWrap: { alignItems: "center", gap: 14 },
  orbRing2: { position: "absolute", width: 140, height: 140, borderRadius: 70, borderWidth: 1 },
  orbRing1: { position: "absolute", width: 96, height: 96, borderRadius: 48, borderWidth: 1 },
  orbCore: {
    width: 60, height: 60, borderRadius: 30, borderColor: Colors.textFaint,
    alignItems: "center", justifyContent: "center",
    backgroundColor: Colors.surface,
  },
  orbLabel: { fontSize: 12, fontFamily: "Inter_400Regular", letterSpacing: 0.4, marginTop: 4 },

  waveRow: { flexDirection: "row", alignItems: "center", gap: 5, height: 44 },
  waveBar: { width: 3, height: 36, borderRadius: 2, backgroundColor: Colors.textFaint },

  list: { flex: 1 },
  listContent: {
    padding: 20,
    gap: 12,
    flexGrow: 1,
    justifyContent: "flex-end",
    paddingBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingVertical: 24,
  },

  bubble: { maxWidth: "82%", borderRadius: 14, padding: 12 },
  bubbleUser: { alignSelf: "flex-end", backgroundColor: Colors.accentSoft, borderWidth: 1, borderColor: Colors.accentBorder },
  bubbleTommy: { alignSelf: "flex-start", backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.lineMedium },
  bubbleText: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21 },
  bubbleTextUser: { color: Colors.accentLight, fontFamily: "Inter_500Medium", textAlign: "right" },
  bubbleTextTommy: { color: Colors.textSub },

  bar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    backgroundColor: Colors.bg,
  },
  input: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 100,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.lineStrong,
  },
  actionBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
  },
});
