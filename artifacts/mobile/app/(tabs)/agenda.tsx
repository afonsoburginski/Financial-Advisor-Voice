import React, { useState, useCallback } from "react";
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
import Colors from "@/constants/colors";
import { useAgendaViewModel } from "@/viewmodels/useAgendaViewModel";
import type {
  AgendaItem,
  AgendaCategoria,
  AgendaPrioridade,
} from "@/models/AgendaItem";
import {
  AGENDA_CATEGORIAS,
  PRIORIDADE_LABELS,
} from "@/models/AgendaItem";

// ─── Constants ────────────────────────────────────────────────────────────────

const PRIORIDADE_COLORS: Record<AgendaPrioridade, string> = {
  alta: Colors.negative,
  media: Colors.money,
  baixa: Colors.positive,
};

// ─── Item Row ─────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onToggle,
  onDelete,
}: {
  item: AgendaItem;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const priColor = PRIORIDADE_COLORS[item.prioridade as AgendaPrioridade] ?? Colors.textMuted;

  const handleDelete = () => {
    Alert.alert("Remover", `"${item.titulo}"?`, [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Remover",
        style: "destructive",
        onPress: () => {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          onDelete();
        },
      },
    ]);
  };

  return (
    <View style={[s.row, item.concluido && s.rowDone]}>
      <Pressable
        onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(); }}
        style={[s.checkbox, item.concluido && { backgroundColor: Colors.accentSoft, borderColor: Colors.accent }]}
        hitSlop={8}
      >
        {item.concluido && <Feather name="check" size={12} color={Colors.accent} />}
      </Pressable>
      <View style={s.rowBody}>
        <Text style={[s.rowTitle, item.concluido && s.rowTitleDone]}>{item.titulo}</Text>
        <View style={s.rowMeta}>
          <Text style={[s.metaDot, { color: priColor }]}>●</Text>
          <Text style={s.metaText}>{PRIORIDADE_LABELS[item.prioridade as AgendaPrioridade] ?? item.prioridade}</Text>
          {item.categoria ? (
            <>
              <Text style={s.metaSep}>·</Text>
              <Text style={s.metaText}>{item.categoria}</Text>
            </>
          ) : null}
          {item.descricao ? (
            <>
              <Text style={s.metaSep}>·</Text>
              <Text style={s.metaDesc} numberOfLines={1}>{item.descricao}</Text>
            </>
          ) : null}
        </View>
      </View>
      <Pressable onPress={handleDelete} hitSlop={8} style={s.deleteBtn}>
        <Feather name="trash-2" size={14} color={Colors.textFaint} />
      </Pressable>
    </View>
  );
}

// ─── Add Modal ────────────────────────────────────────────────────────────────

