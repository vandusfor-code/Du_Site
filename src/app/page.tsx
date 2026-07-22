import { auth } from "@/auth";
import { modulosPermitidos } from "@/lib/modulos";
import { HomeView } from "@/components/home-view";
import { logoutAction } from "./logout/actions";

export default async function Home() {
  const session = await auth();
  const nombre = session?.user?.nombre ?? "";
  const modulos = modulosPermitidos(session?.user?.modulos ?? []);

  return (
    <HomeView nombre={nombre} modulos={modulos} logoutAction={logoutAction} />
  );
}
