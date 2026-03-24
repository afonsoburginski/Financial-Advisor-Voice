import React, { useRef, useEffect } from "react";
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
import Colors from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/layout";
import { useFinanceViewModel } from "@/viewmodels/useFinanceViewModel";
import { useAgendaViewModel } from "@/viewmodels/useAgendaViewModel";
import { useUserViewModel } from "@/viewmodels/useUserViewModel";
import { FINANCE, formatCurrency } from "@/constants/finance";

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressLine({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: Math.min(Math.max(value, 0), 1),
      useNativeDriver: false,
      tension: 40,
      friction: 10,
    }).start();
  }, [value]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View style={s.track}>
      <Animated.View style={[s.fill, { width }]} />
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function DataRow({
  label, value, valueColor, sub,
}: {
  label: string; value: string; valueColor?: string; sub?: string;
}) {
  return (
    <View style={s.dataRow}>
      <View style={{ flex: 1 }}>
        <Text style={s.dataLabel}>{label}</Text>
        {sub ? <Text style={s.dataSub}>{sub}</Text> : null}
      </View>
      <Text style={[s.dataValue, valueColor ? { color: valueColor } : null]}>{value}</Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { sobraMensal, progressSandero, mesesParaSandero, decisoes, isLoading, refetch } =
    useFinanceViewModel();
  const { pending } = useAgendaViewModel();
  const { greeting } = useUserViewModel();

  const totalExtras = decisoes.reduce((s, d) => s + Number(d.valor), 0);
  const topPad = insets.top + (Platform.OS === "web" ? 67 : 0);
  const bottomPad = insets.bottom + TAB_BAR_HEIGHT + 24;

  return (
    <ScrollView
      style={[s.container, { paddingTop: topPad }]}
      contentContainerStyle={[s.content, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.accent} />
      }
    >
      {/* Greeting */}
      <View style={s.greetWrap}>
        <Text style={s.greetText}>{greeting()}</Text>
        <Text style={s.greetSub}>Aqui está sua visão financeira.</Text>
      </View>

      {/* Hero — Sobra mensal */}
      <View style={s.heroCard}>
        <Text style={s.heroLabel}>SOBRA MENSAL</Text>
        <Text style={[s.heroValue, sobraMensal < 0 && { color: Colors.negative }]}>
          {formatCurrency(sobraMensal)}
        </Text>
        <Text style={s.heroSub}>
          Líquido {formatCurrency(FINANCE.SALARIO_LIQUIDO)} + VA{" "}
          {formatCurrency(FINANCE.VALE_ALIMENTACAO_MES)}
        </Text>
      </View>

      {/* KPI row */}
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>EXTRAS</Text>
          <Text style={[s.kpiValue, { color: totalExtras > 0 ? Colors.negative : Colors.textMuted }]}>
            {formatCurrency(totalExtras)}
          </Text>
        </View>
        <View style={s.kpiDivider} />
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>FIXOS</Text>
          <Text style={[s.kpiValue, { color: Colors.textSub }]}>
            {formatCurrency(FINANCE.TOTAL_CUSTOS_FIXOS)}
          </Text>
        </View>
        <View style={s.kpiDivider} />
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>TAREFAS</Text>
          <Text style={[s.kpiValue, { color: pending.length > 0 ? Colors.accent : Colors.textMuted }]}>
            {pending.length}
          </Text>
          <Text style={s.kpiNote}>pendentes</Text>
        </View>
      </View>

      <View style={s.divider} />

      {/* Meta */}
      <View style={s.goalSection}>
        <View style={s.goalTop}>
          <View>
            <Text style={s.goalTitle}>{FINANCE.META_SANDERO.nome}</Text>
            <Text style={s.goalSub}>
              {mesesParaSandero > 0
                ? `~${mesesParaSandero} meses guardando a sobra`
                : "Meta atingível!"}
            </Text>
          </View>
          <Text style={s.goalAmount}>{formatCurrency(FINANCE.META_SANDERO.valor)}</Text>
        </View>
        <ProgressLine value={progressSandero} />
        <Text style={s.goalPct}>{(progressSandero * 100).toFixed(1)}% da meta</Text>
      </View>

      <View style={s.divider} />

      {/* Renda */}
      <SectionHeader title="RENDA" />
      <DataRow label="Salário bruto" value={formatCurrency(FINANCE.SALARIO_BRUTO)} />
      <DataRow
        label="Salário líquido"
        value={formatCurrency(FINANCE.SALARIO_LIQUIDO)}
        valueColor={Colors.positive}
        sub="1 dependente"
      />
      <DataRow
        label="Vale alimentação"
        value={formatCurrency(FINANCE.VALE_ALIMENTACAO_MES)}
        valueColor={Colors.money}
        sub={`R$ ${FINANCE.VALE_ALIMENTACAO_DIA}/dia útil`}
      />

      <View style={s.divider} />

      {/* Custos fixos */}
      <SectionHeader title="CUSTOS FIXOS" />
      <DataRow label="Aluguel / Condomínio" value={formatCurrency(FINANCE.CUSTOS_FIXOS.aluguel)} />
      <DataRow label="Energia" value={formatCurrency(FINANCE.CUSTOS_FIXOS.energia)} />
      <DataRow label="Celular" value={formatCurrency(FINANCE.CUSTOS_FIXOS.celular)} />
      <DataRow label="Transcol" value={formatCurrency(FINANCE.CUSTOS_FIXOS.transporte)} />
      <DataRow label="Lazer" value={formatCurrency(FINANCE.CUSTOS_FIXOS.lazer)} />
      <View style={s.subtotalRow}>
        <Text style={s.subtotalLabel}>Total</Text>
        <Text style={[s.subtotalValue, { color: Colors.negative }]}>
          {formatCurrency(FINANCE.TOTAL_CUSTOS_FIXOS)}
        </Text>
      </View>
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, gap: 16 },

  greetWrap: { marginBottom: 4 },
  greetText: {
    fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5,
  },
  greetSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 3 },

  heroCard: {
    backgroundColor: Colors.surface, borderRadius: 16, padding: 20, gap: 6,
    borderWidth: 1, borderColor: Colors.lineMedium,
  },
  heroLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.textMuted, letterSpacing: 2,
  },
  heroValue: {
    fontSize: 44, fontFamily: "Inter_700Bold", color: Colors.money,
    letterSpacing: -1.5, lineHeight: 50,
  },
  heroSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSub },

  kpiRow: {
    flexDirection: "row", backgroundColor: Colors.surface,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.lineMedium, paddingVertical: 14,
  },
  kpiCard: { flex: 1, alignItems: "center", gap: 4 },
  kpiDivider: { width: 1, backgroundColor: Colors.line },
  kpiLabel: {
    fontSize: 9, fontFamily: "Inter_500Medium", color: Colors.textMuted,
    letterSpacing: 1.2, textTransform: "uppercase",
  },
  kpiValue: { fontSize: 15, fontFamily: "Inter_700Bold", color: Colors.text },
  kpiNote: { fontSize: 9, fontFamily: "Inter_400Regular", color: Colors.textMuted },

  divider: { height: 1, backgroundColor: Colors.line },

  goalSection: { gap: 10 },
  goalTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  goalTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  goalSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSub, marginTop: 3 },
  goalAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textMuted },
  track: { height: 3, backgroundColor: Colors.line, borderRadius: 2, overflow: "hidden" },
  fill: { height: 3, backgroundColor: Colors.money, borderRadius: 2 },
  goalPct: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.money },

  sectionHeader: {
    fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.textMuted,
    letterSpacing: 2, marginTop: 4, marginBottom: 4,
  },
  dataRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: Colors.line,
  },
  dataLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  dataSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  dataValue: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSub },

  subtotalRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingTop: 12, marginTop: 2,
  },
  subtotalLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSub },
  subtotalValue: { fontSize: 14, fontFamily: "Inter_700Bold" },
});
