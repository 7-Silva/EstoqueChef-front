import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Croissant } from "lucide-react";
import { useAuth } from "../context/AuthContext";

export default function Cadastro() {
  const { cadastrar, carregando } = useAuth();
  const navegar = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [confirmarSenha, setConfirmarSenha] = useState("");
  const [erro, setErro] = useState("");

  async function aoEnviar(e) {
    e.preventDefault();
    setErro("");

    if (!username || !email || !senha) {
      setErro("Preencha todos os campos.");
      return;
    }
    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmarSenha) {
      setErro("As senhas não são iguais.");
      return;
    }

    try {
      await cadastrar(username, email, senha);
      navegar("/");
    } catch (err) {
      setErro(err.message);
    }
  }

  return (
    <div style={estilos.pagina}>
      <form onSubmit={aoEnviar} style={estilos.card}>
        <div style={estilos.cabecalho}>
          <Croissant size={26} color="var(--accent)" />
          <h1 style={estilos.titulo}>Criar conta</h1>
          <p style={estilos.subtitulo}>Cadastre sua confeitaria para começar.</p>
        </div>

        <label style={estilos.rotulo}>
          Usuário
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="seu-usuario"
            autoComplete="username"
          />
        </label>

        <label style={estilos.rotulo}>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@confeitaria.com"
            autoComplete="email"
          />
        </label>

        <label style={estilos.rotulo}>
          Senha
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
          />
        </label>

        <label style={estilos.rotulo}>
          Confirmar senha
          <input
            type="password"
            value={confirmarSenha}
            onChange={(e) => setConfirmarSenha(e.target.value)}
            placeholder="Repita a senha"
            autoComplete="new-password"
          />
        </label>

        {erro && <p style={estilos.erro}>{erro}</p>}

        <button type="submit" className="btn-primary" disabled={carregando} style={{ width: "100%", marginTop: 8 }}>
          {carregando ? "Criando conta..." : "Criar conta"}
        </button>

        <p style={estilos.rodape}>
          Já tem uma conta? <Link to="/login" style={estilos.link}>Entrar</Link>
        </p>
      </form>
    </div>
  );
}

const estilos = {
  pagina: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: 8,
    padding: 32,
  },
  cabecalho: {
    marginBottom: 24,
  },
  titulo: {
    fontFamily: "var(--font-display)",
    fontWeight: 600,
    fontSize: 26,
    margin: "10px 0 4px",
  },
  subtitulo: {
    color: "var(--text-muted)",
    fontSize: 14,
    margin: 0,
  },
  rotulo: {
    display: "block",
    fontSize: 13,
    color: "var(--text-muted)",
    marginBottom: 14,
  },
  erro: {
    color: "var(--critical)",
    fontSize: 13,
    margin: "0 0 12px",
  },
  rodape: {
    marginTop: 20,
    fontSize: 13,
    color: "var(--text-muted)",
    textAlign: "center",
  },
  link: {
    color: "var(--accent)",
    textDecoration: "none",
    fontWeight: 500,
  },
};
