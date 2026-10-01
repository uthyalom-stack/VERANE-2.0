import { loginAction } from "@/app/actions/auth";

export default function LoginPage() {
  return (
    <div className="max-w-md mx-auto my-12 p-6 border rounded shadow-sm bg-white text-gray-900">
      <h1 className="text-2xl font-bold mb-6 text-gray-900">VÉRANE 2.0 — Login</h1>
      <form action={loginAction} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700">Email</label>
          <input
            id="email"
            type="email"
            name="email"
            required
            className="mt-1 block w-full rounded border border-gray-300 p-2 text-gray-900 bg-white"
          />
        </div>
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">Password</label>
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
          className="w-full bg-black text-white py-2 px-4 rounded hover:bg-gray-800 transition"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
