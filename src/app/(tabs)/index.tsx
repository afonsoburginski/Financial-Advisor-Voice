import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import { Link } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  LayoutAnimation,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  UIManager,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { useAgendaController } from "@/controllers/useAgendaController";
import { useFinanceController } from "@/controllers/useFinanceController";
import { useUserController } from "@/controllers/useUserController";
import Colors from "@/constants/colors";
import { TAB_BAR_HEIGHT } from "@/constants/layout";
import { formatCurrency } from "@/constants/finance";
import type { FinanceSettings } from "@/db/financeDb";
import type { LedgerEntry } from "@/models/Ledger";
import type { AgendaItem, AgendaPrioridade, AgendaCategoria } from "@/models/AgendaItem";
import { AGENDA_CATEGORIAS, PRIORIDADE_LABELS } from "@/models/AgendaItem";
import { getOpenAIApiKey } from "@/services/openai";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function parseNum(s: string): number {
  const t = s.replace(/\s/g, "").replace(",", ".").trim();
  const n = parseFloat(t);
  return Number.isFinite(n) ? n : 0;
}

// ─── Legacy charts removed ──────────────────────────────────────────────────

// ─── ProgressRing (linear for meta) ──────────────────────────────────────────

function ProgressRing({ value }: { value: number }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(anim, {
      toValue: Math.min(Math.max(value, 0), 1),
      useNativeDriver: false,
      tension: 50,
      friction: 12,
    }).start();
  }, [value, anim]);
  const width = anim.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] });
  return (
    <View style={d.track}>
      <Animated.View style={[d.fill, { width }]} />
    </View>
  );
}

// ─── Settings Modal ────────────────────────────────────────────────────────────

