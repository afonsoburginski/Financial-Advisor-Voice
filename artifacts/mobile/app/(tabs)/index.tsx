import React, { useEffect, useRef } from "react";
import {
  Animated,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons, Feather } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFinance } from "@/context/FinanceContext";
import {
  FINANCE,
  calcularImpactoSandero,
  formatCurrency,
  isAbril,
} from "@/constants/finance";

function ThinProgress({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, {
      toValue: Math.min(value, 1),
      duration: 1400,
      useNativeDriver: false,
    }).start();
  }, [value]);
  const w = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View style={styles.thinTrack}>
      <Animated.View style={[styles.thinFill, { width: w }]} />
    </View>
  );
}

function StatRow({
  label,
  value,
  valueColor,
  sublabel,
}: {
  label: string;
  value: string;
  valueColor?: string;
  sublabel?: string;
}) {
  return (
    <View style={styles.statRow}>
      <View>
        <Text style={styles.statLabel}>{label}</Text>
        {sublabel ? <Text style={styles.statSublabel}>{sublabel}</Text> : null}
      </View>
      <Text style={[styles.statValue, valueColor ? { color: valueColor } : null]}>
        {value}
      </Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { decisoes, sobraMensal, isLoading, refetch } = useFinance();

  const progressSandero = FINANCE.META_SANDERO.valor > 0
    ? Math.min(sobraMensal / FINANCE.META_SANDERO.valor, 1)
    : 0;
  const mesesParaSandero = sobraMensal > 0
    ? Math.ceil(FINANCE.META_SANDERO.valor / sobraMensal)
    : 0;
  const totalExtras = decisoes.reduce((a, d) => a + d.valor, 0);
  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + webTop }]}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.accent} />
      }
    >
      {/* Top label */}
      <View style={styles.topRow}>
        <Text style={styles.topLabel}>FINANÇAS</Text>
        <View style={styles.pcdChip}>
          <Ionicons name="shield-checkmark-outline" size={11} color={Colors.accent} />
          <Text style={styles.pcdChipText}>PCD • IOF + IPVA isentos</Text>
        </View>
      </View>

      {/* Hero number */}
      <View style={styles.heroBlock}>
        <Text style={styles.heroSub}>SOBRA MENSAL</Text>
        <Text style={styles.heroValue}>{formatCurrency(sobraMensal)}</Text>
        <Text style={styles.heroNote}>
          Líquido {formatCurrency(FINANCE.SALARIO_LIQUIDO)} + VA {formatCurrency(FINANCE.VALE_ALIMENTACAO_MES)}
        </Text>
      </View>

      <View style={styles.divider} />

      {/* Sandero goal */}
      <View style={styles.goalBlock}>
        <View style={styles.goalHeader}>
          <View>
            <Text style={styles.goalTitle}>Sandero 2015 — à vista</Text>
            <Text style={styles.goalSub}>
              {mesesParaSandero > 0 ? `~${mesesParaSandero} meses guardando tudo` : "Meta atingida!"}
            </Text>
          </View>
          <Text style={styles.goalTarget}>{formatCurrency(FINANCE.META_SANDERO.valor)}</Text>
        </View>
        <ThinProgress value={progressSandero} />
        <Text style={styles.goalPct}>{(progressSandero * 100).toFixed(1)}%</Text>
      </View>

      <View style={styles.divider} />

      {/* Income */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>RENDA</Text>
        <StatRow label="Salário bruto" value={formatCurrency(FINANCE.SALARIO_BRUTO)} />
        <StatRow label="Salário líquido" value={formatCurrency(FINANCE.SALARIO_LIQUIDO)} valueColor={Colors.positive} sublabel="1 dependente" />
        <StatRow label="Vale alimentação" value={formatCurrency(FINANCE.VALE_ALIMENTACAO_MES)} valueColor={Colors.accent} sublabel={`R$ ${FINANCE.VALE_ALIMENTACAO_DIA}/dia útil`} />
      </View>

      <View style={styles.divider} />

      {/* Fixed costs */}
      <View style={styles.section}>
        <Text style={styles.sectionLabel}>CUSTOS FIXOS — SERRA/ES</Text>
        <StatRow label="Aluguel / Condomínio" value={formatCurrency(FINANCE.CUSTOS_FIXOS.aluguel)} />
        <StatRow label="Energia" value={formatCurrency(FINANCE.CUSTOS_FIXOS.energia)} />
        <StatRow label="Celular" value={formatCurrency(FINANCE.CUSTOS_FIXOS.celular)} />
        <StatRow label="Transcol" value={formatCurrency(FINANCE.CUSTOS_FIXOS.transporte)} />
        <StatRow label="Lazer" value={formatCurrency(FINANCE.CUSTOS_FIXOS.lazer)} />
        <View style={styles.subtotalRow}>
          <Text style={styles.subtotalLabel}>Subtotal fixo</Text>
          <Text style={styles.subtotalValue}>{formatCurrency(FINANCE.TOTAL_CUSTOS_FIXOS)}</Text>
        </View>
      </View>

      {totalExtras > 0 && (
        <>
          <View style={styles.divider} />
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>GASTOS EXTRAS</Text>
            {decisoes.slice(0, 5).map((d) => (
              <StatRow
                key={d.id}
                label={d.titulo}
                value={`-${formatCurrency(d.valor)}`}
                valueColor={Colors.negative}
                sublabel={`${d.categoria} · +${calcularImpactoSandero(d.valor)}d no Sandero`}
              />
            ))}
          </View>
        </>
      )}

      {isAbril() && (
        <>
          <View style={styles.divider} />
          <View style={styles.tipsBlock}>
            <View style={styles.tipDot} />
            <View style={{ flex: 1 }}>
              <Text style={styles.tipTitle}>Sugestão para Abril</Text>
              <Text style={styles.tipText}>
                Pague R$ 1.750,00 em dívidas para limpar o nome e melhorar o score.
              </Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 24, paddingTop: 16, gap: 0 },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 32,
  },
  topLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  pcdChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: Colors.accentSoft,
    borderRadius: 100,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
  },
  pcdChipText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
  },

  heroBlock: { marginBottom: 28 },
  heroSub: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: 8,
  },
  heroValue: {
    fontSize: 48,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
    letterSpacing: -2,
    lineHeight: 52,
  },
  heroNote: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSub,
    marginTop: 6,
  },

  divider: {
    height: 1,
    backgroundColor: Colors.line,
    marginVertical: 24,
  },

  goalBlock: { marginBottom: 4 },
  goalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 14,
  },
  goalTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.text,
    marginBottom: 3,
  },
  goalSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textSub,
  },
  goalTarget: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.textSub,
  },
  thinTrack: {
    height: 2,
    backgroundColor: Colors.line,
    borderRadius: 1,
    overflow: "hidden",
  },
  thinFill: {
    height: 2,
    backgroundColor: Colors.accent,
    borderRadius: 1,
  },
  goalPct: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.accent,
    marginTop: 7,
  },

  section: { gap: 18 },
  sectionLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 2,
    marginBottom: 4,
  },
  statRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statLabel: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
  },
  statSublabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  statValue: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.textSub,
  },
  subtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: Colors.line,
  },
  subtotalLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textSub,
  },
  subtotalValue: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.negative,
  },

  tipsBlock: {
    flexDirection: "row",
    gap: 14,
    alignItems: "flex-start",
    marginBottom: 4,
  },
  tipDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.warning,
    marginTop: 5,
  },
  tipTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.warning,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSub,
    lineHeight: 19,
  },
});
