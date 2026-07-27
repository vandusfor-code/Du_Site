import { requireModulo } from "@/lib/auth-helpers";
import PqrsfComunicarView from "./PqrsfComunicarView";

export const maxDuration = 60;

export default async function PqrsfComunicarPage() {
  await requireModulo("pqrsf-comunicar");
  return <PqrsfComunicarView />;
}
