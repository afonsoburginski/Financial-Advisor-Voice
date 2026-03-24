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
import { useFinance } from "@/context/FinanceContext";
import { FINANCE, calcularImpactoSandero, formatCurrency } from "@/constants/finance";

type Msg = { id: string; role: "user" | "agent"; text: string };

const NUM_BARS = 7;

function WaveBar({ isActive, delay }: { isActive: boolean; delay: number }) {
  const anim = useRef(new Animated.Value(0.15)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    if (isActive) {
      const randomHeight = () => Math.random() * 0.7 + 0.2;
      const randomDuration = () => 280 + Math.random() * 320;
      const animate = () => {
        loop = Animated.sequence([
          Animated.timing(anim, {
            toValue: randomHeight(),
            duration: randomDuration(),
            useNativeDriver: true,
          }),
          Animated.timing(anim, {
            toValue: randomHeight(),
            duration: randomDuration(),
            useNativeDriver: true,
          }),
        ]);
        loop.start(({ finished }) => {
          if (finished) animate();
        });
      };
      const t = setTimeout(animate, delay);
      return () => {
        clearTimeout(t);
        if (loop) loop.stop();
      };
    } else {
      Animated.timing(anim, {
        toValue: 0.15,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [isActive]);

  return (
    <Animated.View
      style={[
        styles.waveBar,
        { transform: [{ scaleY: anim }] },
        isActive && { backgroundColor: Colors.accent },
      ]}
    />
  );
}

function AgentOrb({ state }: { state: "idle" | "listening" | "thinking" | "speaking" }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (state === "idle") {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1.06, duration: 900, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [state]);

  const stateColors: Record<string, string> = {
    idle: Colors.textFaint,
    listening: Colors.accent,
    thinking: Colors.warning,
    speaking: Colors.positive,
  };

  const stateLabels: Record<string, string> = {
    idle: "Toque o microfone para falar",
    listening: "Ouvindo...",
    thinking: "Processando...",
    speaking: "Respondendo",
  };

  const color = stateColors[state];

  return (
    <View style={styles.orbWrapper}>
      <Animated.View style={[styles.orbOuter, { borderColor: color, opacity: state === "idle" ? 0.2 : 0.18, transform: [{ scale: pulse }] }]} />
      <Animated.View style={[styles.orbInner, { borderColor: color, opacity: state === "idle" ? 0.3 : 0.4, transform: [{ scale: pulse }] }]} />
      <View style={[styles.orbCore, { borderColor: color, borderWidth: state === "idle" ? 1 : 1.5 }]}>
        <View style={[styles.orbDot, { backgroundColor: color }]} />
      </View>
      <Text style={[styles.orbLabel, { color: state === "idle" ? Colors.textMuted : Colors.textSub }]}>
        {stateLabels[state]}
      </Text>
    </View>
  );
}

function processarFala(
  texto: string,
  sobraMensal: number
): { response: string; valor?: number; titulo?: string; categoria?: string } {
  const lower = texto.toLowerCase();
  const matchValor = texto.match(/r\$\s*([\d.,]+)/i);
  const valor = matchValor ? parseFloat(matchValor[1].replace(".", "").replace(",", ".")) : null;

  if (valor && valor > 0) {
    const dias = calcularImpactoSandero(valor);
    const nova = sobraMensal - valor;
    let cat = "Outros";
    if (/comida|aliment|restauran|mercearia/.test(lower)) cat = "Alimentação";
    else if (/saude|médic|remédio|hospital|farmácia/.test(lower)) cat = "Saúde";
    else if (/lazer|cinema|bar|passeio|jogo/.test(lower)) cat = "Lazer";
    else if (/roupa|vest|calçado|tênis/.test(lower)) cat = "Vestuário";
    else if (/uber|ônibus|transporte|carro|gasolina/.test(lower)) cat = "Transporte";
    else if (/curso|educação|estudo|livro/.test(lower)) cat = "Educação";
    else if (/celular|tecnolog|notebook|computador/.test(lower)) cat = "Tecnologia";

    const parts = lower.split(/r\$/i);
    const titulo = parts[0].trim().slice(-40) || texto.slice(0, 40);

    return {
      response:
        `${formatCurrency(valor)} atrasa seu Sandero em ${dias} dias. ` +
        (nova >= 0
          ? `Sua sobra ficaria ${formatCurrency(nova)}.`
          : "Isso ultrapassa sua sobra do mês."),
      valor,
      titulo: titulo || texto.slice(0, 40),
      categoria: cat,
    };
  }
  if (/sobra|saldo|quanto tenho|disponível/.test(lower))
    return { response: `Sua sobra atual é ${formatCurrency(sobraMensal)}.` };
  if (/sandero|meta|carro/.test(lower)) {
    const m = Math.ceil(FINANCE.META_SANDERO.valor / sobraMensal);
    return { response: `Meta: ${formatCurrency(FINANCE.META_SANDERO.valor)}. Com ${formatCurrency(sobraMensal)} por mês, são ${m} meses guardando tudo.` };
  }
  if (/pcd|ipva|iof|benefício|isençã/.test(lower))
    return { response: "Como PCD com visão monocular você tem isenção de IPVA e IOF. Isso reduz o custo do Sandero." };
  if (/custo|fixo|gasto/.test(lower))
    return { response: `Custos fixos mensais: ${formatCurrency(FINANCE.TOTAL_CUSTOS_FIXOS)}. Maior parte é aluguel: ${formatCurrency(FINANCE.CUSTOS_FIXOS.aluguel)}.` };

  return { response: "Me diga um gasto com o valor em R$ para calcular o impacto no Sandero." };
}

export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const { sobraMensal, addDecisao } = useFinance();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [state, setState] = useState<"idle" | "listening" | "thinking" | "speaking">("idle");
  const [input, setInput] = useState("");
  const [isActiveWave, setIsActiveWave] = useState(false);
  const listRef = useRef<FlatList>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const webTop = Platform.OS === "web" ? 67 : 0;

  const addMsg = (role: "user" | "agent", text: string) => {
    const id = `${Date.now()}-${Math.random()}`;
    setMsgs((p) => [...p, { id, role, text }]);
    setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 80);
    return id;
  };

  const processText = useCallback(
    async (text: string) => {
      addMsg("user", text);
      setState("thinking");
      setIsActiveWave(true);
      await new Promise((r) => setTimeout(r, 600));
      const { response, valor, titulo, categoria } = processarFala(text, sobraMensal);
      addMsg("agent", response);
      if (valor && titulo && categoria) {
        await addDecisao(titulo, valor, categoria);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
      setState("speaking");
      Speech.speak(response, {
        language: "pt-BR",
        rate: 0.95,
        onDone: () => { setState("idle"); setIsActiveWave(false); },
        onStopped: () => { setState("idle"); setIsActiveWave(false); },
      });
    },
    [sobraMensal, addDecisao]
  );

  const handleMic = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Modo Voz", "Use o campo de texto abaixo no web. No app nativo a gravação funciona completa.");
      return;
    }
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (state === "listening") {
      setState("thinking");
      setIsActiveWave(false);
      if (durationRef.current) clearInterval(durationRef.current);
      if (recordingRef.current) {
        try { await recordingRef.current.stopAndUnloadAsync(); } catch {}
        recordingRef.current = null;
      }
      await processText("Qual minha sobra mensal atual?");
      return;
    }

    if (state !== "idle") return;

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") { Alert.alert("Permissão", "Precisamos do microfone."); return; }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(Audio.RecordingOptionsPresets.HIGH_QUALITY);
      recordingRef.current = recording;
      setState("listening");
      setIsActiveWave(true);
    } catch {
      Alert.alert("Erro", "Não foi possível iniciar a gravação.");
    }
  }, [state, processText]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text) return;
    setInput("");
    Keyboard.dismiss();
    await processText(text);
  }, [input, processText]);

  const stopSpeaking = () => {
    Speech.stop();
    setState("idle");
    setIsActiveWave(false);
  };

  const micIcon = state === "listening" ? "square" : "mic";
  const micColor = state === "listening" ? Colors.negative : state !== "idle" ? Colors.textMuted : Colors.accent;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top + webTop }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Agent orb + waveform area */}
      <View style={styles.agentArea}>
        <AgentOrb state={state} />

        {/* Waveform */}
        <View style={styles.waveContainer}>
          {Array.from({ length: NUM_BARS }).map((_, i) => (
            <WaveBar key={i} isActive={isActiveWave} delay={i * 60} />
          ))}
        </View>
      </View>

      {/* Transcript */}
      <FlatList
        ref={listRef}
        data={msgs}
        keyExtractor={(m) => m.id}
        style={styles.transcript}
        contentContainerStyle={styles.transcriptContent}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <Text style={styles.emptyHint}>
            Diga algo como:{"\n"}
            <Text style={{ color: Colors.accent }}>"Gastei R$ 80 com lazer"</Text>
            {"\n"}para calcular o impacto no Sandero.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={[styles.msgRow, item.role === "user" && styles.msgRowUser]}>
            <Text style={[styles.msgText, item.role === "user" && styles.msgTextUser]}>
              {item.text}
            </Text>
          </View>
        )}
      />

      {/* Mic + input row */}
      <View style={[styles.controls, { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 8) }]}>
        {state === "speaking" && (
          <Pressable onPress={stopSpeaking} style={styles.stopRow}>
            <Feather name="volume-x" size={12} color={Colors.textMuted} />
            <Text style={styles.stopText}>parar voz</Text>
          </Pressable>
        )}
        <View style={styles.inputRow}>
          <TextInput
            style={styles.textInput}
            placeholder="ou escreva aqui..."
            placeholderTextColor={Colors.textFaint}
            value={input}
            onChangeText={setInput}
            returnKeyType="send"
            onSubmitEditing={handleSend}
            editable={state === "idle" || state === "speaking"}
          />
          {input.length > 0 ? (
            <Pressable onPress={handleSend} style={styles.sendBtn}>
              <Feather name="send" size={15} color={Colors.bg} />
            </Pressable>
          ) : (
            <Pressable
              onPress={handleMic}
              style={[styles.micBtn, state === "listening" && styles.micBtnActive]}
              disabled={state === "thinking"}
            >
              <Feather name={micIcon} size={18} color={state === "thinking" ? Colors.textFaint : Colors.bg} />
            </Pressable>
          )}
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  agentArea: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 32,
    gap: 32,
  },

  orbWrapper: { alignItems: "center", gap: 20 },
  orbOuter: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    borderWidth: 1,
  },
  orbInner: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 1,
  },
  orbCore: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderColor: Colors.textFaint,
    alignItems: "center",
    justifyContent: "center",
  },
  orbDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Colors.textFaint,
  },
  orbLabel: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    letterSpacing: 0.3,
    marginTop: 8,
  },

  waveContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    height: 48,
  },
  waveBar: {
    width: 3,
    height: 40,
    borderRadius: 2,
    backgroundColor: Colors.textFaint,
  },

  transcript: { flex: 1 },
  transcriptContent: {
    paddingHorizontal: 24,
    paddingVertical: 8,
    gap: 14,
    flexGrow: 1,
    justifyContent: "flex-end",
  },
  emptyHint: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    lineHeight: 22,
    paddingVertical: 24,
  },
  msgRow: {
    alignSelf: "flex-start",
    maxWidth: "82%",
  },
  msgRowUser: {
    alignSelf: "flex-end",
  },
  msgText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSub,
    lineHeight: 21,
  },
  msgTextUser: {
    color: Colors.text,
    fontFamily: "Inter_500Medium",
    textAlign: "right",
  },

  controls: {
    borderTopWidth: 1,
    borderTopColor: Colors.line,
    paddingTop: 12,
    paddingHorizontal: 20,
    backgroundColor: Colors.bg,
    gap: 8,
  },
  stopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "center",
  },
  stopText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 100,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.lineStrong,
  },
  micBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  micBtnActive: {
    backgroundColor: Colors.negative,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
});
