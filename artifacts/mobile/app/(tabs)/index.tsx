import React, { useRef } from "react";
import {
  Animated,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";
import Colors from "@/constants/colors";
import { useFinance } from "@/context/FinanceContext";
import {
  FINANCE,
  calcularImpactoSandero,
  formatCurrency,
  isAbril,
} from "@/constants/finance";

function ProgressBar({ progress }: { progress: number }) {
  const animVal = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    Animated.timing(animVal, {
      toValue: Math.min(progress, 1),
      duration: 1200,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  const width = animVal.interpolate({
    inputRange: [0, 1],
    outputRange: ["0%", "100%"],
  });

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, { width }]} />
    </View>
  );
}

function CustoCard({
  icon,
  label,
  valor,
}: {
  icon: string;
  label: string;
  valor: number;
}) {
  return (
    <View style={styles.custoCard}>
      <MaterialCommunityIcons name={icon as any} size={18} color={Colors.accentDim} />
      <Text style={styles.custoLabel}>{label}</Text>
      <Text style={styles.custoValor}>{formatCurrency(valor)}</Text>
    </View>
  );
}

export default function DashboardScreen() {
  const insets = useSafeAreaInsets();
  const { decisoes, sobraMensal, isLoading, refetch } = useFinance();

  const progressSandero = Math.min(
    (sobraMensal / FINANCE.META_SANDERO.valor) * 1,
    1
  );

  const mesesParaSandero =
    sobraMensal > 0
      ? Math.ceil(FINANCE.META_SANDERO.valor / sobraMensal)
      : 0;

  const showAbrilTip = isAbril();
  const ultimosGastos = decisoes.slice(0, 3);

  const webTop = Platform.OS === "web" ? 67 : 0;

  return (
    <ScrollView
      style={[styles.container, { paddingTop: insets.top + webTop }]}
      contentContainerStyle={[
        styles.content,
        { paddingBottom: insets.bottom + 100 },
      ]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={isLoading}
          onRefresh={refetch}
          tintColor={Colors.accent}
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Boa tarde</Text>
          <Text style={styles.profileBadge}>PCD • Visão Monocular</Text>
        </View>
        <View style={styles.beneficiosBadge}>
          <Ionicons name="shield-checkmark" size={14} color={Colors.accent} />
          <Text style={styles.beneficiosText}>IPVA + IOF isento</Text>
        </View>
      </View>

      {/* Sobra Mensal Main Card */}
      <View style={styles.mainCard}>
        <View style={styles.mainCardHeader}>
          <Text style={styles.mainCardLabel}>Sobra Mensal Estimada</Text>
          <MaterialCommunityIcons
            name="trending-up"
            size={20}
            color={Colors.positive}
          />
        </View>
        <Text style={styles.mainCardValue}>{formatCurrency(sobraMensal)}</Text>
        <View style={styles.mainCardFooter}>
          <View style={styles.mainCardRow}>
            <Text style={styles.mainCardSubText}>
              Salário líquido: {formatCurrency(FINANCE.SALARIO_LIQUIDO)}
            </Text>
          </View>
          <View style={styles.mainCardRow}>
            <Ionicons name="restaurant-outline" size={12} color={Colors.accent} />
            <Text style={[styles.mainCardSubText, { marginLeft: 4 }]}>
              VA: {formatCurrency(FINANCE.VALE_ALIMENTACAO_MES)}
            </Text>
          </View>
        </View>
      </View>

      {/* Sandero Progress */}
      <View style={styles.sanderoCard}>
        <View style={styles.sanderoHeader}>
          <MaterialCommunityIcons name="car-sports" size={22} color={Colors.accent} />
          <View style={styles.sanderoTitleGroup}>
            <Text style={styles.sanderoTitle}>Meta: Sandero 2015</Text>
            <Text style={styles.sanderoSubtitle}>À vista • Isenção IOF ativa</Text>
          </View>
          <Text style={styles.sanderoMeta}>{formatCurrency(FINANCE.META_SANDERO.valor)}</Text>
        </View>

        <ProgressBar progress={progressSandero} />

        <View style={styles.sanderoFooter}>
          <Text style={styles.sanderoPercent}>
            {(progressSandero * 100).toFixed(1)}% da meta
          </Text>
          {mesesParaSandero > 0 && (
            <Text style={styles.sanderoMeses}>
              ~{mesesParaSandero} meses guardando tudo
            </Text>
          )}
        </View>
      </View>

      {/* Abril Tip */}
      {showAbrilTip && (
        <View style={styles.tipCard}>
          <View style={styles.tipIcon}>
            <Ionicons name="bulb-outline" size={20} color={Colors.warning} />
          </View>
          <View style={styles.tipContent}>
            <Text style={styles.tipTitle}>Sugestão de Abril</Text>
            <Text style={styles.tipText}>
              Pague R$ 1.750,00 em dívidas para limpar seu nome e melhorar seu
              score para o financiamento.
            </Text>
          </View>
        </View>
      )}

      {/* Renda Breakdown */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Composição da Renda</Text>
        <View style={styles.rendaRow}>
          <View style={styles.rendaItem}>
            <Text style={styles.rendaLabel}>Salário Bruto</Text>
            <Text style={styles.rendaValor}>{formatCurrency(FINANCE.SALARIO_BRUTO)}</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.rendaItem}>
            <Text style={styles.rendaLabel}>Salário Líquido</Text>
            <Text style={[styles.rendaValor, { color: Colors.positive }]}>
              {formatCurrency(FINANCE.SALARIO_LIQUIDO)}
            </Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.rendaItem}>
            <Text style={styles.rendaLabel}>Vale Alimentação</Text>
            <Text style={[styles.rendaValor, { color: Colors.accent }]}>
              {formatCurrency(FINANCE.VALE_ALIMENTACAO_MES)}
            </Text>
          </View>
        </View>
      </View>

      {/* Custos Fixos */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Custos Fixos (Serra/ES)</Text>
        <View style={styles.custosGrid}>
          <CustoCard icon="home-outline" label="Aluguel" valor={FINANCE.CUSTOS_FIXOS.aluguel} />
          <CustoCard icon="flash-outline" label="Energia" valor={FINANCE.CUSTOS_FIXOS.energia} />
          <CustoCard icon="cellphone" label="Celular" valor={FINANCE.CUSTOS_FIXOS.celular} />
          <CustoCard icon="bus" label="Transcol" valor={FINANCE.CUSTOS_FIXOS.transporte} />
          <CustoCard icon="movie-outline" label="Lazer" valor={FINANCE.CUSTOS_FIXOS.lazer} />
          <View style={[styles.custoCard, { backgroundColor: Colors.negativeDim, borderColor: Colors.negative + "33" }]}>
            <MaterialCommunityIcons name="calculator" size={18} color={Colors.negative} />
            <Text style={styles.custoLabel}>Total</Text>
            <Text style={[styles.custoValor, { color: Colors.negative }]}>
              {formatCurrency(FINANCE.TOTAL_CUSTOS_FIXOS)}
            </Text>
          </View>
        </View>
      </View>

      {/* Últimos Gastos Extras */}
      {ultimosGastos.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Últimos Gastos Extras</Text>
          {ultimosGastos.map((d) => {
            const diasAtraso = calcularImpactoSandero(d.valor);
            return (
              <View key={d.id} style={styles.gastoItem}>
                <View>
                  <Text style={styles.gastoTitulo}>{d.titulo}</Text>
                  <Text style={styles.gastoCategoria}>{d.categoria}</Text>
                </View>
                <View style={{ alignItems: "flex-end" }}>
                  <Text style={styles.gastoValor}>
                    -{formatCurrency(d.valor)}
                  </Text>
                  <Text style={styles.gastoAtraso}>
                    +{diasAtraso}d no Sandero
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: 20,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  greeting: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  profileBadge: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  beneficiosBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: Colors.accentMuted,
    borderColor: Colors.accentBorder,
    borderWidth: 1,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  beneficiosText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  mainCard: {
    backgroundColor: Colors.backgroundElevated,
    borderRadius: 20,
    padding: 22,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  mainCardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  mainCardLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  mainCardValue: {
    fontSize: 40,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
    marginBottom: 14,
    letterSpacing: -1,
  },
  mainCardFooter: {
    gap: 4,
  },
  mainCardRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  mainCardSubText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  sanderoCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1,
    borderColor: Colors.accentBorder,
  },
  sanderoHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  sanderoTitleGroup: {
    flex: 1,
  },
  sanderoTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  sanderoSubtitle: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 1,
  },
  sanderoMeta: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.accent,
  },
  progressTrack: {
    height: 10,
    backgroundColor: Colors.backgroundInput,
    borderRadius: 6,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    backgroundColor: Colors.accent,
    borderRadius: 6,
  },
  sanderoFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 10,
  },
  sanderoPercent: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accent,
  },
  sanderoMeses: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  tipCard: {
    backgroundColor: Colors.warningDim,
    borderRadius: 16,
    padding: 16,
    flexDirection: "row",
    gap: 12,
    borderWidth: 1,
    borderColor: Colors.warning + "33",
  },
  tipIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: Colors.warning + "22",
    alignItems: "center",
    justifyContent: "center",
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.warning,
    marginBottom: 4,
  },
  tipText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    lineHeight: 19,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  rendaRow: {
    flexDirection: "row",
    backgroundColor: Colors.backgroundCard,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  rendaItem: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  divider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  rendaLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textAlign: "center",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  rendaValor: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
    textAlign: "center",
  },
  custosGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  custoCard: {
    flex: 1,
    minWidth: "30%",
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: "center",
  },
  custoLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    textAlign: "center",
  },
  custoValor: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.text,
    textAlign: "center",
  },
  gastoItem: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 12,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  gastoTitulo: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  gastoCategoria: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
  gastoValor: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.negative,
  },
  gastoAtraso: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 2,
  },
});
