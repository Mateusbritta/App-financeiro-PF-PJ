import type { Estado } from '@/lib/types';

export default function Mensagem({ estado }: { estado: Estado }) {
  if (estado.error) {
    return <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{estado.error}</p>;
  }
  if (estado.ok && estado.info) {
    return <p className="rounded-lg bg-brand-50 px-3 py-2 text-sm text-brand-700">{estado.info}</p>;
  }
  return null;
}
