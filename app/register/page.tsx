import { RegisterForm } from "@/components/register-form";
import { ParallaxBackground } from "@/components/parallax-background";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Criar Conta | Controle de Estoque PES - Manaus",
  description: "Crie uma nova conta no Sistema Integrado de Aging e Pesagem - Grupo EMS",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-white p-4 relative overflow-hidden selection:bg-[#AEE4FF] selection:text-[#13283E]">
      <ParallaxBackground className="bg-[#0B1724]" />

      <div className="relative z-10 w-full flex justify-center py-8">
        <RegisterForm />
      </div>
    </div>
  );
}
