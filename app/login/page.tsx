import { LoginForm } from "@/components/login-form";
import { ParallaxBackground } from "@/components/parallax-background";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login | Controle de Estoque PES - Manaus",
  description: "Acesse o painel do Sistema Integrado de Aging e Pesagem - Grupo EMS",
};

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center text-white p-4 relative overflow-hidden selection:bg-[#AEE4FF] selection:text-[#13283E]">
      <ParallaxBackground className="bg-[#0B1724]" />

      <div className="relative z-10 w-full flex justify-center py-8">
        <LoginForm />
      </div>
    </div>
  );
}
