import { Encabezado } from "@/components/Encabezado";
import { FormularioPedido } from "./FormularioPedido";

export default function Carrito() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <header className="bg-azul"><Encabezado /></header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Tu pedido</h1>
        <FormularioPedido />
      </main>
    </div>
  );
}
