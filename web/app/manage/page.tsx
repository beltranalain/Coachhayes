import { redirect } from "next/navigation";

// The Control Room opens on the Overview dashboard (studio at a glance).
export default function ManageIndex() {
  redirect("/admin/overview");
}
