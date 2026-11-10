export default function Enviar({
  children,
  pendente,
  className = 'btn-primary',
}: {
  children: React.ReactNode;
  pendente: boolean;
  className?: string;
}) {
  return (
    <button type="submit" disabled={pendente} className={className}>
      {pendente ? 'Salvando…' : children}
    </button>
  );
}
