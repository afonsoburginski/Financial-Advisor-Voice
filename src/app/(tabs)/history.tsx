import { useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { useFinanceController } from "@/controllers/useFinanceController";
import Colors from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/layout";
import { formatCurrency, formatDate } from "@/constants/finance";
import type { LedgerEntry, LedgerKind } from "@/models/Ledger";
import { DECISAO_CATEGORIAS } from "@/models/Decisao";

type FilterTab = "all" | "income" | "expense";

function LedgerRow({ item, onDelete, calcDias, sobra }: {
  item: LedgerEntry;
  onDelete: () => void;
  calcDias: (v: number) => number;
  sobra: number;
}) {
  const isExp = item.kind === "expense";
  const dias = isExp ? calcDias(item.amount) : 0;
  const handleDelete = () => {
    Alert.alert(
      "Remover",
      `"${item.title}" — ${isExp ? "−" : "+"} ${formatCurrency(item.amount)}?`,
      [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: () => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onDelete();
          },
        },
      ]
    );
  };

  return (
    <View style={s.row}>
      <View style={s.rowLeft}>
        <View style={[s.rowDot, isExp ? { backgroundColor: Colors.negative } : { backgroundColor: Colors.positive }]} />
        <View style={s.rowBody}>
          <Text style={s.rowTitle} numberOfLines={1}>
            {item.title}
          </Text>
          <View style={s.rowMeta}>
            <Text style={s.metaText}>{item.category ?? (isExp ? "Gasto" : "Receita")}</Text>
            <Text style={s.metaSep}>·</Text>
            <Text style={s.metaText}>{formatDate(item.occurred_at)}</Text>
            {isExp && dias > 0 && sobra > 0 && (
              <>
                <Text style={s.metaSep}>·</Text>
                <Text style={[s.metaText, { color: Colors.negative }]}>~{dias}d sobra</Text>
              </>
            )}
          </View>
        </View>
      </View>
      <View style={s.rowRight}>
        <Text style={[s.rowValue, isExp ? { color: Colors.negative } : { color: Colors.positive }]}>
          {isExp ? "−" : "+"} {formatCurrency(item.amount)}
        </Text>
        <Pressable onPress={handleDelete} hitSlop={8}>
          <Feather name="x" size={14} color={Colors.textFaint} />
        </Pressable>
      </View>
    </View>
  );
}

