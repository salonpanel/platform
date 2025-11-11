import Link from "next/link";

export default function PanelHome() {
  return (
    <div className="p-6">
      <h1 className="text-xl font-semibold mb-4">Panel</h1>
      <div className="space-x-4">
        <Link className="underline" href="/panel/agenda">
          Agenda
        </Link>
        <Link className="underline" href="/panel/servicios">
          Servicios
        </Link>
      </div>
    </div>
  );
}

