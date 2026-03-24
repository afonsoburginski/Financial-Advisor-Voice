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
import { Feather, Ionicons, MaterialCommunityIcons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import Colors from "@/constants/colors";
import { useFinance, type Decisao } from "@/context/FinanceContext";
import {
  FINANCE,
  calcularImpactoSandero,
  formatCurrency,
  formatDate,
} from "@/constants/finance";

const CATEGORIAS = FINANCE.CATEGORIAS;

function DecisaoItem({
  item,
  onDelete,
}: {
  item: Decisao;
  onDelete: (id: number) => void;
}) {
  const diasAtraso = calcularImpactoSandero(item.valor);

  return (
    <View style={styles.decisaoCard}>
      <View style={styles.decisaoLeft}>
        <View style={styles.categoriaIcon}>
          <MaterialCommunityIcons
            name={getCategoryIcon(item.categoria)}
            size={18}
            color={Colors.accent}
          />
        </View>
        <View style={styles.decisaoInfo}>
          <Text style={styles.decisaoTitulo}>{item.titulo}</Text>
          <Text style={styles.decisaoCategoria}>{item.categoria}</Text>
          <Text style={styles.decisaoData}>{formatDate(item.data)}</Text>
        </View>
      </View>
      <View style={styles.decisaoRight}>
        <Text style={styles.decisaoValor}>-{formatCurrency(item.valor)}</Text>
        <Text style={styles.decisaoImpacto}>+{diasAtraso}d no Sandero</Text>
        <Pressable
          onPress={() => onDelete(item.id)}
          style={({ pressed }) => [
            styles.deleteBtn,
            { opacity: pressed ? 0.6 : 1 },
          ]}
        >
          <Feather name="trash-2" size={14} color={Colors.negative} />
        </Pressable>
      </View>
    </View>
  );
}

function getCategoryIcon(cat: string): string {
  const map: Record<string, string> = {
    Alimentação: "food",
    Saúde: "medical-bag",
    Lazer: "movie-open",
    Educação: "school",
    Vestuário: "tshirt-crew",
    Transporte: "car",
    Tecnologia: "laptop",
    Outros: "dots-horizontal",
  };
  return (map[cat] as any) ?? "dots-horizontal";
}

export default function HistoryScreen() {
  const insets = useSafeAreaInsets();
  const { decisoes, sobraMensal, isLoading, addDecisao, removeDecisao, refetch } =
    useFinance();
  const [showModal, setShowModal] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [valor, setValor] = useState("");
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [isSaving, setIsSaving] = useState(false);

  const webTop = Platform.OS === "web" ? 67 : 0;

  const handleDelete = useCallback(
    async (id: number) => {
      Alert.alert("Remover gasto", "Deseja remover este registro?", [
        { text: "Cancelar", style: "cancel" },
        {
          text: "Remover",
          style: "destructive",
          onPress: async () => {
            await Haptics.notificationAsync(
              Haptics.NotificationFeedbackType.Warning
            );
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

  const totalGastos = decisoes.reduce((a, d) => a + d.valor, 0);
  const totalDiasAtraso = decisoes.reduce(
    (a, d) => a + calcularImpactoSandero(d.valor),
    0
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTop }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Histórico</Text>
        <Pressable
          onPress={() => setShowModal(true)}
          style={({ pressed }) => [
            styles.addBtn,
            { opacity: pressed ? 0.8 : 1 },
          ]}
        >
          <Feather name="plus" size={20} color={Colors.background} />
        </Pressable>
      </View>

      {/* Summary Row */}
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total gastos extras</Text>
          <Text style={[styles.summaryValue, { color: Colors.negative }]}>
            -{formatCurrency(totalGastos)}
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Impacto no Sandero</Text>
          <Text style={[styles.summaryValue, { color: Colors.warning }]}>
            +{totalDiasAtraso}d
          </Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Sobra atual</Text>
          <Text
            style={[
              styles.summaryValue,
              { color: sobraMensal >= 0 ? Colors.positive : Colors.negative },
            ]}
          >
            {formatCurrency(sobraMensal)}
          </Text>
        </View>
      </View>

      {/* List */}
      <FlatList
        data={decisoes}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={[
          styles.list,
          {
            paddingBottom:
              insets.bottom + (Platform.OS === "web" ? 34 : 0) + 100,
          },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={isLoading}
            onRefresh={refetch}
            tintColor={Colors.accent}
          />
        }
        renderItem={({ item }) => (
          <DecisaoItem item={item} onDelete={handleDelete} />
        )}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <MaterialCommunityIcons
              name="receipt-text-outline"
              size={52}
              color={Colors.textDim}
            />
            <Text style={styles.emptyTitle}>Nenhum gasto extra</Text>
            <Text style={styles.emptyText}>
              Toque no + para registrar um gasto extra e ver o impacto no seu
              Sandero.
            </Text>
          </View>
        }
      />

      {/* Add Modal */}
      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHandle} />
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Novo Gasto Extra</Text>
              <Pressable
                onPress={() => setShowModal(false)}
                style={({ pressed }) => [
                  styles.modalClose,
                  { opacity: pressed ? 0.6 : 1 },
                ]}
              >
                <Feather name="x" size={22} color={Colors.textMuted} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={{ gap: 16, paddingBottom: insets.bottom + 20 }}
              showsVerticalScrollIndicator={false}
            >
              {/* Title */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Descrição</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="Ex: Cinema com amigos"
                  placeholderTextColor={Colors.textDim}
                  value={titulo}
                  onChangeText={setTitulo}
                />
              </View>

              {/* Valor */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Valor (R$)</Text>
                <TextInput
                  style={styles.textInput}
                  placeholder="0,00"
                  placeholderTextColor={Colors.textDim}
                  value={valor}
                  onChangeText={setValor}
                  keyboardType="decimal-pad"
                />
                {valor && !isNaN(parseFloat(valor.replace(",", "."))) && (
                  <View style={styles.impactPreview}>
                    <Ionicons
                      name="car-outline"
                      size={14}
                      color={Colors.warning}
                    />
                    <Text style={styles.impactText}>
                      Isso atrasa seu Sandero em{" "}
                      {calcularImpactoSandero(
                        parseFloat(valor.replace(",", "."))
                      )}{" "}
                      dias
                    </Text>
                  </View>
                )}
              </View>

              {/* Categoria */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>Categoria</Text>
                <View style={styles.categorias}>
                  {CATEGORIAS.map((cat) => (
                    <Pressable
                      key={cat}
                      onPress={() => setCategoria(cat)}
                      style={[
                        styles.catChip,
                        categoria === cat && styles.catChipActive,
                      ]}
                    >
                      <Text
                        style={[
                          styles.catChipText,
                          categoria === cat && styles.catChipTextActive,
                        ]}
                      >
                        {cat}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              {/* Save Button */}
              <Pressable
                onPress={handleSave}
                disabled={!titulo.trim() || !valor || isSaving}
                style={({ pressed }) => [
                  styles.saveBtn,
                  (!titulo.trim() || !valor) && styles.saveBtnDisabled,
                  { opacity: pressed ? 0.8 : 1 },
                ]}
              >
                <Text style={styles.saveBtnText}>
                  {isSaving ? "Salvando..." : "Registrar Gasto"}
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
  addBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  summaryRow: {
    flexDirection: "row",
    backgroundColor: Colors.backgroundCard,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    paddingVertical: 14,
  },
  summaryItem: {
    flex: 1,
    alignItems: "center",
    gap: 3,
  },
  summaryDivider: {
    width: 1,
    backgroundColor: Colors.border,
  },
  summaryLabel: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
    textTransform: "uppercase",
    textAlign: "center",
    letterSpacing: 0.4,
  },
  summaryValue: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  list: {
    padding: 16,
    gap: 10,
  },
  decisaoCard: {
    backgroundColor: Colors.backgroundCard,
    borderRadius: 14,
    padding: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  decisaoLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  categoriaIcon: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: Colors.accentMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  decisaoInfo: {
    flex: 1,
    gap: 2,
  },
  decisaoTitulo: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.white,
  },
  decisaoCategoria: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  decisaoData: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textDim,
  },
  decisaoRight: {
    alignItems: "flex-end",
    gap: 3,
  },
  decisaoValor: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.negative,
  },
  decisaoImpacto: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  deleteBtn: {
    marginTop: 4,
    padding: 4,
  },
  emptyState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  emptyText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textDim,
    textAlign: "center",
    paddingHorizontal: 40,
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modalContainer: {
    backgroundColor: Colors.backgroundElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
  },
  modalHandle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: Colors.border,
    alignSelf: "center",
    marginTop: 12,
    marginBottom: 4,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.white,
  },
  modalClose: {
    padding: 4,
  },
  modalScroll: {
    padding: 20,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.6,
  },
  textInput: {
    backgroundColor: Colors.backgroundInput,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  impactPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.warningDim,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: Colors.warning + "33",
  },
  impactText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.warning,
  },
  categorias: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.backgroundInput,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  catChipActive: {
    backgroundColor: Colors.accentMuted,
    borderColor: Colors.accent,
  },
  catChipText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  catChipTextActive: {
    color: Colors.accent,
    fontFamily: "Inter_600SemiBold",
  },
  saveBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnDisabled: {
    opacity: 0.4,
  },
  saveBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.background,
  },
});