function AddModal({
  visible,
  onClose,
  onCreateExpense,
  onCreateIncome,
  isCreating,
  sobraMensal,
}: {
  visible: boolean;
  onClose: () => void;
  onCreateExpense: (titulo: string, valor: number, categoria: string) => void;
  onCreateIncome: (titulo: string, valor: number, categoria: string) => void;
  isCreating: boolean;
  sobraMensal: number;
}) {
  const [kind, setKind] = useState<LedgerKind>("expense");
  const [titulo, setTitulo] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState("Outros");
  const insets = useSafeAreaInsets();

  const parsed = parseFloat(valor.replace(",", "."));
  const validValor = !Number.isNaN(parsed) && parsed > 0;
  const calcDias = (v: number) => (sobraMensal > 0 ? Math.round((v / sobraMensal) * 30) : 0);
  const dias = kind === "expense" && validValor ? calcDias(parsed) : 0;
  const novaSobra = kind === "expense" && validValor ? sobraMensal - parsed : sobraMensal;

  const handleCreate = () => {
    if (!titulo.trim()) {
      Alert.alert("Preencha o título");
      return;
    }
    if (!validValor) {
      Alert.alert("Valor inválido");
      return;
    }
    if (kind === "expense") {
      onCreateExpense(titulo.trim(), parsed, categoria);
    } else {
      onCreateIncome(titulo.trim(), parsed, categoria);
    }
    setTitulo("");
    setValor("");
    setCategoria("Outros");
    setKind("expense");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={s.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Novo movimento</Text>

          <View style={s.kindRow}>
            <Pressable
              style={[s.kindChip, kind === "expense" && s.kindChipOn]}
              onPress={() => setKind("expense")}
            >
              <Text style={[s.kindChipText, kind === "expense" && s.kindChipTextOn]}>Gasto</Text>
            </Pressable>
            <Pressable
              style={[s.kindChip, kind === "income" && s.kindChipOn]}
              onPress={() => setKind("income")}
            >
              <Text style={[s.kindChipText, kind === "income" && s.kindChipTextOn]}>Receita</Text>
            </Pressable>
          </View>

          <TextInput
            style={s.textField}
            placeholder="Descrição"
            placeholderTextColor={Colors.textFaint}
            value={titulo}
            onChangeText={setTitulo}
            autoFocus
            returnKeyType="next"
          />
          <View style={s.valorRow}>
            <Text style={s.currencyLabel}>R$</Text>
            <TextInput
              style={[s.textField, { flex: 1 }]}
              placeholder="0,00"
              placeholderTextColor={Colors.textFaint}
              value={valor}
              onChangeText={setValor}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
          </View>

          {kind === "expense" && validValor && (
            <View style={s.impactBox}>
              <Text style={s.impactLine}>
                <Text style={s.impactKey}>Impacto na sobra: </Text>
                <Text style={{ color: Colors.negative }}>~{dias} dias equivalentes</Text>
              </Text>
              <Text style={s.impactLine}>
                <Text style={s.impactKey}>Nova sobra: </Text>
                <Text style={{ color: novaSobra >= 0 ? Colors.positive : Colors.negative }}>
                  {formatCurrency(novaSobra)}
                </Text>
              </Text>
            </View>
          )}

          <Text style={s.fieldLabel}>CATEGORIA</Text>
          <View style={s.chipRow}>
            {DECISAO_CATEGORIAS.map((c) => (
              <Pressable
                key={c}
                onPress={() => setCategoria(c)}
                style={[
                  s.chip,
                  categoria === c && { backgroundColor: Colors.accentSoft, borderColor: Colors.accent },
                ]}
              >
                <Text style={[s.chipText, categoria === c && { color: Colors.accent }]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <View style={s.sheetActions}>
            <Pressable style={s.cancelBtn} onPress={onClose}>
              <Text style={s.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable
              style={[s.createBtn, isCreating && { opacity: 0.6 }]}
              onPress={handleCreate}
              disabled={isCreating}
            >
              <Text style={s.createText}>{isCreating ? "A registar…" : "Registar"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function HistoryScreen() {
  const { filter: filterParam } = useLocalSearchParams<{ filter?: string }>();
  const [tab, setTab] = useState<FilterTab>("all");

  useEffect(() => {
    if (filterParam === "income") setTab("income");
    else if (filterParam === "expense") setTab("expense");
    else setTab("all");
  }, [filterParam]);

  const {
    ledgerMonth,
    isLoading,
    isError,
    refetch,
    sobraMensal,
    totalExtras,
    totalIncomeMonth,
    createDecisao,
    createIncome,
    isCreating,
    deleteDecisao,
    calcularImpactoSandero,
  } = useFinanceController();

  const insets = useSafeAreaInsets();
  const [showAdd, setShowAdd] = useState(false);
  const webTop = Platform.OS === "web" ? 67 : 0;

  const filtered: LedgerEntry[] =
    tab === "all"
      ? ledgerMonth
      : ledgerMonth.filter((x) => x.kind === tab);

  const handleCreateExpense = useCallback(
    (titulo: string, valor: number, categoria: string) => {
      createDecisao({ titulo, valor, categoria });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [createDecisao]
  );

  const handleCreateIncome = useCallback(
    (titulo: string, valor: number, categoria: string) => {
      createIncome({ titulo, valor, categoria });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [createIncome]
  );

  return (
    <View style={[s.container, { paddingTop: insets.top + webTop }]}>
      <View style={s.header}>
        <View>
          <Text style={s.title}>Histórico</Text>
          <Text style={s.subtitle}>{filtered.length} movimento(s) no mês</Text>
        </View>
        <Pressable
          style={s.addBtn}
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            setShowAdd(true);
          }}
        >
          <Feather name="plus" size={18} color={Colors.bg} />
        </Pressable>
      </View>

      <View style={s.tabs}>
        {(["all", "income", "expense"] as const).map((k) => (
          <Pressable
            key={k}
            onPress={() => setTab(k)}
            style={[s.tab, tab === k && s.tabOn]}
          >
            <Text style={[s.tabText, tab === k && s.tabTextOn]}>
              {k === "all" ? "Tudo" : k === "income" ? "Entradas" : "Saídas"}
            </Text>
          </Pressable>
        ))}
      </View>

      {ledgerMonth.length > 0 && (
        <View style={s.summary}>
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Receitas</Text>
            <Text style={[s.summaryValue, { color: Colors.positive }]}>{formatCurrency(totalIncomeMonth)}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Gastos</Text>
            <Text style={[s.summaryValue, { color: Colors.negative }]}>{formatCurrency(totalExtras)}</Text>
          </View>
          <View style={s.summaryDivider} />
          <View style={s.summaryItem}>
            <Text style={s.summaryLabel}>Sobra est.</Text>
            <Text style={[s.summaryValue, { color: sobraMensal >= 0 ? Colors.positive : Colors.negative }]}>
              {formatCurrency(sobraMensal)}
            </Text>
          </View>
        </View>
      )}

      {isError && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>Erro ao carregar. Puxe para tentar novamente.</Text>
        </View>
      )}

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + TAB_BAR_HEIGHT + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.accent} />}
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="inbox" size={36} color={Colors.textFaint} />
            <Text style={s.emptyText}>Nada neste filtro</Text>
            <Text style={s.emptySub}>Importa extrato no Painel ou regista aqui</Text>
          </View>
        }
        renderItem={({ item }) => (
          <LedgerRow
            item={item}
            onDelete={() => deleteDecisao(item.id)}
            calcDias={calcularImpactoSandero}
            sobra={sobraMensal}
          />
        )}
      />

      <AddModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreateExpense={handleCreateExpense}
        onCreateIncome={handleCreateIncome}
        isCreating={isCreating}
        sobraMensal={sobraMensal}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 2 },
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  tabs: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 24,
    marginBottom: 12,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.lineStrong,
    backgroundColor: Colors.overlay,
  },
  tabOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  tabText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSub },
  tabTextOn: { color: Colors.accent, fontFamily: "Inter_600SemiBold" },

  summary: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginBottom: 16,
    backgroundColor: Colors.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.lineMedium,
    paddingVertical: 14,
  },
  summaryItem: { flex: 1, alignItems: "center", gap: 4 },
  summaryDivider: { width: 1, backgroundColor: Colors.line },
  summaryLabel: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  summaryValue: { fontSize: 15, fontFamily: "Inter_700Bold" },

  errorBanner: {
    backgroundColor: Colors.negativeSoft,
    marginHorizontal: 24,
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.negative, textAlign: "center" },

  listContent: { paddingHorizontal: 24, paddingTop: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowDot: { width: 6, height: 6, borderRadius: 3, flexShrink: 0 },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  metaSep: { fontSize: 11, color: Colors.textFaint },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowValue: { fontSize: 13, fontFamily: "Inter_600SemiBold" },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 80 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.textSub },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted },

  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    gap: 14,
    borderTopWidth: 1,
    borderColor: Colors.lineStrong,
  },
  sheetHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.lineStrong,
    alignSelf: "center",
    marginBottom: 4,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 4 },
  kindRow: { flexDirection: "row", gap: 10 },
  kindChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.lineStrong,
    backgroundColor: Colors.overlay,
  },
  kindChipOn: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  kindChipText: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.textSub },
  kindChipTextOn: { color: Colors.accent, fontFamily: "Inter_600SemiBold" },
  textField: {
    backgroundColor: Colors.overlay,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.lineMedium,
  },
  valorRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  currencyLabel: { fontSize: 18, fontFamily: "Inter_600SemiBold", color: Colors.textSub, width: 28 },
  impactBox: {
    backgroundColor: Colors.negativeSoft,
    borderRadius: 10,
    padding: 12,
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.negative + "33",
  },
  impactLine: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSub },
  impactKey: { fontFamily: "Inter_500Medium", color: Colors.textMuted },
  fieldLabel: { fontSize: 9, fontFamily: "Inter_600SemiBold", color: Colors.textMuted, letterSpacing: 2 },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.lineStrong,
    backgroundColor: Colors.overlay,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSub },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.lineStrong,
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSub },
  createBtn: {
    flex: 2,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    backgroundColor: Colors.accent,
  },
  createText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.bg },
});
