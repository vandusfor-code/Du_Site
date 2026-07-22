import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { buscarUsuario } from "@/lib/usuarios";

declare module "next-auth" {
  interface User {
    usuario?: string;
    nombre?: string;
    modulos?: string[];
  }

  interface Session {
    user: {
      usuario: string;
      nombre: string;
      modulos: string[];
    };
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    usuario?: string;
    nombre?: string;
    modulos?: string[];
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        usuario: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        const usuario = credentials?.usuario?.toString();
        const password = credentials?.password?.toString();

        if (!usuario || !password) return null;

        const registro = await buscarUsuario(usuario);
        if (!registro || !registro.activo) return null;

        const passwordValida = await bcrypt.compare(password, registro.passwordHash);
        if (!passwordValida) return null;

        return {
          id: registro.usuario,
          usuario: registro.usuario,
          nombre: registro.nombre,
          modulos: registro.modulos,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.usuario = user.usuario as string;
        token.nombre = user.nombre as string;
        token.modulos = user.modulos as string[];
      }
      return token;
    },
    async session({ session, token }) {
      session.user.usuario = token.usuario ?? "";
      session.user.nombre = token.nombre ?? "";
      session.user.modulos = token.modulos ?? [];
      return session;
    },
  },
});
