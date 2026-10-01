import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/auth-helpers";
import { logoutAction } from "@/app/actions/auth";

export default async function AccountPage() {
  const authUser = await getCurrentUser();

  if (!authUser) {
    redirect("/login");
  }

  return (
    <div className="max-w-2xl mx-auto my-12 p-6 border rounded shadow-sm bg-white text-gray-900">
      <h1 className="text-2xl font-bold mb-4 text-gray-900">Customer Account Portal</h1>
      <p className="mb-2"><strong>Welcome:</strong> {authUser.user.name}</p>
      <p className="mb-4"><strong>Email:</strong> {authUser.user.email}</p>
      <form action={logoutAction}>
        <button
          type="submit"
          className="bg-red-600 text-white py-2 px-4 rounded hover:bg-red-700 transition cursor-pointer"
        >
          Sign Out
        </button>
      </form>
    </div>
  );
}
