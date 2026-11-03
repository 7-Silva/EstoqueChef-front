import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import RotaProtegida from "./components/RotaProtegida";
import Login from "./pages/Login";
import Cadastro from "./pages/Cadastro";
import Estoque from "./pages/Estoque";

/*
  Aqui ficam todas as rotas (páginas) do sistema.
  - /login e /cadastro são públicas.
  - / (o estoque) é protegida: só abre se o usuário estiver logado,
    graças ao componente RotaProtegida.
*/
export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/cadastro" element={<Cadastro />} />
        <Route
          path="/"
          element={
            <RotaProtegida>
              <Estoque />
            </RotaProtegida>
          }
        />
        {/* Qualquer rota desconhecida volta para a página inicial */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
