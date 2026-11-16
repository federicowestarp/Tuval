import { Encabezado } from "@/components/Encabezado";
import { ListaPedido } from "./ListaPedido";

export default function Lista() {
  return (
    <div className="flex flex-1 flex-col bg-niebla">
      <header className="bg-azul"><Encabezado /></header>
      <main className="mx-auto w-full max-w-2xl flex-1 space-y-4 px-4 py-8">
        <h1 className="font-display text-3xl font-bold">Pide con tu lista</h1>
        <p className="text-sm text-acero">Si algo no lo tenemos en catálogo, lo buscamos por ti.</p>
        <ListaPedido />
      </main>
    </div>
  );
}
