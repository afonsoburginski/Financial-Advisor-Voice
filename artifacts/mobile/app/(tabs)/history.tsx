import React, { useCallback, useState } from "react";
import {
  Alert,
  FlatList,
  Platform,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  Modal,
  ScrollView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useFinance, type Decisao } from "@/context/FinanceContext";
import { FINANCE, calcularImpactoSandero, formatCurrency, formatDate } from "@/constants/finance";

const CATEGORIAS = FINANCE.CATEGORIAS;

function Row({ item, onDelete }: { item: Decisao; onDelete: (id: number) => void }) {
  const dias = calcularImpactoSandero(item.valor);
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTitle}>{item.titulo}</Text>
        <Text style={styles.rowMeta}>
          {item.categoria} · {formatDate(item.data)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowValue}>-{formatCurrency(item.valor)}</Text>
        <Text style={styles.rowImpact}>+{dias}d</Text>
      </View>
      <Pressable
        onPress={() => onDelete(item.id)}
        style={({ pressed }) => [styles.deleteBtn, { opacity: pressed ? 0.4 : 0.6 }]}
        hitSlop={12}
      >
        <Feather name="x" size={14} color={Colors.textMuted} />
      </Pressable>
    </View>
  );
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { decisoes, sobraMensal, isLoading, addDecisao, removeDecisao, refetch } = useFinance();
  const [showModal, setShowModal] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [isSaving, setIsSaving] = useState(false);

  const webTop = Platform.OS === "web" ? 67 : 0;

  const totalExtras = decisoes.reduce((a, d) => a + d.valor, 0);
  const totalDias = decisoes.reduce((a, d) => a + calcularImpactoSandero(d.valor), 0);

  const handleDelete = useCallback(
    (id: number) => {
      Alert.alert("Remover", "Remover este registro?", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            await removeDecisao(id);
          },
        },
      ]);
    },
    [removeDecisao]
  );

  const handleSave = useCallback(async () => {
    if (!titulo.trim() || !valor) return;
    const v = parseFloat(valor.replace(",", "."));
    if (isNaN(v) || v <= 0) return;
    setIsSaving(true);
    try {
      await addDecisao(titulo.trim(), v, categoria);
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setTitulo("");
      setValor("");
      setCategoria(CATEGORIAS[0]);
      setShowModal(false);
    } finally {
      setIsSaving(false);
    }
  }, [titulo, valor, categoria, addDecisao]);

  const previewVal = parseFloat(valor.replace(",", "."));
  const previewDias = !isNaN(previewVal) && previewVal > 0 ? calcularImpactoSandero(previewVal) : null;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerLabel}>HISTÓRICO</Text>
        <Pressable
          onPress={() => setShowModal(true)}
          style={({ pressed }) => [styles.addBtn, { opacity: pressed ? 0.7 : 1 }]}
        >
          <Feather name="plus" size={16} color={Colors.bg} />
        </Pressable>
      </View>

      {/* Summary strip */}
      {decisoes.length > 0 && (
        <View style={styles.summaryStrip}>
          <View style={styles.sumItem}>
            <Text style={styles.sumVal}>{formatCurrency(totalExtras)}</Text>
            <Text style={styles.sumLabel}>extras</Text>
          </View>
          <View style={styles.sumDivider} />
          <View style={styles.sumItem}>
            <Text style={[styles.sumVal, { color: Colors.warning }]}>+{totalDias}d</Text>
            <Text style={styles.sumLabel}>atraso Sandero</Text>
          </View>
          <View style={styles.sumDivider} />
          <View style={styles.sumItem}>
            <Text style={[styles.sumVal, { color: sobraMensal >= 0 ? Colors.positive : Colors.negative }]}>
              {formatCurrency(sobraMensal)}
            </Text>
            <Text style={styles.sumLabel}>sobra ajustada</Text>
          </View>
        </View>
      )}

      <FlatList
        data={decisoes}
        keyExtractor={(d) => d.id.toString()}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100 },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.accent} />
        }
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        renderItem={({ item }) => <Row item={item} onDelete={handleDelete} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Feather name="inbox" size={28} color={Colors.textFaint} />
            <Text style={styles.emptyTitle}>Nenhum gasto extra</Text>
            <Text style={styles.emptyText}>
              Toque + para registrar ou use a aba Voz.
            </Text>
          </View>
        }
      />

      {/* Add modal */}
      <Modal visible={showModal} animationType="slide" transparent onRequestClose={() => setShowModal(false)}>
        <View style={styles.overlay}>
          <View style={[styles.sheet, { paddingBottom: insets.bottom + 8 }]}>
            <View style={styles.handle} />

            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>Novo gasto</Text>
              <Pressable onPress={() => setShowModal(false)} hitSlop={10}>
                <Feather name="x" size={20} color={Colors.textSub} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.sheetScroll}
              contentContainerStyle={{ gap: 20 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.field}>
                <Text style={styles.fieldLabel}>DESCRIÇÃO</Text>
                <TextInput
                  style={styles.input}
                  placeholder="ex: Cinema com amigos"
                  placeholderTextColor={Colors.textFaint}
                  value={titulo}
                  onChangeText={setTitulo}
                  autoFocus
                />
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>VALOR (R$)</Text>
                <TextInput
                  style={styles.input}
                  placeholder="0,00"
                  placeholderTextColor={Colors.textFaint}
                  value={valor}
                  onChangeText={setValor}
                  keyboardType="decimal-pad"
                />
                {previewDias !== null && (
                  <View style={styles.impactRow}>
                    <Feather name="clock" size={11} color={Colors.warning} />
                    <Text style={styles.impactText}>
                      Atrasa o Sandero em {previewDias} dias
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.field}>
                <Text style={styles.fieldLabel}>CATEGORIA</Text>
                <View style={styles.chips}>
                  {CATEGORIAS.map((c) => (
                    <Pressable
                      key={c}
                      onPress={() => setCategoria(c)}
                      style={[styles.chip, categoria === c && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, categoria === c && styles.chipTextActive]}>{c}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <Pressable
                onPress={handleSave}
                disabled={!titulo.trim() || !valor || isSaving}
                style={({ pressed }) => [
                  styles.saveBtn,
                  (!titulo.trim() || !valor) && { opacity: 0.35 },
                  pressed && { opacity: 0.7 },
                ]}
              >
                <Text style={styles.saveBtnText}>
                  {isSaving ? "Salvando..." : "Registrar"}
                </Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  headerLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 2,
  },
  addBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },

  summaryStrip: {
    flexDirection: "row",
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.line,
    paddingVertical: 14,
    marginBottom: 8,
  },
  sumItem: { flex: 1, alignItems: "center", gap: 3 },
  sumDivider: { width: 1, backgroundColor: Colors.line },
  sumVal: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.negative },
  sumLabel: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted, letterSpacing: 0.5 },

  list: { paddingHorizontal: 24, paddingTop: 8 },
  sep: { height: 1, backgroundColor: Colors.line, marginVertical: 0 },

  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 12,
  },
  rowLeft: { flex: 1 },
  rowTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  rowMeta: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 3 },
  rowRight: { alignItems: "flex-end", gap: 2 },
  rowValue: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.negative },
  rowImpact: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  deleteBtn: { padding: 4 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 80, gap: 10 },
  emptyTitle: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSub },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, textAlign: "center" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.7)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "80%",
    borderTopWidth: 1,
    borderColor: Colors.lineStrong,
  },
  handle: {
    width: 32,
    height: 3,
    borderRadius: 2,
    backgroundColor: Colors.lineStrong,
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 2,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  sheetTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text },
  sheetScroll: { padding: 20 },

  field: { gap: 10 },
  fieldLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.textMuted, letterSpacing: 2 },
  input: {
    backgroundColor: Colors.overlay,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.lineStrong,
  },
  impactRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 2,
  },
  impactText: { fontSize: 12, fontFamily: "Inter_400Regular", color: Colors.warning },

  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: Colors.lineStrong,
    backgroundColor: Colors.overlay,
  },
  chipActive: { borderColor: Colors.accent, backgroundColor: Colors.accentSoft },
  chipText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSub },
  chipTextActive: { color: Colors.accent, fontFamily: "Inter_500Medium" },

  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 10,
    paddingVertical: 15,
    alignItems: "center",
  },
  saveBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.bg },
});
