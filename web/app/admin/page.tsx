import { redirect } from "next/navigation";

// The admin now lives in the Control Room, built to the mock, at /manage.
export default function AdminIndex() {
  redirect("/manage/go-live");
}
