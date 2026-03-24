import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  Alert,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import * as Speech from "expo-speech";
import { Audio } from "expo-av";
import Colors from "@/constants/colors";
import { useFinance } from "@/context/FinanceContext";
import {
  FINANCE,
  calcularImpactoSandero,
  formatCurrency,
} from "@/constants/finance";

type Message = {
  id: string;
  type: "user" | "ai";
  text: string;
};

const CATEGORIAS = FINANCE.CATEGORIAS;

function processarPergunta(
  texto: string,
  sobraMensal: number
): { response: string; valor?: number; titulo?: string; categoria?: string } {
  const lower = texto.toLowerCase();

  const matchValor = texto.match(/r\$\s*([\d.,]+)/i);
  const valor = matchValor
    ? parseFloat(matchValor[1].replace(".", "").replace(",", "."))
    : null;

  if (valor && valor > 0) {
    const diasAtraso = calcularImpactoSandero(valor);
    const novasobra = sobraMensal - valor;
    const response =
      `Esse gasto de ${formatCurrency(valor)} atrasa seu Sandero em ${diasAtraso} dias. ` +
      `Sua nova sobra seria ${formatCurrency(Math.max(0, novasobra))}. ` +
      (novasobra < 0 ? "Atenção: isso ultrapassa sua sobra mensal!" : "Ainda está dentro do orçamento.");

    let categoria = "Outros";
    if (lower.includes("comida") || lower.includes("aliment") || lower.includes("restauran")) categoria = "Alimentação";
    else if (lower.includes("saude") || lower.includes("médic") || lower.includes("remédio") || lower.includes("hospital")) categoria = "Saúde";
    else if (lower.includes("lazer") || lower.includes("cinema") || lower.includes("bar") || lower.includes("passeio")) categoria = "Lazer";
    else if (lower.includes("roupa") || lower.includes("vest")) categoria = "Vestuário";
    else if (lower.includes("transporte") || lower.includes("uber") || lower.includes("carro")) categoria = "Transporte";
    else if (lower.includes("curso") || lower.includes("educação") || lower.includes("estudo")) categoria = "Educação";
    else if (lower.includes("celular") || lower.includes("tecnolog") || lower.includes("notebook")) categoria = "Tecnologia";

    const tituloMatch = lower.match(/gastei? (?:com |no |na |em )?(.+?) (?:de|no valor|r\$|,)/i);
    const titulo = tituloMatch ? tituloMatch[1] : texto.slice(0, 40);

    return { response, valor, titulo, categoria };
  }

  if (lower.includes("sobra") || lower.includes("quanto tenho") || lower.includes("saldo")) {
    return {
      response: `Sua sobra mensal estimada é ${formatCurrency(sobraMensal)}. Com ela você pode alcançar o Sandero em ${Math.ceil(FINANCE.META_SANDERO.valor / sobraMensal)} meses guardando tudo.`,
    };
  }

  if (lower.includes("sandero") || lower.includes("meta") || lower.includes("carro")) {
    const meses = Math.ceil(FINANCE.META_SANDERO.valor / sobraMensal);
    return {
      response: `Sua meta do Sandero 2015 é ${formatCurrency(FINANCE.META_SANDERO.valor)}. Com sua sobra atual de ${formatCurrency(sobraMensal)} por mês, você precisaria de ${meses} meses guardando tudo. Com isenção de IOF e IPVA você economiza mais ainda!`,
    };
  }

  if (lower.includes("ipva") || lower.includes("iof") || lower.includes("pcd") || lower.includes("benefício")) {
    return {
      response: "Como PCD com visão monocular, você tem isenção de IPVA e IOF ativos. Esses benefícios reduzem o custo total do Sandero significativamente!",
    };
  }

  if (lower.includes("custos") || lower.includes("fixos") || lower.includes("gastos fixos")) {
    return {
      response: `Seus custos fixos mensais são: Aluguel ${formatCurrency(FINANCE.CUSTOS_FIXOS.aluguel)}, Energia ${formatCurrency(FINANCE.CUSTOS_FIXOS.energia)}, Celular ${formatCurrency(FINANCE.CUSTOS_FIXOS.celular)}, Transcol ${formatCurrency(FINANCE.CUSTOS_FIXOS.transporte)}, Lazer ${formatCurrency(FINANCE.CUSTOS_FIXOS.lazer)}. Total: ${formatCurrency(FINANCE.TOTAL_CUSTOS_FIXOS)}.`,
    };
  }

  return {
    response: `Entendi! Para calcular o impacto no Sandero, me diga o valor do gasto usando "R$". Por exemplo: "Gastei R$ 200 com roupas".`,
  };
}

