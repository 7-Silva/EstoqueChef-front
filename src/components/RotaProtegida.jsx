import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/*
  Envolve páginas que exigem login.
  Se não houver usuário logado, redireciona para /login.

  Uso no App.jsx:
  <Route path="/" element={<RotaProtegida><Estoque /></RotaProtegida>} />
*/
export default function RotaProtegida({ children }) {
  const { estaLogado } = useAuth();

  if (!estaLogado) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
