import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import VibeChat from "./vibechat";

export default async function Page() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth");
  return <VibeChat userId={user.id} />;
}