function SettingsModal({
  visible,
  onClose,
  initial,
  onSave,
  saving,
}: {
  visible: boolean;
  onClose: () => void;
  initial: FinanceSettings | null;
  onSave: (patch: Partial<FinanceSettings>) => void;
  saving: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [f, setF] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!initial || !visible) return;
    setF({
      salario_bruto: String(initial.salario_bruto),
      salario_liquido: String(initial.salario_liquido),
      vale_alimentacao_mes: String(initial.vale_alimentacao_mes),
      meta_titulo: initial.meta_titulo,
      meta_valor: String(initial.meta_valor),
      economizado_meta: String(initial.economizado_meta),
      fixo_aluguel: String(initial.fixo_aluguel),
      fixo_energia: String(initial.fixo_energia),
      fixo_celular: String(initial.fixo_celular),
      fixo_transporte: String(initial.fixo_transporte),
      fixo_lazer: String(initial.fixo_lazer),
      fixo_outros: String(initial.fixo_outros),
    });
  }, [initial, visible]);

  const save = () => {
    onSave({
      salario_bruto: parseNum(f.salario_bruto ?? "0"),
      salario_liquido: parseNum(f.salario_liquido ?? "0"),
      vale_alimentacao_mes: parseNum(f.vale_alimentacao_mes ?? "0"),
      meta_titulo: (f.meta_titulo ?? "").trim(),
      meta_valor: parseNum(f.meta_valor ?? "0"),
      economizado_meta: parseNum(f.economizado_meta ?? "0"),
      fixo_aluguel: parseNum(f.fixo_aluguel ?? "0"),
      fixo_energia: parseNum(f.fixo_energia ?? "0"),
      fixo_celular: parseNum(f.fixo_celular ?? "0"),
      fixo_transporte: parseNum(f.fixo_transporte ?? "0"),
      fixo_lazer: parseNum(f.fixo_lazer ?? "0"),
      fixo_outros: parseNum(f.fixo_outros ?? "0"),
    });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onClose();
  };

  const field = (key: keyof typeof f, ph: string, kbd: "default" | "decimal-pad" = "decimal-pad") => (
    <View style={d.formGroup}>
      <Text style={d.formLabel}>{ph}</Text>
      <TextInput
        style={d.formInput}
        placeholder="0"
        placeholderTextColor={Colors.textFaint}
        value={f[key] ?? ""}
        onChangeText={(t) => setF((p) => ({ ...p, [key]: t }))}
        keyboardType={kbd}
      />
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={d.modalOverlay}>
        <View style={[d.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={d.sheetHandle} />
          <Text style={d.sheetTitle}>Plano financeiro mensal</Text>
          <Text style={d.sheetSub}>Valores guardados localmente (SQLite). Alimentam o Painel e o Tommy.</Text>
          <ScrollView style={d.sheetScroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {field("salario_bruto", "Salário bruto")}
            {field("salario_liquido", "Salário líquido")}
            {field("vale_alimentacao_mes", "Vale alimentação (mês)")}
            <View style={d.formGroup}>
              <Text style={d.formLabel}>Título da meta</Text>
              <TextInput
                style={d.formInput}
                placeholder="Ex.: Reserva / carro / viagem"
                placeholderTextColor={Colors.textFaint}
                value={f.meta_titulo ?? ""}
                onChangeText={(t) => setF((p) => ({ ...p, meta_titulo: t }))}
                keyboardType="default"
              />
            </View>
            {field("meta_valor", "Valor objetivo da meta")}
            {field("economizado_meta", "Já guardado para a meta")}
            <Text style={[d.detailsSection, { marginTop: 8 }]}>Custos fixos (mês)</Text>
            {field("fixo_aluguel", "Moradia / aluguel")}
            {field("fixo_energia", "Energia")}
            {field("fixo_celular", "Celular / internet")}
            {field("fixo_transporte", "Transporte")}
            {field("fixo_lazer", "Lazer (fixo)")}
            {field("fixo_outros", "Outros fixos")}
          </ScrollView>
          <View style={d.sheetActions}>
            <Pressable style={d.cancelBtn} onPress={onClose}>
              <Text style={d.cancelText}>Cancelar</Text>
            </Pressable>
            <Pressable style={[d.createBtn, saving && { opacity: 0.6 }]} onPress={save} disabled={saving}>
              <Text style={d.createText}>{saving ? "A guardar…" : "Guardar"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({ visible, onClose, onImport, loading }: {
  visible: boolean; onClose: () => void;
  onImport: (text: string) => Promise<void>; loading: boolean;
}) {
  const insets = useSafeAreaInsets();
  const [text, setText] = useState("");

  const pickTxt = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({ type: ["text/plain", "application/octet-stream"], copyToCacheDirectory: true });
      if (res.canceled || !res.assets?.[0]) return;
      const asset = res.assets[0];
      const name = asset.name?.toLowerCase() ?? "";
      if (!name.endsWith(".txt") && asset.mimeType !== "text/plain") {
        Alert.alert("Ficheiro", "Usa um ficheiro .txt com o texto do extrato.");
        return;
      }
      const content = await FileSystem.readAsStringAsync(asset.uri);
      setText(content);
      Haptics.selectionAsync();
    } catch { Alert.alert("Erro", "Não foi possível ler o ficheiro."); }
  };

  const run = async () => {
    const t = text.trim();
    if (!t) { Alert.alert("Extrato", "Cola o texto do extrato ou importa um .txt."); return; }
    if (!getOpenAIApiKey()) { Alert.alert("OpenAI", "Define EXPO_PUBLIC_OPENAI_API_KEY no .env para a IA processar."); return; }
    try { await onImport(t); setText(""); onClose(); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); }
    catch (e) { Alert.alert("Importação", e instanceof Error ? e.message : "Falhou"); }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={d.modalOverlay}>
        <View style={[d.sheet, { paddingBottom: insets.bottom + 16, maxHeight: "92%" }]}>
          <View style={d.sheetHandle} />
          <Text style={d.sheetTitle}>Importar extrato (IA)</Text>
          <Text style={d.sheetSub}>Cola o texto do PDF ou importa .txt. A IA extrai débitos/créditos.</Text>
          <Pressable style={d.fileBtn} onPress={pickTxt}>
            <Feather name="file-text" size={18} color={Colors.accent} />
            <Text style={d.fileBtnText}>Importar ficheiro .txt</Text>
          </Pressable>
          <TextInput style={d.importArea} placeholder="Cola aqui o texto do extrato…" placeholderTextColor={Colors.textFaint} value={text} onChangeText={setText} multiline textAlignVertical="top" />
          <View style={d.sheetActions}>
            <Pressable style={d.cancelBtn} onPress={onClose}><Text style={d.cancelText}>Fechar</Text></Pressable>
            <Pressable style={[d.createBtn, loading && { opacity: 0.6 }]} onPress={() => void run()} disabled={loading}>
              {loading ? <ActivityIndicator color={Colors.bg} /> : <Text style={d.createText}>Processar com IA</Text>}
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Add Planejamento Modal ───────────────────────────────────────────────────

const PRIORIDADE_COLORS: Record<AgendaPrioridade, string> = {
  alta: Colors.negative,
  media: Colors.money,
  baixa: Colors.positive,
};

type PlanStatus = "planejamento" | "objetivo" | "concluído";

function AddPlanModal({ visible, onClose, onCreate, isCreating }: {
  visible: boolean; onClose: () => void;
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
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <KeyboardAvoidingView style={d.modalOverlay} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={[d.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <View style={d.sheetHandle} />
          <Text style={d.sheetTitle}>Novo Planejamento</Text>
          <TextInput style={d.formInput} placeholder="O que planejas?" placeholderTextColor={Colors.textFaint} value={titulo} onChangeText={setTitulo} autoFocus returnKeyType="next" />
          <TextInput style={[d.formInput, { minHeight: 56, marginTop: 10 }]} placeholder="Detalhes (opcional)" placeholderTextColor={Colors.textFaint} value={descricao} onChangeText={setDescricao} multiline />

          <Text style={[d.formLabel, { marginTop: 12 }]}>PRIORIDADE</Text>
          <View style={d.chipRow}>
            {(["alta", "media", "baixa"] as AgendaPrioridade[]).map((p) => (
              <Pressable key={p} onPress={() => setPrioridade(p)} style={[d.chip, prioridade === p && { backgroundColor: PRIORIDADE_COLORS[p] + "22", borderColor: PRIORIDADE_COLORS[p] }]}>
                <Text style={[d.chipText, prioridade === p && { color: PRIORIDADE_COLORS[p] }]}>{PRIORIDADE_LABELS[p]}</Text>
              </Pressable>
            ))}
          </View>

          <Text style={[d.formLabel, { marginTop: 10 }]}>CATEGORIA</Text>
          <View style={d.chipRow}>
            {AGENDA_CATEGORIAS.map((c) => (
              <Pressable key={c} onPress={() => setCategoria(c)} style={[d.chip, categoria === c && { backgroundColor: Colors.accentSoft, borderColor: Colors.accent }]}>
                <Text style={[d.chipText, categoria === c && { color: Colors.accent }]}>{c}</Text>
              </Pressable>
            ))}
          </View>

          <View style={[d.sheetActions, { marginTop: 14 }]}>
            <Pressable style={d.cancelBtn} onPress={onClose}><Text style={d.cancelText}>Cancelar</Text></Pressable>
            <Pressable style={[d.createBtn, isCreating && { opacity: 0.6 }]} onPress={handleCreate} disabled={isCreating}>
              <Text style={d.createText}>{isCreating ? "Criando…" : "Criar"}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Planejamento Card ────────────────────────────────────────────────────────

function PlanCard({ item, onToggle, onDelete }: { item: AgendaItem; onToggle: () => void; onDelete: () => void }) {
  const priColor = PRIORIDADE_COLORS[item.prioridade as AgendaPrioridade] ?? Colors.textMuted;
  const status: PlanStatus = item.concluido ? "concluído" : item.prioridade === "alta" ? "objetivo" : "planejamento";
  const statusColors: Record<PlanStatus, string> = { planejamento: Colors.textMuted, objetivo: Colors.money, "concluído": Colors.positive };

  return (
    <View style={[d.planCard, item.concluido && { opacity: 0.5 }]}>
      <View style={d.planCardLeft}>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); onToggle(); }}
          style={[d.planCheck, item.concluido && { backgroundColor: Colors.accentSoft, borderColor: Colors.accent }]}
          hitSlop={8}
        >
          {item.concluido && <Feather name="check" size={12} color={Colors.accent} />}
        </Pressable>
        <View style={d.planCardBody}>
          <Text style={[d.planTitle, item.concluido && { textDecorationLine: "line-through", color: Colors.textMuted }]} numberOfLines={2}>{item.titulo}</Text>
          <View style={d.planMeta}>
            <View style={[d.statusBadge, { backgroundColor: statusColors[status] + "18" }]}>
              <Text style={[d.statusText, { color: statusColors[status] }]}>{status}</Text>
            </View>
            <Text style={[d.planPri, { color: priColor }]}>● {PRIORIDADE_LABELS[item.prioridade as AgendaPrioridade]}</Text>
            {item.categoria ? <Text style={d.planCat}>{item.categoria}</Text> : null}
          </View>
          {item.descricao ? <Text style={d.planDesc} numberOfLines={2}>{item.descricao}</Text> : null}
        </View>
      </View>
      <Pressable onPress={() => Alert.alert("Remover", `"${item.titulo}"?`, [{ text: "Cancelar", style: "cancel" }, { text: "Remover", style: "destructive", onPress: onDelete }])} hitSlop={8} style={d.planDelete}>
        <Feather name="trash-2" size={14} color={Colors.textFaint} />
      </Pressable>
    </View>
  );
}

// ─── Financial details rows ───────────────────────────────────────────────────

function Row({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <View style={d.row}>
      <Text style={d.rowLabel}>{label}</Text>
      <Text style={[d.rowValue, accent && { color: Colors.positive }]}>{value}</Text>
    </View>
  );
}

function previewLines(ledger: LedgerEntry[]): LedgerEntry[] {
  return [...ledger].slice(0, 6);
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const finance = useFinanceController();
  const agenda = useAgendaController();
  const user = useUserController();
  const insets = useSafeAreaInsets();
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [addPlanOpen, setAddPlanOpen] = useState(false);

  const topPad = insets.top + (Platform.OS === "web" ? 8 : 0);
  const bottomPad = insets.bottom + TAB_BAR_HEIGHT + 28;

  const {
    sobraMensal,
    progressSandero,
    mesesParaSandero,
    totalExtras,
    totalIncomeMonth,
    fixosSum,
    settings,
    ledgerMonth,
    isLoading,
    refetch,
    updateSettings,
    isUpdatingSettings,
    importStatementAsync,
    isImporting,
  } = finance;

  const { pending, done, isLoading: agendaLoading, refetch: agendaRefetch, createItem, isCreating, toggleConcluido, deleteItem } = agenda;

  const recent = previewLines(ledgerMonth);

  const toggleDetails = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setDetailsOpen((o) => !o);
  };

  const metaTitulo = settings?.meta_titulo?.trim() || "Meta financeira";
  const metaValor = settings?.meta_valor ?? 0;

  const balanceColor = sobraMensal >= 0 ? Colors.positive : Colors.negative;

  return (
    <ScrollView
      style={[d.screen, { paddingTop: topPad }]}
      contentContainerStyle={[d.content, { paddingBottom: bottomPad }]}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={isLoading || agendaLoading} onRefresh={() => { void refetch(); void agendaRefetch(); }} tintColor={Colors.accent} />}
    >
      {/* ── Header ── */}
      <Text style={d.greeting}>{user.greeting()}</Text>

      {/* ── Balance Hero ── */}
      <View style={d.balanceCard}>
        <Text style={d.balanceLabel}>Balanço do mês</Text>
        <Text style={[d.balanceValue, { color: balanceColor }]}>
          {formatCurrency(sobraMensal)}
        </Text>
        <View style={d.balanceRow}>
          <View style={d.balanceStat}>
            <Text style={[d.balanceDot, { color: Colors.positive }]}>↑</Text>
            <Text style={d.balanceStatText}>{formatCurrency(totalIncomeMonth)}</Text>
          </View>
          <View style={d.balanceDivider} />
          <View style={d.balanceStat}>
            <Text style={[d.balanceDot, { color: Colors.negative }]}>↓</Text>
            <Text style={d.balanceStatText}>{formatCurrency(totalExtras)}</Text>
          </View>
          <View style={d.balanceDivider} />
          <View style={d.balanceStat}>
            <Text style={[d.balanceDot, { color: Colors.money }]}>●</Text>
            <Text style={d.balanceStatText}>{formatCurrency(fixosSum)}</Text>
          </View>
        </View>
      </View>

      {/* ── Quick actions ── */}
      <View style={d.quickActions}>
        <Pressable style={d.qaBtn} onPress={() => setSettingsOpen(true)}>
          <Feather name="sliders" size={16} color={Colors.textSub} />
          <Text style={d.qaText}>Configurar</Text>
        </Pressable>
        <Pressable style={d.qaBtn} onPress={() => setImportOpen(true)}>
          <Feather name="upload-cloud" size={16} color={Colors.textSub} />
          <Text style={d.qaText}>Importar</Text>
        </Pressable>
        <Link href="/history" asChild>
          <Pressable style={d.qaBtn}>
            <Feather name="clock" size={16} color={Colors.textSub} />
            <Text style={d.qaText}>Histórico</Text>
          </Pressable>
        </Link>
      </View>

      {/* ── Meta (financeira) ── */}
      {metaValor > 0 && (
        <View style={d.goalCard}>
          <View style={d.goalHead}>
            <View style={{ flex: 1 }}>
              <Text style={d.goalTitle}>{metaTitulo}</Text>
              <Text style={d.goalSub}>
                {mesesParaSandero > 0
                  ? `~${mesesParaSandero} meses restantes`
                  : "Configure a renda para estimar"}
              </Text>
            </View>
            <Text style={d.goalAmount}>{formatCurrency(metaValor)}</Text>
          </View>
          <ProgressRing value={progressSandero} />
          <Text style={d.goalPct}>{(progressSandero * 100).toFixed(1)}%</Text>
        </View>
      )}

      {/* ── Planejamentos ── */}
      <View style={d.sectionHead}>
        <Text style={d.sectionTitle}>Planejamentos</Text>
        <Pressable
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setAddPlanOpen(true); }}
          style={d.addBtn}
        >
          <Feather name="plus" size={14} color="#fff" />
        </Pressable>
      </View>

      {pending.length === 0 && done.length === 0 ? (
        <View style={d.emptyCard}>
          <Text style={d.emptyText}>Sem planejamentos por enquanto.</Text>
        </View>
      ) : (
        <View style={d.planList}>
          {[...pending, ...done].slice(0, 8).map((item) => (
            <PlanCard
              key={item.id}
              item={item}
              onToggle={() => toggleConcluido(item)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}
        </View>
      )}

      {/* ── Movimentos recentes ── */}
      <View style={d.sectionHead}>
        <Text style={d.sectionTitle}>Atividade</Text>
        <Link href="/history" asChild>
          <Pressable hitSlop={12}><Text style={d.sectionLink}>Ver tudo</Text></Pressable>
        </Link>
      </View>

      {recent.length === 0 ? (
        <View style={d.emptyCard}>
          <Text style={d.emptyText}>Nenhum movimento registado.</Text>
        </View>
      ) : (
        <View style={d.activityList}>
          {recent.map((item) => (
            <View key={item.id} style={d.activityRow}>
              <View style={[d.activityIcon, item.kind === "income" ? d.activityIconIn : d.activityIconOut]}>
                <Feather name={item.kind === "income" ? "arrow-down-left" : "arrow-up-right"} size={14} color={item.kind === "income" ? Colors.positive : Colors.negative} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={d.activityTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={d.activitySub}>{item.occurred_at}</Text>
              </View>
              <Text style={[d.activityMoney, item.kind === "income" ? { color: Colors.positive } : { color: Colors.negative }]}>
                {item.kind === "income" ? "+" : "−"}{formatCurrency(item.amount)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Ver detalhes financeiros ── */}
      <Pressable style={d.detailsToggle} onPress={toggleDetails}>
        <Text style={d.detailsToggleText}>
          {detailsOpen ? "Ocultar detalhes" : "Detalhes financeiros"}
        </Text>
        <Feather name={detailsOpen ? "chevron-up" : "chevron-down"} size={16} color={Colors.textMuted} />
      </Pressable>

      {detailsOpen && settings ? (
        <View style={d.detailsBox}>
          <Text style={d.detailsSection}>RENDA</Text>
          <Row label="Salário bruto" value={formatCurrency(settings.salario_bruto)} />
          <Row label="Salário líquido" value={formatCurrency(settings.salario_liquido)} accent />
          <Row label="Vale alimentação" value={formatCurrency(settings.vale_alimentacao_mes)} />
          <Text style={[d.detailsSection, { marginTop: 16 }]}>CUSTOS FIXOS</Text>
          <Row label="Moradia" value={formatCurrency(settings.fixo_aluguel)} />
          <Row label="Energia" value={formatCurrency(settings.fixo_energia)} />
          <Row label="Celular" value={formatCurrency(settings.fixo_celular)} />
          <Row label="Transporte" value={formatCurrency(settings.fixo_transporte)} />
          <Row label="Lazer" value={formatCurrency(settings.fixo_lazer)} />
          <Row label="Outros" value={formatCurrency(settings.fixo_outros)} />
          <View style={d.detailsTotal}>
            <Text style={d.detailsTotalLabel}>Total fixos</Text>
            <Text style={d.detailsTotalValue}>{formatCurrency(fixosSum)}</Text>
          </View>
        </View>
      ) : null}

      {/* ── Tommy CTA ── */}
      <Link href="/advisor" asChild>
        <Pressable style={d.chatCta}>
          <LinearGradient colors={["rgba(124,110,250,0.15)", "rgba(124,110,250,0.05)"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={d.chatCtaGrad}>
            <Feather name="mic" size={18} color={Colors.accent} />
            <Text style={d.chatCtaText}>Falar com Tommy</Text>
            <Feather name="chevron-right" size={16} color={Colors.textMuted} />
          </LinearGradient>
        </Pressable>
      </Link>

      {/* ── Modals ── */}
      <SettingsModal visible={settingsOpen} onClose={() => setSettingsOpen(false)} initial={settings ?? null} onSave={(patch) => updateSettings(patch)} saving={isUpdatingSettings} />
      <ImportModal visible={importOpen} onClose={() => setImportOpen(false)} onImport={async (t) => { await importStatementAsync(t); }} loading={isImporting} />
      <AddPlanModal visible={addPlanOpen} onClose={() => setAddPlanOpen(false)} onCreate={(titulo, desc, cat, pri) => createItem({ titulo, descricao: desc, categoria: cat, prioridade: pri })} isCreating={isCreating} />
    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const d = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.bg },
  content: { paddingHorizontal: 20, gap: 16 },

  greeting: { fontSize: 26, fontFamily: "Inter_700Bold", color: Colors.text, letterSpacing: -0.5, marginBottom: 4 },

  // Balance Hero
  balanceCard: {
    backgroundColor: Colors.surface,
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderColor: Colors.line,
    gap: 12,
  },
  balanceLabel: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textMuted, letterSpacing: 1.5, textTransform: "uppercase" },
  balanceValue: { fontSize: 36, fontFamily: "Inter_700Bold", letterSpacing: -1 },
  balanceRow: { flexDirection: "row", alignItems: "center", gap: 0, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.line },
  balanceStat: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6 },
  balanceDot: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  balanceStatText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textSub },
  balanceDivider: { width: StyleSheet.hairlineWidth, height: 20, backgroundColor: Colors.lineStrong },

  // Quick actions
  quickActions: { flexDirection: "row", gap: 8 },
  qaBtn: {
    flex: 1,
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  qaText: { fontSize: 11, fontFamily: "Inter_500Medium", color: Colors.textSub },

  // Goal
  goalCard: { backgroundColor: Colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.line, gap: 10 },
  goalHead: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  goalTitle: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.text },
  goalSub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 3 },
  goalAmount: { fontSize: 13, fontFamily: "Inter_600SemiBold", color: Colors.textSub },
  goalPct: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.accent },

  // Progress
  track: { height: 3, backgroundColor: Colors.line, borderRadius: 2, overflow: "hidden", marginTop: 2 },
  fill: { height: 3, backgroundColor: Colors.accent, borderRadius: 2 },

  // Sections
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", color: Colors.text, letterSpacing: -0.2 },
  sectionLink: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.accent },
  addBtn: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.accent, alignItems: "center", justifyContent: "center" },

  // Plans
  planList: { gap: 6 },
  planCard: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", backgroundColor: Colors.surface, borderRadius: 14, padding: 14, borderWidth: 1, borderColor: Colors.line, gap: 10 },
  planCardLeft: { flex: 1, flexDirection: "row", gap: 10, alignItems: "flex-start" },
  planCheck: { width: 20, height: 20, borderRadius: 5, borderWidth: 1, borderColor: Colors.lineStrong, alignItems: "center", justifyContent: "center", marginTop: 2 },
  planCardBody: { flex: 1, gap: 4 },
  planTitle: { fontSize: 14, fontFamily: "Inter_500Medium", color: Colors.text, lineHeight: 20 },
  planMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
  statusBadge: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 20 },
  statusText: { fontSize: 9, fontFamily: "Inter_600SemiBold", letterSpacing: 0.5 },
  planPri: { fontSize: 10, fontFamily: "Inter_400Regular" },
  planCat: { fontSize: 10, fontFamily: "Inter_400Regular", color: Colors.textMuted },
  planDesc: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 16 },
  planDelete: { padding: 4 },

  emptyCard: { backgroundColor: Colors.surface, borderRadius: 14, padding: 20, borderWidth: 1, borderColor: Colors.line, alignItems: "center" },
  emptyText: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted },

  // Activity
  activityList: { gap: 2 },
  activityRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.line },
  activityIcon: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
  activityIconIn: { backgroundColor: "rgba(16,185,129,0.1)" },
  activityIconOut: { backgroundColor: "rgba(239,68,68,0.1)" },
  activityTitle: { fontSize: 14, fontFamily: "Inter_400Regular", color: Colors.text },
  activitySub: { fontSize: 11, fontFamily: "Inter_400Regular", color: Colors.textMuted, marginTop: 1 },
  activityMoney: { fontSize: 14, fontFamily: "Inter_600SemiBold" },

  // Details
  detailsToggle: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, paddingHorizontal: 4 },
  detailsToggleText: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  detailsBox: { backgroundColor: Colors.surface, borderRadius: 16, padding: 18, borderWidth: 1, borderColor: Colors.line, marginBottom: 4 },
  detailsSection: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.textMuted, letterSpacing: 1.5, marginBottom: 8 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.line },
  rowLabel: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textSub },
  rowValue: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.text },
  detailsTotal: { flexDirection: "row", justifyContent: "space-between", marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: Colors.lineStrong },
  detailsTotalLabel: { fontSize: 13, fontFamily: "Inter_500Medium", color: Colors.textMuted },
  detailsTotalValue: { fontSize: 14, fontFamily: "Inter_700Bold", color: Colors.negative },

  // Tommy CTA
  chatCta: { borderRadius: 14, overflow: "hidden", borderWidth: 1, borderColor: Colors.accentBorder },
  chatCtaGrad: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, paddingVertical: 16 },
  chatCtaText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.text, flex: 1 },

  // Modals shared
  modalOverlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.55)" },
  sheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 22, borderTopRightRadius: 22, paddingHorizontal: 20, paddingTop: 10, borderTopWidth: 1, borderColor: Colors.lineStrong },
  sheetHandle: { width: 36, height: 4, borderRadius: 2, backgroundColor: Colors.lineStrong, alignSelf: "center", marginBottom: 8 },
  sheetTitle: { fontSize: 18, fontFamily: "Inter_700Bold", color: Colors.text, marginBottom: 6 },
  sheetSub: { fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.textMuted, lineHeight: 18, marginBottom: 12 },
  sheetScroll: { maxHeight: 360 },
  sheetActions: { flexDirection: "row", gap: 12, marginTop: 12 },
  cancelBtn: { flex: 1, padding: 14, borderRadius: 14, alignItems: "center", borderWidth: 1, borderColor: Colors.lineStrong },
  cancelText: { fontSize: 15, fontFamily: "Inter_500Medium", color: Colors.textSub },
  createBtn: { flex: 2, padding: 14, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: Colors.accent },
  createText: { fontSize: 15, fontFamily: "Inter_600SemiBold", color: Colors.bg },
  formGroup: { marginBottom: 12 },
  formLabel: { fontSize: 10, fontFamily: "Inter_600SemiBold", color: Colors.textMuted, letterSpacing: 1, marginBottom: 6 },
  formInput: { backgroundColor: Colors.overlay, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, fontFamily: "Inter_400Regular", color: Colors.text, borderWidth: 1, borderColor: Colors.lineMedium },
  fileBtn: { flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 12, marginBottom: 10 },
  fileBtnText: { fontSize: 14, fontFamily: "Inter_600SemiBold", color: Colors.accent },
  importArea: { minHeight: 160, maxHeight: 220, backgroundColor: Colors.overlay, borderRadius: 14, padding: 14, fontSize: 13, fontFamily: "Inter_400Regular", color: Colors.text, borderWidth: 1, borderColor: Colors.lineMedium },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 100, borderWidth: 1, borderColor: Colors.lineStrong, backgroundColor: Colors.overlay },
  chipText: { fontSize: 12, fontFamily: "Inter_500Medium", color: Colors.textSub },
});
