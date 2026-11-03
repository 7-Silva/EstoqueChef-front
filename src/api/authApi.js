/*
  Este arquivo concentra TODAS as chamadas HTTP relacionadas a autenticação.
  Assim, quando o endpoint mudar, só é preciso mexer aqui — o resto do app
  (páginas, contexto) não precisa saber como a comunicação acontece.

  Backend: EstoqueChef API (FastAPI + OAuth2 + JWT com access e refresh token).
  A renovação do token (POST /refresh_token) fica em http.js.

  --------------------------------------------------------------------
  Contrato esperado do backend:

  POST {API_URL}/token   (login)
    Content-Type: application/x-www-form-urlencoded   <- não é JSON!
    body: username=...&password=...
    resposta 200: { access_token, refresh_token, token_type }
    resposta 401: { detail: "Usuário ou senha incorretos." }

  POST {API_URL}/user/   (cadastro)
    Content-Type: application/json
    body: { username, email, password }
    resposta 201: { username, avatar, bio }
    resposta 409/400: { detail: "mensagem de erro" }

  GET {API_URL}/user/{username}/   (dados do usuário logado)
    header: Authorization: Bearer {access_token}
    resposta 200: { username, avatar, bio }
  --------------------------------------------------------------------
*/

import { API_URL, tratarResposta } from "./http";

// O endpoint /token do FastAPI (OAuth2PasswordRequestForm) espera
// dados de formulário, não JSON — por isso usamos URLSearchParams aqui.
export async function login({ username, password }) {
  const corpo = new URLSearchParams();
  corpo.append("username", username);
  corpo.append("password", password);

  const resposta = await fetch(`${API_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: corpo,
  });
  return tratarResposta(resposta); // { access_token, refresh_token, token_type }
}

export async function cadastrar({ username, email, password }) {
  const resposta = await fetch(`${API_URL}/user/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  return tratarResposta(resposta); // { username, avatar, bio }
}

export async function buscarUsuarioLogado({ username, token }) {
  const resposta = await fetch(`${API_URL}/user/${username}/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return tratarResposta(resposta); // { username, avatar, bio }
}
