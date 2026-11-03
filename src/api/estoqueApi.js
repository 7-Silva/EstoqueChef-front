/*
  Chamadas da API de estoque (ingredientes, entradas, saídas).

  A API fala snake_case (ingrediente_id, data_compra); o app usa camelCase
  (ingredienteId, dataCompra). A conversão fica toda aqui, nos "mapear*" e nos
  corpos enviados, para as telas não precisarem saber disso.
*/
import { requisitar } from "./http";

const mapearIngrediente = (i) => ({
  id: i.id,
  nome: i.nome,
  categoria: i.categoria,
  quantidade: i.quantidade,
  unidade: i.unidade,
  minimo: i.minimo,
  validade: i.validade,
  fornecedor: i.fornecedor,
});

const mapearEntrada = (e) => ({
  id: e.id,
  ingredienteId: e.ingrediente_id,
  ingredienteNome: e.ingrediente_nome,
  unidade: e.unidade,
  quantidade: e.quantidade,
  valor: e.valor,
  dataCompra: e.data_compra,
  dataEntrega: e.data_entrega,
  fornecedor: e.fornecedor,
  recebido: e.recebido,
});

const mapearSaida = (s) => ({
  id: s.id,
  ingredienteId: s.ingrediente_id,
  ingredienteNome: s.ingrediente_nome,
  unidade: s.unidade,
  quantidade: s.quantidade,
  data: s.data,
  motivo: s.motivo,
  observacao: s.observacao,
});

// ------------------------------ Ingredientes ------------------------------

export const listarIngredientes = async () =>
  (await requisitar("/ingredientes/")).map(mapearIngrediente);

export const criarIngrediente = (d) =>
  requisitar("/ingredientes/", {
    metodo: "POST",
    corpo: {
      nome: d.nome, categoria: d.categoria, unidade: d.unidade, minimo: d.minimo,
      validade: d.validade, fornecedor: d.fornecedor,
      quantidade: d.quantidade, // saldo inicial: só existe na criação
    },
  });

// Sem "quantidade" de propósito: o saldo só muda por entradas e saídas.
export const atualizarIngrediente = (id, d) =>
  requisitar(`/ingredientes/${id}`, {
    metodo: "PUT",
    corpo: {
      nome: d.nome, categoria: d.categoria, unidade: d.unidade, minimo: d.minimo,
      validade: d.validade, fornecedor: d.fornecedor,
    },
  });

export const excluirIngrediente = (id) => requisitar(`/ingredientes/${id}`, { metodo: "DELETE" });

// -------------------------------- Entradas --------------------------------

export const listarEntradas = async () => (await requisitar("/entradas/")).map(mapearEntrada);

export const criarEntrada = (d) =>
  requisitar("/entradas/", {
    metodo: "POST",
    corpo: {
      ingrediente_id: d.ingredienteId,
      quantidade: d.quantidade,
      valor: d.valor,
      data_compra: d.dataCompra,
      data_entrega: d.dataEntrega, // null = pedido ainda não chegou
      fornecedor: d.fornecedor,
    },
  });

export const receberEntrada = (id) => requisitar(`/entradas/${id}/receber`, { metodo: "POST" });
export const excluirEntrada = (id) => requisitar(`/entradas/${id}`, { metodo: "DELETE" });

// --------------------------------- Saídas ---------------------------------

export const listarSaidas = async () => (await requisitar("/saidas/")).map(mapearSaida);

export const criarSaida = (d) =>
  requisitar("/saidas/", {
    metodo: "POST",
    corpo: {
      ingrediente_id: d.ingredienteId,
      quantidade: d.quantidade,
      data: d.data,
      motivo: d.motivo,
      observacao: d.observacao,
    },
  });

export const excluirSaida = (id) => requisitar(`/saidas/${id}`, { metodo: "DELETE" });
