/*
  Cliente HTTP único do app. Tudo que precisa de login passa por `requisitar`,
  que cuida de três coisas para o resto do código não precisar saber delas:

  1. Enviar o header Authorization com o access token salvo no localStorage.
  2. Se a API responder 401 (token expirou), tentar renovar UMA vez com o
     refresh token e repetir a requisição original.
  3. Se a renovação falhar, avisar o app (evento "auth:expirou") para deslogar.
*/

export const API_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

// FastAPI devolve erro de regra como { detail: "texto" } e erro de validação (422)
// como { detail: [{ msg, loc, ... }] }. Aqui viram sempre uma frase legível.
function mensagemDeErro(dados) {
  const detalhe = dados?.detail;
  if (typeof detalhe === "string") return detalhe;
  if (Array.isArray(detalhe) && detalhe.length) {
    return detalhe.map((d) => d.msg).join(" · ");
  }
  return dados?.mensagem || "Não foi possível completar a solicitação.";
}

export async function tratarResposta(resposta) {
  if (resposta.status === 204) return null;
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) throw new Error(mensagemDeErro(dados));
  return dados;
}

// Várias requisições podem receber 401 ao mesmo tempo: todas esperam a mesma renovação.
let renovacaoEmAndamento = null;

async function renovarTokens() {
  const refresh = localStorage.getItem("refresh_token");
  if (!refresh) return false;
  if (!renovacaoEmAndamento) {
    renovacaoEmAndamento = fetch(`${API_URL}/refresh_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    })
      .then(async (r) => {
        if (!r.ok) return false;
        const t = await r.json();
        localStorage.setItem("access_token", t.access_token);
        localStorage.setItem("refresh_token", t.refresh_token);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        renovacaoEmAndamento = null;
      });
  }
  return renovacaoEmAndamento;
}

function enviar(caminho, { metodo, corpo }) {
  const headers = { Authorization: `Bearer ${localStorage.getItem("access_token")}` };
  if (corpo !== undefined) headers["Content-Type"] = "application/json";
  return fetch(`${API_URL}${caminho}`, {
    method: metodo,
    headers,
    body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
  });
}

export async function requisitar(caminho, { metodo = "GET", corpo } = {}) {
  let resposta = await enviar(caminho, { metodo, corpo });

  if (resposta.status === 401 && (await renovarTokens())) {
    resposta = await enviar(caminho, { metodo, corpo });
  }
  if (resposta.status === 401) {
    window.dispatchEvent(new Event("auth:expirou"));
    throw new Error("Sua sessão expirou. Entre novamente.");
  }
  return tratarResposta(resposta);
}
