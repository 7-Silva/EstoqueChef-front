import React, { createContext, useContext, useEffect, useState } from "react";
import * as authApi from "../api/authApi";

/*
  AuthContext guarda o estado de "quem está logado" e deixa esse estado
  disponível para qualquer página do app, sem precisar passar props manualmente.

  Guardamos o token no localStorage para que o usuário continue logado
  mesmo se recarregar a página ou fechar e abrir o navegador de novo.

  Fluxo (backend EstoqueChef, FastAPI/OAuth2):
  1. entrar(username, senha) -> POST /token -> recebe access_token + refresh_token
  2. com o access_token, busca os dados do usuário em GET /user/{username}/
  3. cadastrar(...) -> POST /user/ (não devolve token) -> em seguida chama
     entrar() automaticamente, pra já deixar a pessoa logada após criar a conta
*/

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(() => {
    const salvo = localStorage.getItem("usuario");
    return salvo ? JSON.parse(salvo) : null;
  });
  const [token, setToken] = useState(() => localStorage.getItem("access_token"));
  const [carregando, setCarregando] = useState(false);

  function salvarSessao({ usuario, accessToken, refreshToken }) {
    setUsuario(usuario);
    setToken(accessToken);
    localStorage.setItem("usuario", JSON.stringify(usuario));
    localStorage.setItem("access_token", accessToken);
    if (refreshToken) localStorage.setItem("refresh_token", refreshToken);
  }

  async function entrar(username, senha) {
    setCarregando(true);
    try {
      const { access_token, refresh_token } = await authApi.login({ username, password: senha });
      const usuarioLogado = await authApi.buscarUsuarioLogado({ username, token: access_token });
      salvarSessao({ usuario: usuarioLogado, accessToken: access_token, refreshToken: refresh_token });
    } finally {
      setCarregando(false);
    }
  }

  async function cadastrar(username, email, senha) {
    setCarregando(true);
    try {
      await authApi.cadastrar({ username, email, password: senha });
      // o endpoint de cadastro não devolve token, então logamos em seguida
      await entrar(username, senha);
    } finally {
      setCarregando(false);
    }
  }

  function sair() {
    setUsuario(null);
    setToken(null);
    localStorage.removeItem("usuario");
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
  }

  // http.js dispara este evento quando nem o refresh token consegue renovar a sessão.
  useEffect(() => {
    window.addEventListener("auth:expirou", sair);
    return () => window.removeEventListener("auth:expirou", sair);
  }, []);

  const valor = {
    usuario,
    token,
    carregando,
    estaLogado: Boolean(token),
    entrar,
    cadastrar,
    sair,
  };

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

// Hook customizado para usar o contexto de qualquer componente:
// const { usuario, entrar, sair } = useAuth();
export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth precisa ser usado dentro de um <AuthProvider>");
  }
  return contexto;
}