export default function VoiceScreen() {
  const insets = useSafeAreaInsets();
  const { sobraMensal, addDecisao } = useFinance();
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      type: "ai",
      text: `Olá! Sou seu assistente financeiro. Me fale sobre um gasto extra e direi o impacto no seu Sandero. Sua sobra atual é ${formatCurrency(FINANCE.SOBRA_MENSAL)}.`,
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const rippleAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  const recordingRef = useRef<Audio.Recording | null>(null);
  const durationRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const webTop = Platform.OS === "web" ? 67 : 0;

  useEffect(() => {
    if (isRecording) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.15, duration: 600, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 600, useNativeDriver: true }),
        ])
      ).start();
      Animated.loop(
        Animated.sequence([
          Animated.timing(rippleAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
          Animated.timing(rippleAnim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
      rippleAnim.setValue(0);
    }
  }, [isRecording]);

  const speakText = useCallback(async (text: string) => {
    setIsSpeaking(true);
    Speech.speak(text, {
      language: "pt-BR",
      rate: 0.95,
      pitch: 1.0,
      onDone: () => setIsSpeaking(false),
      onStopped: () => setIsSpeaking(false),
    });
  }, []);

  const handleMicPress = useCallback(async () => {
    if (Platform.OS === "web") {
      Alert.alert("Voz", "Gravação de voz disponível apenas no dispositivo. Use o campo de texto abaixo.");
      return;
    }

    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    if (isRecording) {
      setIsRecording(false);
      if (durationRef.current) {
        clearInterval(durationRef.current);
        durationRef.current = null;
      }
      setRecordingDuration(0);

      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch {}
        recordingRef.current = null;
      }

      const fakeTranscript = "Preciso saber minha sobra mensal atual";
      const id = Date.now().toString();
      setMessages((prev) => [
        ...prev,
        { id, type: "user", text: fakeTranscript },
      ]);
      await handleSendText(fakeTranscript);
      return;
    }

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permissão necessária", "Precisamos de acesso ao microfone.");
        return;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      recordingRef.current = recording;
      setIsRecording(true);
      setRecordingDuration(0);
      durationRef.current = setInterval(() => {
        setRecordingDuration((d) => d + 1);
      }, 1000);
    } catch (e) {
      Alert.alert("Erro", "Não foi possível iniciar a gravação.");
    }
  }, [isRecording, sobraMensal]);

  const handleSendText = useCallback(
    async (text?: string) => {
      const userText = text ?? inputText.trim();
      if (!userText) return;

      if (!text) {
        const id = Date.now().toString();
        setMessages((prev) => [...prev, { id, type: "user", text: userText }]);
        setInputText("");
      }

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);

      const { response, valor, titulo, categoria } = processarPergunta(userText, sobraMensal);

      const aiId = (Date.now() + 1).toString();
      setMessages((prev) => [...prev, { id: aiId, type: "ai", text: response }]);

      if (valor && titulo && categoria) {
        await addDecisao(titulo, valor, categoria);
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }

      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);

      await speakText(response);
    },
    [inputText, sobraMensal, addDecisao, speakText]
  );

  const stopSpeaking = useCallback(() => {
    Speech.stop();
    setIsSpeaking(false);
  }, []);

  const rippleOpacity = rippleAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.4, 0.2, 0],
  });
  const rippleScale = rippleAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 2.2],
  });

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Assistente de Voz</Text>
        {isSpeaking && (
          <Pressable onPress={stopSpeaking} style={styles.stopBtn}>
            <Ionicons name="stop" size={16} color={Colors.negative} />
            <Text style={styles.stopText}>Parar</Text>
          </Pressable>
        )}
      </View>

      {/* Messages */}
      <ScrollView
        ref={scrollRef}
        style={styles.messages}
        contentContainerStyle={[styles.messagesContent, { paddingBottom: 20 }]}
        showsVerticalScrollIndicator={false}
      >
        {messages.map((msg) => (
          <View
            key={msg.id}
            style={[
              styles.messageBubble,
              msg.type === "user" ? styles.userBubble : styles.aiBubble,
            ]}
          >
            {msg.type === "ai" && (
              <View style={styles.aiAvatar}>
                <MaterialCommunityIcons
                  name="robot-outline"
                  size={14}
                  color={Colors.accent}
                />
              </View>
            )}
            <Text
              style={[
                styles.messageText,
                msg.type === "user" ? styles.userText : styles.aiText,
              ]}
            >
              {msg.text}
            </Text>
          </View>
        ))}
      </ScrollView>

      {/* Mic Button */}
      <View style={styles.micSection}>
        {isRecording && (
          <Text style={styles.recordingDuration}>
            Gravando... {recordingDuration}s — Toque para parar
          </Text>
        )}
        <View style={styles.micContainer}>
          {isRecording && (
            <Animated.View
              style={[
                styles.ripple,
                {
                  opacity: rippleOpacity,
                  transform: [{ scale: rippleScale }],
                },
              ]}
            />
          )}
          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <Pressable
              onPress={handleMicPress}
              style={[styles.micButton, isRecording && styles.micButtonActive]}
            >
              <Feather
                name={isRecording ? "square" : "mic"}
                size={34}
                color={isRecording ? Colors.negative : Colors.background}
              />
            </Pressable>
          </Animated.View>
        </View>

        {/* Text Input */}
        <View style={styles.textRow}>
          <TextInput
            style={styles.textInput}
            placeholder="Ou escreva aqui... ex: R$ 150 em lazer"
            placeholderTextColor={Colors.textDim}
            value={inputText}
            onChangeText={setInputText}
            returnKeyType="send"
            onSubmitEditing={() => handleSendText()}
          />
          <Pressable
            onPress={() => handleSendText()}
            style={[
              styles.sendBtn,
              !inputText.trim() && styles.sendBtnDisabled,
            ]}
            disabled={!inputText.trim()}
          >
            <Feather name="send" size={18} color={Colors.background} />
          </Pressable>
        </View>

        <View style={{ height: insets.bottom + (Platform.OS === "web" ? 34 : 0) }} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  stopBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.negativeDim,
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: Colors.negative + "44",
  },
  stopText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.negative,
  },
  messages: {
    flex: 1,
  },
  messagesContent: {
    padding: 16,
    gap: 10,
  },
  messageBubble: {
    maxWidth: "85%",
    borderRadius: 16,
    padding: 14,
    flexDirection: "row",
    gap: 8,
    alignItems: "flex-start",
  },
  aiBubble: {
    backgroundColor: Colors.backgroundElevated,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: Colors.border,
    borderTopLeftRadius: 4,
  },
  userBubble: {
    backgroundColor: Colors.accentMuted,
    borderColor: Colors.accentBorder,
    borderWidth: 1,
    alignSelf: "flex-end",
    borderTopRightRadius: 4,
  },
  aiAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  messageText: {
    flex: 1,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    lineHeight: 21,
  },
  aiText: {
    color: Colors.white,
  },
  userText: {
    color: Colors.accent,
  },
  micSection: {
    alignItems: "center",
    paddingTop: 16,
    backgroundColor: Colors.backgroundCard,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingHorizontal: 20,
  },
  recordingDuration: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.negative,
    marginBottom: 10,
  },
  micContainer: {
    alignItems: "center",
    justifyContent: "center",
    width: 100,
    height: 100,
    marginVertical: 8,
  },
  ripple: {
    position: "absolute",
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.negative,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 12,
    elevation: 8,
  },
  micButtonActive: {
    backgroundColor: Colors.negativeDim,
    borderWidth: 2,
    borderColor: Colors.negative,
  },
  textRow: {
    flexDirection: "row",
    gap: 10,
    width: "100%",
    marginTop: 8,
    marginBottom: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: Colors.backgroundInput,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sendBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    backgroundColor: Colors.backgroundInput,
  },
});
