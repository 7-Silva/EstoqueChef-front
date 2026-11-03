import { useCallback, useEffect, useState } from "react";
import * as api from "../api/estoqueApi";

/*
  Carrega ingredientes, entradas e saídas da API e expõe as ações.

  Depois de qualquer mudança, recarregamos as três listas. É mais simples (e mais
  correto) do que recalcular o saldo no front: quem dita a quantidade em estoque
  é o backend, então o que aparece na tela sempre bate com o banco.
*/
export function useEstoque() {
  const [ingredientes, setIngredientes] = useState([]);
  const [entradas, setEntradas] = useState([]);
  const [saidas, setSaidas] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarga, setErroCarga] = useState("");

  const recarregar = useCallback(async () => {
    const [ing, ent, sai] = await Promise.all([api.listarIngredientes(), api.listarEntradas(), api.listarSaidas()]);
    setIngredientes(ing);
    setEntradas(ent);
    setSaidas(sai);
  }, []);

  useEffect(() => {
    recarregar()
      .catch((err) => setErroCarga(err.message))
      .finally(() => setCarregando(false));
  }, [recarregar]);

  // Executa uma chamada de escrita e, se deu certo, atualiza as listas.
  // Se falhar (ex.: 409 estoque insuficiente), o erro sobe para a tela mostrar.
  const e = (chamada) => async (...args) => {
    await chamada(...args);
    await recarregar();
  };

  const acoes = {
    criarIngrediente: e(api.criarIngrediente),
    atualizarIngrediente: e(api.atualizarIngrediente),
    excluirIngrediente: e(api.excluirIngrediente),
    criarEntrada: e(api.criarEntrada),
    receberEntrada: e(api.receberEntrada),
    excluirEntrada: e(api.excluirEntrada),
    criarSaida: e(api.criarSaida),
    excluirSaida: e(api.excluirSaida),
  };

  return { ingredientes, entradas, saidas, carregando, erroCarga, acoes };
}
