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
import { Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFinanceViewModel } from "@/viewmodels/useFinanceViewModel";
import { useAgendaViewModel } from "@/viewmodels/useAgendaViewModel";
import { FINANCE, formatCurrency, isAbril } from "@/constants/finance";

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

function KpiCard({ label, value, color, note }: { label: string; value: string; color?: string; note?: string }) {
  return (
    <View style={s.kpiCard}>
      <Text style={s.kpiLabel}>{label}</Text>
      <Text style={[s.kpiValue, color ? { color } : null]}>{value}</Text>
      {note ? <Text style={s.kpiNote}>{note}</Text> : null}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={s.sectionHeader}>{title}</Text>;
}

function DataRow({ label, value, valueColor, sub }: { label: string; value: string; valueColor?: string; sub?: string }) {
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
  const webTop = Platform.OS === "web" ? 67 : 0;

  const totalExtras = decisoes.reduce((s, d) => s + Number(d.valor), 0);

  return (
    <ScrollView
      style={[s.container, { paddingTop: insets.top + webTop }]}
      contentContainerStyle={[s.content, { paddingBottom: insets.bottom + 100 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refetch}
          tintColor={Colors.accent}
        />
      }
    >
      {/* Brand header */}
      <View style={s.brandRow}>
        <View>
          <Text style={s.brandName}>Tommy</Text>
          <Text style={s.brandSub}>seu advisor pessoal</Text>
        </View>
        <View style={s.pcdBadge}>
          <Ionicons name="shield-checkmark-outline" size={12} color={Colors.accent} />
          <Text style={s.pcdText}>PCD • IOF + IPVA isentos</Text>
        </View>
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
        <KpiCard
          label="Extras"
          value={formatCurrency(totalExtras)}
          color={totalExtras > 0 ? Colors.negative : Colors.textMuted}
        />
        <View style={s.kpiDivider} />
        <KpiCard
          label="Gastos fixos"
          value={formatCurrency(FINANCE.TOTAL_CUSTOS_FIXOS)}
          color={Colors.textSub}
        />
        <View style={s.kpiDivider} />
        <KpiCard
          label="Tarefas"
          value={String(pending.length)}
          color={pending.length > 0 ? Colors.accent : Colors.textMuted}
          note="pendentes"
        />
      </View>

      <View style={s.divider} />

      {/* Sandero goal */}
      <View style={s.goalSection}>
        <View style={s.goalTop}>
          <View>
            <Text style={s.goalTitle}>Sandero 2015 — à vista</Text>
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
      <SectionHeader title="CUSTOS FIXOS — SERRA/ES" />
      <DataRow label="Aluguel / Condomínio" value={formatCurrency(FINANCE.CUSTOS_FIXOS.aluguel)} />
      <DataRow label="Energia" value={formatCurrency(FINANCE.CUSTOS_FIXOS.energia)} />
      <DataRow label="Celular" value={formatCurrency(FINANCE.CUSTOS_FIXOS.celular)} />
      <DataRow label="Transcol" value={formatCurrency(FINANCE.CUSTOS_FIXOS.transporte)} />
      <DataRow label="Lazer" value={formatCurrency(FINANCE.CUSTOS_FIXOS.lazer)} />
      <View style={s.subtotalRow}>
        <Text style={s.subtotalLabel}>Total fixo</Text>
        <Text style={s.subtotalValue}>{formatCurrency(FINANCE.TOTAL_CUSTOS_FIXOS)}</Text>
      </View>

      {isAbril() && (
        <>
          <View style={s.divider} />
          <View style={s.tipRow}>
            <View style={[s.tipDot, { backgroundColor: Colors.money }]} />
            <View style={{ flex: 1 }}>
              <Text style={[s.tipTitle, { color: Colors.money }]}>Sugestão — Abril</Text>
              <Text style={s.tipText}>
                Pague R$ 1.750,00 em dívidas para limpar o nome e melhorar seu score de crédito.
              </Text>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  content: { padding: 24, gap: 16 },

  brandRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  brandName: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5 },
  brandSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },

  pcdBadge: {
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
  pcdText: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.accent },

  heroCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.lineMedium,
  },
  heroLabel: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  heroValue: {
    fontSize: 44,
    fontFamily: "Inter_700Bold",
    color: Colors.money,
    letterSpacing: -1.5,
    lineHeight: 50,
  },
  heroSub: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textSub },

  kpiRow: {
    flexDirection: "row",
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.lineMedium,
    paddingVertical: 14,
  },
  kpiCard: { flex: 1, alignItems: "center", gap: 4 },
  kpiDivider: { width: 1, backgroundColor: Colors.line },
  kpiLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
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
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 2,
    marginTop: 4,
    marginBottom: 4,
  },

  dataRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 11,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  dataLabel: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  dataSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  dataValue: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSub },

  subtotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: 12,
    marginTop: 2,
  },
  subtotalLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSub },
  subtotalValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.negative },

  tipRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  tipDot: { width: 6, height: 6, borderRadius: 3, marginTop: 4 },
  tipTitle: { fontSize: 12, fontFamily: "Inter_600SemiBold", marginBottom: 4 },
  tipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSub,
    lineHeight: 19,
  },
});
