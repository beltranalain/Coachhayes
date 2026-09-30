import { redirect } from "next/navigation";

// Control Room opens on Go Live (the mock's default). The exact-mock reference
// remains viewable at /templates/admin.html.
export default function ManageIndex() {
  redirect("/manage/go-live");
}