function AddModal({
  visible,
  onClose,
  onCreate,
  isCreating,
}: {
  visible: boolean;
  onClose: () => void;
  onCreate: (titulo: string, descricao: string, categoria: string, prioridade: AgendaPrioridade) => void;
  isCreating: boolean;
}) {
  const [titulo, setTitulo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [categoria, setCategoria] = useState<AgendaCategoria>("Pessoal");
  const [prioridade, setPrioridade] = useState<AgendaPrioridade>("media");
  const insets = useSafeAreaInsets();

  const handleCreate = () => {
    if (!titulo.trim()) { Alert.alert("Preencha o título"); return; }
    onCreate(titulo.trim(), descricao.trim(), categoria, prioridade);
    setTitulo(""); setDescricao("");
    setPrioridade("media"); setCategoria("Pessoal");
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView
        style={s.modalOverlay}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={[s.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={s.sheetHandle} />
          <Text style={s.sheetTitle}>Nova Tarefa</Text>

          <TextInput
            style={s.textField}
            placeholder="O que precisa ser feito?"
            placeholderTextColor={Colors.textFaint}
            value={titulo}
            onChangeText={setTitulo}
            autoFocus
            returnKeyType="next"
          />
          <TextInput
            style={[s.textField, { minHeight: 60 }]}
            placeholder="Detalhes (opcional)"
            placeholderTextColor={Colors.textFaint}
            value={descricao}
            onChangeText={setDescricao}
            multiline
          />

          {/* Prioridade */}
          <Text style={s.fieldLabel}>PRIORIDADE</Text>
          <View style={s.chipRow}>
            {(["alta", "media", "baixa"] as AgendaPrioridade[]).map((p) => (
              <Pressable
                key={p}
                onPress={() => setPrioridade(p)}
                style={[
                  s.chip,
                  prioridade === p && { backgroundColor: PRIORIDADE_COLORS[p] + "22", borderColor: PRIORIDADE_COLORS[p] },
                ]}
              >
                <Text style={[s.chipText, prioridade === p && { color: PRIORIDADE_COLORS[p] }]}>
                  {PRIORIDADE_LABELS[p]}
                </Text>
              </Pressable>
            ))}
          </View>

          {/* Categoria */}
          <Text style={s.fieldLabel}>CATEGORIA</Text>
          <View style={s.chipRow}>
            {AGENDA_CATEGORIAS.map((c) => (
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
              <Text style={s.createText}>{isCreating ? "Criando..." : "Criar"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const { pending, done, isLoading, isError, refetch, createItem, isCreating, toggleConcluido, deleteItem } =
    useAgendaViewModel();
  const [showAdd, setShowAdd] = useState(false);
  const webTop = Platform.OS === "web" ? 67 : 0;

  const handleCreate = useCallback(
    (titulo: string, descricao: string, categoria: string, prioridade: AgendaPrioridade) => {
      createItem({ titulo, descricao, categoria, prioridade });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    },
    [createItem]
  );

  const sections: Array<{ key: string; label: string; data: AgendaItem[] }> = [
    { key: "pending", label: "PENDENTES", data: pending },
    { key: "done", label: "CONCLUÍDAS", data: done },
  ];

  const flatData = sections.flatMap((sec) => [
    { type: "header" as const, label: sec.label, count: sec.data.length, key: `hdr-${sec.key}` },
    ...sec.data.map((item) => ({ type: "item" as const, item, key: `item-${item.id}` })),
  ]);

  return (
    <View style={[s.container, { paddingTop: insets.top + webTop }]}>
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.title}>Agenda</Text>
          <Text style={s.subtitle}>
            {pending.length} pendente{pending.length !== 1 ? "s" : ""}
          </Text>
        </View>
        <Pressable
          style={s.addBtn}
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setShowAdd(true); }}
        >
          <Feather name="plus" size={18} color={Colors.bg} />
        </Pressable>
      </View>

      {isError && (
        <View style={s.errorBanner}>
          <Text style={s.errorText}>Falha ao carregar. Puxe para tentar novamente.</Text>
        </View>
      )}

      <FlatList
        data={flatData}
        keyExtractor={(i) => i.key}
        contentContainerStyle={[s.listContent, { paddingBottom: insets.bottom + 100 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={Colors.accent} />
        }
        ListEmptyComponent={
          <View style={s.empty}>
            <Feather name="check-square" size={36} color={Colors.textFaint} />
            <Text style={s.emptyText}>Nenhuma tarefa ainda</Text>
            <Text style={s.emptySub}>Toque em + para adicionar</Text>
          </View>
        }
        renderItem={({ item: row }) => {
          if (row.type === "header") {
            if (row.count === 0) return null;
            return (
              <View style={s.sectionHeader}>
                <Text style={s.sectionLabel}>{row.label}</Text>
                <Text style={s.sectionCount}>{row.count}</Text>
              </View>
            );
          }
          return (
            <ItemRow
              item={row.item}
              onToggle={() => toggleConcluido(row.item)}
              onDelete={() => deleteItem(row.item.id)}
            />
          );
        }}
      />

      <AddModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onCreate={handleCreate}
        isCreating={isCreating}
      />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center",
  },

  errorBanner: { backgroundColor: Colors.negativeSoft, marginHorizontal: 24, borderRadius: 8, padding: 12, marginBottom: 8 },
  errorText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.negative, textAlign: "center" },

  listContent: { paddingHorizontal: 24, paddingTop: 4, gap: 0 },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 20,
    paddingBottom: 10,
  },
  sectionLabel: {
    fontSize: 10, fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted, letterSpacing: 2,
  },
  sectionCount: { fontSize: 10, fontFamily: "Inter_500Medium", color: Colors.textFaint },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: Colors.line,
  },
  rowDone: { opacity: 0.5 },
  checkbox: {
    width: 22, height: 22, borderRadius: 6,
    borderWidth: 1, borderColor: Colors.lineStrong,
    alignItems: "center", justifyContent: "center",
  },
  rowBody: { flex: 1, gap: 4 },
  rowTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text },
  rowTitleDone: { textDecorationLine: "line-through", color: Colors.textMuted },
  rowMeta: { flexDirection: "row", alignItems: "center", gap: 4, flexWrap: "wrap" },
  metaDot: { fontSize: 8 },
  metaText: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  metaSep: { fontSize: 11, color: Colors.textFaint },
  metaDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, flex: 1 },
  deleteBtn: { padding: 4 },

  empty: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 80 },
  emptyText: { fontSize: 16, fontFamily: "Inter_500Medium", color: Colors.textSub },
  emptySub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted },

  // Sheet
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.6)" },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, gap: 14,
    borderTopWidth: 1, borderColor: Colors.lineStrong,
  },
  sheetHandle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: Colors.lineStrong, alignSelf: "center", marginBottom: 4,
  },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 4 },
  textField: {
    backgroundColor: Colors.overlay,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text,
    borderWidth: 1, borderColor: Colors.lineMedium,
  },
  fieldLabel: {
    fontSize: 9, fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted, letterSpacing: 2,
  },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: 100, borderWidth: 1, borderColor: Colors.lineStrong,
    backgroundColor: Colors.overlay,
  },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSub },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 4 },
  cancelBtn: {
    flex: 1, padding: 14, borderRadius: 14,
    alignItems: "center", borderWidth: 1, borderColor: Colors.lineStrong,
  },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSub },
  createBtn: {
    flex: 2, padding: 14, borderRadius: 14,
    alignItems: "center", backgroundColor: Colors.accent,
  },
  createText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.bg },
});
