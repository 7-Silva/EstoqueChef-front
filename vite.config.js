import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Configuração padrão do Vite para um projeto React.
// Não precisa mexer aqui a menos que queira mudar a porta do servidor local.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
  },
});
