"use client";

import { useActionState } from "react";
import { loginAction, AuthState } from "@/app/actions/auth";

const initialState: AuthState = {};

export default function LoginPage() {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <div className="max-w-md mx-auto my-12 p-6 border rounded shadow-sm bg-white text-gray-900">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">VÉRANE 2.0 — Login</h1>
      {state?.error && (
        <div className="mb-4 p-3 rounded bg-red-50 border border-red-200 text-red-700 text-sm">
          {state.error}
        </div>
      )}
      <form action={formAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            name="email"
            required
            className="mt-1 block w-full rounded border border-gray-300 p-2 text-gray-900 bg-white"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            name="password"
            required
            className="mt-1 block w-full rounded border border-gray-300 p-2 text-gray-900 bg-white"
          />
        </div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-black text-white py-2 px-4 rounded hover:bg-gray-800 transition disabled:opacity-50 cursor-pointer"
        >
          {isPending ? "Signing in..." : "Sign In"}
        </button>
      </form>
    </div>
  );
}
