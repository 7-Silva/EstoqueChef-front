import React, { useState, useMemo } from "react";
import {
  Plus, Search, Pencil, Trash2, X, AlertTriangle, PackageX, Clock, CheckCircle2,
  LogOut, ArrowUp, ArrowDown, PackagePlus, PackageMinus, Boxes,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useEstoque } from "../hooks/useEstoque";

const UNIDADES = ["kg", "g", "litro", "ml", "unidade", "dúzia", "caixa", "pacote"];
const CATEGORIAS = ["Secos", "Laticínios", "Frutas e legumes", "Confeitaria", "Ovos", "Embalagens", "Bebidas", "Outros"];
const MOTIVOS_SAIDA = ["Uso na produção", "Venda direta", "Perda / vencimento", "Ajuste de estoque", "Outro"];

function hojeISO() {
  return new Date().toISOString().slice(0, 10);
}

function diasParaVencer(validade) {
  if (!validade) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const v = new Date(validade + "T00:00:00");
  return Math.round((v - hoje) / 86400000);
}

function formatarData(data) {
  if (!data) return "—";
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function formatarMoeda(valor) {
  if (valor === null || valor === undefined || valor === "") return "—";
  return Number(valor).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function getFlags(item) {
  const flags = [];
  const dias = diasParaVencer(item.validade);
  if (dias !== null && dias < 0) flags.push("vencido");
  else if (dias !== null && dias <= 3) flags.push("vence_em_breve");
  if (item.quantidade < item.minimo) flags.push("estoque_baixo");
  return flags;
}

function severidade(flags) {
  if (flags.includes("vencido")) return 3;
  if (flags.includes("estoque_baixo") || flags.includes("vence_em_breve")) return 2;
  return 1;
}

const STATUS_META = {
  vencido: { label: "Vencido", color: "var(--critical)" },
  vence_em_breve: { label: "Vence em breve", color: "var(--warning)" },
  estoque_baixo: { label: "Estoque baixo", color: "var(--warning)" },
};

const FILTROS_ESTOQUE = [
  { id: "todos", label: "Todos" },
  { id: "vencido", label: "Vencidos" },
  { id: "vence_em_breve", label: "Vencendo" },
  { id: "estoque_baixo", label: "Estoque baixo" },
];

const FILTROS_ENTRADA = [
  { id: "todas", label: "Todas" },
  { id: "pendente", label: "Pendentes" },
  { id: "recebida", label: "Recebidas" },
];

// Colunas pelas quais dá pra ordenar a tabela de estoque atual.
const COLUNAS_ORDENAVEIS = {
  nome: { label: "Ingrediente", valor: (i) => i.nome.toLowerCase() },
  quantidade: { label: "Quantidade", valor: (i) => i.quantidade },
  minimo: { label: "Mínimo", valor: (i) => i.minimo },
  valor: { label: "Última compra", valor: (i) => (i.ultimaCompra?.valor ?? -Infinity) },
  validade: { label: "Validade", valor: (i) => (i.dias === null ? Infinity : i.dias) },
  severidade: { label: "Status", valor: (i) => i.severidade },
};

function comparar(a, b, campo) {
  const extrair = COLUNAS_ORDENAVEIS[campo].valor;
  const va = extrair(a);
  const vb = extrair(b);
  if (va < vb) return -1;
  if (va > vb) return 1;
  return 0;
}

function formIngredienteVazio() {
  return { nome: "", categoria: CATEGORIAS[0], quantidade: "", unidade: UNIDADES[0], minimo: "", validade: "", semValidade: false, fornecedor: "" };
}

function formEntradaVazio() {
  return { ingredienteId: "", quantidade: "", valor: "", dataCompra: hojeISO(), dataEntrega: hojeISO(), aindaNaoChegou: false, fornecedor: "" };
}

function formSaidaVazio() {
  return { ingredienteId: "", quantidade: "", data: hojeISO(), motivo: MOTIVOS_SAIDA[0], observacao: "" };
}

export default function Estoque() {
  const { usuario, sair } = useAuth();

  // Os dados vêm da API. Quem calcula o saldo é o backend; aqui só exibimos.
  const { ingredientes, entradas, saidas, carregando, erroCarga, acoes } = useEstoque();
  const [salvando, setSalvando] = useState(false);
  const [aviso, setAviso] = useState(""); // erro de ações fora de modal (excluir, receber)

  const [aba, setAba] = useState("estoque"); // "estoque" | "entradas" | "saidas"
  const [busca, setBusca] = useState("");
  const [filtroEstoque, setFiltroEstoque] = useState("todos");
  const [filtroEntrada, setFiltroEntrada] = useState("todas");
  const [ordenacao, setOrdenacao] = useState({ campo: "severidade", direcao: "desc" });

  const [modalTipo, setModalTipo] = useState(null); // null | "ingrediente" | "entrada" | "saida"
  const [editandoId, setEditandoId] = useState(null);
  const [formIngrediente, setFormIngrediente] = useState(formIngredienteVazio());
  const [formEntrada, setFormEntrada] = useState(formEntradaVazio());
  const [formSaida, setFormSaida] = useState(formSaidaVazio());
  const [erro, setErro] = useState("");

  const [confirmacao, setConfirmacao] = useState(null); // { tipo, id } | null

  const dataExtenso = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" });
  const hoje = dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1);

  // Roda uma ação da API. Erro de regra (ex.: "Estoque insuficiente") aparece no
  // modal aberto ou, se não houver modal, no aviso do topo da tela.
  async function tentar(acao, { emModal = false } = {}) {
    if (salvando) return false;
    setSalvando(true);
    setAviso("");
    try {
      await acao();
      return true;
    } catch (err) {
      if (emModal) setErro(err.message);
      else setAviso(err.message);
      return false;
    } finally {
      setSalvando(false);
    }
  }

  function ultimaEntradaRecebida(ingredienteId) {
    return entradas
      .filter((e) => e.ingredienteId === ingredienteId && e.recebido)
      .sort((a, b) => (b.dataEntrega || "").localeCompare(a.dataEntrega || ""))[0];
  }

  const ingredientesEnriquecidos = useMemo(() => {
    return ingredientes.map((item) => {
      const flags = getFlags(item);
      return {
        ...item,
        flags,
        severidade: severidade(flags),
        dias: diasParaVencer(item.validade),
        ultimaCompra: ultimaEntradaRecebida(item.id),
      };
    });
  }, [ingredientes, entradas]);

  const stats = useMemo(() => {
    return {
      total: ingredientesEnriquecidos.length,
      vencidos: ingredientesEnriquecidos.filter((i) => i.flags.includes("vencido")).length,
      vencendo: ingredientesEnriquecidos.filter((i) => i.flags.includes("vence_em_breve")).length,
      baixo: ingredientesEnriquecidos.filter((i) => i.flags.includes("estoque_baixo")).length,
    };
  }, [ingredientesEnriquecidos]);

  const estoqueFiltrado = useMemo(() => {
    let lista = ingredientesEnriquecidos;
    if (filtroEstoque !== "todos") lista = lista.filter((i) => i.flags.includes(filtroEstoque));
    if (busca.trim()) {
      const b = busca.toLowerCase();
      lista = lista.filter((i) => i.nome.toLowerCase().includes(b) || i.categoria.toLowerCase().includes(b));
    }
    return [...lista].sort((a, b) => {
      const resultado = comparar(a, b, ordenacao.campo);
      return ordenacao.direcao === "asc" ? resultado : -resultado;
    });
  }, [ingredientesEnriquecidos, filtroEstoque, busca, ordenacao]);

  const entradasFiltradas = useMemo(() => {
    let lista = entradas;
    if (filtroEntrada !== "todas") {
      lista = lista.filter((e) => (filtroEntrada === "recebida" ? e.recebido : !e.recebido));
    }
    if (busca.trim()) {
      const b = busca.toLowerCase();
      lista = lista.filter((e) => e.ingredienteNome.toLowerCase().includes(b));
    }
    return [...lista].sort((a, b) => (b.dataCompra || "").localeCompare(a.dataCompra || ""));
  }, [entradas, filtroEntrada, busca]);

  const saidasFiltradas = useMemo(() => {
    let lista = saidas;
    if (busca.trim()) {
      const b = busca.toLowerCase();
      lista = lista.filter((s) => s.ingredienteNome.toLowerCase().includes(b) || s.motivo.toLowerCase().includes(b));
    }
    return [...lista].sort((a, b) => (b.data || "").localeCompare(a.data || ""));
  }, [saidas, busca]);

  function alternarOrdenacao(campo) {
    setOrdenacao((atual) => {
      if (atual.campo === campo) return { campo, direcao: atual.direcao === "asc" ? "desc" : "asc" };
      return { campo, direcao: campo === "nome" ? "asc" : "desc" };
    });
  }

  // ---------------------- Ingrediente (estoque) ----------------------

  function abrirNovoIngrediente() {
    setFormIngrediente(formIngredienteVazio());
    setEditandoId(null);
    setErro("");
    setModalTipo("ingrediente");
  }

  function abrirEdicaoIngrediente(item) {
    setFormIngrediente({
      nome: item.nome,
      categoria: item.categoria,
      quantidade: String(item.quantidade),
      unidade: item.unidade,
      minimo: String(item.minimo),
      validade: item.validade || "",
      semValidade: !item.validade,
      fornecedor: item.fornecedor || "",
    });
    setEditandoId(item.id);
    setErro("");
    setModalTipo("ingrediente");
  }

  async function salvarIngrediente() {
    if (!formIngrediente.nome.trim()) return setErro("Informe o nome do ingrediente.");
    // Na edição o saldo não é enviado (só entradas/saídas alteram a quantidade).
    if (!editandoId && (formIngrediente.quantidade === "" || Number(formIngrediente.quantidade) < 0)) return setErro("Informe uma quantidade válida.");
    if (formIngrediente.minimo === "" || Number(formIngrediente.minimo) < 0) return setErro("Informe um estoque mínimo válido.");
    if (!formIngrediente.semValidade && !formIngrediente.validade) return setErro('Informe a validade ou marque "sem validade".');

    const novoItem = {
      nome: formIngrediente.nome.trim(),
      categoria: formIngrediente.categoria,
      quantidade: Number(formIngrediente.quantidade),
      unidade: formIngrediente.unidade,
      minimo: Number(formIngrediente.minimo),
      validade: formIngrediente.semValidade ? null : formIngrediente.validade,
      fornecedor: formIngrediente.fornecedor.trim(),
    };

    const ok = await tentar(
      () => (editandoId ? acoes.atualizarIngrediente(editandoId, novoItem) : acoes.criarIngrediente(novoItem)),
      { emModal: true },
    );
    if (ok) setModalTipo(null);
  }

  async function excluirIngrediente(id) {
    await tentar(() => acoes.excluirIngrediente(id));
    setConfirmacao(null);
  }

  // ---------------------------- Entradas ----------------------------

  function abrirNovaEntrada() {
    setFormEntrada(formEntradaVazio());
    setErro("");
    setModalTipo("entrada");
  }

  async function salvarEntrada() {
    if (!formEntrada.ingredienteId) return setErro("Selecione o ingrediente.");
    if (formEntrada.quantidade === "" || Number(formEntrada.quantidade) <= 0) return setErro("Informe uma quantidade válida.");
    if (formEntrada.valor === "" || Number(formEntrada.valor) < 0) return setErro("Informe o valor pago.");
    if (!formEntrada.dataCompra) return setErro("Informe a data da compra.");
    if (!formEntrada.aindaNaoChegou && !formEntrada.dataEntrega) return setErro('Informe a data de entrega ou marque "ainda não chegou".');

    const novaEntrada = {
      ingredienteId: Number(formEntrada.ingredienteId),
      quantidade: Number(formEntrada.quantidade),
      valor: Number(formEntrada.valor),
      dataCompra: formEntrada.dataCompra,
      dataEntrega: formEntrada.aindaNaoChegou ? null : formEntrada.dataEntrega,
      fornecedor: formEntrada.fornecedor.trim(),
    };

    // Entrada recebida soma ao estoque; pendente só fica registrada. O backend decide.
    const ok = await tentar(() => acoes.criarEntrada(novaEntrada), { emModal: true });
    if (ok) setModalTipo(null);
  }

  function marcarComoRecebida(entradaId) {
    return tentar(() => acoes.receberEntrada(entradaId));
  }

  async function excluirEntrada(id) {
    await tentar(() => acoes.excluirEntrada(id));
    setConfirmacao(null);
  }

  // ----------------------------- Saídas ------------------------------

  function abrirNovaSaida() {
    setFormSaida(formSaidaVazio());
    setErro("");
    setModalTipo("saida");
  }

  async function salvarSaida() {
    if (!formSaida.ingredienteId) return setErro("Selecione o ingrediente.");
    if (formSaida.quantidade === "" || Number(formSaida.quantidade) <= 0) return setErro("Informe uma quantidade válida.");
    if (!formSaida.data) return setErro("Informe a data da saída.");

    const ingrediente = ingredientes.find((i) => i.id === Number(formSaida.ingredienteId));
    const quantidade = Number(formSaida.quantidade);

    // Checagem rápida para dar feedback sem ir ao servidor. A regra de verdade
    // está no backend (que responde 409 se o saldo não bastar).
    if (quantidade > ingrediente.quantidade) {
      return setErro(`Estoque insuficiente. Disponível: ${ingrediente.quantidade} ${ingrediente.unidade}.`);
    }

    const ok = await tentar(
      () => acoes.criarSaida({
        ingredienteId: ingrediente.id,
        quantidade,
        data: formSaida.data,
        motivo: formSaida.motivo,
        observacao: formSaida.observacao.trim(),
      }),
      { emModal: true },
    );
    if (ok) setModalTipo(null);
  }

  async function excluirSaida(id) {
    await tentar(() => acoes.excluirSaida(id));
    setConfirmacao(null);
  }

  function aoClicarAdicionar() {
    if (aba === "estoque") abrirNovoIngrediente();
    else if (aba === "entradas") abrirNovaEntrada();
    else abrirNovaSaida();
  }

  const TEXTO_BOTAO_ADICIONAR = { estoque: "Adicionar ingrediente", entradas: "Registrar entrada", saidas: "Registrar saída" };
  const PLACEHOLDER_BUSCA = { estoque: "Buscar ingrediente ou categoria", entradas: "Buscar por ingrediente", saidas: "Buscar por ingrediente ou motivo" };

  if (carregando) {
    return <p style={{ padding: 40, color: "var(--text-muted)" }}>Carregando estoque…</p>;
  }
  if (erroCarga) {
    return (
      <div style={{ padding: 40 }}>
        <p style={{ color: "var(--critical)" }}>Não foi possível carregar o estoque: {erroCarga}</p>
        <button onClick={() => window.location.reload()} className="btn-secondary">Tentar de novo</button>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <div style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 24px 80px" }}>
        {/* Cabeçalho */}
        <header style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end", flexWrap: "wrap", gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 13, color: "var(--text-muted)" }}>
              {hoje} · {usuario?.username}
            </p>
            <h1 style={{ margin: "4px 0 0", fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 34, letterSpacing: "-0.01em" }}>
              Estoque da confeitaria
            </h1>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={aoClicarAdicionar} className="btn-primary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Plus size={17} /> {TEXTO_BOTAO_ADICIONAR[aba]}
            </button>
            <button onClick={sair} className="btn-secondary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <LogOut size={16} /> Sair
            </button>
          </div>
        </header>

        {aviso && (
          <div role="alert" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, marginBottom: 16, padding: "10px 14px", border: "1px solid var(--critical)", borderRadius: 4, color: "var(--critical)", fontSize: 13.5 }}>
            <span>{aviso}</span>
            <button className="icon-btn" onClick={() => setAviso("")} aria-label="Fechar aviso"><X size={15} /></button>
          </div>
        )}

        {/* Abas */}
        <div style={{ display: "flex", gap: 6, marginBottom: 24, borderBottom: "1px solid var(--border)" }}>
          <Aba id="estoque" atual={aba} onClick={setAba} icon={<Boxes size={15} />} label="Estoque atual" />
          <Aba id="entradas" atual={aba} onClick={setAba} icon={<PackagePlus size={15} />} label="Entradas" contagem={entradas.filter((e) => !e.recebido).length} />
          <Aba id="saidas" atual={aba} onClick={setAba} icon={<PackageMinus size={15} />} label="Saídas" />
        </div>

        {/* Stats (só na aba de estoque) */}
        {aba === "estoque" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
            <StatCard icon={<PackageX size={17} />} label="Itens no estoque" value={stats.total} color="var(--text)" />
            <StatCard icon={<AlertTriangle size={17} />} label="Vencidos" value={stats.vencidos} color="var(--critical)" />
            <StatCard icon={<Clock size={17} />} label="Vencendo em breve" value={stats.vencendo} color="var(--warning)" />
            <StatCard icon={<PackageX size={17} />} label="Estoque baixo" value={stats.baixo} color="var(--warning)" />
          </div>
        )}

        {/* Busca e filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 18, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ position: "relative", flex: "1 1 220px" }}>
            <Search size={15} style={{ position: "absolute", left: 10, top: 11, color: "var(--text-muted)" }} />
            <input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder={PLACEHOLDER_BUSCA[aba]} style={{ paddingLeft: 32, marginTop: 0 }} />
          </div>
          {aba === "estoque" && (
            <FiltroChips opcoes={FILTROS_ESTOQUE} ativo={filtroEstoque} onClick={setFiltroEstoque} />
          )}
          {aba === "entradas" && (
            <FiltroChips opcoes={FILTROS_ENTRADA} ativo={filtroEntrada} onClick={setFiltroEntrada} />
          )}
        </div>

        {/* -------------------- Tabela: Estoque atual -------------------- */}
        {aba === "estoque" && (
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.7fr 0.9fr 0.9fr 1.1fr 1fr 1.2fr 70px", padding: "0 16px 8px", fontSize: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", minWidth: 820 }}>
              <CabecalhoOrdenavel campo="nome" label="Ingrediente" ordenacao={ordenacao} onClick={alternarOrdenacao} />
              <CabecalhoOrdenavel campo="quantidade" label="Quantidade" ordenacao={ordenacao} onClick={alternarOrdenacao} />
              <CabecalhoOrdenavel campo="minimo" label="Mínimo" ordenacao={ordenacao} onClick={alternarOrdenacao} />
              <CabecalhoOrdenavel campo="valor" label="Última compra" ordenacao={ordenacao} onClick={alternarOrdenacao} />
              <CabecalhoOrdenavel campo="validade" label="Validade" ordenacao={ordenacao} onClick={alternarOrdenacao} />
              <CabecalhoOrdenavel campo="severidade" label="Status" ordenacao={ordenacao} onClick={alternarOrdenacao} />
              <span></span>
            </div>

            {estoqueFiltrado.length === 0 && <VazioAviso texto="Nenhum ingrediente encontrado com esses filtros." />}

            {estoqueFiltrado.map((item) => {
              const corBarra = item.flags.includes("vencido") ? "var(--critical)" : item.flags.length ? "var(--warning)" : "var(--good)";
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--border)", minWidth: 820 }}>
                  <div style={{ width: 4, background: corBarra, flexShrink: 0 }} />
                  <div style={{ display: "grid", gridTemplateColumns: "1.7fr 0.9fr 0.9fr 1.1fr 1fr 1.2fr 70px", alignItems: "center", padding: "14px 16px", flex: 1, gap: 8 }}>
                    <div>
                      <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 16 }}>{item.nome}</p>
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{item.categoria}</p>
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>{item.quantidade} {item.unidade}</span>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--text-muted)" }}>{item.minimo} {item.unidade}</span>
                    <div>
                      <span style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>{formatarMoeda(item.ultimaCompra?.valor)}</span>
                      {item.ultimaCompra && (
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "var(--text-muted)" }}>em {formatarData(item.ultimaCompra.dataEntrega)}</p>
                      )}
                    </div>
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: item.flags.includes("vencido") || item.flags.includes("vence_em_breve") ? "var(--warning)" : "var(--text-muted)" }}>
                      {formatarData(item.validade)}
                    </span>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {item.flags.length === 0 && <Badge color="var(--good)" icon={<CheckCircle2 size={12} />} label="Em dia" />}
                      {item.flags.map((f) => <Badge key={f} color={STATUS_META[f].color} label={STATUS_META[f].label} />)}
                    </div>
                    <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                      <button className="icon-btn" onClick={() => abrirEdicaoIngrediente(item)} aria-label="Editar"><Pencil size={15} /></button>
                      <button className="icon-btn" onClick={() => setConfirmacao({ tipo: "ingrediente", id: item.id })} aria-label="Excluir"><Trash2 size={15} /></button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* ---------------------- Tabela: Entradas ---------------------- */}
        {aba === "entradas" && (
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1fr 90px", padding: "0 16px 8px", fontSize: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", minWidth: 820 }}>
              <span>Ingrediente</span>
              <span>Quantidade</span>
              <span>Valor</span>
              <span>Compra</span>
              <span>Entrega</span>
              <span>Status</span>
              <span></span>
            </div>

            {entradasFiltradas.length === 0 && <VazioAviso texto="Nenhuma entrada registrada ainda." />}

            {entradasFiltradas.map((entrada) => (
              <div key={entrada.id} style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--border)", minWidth: 820 }}>
                <div style={{ width: 4, background: entrada.recebido ? "var(--good)" : "var(--warning)", flexShrink: 0 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1fr 1fr 1fr 90px", alignItems: "center", padding: "14px 16px", flex: 1, gap: 8 }}>
                  <div>
                    <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 16 }}>{entrada.ingredienteNome}</p>
                    {entrada.fornecedor && <p style={{ margin: "2px 0 0", fontSize: 12, color: "var(--text-muted)" }}>{entrada.fornecedor}</p>}
                  </div>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>{entrada.quantidade} {entrada.unidade}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>{formatarMoeda(entrada.valor)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>{formatarData(entrada.dataCompra)}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>{entrada.dataEntrega ? formatarData(entrada.dataEntrega) : "—"}</span>
                  <div>
                    {entrada.recebido
                      ? <Badge color="var(--good)" icon={<CheckCircle2 size={12} />} label="Recebida" />
                      : <Badge color="var(--warning)" icon={<Clock size={12} />} label="Pendente" />}
                  </div>
                  <div style={{ display: "flex", gap: 2, justifyContent: "flex-end" }}>
                    {!entrada.recebido && (
                      <button className="icon-btn" onClick={() => marcarComoRecebida(entrada.id)} aria-label="Marcar como recebida" title="Marcar como recebida">
                        <CheckCircle2 size={15} />
                      </button>
                    )}
                    <button className="icon-btn" onClick={() => setConfirmacao({ tipo: "entrada", id: entrada.id })} aria-label="Excluir"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ----------------------- Tabela: Saídas ------------------------ */}
        {aba === "saidas" && (
          <div style={{ overflowX: "auto" }}>
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1.3fr 1.3fr 70px", padding: "0 16px 8px", fontSize: 12, color: "var(--text-muted)", borderBottom: "1px solid var(--border)", minWidth: 780 }}>
              <span>Ingrediente</span>
              <span>Quantidade</span>
              <span>Data</span>
              <span>Motivo</span>
              <span>Observação</span>
              <span></span>
            </div>

            {saidasFiltradas.length === 0 && <VazioAviso texto="Nenhuma saída registrada ainda." />}

            {saidasFiltradas.map((saida) => (
              <div key={saida.id} style={{ display: "flex", alignItems: "stretch", borderBottom: "1px solid var(--border)", minWidth: 780 }}>
                <div style={{ width: 4, background: "var(--critical)", flexShrink: 0 }} />
                <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr 1fr 1.3fr 1.3fr 70px", alignItems: "center", padding: "14px 16px", flex: 1, gap: 8 }}>
                  <p style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 16 }}>{saida.ingredienteNome}</p>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 14 }}>{saida.quantidade} {saida.unidade}</span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: 13, color: "var(--text-muted)" }}>{formatarData(saida.data)}</span>
                  <span style={{ fontSize: 13 }}>{saida.motivo}</span>
                  <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{saida.observacao || "—"}</span>
                  <div style={{ display: "flex", justifyContent: "flex-end" }}>
                    <button className="icon-btn" onClick={() => setConfirmacao({ tipo: "saida", id: saida.id })} aria-label="Excluir"><Trash2 size={15} /></button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmação de exclusão (genérica para os 3 tipos) */}
      {confirmacao && (
        <div style={estilosModal.fundo}>
          <div style={estilosModal.card}>
            <p style={{ margin: "0 0 6px", fontFamily: "var(--font-display)", fontSize: 18, fontWeight: 600 }}>
              {confirmacao.tipo === "ingrediente" && "Excluir ingrediente?"}
              {confirmacao.tipo === "entrada" && "Excluir esta entrada?"}
              {confirmacao.tipo === "saida" && "Excluir esta saída?"}
            </p>
            <p style={{ margin: "0 0 20px", fontSize: 14, color: "var(--text-muted)" }}>
              {confirmacao.tipo === "entrada" && "Se ela já foi recebida, a quantidade será removida do estoque atual (não é possível se parte dela já foi usada em saídas)."}
              {confirmacao.tipo === "saida" && "A quantidade retirada será devolvida ao estoque atual."}
              {confirmacao.tipo === "ingrediente" && "Isso também apaga o histórico de entradas e saídas deste ingrediente. Não pode ser desfeito."}
            </p>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button onClick={() => setConfirmacao(null)} className="btn-secondary">Cancelar</button>
              <button
                onClick={() => {
                  if (confirmacao.tipo === "ingrediente") excluirIngrediente(confirmacao.id);
                  if (confirmacao.tipo === "entrada") excluirEntrada(confirmacao.id);
                  if (confirmacao.tipo === "saida") excluirSaida(confirmacao.id);
                }}
                style={{ background: "var(--critical)", border: "none", color: "#fff", padding: "8px 14px", borderRadius: 4, fontSize: 13, fontWeight: 500 }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: novo/editar ingrediente */}
      {modalTipo === "ingrediente" && (
        <div style={estilosModal.fundo}>
          <div style={estilosModal.cardGrande}>
            <CabecalhoModal titulo={editandoId ? "Editar ingrediente" : "Novo ingrediente"} onFechar={() => setModalTipo(null)} />

            <Field label="Nome do ingrediente">
              <input value={formIngrediente.nome} onChange={(e) => setFormIngrediente({ ...formIngrediente, nome: e.target.value })} placeholder="Ex: Farinha de trigo" />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Categoria">
                <select value={formIngrediente.categoria} onChange={(e) => setFormIngrediente({ ...formIngrediente, categoria: e.target.value })}>
                  {CATEGORIAS.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </Field>
              <Field label="Fornecedor (opcional)">
                <input value={formIngrediente.fornecedor} onChange={(e) => setFormIngrediente({ ...formIngrediente, fornecedor: e.target.value })} placeholder="Ex: Moinho Bela Vista" />
              </Field>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
              <Field label={editandoId ? "Quantidade atual (via entradas/saídas)" : "Quantidade inicial"}>
                <input type="number" min="0" step="0.1" disabled={Boolean(editandoId)} value={formIngrediente.quantidade} onChange={(e) => setFormIngrediente({ ...formIngrediente, quantidade: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Estoque mínimo">
                <input type="number" min="0" step="0.1" value={formIngrediente.minimo} onChange={(e) => setFormIngrediente({ ...formIngrediente, minimo: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Unidade">
                <select value={formIngrediente.unidade} onChange={(e) => setFormIngrediente({ ...formIngrediente, unidade: e.target.value })}>
                  {UNIDADES.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </Field>
            </div>

            <Field label="Validade">
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <input type="date" disabled={formIngrediente.semValidade} value={formIngrediente.validade} onChange={(e) => setFormIngrediente({ ...formIngrediente, validade: e.target.value })} style={{ flex: 1 }} />
                <label style={estilosModal.checkboxLabel}>
                  <input type="checkbox" checked={formIngrediente.semValidade} onChange={(e) => setFormIngrediente({ ...formIngrediente, semValidade: e.target.checked, validade: "" })} style={estilosModal.checkbox} />
                  Sem validade
                </label>
              </div>
            </Field>

            {erro && <MensagemErro texto={erro} />}

            <BotoesModal onCancelar={() => setModalTipo(null)} onSalvar={salvarIngrediente} textoSalvar={editandoId ? "Salvar alterações" : "Adicionar ingrediente"} />
          </div>
        </div>
      )}

      {/* Modal: nova entrada */}
      {modalTipo === "entrada" && (
        <div style={estilosModal.fundo}>
          <div style={estilosModal.cardGrande}>
            <CabecalhoModal titulo="Registrar entrada" onFechar={() => setModalTipo(null)} />

            <Field label="Ingrediente">
              <select value={formEntrada.ingredienteId} onChange={(e) => setFormEntrada({ ...formEntrada, ingredienteId: e.target.value })}>
                <option value="">Selecione...</option>
                {ingredientes.map((i) => <option key={i.id} value={i.id}>{i.nome}</option>)}
              </select>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Quantidade">
                <input type="number" min="0" step="0.1" value={formEntrada.quantidade} onChange={(e) => setFormEntrada({ ...formEntrada, quantidade: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Valor pago (R$)">
                <input type="number" min="0" step="0.01" value={formEntrada.valor} onChange={(e) => setFormEntrada({ ...formEntrada, valor: e.target.value })} placeholder="0,00" />
              </Field>
            </div>

            <Field label="Fornecedor (opcional)">
              <input value={formEntrada.fornecedor} onChange={(e) => setFormEntrada({ ...formEntrada, fornecedor: e.target.value })} placeholder="Deixe em branco para usar o do ingrediente" />
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Data da compra">
                <input type="date" value={formEntrada.dataCompra} onChange={(e) => setFormEntrada({ ...formEntrada, dataCompra: e.target.value })} />
              </Field>
              <Field label="Data de entrega">
                <input type="date" disabled={formEntrada.aindaNaoChegou} value={formEntrada.dataEntrega} onChange={(e) => setFormEntrada({ ...formEntrada, dataEntrega: e.target.value })} />
              </Field>
            </div>

            <label style={{ ...estilosModal.checkboxLabel, marginBottom: 14 }}>
              <input type="checkbox" checked={formEntrada.aindaNaoChegou} onChange={(e) => setFormEntrada({ ...formEntrada, aindaNaoChegou: e.target.checked })} style={estilosModal.checkbox} />
              Ainda não chegou (fica como pedido pendente, sem somar ao estoque)
            </label>

            {erro && <MensagemErro texto={erro} />}

            <BotoesModal onCancelar={() => setModalTipo(null)} onSalvar={salvarEntrada} textoSalvar="Registrar entrada" />
          </div>
        </div>
      )}

      {/* Modal: nova saída */}
      {modalTipo === "saida" && (
        <div style={estilosModal.fundo}>
          <div style={estilosModal.cardGrande}>
            <CabecalhoModal titulo="Registrar saída" onFechar={() => setModalTipo(null)} />

            <Field label="Ingrediente">
              <select value={formSaida.ingredienteId} onChange={(e) => setFormSaida({ ...formSaida, ingredienteId: e.target.value })}>
                <option value="">Selecione...</option>
                {ingredientes.map((i) => <option key={i.id} value={i.id}>{i.nome} (disponível: {i.quantidade} {i.unidade})</option>)}
              </select>
            </Field>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              <Field label="Quantidade">
                <input type="number" min="0" step="0.1" value={formSaida.quantidade} onChange={(e) => setFormSaida({ ...formSaida, quantidade: e.target.value })} placeholder="0" />
              </Field>
              <Field label="Data">
                <input type="date" value={formSaida.data} onChange={(e) => setFormSaida({ ...formSaida, data: e.target.value })} />
              </Field>
            </div>

            <Field label="Motivo">
              <select value={formSaida.motivo} onChange={(e) => setFormSaida({ ...formSaida, motivo: e.target.value })}>
                {MOTIVOS_SAIDA.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </Field>

            <Field label="Observação (opcional)">
              <input value={formSaida.observacao} onChange={(e) => setFormSaida({ ...formSaida, observacao: e.target.value })} placeholder="Ex: lote de bolos do fim de semana" />
            </Field>

            {erro && <MensagemErro texto={erro} />}

            <BotoesModal onCancelar={() => setModalTipo(null)} onSalvar={salvarSaida} textoSalvar="Registrar saída" />
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------
// Componentes auxiliares
// ---------------------------------------------------------------------

const estilosModal = {
  fundo: { position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, zIndex: 50 },
  card: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 24, maxWidth: 360 },
  cardGrande: { background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: 28, width: "100%", maxWidth: 460, maxHeight: "88vh", overflowY: "auto" },
  checkboxLabel: { display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", whiteSpace: "nowrap" },
  checkbox: { width: 14, height: 14, padding: 0, margin: 0 },
};

function Aba({ id, atual, onClick, icon, label, contagem }) {
  const ativo = atual === id;
  return (
    <button
      onClick={() => onClick(id)}
      style={{
        display: "flex", alignItems: "center", gap: 6, background: "transparent", border: "none",
        borderBottom: ativo ? "2px solid var(--accent)" : "2px solid transparent",
        color: ativo ? "var(--text)" : "var(--text-muted)", padding: "10px 4px", marginBottom: -1,
        fontSize: 14, fontWeight: ativo ? 600 : 500,
      }}
    >
      {icon} {label}
      {Boolean(contagem) && (
        <span style={{ background: "var(--warning)", color: "var(--accent-text)", fontSize: 11, fontWeight: 600, borderRadius: 10, padding: "1px 7px" }}>
          {contagem}
        </span>
      )}
    </button>
  );
}

function FiltroChips({ opcoes, ativo, onClick }) {
  return (
    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
      {opcoes.map((f) => (
        <button
          key={f.id}
          onClick={() => onClick(f.id)}
          style={{
            background: ativo === f.id ? "var(--accent)" : "var(--surface)",
            color: ativo === f.id ? "var(--accent-text)" : "var(--text-muted)",
            border: `1px solid ${ativo === f.id ? "var(--accent)" : "var(--border)"}`,
            padding: "7px 13px", borderRadius: 4, fontSize: 13, fontWeight: 500,
          }}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function VazioAviso({ texto }) {
  return <div style={{ padding: "48px 16px", textAlign: "center", color: "var(--text-muted)" }}>{texto}</div>;
}

function CabecalhoModal({ titulo, onFechar }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
      <p style={{ margin: 0, fontFamily: "var(--font-display)", fontSize: 20, fontWeight: 600 }}>{titulo}</p>
      <button className="icon-btn" onClick={onFechar} aria-label="Fechar"><X size={18} /></button>
    </div>
  );
}

function MensagemErro({ texto }) {
  return <p style={{ margin: "4px 0 12px", fontSize: 13, color: "var(--critical)" }}>{texto}</p>;
}

function BotoesModal({ onCancelar, onSalvar, textoSalvar }) {
  return (
    <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 20 }}>
      <button onClick={onCancelar} className="btn-secondary">Cancelar</button>
      <button onClick={onSalvar} className="btn-primary">{textoSalvar}</button>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, padding: "16px 18px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 13, marginBottom: 8 }}>{icon} {label}</div>
      <p style={{ margin: 0, fontFamily: "var(--font-mono)", fontSize: 26, fontWeight: 500, color }}>{value}</p>
    </div>
  );
}

function Badge({ color, label, icon }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, width: "fit-content", fontSize: 11.5, fontWeight: 500, color, border: `1px solid ${color}`, padding: "2px 8px", borderRadius: 3 }}>
      {icon} {label}
    </span>
  );
}

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: "block", fontSize: 12.5, color: "var(--text-muted)", marginBottom: 5 }}>{label}</label>
      {children}
    </div>
  );
}

function CabecalhoOrdenavel({ campo, label, ordenacao, onClick }) {
  const ativo = ordenacao.campo === campo;
  return (
    <button
      onClick={() => onClick(campo)}
      style={{
        display: "flex", alignItems: "center", gap: 4, background: "transparent", border: "none",
        padding: 0, fontSize: 12, fontFamily: "var(--font-body)",
        color: ativo ? "var(--text)" : "var(--text-muted)", fontWeight: ativo ? 600 : 400,
        textAlign: "left",
      }}
    >
      {label}
      {ativo && (ordenacao.direcao === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
    </button>
  );
}
