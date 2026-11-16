import { Marco } from "@/components/marco/Marco";
import { Titulo } from "@/components/ui";
import { ListaPedido } from "./ListaPedido";

export const metadata = { title: "Pide con tu lista", description: "Escribe, pega o sube una foto de tu lista. Si algo no está en catálogo, lo conseguimos." };

export default function Lista() {
  return (
    <Marco>
      <main className="mx-auto max-w-2xl px-4 py-10 sm:px-6 sm:py-14">
        <Titulo sub="Si algo no está en catálogo, lo conseguimos.">Pide con tu lista.</Titulo>
        <ListaPedido />
      </main>
    </Marco>
  );
}
