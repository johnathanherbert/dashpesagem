import { RegisterForm } from "@/components/register-form";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Registrar | Sistema de Aging",
  description: "Crie uma nova conta no Sistema de Aging e Pesagem",
};

export default function RegisterPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4 relative">
      <div className="relative z-10 w-full flex justify-center">
        <RegisterForm />
      </div>
    </div>
  );
}
