import { PainelGestao, type BuscaGestao } from "../_components/Gestao.tsx";
export default function Page({ searchParams }: { searchParams: BuscaGestao }) {
  return <PainelGestao searchParams={searchParams} dre />;
}
