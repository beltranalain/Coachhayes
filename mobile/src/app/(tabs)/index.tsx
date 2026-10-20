// The app opens to the community feed (the blended "home" — top-of-board strip
// + the feed), per the app's engagement-first landing. This route redirects to
// it so launching the app lands on the feed.
import { Redirect } from "expo-router";

export default function Home() {
  return <Redirect href="/community" />;
}
