"use server";

import { signIn } from "@/auth";
import { AuthError } from "next-auth";

export async function loginAction(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      usuario: formData.get("usuario"),
      password: formData.get("password"),
      redirectTo: (formData.get("callbackUrl") as string) || "/",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      if (error.type === "CredentialsSignin") {
        return "Usuario o contraseña incorrectos.";
      }
      return "Ocurrió un error al iniciar sesión.";
    }
    throw error;
  }
}
