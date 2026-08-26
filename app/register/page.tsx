import { RegisterForm } from "@/components/register-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Criar Conta | Controle de Estoque PES - Manaus",
  description: "Crie uma nova conta no Sistema Integrado de Aging e Pesagem - Grupo EMS",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#0B1724] text-white p-4 relative overflow-hidden selection:bg-[#AEE4FF] selection:text-[#13283E]">
      {/* Elementos visuais de fundo / Gradients decorativos */}
      <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-[#1B3550]/40 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] rounded-full bg-[#38BDF8]/10 blur-[140px] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(#2A4D6E_1px,transparent_1px)] [background-size:24px_24px] opacity-20 pointer-events-none" />

      <div className="relative z-10 w-full flex justify-center py-8">
        <RegisterForm />
      </div>
    </div>
  );
}
